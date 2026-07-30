(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TimerEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clampMs(value) {
    var number = Number(value);
    if (!isFinite(number) || number < 0) return 0;
    return Math.round(number);
  }

  function TimerEngine(options) {
    options = options || {};
    this.now = typeof options.now === 'function' ? options.now : function () { return Date.now(); };
    this.onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    this.onComplete = typeof options.onComplete === 'function' ? options.onComplete : function () {};
    this.durationMs = clampMs(options.durationMs || 0);
    this.remainingMs = this.durationMs;
    this.endsAt = null;
    this.status = this.durationMs > 0 ? 'idle' : 'empty';
    this._completionDelivered = false;
  }

  TimerEngine.prototype.snapshot = function () {
    this.sync(false);
    return {
      version: 2,
      durationMs: this.durationMs,
      remainingMs: this.remainingMs,
      endsAt: this.endsAt,
      status: this.status
    };
  };

  TimerEngine.prototype.emit = function () {
    this.onChange(this.snapshotWithoutSync());
  };

  TimerEngine.prototype.snapshotWithoutSync = function () {
    return {
      version: 2,
      durationMs: this.durationMs,
      remainingMs: this.remainingMs,
      endsAt: this.endsAt,
      status: this.status
    };
  };

  TimerEngine.prototype.setDuration = function (durationMs) {
    this.durationMs = clampMs(durationMs);
    this.remainingMs = this.durationMs;
    this.endsAt = null;
    this._completionDelivered = false;
    this.status = this.durationMs > 0 ? 'idle' : 'empty';
    this.emit();
  };

  TimerEngine.prototype.start = function () {
    if (this.durationMs <= 0) {
      this.status = 'empty';
      this.emit();
      return false;
    }
    if (this.status === 'running') return true;
    if (this.remainingMs <= 0 || this.status === 'complete') this.remainingMs = this.durationMs;
    this.endsAt = this.now() + this.remainingMs;
    this.status = 'running';
    this._completionDelivered = false;
    this.emit();
    return true;
  };

  TimerEngine.prototype.pause = function () {
    if (this.status !== 'running') return false;
    this.sync(false);
    if (this.status === 'complete') return true;
    this.endsAt = null;
    this.status = 'paused';
    this.emit();
    return true;
  };

  TimerEngine.prototype.reset = function () {
    this.endsAt = null;
    this.remainingMs = this.durationMs;
    this._completionDelivered = false;
    this.status = this.durationMs > 0 ? 'idle' : 'empty';
    this.emit();
  };

  TimerEngine.prototype.complete = function () {
    this.endsAt = null;
    this.remainingMs = 0;
    this.status = this.durationMs > 0 ? 'complete' : 'empty';
    this.deliverCompletion();
    this.emit();
  };

  TimerEngine.prototype.deliverCompletion = function () {
    if (this._completionDelivered || this.status !== 'complete') return;
    this._completionDelivered = true;
    this.onComplete(this.snapshotWithoutSync());
  };

  TimerEngine.prototype.sync = function (shouldEmit) {
    if (this.status !== 'running' || this.endsAt === null) return this.snapshotWithoutSync();
    this.remainingMs = Math.max(0, this.endsAt - this.now());
    if (this.remainingMs === 0) {
      this.endsAt = null;
      this.status = 'complete';
      this.deliverCompletion();
    }
    if (shouldEmit !== false) this.emit();
    return this.snapshotWithoutSync();
  };

  TimerEngine.prototype.restore = function (saved) {
    if (!saved || Number(saved.version) !== 2) return false;
    this.durationMs = clampMs(saved.durationMs);
    this.remainingMs = Math.min(this.durationMs, clampMs(saved.remainingMs));
    this.endsAt = saved.endsAt === null ? null : Number(saved.endsAt);
    this.status = saved.status;
    this._completionDelivered = false;

    if (this.durationMs <= 0) {
      this.status = 'empty';
      this.remainingMs = 0;
      this.endsAt = null;
    } else if (this.status === 'running') {
      if (!isFinite(this.endsAt)) {
        this.status = 'paused';
        this.endsAt = null;
      } else {
        this.sync(false);
      }
    } else if (this.status !== 'idle' && this.status !== 'paused' && this.status !== 'complete') {
      this.status = 'idle';
      this.remainingMs = this.durationMs;
      this.endsAt = null;
    }

    this.emit();
    return true;
  };

  return TimerEngine;
}));

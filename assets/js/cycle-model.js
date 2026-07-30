(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CycleModel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STEPS = [
    { id: 'focus-1', type: 'focus', label: 'foco 1', minutes: 25, focusNumber: 1 },
    { id: 'break-1', type: 'break', label: 'pausa curta', minutes: 5, focusNumber: 1 },
    { id: 'focus-2', type: 'focus', label: 'foco 2', minutes: 25, focusNumber: 2 },
    { id: 'break-2', type: 'break', label: 'pausa curta', minutes: 5, focusNumber: 2 },
    { id: 'focus-3', type: 'focus', label: 'foco 3', minutes: 25, focusNumber: 3 },
    { id: 'break-3', type: 'break', label: 'pausa curta', minutes: 5, focusNumber: 3 },
    { id: 'focus-4', type: 'focus', label: 'foco 4', minutes: 25, focusNumber: 4 },
    { id: 'long-break', type: 'long-break', label: 'pausa longa', minutes: 15, focusNumber: 4 }
  ];

  function normalizeIndex(value) {
    var index = parseInt(value, 10);
    if (!isFinite(index) || index < 0) return 0;
    return index % STEPS.length;
  }

  function CycleModel(index) {
    this.index = normalizeIndex(index || 0);
  }

  CycleModel.prototype.current = function () {
    return Object.assign({}, STEPS[this.index], { index: this.index, total: STEPS.length });
  };

  CycleModel.prototype.next = function () {
    this.index = (this.index + 1) % STEPS.length;
    return this.current();
  };

  CycleModel.prototype.previous = function () {
    this.index = (this.index - 1 + STEPS.length) % STEPS.length;
    return this.current();
  };

  CycleModel.prototype.goTo = function (index) {
    this.index = normalizeIndex(index);
    return this.current();
  };

  CycleModel.prototype.reset = function () {
    this.index = 0;
    return this.current();
  };

  CycleModel.prototype.snapshot = function () {
    return { version: 1, index: this.index };
  };

  CycleModel.prototype.restore = function (saved) {
    if (!saved || Number(saved.version) !== 1) return false;
    this.index = normalizeIndex(saved.index);
    return true;
  };

  CycleModel.steps = function () {
    return STEPS.map(function (step, index) { return Object.assign({}, step, { index: index, total: STEPS.length }); });
  };

  return CycleModel;
}));

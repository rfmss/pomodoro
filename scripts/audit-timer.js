'use strict';
var assert = require('assert');
var TimerEngine = require('../assets/js/timer-engine.js');

var now = 1000000;
var completions = 0;
var engine = new TimerEngine({
  durationMs: 25 * 60 * 1000,
  now: function () { return now; },
  onComplete: function () { completions += 1; }
});

assert.equal(engine.status, 'idle');
assert.equal(engine.start(), true);
assert.equal(engine.endsAt, now + 25 * 60 * 1000);

now += 10 * 60 * 1000;
engine.sync(false);
assert.equal(engine.remainingMs, 15 * 60 * 1000, 'mede tempo absoluto após suspensão');

engine.pause();
var paused = engine.remainingMs;
now += 5 * 60 * 1000;
engine.sync(false);
assert.equal(engine.remainingMs, paused, 'pausa não consome tempo');

engine.start();
now += paused + 1000;
engine.sync(false);
assert.equal(engine.status, 'complete');
assert.equal(engine.remainingMs, 0);
assert.equal(completions, 1, 'conclusão emitida uma vez');
engine.sync(false);
assert.equal(completions, 1, 'sincronizações posteriores não duplicam conclusão');

engine.reset();
engine.start();
now += 3 * 60 * 1000;
var saved = engine.snapshot();
var restoredCompletions = 0;
var restored = new TimerEngine({
  now: function () { return now; },
  onComplete: function () { restoredCompletions += 1; }
});
assert.equal(restored.restore(saved), true);
assert.equal(restored.status, 'running');
assert.equal(restored.remainingMs, 22 * 60 * 1000);

now += 23 * 60 * 1000;
restored.sync(false);
assert.equal(restored.status, 'complete');
assert.equal(restoredCompletions, 1, 'sessão expirada em segundo plano é concluída');

restored.setDuration(0);
assert.equal(restored.status, 'empty');
assert.equal(restored.start(), false, 'não inicia sem temporizador');

console.log('AUDITORIA APROVADA');
console.log('- tempo absoluto e retomada: ok');
console.log('- pausa: ok');
console.log('- persistência: ok');
console.log('- conclusão única: ok');
console.log('- estado vazio: ok');

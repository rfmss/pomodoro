'use strict';
var assert = require('assert');
var CycleModel = require('../assets/js/cycle-model.js');

var steps = CycleModel.steps();
assert.equal(steps.length, 8, 'o ciclo possui oito etapas');
assert.deepEqual(steps.map(function (step) { return step.minutes; }), [25, 5, 25, 5, 25, 5, 25, 15]);
assert.equal(steps.filter(function (step) { return step.type === 'focus'; }).length, 4);
assert.equal(steps[7].type, 'long-break');

var cycle = new CycleModel();
assert.equal(cycle.current().id, 'focus-1');
for (var index = 0; index < 7; index++) cycle.next();
assert.equal(cycle.current().id, 'long-break');
cycle.next();
assert.equal(cycle.current().id, 'focus-1', 'o ciclo reinicia após a pausa longa');

cycle.goTo(5);
var saved = cycle.snapshot();
var restored = new CycleModel();
assert.equal(restored.restore(saved), true);
assert.equal(restored.current().id, 'break-3');

restored.goTo(999);
assert.equal(restored.current().index, 7, 'índices são normalizados');
restored.reset();
assert.equal(restored.current().index, 0);

console.log('CICLO APROVADO');
console.log('- 4 focos: ok');
console.log('- 3 pausas curtas + 1 longa: ok');
console.log('- progressão e reinício: ok');
console.log('- persistência: ok');

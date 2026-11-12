// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const E = require('../engine.js');

test('precedence like iOS', () => {
  assert.strictEqual(E.evaluate([2, '+', 3, '*', 4]), 14);
  assert.strictEqual(E.evaluate([10, '-', 6, '/', 3]), 8);
  assert.strictEqual(E.evaluate([0.1, '+', 0.2]), 0.3);
});

test('pending operand reused by =', () => {
  assert.strictEqual(E.pendingOperand([5, '+']), 5);
  assert.strictEqual(E.pendingOperand([2, '+', 3, '*']), 3);
  assert.strictEqual(E.pendingOperand([2, '*', 3, '+']), 6);
});

test('solves the operand that hits the force number', () => {
  const cases = [
    [[1234, '+'], 5000],
    [[9876, '-'], 1234],
    [[2, '+', 3, '*'], 1000],
    [[250, '*'], 1000],
    [[1000, '/'], 250],
    [[10, '-', 6, '/'], 7],
    [[41, '+', 1, '-'], 17],
  ];
  for (const [seq, target] of cases) {
    const q = E.round9(E.solveOperand(seq, target));
    assert.ok(Math.abs(E.evaluate(seq.concat([q])) - target) < 1e-6, `${seq} -> ${q}`);
  }
});

test('formatting', () => {
  assert.strictEqual(E.formatNumber(1234567.5), '1,234,567.5');
  assert.strictEqual(E.formatNumber(1234567.5, true), '1.234.567,5');
  assert.strictEqual(E.formatNumber(1 / 3), '0.33333333');
  assert.strictEqual(E.formatNumber(-0), '-0');
  assert.strictEqual(E.formatNumber(1e12), '1e12');
  assert.strictEqual(E.formatNumber(NaN), 'Error');
  assert.strictEqual(E.formatEntry('1234.50'), '1,234.50');
  assert.strictEqual(E.expressionText([55, '+', 6623, '*', 2]), '55+6,623×2');
  assert.strictEqual(E.plainString(0.125), '0.125');
  assert.strictEqual(E.plainString(1e-7), '0.0000001');
});

// Pure calculator maths and number formatting. No DOM here, so it can be unit-tested in Node.
// Works as a browser global (window.CalcEngine) and as a CommonJS module.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CalcEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const MAX_DIGITS = 9;

  const isOp = (t) => typeof t === 'string' && t in PREC;

  function apply(a, op, b) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (op === '/') return b === 0 ? NaN : a / b;
    return b;
  }

  // iOS works to 9 significant digits; rounding each step also hides float noise (0.1+0.2).
  function round9(n) {
    return Number.isFinite(n) ? parseFloat(n.toPrecision(MAX_DIGITS)) : n;
  }

  // Collapse the top of a stack [a, op, b, op, c ...] while the operator under the last
  // number binds at least as tightly as minPrec.
  function collapse(stack, minPrec) {
    while (stack.length >= 3 && PREC[stack[stack.length - 2]] >= minPrec) {
      const b = stack.pop();
      const op = stack.pop();
      const a = stack.pop();
      stack.push(round9(apply(a, op, b)));
    }
    return stack;
  }

  // Reduce an alternating number/operator sequence as far as precedence allows so far.
  // "2 + 3 ×" stays [2, '+', 3, '×'], "2 × 3 +" becomes [6, '+'].
  function fold(seq) {
    const stack = [];
    for (const t of seq) {
      if (isOp(t)) collapse(stack, PREC[t]);
      stack.push(t);
    }
    return stack;
  }

  // Full value of a sequence that ends in a number.
  function evaluate(seq) {
    return collapse(fold(seq), 1)[0];
  }

  // For a sequence ending in an operator: the number iOS reuses if you press = straight away
  // ("5 + =" is 10, "2 + 3 × =" is 2 + 3 × 3).
  function pendingOperand(seq) {
    const stack = fold(seq);
    return stack[stack.length - 2];
  }

  // The operand q that, typed after a sequence ending in an operator, makes the whole thing
  // equal target. The result is affine in q (a + b·q) unless the last operator is ÷,
  // where it's a + b/q. Two probes pin down a and b either way.
  function solveOperand(seq, target) {
    const f = (q) => evaluate(seq.concat([q]));
    if (seq[seq.length - 1] === '/') {
      const f1 = f(1);
      const f2 = f(2);
      const b = 2 * (f1 - f2);
      const a = f1 - b;
      return b / (target - a);
    }
    const f0 = f(0);
    return (target - f0) / (f(1) - f0);
  }

  // ----- Formatting -----
  function separators(euro) {
    return euro ? { group: '.', dec: ',' } : { group: ',', dec: '.' };
  }

  function group(intPart, sep) {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  // A number being typed, exactly as typed (keeps "12." and "0.50").
  function formatEntry(s, euro) {
    const { group: g, dec } = separators(euro);
    const neg = s[0] === '-';
    if (neg) s = s.slice(1);
    const [i, f] = s.split('.');
    return (neg ? '-' : '') + group(i || '0', g) + (f !== undefined ? dec + f : '');
  }

  function formatExp(n, euro) {
    let [m, e] = n.toExponential(6).split('e');
    m = m.replace(/\.?0+$/, '');
    return m.replace('.', separators(euro).dec) + 'e' + e.replace('+', '');
  }

  // A computed number the way iOS shows it: at most 9 digits on screen, grouped,
  // e-notation when it won't fit.
  function formatNumber(n, euro) {
    if (!Number.isFinite(n)) return 'Error';
    if (Object.is(n, -0)) return '-0';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e9) return formatExp(n, euro);
    const intDigits = abs < 1 ? 1 : Math.floor(Math.log10(abs)) + 1;
    let s = abs.toFixed(Math.max(0, MAX_DIGITS - intDigits));
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    if (parseFloat(s) === 0 || s.split('.')[0].length > MAX_DIGITS) return formatExp(n, euro);
    return formatEntry((n < 0 ? '-' : '') + s, euro);
  }

  // A number as a plain digit string with no exponent ("1234", "0.125"), or null if it
  // can't be written that way within the digit limit.
  function plainString(n) {
    if (!Number.isFinite(n)) return null;
    let s = String(round9(n));
    if (s.includes('e')) {
      if (Math.abs(n) >= 1e9) return null;
      s = n.toFixed(MAX_DIGITS).replace(/\.?0+$/, '');
    }
    return s;
  }

  function expressionText(seq, euro) {
    return seq.map((t) => (isOp(t) ? SYMBOL[t] : formatNumber(t, euro))).join('');
  }

  return {
    PREC,
    SYMBOL,
    MAX_DIGITS,
    isOp,
    apply,
    round9,
    fold,
    evaluate,
    pendingOperand,
    solveOperand,
    formatEntry,
    formatNumber,
    plainString,
    expressionText,
  };
});

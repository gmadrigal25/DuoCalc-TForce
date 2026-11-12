(() => {
  'use strict';

  const E = window.CalcEngine;
  const $ = (id) => document.getElementById(id);

  const calcEl = $('calc');
  const probe = $('safeProbe');
  const displayEl = $('display');
  const textEl = $('displayText');
  const exprEl = $('expr');
  const exprTextEl = $('exprText');
  const keypad = $('keypad');
  const clearKey = $('clearKey');
  const decimalKey = $('decimalKey');
  const clockBtn = $('clockBtn');
  const modeBtn = $('modeBtn');
  const minuteHand = $('minuteHand');
  const toastEl = $('toast');

  const HOLD_MS = 700;
  const DOUBLE_TAP_MS = 400;
  const TOAST_MS = 1400;
  const MIN_TEXT_SCALE = 0.75;
  const KEYS = {
    target: 'duocalc.target',
    format: 'duocalc.format',
    lift: 'duocalc.lift',
    blackout: 'duocalc.blackout',
  };

  const store = {
    get(k) {
      try { return localStorage.getItem(k); } catch (e) { return null; }
    },
    set(k, v) {
      try { localStorage.setItem(k, v); } catch (e) { /* private mode etc. */ }
    },
    remove(k) {
      try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    },
  };

  // ======================================================================
  // Layout. Recomputed on every resize, so folding / unfolding the Duo (or
  // rotating) re-fits the calculator without losing anything that's typed.
  // ======================================================================
  const REF_KEY = 84.25; // key diameter on a 393pt-wide iPhone; all other sizes are relative to it
  const GAP_RATIO = 8 / REF_KEY;
  const MAX_KEY_ASPECT = 1.8; // widest a capsule key gets before the keypad centres instead

  let lift = parseFloat(store.get(KEYS.lift)) || 0; // manual vertical nudge in pt (+ moves down)
  let blackoutSideways = store.get(KEYS.blackout) === '1';

  function insets() {
    const cs = getComputedStyle(probe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  }

  function layout() {
    const W = calcEl.clientWidth;
    const H = calcEl.clientHeight;
    if (!W || !H) return;
    const safe = insets();
    const standalone =
      navigator.standalone === true ||
      (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    const top = safe.top + (standalone ? 0 : 10);
    const usableW = W - safe.left - safe.right;
    const pad = Math.min(28, Math.max(12, (usableW * 16) / 393));

    // Biggest key the width allows, and the biggest the height allows once room is left for
    // the top buttons (~0.52 key), the two text lines (~1.45 keys) and the bottom margin.
    const keyFromW = (usableW - 2 * pad) / (4 + 3 * GAP_RATIO);
    const keyFromH = (H - top - safe.bottom) / (0.52 + 1.45 + 5 + 4 * GAP_RATIO + 0.33);
    const keyH = Math.min(keyFromW, keyFromH);
    const s = keyH / REF_KEY;
    const keyW = Math.min(keyFromW, keyH * MAX_KEY_ASPECT);
    const gapY = 8 * s;
    const gapX = keyW >= keyFromW - 0.01 ? (usableW - 2 * pad - 4 * keyW) / 3 : gapY;

    const kpWidth = 4 * keyW + 3 * gapX;
    const kpHeight = 5 * keyH + 4 * gapY;
    const kpLeft = safe.left + (usableW - kpWidth) / 2;
    const kpTop = H - safe.bottom - 28 * s - kpHeight + lift;

    const dispFont = 64 * s;
    const dispTop = kpTop - 13 * s - dispFont;
    const exprFont = 27 * s;
    const exprTop = dispTop - 13 * s - exprFont;
    const round = Math.min(56, Math.max(34, 44 * s));

    const vars = {
      '--s': s.toFixed(4),
      '--key-w': keyW + 'px',
      '--key-h': keyH + 'px',
      '--gap-x': gapX + 'px',
      '--gap-y': gapY + 'px',
      '--kp-left': kpLeft + 'px',
      '--kp-top': kpTop + 'px',
      '--kp-width': kpWidth + 'px',
      '--label': 35 * s + 'px',
      '--disp-font': dispFont + 'px',
      '--disp-top': dispTop + 'px',
      '--expr-font': exprFont + 'px',
      '--expr-top': exprTop + 'px',
      '--text-left': kpLeft + 'px',
      '--text-right': W - kpLeft - kpWidth + 'px',
      '--round': round + 'px',
      '--round-top': top + 'px',
      '--round-left': safe.left + pad + 'px',
      '--round-right': safe.right + pad + 'px',
    };
    const root = document.documentElement.style;
    for (const k in vars) root.setProperty(k, vars[k]);

    calcEl.classList.toggle('blackout', blackoutSideways && W > H);
    window.scrollTo(0, 0);
    fitDisplay();
  }

  // ======================================================================
  // Calculator state
  //   seq    committed numbers and operators, e.g. [55, '+', 6623, '+'];
  //          it always ends in an operator when non-empty
  //   entry  the number being typed, as a string ("12.5", "-0"), or null
  //   result the number shown when nothing is pending
  //   repeat the last operator/operand, so pressing = again repeats it
  //   grey   the sum shown in grey above a result
  // ======================================================================
  let seq = [];
  let entry = null;
  let result = 0;
  let repeat = null;
  let grey = [];
  let euro = store.get(KEYS.format) === 'eu';

  const force = {
    target: null, // the number to force, or null
    armed: false, // true once an operator has been pressed twice
    digits: '', // what the spectator's taps will type, e.g. "1234" or ".5"
    fed: 0, // how many of those have been typed so far
  };

  const pending = () => seq.length > 0;
  const lastOf = (a) => a[a.length - 1];

  function currentValue() {
    if (entry !== null) return parseFloat(entry) || 0;
    if (pending()) return E.pendingOperand(seq);
    return result;
  }

  function bigText() {
    const typed = entry !== null ? E.formatEntry(entry, euro) : '';
    if (pending()) return E.expressionText(seq, euro) + typed;
    return entry !== null ? typed : E.formatNumber(result, euro);
  }

  // Shrink long text to fit, down to 75%; past that, let it run off the left edge with a fade.
  function fitText(el, box) {
    el.style.fontSize = '';
    const base = parseFloat(getComputedStyle(el).fontSize);
    const avail = box.clientWidth;
    if (el.scrollWidth > avail) {
      el.style.fontSize = Math.max(base * MIN_TEXT_SCALE, (base * avail) / el.scrollWidth) + 'px';
    }
    box.classList.toggle('clipped', el.scrollWidth > avail + 0.5);
  }

  function fitDisplay() {
    fitText(textEl, displayEl);
    fitText(exprTextEl, exprEl);
  }

  function render() {
    textEl.textContent = bigText();
    exprTextEl.textContent = pending() || !grey.length ? '' : E.expressionText(grey, euro);
    clearKey.textContent = entry !== null || pending() ? 'C' : 'AC';
    decimalKey.textContent = euro ? ',' : '.';
    fitDisplay();
  }

  // Show something other than the real display while a button is held.
  function peek(n) {
    textEl.textContent = E.formatNumber(n, euro);
    fitText(textEl, displayEl);
  }

  function allClear() {
    seq = [];
    entry = null;
    result = 0;
    repeat = null;
    grey = [];
    disarm();
    render();
  }

  // ----- Keys -----
  function typeDigit(d, forced) {
    if (entry === null) {
      if (!pending()) grey = []; // typing after a result starts afresh
      entry = d === '.' ? '0.' : d;
    } else if (d === '.') {
      if (entry.includes('.')) return;
      entry += '.';
    } else {
      // Forced digits skip the 9-digit limit so a long answer still goes in whole.
      if (!forced && entry.replace(/[-.]/g, '').length >= E.MAX_DIGITS) return;
      if (entry === '0') entry = d;
      else if (entry === '-0') entry = '-' + d;
      else entry += d;
    }
    render();
  }

  function typeOperator(op) {
    repeat = null;
    grey = [];
    if (entry === null && E.isOp(lastOf(seq))) {
      // The same operator again with nothing typed in between arms the force.
      if (lastOf(seq) === op && force.target !== null && !force.armed) {
        arm();
        return;
      }
      seq[seq.length - 1] = op; // otherwise it just swaps the pending operator
    } else {
      seq.push(currentValue(), op);
    }
    entry = null;
    render();
  }

  function equals() {
    if (pending()) {
      const v = currentValue();
      const full = seq.concat([v]);
      repeat = { op: lastOf(seq), operand: v };
      grey = full;
      result = E.evaluate(full);
    } else if (repeat) {
      const v = currentValue();
      grey = [v, repeat.op, repeat.operand];
      result = E.round9(E.apply(v, repeat.op, repeat.operand));
    } else {
      result = currentValue();
      grey = [];
    }
    seq = [];
    entry = null;
    render();
  }

  function negate() {
    if (entry !== null) entry = entry[0] === '-' ? entry.slice(1) : '-' + entry;
    else if (pending()) entry = '-0';
    else {
      result = -result;
      if (Object.is(result, -0)) entry = '-0';
    }
    render();
  }

  // iOS: after + or −, x% means x% of the running value; otherwise it's x / 100.
  function percent() {
    const v = currentValue();
    const op = lastOf(seq);
    const r = E.round9(
      pending() && (op === '+' || op === '-') ? (E.pendingOperand(seq) * v) / 100 : v / 100,
    );
    if (pending()) entry = E.plainString(r) ?? '0';
    else {
      result = r;
      entry = null;
    }
    render();
  }

  // C clears what's being typed; AC (or C with nothing typed) clears everything.
  function clearKeyPressed() {
    if (entry !== null) {
      entry = null;
      if (!pending()) result = 0;
      render();
      return;
    }
    allClear();
  }

  // Deletes the last character on screen: a typed digit, a trailing operator, or a digit of a
  // result (which then becomes editable).
  function backspace() {
    if (entry === null) {
      if (pending()) {
        seq.pop();
        entry = E.plainString(seq.pop());
        render();
        return;
      }
      entry = result === 0 ? null : E.plainString(result);
      if (entry === null) {
        result = 0;
        render();
        return;
      }
      grey = [];
    }
    entry = entry.slice(0, -1);
    if (entry === '' || entry === '-') {
      entry = null;
      if (!pending()) result = 0;
    }
    render();
  }

  // ======================================================================
  // The force
  // ======================================================================

  // The tell, on the clock's minute hand:
  //   3 o'clock  nothing set
  //   9 o'clock  force number set (and while the spectator's digits are still owed)
  //   6 o'clock  every digit is in; = will show the force number
  function tell() {
    let x = 17;
    let y = 12;
    if (force.armed && force.fed >= force.digits.length) {
      x = 12;
      y = 17;
    } else if (force.target !== null) {
      x = 7;
      y = 12;
    }
    minuteHand.setAttribute('x2', String(x));
    minuteHand.setAttribute('y2', String(y));
  }

  function setTarget(n) {
    if (!Number.isFinite(n)) return clearTarget();
    force.target = E.round9(n);
    store.set(KEYS.target, String(force.target));
    tell();
  }

  function clearTarget() {
    force.target = null;
    store.remove(KEYS.target);
    tell();
  }

  function disarm() {
    force.armed = false;
    force.digits = '';
    force.fed = 0;
    tell();
  }

  const digitsComplete = () => force.armed && force.fed >= force.digits.length;

  // What the sequence would be if op were pressed now.
  function prospectiveSeq(op) {
    const s = seq.slice();
    if (entry === null && E.isOp(lastOf(s))) s[s.length - 1] = op;
    else s.push(currentValue(), op);
    return s;
  }

  // The number the spectator must enter after op to land on the force number.
  function neededFor(op) {
    return E.round9(E.solveOperand(prospectiveSeq(op), force.target));
  }

  function arm() {
    const q = E.round9(E.solveOperand(seq, force.target));
    let digits = E.plainString(Math.abs(q)) ?? '0';
    if (digits.startsWith('0.')) digits = digits.slice(1); // "." types "0." in one tap
    force.digits = digits;
    force.fed = 0;
    force.armed = true;
    tell();
  }

  function feedDigit() {
    if (digitsComplete()) return;
    typeDigit(force.digits[force.fed++], true);
    tell();
  }

  // Backspace while armed removes the last fed digit; the next tap types it again.
  function forceBackspace() {
    if (force.fed === 0 || entry === null) return;
    force.fed--;
    entry = force.fed === 0 ? null : entry.slice(0, -1);
    render();
    tell();
  }

  function finishForce() {
    grey = seq.concat([currentValue()]); // reads as the sum that was "typed", e.g. 1,234+5,555
    result = force.target;
    seq = [];
    entry = null;
    repeat = null;
    clearTarget();
    disarm();
    render();
  }

  // ======================================================================
  // Input dispatch
  // ======================================================================
  function press(key) {
    if (force.armed) {
      if (key === 'bs') return forceBackspace();
      if (!digitsComplete()) return; // taps are typing the spectator's number
      if (key === '=') return finishForce();
      if (key === 'clear') return allClear(); // abandon; the force number stays set
      return;
    }
    switch (key) {
      case 'clear': return clearKeyPressed();
      case 'bs': return backspace();
      case 'negate': return negate();
      case 'percent': return percent();
      case '=': return equals();
      case '+': case '-': case '*': case '/': return typeOperator(key);
      default:
        if (/^[0-9.]$/.test(key)) typeDigit(key, false);
    }
  }

  // While armed, every tap gesture anywhere types the next digit: one digit per gesture
  // however many fingers land. Backspace is the exception.
  const pointers = new Set();
  let gestureFed = false;
  let lastFeedAt = -Infinity;
  document.addEventListener('pointerdown', (e) => {
    const idle = pointers.size === 0;
    pointers.add(e.pointerId);
    if (!idle) return;
    gestureFed = false;
    if (!force.armed || digitsComplete()) return;
    if (e.target.closest && e.target.closest('[data-key="bs"]')) return;
    const now = performance.now();
    if (now - lastFeedAt < 60) return; // two fingers landing a hair apart = one tap
    lastFeedAt = now;
    gestureFed = true;
    feedDigit();
  }, { capture: true });
  const pointerGone = (e) => pointers.delete(e.pointerId);
  document.addEventListener('pointerup', pointerGone, { capture: true });
  document.addEventListener('pointercancel', pointerGone, { capture: true });
  const allFingersUp = (e) => {
    if (e.touches.length === 0) pointers.clear();
  };
  document.addEventListener('touchend', allFingersUp, { capture: true });
  document.addEventListener('touchcancel', allFingersUp, { capture: true });
  document.addEventListener('visibilitychange', () => pointers.clear());

  // Key press visuals
  const keyOf = (e) => (e.target.closest ? e.target.closest('.key') : null);
  keypad.addEventListener('pointerdown', (e) => {
    const k = keyOf(e);
    if (k) k.classList.add('pressed');
  });
  const unpress = (e) => {
    const k = keyOf(e);
    if (k) k.classList.remove('pressed');
  };
  ['pointerup', 'pointercancel', 'pointerout'].forEach((t) => keypad.addEventListener(t, unpress));

  let swallowClick = false;
  keypad.addEventListener('click', (e) => {
    const k = keyOf(e);
    if (!k) return;
    // The tap that typed a forced digit (including the last one) must not also act as a key.
    if (gestureFed || swallowClick) {
      swallowClick = false;
      return;
    }
    press(k.dataset.key);
  });

  // Hold an operator (force number set, not armed): the display shows the number the spectator
  // would need after that operator. Letting go restores it and doesn't press the operator.
  let opHoldTimer = null;
  let opPeeking = false;
  keypad.addEventListener('pointerdown', (e) => {
    const k = e.target.closest && e.target.closest('.key.op');
    if (!k || !(k.dataset.key in E.PREC) || force.target === null || force.armed) return;
    const op = k.dataset.key;
    clearTimeout(opHoldTimer);
    opHoldTimer = setTimeout(() => {
      opPeeking = true;
      peek(neededFor(op));
    }, HOLD_MS);
  });
  const endOpHold = () => {
    clearTimeout(opHoldTimer);
    opHoldTimer = null;
    if (!opPeeking) return;
    opPeeking = false;
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 300);
    render();
  };
  ['pointerup', 'pointercancel', 'pointerout'].forEach((t) => keypad.addEventListener(t, endOpHold));

  // Swipe sideways on the number to delete a digit, as on iOS.
  let swipeFrom = null;
  displayEl.addEventListener('pointerdown', (e) => { swipeFrom = { x: e.clientX, y: e.clientY }; });
  displayEl.addEventListener('pointerup', (e) => {
    if (!swipeFrom) return;
    const dx = e.clientX - swipeFrom.x;
    const dy = e.clientY - swipeFrom.y;
    swipeFrom = null;
    if (!force.armed && Math.abs(dx) > 30 && Math.abs(dy) < 50) backspace();
  });

  // Hold / tap handling for the two round buttons.
  function holdable(btn, { onHold, onLetGo, onTap }) {
    let timer = null;
    let held = false;
    btn.addEventListener('pointerdown', () => {
      btn.classList.add('pressed');
      held = false;
      timer = setTimeout(() => {
        held = true;
        timer = null;
        if (onHold) onHold();
      }, HOLD_MS);
    });
    const end = (tapped) => {
      btn.classList.remove('pressed');
      const wasTap = tapped && timer !== null;
      clearTimeout(timer);
      timer = null;
      if (held && onLetGo) onLetGo();
      held = false;
      if (wasTap && onTap) onTap();
    };
    btn.addEventListener('pointerup', () => end(true));
    btn.addEventListener('pointercancel', () => end(false));
    btn.addEventListener('pointerleave', () => end(false));
  }

  // Clock: hold to make the number on screen the force number (the display clears).
  // Hold with 0 on screen to clear it.
  holdable(clockBtn, {
    onHold() {
      if (force.armed) return;
      const v = currentValue();
      if (v !== 0 && Number.isFinite(v)) setTarget(v);
      else clearTarget();
      allClear();
    },
  });

  let toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), TOAST_MS);
  }

  function toggleFormat() {
    if (force.armed) return;
    euro = !euro;
    store.set(KEYS.format, euro ? 'eu' : 'us');
    render();
    toast(euro ? 'European · 1.234,56' : 'US · 1,234.56');
  }

  // Calculator icon: hold to peek at the force number; double-tap to switch number format.
  let lastModeTap = -Infinity;
  holdable(modeBtn, {
    onHold() {
      if (!force.armed && force.target !== null) peek(force.target);
    },
    onLetGo: render,
    onTap() {
      const now = performance.now();
      if (now - lastModeTap < DOUBLE_TAP_MS) {
        lastModeTap = -Infinity;
        toggleFormat();
      } else lastModeTap = now;
    },
  });

  // No zooming, callouts or text selection.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // Keyboard (desktop testing, or a keyboard attached to the phone).
  document.addEventListener('keydown', (e) => {
    const map = { Enter: '=', Backspace: 'bs', Escape: 'clear', Delete: 'clear', '%': 'percent', x: '*', X: '*', ',': '.' };
    const key = map[e.key] || e.key;
    if (/^[0-9.+\-*/=]$/.test(key) || key === 'clear' || key === 'percent' || key === 'bs') {
      e.preventDefault();
      if (force.armed && !digitsComplete() && key !== 'bs') feedDigit();
      else press(key);
    }
  });

  // Re-fit on every size change: fold, unfold, rotate, Stage Manager style resizes.
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 250));
  if (window.visualViewport) visualViewport.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(calcEl);

  // ----- URL options (handy from an iOS Shortcut) -----
  //   ?t=1234       preset the force number
  //   ?lift=-6      nudge the layout up/down in points if it sits wrong on your phone (0 resets)
  //   ?blackout=1   go black when the screen is wider than tall (0 turns it off)
  function readOptions() {
    const p = new URLSearchParams(location.search);
    const hash = (location.hash.match(/^#t=(.+)$/) || [])[1];
    const t = p.get('t') ?? hash;
    let used = false;
    if (t !== null && t !== undefined && t !== '') {
      setTarget(parseFloat(t));
      used = true;
    } else {
      const saved = parseFloat(store.get(KEYS.target));
      force.target = Number.isFinite(saved) ? saved : null;
    }
    if (p.has('lift')) {
      lift = parseFloat(p.get('lift')) || 0;
      store.set(KEYS.lift, String(lift));
      used = true;
    }
    if (p.has('blackout')) {
      blackoutSideways = p.get('blackout') === '1';
      store.set(KEYS.blackout, blackoutSideways ? '1' : '0');
      used = true;
    }
    if (used) history.replaceState(null, '', location.pathname);
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.search.includes('nosw')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  readOptions();
  tell();
  render();
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitDisplay);

  // For testing from the console; not reachable from the UI.
  window.__calc = {
    press,
    tap: () => feedDigit(),
    setTarget,
    clearTarget,
    neededFor,
    layout,
    state: () => ({ seq: seq.slice(), entry, result, grey: grey.slice(), force: { ...force }, text: textEl.textContent, greyText: exprTextEl.textContent }),
  };
})();

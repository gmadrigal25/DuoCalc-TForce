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
    screen: 'duocalc.screen',
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
  //
  // The four Duo layouts are measured from screenshots of the real Calculator
  // on the iPhone Duo (points, at 3x). They're 5 columns x 4 rows. Ordinary
  // tall iPhones get the iPhone's own 4 x 5 layout.
  // ======================================================================
  const DUO = {
    // ref: screen size the numbers were measured at. side: left/right keypad margin.
    // keyH: key height ('circle' = as tall as wide). font: big number size.
    // textGap: big number baseline to keypad. rightBtn: right edge to calculator button.
    coverPortrait: { ref: [466, 678], side: [16, 16], gap: [10, 10], keyH: 'circle', font: 72, textGap: 24, rightBtn: 104 },
    coverLandscape: { ref: [678, 466], side: [13.7, 97.3], gap: [10, 10], keyH: 46, font: 47.7, textGap: 16.3, rightBtn: 104 },
    innerPortrait: { ref: [669, 951], side: [24, 24], gap: [10, 10], keyH: 92.7, font: 111.6, textGap: 36, rightBtn: 20 },
    innerLandscape: { ref: [951, 669], side: [24, 24], gap: [12, 12], keyH: 61.3, font: 75, textGap: 24.7, rightBtn: 20 },
  };
  const COVER_MAX_SHORT_SIDE = 560; // cover screen ~466pt across, inner ~669pt
  const BASELINE = 0.86; // baseline position within a line-height:1 box, in em (SF Pro)

  let lift = parseFloat(store.get(KEYS.lift)) || 0; // manual vertical nudge in pt (+ moves down)
  let blackoutSideways = store.get(KEYS.blackout) === '1';
  let forcedScreen = store.get(KEYS.screen) || ''; // '', 'cover', 'inner' or 'iphone'

  function insets() {
    const cs = getComputedStyle(probe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  }

  function pickMode(W, H) {
    const portrait = H >= W;
    const long = Math.max(W, H);
    const short = Math.min(W, H);
    let kind = forcedScreen;
    if (!kind) {
      if (portrait && long / short > 1.7) kind = 'iphone';
      else kind = short < COVER_MAX_SHORT_SIDE ? 'cover' : 'inner';
    }
    if (kind === 'iphone' && portrait) return { kind, mode: 'iphone' };
    if (kind === 'iphone') kind = 'inner'; // a tall iPhone held sideways: use the wide layout
    return { kind, mode: kind + (portrait ? 'Portrait' : 'Landscape') };
  }

  // The iPhone layout: 4 x 5 round keys filling the width.
  function iphoneGeometry(W, H, safe) {
    const top = Math.max(safe.top, 10);
    const usableW = W - safe.left - safe.right;
    const pad = Math.min(28, Math.max(12, (usableW * 16) / 393));
    const gapRatio = 8 / 84.25;
    const keyFromW = (usableW - 2 * pad) / (4 + 3 * gapRatio);
    const keyFromH = (H - top - safe.bottom) / (0.52 + 1.45 + 5 + 4 * gapRatio + 0.33);
    const keyH = Math.min(keyFromW, keyFromH);
    const s = keyH / 84.25;
    const gap = 8 * s;
    const kpWidth = 4 * keyH + 3 * gap;
    const kpLeft = safe.left + (usableW - kpWidth) / 2;
    const kpTop = H - safe.bottom - 28 * s - (5 * keyH + 4 * gap) + lift;
    const font = 64 * s;
    return {
      cols: 4, keyW: keyH, keyH, gapX: gap, gapY: gap, kpLeft, kpTop, kpWidth,
      font, dispTop: kpTop - 13 * s - font, glyph: s, label: 35 * s,
      round: Math.min(56, Math.max(34, 44 * s)), roundTop: top,
      roundLeft: safe.left + pad, roundRight: safe.right + pad,
    };
  }

  function duoGeometry(W, H, safe, m, landscape) {
    const sy = H / m.ref[1];
    let [left, right] = m.side;
    // A reserved band on one side (cover screen, landscape). If iOS reports it as a safe
    // area, don't count it twice; if it's reported on the left, put the gap there instead.
    if (safe.left > safe.right && landscape) [left, right] = [right, left];
    left = Math.max(left, safe.left + Math.min(...m.side));
    right = Math.max(right, safe.right + Math.min(...m.side));
    const [gapX, gapY] = m.gap;
    const keyW = (W - left - right - 4 * gapX) / 5;
    const keyH =
      m.keyH === 'circle'
        ? Math.min(keyW, (0.56 * H - 3 * gapY) / 4)
        : Math.min(keyW, m.keyH * sy);
    const bottom = Math.max(34, safe.bottom);
    const kpTop = H - bottom - (4 * keyH + 3 * gapY) + lift;
    const font = m.font * sy;
    return {
      cols: 5, keyW, keyH, gapX, gapY, kpLeft: left, kpTop, kpWidth: W - left - right,
      font, dispTop: kpTop - m.textGap * sy - BASELINE * font,
      glyph: keyH * 0.0124, label: keyH * 0.43,
      round: 48, roundTop: Math.max(24, safe.top),
      roundLeft: safe.left + 20, roundRight: Math.max(m.rightBtn, safe.right + 20),
    };
  }

  function layout() {
    const W = calcEl.clientWidth;
    const H = calcEl.clientHeight;
    if (!W || !H) return;
    const safe = insets();
    const { mode } = pickMode(W, H);
    const g = mode === 'iphone' ? iphoneGeometry(W, H, safe) : duoGeometry(W, H, safe, DUO[mode], W > H);

    const exprFont = 0.42 * g.font;
    const vars = {
      '--s': g.glyph.toFixed(4),
      '--rs': (g.round / 44).toFixed(4),
      '--cols': g.cols,
      '--key-w': g.keyW + 'px',
      '--key-h': g.keyH + 'px',
      '--gap-x': g.gapX + 'px',
      '--gap-y': g.gapY + 'px',
      '--kp-left': g.kpLeft + 'px',
      '--kp-top': g.kpTop + 'px',
      '--kp-width': g.kpWidth + 'px',
      '--label': g.label + 'px',
      '--disp-font': g.font + 'px',
      '--disp-top': g.dispTop + 'px',
      '--expr-font': exprFont + 'px',
      '--expr-top': g.dispTop - 0.2 * g.font - exprFont + 'px',
      '--text-left': g.kpLeft + 'px',
      '--text-right': W - g.kpLeft - g.kpWidth + 'px',
      '--round': g.round + 'px',
      '--round-top': g.roundTop + 'px',
      '--round-left': g.roundLeft + 'px',
      '--round-right': g.roundRight + 'px',
    };
    const root = document.documentElement.style;
    for (const k in vars) root.setProperty(k, vars[k]);

    calcEl.classList.toggle('duo', mode !== 'iphone');
    calcEl.dataset.mode = mode;
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

  // The tell, on the clock's minute hand (same on every screen):
  //   3 o'clock  nothing set
  //   9 o'clock  force number set (and while the spectator's digits are still owed)
  //   6 o'clock  every digit is in; = will show the force number
  function tell() {
    const done = force.armed && force.fed >= force.digits.length;
    const set = force.target !== null;
    // The hand is drawn at 3 o'clock; rotating it swings it round. 180° = 9, 90° = 6.
    const angle = done ? 90 : set ? 180 : 0;
    minuteHand.style.transform = 'rotate(' + angle + 'deg)';
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
  // Hold / tap handling for the two round buttons. Fingers (and Apple Pencil) use touch events
  // with preventDefault, so iOS can't turn a long press into a system gesture (callout, text
  // selection, haptic menu) and cancel the hold half way. A mouse uses pointer events.
  function holdable(btn, { onHold, onLetGo, onTap }) {
    let timer = null;
    let held = false;
    let active = false;
    const start = () => {
      if (active) return;
      active = true;
      held = false;
      btn.classList.add('pressed');
      timer = setTimeout(() => {
        held = true;
        timer = null;
        if (onHold) onHold();
      }, HOLD_MS);
    };
    const end = (tapped) => {
      if (!active) return;
      active = false;
      btn.classList.remove('pressed');
      const wasTap = tapped && timer !== null;
      clearTimeout(timer);
      timer = null;
      if (held && onLetGo) onLetGo();
      held = false;
      if (wasTap && onTap) onTap();
    };
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      start();
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (e.touches.length === 0) end(true);
    }, { passive: false });
    btn.addEventListener('touchcancel', () => end(false));
    btn.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') start(); });
    btn.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') end(true); });
    btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') end(false); });
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
  //   ?screen=cover|inner|iphone   force a layout if the automatic choice is wrong (auto resets)
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
    if (p.has('screen')) {
      forcedScreen = ['cover', 'inner', 'iphone'].includes(p.get('screen')) ? p.get('screen') : '';
      if (forcedScreen) store.set(KEYS.screen, forcedScreen);
      else store.remove(KEYS.screen);
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
    mode: () => calcEl.dataset.mode,
    state: () => ({ seq: seq.slice(), entry, result, grey: grey.slice(), force: { ...force }, text: textEl.textContent, greyText: exprTextEl.textContent }),
  };
})();

// Drives the real page in Chromium at iPhone Duo-like screen sizes and runs a full
// performance, including folding/unfolding mid-trick. Screenshots go to tests/shots/.
// Run with: node tests/browser.test.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const shots = path.join(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });

// Screen sizes in points, from screenshots of the real Calculator on the iPhone Duo (3x).
const SCREENS = {
  'iphone-393x852': { width: 393, height: 852, mode: 'iphone' },
  'duo-cover-466x678': { width: 466, height: 678, mode: 'coverPortrait' },
  'duo-cover-landscape-678x466': { width: 678, height: 466, mode: 'coverLandscape' },
  'duo-inner-portrait-669x951': { width: 669, height: 951, mode: 'innerPortrait' },
  'duo-inner-landscape-951x669': { width: 951, height: 669, mode: 'innerLandscape' },
};
const size = ({ width, height }) => ({ width, height });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: size(SCREENS['duo-cover-466x678']), hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);

  const state = () => page.evaluate(() => window.__calc.state());
  const tapAt = async (x, y) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(90); };
  const key = (k) => page.click(`[data-key="${k}"]`);
  const type = async (s) => { for (const c of s) await key(c); };
  const hold = async (sel, ms = 900) => {
    const b = await page.locator(sel).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(ms);
  };

  // Layout checks at each size: everything on screen, nothing overlapping.
  for (const [name, vp] of Object.entries(SCREENS)) {
    await page.setViewportSize(size(vp));
    await page.waitForTimeout(100);
    assert.strictEqual(await page.evaluate(() => window.__calc.mode()), vp.mode, name + ' layout chosen');
    const boxes = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
      return { kp: r('#keypad'), disp: r('#display'), expr: r('#expr'), clock: r('#clockBtn'), key: r('[data-key="7"]') };
    });
    assert.ok(boxes.kp.bottom <= vp.height && boxes.kp.left >= 0 && boxes.kp.right <= vp.width, name + ' keypad fits');
    assert.ok(boxes.disp.bottom <= boxes.kp.top, name + ' display above keypad');
    assert.ok(boxes.expr.top >= boxes.clock.bottom - 1, name + ' grey line below buttons');
    console.log(name, 'key', Math.round(boxes.key.width) + 'x' + Math.round(boxes.key.height));
  }

  // --- A full performance, starting folded ---
  await page.setViewportSize(size(SCREENS['duo-cover-466x678']));
  await type('2026');
  await hold('#clockBtn'); await page.mouse.up();
  let s = await state();
  assert.strictEqual(s.force.target, 2026, 'force number set');
  assert.strictEqual(s.text, '0', 'display cleared as confirmation');

  // Spectator's genuine calculation
  await type('347'); await key('+'); await type('589'); await key('=');
  assert.strictEqual((await state()).text, '936');

  // Peek the needed number by holding +
  await hold('[data-key="+"]');
  assert.strictEqual((await state()).text, '1,090', 'hold + shows needed number');
  await page.mouse.up();
  await page.waitForTimeout(50);
  assert.strictEqual((await state()).text, '936', 'display restored, + not pressed');

  // Arm with + +
  await key('+'); await key('+');
  s = await state();
  assert.ok(s.force.armed && s.force.digits === '1090', 'armed with 1090');
  await page.screenshot({ path: path.join(shots, 'armed-folded.png') });

  // Spectator taps randomly; unfold halfway through
  await tapAt(30, 400);
  await tapAt(400, 650);
  await page.setViewportSize(size(SCREENS['duo-inner-landscape-951x669']));
  await page.waitForTimeout(100);
  await tapAt(450, 100);
  await tapAt(800, 600);
  await tapAt(100, 600); // extra tap: ignored
  s = await state();
  assert.strictEqual(s.text, '936+1,090', 'random taps typed 1090');
  assert.strictEqual(s.force.fed, 4);
  const visibleLines = await page.evaluate(() =>
    ['side1', 'side2', 'side3'].filter((id) => document.getElementById(id).style.visibility !== 'hidden').length);
  assert.strictEqual(visibleLines, 0, 'sidebar tell: no lines once all digits are in');
  await page.screenshot({ path: path.join(shots, 'digits-in-unfolded.png') });

  await key('=');
  s = await state();
  assert.strictEqual(s.text, '2,026', 'force number revealed');
  assert.strictEqual(s.greyText, '936+1,090');
  assert.strictEqual(s.force.target, null, 'force cleared after reveal');
  await page.screenshot({ path: path.join(shots, 'reveal-unfolded.png') });

  // --- Subtraction, backspace during feed ---
  await type('500'); await hold('#clockBtn'); await page.mouse.up();
  await type('9000'); await key('-'); await key('-');
  await tapAt(200, 300);
  await tapAt(200, 300);
  await key('bs');
  assert.strictEqual((await state()).text, '9,000−8');
  await tapAt(200, 300);
  await tapAt(200, 300);
  await tapAt(200, 300);
  await key('=');
  assert.strictEqual((await state()).text, '500');

  // --- Ordinary maths still works ---
  await key('clear');
  await type('2'); await key('+'); await type('3'); await key('*'); await type('4'); await key('=');
  assert.strictEqual((await state()).text, '14');
  await key('=');
  assert.strictEqual((await state()).text, '56', 'repeat =');

  for (const [name, vp] of Object.entries(SCREENS)) {
    await page.setViewportSize(size(vp));
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(shots, name + '.png') });
  }

  assert.deepStrictEqual(errors, [], 'no page errors');
  await browser.close();
  console.log('browser tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

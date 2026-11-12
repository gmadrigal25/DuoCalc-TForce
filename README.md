# DuoCalc T-Force

A working calculator web app with a hidden forcing mechanism, made to perform
[The Alright Force](https://www.thejerx.com/blog/2026/9/15/the-alright-force) (The Jerx) on the
**iPhone Duo**. It re-fits itself instantly to the folded cover screen and the unfolded inner
screen, and it keeps everything that's typed (including a force in progress) when you fold or
unfold mid-routine. It also works on any ordinary iPhone.

It recreates the behaviour of [dmaso/calcdm](https://github.com/dmaso/calcdm), the app the Alright
Force uses. It's a fresh implementation, not a copy of that code.

## Install on the phone

1. Host the folder over **HTTPS**. The easiest option is GitHub Pages: repo **Settings → Pages →
   Deploy from a branch**, pick the branch and `/ (root)`. Any static host works too.
2. Open the URL in **Safari** on the Duo, then **Share → Add to Home Screen**, and name it
   **Calculator**.
3. Launch it once from the Home Screen while online so it caches. After that it works offline.
4. Turn **Rotation Lock** on. The real Calculator switches to scientific mode when it's turned
   sideways, but this one doesn't.

## Performing

1. **Set the force number.** Type it, then **hold the top-left button** (the clock, or the
   sidebar icon when the Duo is unfolded) for about a second. The display clears and the tell
   changes (see below). Hold the **calculator icon**
   (top right) at any time to peek at the number.
2. **The spectator does real maths.** Every step is genuine and can be checked on another
   calculator.
3. **Arm it.** For the final step, press an operator **twice**: **+** if the total is below
   your number, **−** if it's above. **×** and **÷** work when the force number is a clean
   multiple or fraction of the total. Nothing visible changes.
   *Not sure which to use?* Hold any operator for a second and the display shows the number the
   spectator would need to enter. Let go and the display goes back to normal. The operator isn't
   pressed.
4. **Every tap anywhere types the next digit** of the number that's needed. The spectator can
   drum their fingers anywhere, or tap with the phone face down. Two or three fingers landing
   together count as one tap. When every digit is in, the tell changes again (below), and further
   taps do nothing. **Backspace** still deletes a digit, and the next tap re-types it.
   You can fold or unfold the phone in the middle of this.
5. **Press =**. The force number appears, with a believable sum in grey above it. The force
   number then clears itself, and the hand returns to 3 o'clock.

**The tell** is on the top-left button:

| | Clock (Duo folded, or iPhone) | Sidebar icon (Duo unfolded) |
| --- | --- | --- |
| Nothing set | hand at 3 o'clock | 3 little lines |
| Force number set, or digits still owed | hand at 9 o'clock | 2 lines |
| Every digit is in, ready for = | hand at 6 o'clock | no lines |

Other details:

- Hold the clock while the display shows **0** to clear the force number.
- After all the digits are in, **C** abandons the force but keeps the number set.
- If you choose an operator that doesn't land cleanly (for example **+** when the total is
  already above your number), = still shows the force number, but the sum won't add up. The hold
  peek warns you by showing a minus sign.
- **Double-tap** the calculator icon to switch between `1,234.56` and `1.234,56`.

### URL options (for example from an iOS Shortcut)

| URL | Effect |
| --- | --- |
| `…/?t=1234` | Preset the force number. It's kept until it's used or cleared. |
| `…/?lift=-6` | Nudge the whole layout up (negative) or down in points if it sits wrong on your phone. `?lift=0` resets it. |
| `…/?screen=cover` | Force the cover / `inner` / `iphone` layout if the automatic choice is wrong. `?screen=auto` resets it. |
| `…/?blackout=1` | Go black whenever the screen is wider than tall (`0` turns this off). It's off by default because the unfolded Duo is landscape. |

## How it fits the Duo

The layouts are measured from screenshots of the real Calculator on the iPhone Duo. To within
a pixel, they match the key sizes, gaps, margins, number size and button positions in all four
cases:

- **Folded, upright:** 5 × 4 round keys.
- **Folded, sideways:** 5 × 4 capsule keys, with the keypad stopping short of the right edge.
- **Unfolded, upright:** 5 × 4 tall capsules, with a sidebar icon top left.
- **Unfolded, sideways:** 5 × 4 wide capsules, with a sidebar icon top left.

The app picks the layout from the screen size every time it changes, so folding, unfolding and
rotating re-fit it immediately without losing anything that's typed. Ordinary tall iPhones get
the iPhone's 4 × 5 layout. If the keypad sits a little high or low on the real phone, use
`?lift=`. If the wrong layout is chosen, use `?screen=`.

## Development

Static files with no build step. Open `index.html`, or run `npm run serve`.

- `engine.js` contains the maths and formatting (iOS precedence, 9-digit display, and solving for
  the operand that hits the force number). It's pure, so it's unit-tested in Node.
- `app.js` contains the layout, input handling and force logic. `window.__calc` exposes test
  hooks.
- `style.css` contains the look. All the geometry comes from CSS variables set by `layout()`.
- `sw.js` and `manifest.webmanifest` handle offline use and Home Screen install.
- `icon.png` is drawn from scratch by `tools/make_icon.py` in the style of the iOS system icon. You can replace
  it with any 512×512 PNG.
- `npm test` runs the unit tests and a Chromium run-through of a full performance at Duo-like
  sizes, including unfolding mid-force. Screenshots go to `tests/shots/`.

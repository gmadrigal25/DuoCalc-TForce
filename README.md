# DuoCalcDM

A working replica of the iPhone Calculator, built as a web app you add to your Home Screen,
with a forcing mechanism built in. It's [CalcDM](https://github.com/dmaso/calcdm) by Dave Mason,
adapted for the **iPhone Duo**. It's made for
[The Alright Force](https://www.thejerx.com/blog/2026/9/15/the-alright-force) from The Jerx, and
lets you do the whole routine face up while the spectator drums their fingers on the screen.

Folded or unfolded, it matches the Duo's own Calculator. It re-fits instantly when you fold,
unfold or rotate the phone, and keeps a force in progress, so you can open the phone in the
middle of the routine. It also works on ordinary iPhones.

## Credits

- **[Dave Mason](https://github.com/dmaso)** created [CalcDM](https://github.com/dmaso/calcdm)
  ([calcdm.com](https://calcdm.com)), the app and forcing method this is based on. All credit
  for the idea and how it works goes to him.
- **[The Jerx](https://www.thejerx.com)** published
  [The Alright Force](https://www.thejerx.com/blog/2026/9/15/the-alright-force), the routine this
  is built for. Earlier background:
  [the calculator force, face up](https://www.thejerx.com/blog/2025/5/6/t12u882u8mz4kzsjc0hfh1efgbqdpx)
  and [Carefree Toxic](https://www.thejerx.com/blog/2025/5/13/carefree-toxic).
- [The Daily Magician: the I.C.F. force](https://thedailymagician.com/icf-force) is the force
  CalcDM was originally made for.
- [andyjermann/fakecalc](https://github.com/andyjermann/fakecalc) is the static-screenshot
  version CalcDM started from.

The name DuoCalcDM is in honour of Dave Mason's CalcDM. This version was adapted by gmadrigal25, who changed only what the iPhone Duo needed. The
code was rewritten from scratch for the Duo's two screens, while keeping CalcDM's behaviour and
controls exactly as Dave Mason designed them.

### What's different from CalcDM

- Layouts for the Duo's cover screen and inner screen, upright and sideways, using the Duo
  Calculator's 5 × 4 keypad, measured from screenshots of the real app.
- It re-fits when you fold or unfold, without losing the number, the sum or a force in
  progress.
- It doesn't black out when held sideways, because the unfolded Duo is used in landscape.
- The clock hand swings between positions rather than jumping, and holding the clock and
  calculator buttons is protected against iOS long-press gestures.
- `?screen=` and `?lift=` URL options, for adjusting the layout on the phone.

## Install on the phone

1. Host the folder over **HTTPS**. The easiest option is GitHub Pages: repo **Settings → Pages →
   Deploy from a branch**, pick the branch and `/ (root)`. Any static host works too.
2. Open the URL (for GitHub Pages, `https://gmadrigal25.github.io/DuoCalcDM/`) in **Safari** on
   the Duo, then **Share → Add to Home Screen**, and name it **Calculator**. The Home Screen
   name stays "Calculator" so it passes as the real app.
3. Launch it once from the Home Screen while online so it caches. After that it works offline.
4. Turn **Rotation Lock** on. The real Calculator switches to scientific mode when it's turned
   sideways, but this one doesn't.

## Performing

1. **Set the force number.** Type it, then **hold the clock** (top left) for about a second. The
   display clears and the clock's minute hand moves to **9 o'clock**. Hold the **calculator icon**
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
   together count as one tap. When every digit is in, the minute hand moves to **6 o'clock**,
   and further taps do nothing. **Backspace** still deletes a digit, and the next tap re-types it.
   You can fold or unfold the phone in the middle of this.
5. **Press =**. The force number appears, with a believable sum in grey above it. The force
   number then clears itself, and the hand returns to 3 o'clock.

The clock and calculator buttons look and work the same on every screen, folded or
unfolded, so the method is identical either way.

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
- **Unfolded, upright:** 5 × 4 tall capsules.
- **Unfolded, sideways:** 5 × 4 wide capsules.

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

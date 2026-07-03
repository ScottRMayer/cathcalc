# Cath Lab Tools — Clara Maass Medical Center

Multi-page, offline-capable web app version of the cath lab calculators. The original single-file
`cathlab-calculators.html` (one folder up) is untouched and still works on its own.

## What's inside

**Dosing & anticoagulation:** Heparin dose · ACT target & re-bolus · Bivalirudin / eptifibatide / tirofiban / cangrelor (renal-adjusted) · Vasoactive drips (dose ↔ mL/h)
**Hemodynamics:** Fick CO/CI · SVR/PVR · Gorlin & Hakki valve areas · Qp:Qs shunt run · PH pattern
**Contrast & renal:** Contrast volume limit + tracker · Mehran CI-AKI score
**Risk scores:** ACC CathPCI bleeding · TIMI UA/NSTEMI · TIMI STEMI · Zwolle (early discharge after primary PCI)

The patient (age, sex, weight, height, creatinine, Hgb, dialysis) is entered once and shared by
every calculator via session storage — it clears when the browser/app closes or on **New patient**.
The contrast tracker total is shared between the Contrast page and the Mehran score.
No patient data is ever stored persistently or sent anywhere.

## How to run

- **Just open it:** double-click `index.html`. Everything works except install/offline caching
  (service workers require http/https).
- **Full PWA (recommended):** host the `app` folder anywhere static — GitHub Pages, Netlify, an
  internal IIS/nginx share — then open it once in a browser. It becomes installable
  ("Add to Home Screen" / "Install app") and works fully offline afterward.
- Quick local server for testing: `python -m http.server` inside the `app` folder → http://localhost:8000

## Clinical governance

- All formulas live in one file: `assets/core.js` (`CM.F`). Nothing else contains clinical math.
- Every formula is covered by `tests.html` (55 assertions vs independently computed values).
  Open it in a browser any time — all rows must be green. Version and "last reviewed" date are
  shown in the footer of every page (`CM.VERSION` / `CM.REVIEWED` in core.js).
- eGFR is MDRD 4-variable with the legacy race coefficient, retained deliberately to match the
  ACC CathPCI bleeding model. CrCl is Cockcroft-Gault (actual body weight).
- Decision-support only. Verify against local protocol and current package inserts. Before
  distributing beyond personal/departmental reference use, obtain pharmacy / clinical governance
  sign-off and permission for hospital branding.

## Updating

- Change a formula → update `assets/core.js`, add/adjust a test in `assets/tests.js`, bump
  `CM.VERSION` and `CM.REVIEWED`.
- Any file change → bump `VERSION` in `sw.js` so installed clients pick up the update.
- New calculator → copy any page in `calc/`, keep the formula pure in `core.js`, add a card link
  in `index.html`, add the file to the `FILES` list in `sw.js`, and add tests.

## Changelog

- **2.3.0 (2026-07-03)** — Visual redesign: realistic PQRST ECG trace in the logo, app icons,
  and a subtle animated trace behind the header (respects reduced-motion); category color-coding
  (blue dosing / red hemodynamics / amber contrast / purple risk) across home cards, group
  headers, and the bottom-nav dots; refined depth (layered shadows, hover lift, press feedback),
  background gradient, red accent bars on card titles, ruled section dividers, smooth result
  transitions, dark-mode tuning. +1/+2/+5 mL contrast buttons (2.2.1).

- **2.2.0 (2026-07-03)** — UX overhaul: persistent bottom quick-nav across all pages; two-tap
  confirm on New patient; tap the sticky summary or any missing-input error to open the patient
  panel with focus on the first empty field; patient entry timestamp with stale warning (>6 h);
  weight added to sticky summary; compact header on calculator pages; "Recently used" row on
  home; update-available toast for installed PWA users.

- **2.1.0 (2026-07-03)** — Hemodynamics suite (BSA, Fick CO/CI with thermodilution override,
  SVR/PVR in WU + dynes, TPG/DPG, ESC 2022 PH pattern, Gorlin & Hakki valve areas, shunt run
  Qp:Qs with Flamm mixed venous). Vasoactive drip calculator (9 agents, two-way dose ↔ mL/h,
  editable bag concentrations, typical-range flags, quick chart). 20 new formula tests (75 total).
- **2.0.0 (2026-07-03)** — Multi-page PWA. Ported all six original calculators unchanged
  (math verified by test suite). Added shared patient store, home screen with search,
  TIMI UA/NSTEMI, TIMI STEMI, Zwolle, formula self-test page, install/offline support.
- **1.x** — Original single-file `cathlab-calculators.html`.

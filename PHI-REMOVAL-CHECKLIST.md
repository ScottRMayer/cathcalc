# Cath Lab Tools — PHI/PII removal checklist

Goal: leave **nothing patient-identifiable** in the app so the remaining data can
sync on the free (no-BAA) Firestore tier without HIPAA exposure.

## The key trade-off (read first)
The **peri-procedure handoff** (`app/index.html`) is, by design, a PHI record: one
patient's allergies, history, diagnosis, medications, findings, complications, plus
staff names and event times. There is no way to keep it *and* be PHI-free. So this
checklist **removes the handoff data-capture** and keeps only the **de-identified
clinical panel + calculators**. If you later decide the handoff itself must travel
pre→procedure, that is PHI and needs the hospital's Google BAA route, not the free tier.

---

## 1. `app/index.html` — remove the handoff form (the bulk of the PHI)
Remove all of the following. They are patient health information (identifiable in
combination) and/or free text that can hold names/dates a nurse types in.

**Names / identifiers (HIPAA direct identifiers):**
- `operator` (attending name), `reportTo`, `reportBy`

**Dates/times tied to the encounter (Safe Harbor date elements):**
- `procDate` (auto-stamps current time on load — a date element), `asaTime`,
  `p2y12Time`, `tbandApplied`, `tbandRemove`, `deployTime`, `flatUntil`,
  `manualPullTime`, `manualFlatUntil`, and the per-med time fields `omT*`
- the "Now" buttons and all the auto-hold-time logic (`stampNow`, `addNowButtons`,
  `autoPair`, `autoHolds`, `wireAutoHolds`, `parseT`, `fmtT`, `checkTime`, `TIME_FIELDS`)

**Free-text clinical narrative (PHI):**
- Allergies & safety: `allergies`, `precautions`, `allstat`
- Procedure & indication: `procedure`, `indication`
- Background/history: `history`, `homemeds`, and the flags `dm`, `ckd`, `cabg`, `antic`
- Pre-meds: `asa`, `p2y12`, `p2y12Dose`, `methylpred`, `diphenhydramine`,
  `famotidine`, and the repeatable "Other meds" list (`omList`, `omAdd`, `omRows`,
  `buildOM`, `wireOM`, `HO.otherMeds`)
- Access: `planaccess`, `planNote`, `artsite`, `vensite`, `casetype`
- Sheath/closure: `sheathstatus`, `hemostasis`, `tbandtype`, `bandAir`
- Intra meds: `midazolam`, `fentanyl`, `heparin`, `act`, `eptifibatide`, `antiplt`,
  `antiemetic`, `ivfIntra`, `otherIntra`
- Findings: `findings`, `devices`, `complications`
- Post: `pulse`, `siteCond`, `drips`, `postFluids`, `postlabs`, `dapt`
- Disposition: `dispo`, `outstanding`

**The report/handoff generators (they concatenate all of the above):**
- `buildReport()` (the SBAR text), the `copy: buildReport` wiring in `CM.init`,
  and the Print handoff behavior (`beforeprint`/`afterprint` expanding phases)
- The extended labs block that is *handoff-only* free text: `troponin` (free text).
  Numeric labs (`hct`, `plt`, `inr`, `ptt`, `potassium`, `sodium`, `glucose`, `a1c`)
  are de-identified values — keep them **only if** you still want them as calculator
  inputs; otherwise drop to keep the page lean.

**Persistence:** delete the handoff store entirely — `HK = CM.storeKey('handoff')`,
`loadHO`, `saveHO`, and the `HO` object. Nothing from the handoff should touch
localStorage anymore.

**What `index.html` becomes:** the home screen = the shared **de-identified clinical
panel** (from `core.js`) + the **tool library / calculator launcher** (`buildLib`,
`toolLib`) + the shared labs that feed calculators (`hgbShared`, `scrShared`, `aGfr`,
`contrastVol`). Keep `bindShared`/`syncShared` for those. That's it.

---

## 2. `app/assets/core.js` — remove the one identifier field
- Remove the **`pid` "Patient ID / room (initials)"** input from `panelHTML()`.
- Remove `pid` from `readPanel()`, `fillPanel()`, and the `BLANK` state object.
- `panelStatus()`: remove the `if(P.pid) bits.push(...)` line.
- `printmeta` (in `CM.init`): drop the `Patient: <pid>` prefix. The
  "Generated <date/time>" is the printout's own timestamp (not a patient date) —
  you may keep it, but dropping it is cleaner.
- **Optional Safe-Harbor nicety:** ages ≥ 90 should be shown/stored as "90+" rather
  than an exact age (only matters if you ever export/sync age).

---

## 3. Storage keys — after the edits
- **Remove:** `cm:{slot}:handoff` (PHI) — no longer written once §1 is done.
- **Keep (de-identified, safe to sync):** `cm:{slot}:patient` (age, sex, race coeff,
  dialysis, kg, cm, scr, hgb — **no `pid`**), `cm:{slot}:contrast`.
- **Keep (non-PHI app prefs):** `cmSlot`, `cmRecent`, `cmUnitsBody`, `cmSyncCode`.

---

## 4. `app/assets/sync.js` — already clean
The sync module already whitelists only the de-identified `patient` fields and the
contrast total, and never syncs `pid` or any handoff free text. Once §1–§2 are done,
**everything the app holds is de-identified**, so free-tier Firestore is appropriate.
No change needed beyond confirming the whitelist matches the trimmed `patient` object.

---

## 5. Repo tidy-up (not deployed, but public)
- `cathlab-calculators.html` and `cathpci-bleed-risk.html` at the repo root are older
  standalone copies (GitHub Pages serves the `app/` folder, so they aren't live).
  They store no patient data, but delete them to avoid confusion and keep the public
  repo free of stray handoff markup.

---

## 6. Verification (do all of these before calling it done)
- Enter data on every page, then run `localStorage` in DevTools: confirm only
  `cm:*:patient`, `cm:*:contrast`, and the `cm*` prefs exist — **no `handoff` key,
  no `pid`**.
- Grep the codebase for: `pid`, `handoff`, `operator`, `reportBy`, `buildReport`,
  `procDate` — expect no remaining hits outside comments.
- Confirm no `type="text"`/`<textarea>` free-text fields remain anywhere in `app/`.
- Bump `CM.VERSION` **and** `sw.js` VERSION together (project rule), refresh the
  `sw.js` FILES list if any file was removed.
- Load the app, confirm calculators still compute and the shared panel/labs still
  flow into them.

---

### Bottom line
Removing the initials field alone was never enough — the handoff narrative was the
real PHI. After §1–§3 the app holds only de-identified clinical numbers, which is
what makes free-tier sync defensible. Have Clara Maass privacy/compliance confirm
before enabling any sync; this checklist is engineering guidance, not a compliance
sign-off.

# Tactile Paper / Public + Lilex design QA

## Comparison target

- Paper source visual truth: `C:\Users\Aryan Wadhawan\.codex\generated_images\019fe4d7-ef9b-7f63-a048-349b41118949\exec-67d162d5-ac00-4b8d-b035-3e539427d84b.png`
- User formula-font callout: `C:\Users\ARYANW~1\AppData\Local\Temp\codex-clipboard-f6ed5daf-cf29-43c6-b080-2977905eee7d.png`
- User active-cell callout: `C:\Users\ARYANW~1\AppData\Local\Temp\codex-clipboard-71b43938-50de-4fb0-9912-6f136712ea84.png`
- Final root-sheet implementation: `../../audits/2026-08-12-paper-public-lilex-qa/qa-implementation-paper-public-lilex-final.png`
- Final 90% In & Out hold: `../../audits/2026-08-12-paper-public-lilex-qa/qa-in-out-public-lilex.png`
- Final 30-direction Type Lab: `../../audits/2026-08-12-paper-public-lilex-qa/qa-type-lab-public-lilex.png`
- Full-view comparison: `../../audits/2026-08-12-paper-public-lilex-qa/qa-comparison-paper-public-lilex.png`
- Formula-font comparison: `../../audits/2026-08-12-paper-public-lilex-qa/qa-comparison-formula-mono.png`
- Active-cell comparison: `../../audits/2026-08-12-paper-public-lilex-qa/qa-comparison-active-cell.png`
- Source pixels: 1440 × 1024.
- Browser implementation pixels: 1125 × 1066.
- CSS viewport: 1125 × 1066; device pixel ratio 1.75. The browser screenshot API returned CSS-sized pixels, so no additional density conversion was applied.
- Full comparison normalization: both images were aspect-fit into equal 1125 × 800 panels in one 2250 × 830 comparison image. Proportional differences caused by the explicit 90%-window requirement were treated as intentional.
- State: Paper, Public Service direction selected, root A14 selected for entry; separate transition evidence shows Operating model held at the 90% stage with child B4 selected and the A14 source echo visible.

## Findings

- No actionable P0, P1, or P2 issues remain in the checked desktop state.
- [P3] The Type Lab is a prototype-only comparison surface and does not yet implement a full modal focus trap. Escape closes it and all choices are semantic buttons, but a production inspector should cycle focus inside the dialog.

## Full-view comparison evidence

The full composite puts the selected Paper source and the final browser-rendered 90% hold together. The implementation retains the source's ivory paper, carbon ink, disciplined ruled sheet, restrained rust focus, dimmed parent context, and exact source-cell memory. Its child window is intentionally much larger because the user explicitly chose a roughly 90%-of-viewport hold.

The implementation's compact Public Sans title and non-italic description intentionally replace the source's large grotesk title and editorial italic subtitle. The 30px worksheet rows and 1px seams also intentionally supersede the source's more spacious cells. These are direct user revisions, not fidelity drift.

## Focused region comparison evidence

- Formula typography: the formula comparison places the user's current-field callout beside the implementation. The former typewriter-like mono has been replaced by locally bundled Lilex at a compact optical weight; its rounded-square construction is clearer at small spreadsheet sizes and matches the current Zed engineering tone.
- Active cell: the cell comparison places the user's thick double-ring callout beside the implementation. The final cursor uses one rust outline, a small conventional fill handle, and subtle row/column continuity rather than a second outer ring.
- No raster imagery is part of the product UI. All functional icons come from one installed Tabler family; no custom SVG, emoji, placeholder image, or CSS-drawn icon substitutes are present.

## Required fidelity surfaces

- Fonts and typography: Public Sans is the selected UI/display lead, reflecting the user's preference for the Public Service specimen. Lilex is used for formulas, addresses, keycaps, and source addresses. Titles are 25–32px, descriptions 12px and non-italic, cells 9.5px, and formula text 10.5px. The hierarchy is compact, legible, and free of the previous oversized display/subtitle treatment.
- Spacing and layout rhythm: the object header is approximately 112px high, worksheet cells are 30px with 1px seams, controls share one centered content width, and the sheet remains internally scrollable. The 90% floating stage exposes an even parent margin before full expansion.
- Colors and visual tokens: warm Paper tokens remain consistent—ivory surfaces, pale stone tray, carbon text, graphite rules, and one restrained rust focus color. Selection no longer accumulates multiple accent rings.
- Image quality and asset fidelity: there are no product image assets to reproduce. The evidence images are QA captures only.
- Copy and content: title, descriptions, model values, formulas, cell addresses, local-save labels, and In & Out language are coherent and realistic. A1 addressing remains familiar and primary.
- Icons: embedded sheets/documents and local-state controls use consistent thin monochrome Tabler icons. Icon size and stroke remain subordinate to text.
- States and interactions: tested direct selection, arrow-key movement, `]` entry, `[` parent return, the 90% opening hold, full-screen settle, reverse source return, Public Service selection, all 30 Type Lab choices, and dialog close.
- Accessibility: worksheet cells expose address/value labels, selected state is semantic, inputs have labels, keyboard focus is visible, Escape closes the comparison dialog, and reduced-motion CSS is present. The prototype-only focus-trap gap is recorded as P3.

## Comparison history

### Pass 1 — blocked

- [P2] The Paper sheet still read as a card grid rather than a fast worksheet.
  - Evidence: the prior 38–42px rows filled the viewport and amplified the rounded-cell anatomy.
  - Fix: reduced the default to 30px rows, 1px seams, 5px radii, 8px horizontal padding, and narrower default columns.
- [P2] The intro skipped through the semi-expanded origin state too quickly.
  - Evidence: the previous schedule changed from floating to full after 280ms.
  - Fix: the floating phase now starts after 32ms and holds until 820ms; its final expansion uses the same 620ms deliberate transition as the outro.
- [P2] Typography and selection contradicted the latest callouts.
  - Evidence: the prior UI used an unresolved default face, the formula field looked typewriter-like, and selection stacked a border and ring.
  - Fix: selected Public Sans, installed local Lilex for monospace text, removed the stacked ring, and added one cursor outline plus a fill handle.

### Pass 2 — passed

- Post-fix evidence: `../../audits/2026-08-12-paper-public-lilex-qa/qa-comparison-paper-public-lilex.png`, `../../audits/2026-08-12-paper-public-lilex-qa/qa-comparison-formula-mono.png`, and `../../audits/2026-08-12-paper-public-lilex-qa/qa-comparison-active-cell.png`.
- The explicit density, motion, typography, and active-cell findings are visibly resolved. No actionable P0/P1/P2 differences remain after the user's intentional departures from the generated Paper source are accounted for.

## Browser and packaging verification

- Live URL: `http://127.0.0.1:8796/`.
- Browser runtime reloaded after the final change; warnings/errors since reload: none.
- Production build: passed.
- Sites worker/package tests: 4 passed, 0 failed.
- Required output files confirmed by the build/test workflow: `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Implementation checklist

- [x] Keep only the Paper material scheme.
- [x] Make the object header and worksheet materially more compact.
- [x] Provide 30 live, locally bundled typography directions.
- [x] Select Public Service as the current lead.
- [x] Use Zed's current bundled mono direction, Lilex, for formulas and coordinates.
- [x] Rename and retime the motion as In & Out.
- [x] Use `]` for in and `[` for out.
- [x] Hold the 90% stage long enough to register source and parent.
- [x] Replace the active-cell double ring with one precise cursor and fill handle.
- [x] Build, test, compare, and leave the local preview ready for inspection.

final result: passed

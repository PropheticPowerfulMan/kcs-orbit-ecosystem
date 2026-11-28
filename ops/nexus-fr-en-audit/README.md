# Nexus FR/EN audit — 28 November 2026

Changing the interface language previously left French-only and English-only labels, browser-language dates and untranslated workflow feedback. Some native options also derived their saved value from a translated label. This patch localizes display copy while keeping academic values, identities and authored content unchanged.

## Runtime scope

Nexus Web only. No backend, database, migration, role, grading formula, period policy, official report-card/transcript template or other application is changed. The source worktree is under `/opt/kcs-orbit/staging`.

- Aligned English/French i18next keys; audited legacy interface phrases and known operation messages.
- Pinned 108 previously implicit option values. All 609 native options now have explicit machine values.
- Source-aware DOM translation uses WeakMaps so repeated language changes restore the original string instead of guessing an ambiguous reverse translation. Display attributes and SVG labels participate; input values, URLs, editable content and protected authored content do not.
- Protected entity/course names, messages, forum content and report comments. Official academic PDFs remain English.
- Selected-language dates and month names preserve ISO dates and numeric month values.
- Existing mounted routes rerender on language changes without language keys/remounts, preserving drafts and selections.

## Verification

`npm run check:i18n` and the frontend production build validate catalog parity, referenced keys, English source stability and explicit untranslated option values.

The isolated browser fixture uses synthetic accounts and the `learning-qa` gateway, not production. `round-trip.cjs` covers SuperAdmin, Teacher, Parent, Student, staff, Principal, ST, Discipline Director, early years and a Media presentation fixture. It switches EN/FR/EN/FR/EN and compares form values, selections, disabled states and navigation destinations. Only the external destination language parameter is normalized. Media auth/profile presentation is mocked; the other profile APIs use the isolated fixture.

`registry-dialogs.cjs` tests parent/student drafts at 390 px and 1440 px in light/dark themes, including family relationship machine values and zero entity mutation requests. `dom.cjs` tests original-source tracking, attributes, native options, input/textarea values, authored/editable content, SVG and exact bilingual server aliases. Additional browser evidence covers 20 public-page/viewport combinations, four notification theme/viewport combinations and an unsaved course name.

Run browser scripts in the existing isolated QA runner with `/qa/fixtures.private.json` and a writable `/evidence` directory. Set `PLAYWRIGHT_MODULE` if Playwright is supplied by a dedicated runtime. Prepare the DOM bundle with `node ops/nexus-fr-en-audit/tests/prepare-dom.cjs /evidence/dom-test-bundle.js` after installing frontend build dependencies. No fixture credentials or generated private evidence are committed.

## Deliberate translation boundaries

Language autonyms, product/program names, technical identifiers, entered names/course titles/articles/messages, international standard titles and historical school-calendar content are retained. Official English academic documents and stored enum/period/date values are preserved. Unknown server text is passed through rather than rewritten by an unsafe generic slash splitter. Only explicitly identified bilingual system messages are reduced to the selected interface language.

## Release boundary

Production is not modified by the audit. The reviewable change is pushed to its dedicated branch. A later approved release must back up production, deploy only `nexus_web`, verify its HTTPS/health/version, and retain every other service identity.

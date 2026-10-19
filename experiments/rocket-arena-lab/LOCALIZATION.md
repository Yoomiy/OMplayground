# Hebrew presentation

The standalone client defaults to Hebrew. Append `?lang=en` (or `&lang=en` when
combining other comparison flags) for English. Language is selected once when the
page loads and does not modify game rules or network protocol identifiers.

`client/src/ui/i18n.ts` owns the dictionary, interpolation and the bounded HUD
presentation vocabulary. Lobby, match HUD, countdowns/goal and victory notices,
control reference, local match menu/settings, audio controls and test panel use
ordinary browser HTML text. The English branded logo remains an image; accessible
logo text and the page title are localized. Unexpected technical exceptions may
retain their original diagnostic message rather than hiding useful information.

Browser shaping/bidirectional layout renders Hebrew directly. UI uses system-ui,
Segoe UI, Arial, Noto Sans Hebrew and DejaVu Sans fallbacks without font downloads
or WebGL text meshes. Text panels use RTL; the arena, camera/steering, scoreboard
team positions, clock, numeric ratios, sound slider and physical key order keep
their existing directions. Room codes use `dir=ltr`; mixed-direction player names
are inserted using `textContent` into `<bdi dir=auto>`. Only reserved `Lab Bot 1`
through `Lab Bot 7` display labels translate; human names and server identities
remain unchanged. Latin key groups and build/profile identifiers are isolated
when embedded in Hebrew sentences.

The pure HUD model retains its English presentation vocabulary and authoritative
event-consumption behavior. Localization occurs at its DOM boundary, preserving
existing event identity, countdown, scoring and announcement tests. Translation
patterns are allocated once, and text nodes still update only when their displayed
value changes. Names projected over cars use the same browser text support, with
cached DOM labels; no per-frame text texture or geometry regeneration is needed.

Validation: seven focused localization tests cover query resolution, interpolation,
every HUD phase/event, real control hints, bot versus mixed Hebrew/Latin names,
and every settings row with physical key order. A local Chromium smoke test checked
Hebrew/English screens, invalid room-code errors, a real custom-room join with a
mixed Hebrew/Latin name, room-code direction, settings RTL, sound slider LTR and
scoreboard/keycap order; no page errors. Screenshots in ignored `.run/hebrew-*.png`
were visually inspected for actual Hebrew glyphs. This is browser verification,
not a performance benchmark or physical-device usability approval.

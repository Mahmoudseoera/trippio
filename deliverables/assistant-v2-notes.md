# Egypt planner update

- Active entry: ../ai-assistance.html.
- Artwork: ../assets/images/assistant/egypt-illustrated-v2.png.
- Confirmation: ../assistant-confirmation.html.
- Preserved version in ../AI Assistance/ is unchanged.

## Artwork

Edited with the built-in image generation tool, not an SVG replacement. The output
was visually inspected: the eastern Saudi shore is desert/mountains; the monastery
is inland in Sinai; coastal resorts appear on the Sinai side. This is artistic
imagery, not a surveyed or georeferenced map. It is displayed in a tablet and as a
decorative background. The generated file is 1678 by 938 pixels; it is a detail
reworking, not a higher-pixel-count upscale of the original 2752 by 1536 image.

Prompt used:

> Edit this supplied Egypt tourism panorama, preserve its warm sand/turquoise miniature 3D illustration style and wide composition. Enhance clarity, clean architectural details and terrain, highest practical resolution. Correct Sinai visual geography: Saint Catherine monastery among rugged mountains in the interior of SOUTHERN Sinai (not the peninsula's geographic midpoint), with Sharm El Sheikh beachfront hotels, luxury resorts and swimming pools at Sinai's southern coastal tip between Gulf of Suez and Gulf of Aqaba. The Saudi Arabian land EAST of Gulf of Aqaba/Red Sea must be ONLY empty desert and mountains: remove every hotel, resort, temple, pool, greenery, settlement there. Keep Egyptian Nile monuments and Egyptian Red Sea resorts on Egyptian shores. Preserve Egyptian landmarks and artistic look, no text, no labels, no watermarks. This is decorative travel artwork, not a surveyed geographic basemap.

## Geographic map

The expanded map uses Leaflet's standard geographic projection and OpenStreetMap
tiles. Markers consume data-lat/data-lon, not the old guessed illustration pixels.
Route lines connect published stop coordinates; they are not road directions.
Existing catalogue coordinates are retained. New reference points:

- Sharm El Sheikh: 27.91582, 34.32995 — https://www.geonames.org/349340/sharm-el-sheikh.html
- Saint Catherine Area: 28.55623, 33.97543 — https://whc.unesco.org/en/list/954

These destinations have zero published matching catalogue tours, correctly shown
as zero rather than inventing products. They remain selectable for weather and
tailor-made enquiries.

## Quiz and voice

Six steps remain. The active upload markup, handlers and styles have been removed.
The archive/reference intentionally retain their historical behavior.
Name, country calling code and number are required in step one. Phone controls
strip non-digits and enforce a maximum combined length of 15 digits.
Narration only selects a recognised installed male English voice. It does not
silently fall back to a female voice. If unavailable, a status message explains
the requirement and the text remains readable. Speed is 0.78 and volume is 0.8.

## Preview booking

Per the user's follow-up, no booking request is sent. A review dialog collects the
quiz draft and selected tour, validates the contact fields and review checkbox,
then places a preview draft in sessionStorage and redirects to the confirmation/
thank-you page. No PII is put in the URL and no booking fetch is made.
The confirmation explicitly states no booking or administrator submission occurred.
Drafts are rejected after two hours and may be cleared with the visible button.

When a backend is available, replace the preview submit branch with the real
same-origin route, server validation, CSRF protection and persisted receipt.
Redirect only after that endpoint acknowledges success.

## Checks

- node --check assets/js/ai-assistance.js
- node --check assets/js/assistant-confirmation.js
- python deliverables/verify-assistant-redesign.py
- node deliverables/verify-assistant-browser.cjs

The browser harness exercises desktop/mobile quiz, phone sanitization, geographic
routes and local confirmation. It blocks weather requests deliberately, so it
does not establish live-weather service behavior or audible voice quality.

Desktop (1440 by 1000) and mobile (390 by 844) browser checks passed with zero
JavaScript errors, including normal desktop animation and reduced-motion mobile.
Screenshots are saved as assistant-tablet-1440.png, assistant-tablet-390.png,
assistant-map-1440.png and assistant-map-390.png in this folder.
The image overlay is calibrated to the paused 1280 by 720 guide-intro frame.
If that video is replaced, update positionTablet's screen rectangle.

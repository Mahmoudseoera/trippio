# Travel search: Find Tours, Build My Trip, Search by Image

Mounted on `index.html` (section `#travel-search`, right after the hero). **Front-end only for now.** No API key, no backend, no new dependency. The backend contract below is how to switch AI on later without touching the UI or the matching rules.

## What works today (no backend)

| Mode | Today | With the backend |
|---|---|---|
| Find Tours | Arabic/English rule-based understanding, deterministic ranking over the real catalog | AI understands looser wording; ranking is still the same code |
| Build My Trip | Builds a day plan from real tours; open days are shown as non-bookable suggestions | AI proposes the day layout; every id is re-checked against the catalog |
| Search by Image | Upload, validate and preview work. It **does not guess** the place: the visitor picks what the photo shows | Vision model returns candidates; visitor confirms one; the catalog does the matching |

## Where the tours come from

There is no tour database. `catalog.js` **reads the site's own markup** at runtime: tours, itinerary stops and destinations from `ai-assistance.html`, and price/rating/duration/image from the listing cards in `subcategory.html`. Nothing is copied into a second dataset, and a field a page does not publish stays `null` (e.g. *Diving in Hurghada* has no price or duration, so the UI says "Price on request" and "Duration not published"). If two pages disagree on a price or duration, the tour is flagged and no value is shown.

Adding a tour to `ai-assistance.html` (`.tour-option[data-tour]`, `data-stops`, `data-cities`) makes it searchable. Limit: the page must be served over HTTP (not opened as a `file://`).

## Files

```
assets/js/travel-search/
  lexicon.js   Arabic/English normalisation and vocabulary (language only, no tour facts)
  catalog.js   reads the real tour records; the only shape that leaves is catalog.toPublic()
  intent.js    one intent shape; local extractor; validateIntent() = trust boundary for AI output
  matcher.js   deterministic scoring: exact place > destination > interest > keyword; verified reasons only
  planner.js   assemble() rebuilds every plan from the catalog and rejects anything unverifiable
  provider.js  local provider, remote provider, fallback, cache, image validation (the AI seam)
  ui.js        three-mode interface, request lifecycle, rendering
assets/css/travel-search.css   uses global.css tokens
tests/travel-search.test.cjs   19 logic/integration tests on the real catalog
index.html                     +16 lines: stylesheet, scripts, mount section
```

## Rules the code enforces

- Destination named by the visitor is a hard filter. If no tour covers it, the page says so; "similar tours elsewhere" is an explicit button, and nearby tours (≤150 km, from the site's own coordinates) appear only when nothing matches.
- Every "why this tour" line cites a field that exists on the record. Unsupported wishes (quiet, family-friendly, child pricing) become visible notes, never claims.
- A budget excludes a tour only on a verified, same-currency from-price. A missing price is flagged, never assumed. Totals are summed only from real prices; otherwise "No total yet". Nothing is labelled "within budget" unless every needed price is known.
- Plans never state availability; each product says it is confirmed by the travel team. Suggestions without a tour are labelled *Suggestion, not bookable*.
- Cards and links use catalog data only: local `.html` URLs and `assets/images/` paths. Uploaded photos are previewed in the browser and never replace a tour image.
- Enquire buttons reuse the existing `trippio-assistant-booking` session draft and the existing per-tour enquiry forms (which are still preview-only, as before).

## Turning on AI (backend contract)

Set before the scripts load:

```html
<script>window.TRIPPIO_TRAVEL_CONFIG = { apiBase: '/api', timeoutMs: 15000 };</script>
```

The UI then calls three same-origin endpoints and **falls back to the local engine** on timeout, 429, 5xx, network error or malformed JSON (a notice is shown). The Gemini key exists only on the server (`GEMINI_API_KEY`, never in HTML/JS, `.env.example` holds a placeholder). Nothing in this repo contains a key.

| Endpoint | Request | Response (all validated client-side, then again by the matcher) |
|---|---|---|
| `POST /api/travel-search` | `{ "query": "…≤500 chars" }` | `{ "intent": { destinations[], attractions[], activities[], preferences[], duration:{value,unit}, budget:{amount,currency,level}, travellers:{adults,children[],childrenCount}, keywords[] } }` |
| `POST /api/travel-planner` | `{ "intent": {…}, "candidates": [{ id, title, durationDays }] }` | `{ "skeleton": { "days": [{ "day": 1, "tourIds": ["…"], "proposed": [{ "title", "why" }] }], "assumptions": [] } }` |
| `POST /api/travel-image-search` | `multipart/form-data`: `image`, optional `query` | `{ "candidates": [{ "label", "type": "landmark\|city\|experience", "confidence": 0..1 }] }` |

Intent keys use the site's vocabulary (see `lexicon.js`: `cairo`, `luxor`, `karnak`, `valley-kings`, `historical`, `diving`, …); unknown values are dropped. The client sends only ids and titles of already-retrieved candidates, never the whole catalog, and ignores any title, URL, image or price the model returns.

Server requirements (the browser checks are only a convenience):
1. Validate the image by **file signature**, JPEG/PNG/WebP only, ≤5 MB; reject otherwise. Do not store it or log its bytes.
2. Use Gemini structured output (JSON schema) for all three calls; set a timeout; return 429 on rate limiting and 402/403 on quota; add per-IP rate limiting and a request-size cap.
3. Re-validate `tourIds` against the real catalog before returning; the client does too.
4. Gemini consumer subscriptions do not include API usage. Create an API key in Google AI Studio / Cloud, check current model names, free-tier limits and billing yourself; none of that was available to verify here.

## Run the tests

```
npm install --prefix .qa --no-save --no-package-lock linkedom
NODE_PATH=.qa/node_modules node --test tests/travel-search.test.cjs
python3 -m http.server 8765   # then open http://localhost:8765/index.html
```

## Verified here vs not

Verified: 19 logic tests pass on the real catalog; in headless Chromium all three modes, upload validation, cancel, offline-catalog error + retry, keyboard tabs/Enter, mobile (390 px, no horizontal scroll) and a **mocked** AI backend returning hostile output (fake ids, script tags, bad currency, 999 days) and failing (500/429/garbage), with no page errors.
Not verified: any real Gemini call (no key, no backend); real landmark recognition; Arabic right-to-left visual polish beyond `dir="auto"` on input and `<bdi>` on results (page chrome is English, like the rest of the site); screen-reader output (ARIA roles/live regions are in place but untested with a reader); browsers other than Chromium; the `flatpickr is not defined` error on `tailor-made.html` in the sandbox is pre-existing (CDN blocked here).

## Known limitations

- Five tours only, so many searches honestly return "no match".
- Local understanding is vocabulary-based; phrasing outside `lexicon.js` is ignored (it is shown under "What we understood" so gaps are visible).
- Enquiry forms are still preview-only; real booking needs the backend described in `TRIP-INTENT.md`.
- Multi-city plans note that transfers are not published; none are invented.

# AI Smart Assistant

Open `ai-assistance.html` through your local web server. The page now follows the attached Claude reference: conversational quiz → guide introduction → full-screen satellite map with floating city, attraction, avatar, weather and tour panels.

## Content and quiz

Seven questions gather a name, optional local inspiration photo, adults/children/infants, exact travel dates, interests, cities and optional enquiry details. Previous-answer navigation and an edit flow keep existing answers. Start again resets the quiz.

City content, coordinates, attraction descriptions and tour facts are authored in HTML. JavaScript reads that markup; it contains no hardcoded destination/coordinate/temperature catalog.

Photo recognition still requires a backend integration. The page accepts and previews a local image without guessing its location or transmitting it.

## Satellite map

Leaflet 1.9.4 displays Esri World Imagery with geographic place labels and visible attribution. Panning, zoom controls, city selection and landmark-level zoom are supported. Coordinates are stored on HTML elements as `data-lat` and `data-lon`.

The map covers the 13 named stops in the existing eight-day tour: Giza Pyramids, Great Sphinx, Grand Egyptian Museum, Egyptian Museum in Tahrir, Khan el-Khalili, Philae, Kom Ombo, Edfu, Valley of the Kings, Hatshepsut Temple, Karnak, Luxor Temple and Hurghada coast. City buttons cover Cairo/Giza, Aswan, Edfu/Kom Ombo, Luxor and Hurghada. All attractions opens the full route even when the quiz selects fewer cities.

Satellite images are tiled basemap imagery, not a live satellite feed. The map library, imagery, labels and weather require internet access. Failure messages appear if map/weather requests fail.

## Dynamic weather and atmosphere

`assistant-weather.js` calls Open-Meteo using each selected city's HTML coordinates:

- Today: current conditions plus today's forecast high/low and rain total.
- Arrival within the next 15 days: daily arrival-date forecast, including high/low, rain and wind.
- Arrival beyond the 16-day forecast horizon: current conditions drive the atmosphere. A separate request calculates historical average daily highs/lows for the selected month in the previous complete calendar year. It is explicitly labelled as a historical monthly reference, not a forecast or long-term climate normal.

Weather codes control animated rain, sunlight/rays, cloud haze and night lighting. Panel colours also change. Reduced-motion preferences suppress animation, and an effects toggle can hide the atmosphere. Preview buttons alter only the visual effect and are labelled as previews; they never replace actual temperature data.

City switches abort older requests and reject stale responses. Results cache for ten minutes; a refresh button and five-minute active-map refresh are provided. No placeholder temperatures appear after a request failure.

Sources: [Open-Meteo forecast documentation](https://open-meteo.com/en/docs), [historical weather documentation](https://open-meteo.com/en/docs/historical-weather-api), [Leaflet reference](https://leafletjs.com/reference.html).

## Avatar and booking

Selecting a city or attraction starts English browser narration with its full story displayed beneath the supplied avatar video. The video is illustrative, not lip-synced. The quiz transitions through the supplied guide-with-tablet video before opening the satellite view.

The existing eight-day tour is offered with its published duration and price. Windows shorter than eight days cannot continue to its enquiry; the tailor-made link remains available. Availability is not confirmed by this static page.

Selected dates, guest counts, optional name/email and preference message pass via sessionStorage to `tour-details.html#quote`. `assistant-booking.js` runs after the existing tour controller and updates Flatpickr when present. The draft expires after two hours and is removed after prefill. Contact details are not placed in the URL. The existing tour quote form remains a preview form.

## Verification

- All three assistant scripts pass `node --check`; `git diff --check` passes.
- Static validation confirms unique IDs, local media paths, geographic ranges and 13 attraction/city associations.
- `python deliverables/verify-assistant-services.py` checks the real forecast, historical, satellite, label and Leaflet endpoints. All five returned successful responses during verification.
- DOM integration checks cover the seven-question sequence, invalid dates, intro, city filtering, landmark zoom, tour handoff, editing, weather classification, forecast horizon, stale responses, preview effects, offline failure and historical reference fetching. To rerun: `npm install --prefix .assistant-qa --no-save --no-package-lock linkedom`, then `node deliverables/verify-assistant-dom.cjs`. The helper dependency was removed after verification.
- No browser was connected for visual rendering QA; DOM tests do not verify pixel layout or actual voice/video playback.

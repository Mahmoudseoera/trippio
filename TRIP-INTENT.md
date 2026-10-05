# Trip Intent implementation

## Inspection and scope
This checkout is a static website, with no package manifest, backend, tour models, itinerary database, lead model, authentication, admin dashboard, notification service or submission API found.
Existing comparison owns a maximum-three ID array in `trippio-tour-comparison:v1`, extracts visible card metadata (title, image, URL, city, duration, listed price, rating, description), and supports matrix differences, removal and scrolling. IDs are title slugs, not backend inventory IDs.
Displayed prices are text from cards, not verified price records. Some cards request a quote. Existing tour URLs point to the same sample details page.

## Implemented architecture
Comparison / weighted recommendation / customization -> shared draft -> experience selection -> travel details and summary -> contact -> configured transport -> thank-you.html after confirmed submission.
The comparison implementation remains in place. A small TrippioComparison bridge exposes tours, selected tours and comparison navigation. The new controller uses this bridge; it does not duplicate card markup or selection state.

A single versioned draft stores journey_type, source tour snapshots, preference weights, recommendation, alternatives, selected and removed experiences with item and source IDs/titles, customizations, travel details, notes, estimated_price and a request_key.
Drafts save to `trippio-trip-intent:v1`. Contact information stays in memory. Selections survive refresh; original tours are never mutated. Starting another path adds to the current draft intentionally.
The customizations array is reserved; current customization is represented by experiences and notes.

## Recommendation and pricing
Facts are curated from the four existing card titles/descriptions. The diving description was corrected because it previously described sailing.
Supported priorities: culture, adventure, relaxation. No claims about luxury, family suitability, comfort, flexibility or group size are invented.
Score = 100 × sum of selected weights for documented categories / sum of all selected weights, rounded. Equal scores use tour ID ordering. Zero total weight requires a user choice before displaying recommendations.
This is priority coverage, not a statistical prediction or quality score. Results name the actual experiences supporting each category.
Individual experiences have no authoritative prices, so the combined estimate is null and the UI says Price to be confirmed. Original listed per-person amounts appear only as estimates on source tours. The server must calculate any eventual estimate.

## Delivery integration required
Define window.TrippioTripTransport before trip-intent.js:
```js
window.TrippioTripTransport = {
  async submit(request) {
    // Send to your actual same-origin API with CSRF protection as appropriate.
    // Persist atomically, validate catalog references, recalculate pricing,
    // and enqueue sales delivery before acknowledging.
    // Return only after durable success:
    return { id: 'server-generated-request-reference', status: 'submitted' };
  }
};
```
This is an interface contract, NOT a working delivery implementation. No fake success handler is supplied.
The request includes customer name/email/country_code/phone/consent plus the full draft. Treat request_key as the idempotency key; do not trust any frontend status or snapshot.
The current static build explicitly disables Send my trip request. Download exports a JSON draft, explicitly marked as not sent. Only confirmed transport submission redirects to the existing thank-you.html.
On failure, the form stays open and selections remain. A busy guard prevents repeated in-flight submits, but backend idempotency is still mandatory.

## Minimum backend design (proposed, not created)
Reuse the actual application's lead entity if one exists. Otherwise a single trip_requests table is sufficient initially:
- internal primary key; request_key unique; status
- catalog reference IDs plus compact JSON snapshots of selected sources/items
- preferences, recommendation/alternatives, travel details, notes
- private customer data, consent timestamp, server-calculated estimate/currency
- created/submitted timestamps
A separate nullable public token hash, expiration and redacted public snapshot can support proposals without six new tables. Publish/view events must not change a submitted lead back to draft.

Suggested endpoints (NOT implemented):
- POST /api/trip-requests: validate, rate-limit, deduplicate, save and notify sales.
- POST /api/trip-requests/:id/proposal: authorized publication with secure random token.
- GET /my-trip/:token: render a redacted proposal; invalid token 404, expired token 410.
- Authorized admin request list/detail and lifecycle transitions in the existing admin system.

Use cryptographically random public tokens, store their hashes, enforce expiration and exclude contact data/private notes from public snapshots. Tokens must be generated and checked on the server. Do not put customer JSON in a share URL. Add copy link, WhatsApp and email sharing only after the server returns a real published URL.

## Security and sales
Client text is escaped when rendered. Draft restoration filters unknown source and experience IDs, bounds weights/counts and handles malformed JSON/storage denial.
Backend must revalidate IDs, consent, travel ranges, content lengths and contact data; reject forged prices and status; enforce CSRF where cookie auth applies, rate limits, duplicate protection and admin authorization.
A sales view/email should render the same summary, grouped by source tour, followed by customer contact and lifecycle controls. No email template or delivery system exists in this checkout.
Implemented analytics use the trippio:analytics CustomEvent for recommendation start/completion, builder start, experience addition/removal, request start and acknowledged submission. No analytics vendor or sales lifecycle events are fabricated.

## Files
Modified: index.html, subcategory.html, tour-details.html, assets/js/tour-comparison.js.
Created: assets/js/trip-intent.js, assets/css/trip-intent.css, tests/trip-intent.test.cjs, TRIP-INTENT.md.
Database migrations/tables created: none. New live HTTP endpoints: none.

## Verification and remaining work
Run: node --check assets/js/tour-comparison.js; node --check assets/js/trip-intent.js; node tests/trip-intent.test.cjs.
Logic tests exercise actual ranking/selection/validation functions: weighted scores, ties, zero weights, alternatives, source snapshots, deduplication, unknown IDs and invalid travel counts.
No browser connection was available: rendered layout, keyboard/focus behavior, responsive scrolling and end-to-end refresh/form flows still require browser QA.
No production backend: durable sales delivery, published proposals, token expiry, rate limiting, server recalculation, admin and lifecycle events remain integration work.
Only verified editorial categories are enabled. The catalog must eventually use stable backend IDs and structured itinerary records. Sitewide unrelated SEO, forms, headings and navigation were not rewritten.
Next extension: attach an immutable official quote with its own amount/currency/version to the request; payment and booking should reference that server-approved quote, never the draft estimate.


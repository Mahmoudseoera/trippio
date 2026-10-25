/* Run: npm install --prefix .qa --no-save --no-package-lock linkedom
        NODE_PATH=.qa/node_modules node --test tests/travel-search.test.cjs
   Logic tests use the real catalog (parsed from the site's own HTML), not a mock dataset. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');

const ROOT = path.resolve(__dirname, '..');
globalThis.TrippioTravel = {};
for (const f of ['lexicon', 'catalog', 'intent', 'matcher', 'planner', 'provider']) require(path.join(ROOT, 'assets/js/travel-search', f + '.js'));
const T = globalThis.TrippioTravel;
const doc = f => parseHTML(fs.readFileSync(path.join(ROOT, f), 'utf8')).document;
const catalog = T.catalog.build(doc('ai-assistance.html'), [doc('subcategory.html')]);
const find = q => { const intent = T.intent.extractLocal(q); return { intent, found: T.matcher.search(catalog, intent) }; };
const plan = (q, opts) => { const intent = T.intent.extractLocal(q); return T.planner.assemble(catalog, intent, T.planner.proposeLocalSkeleton(catalog, intent, opts), opts); };

test('catalog: five real tours parsed from authored HTML, optional fields stay null', () => {
  assert.equal(catalog.tours.length, 5);
  const diving = catalog.tour('diving-hurghada');
  assert.equal(diving.price, null);
  assert.equal(diving.duration, null);
  assert.ok(diving.notes.includes('No published price'));
  assert.equal(catalog.tour('giza-pyramids-sphinx').price.amount, 89);
});

test('A: Arabic request for sea trip in Alexandria is understood and honestly empty', () => {
  const { intent, found } = find('عايز رحلة بحر في إسكندرية لمدة يومين.');
  assert.deepEqual(intent.destinations, ['outside:alexandria']);
  assert.ok(intent.activities.includes('sea'));
  assert.deepEqual(intent.duration, { value: 2, unit: 'days' });
  assert.equal(found.results.length, 0);
  assert.deepEqual(found.unmet.destinations, ['Alexandria']);
});

test('A: Arabic with attached prepositions and Arabic-Indic digits', () => {
  const i = T.intent.extractLocal('رحلة غوص بالغردقة ٣ ايام ب 500 دولار');
  assert.deepEqual(i.destinations, ['hurghada']);
  assert.deepEqual(i.duration, { value: 3, unit: 'days' });
  assert.deepEqual(i.budget, { amount: 500, currency: 'USD', level: null });
});

test('B: quiet beach honeymoon does not claim quietness; limitation is disclosed', () => {
  const { found } = find('Find a quiet beach holiday suitable for a honeymoon.');
  assert.ok(found.notes.some(n => /quiet/.test(n)));
  for (const r of found.results) assert.ok(!r.reasons.some(x => /quiet/i.test(x.text)));
});

test('D: exact attraction match outranks destination and broad matches, with real evidence', () => {
  const { found } = find('Karnak and the Valley of the Kings');
  assert.equal(found.results[0].level, 'attraction');
  assert.ok(found.results[0].reasons.every(r => r.evidence));
  assert.ok(catalog.tour(found.results[0].tourId).stopIds.includes('karnak'));
});

test('F: a landmark no tour includes returns no fabricated match', () => {
  const { found } = find('Abu Simbel temple');
  assert.ok(found.unmet.attractions.includes('Abu Simbel'));
  assert.ok(!found.results.some(r => r.level === 'attraction'));
});

test('destination is a hard constraint; nearby tours only when nothing matches and only by site coordinates', () => {
  const { found } = find('beach in Sharm El Sheikh');
  assert.equal(found.results.length, 0);
  assert.ok(found.nearby.length > 0);
  for (const n of found.nearby) { assert.equal(n.level, 'nearby'); assert.ok(n.distanceKm <= T.matcher.NEARBY_KM); }
});

test('budget: a verified higher from-price excludes; unknown price is flagged, never assumed', () => {
  const { found } = find('tours in Luxor under $50');
  assert.equal(found.results.length, 0);
  const hurghada = find('diving in Hurghada under $20').found.results[0];
  assert.ok(hurghada.limitations.some(l => /No published price/.test(l)));
});

test('C: family plan for Sharm parses travellers/budget and never invents products or totals', () => {
  const q = 'Family with children aged 5 and 8, four days in Sharm El Sheikh, medium budget, beach activities';
  const intent = T.intent.extractLocal(q);
  assert.deepEqual(intent.travellers.children, [5, 8]);
  assert.equal(intent.budget.level, 'medium');
  const p = plan(q);
  assert.equal(p.total, 4);
  assert.equal(p.productCount, 0);
  assert.equal(p.pricing.perPersonFrom, null);
  assert.equal(p.budget.status, 'level-only');
  assert.ok(p.limitations.some(l => /Sharm/.test(l)));
  assert.ok(p.days.every(d => d.items.every(i => i.type === 'proposed' && i.bookable === false)));
});

test('plan: totals only from real same-currency prices; missing price makes total incomplete', () => {
  const p = plan('two days in Aswan and Luxor under $300');
  assert.equal(p.pricing.perPersonFrom, 146);
  assert.equal(p.pricing.currency, 'USD');
  assert.equal(p.budget.status, 'within-listed');
  const withMissing = T.planner.priceSummary([{ type: 'product', product: catalog.toPublic(catalog.tour('diving-hurghada')) }, { type: 'product', product: catalog.toPublic(catalog.tour('felucca-sunset')) }], true);
  assert.equal(withMissing.perPersonFrom, null);
  assert.equal(withMissing.complete, false);
  assert.equal(withMissing.missing[0].tourId, 'diving-hurghada');
});

test('plan: multi-day tour occupies its days and is not double-booked', () => {
  const p = plan('8 days nile cruise');
  assert.equal(p.productCount, 1);
  assert.equal(p.days.filter(d => d.items.some(i => i.type === 'continued')).length, 7);
  assert.equal(p.pricing.coversAllDays, true);
});

test('H: hostile model intent is reduced to whitelisted, bounded values', () => {
  const { intent, issues } = T.intent.validateIntent({
    destinations: ['luxor', '<script>alert(1)</script>', 'DROP TABLE tours'], activities: ['historical', 42],
    duration: { value: 999, unit: 'days' }, budget: { amount: 50, currency: 'BTC' }, url: 'https://evil.example', tours: [{ id: 'x' }],
    travellers: { adults: 9999, children: [3, 200, 'x'] }, keywords: ['../etc/passwd', 'temple']
  }, { query: 'q' });
  assert.deepEqual(intent.destinations, ['luxor']);
  assert.deepEqual(intent.activities, ['historical']);
  assert.equal(intent.duration, null);
  assert.equal(intent.budget, null);
  assert.deepEqual(intent.travellers.children, [3]);
  assert.deepEqual(intent.keywords, ['temple']);
  assert.ok(issues.length > 0);
  assert.equal(JSON.stringify(intent).includes('evil.example'), false);
  assert.equal(T.intent.validateIntent('nope').intent.destinations.length, 0);
});

test('H/J: forged skeleton ids, days, prices and titles are rejected; shown data comes from the catalog', () => {
  const intent = T.intent.extractLocal('three days in luxor');
  const p = T.planner.assemble(catalog, intent, { days: [
    { day: 1, tourIds: ['karnak-valley-kings', 'FAKE-9', '../etc/passwd'], title: 'Hacked', price: 1, proposed: [{ title: 'Balloon <b>x</b>', why: 'ok' }] },
    { day: 2, tourIds: ['karnak-valley-kings'] }, { day: 9, tourIds: ['felucca-sunset'] }] });
  assert.equal(p.productCount, 1);
  assert.ok(p.rejected.length >= 4);
  const item = p.days[0].items.find(i => i.type === 'product');
  const real = catalog.tour('karnak-valley-kings');
  assert.equal(item.product.title, real.title);
  assert.equal(item.product.price.amount, 112);
  assert.equal(item.product.detailUrl, real.detailUrl);
  assert.equal(item.product.image, real.image);
  const prop = p.days[0].items.find(i => i.type === 'proposed');
  assert.equal(prop.bookable, false);
  assert.ok(!/[<>]/.test(prop.title));
});

test('J: every public result field equals the original catalog record; URLs and images are local only', () => {
  for (const t of catalog.tours) {
    const pub = catalog.toPublic(t);
    assert.equal(pub.id, t.id); assert.equal(pub.title, t.title); assert.equal(pub.image, t.image);
    assert.equal(pub.detailUrl, t.detailUrl); assert.equal(pub.priceDisplay, t.priceDisplay);
    assert.match(pub.detailUrl, /^[\w.%-]+\.html$/);
    assert.match(pub.image, /^assets\/images\//);
  }
  assert.equal(T.catalog.safeUrl('https://evil.example/x.html'), null);
  assert.equal(T.catalog.safeUrl('javascript:alert(1)'), null);
  assert.equal(T.catalog.safeImage('assets/images/../../secret'), null);
});

test('I: conflicting listing and assistant prices are surfaced, not silently chosen', () => {
  const a = doc('ai-assistance.html'), l = doc('subcategory.html');
  const cardPrice = [...l.querySelectorAll('.tour-card-v2')].find(c => /Felucca/.test(c.textContent)).querySelector('.tour-card-v2__price strong');
  cardPrice.textContent = '$40';
  const felucca = a.querySelector('[data-tour=felucca-sunset] .tour-price');
  felucca.insertAdjacentHTML('afterbegin', '<span>From <strong>$34</strong></span>');
  const c = T.catalog.build(a, [l]).tour('felucca-sunset');
  assert.deepEqual(c.conflicts, ['price']);
  assert.equal(c.price, null);
});

test('image: validation checks size, type and real file signature', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const mk = (bytes, type, size) => ({ size: size === undefined ? bytes.length : size, type, slice: () => ({ arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) }) });
  assert.equal((await T.image.validateFile(mk(png, 'image/png'))).ok, true);
  assert.equal((await T.image.validateFile(mk(png, 'image/jpeg'))).ok, false);
  assert.equal((await T.image.validateFile(mk(Buffer.from('hello world!'), 'image/png'))).ok, false);
  assert.equal((await T.image.validateFile(mk(png, 'image/gif'))).ok, false);
  assert.equal((await T.image.validateFile(mk(png, 'image/png', 6 * 1024 * 1024))).ok, false);
  assert.equal((await T.image.validateFile(mk(png, 'image/png', 0))).ok, false);
});

test('E: image candidates map only to catalog places; unknown places stay unmatched', () => {
  const { intent } = T.providers.candidatesToIntent([{ label: 'Karnak Temple', confidence: .9 }, { label: 'Atlantis Resort Dubai', confidence: .2 }], catalog);
  assert.deepEqual(intent.attractions, ['karnak']);
});

test('G: remote provider falls back to local rules on 500, 429, bad JSON and timeout, and never hides a real abort', async () => {
  const mk = fetchImpl => T.providers.withFallback(T.providers.remote({ apiBase: '/api', fetch: fetchImpl, timeoutMs: 50 }), T.providers.local);
  const res = (status, body) => async () => ({ status, ok: status < 400, json: async () => { if (body === undefined) throw new Error('bad json'); return body; } });
  for (const [name, f, code] of [['500', res(500, {}), 'server'], ['429', res(429, {}), 'rate_limited'], ['bad json', res(200, undefined), 'bad_response'],
    ['network', async () => { throw new TypeError('fetch failed'); }, 'network'],
    ['timeout', (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason))), 'timeout']]) {
    const out = await mk(f).understand({ query: 'diving in Hurghada' });
    assert.equal(out.degraded.code, code, name);
    assert.deepEqual(out.intent.destinations, ['hurghada'], name);
  }
  const ctl = new AbortController();
  const slow = mk((u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason))));
  const p = slow.understand({ query: 'x y', signal: ctl.signal }); ctl.abort(new Error('user cancelled'));
  await assert.rejects(p);
});

test('local provider never pretends to recognise an image', async () => {
  const out = await T.providers.local.analyzeImage({});
  assert.equal(out.status, 'unavailable');
  assert.deepEqual(out.candidates, []);
});

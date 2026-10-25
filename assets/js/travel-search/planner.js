/* Travel search · itinerary planner.
   A provider (local rules today, an AI model later) proposes a SKELETON: which catalog tour ids
   go on which day, plus optional free-text suggestions. assemble() rebuilds everything shown to
   the customer from the catalog and rejects what it cannot verify:
     - unknown ids, duplicates, tours that do not fit the trip length or the same day;
     - model-supplied titles, links, images and prices (ignored entirely);
     - totals: calculated only from real, same-currency prices, never estimated.
   Suggestions are labelled "proposed" and are never bookable. */
(function (root) {
  'use strict';
  const T = (root.TrippioTravel = root.TrippioTravel || {});

  const MAX_DAYS = 14;
  const QUOTE_URL = 'tailor-made.html';
  const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

  function tripDays(intent) {
    const d = intent.duration;
    if (!d) return null;
    const days = d.unit === 'days' ? Math.ceil(d.value) : 1;
    return Math.min(Math.max(days, 1), MAX_DAYS);
  }

  // Deterministic skeleton from catalog matches. An AI provider returns the same shape.
  function proposeLocalSkeleton(catalog, intent, options) {
    const o = options || {};
    const total = tripDays(intent) || 3;
    const found = T.matcher.search(catalog, intent, { limit: 12, excludeTourIds: o.excludeTourIds, skipNearby: true });
    const days = Array.from({ length: total }, (_, i) => ({ day: i + 1, tourIds: [], proposed: [] }));
    const load = new Array(total).fill(0);
    const city = new Array(total).fill(null);
    const place = (tour, from) => {
      const need = tour.duration ? tour.duration.days : 1;
      const span = Math.max(1, Math.ceil(need));
      for (let start = from; start + span <= total; start++) {
        let free = true;
        for (let k = start; k < start + span; k++) if (load[k] + (need < 1 ? need : 1) > 1) free = false;
        if (need < 1) {
          // A short tour can share a day only with a tour in the same destination.
          const sameCity = city[start] === null || tour.cityIds.includes(city[start]);
          if (!(free && sameCity)) continue;
        } else if (!free) continue;
        for (let k = start; k < start + span; k++) { load[k] += need < 1 ? need : 1; city[k] = city[k] || tour.cityIds[0]; }
        days[start].tourIds.push(tour.id);
        return true;
      }
      return false;
    };
    const ordered = found.results.map(r => catalog.tour(r.tourId)).filter(Boolean)
      .sort((a, b) => ((b.duration ? b.duration.days : 1) > 1) - ((a.duration ? a.duration.days : 1) > 1));
    for (const tour of ordered) {
      if ((tour.duration ? tour.duration.days : 1) > total) continue;
      place(tour, 0);
    }
    const labels = intent.activities.map(k => T.lexicon.labelFor(k)).concat(intent.preferences.map(k => T.lexicon.labelFor(k)));
    for (const day of days) {
      if (load[day.day - 1] === 0) day.proposed.push({
        title: 'Open day', why: labels.length ? 'Left open for ' + labels.slice(0, 3).join(', ') + ', as you asked. No catalog tour fits this day.' : 'No catalog tour fits this day.'
      });
    }
    return { title: null, assumptions: [], days };
  }

  function priceSummary(items, coversAllDays) {
    const products = items.filter(i => i.type === 'product');
    const missing = [];
    const currencies = new Set();
    let sum = 0;
    for (const p of products) {
      const price = p.product.price;
      if (!price) { missing.push({ tourId: p.product.id, reason: p.product.conflicts.includes('price') ? 'Conflicting prices are listed' : 'No published price' }); continue; }
      currencies.add(price.currency); sum += price.amount;
    }
    const mixed = currencies.size > 1;
    const complete = products.length > 0 && !missing.length && !mixed;
    let note;
    if (!products.length) note = 'No catalog tours are scheduled, so no total can be calculated.';
    else if (mixed) note = 'Tours are priced in different currencies, so no total is shown.';
    else if (missing.length) note = 'Incomplete: ' + missing.length + ' scheduled tour' + (missing.length > 1 ? 's have' : ' has') + ' no confirmed price.';
    else note = 'Sum of listed from-prices per person for the tours above. Final price, child rates and availability are confirmed by the travel team.';
    if (products.length && !coversAllDays) note += ' Open days are not priced.';
    return { currency: complete ? [...currencies][0] : null, perPersonFrom: complete ? sum : null, complete, coversAllDays, includedTourIds: products.map(p => p.product.id), missing, note };
  }

  function budgetStatus(intent, pricing) {
    const b = intent.budget;
    if (!b) return { status: 'not-specified', note: null };
    if (!b.amount) return { status: 'level-only', note: 'A "' + b.level + '" budget cannot be checked against catalog prices, so no plan is labelled as within budget.' };
    if (!pricing.complete || !pricing.coversAllDays) return { status: 'cannot-confirm', note: 'The listed prices are incomplete, so the plan cannot be confirmed against ' + b.amount + ' ' + b.currency + '.' };
    if (pricing.currency !== b.currency) return { status: 'cannot-confirm', note: 'Prices are in ' + pricing.currency + ' and your budget is in ' + b.currency + '; they were not converted.' };
    const within = pricing.perPersonFrom <= b.amount;
    return { status: within ? 'within-listed' : 'exceeds-listed', note: 'Compared per person because the budget basis was not stated. Listed from-price total ' + pricing.perPersonFrom + ' ' + pricing.currency + (within ? ' is at or below ' : ' is above ') + b.amount + ' ' + b.currency + '. This is not a confirmed quote.' };
  }

  function assemble(catalog, intent, skeleton, options) {
    const o = options || {};
    const rejected = [], assumptions = [], limitations = [];
    const requested = tripDays(intent);
    let total = requested;
    if (!total) { total = 3; assumptions.push('No trip length was given, so a 3-day plan is shown. Tell us how many days you have to change it.'); }
    if (intent.duration && intent.duration.unit === 'hours') assumptions.push('You gave a length in hours, so a single-day plan is shown.');
    if (intent.duration && intent.duration.value !== Math.ceil(intent.duration.value)) assumptions.push('Half a day was rounded up to one day.');
    const sk = skeleton && typeof skeleton === 'object' ? skeleton : { days: [] };
    (Array.isArray(sk.assumptions) ? sk.assumptions.slice(0, 5) : []).forEach(a => { const t = clean(a, 200); if (t) assumptions.push(t); });

    const days = Array.from({ length: total }, (_, i) => ({ day: i + 1, headline: null, items: [], span: 1, load: 0 }));
    const used = new Set();
    const occupied = new Array(total).fill(false);
    const spanOf = new Array(total).fill(null);
    for (const d of (Array.isArray(sk.days) ? sk.days.slice(0, MAX_DAYS) : [])) {
      const n = d && Number.isInteger(d.day) ? d.day : null;
      if (n == null || n < 1 || n > total) { rejected.push({ id: String(d && d.day), reason: 'Day is outside the trip length' }); continue; }
      for (const id of (Array.isArray(d.tourIds) ? d.tourIds.slice(0, 4) : [])) {
        if (typeof id !== 'string' || !catalog.byId.has(id)) { rejected.push({ id: clean(id, 40), reason: 'Not a tour in our catalog' }); continue; }
        if (used.has(id) || (o.excludeTourIds || []).includes(id)) { rejected.push({ id, reason: 'Already used in this plan' }); continue; }
        const tour = catalog.byId.get(id);
        const need = tour.duration ? tour.duration.days : 1;
        const span = Math.max(1, Math.ceil(need));
        if (n - 1 + span > total) { rejected.push({ id, reason: 'Listed length (' + (tour.durationText || '?') + ') does not fit in the days left' }); continue; }
        const portion = need < 1 ? need : 1;
        let fits = true;
        for (let k = n - 1; k < n - 1 + span; k++) if (days[k].load + portion > 1) fits = false;
        if (!fits) { rejected.push({ id, reason: 'Does not fit alongside another tour on the same day' }); continue; }
        for (let k = n - 1; k < n - 1 + span; k++) days[k].load += portion;
        used.add(id);
        for (let k = n - 1; k < n - 1 + span; k++) { occupied[k] = true; if (k > n - 1) spanOf[k] = { tourId: id, title: tour.title, part: k - (n - 1) + 1, of: span }; }
        // Trip length applies to the whole plan, not to each tour, so it is left out of per-tour scoring.
        const score = T.matcher.scoreTour(tour, { ...intent, duration: null }, catalog, {});
        const limits = score.limitations.slice();
        if (!tour.duration) limits.push('No duration is published, so it is assumed to take one day.');
        days[n - 1].items.push({
          type: 'product', status: 'catalog-product', spansDays: span > 1 ? span : 1,
          product: catalog.toPublic(tour),
          why: score.reasons.map(r => ({ kind: r.kind, text: r.text })), limitations: limits, unverified: score.unverified,
          confirm: ['availability'].concat(tour.price ? [] : ['price'])
        });
      }
      for (const p of (Array.isArray(d.proposed) ? d.proposed.slice(0, 3) : [])) {
        const title = clean(p && p.title, 80), why = clean(p && p.why, 200);
        if (title) days[n - 1].items.push({ type: 'proposed', status: 'proposed-not-bookable', title, why, bookable: false });
      }
    }
    days.forEach((day, i) => {
      const cities = [...new Set(day.items.filter(it => it.type === 'product').flatMap(it => it.product.cityIds))]
        .map(id => (catalog.cities.get(id) || {}).name).filter(Boolean);
      day.headline = cities.length ? cities.slice(0, 2).join(', ') + (cities.length > 2 ? ' +' + (cities.length - 2) + ' more' : '') : null;
      if (spanOf[i]) day.items.unshift({ type: 'continued', status: 'catalog-product', tourId: spanOf[i].tourId, title: spanOf[i].title, part: spanOf[i].part, of: spanOf[i].of });
      delete day.load;
    });
    const placedCities = [...new Set(days.flatMap(d => d.items.filter(it => it.type === 'product').map(it => it.product.cityIds[0])))].map(id => (catalog.cities.get(id) || {}).name).filter(Boolean);
    if (placedCities.length > 1) limitations.push('Travel between ' + placedCities.join(', ') + ' is not part of these tours, and transfers are not published in the catalog.');
    const flat = days.flatMap(d => d.items);
    const covered = occupied.filter(Boolean).length;
    const coversAllDays = covered >= total;
    const pricing = priceSummary(flat, coversAllDays);
    const budget = budgetStatus(intent, pricing);

    const search = T.matcher.search(catalog, intent, { limit: 6, excludeTourIds: o.excludeTourIds });
    if (search.unmet.destinations.length) limitations.push('No tours in our catalog for ' + search.unmet.destinations.join(', ') + '.');
    if (search.unmet.attractions.length) limitations.push('No tour in our catalog includes ' + search.unmet.attractions.join(', ') + '.');
    const alternatives = !search.results.length ? search.nearby.map(n => ({ product: catalog.toPublic(catalog.tour(n.tourId)), level: n.level, levelLabel: n.levelLabel, distanceKm: n.distanceKm, why: n.reasons.map(r => ({ kind: r.kind, text: r.text })), limitations: n.limitations })) : [];

    return {
      days, total, requestedDays: requested, assumptions, limitations: limitations.concat(search.notes), rejected,
      pricing, budget, alternatives, unmet: search.unmet,
      productCount: flat.filter(i => i.type === 'product').length, openDays: total - covered,
      actions: { quoteUrl: QUOTE_URL }
    };
  }

  // Essential details only: with neither a place, an interest nor a length there is nothing to plan from.
  function needsClarification(intent) {
    if (!intent.destinations.length && !intent.attractions.length && !intent.activities.length && !intent.keywords.length && !intent.duration) {
      return { question: 'Where would you like to go, and for how many days?', examples: ['Four days in Luxor with temples', 'Three days of diving in Hurghada'] };
    }
    return null;
  }

  T.planner = { proposeLocalSkeleton, assemble, needsClarification, tripDays, priceSummary, budgetStatus, QUOTE_URL, MAX_DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = T.planner;
})(typeof globalThis !== 'undefined' ? globalThis : this);

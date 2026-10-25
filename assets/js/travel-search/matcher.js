/* Travel search · matcher.
   Deterministic ranking over the real catalog records. No AI is involved here, and no AI output
   is trusted here: the intent has already been validated. Every reason shown to a customer is
   built from a field that exists on the catalog record, and every unsupported request becomes
   a visible limitation instead of a claim. */
(function (root) {
  'use strict';
  const T = (root.TrippioTravel = root.TrippioTravel || {});
  const L = () => T.lexicon;

  const WEIGHTS = { attraction: 60, destination: 40, activity: 15, preference: 5, durationMatch: 10, durationShort: -5, durationLong: -15, keyword: 3, keywordCap: 9 };
  const LEVEL_ORDER = { attraction: 4, destination: 3, nearby: 2.5, activity: 2, broad: 1 };
  const LEVEL_LABEL = { attraction: 'Exact place match', destination: 'Destination match', nearby: 'Nearby destination', activity: 'Interest match', broad: 'Related' };
  const NEARBY_KM = 150;

  function distanceKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  const requestedDays = d => (d.unit === 'days' ? d.value : d.value >= 6 ? 1 : 0.5);
  const durationLabel = d => d.value + ' ' + (d.value === 1 ? d.unit.slice(0, -1) : d.unit);

  // First catalog evidence entry that contains a term. Stops and titles outrank long descriptions.
  const SOURCE_RANK = { stop: 0, title: 1, tag: 2, description: 3, destination: 4 };
  function findEvidence(tour, term) {
    const hits = tour.evidence.filter(e => L().has(e.norm, term)).sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);
    return hits[0] || null;
  }
  const where = e => (e.source === 'stop' ? 'itinerary stop "' + e.ref + '"' : e.source === 'title' ? 'the tour title' : e.source === 'tag' ? 'the tour category' : 'the tour description');

  function scoreTour(tour, intent, catalog, ctx) {
    const lx = L();
    const reasons = [], limitations = [], unverified = [];
    let score = 0;
    const kinds = new Set();

    for (const key of intent.attractions) {
      const stop = catalog.stops.get(key);
      if (stop && tour.stopIds.includes(key)) {
        score += WEIGHTS.attraction; kinds.add('attraction');
        reasons.push({ kind: 'attraction', text: 'Itinerary includes ' + stop.name, evidence: { source: 'stop', ref: key } });
      }
    }
    for (const key of intent.destinations) {
      if (tour.cityIds.includes(key) && catalog.cities.has(key)) {
        score += WEIGHTS.destination; kinds.add('destination');
        reasons.push({ kind: 'destination', text: 'Tour covers ' + catalog.cities.get(key).name, evidence: { source: 'destination', ref: key } });
      }
    }
    for (const key of intent.activities) {
      const concept = lx.ACTIVITIES[key];
      if (!concept) continue;
      let hit = null, term = null;
      for (const t of concept.evidence) { hit = findEvidence(tour, t); if (hit) { term = t; break; } }
      if (hit) {
        score += WEIGHTS.activity; kinds.add('activity');
        reasons.push({ kind: 'activity', text: concept.label.charAt(0).toUpperCase() + concept.label.slice(1) + ': ' + where(hit) + ' mentions ' + term, evidence: { source: hit.source, ref: hit.ref } });
      } else limitations.push('The catalog does not mention ' + concept.label + ' for this tour.');
    }
    for (const key of intent.preferences) {
      const label = lx.PREFERENCES[key] ? lx.PREFERENCES[key].label : key;
      if (key === 'honeymoon') {
        const tagged = tour.cityIds.map(id => catalog.cities.get(id)).filter(c => c && c.interests.includes('honeymoon'));
        if (tagged.length) {
          score += WEIGHTS.preference;
          reasons.push({ kind: 'destination-tag', text: 'Destination guide tags ' + tagged.map(c => c.name).join(', ') + ' for honeymoons', evidence: { source: 'destination', ref: tagged[0].id } });
        } else unverified.push(label);
      } else unverified.push(label);
    }
    if (intent.duration && tour.duration) {
      const want = requestedDays(intent.duration), got = tour.duration.days;
      if (got === want) { score += WEIGHTS.durationMatch; reasons.push({ kind: 'duration', text: 'Listed duration is ' + tour.durationText, evidence: { source: 'listing', ref: 'duration' } }); }
      else if (got < want) { score += WEIGHTS.durationShort; limitations.push('Listed as ' + tour.durationText + ', shorter than the ' + durationLabel(intent.duration) + ' you asked for.'); }
      else { score += WEIGHTS.durationLong; limitations.push('Listed as ' + tour.durationText + ', longer than the ' + durationLabel(intent.duration) + ' you asked for.'); }
    } else if (intent.duration) limitations.push('No duration is published for this tour.');

    let keywordScore = 0;
    for (const k of intent.keywords) {
      if (k.length < 4 || keywordScore >= WEIGHTS.keywordCap) continue;
      const hit = findEvidence(tour, k);
      if (hit) { keywordScore += WEIGHTS.keyword; reasons.push({ kind: 'keyword', text: where(hit).replace(/^./, c => c.toUpperCase()) + ' mentions "' + k + '"', evidence: { source: hit.source, ref: hit.ref } }); }
    }
    if (keywordScore) { score += keywordScore; kinds.add('broad'); }

    // Budget: only a verified from-price in the same currency may exclude a tour.
    let excluded = false;
    const b = intent.budget;
    if (b && b.amount) {
      if (!tour.price) limitations.push('No published price, so your budget cannot be checked.');
      else if (tour.price.currency !== b.currency) limitations.push('Listed in ' + tour.price.currency + '; your budget is in ' + b.currency + ', so it was not compared.');
      else if (tour.price.amount > b.amount) excluded = true;
      else reasons.push({ kind: 'budget', text: 'Listed from-price ' + tour.priceDisplay + ' per person is within ' + b.amount + ' ' + b.currency + '; final price is confirmed by the travel team', evidence: { source: 'listing', ref: 'price' } });
    }
    return { score, kinds, reasons, limitations, unverified, excluded };
  }

  function levelOf(kinds) {
    for (const k of ['attraction', 'destination', 'activity', 'broad']) if (kinds.has(k)) return k;
    return null;
  }

  function search(catalog, intent, options) {
    const lx = L();
    const o = options || {};
    const limit = o.limit || 12;
    const excludeIds = new Set(o.excludeTourIds || []);
    const notes = [];
    const unmet = { destinations: [], attractions: [] };

    const coveredDestinations = [], coveredAttractions = [];
    for (const key of intent.destinations) {
      const covered = catalog.cities.has(key) && catalog.tours.some(t => t.cityIds.includes(key));
      if (covered) coveredDestinations.push(key);
      else unmet.destinations.push(catalog.cities.has(key) ? catalog.cities.get(key).name : lx.labelFor(key));
    }
    for (const key of intent.attractions) {
      const covered = catalog.stops.has(key) && catalog.tours.some(t => t.stopIds.includes(key));
      if (covered) coveredAttractions.push(key);
      else unmet.attractions.push(catalog.stops.has(key) ? catalog.stops.get(key).name : lx.labelFor(key));
    }
    const filterByDestination = intent.destinations.length > 0 && !o.ignoreDestination;

    const unverifiedPrefs = intent.preferences.filter(k => k !== 'honeymoon');
    if (unverifiedPrefs.length) notes.push('The catalog does not record ' + unverifiedPrefs.map(k => lx.PREFERENCES[k].label).join(' or ') + ' details, so ' + (unverifiedPrefs.length > 1 ? 'they are' : 'it is') + ' not used to rank tours.');
    if (intent.budget && !intent.budget.amount && intent.budget.level) notes.push('A "' + intent.budget.level + '" budget level cannot be matched to catalog prices, so it is not used to filter tours.');
    if (intent.travellers && (intent.travellers.children.length || intent.travellers.childrenCount)) notes.push('The catalog does not publish child pricing or age rules. Confirm these with the travel team.');

    const scored = [];
    let hiddenByBudget = 0;
    for (const tour of catalog.tours) {
      if (excludeIds.has(tour.id)) continue;
      const s = scoreTour(tour, intent, catalog, o);
      if (s.excluded) { hiddenByBudget++; continue; }
      const level = levelOf(s.kinds);
      if (filterByDestination) {
        // Destination is an explicit constraint: tours elsewhere do not qualify, whatever else they match.
        if (!coveredDestinations.some(d => tour.cityIds.includes(d))) continue;
      } else if (!level) continue;
      scored.push({ tour, ...s, level: level || 'destination' });
    }
    if (hiddenByBudget) notes.push(hiddenByBudget + ' tour' + (hiddenByBudget > 1 ? 's were' : ' was') + ' hidden because the listed from-price is above your budget.');

    // With only broad "related" evidence and a stronger result available, hide the weak ones.
    const hasStrong = scored.some(r => r.level === 'attraction' || r.level === 'destination');
    const results = scored.filter(r => !(hasStrong && r.level === 'broad')).sort((a, b) =>
      b.score - a.score || (b.tour.rating || 0) - (a.tour.rating || 0) || a.tour.id.localeCompare(b.tour.id)).slice(0, limit).map(r => {
      const limitations = r.limitations.slice();
      if (o.ignoreDestination && intent.destinations.length) limitations.unshift('Not in ' + intent.destinations.map(k => catalog.cities.has(k) ? catalog.cities.get(k).name : lx.labelFor(k)).join(' or ') + '.');
      return { tourId: r.tour.id, score: r.score, level: r.level, levelLabel: LEVEL_LABEL[r.level], reasons: r.reasons, limitations, unverified: r.unverified };
    });

    // Nearby destinations: only from the site's own city coordinates, only when nothing matched.
    const nearby = [];
    if (!results.length && filterByDestination && !o.skipNearby) {
      for (const key of intent.destinations) {
        const from = catalog.cities.get(key);
        if (!from) continue;
        for (const tour of catalog.tours) {
          if (excludeIds.has(tour.id) || tour.cityIds.includes(key)) continue;
          const city = tour.cityIds.map(id => catalog.cities.get(id)).filter(Boolean)
            .map(c => ({ c, km: distanceKm(from, c) })).filter(x => x.km != null && x.km <= NEARBY_KM).sort((a, b) => a.km - b.km)[0];
          if (!city) continue;
          const s = scoreTour(tour, { ...intent, destinations: [] }, catalog, o);
          if (s.excluded) continue;
          if ((intent.activities.length || intent.attractions.length) && !s.kinds.has('activity') && !s.kinds.has('attraction')) continue;
          const km = Math.round(city.km);
          nearby.push({ tourId: tour.id, score: s.score, level: 'nearby', levelLabel: LEVEL_LABEL.nearby, distanceKm: km, fromCity: from.name, toCity: city.c.name,
            reasons: [{ kind: 'nearby', text: city.c.name + ' is about ' + km + ' km from ' + from.name + ' in a straight line, using the site\'s own coordinates. Travel time and transfers are not published.', evidence: { source: 'coordinates', ref: city.c.id } }].concat(s.reasons),
            limitations: s.limitations, unverified: s.unverified });
        }
      }
      nearby.sort((a, b) => a.distanceKm - b.distanceKm || b.score - a.score);
    }

    return {
      results, nearby: nearby.slice(0, limit), unmet, notes,
      applied: { destinations: filterByDestination ? coveredDestinations : [], attractions: coveredAttractions, ignoredDestination: !!o.ignoreDestination },
      fallbackAvailable: filterByDestination && !results.length && (intent.activities.length > 0 || intent.attractions.length > 0 || intent.keywords.length > 0)
    };
  }

  T.matcher = { search, scoreTour, distanceKm, WEIGHTS, LEVEL_LABEL, LEVEL_ORDER, NEARBY_KM };
  if (typeof module !== 'undefined' && module.exports) module.exports = T.matcher;
})(typeof globalThis !== 'undefined' ? globalThis : this);

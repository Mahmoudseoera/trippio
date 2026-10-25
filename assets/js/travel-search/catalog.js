/* Travel search · catalog adapter.
   The site has no tour database: tours are authored in HTML. This adapter READS that markup
   (ai-assistance.html for tours, itinerary stops and destinations; subcategory.html for the
   listing cards' price, rating, duration and image) and joins records in memory. Nothing is
   copied into a second dataset, and fields a page does not publish stay null.
   When a real backend arrives, replace load() with an API read that returns the same shape. */
(function (root) {
  'use strict';
  const T = (root.TrippioTravel = root.TrippioTravel || {});
  const L = () => T.lexicon;

  const DEFAULT_SOURCES = { assistant: 'ai-assistance.html', listings: ['subcategory.html'] };
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
  const attr = (node, name) => (node && node.getAttribute(name)) || '';
  const list = value => String(value || '').split(/\s+/).filter(Boolean);
  const num = value => { const n = Number(value); return Number.isFinite(n) ? n : null; };

  // Only same-directory html pages and local images may ever reach a link or <img>.
  const safeUrl = value => (/^[A-Za-z0-9._%-]+\.html(#[A-Za-z0-9_-]+)?$/.test(value || '') ? value : null);
  const safeImage = value => (/^assets\/images\/[^"'<>\\]+$/.test(value || '') && !value.includes('..') ? value : null);

  function parsePrice(raw) {
    const m = /(\$|usd|€|eur|£|gbp)\s?(\d[\d,]*(?:\.\d+)?)/i.exec(raw || '');
    if (!m) return null;
    const symbol = m[1].toLowerCase();
    const currency = { $: 'USD', usd: 'USD', '€': 'EUR', eur: 'EUR', '£': 'GBP', gbp: 'GBP' }[symbol];
    return { amount: Number(m[2].replace(/,/g, '')), currency, basis: 'per person', qualifier: 'from', display: raw.trim() };
  }

  // "8 days", "Full day · 8 hrs", "2 hours · evening". Free text with no number stays unparsed.
  function parseDuration(raw) {
    const s = String(raw || '').toLowerCase();
    let m = /(\d+)\s*(?:-\s*)?days?\b/.exec(s);
    if (m) return { value: Number(m[1]), unit: 'days', days: Number(m[1]), display: raw.trim() };
    m = /(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\b/.exec(s);
    if (m) {
      const hours = Number(m[1]);
      return { value: hours, unit: 'hours', days: hours >= 6 ? 1 : 0.5, fullDay: hours >= 6, display: raw.trim() };
    }
    if (/\bfull day\b/.test(s)) return { value: 1, unit: 'days', days: 1, fullDay: true, display: raw.trim() };
    return null;
  }

  function parseAssistant(doc) {
    const cities = new Map();
    doc.querySelectorAll('.city-tab[data-city]').forEach(el => {
      const id = attr(el, 'data-city');
      cities.set(id, {
        id, name: text(el.querySelector('strong')), blurb: text(el.querySelector('small')),
        lat: num(attr(el, 'data-lat')), lon: num(attr(el, 'data-lon')),
        interests: list(attr(el, 'data-interests')), image: safeImage(attr(el.querySelector('img'), 'src'))
      });
    });
    const stops = new Map();
    doc.querySelectorAll('.attraction[data-stop]').forEach(el => {
      const id = attr(el, 'data-stop');
      stops.set(id, {
        id, cityId: attr(el, 'data-city'), name: text(el.querySelector('.attraction-select strong')),
        dayLabel: text(el.querySelector('.attraction-select small')), story: text(el.querySelector('.attraction-story')),
        lat: num(attr(el, 'data-lat')), lon: num(attr(el, 'data-lon'))
      });
    });
    const tours = [];
    doc.querySelectorAll('.tour-option[data-tour]').forEach(el => {
      const link = el.querySelector('a[data-assistant-booking]');
      const href = attr(link, 'href');
      const priceNode = el.querySelector('.tour-price strong');
      tours.push({
        id: attr(el, 'data-tour'), title: text(el.querySelector('h4')), tag: text(el.querySelector('.tour-tag')),
        durationText: text(el.querySelector('div > p')), description: attr(el, 'data-description'),
        cityIds: list(attr(el, 'data-cities')), stopIds: list(attr(el, 'data-stops')),
        days: num(attr(el, 'data-days')), priceText: text(priceNode),
        detailUrl: safeUrl(href.split('#')[0]), enquiryUrl: safeUrl(href.includes('#') ? href : href + '#quote'),
        image: safeImage(attr(el.querySelector('img'), 'src')), imageAlt: attr(el.querySelector('img'), 'alt')
      });
    });
    return { cities, stops, tours };
  }

  function parseListings(doc) {
    const cards = [];
    doc.querySelectorAll('.tour-card-v2').forEach(el => {
      const spans = [...el.querySelectorAll('.tour-card-v2__meta > span:not(.dot)')];
      const priceBox = el.querySelector('.tour-card-v2__price');
      cards.push({
        title: text(el.querySelector('.tour-card-v2__title a')),
        listingUrl: safeUrl(attr(el.querySelector('.tour-card-v2__title a'), 'href')),
        image: safeImage(attr(el.querySelector('img'), 'src')),
        rating: num(text(el.querySelector('.tour-card-v2__top')).replace(/[^0-9.]/g, '')),
        durationText: text(spans[0]), cityLabel: text(spans[1]),
        description: text(el.querySelector('.tour-card-v2__desc')),
        priceText: text(priceBox && priceBox.querySelector('strong'))
      });
    });
    return cards;
  }

  // Pure: parsed documents in, catalog out. Used by load() and by the tests.
  function build(assistantDoc, listingDocs) {
    const { norm } = L();
    const a = parseAssistant(assistantDoc);
    const listed = new Map();
    (listingDocs || []).forEach(doc => parseListings(doc).forEach(card => {
      const key = norm(card.title);
      if (key && !listed.has(key)) listed.set(key, card);
    }));

    const tours = a.tours.map(src => {
      const card = listed.get(norm(src.title)) || null;
      const notes = [];
      const conflicts = [];

      const priceFromCard = card && parsePrice(card.priceText);
      const priceFromAssistant = parsePrice(src.priceText);
      let price = priceFromCard || priceFromAssistant || null;
      if (priceFromCard && priceFromAssistant && priceFromCard.amount !== priceFromAssistant.amount) {
        conflicts.push('price');
        price = null;
      }
      if (!price && !conflicts.includes('price')) notes.push('No published price');

      const durCard = card && parseDuration(card.durationText);
      const durAssistant = parseDuration(src.durationText.split('·')[0]);
      let duration = durCard || durAssistant || null;
      if (durCard && durAssistant && durCard.days !== durAssistant.days) { conflicts.push('duration'); duration = null; }
      if (!duration) notes.push(conflicts.includes('duration') ? 'Conflicting durations' : 'No published duration');
      if (!duration && src.days) duration = { value: src.days, unit: 'days', days: src.days, display: src.days + ' days' };

      const stopList = src.stopIds.map(id => a.stops.get(id)).filter(Boolean);
      const cityList = src.cityIds.map(id => a.cities.get(id)).filter(Boolean);
      const evidence = [
        { source: 'title', ref: src.title, text: src.title },
        { source: 'description', ref: src.title, text: src.description || (card && card.description) || '' },
        { source: 'tag', ref: src.tag, text: src.tag },
        ...stopList.flatMap(s => [{ source: 'stop', ref: s.name, text: s.name }, { source: 'stop', ref: s.name, text: s.story }]),
        ...cityList.map(c => ({ source: 'destination', ref: c.name, text: c.name }))
      ].filter(e => e.text).map(e => ({ ...e, norm: norm(e.text) }));

      return {
        id: src.id, title: src.title || (card && card.title) || src.id,
        description: (card && card.description) || src.description || null,
        image: (card && card.image) || src.image, imageAlt: src.imageAlt || src.title,
        rating: card ? card.rating : null,
        durationText: duration ? duration.display : null, duration,
        price, priceDisplay: price ? price.display : null,
        cityIds: src.cityIds, cityLabel: card && card.cityLabel ? card.cityLabel : cityList.map(c => c.name).join(', '),
        stopIds: src.stopIds, tag: src.tag,
        detailUrl: src.detailUrl, enquiryUrl: src.enquiryUrl, listingUrl: card ? card.listingUrl : null,
        notes, conflicts, evidence,
        sources: ['ai-assistance.html'].concat(card ? ['listing card'] : [])
      };
    });

    return makeCatalog(tours, a.cities, a.stops);
  }

  function makeCatalog(tours, cities, stops) {
    const byId = new Map(tours.map(t => [t.id, t]));
    return {
      tours, cities, stops, byId,
      tour: id => byId.get(id) || null,
      // The only shape that leaves the catalog layer. Everything is copied from the record.
      toPublic(tour) {
        return {
          id: tour.id, title: tour.title, description: tour.description, image: tour.image, imageAlt: tour.imageAlt,
          rating: tour.rating, duration: tour.durationText, price: tour.price ? { ...tour.price } : null,
          priceDisplay: tour.priceDisplay, destination: tour.cityLabel, cityIds: tour.cityIds.slice(),
          stops: tour.stopIds.map(id => stops.get(id)).filter(Boolean).map(s => ({ id: s.id, name: s.name, dayLabel: s.dayLabel })),
          detailUrl: tour.detailUrl, enquiryUrl: tour.enquiryUrl, notes: tour.notes.slice(), conflicts: tour.conflicts.slice()
        };
      },
      // Concepts the picture/place pickers can offer, taken from the catalog itself.
      placeOptions() {
        const used = new Set(tours.flatMap(t => t.stopIds));
        return [...stops.values()].filter(s => used.has(s.id)).map(s => ({ key: s.id, label: s.name, type: 'attraction', city: (cities.get(s.cityId) || {}).name || '' }));
      },
      destinationOptions() {
        const used = new Set(tours.flatMap(t => t.cityIds));
        return [...cities.values()].filter(c => used.has(c.id)).map(c => ({ key: c.id, label: c.name, type: 'destination' }));
      }
    };
  }

  const defaultFetch = async (url, signal) => {
    const res = await fetch(url, { signal, credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    return res.text();
  };
  const defaultParse = html => new DOMParser().parseFromString(html, 'text/html');

  async function load(options) {
    const o = options || {};
    const sources = o.sources || DEFAULT_SOURCES;
    const fetchText = o.fetchText || defaultFetch;
    const parseHTML = o.parseHTML || defaultParse;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), o.timeoutMs || 10000);
    try {
      const [assistantHtml, ...listingHtml] = await Promise.all([sources.assistant, ...sources.listings].map(u => fetchText(u, ctl && ctl.signal)));
      const catalog = build(parseHTML(assistantHtml), listingHtml.map(parseHTML));
      if (!catalog.tours.length) throw new Error('No tours found in ' + sources.assistant);
      return catalog;
    } finally { if (timer) clearTimeout(timer); }
  }

  T.catalog = { load, build, parsePrice, parseDuration, safeUrl, safeImage, DEFAULT_SOURCES };
  if (typeof module !== 'undefined' && module.exports) module.exports = T.catalog;
})(typeof globalThis !== 'undefined' ? globalThis : this);

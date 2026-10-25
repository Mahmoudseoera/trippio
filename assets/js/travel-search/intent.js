/* Travel search · intent.
   One intent shape is shared by every mode and every provider. extractLocal() is the offline,
   rule-based interpreter (Arabic + English). validateIntent() is the trust boundary: anything a
   remote model returns is reduced to whitelisted keys and bounded values before it can reach the
   matcher. Model output is never used as a query expression, id, link or price. */
(function (root) {
  'use strict';
  const T = (root.TrippioTravel = root.TrippioTravel || {});
  const L = () => T.lexicon;

  const CURRENCIES = ['USD', 'EUR', 'GBP', 'EGP'];
  const LEVELS = ['low', 'medium', 'high'];
  const MAX_QUERY = 500;
  // \b is ASCII-only in JavaScript and never matches around Arabic letters, so word edges are
  // written as « (start) and » (end) and expanded to Unicode-aware look-arounds.
  const rx = (src, flags) => new RegExp(src.replace(/«/g, '(?<![\\p{L}\\p{N}_])').replace(/»/g, '(?![\\p{L}\\p{N}_])'), (flags || '') + 'u');

  function emptyIntent(source) {
    return {
      query: '', destinations: [], attractions: [], activities: [], preferences: [],
      duration: null, budget: null, travellers: null, keywords: [], unrecognised: [], source: source || 'local-rules'
    };
  }

  const uniq = arr => [...new Set(arr)];
  const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 60);

  function numberFrom(token) {
    const { NUMBER_WORDS } = L();
    if (/^\d+$/.test(token)) return Number(token);
    return Object.prototype.hasOwnProperty.call(NUMBER_WORDS, token) ? NUMBER_WORDS[token] : null;
  }
  const NUM = '(\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|واحد|اتنين|اثنين|ثلاثه|تلاته|اربعه|اربع|خمسه|خمس|سته|ست|سبعه|سبع|ثمانيه|تمانيه|تسعه|عشره|عشر)';

  function parseDuration(t) {
    let m;
    if (rx('«يومين»').test(t)) return { value: 2, unit: 'days' };
    if (rx('«weekend»|«نهايه الاسبوع»').test(t)) return { value: 2, unit: 'days' };
    if (rx('«(?:a|one|1)\\s+week»|«اسبوع»').test(t)) return { value: 7, unit: 'days' };
    if (rx('«half\\s+day»|«نص يوم»|«نصف يوم»').test(t)) return { value: 0.5, unit: 'days' };
    m = rx('«' + NUM + '\\s*(?:-\\s*)?(?:days?|ايام|يوم)»').exec(t);
    if (m) { const v = numberFrom(m[1]); if (v) return { value: v, unit: 'days' }; }
    m = rx('«' + NUM + '\\s*(?:hours?|hrs?|ساعات|ساعه)»').exec(t);
    if (m) { const v = numberFrom(m[1]); if (v) return { value: v, unit: 'hours' }; }
    if (rx('«(?:one day|1 day|full day|يوم واحد)»').test(t)) return { value: 1, unit: 'days' };
    return null;
  }

  function parseBudget(t) {
    let amount = null, currency = null, level = null, m;
    m = /(\$|usd|€|eur|£|gbp|egp)\s?(\d[\d,]*)/.exec(t);
    if (m) { amount = Number(m[2].replace(/,/g, '')); currency = { $: 'USD', usd: 'USD', '€': 'EUR', eur: 'EUR', '£': 'GBP', gbp: 'GBP', egp: 'EGP' }[m[1]]; }
    if (amount == null) {
      m = /(\d[\d,]*)\s*(\$|usd|dollars?|دولار|euros?|eur|€|egp|جنيه|pounds?)/.exec(t);
      if (m) {
        amount = Number(m[1].replace(/,/g, ''));
        const u = m[2];
        currency = /\$|usd|dollar|دولار/.test(u) ? 'USD' : /eur|€/.test(u) ? 'EUR' : /egp|جنيه/.test(u) ? 'EGP' : 'GBP';
      }
    }
    const lvl = w => (/low|cheap|economy|affordable|limited|قليله|محدوده|اقتصادي|رخيص/.test(w) ? 'low' : /high|large|big|عاليه|كبيره/.test(w) ? 'high' : 'medium');
    m = rx('«(low|cheap|medium|mid|moderate|average|high|economy|affordable|limited)(?:\\s+range)?\\s+budget»').exec(t) ||
        rx('«budget\\s+(?:is\\s+)?(low|medium|moderate|high)»').exec(t) ||
        rx('«ميزانيه\\s+(متوسطه|عاليه|قليله|محدوده|كبيره|اقتصاديه)»').exec(t);
    if (m) level = lvl(m[1]);
    return amount != null || level ? { amount: amount != null && amount > 0 ? amount : null, currency: amount != null ? currency : null, level } : null;
  }

  function parseTravellers(t) {
    const out = { adults: null, children: [], childrenCount: null };
    let m = rx('«' + NUM + '\\s*(?:adults?|people|persons|guests|travell?ers|بالغين|اشخاص|افراد)»').exec(t);
    if (m) out.adults = numberFrom(m[1]);
    if (out.adults == null && rx('«couple»|«زوجين»').test(t)) out.adults = 2;
    m = rx('«' + NUM + '\\s*(?:children|kids|child|اطفال|اولاد)»').exec(t);
    if (m && numberFrom(m[1]) != null && numberFrom(m[1]) <= 12) out.childrenCount = numberFrom(m[1]);
    const idx = t.search(rx('«(?:children|kids|child|اطفال|طفل|اولاد|بنت|ولد)»'));
    if (idx !== -1) {
      const after = t.slice(idx).split(rx('«(?:we|with|for|days?|ايام|يوم|budget|ميزانيه|نحن)»'))[0];
      const ages = [...after.matchAll(/(?:^|\D)(\d{1,2})(?!\d)/g)].map(x => Number(x[1])).filter(n => n >= 0 && n <= 17);
      if (ages.length) { out.children = ages.slice(0, 8); if (out.childrenCount == null) out.childrenCount = ages.length; }
    }
    if (out.childrenCount == null && rx('«طفلين»').test(t)) out.childrenCount = 2;
    return out.adults != null || out.children.length || out.childrenCount != null ? out : null;
  }

  function extractLocal(query) {
    const lx = L();
    const intent = emptyIntent('local-rules');
    intent.query = clean(query, MAX_QUERY);
    const t = lx.norm(intent.query);
    if (!t) return intent;

    let step = lx.scan(t, lx.attractionAliases); intent.attractions = step.keys;
    step = lx.scan(step.rest, lx.placeAliases); intent.destinations = step.keys;
    const acts = lx.scan(step.rest, lx.activityAliases); intent.activities = acts.keys;
    // Felucca is both a landmark stop and an activity; keep both so either kind of evidence can match.
    if (lx.has(t, 'felucca') || lx.has(t, 'فلوكه')) intent.activities = uniq(intent.activities.concat('sailing'));
    const prefs = lx.scan(acts.rest, lx.preferenceAliases); intent.preferences = prefs.keys;
    intent.duration = parseDuration(t);
    intent.budget = parseBudget(t);
    intent.travellers = parseTravellers(t);
    if (intent.travellers && (intent.travellers.children.length || intent.travellers.childrenCount) && !intent.preferences.includes('family')) intent.preferences.push('family');
    intent.keywords = uniq(prefs.rest.split(' ').filter(w => w.length >= 3 && !/^\d+$/.test(w) && !lx.STOPWORDS.has(w) &&
      !/^(?:days?|day|week|weeks|hours?|budget|medium|children|kids|aged|ages|adults|people|ايام|يوم|اطفال|ميزانيه|متوسطه|عمر)$/u.test(w))).slice(0, 8);
    return intent;
  }

  // Keys a remote model may use directly; everything else is treated as free text.
  function knownKey(lx, key) {
    return !!(lx.PLACES[key] || key.startsWith('outside:') && lx.OTHER_PLACES[key.slice(8)] || lx.ATTRACTION_ALIASES[key] ||
      lx.EXTERNAL_ATTRACTIONS[key] || lx.ACTIVITIES[key] || lx.PREFERENCES[key]);
  }

  function validateIntent(raw, options) {
    const lx = L();
    const issues = [];
    const intent = emptyIntent((options && options.source) || 'ai');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { intent, issues: ['Intent was not an object'] };
    intent.query = clean((options && options.query) || raw.query, MAX_QUERY);

    const lists = [['destinations', lx.placeAliases], ['attractions', lx.attractionAliases], ['activities', lx.activityAliases], ['preferences', lx.preferenceAliases]];
    for (const [field, aliases] of lists) {
      const values = Array.isArray(raw[field]) ? raw[field].slice(0, 8) : [];
      if (raw[field] != null && !Array.isArray(raw[field])) issues.push(field + ' must be a list');
      for (const v of values) {
        if (typeof v !== 'string') { issues.push(field + ' contained a non-text value'); continue; }
        const key = clean(v, 60);
        if (knownKey(lx, key) && fieldAccepts(field, key)) { intent[field].push(key); continue; }
        const hit = lx.scan(lx.norm(key), aliases).keys.filter(k => fieldAccepts(field, k));
        if (hit.length) intent[field].push(...hit);
        else { intent.unrecognised.push(key); issues.push('Unrecognised ' + field + ' value ignored'); }
      }
      intent[field] = uniq(intent[field]);
    }
    const d = raw.duration;
    if (d && typeof d === 'object' && Number.isFinite(d.value) && d.value > 0 && d.value <= 60 && (d.unit === 'days' || d.unit === 'hours')) intent.duration = { value: d.value, unit: d.unit };
    else if (d != null) issues.push('Duration ignored');
    const b = raw.budget;
    if (b && typeof b === 'object') {
      const amount = Number.isFinite(b.amount) && b.amount > 0 && b.amount <= 1e7 ? b.amount : null;
      const currency = CURRENCIES.includes(b.currency) ? b.currency : null;
      const level = LEVELS.includes(b.level) ? b.level : null;
      if (amount != null && !currency) { issues.push('Budget amount without a valid currency ignored'); }
      else if (amount != null || level) intent.budget = { amount, currency: amount != null ? currency : null, level };
    } else if (b != null) issues.push('Budget ignored');
    const tr = raw.travellers;
    if (tr && typeof tr === 'object') {
      const adults = Number.isInteger(tr.adults) && tr.adults >= 1 && tr.adults <= 20 ? tr.adults : null;
      const children = Array.isArray(tr.children) ? tr.children.filter(n => Number.isInteger(n) && n >= 0 && n <= 17).slice(0, 8) : [];
      const childrenCount = Number.isInteger(tr.childrenCount) && tr.childrenCount >= 0 && tr.childrenCount <= 12 ? tr.childrenCount : (children.length || null);
      if (adults != null || children.length || childrenCount) intent.travellers = { adults, children, childrenCount };
    }
    if (Array.isArray(raw.keywords)) intent.keywords = uniq(raw.keywords.filter(k => typeof k === 'string' && !/[./\\:<>]/.test(k)).map(k => lx.norm(clean(k, 40))).filter(k => k.length >= 3)).slice(0, 8);
    return { intent, issues };
  }
  function fieldAccepts(field, key) {
    if (field === 'destinations') return !!(L().PLACES[key] || key.startsWith('outside:'));
    if (field === 'attractions') return !!(L().ATTRACTION_ALIASES[key] || key.startsWith('ext:'));
    if (field === 'activities') return !!L().ACTIVITIES[key];
    return !!L().PREFERENCES[key];
  }

  function mergeIntents(a, b) {
    const out = emptyIntent(b.source || a.source);
    out.query = clean([a.query, b.query].filter(Boolean).join(' · '), MAX_QUERY);
    for (const f of ['destinations', 'attractions', 'activities', 'preferences', 'keywords', 'unrecognised']) out[f] = uniq((a[f] || []).concat(b[f] || []));
    out.duration = b.duration || a.duration; out.budget = b.budget || a.budget; out.travellers = b.travellers || a.travellers;
    return out;
  }

  // Human-readable "what we understood" rows. Only things actually extracted appear.
  function summarize(intent, catalog) {
    const lx = L();
    const city = k => (catalog && catalog.cities.get(k) ? catalog.cities.get(k).name : lx.labelFor(k));
    const stop = k => (catalog && catalog.stops.get(k) ? catalog.stops.get(k).name : lx.labelFor(k));
    const rows = [];
    if (intent.destinations.length) rows.push({ label: 'Destination', value: intent.destinations.map(city).join(', ') });
    if (intent.attractions.length) rows.push({ label: 'Places', value: intent.attractions.map(stop).join(', ') });
    if (intent.activities.length) rows.push({ label: 'Interests', value: intent.activities.map(lx.labelFor).join(', ') });
    if (intent.preferences.length) rows.push({ label: 'Preferences', value: intent.preferences.map(lx.labelFor).join(', ') });
    if (intent.duration) rows.push({ label: 'Length', value: intent.duration.value + ' ' + (intent.duration.value === 1 ? intent.duration.unit.slice(0, -1) : intent.duration.unit) });
    if (intent.travellers) {
      const parts = [];
      if (intent.travellers.adults) parts.push(intent.travellers.adults + ' adults');
      if (intent.travellers.children.length) parts.push('children aged ' + intent.travellers.children.join(' and '));
      else if (intent.travellers.childrenCount) parts.push(intent.travellers.childrenCount + ' children');
      rows.push({ label: 'Travellers', value: parts.join(', ') });
    }
    if (intent.budget) rows.push({ label: 'Budget', value: intent.budget.amount ? intent.budget.amount + ' ' + intent.budget.currency : intent.budget.level + ' (no amount given)' });
    return rows;
  }

  T.intent = { emptyIntent, extractLocal, validateIntent, mergeIntents, summarize, parseDuration, parseBudget, parseTravellers, MAX_QUERY };
  if (typeof module !== 'undefined' && module.exports) module.exports = T.intent;
})(typeof globalThis !== 'undefined' ? globalThis : this);

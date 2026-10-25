/* Travel search · interface.
   Renders the three modes (Find Tours, Build My Trip, Search by Image) into [data-travel-search]
   and wires them to the shared pipeline: provider -> validated intent -> matcher/planner -> render.
   Nothing here decides what a tour is or costs; every card is drawn from a catalog record. */
(function (root) {
  'use strict';
  const T = (root.TrippioTravel = root.TrippioTravel || {});

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d, extra) => '<svg class="ts-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
  const ICON = {
    find: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
    plan: svg('<path d="M4 6h10M4 12h16M4 18h12"/><circle cx="18" cy="6" r="2"/>'),
    image: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="1.8"/><path d="m21 16-5-5-8 8"/>'),
    check: svg('<path d="m5 12.5 4.2 4.2L19 7"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pin: svg('<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
    upload: svg('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    alert: svg('<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v5M12 18h.01"/>')
  };

  const MODES = {
    find: {
      label: 'Find Tours', icon: ICON.find, submit: 'Find tours',
      blurb: 'Say what you want in plain words. We match it to the tours we actually run.',
      placeholder: 'e.g. a quiet beach holiday for a honeymoon, or رحلة تاريخية في القاهرة',
      examples: ['عايز رحلة بحر في إسكندرية لمدة يومين', 'Find a quiet beach holiday suitable for a honeymoon', 'عايز رحلة تاريخية في القاهرة تشمل قلعة صلاح الدين', 'Karnak and the Valley of the Kings']
    },
    plan: {
      label: 'Build My Trip', icon: ICON.plan, submit: 'Build my trip',
      blurb: 'Tell us who is travelling, for how long and what you enjoy. We lay out the days using real tours.',
      placeholder: 'e.g. family with children aged 5 and 8, four days in Sharm El Sheikh, medium budget, beach activities',
      examples: ['Family with children aged 5 and 8, four days in Sharm El Sheikh, medium budget, beach activities', 'Three days in Luxor with temples', 'Two days in Aswan and Luxor, under $300']
    },
    image: {
      label: 'Search by Image', icon: ICON.image, submit: 'Search with this image',
      blurb: 'Add a photo of a place you like. We look for tours that really visit it.',
      placeholder: 'Optional: add details, e.g. "and include other historical sites"',
      examples: ['Find a tour that visits this place and includes other historical sites', 'Something like this, but with a beach']
    }
  };

  const EXPERIENCE_OPTIONS = ['beach', 'diving', 'sailing', 'cruise', 'historical'];
  const money = p => (p ? p.display : null);
  const emit = (name, detail) => { try { root.document.dispatchEvent(new root.CustomEvent('trippio:analytics', { detail: { event: name, ...detail } })); } catch (_) { /* analytics optional */ } };

  function mount(host, options) {
    const o = options || {};
    const doc = host.ownerDocument;
    const provider = o.provider || T.providers.select(o.config);
    const state = { mode: 'find', text: '', file: null, previewUrl: null, busy: false, token: 0, ctl: null, catalog: null, catalogPromise: null, last: null, picks: new Set(), fileError: '' };
    let uid = 0;
    const id = n => 'ts-' + n;

    host.innerHTML = shell();
    const $ = sel => host.querySelector(sel);
    const els = { form: $('.ts-form'), input: $('#ts-input'), status: $('#ts-status'), results: $('#ts-results'), submit: $('.ts-submit'), examples: $('.ts-examples'),
      blurb: $('.ts-blurb'), drop: $('.ts-drop'), file: $('#ts-file'), tabs: [...host.querySelectorAll('[role=tab]')] };

    function shell() {
      const tabs = Object.entries(MODES).map(([key, m], i) => '<button type="button" role="tab" class="ts-tab" id="ts-tab-' + key + '" data-mode="' + key + '" aria-selected="' + (i === 0) + '" aria-controls="ts-panel" tabindex="' + (i === 0 ? 0 : -1) + '"><span class="ts-tab__icon">' + m.icon + '</span><span class="ts-tab__label">' + esc(m.label) + '</span></button>').join('');
      return '<div class="ts-wrap"><header class="ts-head"><h2 class="ts-title" id="ts-title">Plan your Egypt trip your way</h2>' +
        '<p class="ts-lede">Results come only from tours in our catalog. AI helps us understand you; it never makes up a tour, a price or a link.</p></header>' +
        '<div class="ts-desk"><div class="ts-tabs" role="tablist" aria-label="How would you like to search?">' + tabs + '</div>' +
        '<form class="ts-form" id="ts-panel" role="tabpanel" aria-labelledby="ts-tab-find" novalidate>' +
        '<p class="ts-blurb" aria-live="polite"></p>' +
        '<div class="ts-drop" hidden><input type="file" id="ts-file" accept="image/jpeg,image/png,image/webp" class="ts-file">' +
        '<div class="ts-drop__empty"><span class="ts-drop__icon">' + ICON.upload + '</span><span><label for="ts-file" class="ts-drop__label">Choose a photo</label> or drop it here</span><small>JPEG, PNG or WebP, up to 5 MB. Your photo is not stored.</small></div>' +
        '<div class="ts-drop__preview" hidden><img alt="Your uploaded photo" width="96" height="96"><div><strong class="ts-drop__name"></strong><div class="ts-drop__actions"><label for="ts-file" class="ts-link">Replace</label><button type="button" class="ts-link" data-remove-image>Remove</button></div></div></div>' +
        '<p class="ts-drop__error" role="alert" hidden></p></div>' +
        '<label class="ts-sr" for="ts-input">Describe what you are looking for</label>' +
        '<div class="ts-field"><textarea id="ts-input" rows="2" maxlength="500" dir="auto" autocomplete="off" spellcheck="false"></textarea>' +
        '<button type="submit" class="ts-submit"></button></div>' +
        '<div class="ts-examples" role="group" aria-label="Example searches"></div>' +
        '<p class="ts-status" id="ts-status" role="status" aria-live="polite"></p></form></div>' +
        '<div class="ts-results" id="ts-results" tabindex="-1"></div></div>';
    }

    // ---------- Mode, form state ----------
    function setMode(mode, focus) {
      if (!MODES[mode] || state.busy && mode !== state.mode) { if (state.busy) cancel(); }
      if (!MODES[mode]) return;
      state.mode = mode;
      els.tabs.forEach(t => { const on = t.dataset.mode === mode; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      els.form.setAttribute('aria-labelledby', 'ts-tab-' + mode);
      els.blurb.textContent = MODES[mode].blurb;
      els.input.placeholder = MODES[mode].placeholder;
      els.submit.innerHTML = MODES[mode].icon + '<span>' + esc(MODES[mode].submit) + '</span>';
      els.drop.hidden = mode !== 'image';
      els.examples.innerHTML = MODES[mode].examples.map(ex => '<button type="button" class="ts-chip" data-example="' + esc(ex) + '"><bdi>' + esc(ex) + '</bdi></button>').join('');
      els.input.value = state.text;           // the typed text is kept when switching modes
      els.results.innerHTML = '';             // switching never submits anything
      setStatus('');
      if (focus) els.tabs.find(t => t.dataset.mode === mode).focus();
    }
    function setStatus(msg) { els.status.textContent = msg || ''; }

    // ---------- Request lifecycle ----------
    function begin() {
      if (state.ctl) state.ctl.abort();
      state.ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      state.busy = true; state.token++;
      els.form.setAttribute('aria-busy', 'true'); els.submit.disabled = true;
      return { token: state.token, signal: state.ctl && state.ctl.signal };
    }
    function finish(token) {
      if (token !== state.token) return false;
      state.busy = false; state.ctl = null;
      els.form.removeAttribute('aria-busy'); els.submit.disabled = false;
      return true;
    }
    function cancel() {
      if (!state.busy) return;
      if (state.ctl) state.ctl.abort();
      state.token++; state.busy = false; state.ctl = null;
      els.form.removeAttribute('aria-busy'); els.submit.disabled = false;
      els.results.innerHTML = ''; setStatus('Search cancelled.');
    }
    function loading(message) {
      setStatus(message);
      els.results.innerHTML = '<div class="ts-loading" aria-hidden="true">' + [0, 1, 2].map(() => '<div class="ts-skeleton"></div>').join('') + '</div>' +
        '<p class="ts-loading__bar"><button type="button" class="ts-link" data-cancel>Cancel</button></p>';
    }
    function ensureCatalog() {
      if (state.catalog) return Promise.resolve(state.catalog);
      if (!state.catalogPromise) state.catalogPromise = (o.loadCatalog ? o.loadCatalog() : T.catalog.load(o.catalogOptions)).then(c => (state.catalog = c), err => { state.catalogPromise = null; throw err; });
      return state.catalogPromise;
    }
    const isAbort = (err, token) => token !== state.token || (err && (err.name === 'AbortError' || /aborted/i.test(String(err.message))));

    async function run(extra) {
      const text = state.text.trim();
      const mode = state.mode;
      if (mode !== 'image' && text.length < 2) { setStatus('Type what you are looking for first.'); els.input.focus(); return; }
      if (mode === 'image' && !state.file) { setStatus('Add a photo first.'); els.file.focus(); return; }
      state.last = { mode, text, extra: extra || null };
      const { token, signal } = begin();
      emit('travel_search_submitted', { mode });
      try {
        loading(mode === 'plan' ? 'Building your plan from our tours…' : mode === 'image' ? 'Looking at your photo…' : 'Searching our tours…');
        const catalog = await ensureCatalog();
        if (token !== state.token) return;
        if (mode === 'find') await runFind(catalog, text, token, signal, extra);
        else if (mode === 'plan') await runPlan(catalog, text, token, signal, extra);
        else await runImage(catalog, text, token, signal, extra);
      } catch (err) {
        if (isAbort(err, token)) return;
        showError(err);
      } finally { finish(token); }
    }

    async function interpret(text, signal) {
      const out = await provider.understand({ query: text, signal });
      return out;
    }

    async function runFind(catalog, text, token, signal, extra) {
      const { intent, degraded } = await interpret(text, signal);
      if (token !== state.token) return;
      const found = T.matcher.search(catalog, intent, { ignoreDestination: !!(extra && extra.ignoreDestination) });
      renderFind(catalog, intent, found, { degraded, ignored: !!(extra && extra.ignoreDestination) });
      emit('travel_search_results', { mode: 'find', count: found.results.length });
    }

    async function runPlan(catalog, text, token, signal, extra) {
      const { intent, degraded } = await interpret(text, signal);
      if (token !== state.token) return;
      const ask = T.planner.needsClarification(intent);
      if (ask) { finish(token); renderClarify(ask); return; }
      const exclude = (extra && extra.exclude) || [];
      const proposal = await provider.propose({ intent, catalog, excludeTourIds: exclude, signal });
      if (token !== state.token) return;
      const plan = T.planner.assemble(catalog, intent, proposal.skeleton, { excludeTourIds: exclude });
      state.lastPlan = plan;
      renderPlan(catalog, intent, plan, { degraded: degraded || proposal.degraded });
      emit('travel_plan_results', { products: plan.productCount, openDays: plan.openDays });
    }

    async function runImage(catalog, text, token, signal, extra) {
      if (extra && extra.confirmed) { // user picked what the photo shows (or confirmed an AI candidate)
        const base = T.intent.emptyIntent('user-confirmed');
        for (const k of extra.confirmed) {
          if (catalog.stops.has(k)) base.attractions.push(k);
          else if (catalog.cities.has(k)) base.destinations.push(k);
          else if (T.lexicon.ACTIVITIES[k]) base.activities.push(k);
        }
        let intent = base;
        if (text) intent = T.intent.mergeIntents((await interpret(text, signal)).intent, base);
        if (token !== state.token) return;
        const found = T.matcher.search(catalog, intent, { skipNearby: false });
        renderImageResults(catalog, intent, found, extra.confirmed, extra.certainty || 'confirmed');
        return;
      }
      const check = await T.image.validateFile(state.file);
      if (!check.ok) { setFileError(check.error); finish(token); els.results.innerHTML = ''; setStatus(''); return; }
      let analysis;
      try { analysis = await provider.analyzeImage({ file: state.file, query: text, signal }); }
      catch (err) { if (isAbort(err, token)) return; analysis = { status: 'error', candidates: [], reason: T.providers.friendly(err) }; }
      if (token !== state.token) return;
      if (analysis.status === 'ok' && analysis.candidates.length) return renderCandidates(catalog, text, analysis.candidates);
      renderPicker(catalog, text, analysis);
    }

    // ---------- Rendering ----------
    function focusResults() { els.results.focus({ preventScroll: false }); }

    function understood(catalog, intent, extraNotes) {
      const rows = T.intent.summarize(intent, catalog);
      if (!rows.length) return '';
      return '<section class="ts-understood" aria-label="What we understood"><h3 class="ts-h3">What we understood</h3><dl class="ts-facts">' +
        rows.map(r => '<div><dt>' + esc(r.label) + '</dt><dd><bdi>' + esc(r.value) + '</bdi></dd></div>').join('') + '</dl>' +
        (intent.source === 'local-rules' ? '' : '<p class="ts-muted">' + (intent.source === 'user-confirmed' ? 'Based on what you picked.' : 'Interpreted by AI; matches below are checked against our catalog.') + '</p>') + '</section>';
    }
    const noteList = (items, cls) => items && items.length ? '<ul class="' + (cls || 'ts-notes') + '">' + items.map(n => '<li>' + ICON.info + '<span>' + esc(n) + '</span></li>').join('') + '</ul>' : '';
    const degradedNote = d => (d ? '<p class="ts-banner ts-banner--warn" role="status">' + ICON.alert + '<span>' + esc(d.message) + ' We used our built-in matching instead, so results still come from our real tours.</span></p>' : '');

    function priceHtml(product) {
      if (product.price) return '<div class="ts-price"><span>From</span><strong>' + esc(money(product.price)) + '</strong><span>per person</span></div>';
      return '<div class="ts-price ts-price--none"><strong>Price on request</strong><span>' + (product.conflicts.includes('price') ? 'Listings disagree. The travel team will confirm.' : 'Not published yet') + '</span></div>';
    }
    function card(product, match, opts) {
      const q = opts || {};
      const reasons = (match.reasons || []).slice(0, 4).map(r => '<li>' + ICON.check + '<span>' + esc(r.text) + '</span></li>').join('');
      const limits = (match.limitations || []).concat((match.unverified || []).map(u => 'Not verified in the catalog: ' + u + '.')).map(l => '<li>' + ICON.info + '<span>' + esc(l) + '</span></li>').join('');
      return '<article class="ts-card' + (q.compact ? ' ts-card--compact' : '') + '" data-tour="' + esc(product.id) + '">' +
        '<a class="ts-card__media" href="' + esc(product.detailUrl) + '">' + (product.image ? '<img src="' + esc(product.image) + '" alt="' + esc(product.imageAlt || product.title) + '" width="420" height="300" loading="lazy" decoding="async">' : '<span class="ts-card__noimg">' + ICON.image + '</span>') + '</a>' +
        '<div class="ts-card__body">' +
        (match.levelLabel ? '<span class="ts-badge ts-badge--' + esc(match.level) + '">' + esc(match.levelLabel) + '</span>' : '') +
        '<h4 class="ts-card__title"><a href="' + esc(product.detailUrl) + '">' + esc(product.title) + '</a></h4>' +
        '<p class="ts-meta">' + (product.duration ? '<span>' + ICON.clock + esc(product.duration) + '</span>' : '<span>' + ICON.clock + 'Duration not published</span>') + '<span>' + ICON.pin + esc(product.destination) + '</span>' + (product.rating ? '<span class="ts-rating">★ ' + esc(product.rating) + '</span>' : '') + '</p>' +
        (q.compact || !product.description ? '' : '<p class="ts-card__desc">' + esc(product.description) + '</p>') +
        (reasons ? '<ul class="ts-reasons" aria-label="Why this tour">' + reasons + '</ul>' : '') +
        (limits ? '<ul class="ts-limits" aria-label="Things to know">' + limits + '</ul>' : '') +
        '<div class="ts-card__foot">' + priceHtml(product) + '<div class="ts-card__actions"><a class="ts-btn ts-btn--ghost" href="' + esc(product.detailUrl) + '">View tour</a><a class="ts-btn" href="' + esc(product.enquiryUrl) + '" data-enquire="' + esc(product.id) + '">Enquire</a></div></div>' +
        '</div></article>';
    }

    function emptyState(title, body, actions) {
      return '<div class="ts-empty" role="status"><span class="ts-empty__icon">' + ICON.find + '</span><h3 class="ts-h3" tabindex="-1">' + esc(title) + '</h3>' + (body ? '<p>' + esc(body) + '</p>' : '') + '<div class="ts-empty__actions">' + (actions || '') + '</div></div>';
    }
    const quoteLink = label => '<a class="ts-btn" href="' + esc(T.planner.QUOTE_URL) + '">' + esc(label || 'Request a tailor-made trip') + '</a>';
    const editBtn = '<button type="button" class="ts-btn ts-btn--ghost" data-edit>Edit my search</button>';

    function unmetHtml(unmet) {
      const parts = [];
      if (unmet.destinations.length) parts.push('We don\'t have tours in ' + unmet.destinations.join(' or ') + ' yet.');
      if (unmet.attractions.length) parts.push('No tour in our catalog includes ' + unmet.attractions.join(' or ') + '.');
      return parts.length ? '<p class="ts-banner" role="status">' + ICON.info + '<span>' + esc(parts.join(' ')) + '</span></p>' : '';
    }

    function renderFind(catalog, intent, found, ctx) {
      const matches = found.results.map(r => ({ r, p: catalog.toPublic(catalog.tour(r.tourId)) }));
      let html = degradedNote(ctx.degraded) + understood(catalog, intent) + unmetHtml(found.unmet) + noteList(found.notes);
      if (ctx.ignored) html += '<p class="ts-banner" role="status">' + ICON.info + '<span>Showing matching tours elsewhere in Egypt. None of them are in the place you named.</span></p>';
      if (matches.length) {
        html += '<h3 class="ts-h3 ts-count" tabindex="-1">' + matches.length + (matches.length === 1 ? ' tour matches' : ' tours match') + '</h3><div class="ts-grid">' + matches.map(m => card(m.p, m.r)).join('') + '</div>';
      } else {
        const fall = found.fallbackAvailable ? '<button type="button" class="ts-btn" data-ignore-destination>Show similar tours elsewhere</button>' : '';
        html += emptyState('No tour matches that yet', 'We would rather say so than show you something that doesn\'t fit. Try a different place, or ask us to build it for you.', fall + editBtn + quoteLink());
        if (found.nearby.length) {
          html += '<h3 class="ts-h3">Closest places we do cover</h3><div class="ts-grid">' + found.nearby.map(n => card(catalog.toPublic(catalog.tour(n.tourId)), n)).join('') + '</div>';
        }
      }
      els.results.innerHTML = html; setStatus(matches.length ? matches.length + ' matching tours found.' : 'No matching tours found.'); focusResults();
    }

    function renderClarify(ask) {
      els.results.innerHTML = emptyState(ask.question, 'A place or a length is enough to start.', ask.examples.map(e => '<button type="button" class="ts-chip" data-example="' + esc(e) + '"><bdi>' + esc(e) + '</bdi></button>').join(''));
      setStatus(ask.question); focusResults();
    }

    function renderPlan(catalog, intent, plan, ctx) {
      const dayHtml = plan.days.map(d => '<li class="ts-day"><div class="ts-day__head"><span class="ts-day__n">Day ' + d.day + '</span>' + (d.headline ? '<span class="ts-day__where">' + esc(d.headline) + '</span>' : '') + '</div><div class="ts-day__items">' +
        d.items.map(it => {
          if (it.type === 'product') return card(it.product, { reasons: it.why, limitations: it.limitations.concat(it.spansDays > 1 ? ['This tour covers ' + it.spansDays + ' days.'] : []), unverified: it.unverified, levelLabel: 'In our catalog', level: 'catalog' }, { compact: true }) +
            '<p class="ts-confirm">' + ICON.info + '<span>Availability' + (it.confirm.includes('price') ? ' and price are' : ' is') + ' confirmed by the travel team.</span></p>';
          if (it.type === 'continued') return '<p class="ts-continued">' + ICON.clock + '<span>Day ' + it.part + ' of ' + it.of + ': <bdi>' + esc(it.title) + '</bdi></span></p>';
          return '<div class="ts-proposed"><span class="ts-badge ts-badge--proposed">Suggestion, not bookable</span><strong>' + esc(it.title) + '</strong>' + (it.why ? '<p>' + esc(it.why) + '</p>' : '') + '</div>';
        }).join('') + '</div></li>').join('');
      const pr = plan.pricing;
      const priceBox = '<aside class="ts-total" aria-label="Price summary"><h3 class="ts-h3">Price summary</h3>' +
        (pr.perPersonFrom != null ? '<p class="ts-total__amount"><span>From</span><strong>' + esc(pr.perPersonFrom) + ' ' + esc(pr.currency) + '</strong><span>per person, listed prices only</span></p>' : '<p class="ts-total__amount ts-total__amount--none"><strong>No total yet</strong></p>') +
        '<p class="ts-muted">' + esc(pr.note) + '</p>' + (plan.budget.note ? '<p class="ts-budget ts-budget--' + esc(plan.budget.status) + '">' + esc(plan.budget.note) + '</p>' : '') + '</aside>';
      const alts = plan.alternatives.length ? '<h3 class="ts-h3">Closest tours we do have</h3><p class="ts-muted">These are not in the place you asked for and are not part of the plan above.</p><div class="ts-grid">' + plan.alternatives.map(a => card(a.product, { reasons: a.why, limitations: a.limitations, level: 'nearby', levelLabel: a.levelLabel }, { compact: true })).join('') + '</div>' : '';
      const another = plan.productCount ? '<button type="button" class="ts-btn ts-btn--ghost" data-another>Show another plan</button>' : '';
      els.results.innerHTML = degradedNote(ctx.degraded) + understood(catalog, intent) +
        '<h3 class="ts-h3 ts-count" tabindex="-1">Your proposed ' + plan.total + '-day plan</h3>' +
        '<p class="ts-banner ts-banner--soft" role="note">' + ICON.info + '<span>This is a proposal. Only tours marked <em>In our catalog</em> can be enquired about. Dates, availability and final prices are confirmed by the travel team.</span></p>' +
        noteList(plan.assumptions.map(a => 'Assumption: ' + a)) + unmetHtml(plan.unmet) +
        '<div class="ts-plan"><ol class="ts-days">' + dayHtml + '</ol>' + priceBox + '</div>' + noteList(plan.limitations) + alts +
        '<div class="ts-plan__actions">' + (plan.openDays || plan.unmet.destinations.length || plan.unmet.attractions.length ? quoteLink('Ask for a tailor-made quote') : '<a class="ts-btn ts-btn--ghost" href="' + esc(T.planner.QUOTE_URL) + '">Request a tailor-made quote</a>') + '<button type="button" class="ts-btn ts-btn--ghost" data-edit>Refine my request</button>' + another + '</div>';
      setStatus('Plan ready: ' + plan.productCount + (plan.productCount === 1 ? ' tour' : ' tours') + ' in ' + plan.total + ' days.'); focusResults();
    }

    function optionGroup(title, options, name) {
      return '<fieldset class="ts-pick"><legend>' + esc(title) + '</legend><div class="ts-pick__list">' + options.map(opt => '<button type="button" class="ts-chip ts-chip--pick" data-pick="' + esc(opt.key) + '" aria-pressed="' + state.picks.has(opt.key) + '">' + esc(opt.label) + (opt.city ? '<small>' + esc(opt.city) + '</small>' : '') + '</button>').join('') + '</div></fieldset>';
    }
    function renderPicker(catalog, text, analysis) {
      const why = analysis.status === 'error' ? analysis.reason + ' ' : (analysis.reason || '') + ' ';
      const exp = EXPERIENCE_OPTIONS.map(k => ({ key: k, label: T.lexicon.ACTIVITIES[k].label.replace(/^./, c => c.toUpperCase()) }));
      els.results.innerHTML = '<section class="ts-picker"><p class="ts-banner" role="status">' + ICON.info + '<span>' + esc(why.trim()) + ' Tell us what the photo shows and we\'ll find tours that match. We never guess a place from a photo here.</span></p>' +
        '<h3 class="ts-h3 ts-count" tabindex="-1">What does your photo show?</h3>' +
        optionGroup('Landmarks and places', catalog.placeOptions()) + optionGroup('Destinations', catalog.destinationOptions()) + optionGroup('Experiences', exp) +
        '<div class="ts-plan__actions"><button type="button" class="ts-btn" data-confirm-picks' + (state.picks.size ? '' : ' disabled') + '>Find tours for my choice</button></div></section>';
      setStatus('Choose what your photo shows.'); focusResults();
    }
    function certainty(c) { return c >= 0.75 ? 'Likely' : c >= 0.4 ? 'Possible' : 'Uncertain'; }
    function renderCandidates(catalog, text, candidates) {
      const mapped = T.providers.candidatesToIntent(candidates, catalog).interpreted;
      els.results.innerHTML = '<section class="ts-picker"><h3 class="ts-h3 ts-count" tabindex="-1">What we think your photo shows</h3><p class="ts-muted">These are predictions, not facts. Confirm the one that fits, or search more broadly.</p><ul class="ts-candidates">' +
        candidates.map((c, i) => '<li><div><strong><bdi>' + esc(c.label) + '</bdi></strong><span class="ts-badge ts-badge--' + (c.confidence >= 0.75 ? 'attraction' : 'broad') + '">' + certainty(c.confidence) + '</span></div><div class="ts-card__actions"><button type="button" class="ts-btn" data-candidate="' + i + '">Yes, find tours</button><button type="button" class="ts-btn ts-btn--ghost" data-candidate-broad="' + i + '">Search more broadly</button></div></li>').join('') +
        '</ul><p class="ts-muted"><button type="button" class="ts-link" data-manual>None of these. Pick it myself.</button></p></section>';
      state.candidates = { list: candidates, mapped };
      setStatus('We have ' + candidates.length + ' possible match' + (candidates.length > 1 ? 'es' : '') + '. Please confirm one.'); focusResults();
    }
    function renderImageResults(catalog, intent, found, confirmed, how) {
      const labels = confirmed.map(k => (catalog.stops.get(k) || catalog.cities.get(k) || { name: T.lexicon.labelFor(k) }).name || T.lexicon.labelFor(k));
      const exact = found.results.filter(r => r.level === 'attraction'), other = found.results.filter(r => r.level !== 'attraction');
      const grid = list => '<div class="ts-grid">' + list.map(r => card(catalog.toPublic(catalog.tour(r.tourId)), r)).join('') + '</div>';
      let html = understood(catalog, intent) + noteList(found.notes);
      html += '<p class="ts-banner ts-banner--soft" role="note">' + ICON.info + '<span>' + (how === 'broad' ? 'Broader search' : 'Chosen by you') + ': <bdi>' + esc(labels.join(', ')) + '</bdi>. Tour images below are from our catalog, not your photo.</span></p>';
      if (exact.length) html += '<h3 class="ts-h3 ts-count" tabindex="-1">Tours that visit it (' + exact.length + ')</h3>' + grid(exact);
      if (other.length) html += '<h3 class="ts-h3' + (exact.length ? '' : ' ts-count') + '"' + (exact.length ? '' : ' tabindex="-1"') + '>' + (exact.length ? 'Related tours' : 'No tour visits it directly. Related tours') + '</h3><p class="ts-muted">These do not list the exact place in their itinerary.</p>' + grid(other);
      if (!found.results.length) html += emptyState('No tour matches that yet', 'We don\'t have a tour that visits or relates to this place.', '<button type="button" class="ts-btn ts-btn--ghost" data-manual>Pick something else</button>' + quoteLink());
      els.results.innerHTML = html; setStatus(found.results.length ? found.results.length + ' tours found.' : 'No matching tours found.'); focusResults();
    }

    function showError(err) {
      const offline = state.catalogPromise === null && !state.catalog;
      els.results.innerHTML = '<div class="ts-empty ts-empty--error" role="alert"><span class="ts-empty__icon">' + ICON.alert + '</span><h3 class="ts-h3" tabindex="-1">' + (offline ? 'We couldn\'t load our tours' : 'That didn\'t work') + '</h3><p>' +
        esc(offline ? 'The tour list could not be read. Check your connection, and open this page from the website rather than as a saved file.' : (T.providers.friendly(err) || 'Please try again.')) + '</p><div class="ts-empty__actions"><button type="button" class="ts-btn" data-retry>Try again</button>' + editBtn + '</div></div>';
      setStatus('Something went wrong. You can try again.'); focusResults();
    }

    // ---------- Image selection ----------
    function setFileError(msg) {
      state.fileError = msg || '';
      const p = els.drop.querySelector('.ts-drop__error'); p.textContent = state.fileError; p.hidden = !msg;
    }
    function clearImage() {
      if (state.previewUrl && root.URL && root.URL.revokeObjectURL) root.URL.revokeObjectURL(state.previewUrl);
      state.file = null; state.previewUrl = null; els.file.value = '';
      els.drop.querySelector('.ts-drop__preview').hidden = true; els.drop.querySelector('.ts-drop__empty').hidden = false;
    }
    async function takeFile(file) {
      setFileError('');
      const check = await T.image.validateFile(file);
      if (!check.ok) { clearImage(); setFileError(check.error); return; }
      clearImage();
      state.file = file;
      const img = els.drop.querySelector('.ts-drop__preview img');
      if (root.URL && root.URL.createObjectURL) { state.previewUrl = root.URL.createObjectURL(file); img.src = state.previewUrl; }
      els.drop.querySelector('.ts-drop__name').textContent = file.name || 'Your photo';
      els.drop.querySelector('.ts-drop__preview').hidden = false; els.drop.querySelector('.ts-drop__empty').hidden = true;
      els.results.innerHTML = ''; setStatus('Photo added. Choose "Search with this image" when you are ready.');
    }

    // ---------- Booking handoff (reuses the existing enquiry form prefill) ----------
    function saveDraft(tourId) {
      const tr = state.lastIntent && state.lastIntent.travellers;
      const draft = { tour: tourId, savedAt: Date.now(), message: ('From trip search: ' + (state.last ? state.last.text : '')).slice(0, 700) };
      if (tr && tr.adults) draft.adults = String(tr.adults);
      if (tr && (tr.childrenCount || tr.children.length)) draft.children = String(tr.childrenCount || tr.children.length);
      try { root.sessionStorage.setItem('trippio-assistant-booking', JSON.stringify(draft)); } catch (_) { /* the link still works without the draft */ }
    }

    // ---------- Events ----------
    host.addEventListener('click', e => {
      const t = e.target.closest('button, a');
      if (!t || !host.contains(t)) return;
      if (t.matches('[role=tab]')) return setMode(t.dataset.mode);
      if (t.dataset.example != null) { state.text = t.dataset.example; els.input.value = state.text; els.input.focus(); return; }
      if (t.matches('[data-cancel]')) return cancel();
      if (t.matches('[data-edit]')) { els.input.focus(); els.input.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (t.matches('[data-retry]')) return run(state.last && state.last.extra);
      if (t.matches('[data-ignore-destination]')) return run({ ignoreDestination: true });
      if (t.matches('[data-another]')) { const used = (state.lastPlan ? state.lastPlan.days.flatMap(d => d.items.filter(i => i.type === 'product').map(i => i.product.id)) : []); return run({ exclude: used.slice(0, 1) }); }
      if (t.matches('[data-remove-image]')) { clearImage(); els.results.innerHTML = ''; setStatus(''); return; }
      if (t.matches('[data-pick]')) { const k = t.dataset.pick; if (state.picks.has(k)) state.picks.delete(k); else state.picks.add(k); t.setAttribute('aria-pressed', String(state.picks.has(k))); const b = host.querySelector('[data-confirm-picks]'); if (b) b.disabled = !state.picks.size; return; }
      if (t.matches('[data-confirm-picks]')) return run({ confirmed: [...state.picks], certainty: 'confirmed' });
      if (t.matches('[data-manual]')) return runPickerAgain();
      if (t.dataset.candidate != null || t.dataset.candidateBroad != null) {
        const broad = t.dataset.candidateBroad != null; const i = Number(broad ? t.dataset.candidateBroad : t.dataset.candidate);
        const keys = (state.candidates && state.candidates.mapped[i] ? state.candidates.mapped[i].keys : []).filter(k => !broad || !state.catalog.stops.has(k));
        const fallback = broad && !keys.length ? [] : keys;
        if (!fallback.length) { setStatus('We can\'t match that to our tours. Pick it yourself instead.'); return runPickerAgain(); }
        return run({ confirmed: fallback, certainty: broad ? 'broad' : 'confirmed' });
      }
      if (t.matches('[data-enquire]')) saveDraft(t.dataset.enquire);
    });
    function runPickerAgain() { ensureCatalog().then(c => renderPicker(c, state.text, { status: 'manual', reason: '' })); }

    els.tabs.forEach(tab => tab.addEventListener('keydown', e => {
      const keys = Object.keys(MODES); let i = keys.indexOf(state.mode);
      if (e.key === 'ArrowRight') i = (i + 1) % keys.length; else if (e.key === 'ArrowLeft') i = (i - 1 + keys.length) % keys.length;
      else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = keys.length - 1; else return;
      e.preventDefault(); setMode(keys[i], true);
    }));
    els.input.addEventListener('input', () => { state.text = els.input.value; });
    els.input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); els.form.requestSubmit ? els.form.requestSubmit() : run(); } });
    els.form.addEventListener('submit', e => { e.preventDefault(); if (!state.busy) run(); });
    els.form.addEventListener('focusin', () => { ensureCatalog().catch(() => {}); }, { once: true });
    els.file.addEventListener('change', () => { if (els.file.files && els.file.files[0]) takeFile(els.file.files[0]); });
    ['dragenter', 'dragover'].forEach(n => els.drop.addEventListener(n, e => { e.preventDefault(); els.drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(n => els.drop.addEventListener(n, e => { e.preventDefault(); els.drop.classList.remove('is-over'); }));
    els.drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) takeFile(f); });
    // Track the interpreted intent so the enquiry draft can carry traveller counts.
    const origUnderstand = provider.understand.bind(provider);
    provider.understand = async a => { const out = await origUnderstand(a); state.lastIntent = out.intent; return out; };

    setMode('find');
    return { state, setMode, run, cancel, els, takeFile, ensureCatalog, setText(v) { state.text = v; els.input.value = v; } };
  }

  function autoMount() {
    const doc = root.document;
    if (!doc) return;
    doc.querySelectorAll('[data-travel-search]').forEach(host => { if (!host.dataset.tsMounted) { host.dataset.tsMounted = '1'; host.travelSearch = mount(host); } });
  }
  T.ui = { mount, autoMount, MODES, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = T.ui;
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', autoMount); else autoMount();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

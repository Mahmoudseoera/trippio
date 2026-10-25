/* Travel search · providers.
   The only module that knows where "understanding" comes from. Three operations:
     understand({ query })               -> { intent }          (text -> validated intent)
     propose({ intent, candidates })     -> { skeleton }        (day plan skeleton, ids only)
     analyzeImage({ file, query })       -> { status, candidates }
   The default provider is local and rule-based (no network, no key). When a backend exists,
   set window.TRIPPIO_TRAVEL_CONFIG = { apiBase: '/api' } and the remote provider is used with
   the local provider as a deterministic fallback. The Gemini key lives ONLY on that backend.
   Everything a provider returns is validated before use (intent.validateIntent, planner.assemble). */
(function (root) {
  'use strict';
  const T = (root.TrippioTravel = root.TrippioTravel || {});

  // ---------- Image checks (UI convenience; the backend must repeat them) ----------
  const IMAGE_TYPES = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  function sniffImageType(bytes) {
    const b = bytes;
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
    return null;
  }

  async function validateImageFile(file) {
    if (!file || typeof file.size !== 'number') return { ok: false, error: 'Choose an image file.' };
    if (file.size === 0) return { ok: false, error: 'That file is empty. Choose a different image.' };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'That image is larger than the 5 MB limit. Choose a smaller one.' };
    if (!IMAGE_TYPES[file.type]) return { ok: false, error: 'Use a JPEG, PNG or WebP image.' };
    try {
      const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const real = sniffImageType(head);
      if (!real || real !== IMAGE_TYPES[file.type]) return { ok: false, error: 'This file is not a valid ' + IMAGE_TYPES[file.type].toUpperCase() + ' image.' };
    } catch (_) { return { ok: false, error: 'This image could not be read. Try another file.' }; }
    return { ok: true };
  }

  // ---------- Errors ----------
  class ProviderError extends Error {
    constructor(code, message) { super(message); this.name = 'ProviderError'; this.code = code; }
  }
  const FRIENDLY = {
    timeout: 'The AI service took too long to answer.',
    rate_limited: 'The AI service is busy right now.',
    quota: 'The AI service has reached its usage limit.',
    network: 'The AI service could not be reached.',
    bad_response: 'The AI service sent an answer we could not use.',
    server: 'The AI service had a problem.',
    unavailable: 'AI is not connected in this preview.'
  };
  const friendly = err => (err && FRIENDLY[err.code]) || 'Something went wrong while contacting the AI service.';

  // ---------- Local, rule-based provider ----------
  const local = {
    id: 'local-rules',
    capabilities: { imageRecognition: false },
    async understand({ query }) { return { intent: T.intent.extractLocal(query) }; },
    async propose({ intent, catalog, excludeTourIds }) { return { skeleton: T.planner.proposeLocalSkeleton(catalog, intent, { excludeTourIds }) }; },
    async analyzeImage() {
      // Recognising a landmark needs a vision model, which needs a server-side key.
      return { status: 'unavailable', reason: FRIENDLY.unavailable, candidates: [] };
    }
  };

  // ---------- Remote provider (talks to YOUR backend; never holds a key) ----------
  function remote(config) {
    const base = String((config && config.apiBase) || '').replace(/\/$/, '');
    const timeoutMs = (config && config.timeoutMs) || 15000;
    const doFetch = (config && config.fetch) || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    const paths = Object.assign({ understand: '/travel-search', propose: '/travel-planner', image: '/travel-image-search' }, config && config.paths);

    async function call(path, init, signal) {
      if (!doFetch) throw new ProviderError('network', FRIENDLY.network);
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(new ProviderError('timeout', FRIENDLY.timeout)), timeoutMs);
      const onAbort = () => ctl.abort(signal.reason);
      if (signal) { if (signal.aborted) ctl.abort(signal.reason); else signal.addEventListener('abort', onAbort, { once: true }); }
      try {
        const res = await doFetch(base + path, { ...init, signal: ctl.signal, credentials: 'same-origin' });
        if (res.status === 429) throw new ProviderError('rate_limited', FRIENDLY.rate_limited);
        if (res.status === 402 || res.status === 403) throw new ProviderError('quota', FRIENDLY.quota);
        if (!res.ok) throw new ProviderError('server', FRIENDLY.server);
        let body;
        try { body = await res.json(); } catch (_) { throw new ProviderError('bad_response', FRIENDLY.bad_response); }
        if (!body || typeof body !== 'object') throw new ProviderError('bad_response', FRIENDLY.bad_response);
        return body;
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        if (ctl.signal.aborted && ctl.signal.reason instanceof ProviderError) throw ctl.signal.reason;
        if (signal && signal.aborted) throw err;
        throw new ProviderError('network', FRIENDLY.network);
      } finally { clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort); }
    }
    const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    return {
      id: 'remote',
      capabilities: { imageRecognition: true },
      async understand({ query, signal }) {
        const body = await call(paths.understand, json({ query: String(query).slice(0, T.intent.MAX_QUERY) }), signal);
        const { intent, issues } = T.intent.validateIntent(body.intent, { query, source: 'ai' });
        if (issues.length && !hasContent(intent)) throw new ProviderError('bad_response', FRIENDLY.bad_response);
        return { intent, issues };
      },
      async propose({ intent, catalog, excludeTourIds, signal }) {
        // Send ids and titles of retrieved candidates only: never the whole catalog.
        const found = T.matcher.search(catalog, intent, { limit: 12, excludeTourIds, skipNearby: true });
        const candidates = found.results.map(r => ({ id: r.tourId, title: catalog.tour(r.tourId).title, durationDays: (catalog.tour(r.tourId).duration || {}).days || null }));
        const body = await call(paths.propose, json({ intent: { ...intent, query: undefined }, candidates }), signal);
        if (!body.skeleton || typeof body.skeleton !== 'object') throw new ProviderError('bad_response', FRIENDLY.bad_response);
        return { skeleton: body.skeleton };
      },
      async analyzeImage({ file, query, signal }) {
        const form = new FormData();
        form.append('image', file, 'upload');
        if (query) form.append('query', String(query).slice(0, T.intent.MAX_QUERY));
        const body = await call(paths.image, { method: 'POST', body: form }, signal);
        const raw = Array.isArray(body.candidates) ? body.candidates.slice(0, 5) : null;
        if (!raw) throw new ProviderError('bad_response', FRIENDLY.bad_response);
        const candidates = raw.filter(c => c && typeof c.label === 'string').map(c => ({
          label: String(c.label).replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 80),
          type: ['landmark', 'city', 'experience'].includes(c.type) ? c.type : 'experience',
          confidence: Number.isFinite(c.confidence) ? Math.min(1, Math.max(0, c.confidence)) : 0
        })).filter(c => c.label);
        return { status: candidates.length ? 'ok' : 'no-match', candidates };
      }
    };
  }
  const hasContent = i => i.destinations.length || i.attractions.length || i.activities.length || i.preferences.length || i.keywords.length || i.duration;

  // Primary first; on any provider failure fall back to the deterministic local engine.
  function withFallback(primary, fallback) {
    const guard = async (op, args) => {
      try { return await primary[op](args); }
      catch (err) {
        if (args.signal && args.signal.aborted) throw err;
        if (!(err instanceof ProviderError)) throw err;
        const out = await fallback[op](args);
        return { ...out, degraded: { code: err.code, message: friendly(err) } };
      }
    };
    return {
      id: primary.id + '+local-fallback',
      capabilities: primary.capabilities,
      understand: a => guard('understand', a),
      propose: a => guard('propose', a),
      analyzeImage: a => primary.analyzeImage(a)
    };
  }

  // Short-lived memo so the same text is not interpreted twice.
  function withCache(provider, max, ttlMs) {
    const store = new Map();
    const limit = max || 50, ttl = ttlMs || 600000;
    return Object.assign({}, provider, {
      async understand(args) {
        const key = T.lexicon.norm(args.query);
        const hit = store.get(key);
        if (hit && Date.now() - hit.at < ttl) return hit.value;
        const value = await provider.understand(args);
        if (!value.degraded) { store.set(key, { at: Date.now(), value }); if (store.size > limit) store.delete(store.keys().next().value); }
        return value;
      }
    });
  }

  function select(config) {
    const cfg = config || root.TRIPPIO_TRAVEL_CONFIG || {};
    return withCache(cfg.apiBase ? withFallback(remote(cfg), local) : local);
  }

  // Image candidates -> the same intent shape as text, using only the lexicon and catalog names.
  function candidatesToIntent(candidates, catalog) {
    const lx = T.lexicon;
    const intent = T.intent.emptyIntent('ai');
    const interpreted = [];
    for (const c of candidates) {
      const text = lx.norm(c.label);
      const attr = lx.scan(text, lx.attractionAliases).keys;
      const byName = [...catalog.stops.values()].filter(s => lx.has(text, s.name) || lx.has(lx.norm(s.name), text)).map(s => s.id);
      const places = lx.scan(text, lx.placeAliases).keys;
      const acts = lx.scan(text, lx.activityAliases).keys;
      const keys = [...new Set(attr.concat(byName))];
      intent.attractions.push(...keys); intent.destinations.push(...places); intent.activities.push(...acts);
      interpreted.push({ label: c.label, confidence: c.confidence, keys: keys.concat(places, acts) });
    }
    for (const f of ['attractions', 'destinations', 'activities']) intent[f] = [...new Set(intent[f])];
    return { intent, interpreted };
  }

  T.providers = { local, remote, withFallback, withCache, select, ProviderError, friendly, candidatesToIntent };
  T.image = { validateFile: validateImageFile, sniffType: sniffImageType, MAX_BYTES: MAX_IMAGE_BYTES, TYPES: IMAGE_TYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = T.providers;
})(typeof globalThis !== 'undefined' ? globalThis : this);

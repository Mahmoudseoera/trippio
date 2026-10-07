(() => {
  'use strict';

  /* ---------- Config ---------- */
  const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
  const YEAR = 2025;

  // Rating thresholds
  const T = {
    COLD_MAX: 14,        // below this: too cold
    IDEAL_MIN: 18,
    IDEAL_MAX: 28,
    MODERATE_MAX: 33,    // above this: extreme heat
    RAIN_LOW_MM: 50,     // ideal needs rain at or below this
    RAIN_HIGH_MM: 100    // above this: too wet
  };

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const form = $('searchForm');
  const input = $('cityInput');
  const searchBtn = $('searchBtn');
  const grid = $('monthGrid');
  const message = $('message');
  const resultHead = $('resultHead');
  const placeName = $('placeName');
  const bestSummary = $('bestSummary');
  const presets = document.querySelectorAll('.preset');

  /* ---------- Inline SVG icons ---------- */
  const svg = (inner) =>
    `<svg class="month__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  const ICONS = {
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    sunCloud: svg('<path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M19.1 4.9l-1.4 1.4"/><path d="M16 11a4 4 0 0 0-7.6-1.5"/><path d="M17.5 21H9a4 4 0 1 1 .7-7.9A5.5 5.5 0 0 1 17.5 21Z"/>'),
    snow: svg('<path d="M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7"/><path d="m9.5 3.5 2.5 2 2.5-2M9.5 20.5l2.5-2 2.5 2M3 9.5l3.2.4-.6 3.1M21 14.5l-3.2-.4.6-3.1M3 14.5l3.2-.4-.6-3.1M21 9.5l-3.2.4.6 3.1"/>'),
    rain: svg('<path d="M17 14a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5 4.5 4.5 0 0 0 7 14"/><path d="M8 17v3M12 16v4M16 17v3"/>')
  };

  /* ---------- API ---------- */
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  }

  async function geocode(city) {
    const url = `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const data = await fetchJSON(url);
    const hit = data.results && data.results[0];
    if (!hit) throw new Error('NOT_FOUND');
    return { name: hit.name, country: hit.country || '', lat: hit.latitude, lng: hit.longitude };
  }

  async function fetchClimate(lat, lng) {
    const url = `${ARCHIVE_URL}?latitude=${lat}&longitude=${lng}` +
      `&start_date=${YEAR}-01-01&end_date=${YEAR}-12-31` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const data = await fetchJSON(url);
    if (!data.daily || !data.daily.time) throw new Error('NO_DATA');
    return data.daily;
  }

  /* ---------- Aggregation: daily -> monthly ---------- */
  function aggregateMonthly(daily) {
    const buckets = Array.from({ length: 12 }, () => ({ sumMax: 0, sumMin: 0, rain: 0, n: 0 }));

    daily.time.forEach((date, i) => {
      const max = daily.temperature_2m_max[i];
      const min = daily.temperature_2m_min[i];
      const rain = daily.precipitation_sum[i];
      if (max == null || min == null) return;          // skip missing days

      const b = buckets[Number(date.slice(5, 7)) - 1];
      b.sumMax += max;
      b.sumMin += min;
      b.rain += rain ?? 0;
      b.n += 1;
    });

    return buckets.map((b, m) => {
      if (!b.n) return { month: m, empty: true };
      const max = b.sumMax / b.n;
      const min = b.sumMin / b.n;
      return { month: m, max, min, avg: (max + min) / 2, rain: b.rain, empty: false };
    });
  }

  /* ---------- Rating logic ---------- */
  function rate({ avg, rain }) {
    if (avg > T.MODERATE_MAX) return { cls: 'hot', label: 'Too Hot', icon: 'sun' };
    if (avg < T.COLD_MAX)     return { cls: 'cold', label: 'Too Cold', icon: 'snow' };
    if (rain > T.RAIN_HIGH_MM) return { cls: 'cold', label: 'Too Wet', icon: 'rain' };

    const idealTemp = avg >= T.IDEAL_MIN && avg <= T.IDEAL_MAX;
    if (idealTemp && rain <= T.RAIN_LOW_MM) return { cls: 'ideal', label: 'Best Time', icon: 'sunCloud' };

    // Warm-side moderate gets a sun, cool-side moderate gets sun + cloud
    return { cls: 'moderate', label: 'Acceptable', icon: avg >= T.IDEAL_MAX ? 'sun' : 'sunCloud' };
  }

  /* ---------- Rendering ---------- */
  function renderSkeleton() {
    grid.innerHTML = Array.from({ length: 12 }, () => `
      <li class="month month--skeleton" aria-hidden="true">
        <span class="skel skel--name"></span>
        <span class="skel skel--temp"></span>
        <span class="skel skel--badge"></span>
      </li>`).join('');
    grid.setAttribute('aria-busy', 'true');
  }

  function renderGrid(stats) {
    grid.innerHTML = stats.map((s) => {
      const name = MONTHS[s.month];
      if (s.empty) {
        return `<li class="month"><h4 class="month__name">${name}</h4><span class="month__badge">No data</span></li>`;
      }
      const r = rate(s);
      const tip = `${Math.round(s.min)}° – ${Math.round(s.max)}°C<br>Rainfall: ${Math.round(s.rain)} mm`;
      return `
        <li class="month status--${r.cls}" tabindex="0"
            aria-label="${name}: average ${Math.round(s.avg)} degrees, ${r.label}. Low ${Math.round(s.min)}, high ${Math.round(s.max)}, rainfall ${Math.round(s.rain)} millimetres.">
          <h4 class="month__name">${name}</h4>
          <div class="month__row">
            <span class="month__temp">${Math.round(s.avg)}<small>°C</small></span>
            ${ICONS[r.icon]}
          </div>
          <span class="month__badge">${r.label}</span>
          <span class="tooltip" role="tooltip">${tip}</span>
        </li>`;
    }).join('');
    grid.removeAttribute('aria-busy');
  }

  function renderSummary(place, stats) {
    placeName.textContent = place.country ? `${place.name}, ${place.country}` : place.name;

    const best = stats.filter((s) => !s.empty && rate(s).cls === 'ideal').map((s) => MONTHS[s.month]);
    bestSummary.textContent = '';
    if (best.length) {
      const strong = document.createElement('strong');
      strong.textContent = best.length > 3 ? `${best[0]} to ${best[best.length - 1]}` : best.join(', ');
      bestSummary.append('Best months: ', strong);
    } else {
      bestSummary.textContent = 'No month hits the ideal range here. Check the acceptable months in yellow.';
    }
    resultHead.hidden = false;
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  /* ---------- Controller ---------- */
  let requestId = 0;   // ignore stale responses if the user searches again

  async function search(city) {
    const query = city.trim();
    if (!query) return;

    const id = ++requestId;
    showMessage('');
    resultHead.hidden = true;
    searchBtn.disabled = true;
    renderSkeleton();

    try {
      const place = await geocode(query);
      const daily = await fetchClimate(place.lat, place.lng);
      if (id !== requestId) return;

      const stats = aggregateMonthly(daily);
      renderSummary(place, stats);
      renderGrid(stats);
    } catch (err) {
      if (id !== requestId) return;
      grid.innerHTML = '';
      grid.removeAttribute('aria-busy');
      showMessage(err.message === 'NOT_FOUND'
        ? `We couldn't find "${query}". Check the spelling or try a nearby city.`
        : 'Weather data did not load. Check your connection and try again.');
    } finally {
      if (id === requestId) searchBtn.disabled = false;
    }
  }

  function setActivePreset(city) {
    presets.forEach((p) => p.classList.toggle('is-active', p.dataset.city.toLowerCase() === city.trim().toLowerCase()));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    setActivePreset(input.value);
    search(input.value);
  });

  presets.forEach((btn) => btn.addEventListener('click', () => {
    input.value = btn.dataset.city;
    setActivePreset(btn.dataset.city);
    search(btn.dataset.city);
  }));

  // Load a default destination on first paint
  input.value = 'Luxor';
  setActivePreset('Luxor');
  search('Luxor');
})();

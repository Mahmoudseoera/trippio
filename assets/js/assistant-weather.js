/* Weather data comes from Open-Meteo. No city or temperature catalog is stored here. */
(() => {
'use strict';
const finite = value => typeof value === 'number' && Number.isFinite(value);
function classify(code, isDay = 1) {
 if (!finite(code)) return {theme:'neutral', icon:'◌', label:'Conditions unavailable'};
 if ((code >= 71 && code <= 77) || code === 85 || code === 86) return {theme:'snowy',icon:'❄',label:'Snow'};
 if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return {theme:'rainy',icon:'☂',label:code >= 95 ? 'Thunderstorms' : 'Rain / drizzle'};
 if (code === 2 || code === 3 || code === 45 || code === 48) return {theme:'cloudy',icon:'☁',label:code >= 45 ? 'Foggy' : 'Cloudy'};
 if (isDay === 0) return {theme:'night',icon:'☾',label:'Clear night'};
 return {theme:'sunny',icon:'☀',label:code === 1 ? 'Mainly clear' : 'Clear skies'};
}
function dateMode(date, today) {
 const difference = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
 return difference < 0 ? 'archive' : difference <= 15 ? 'forecast' : 'seasonal';
}
function mean(values) {
 const numbers = values.filter(finite);
 return numbers.length ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : null;
}
function create(options) {
 const $ = id => document.getElementById(id), cache = new Map();
 let request, sequence = 0, actualTheme = 'neutral', preview = null, selectedCity, selectedDate, effects = true;
 const todayString = () => new Date().toLocaleDateString('sv-SE', {timeZone:'Africa/Cairo'});
 function applyTheme(theme) {
  actualTheme = theme;
  document.body.dataset.weather = preview || theme;
 }
 function clearFields() {
  $('weather-temp').textContent = '—'; $('weather-icon').textContent = '◌';
  $('weather-range').textContent = ''; $('weather-wind').textContent = ''; $('weather-rain').textContent = '';
  $('weather-updated').textContent = ''; $('seasonal-weather').hidden = true;
 }
 function render(payload) {
  const condition = classify(payload.code, payload.isDay);
  applyTheme(condition.theme);
  document.body.dataset.heat = condition.theme === 'sunny' && finite(payload.temperature) && payload.temperature >= 30 ? 'hot' : 'normal';
  $('weather-source').textContent = payload.source;
  $('weather-temp').textContent = finite(payload.temperature) ? Math.round(payload.temperature) + '°C' : '—';
  $('weather-icon').textContent = condition.icon;
  $('weather-description').textContent = condition.label;
  $('weather-range').textContent = finite(payload.high) && finite(payload.low) ? '↑ ' + Math.round(payload.high) + '° · ↓ ' + Math.round(payload.low) + '°' : '';
  $('weather-wind').textContent = finite(payload.wind) ? 'Wind ' + Math.round(payload.wind) + ' km/h' : '';
  $('weather-rain').textContent = finite(payload.rain) ? 'Rain ' + payload.rain.toFixed(1) + ' mm' : '';
  $('weather-period').textContent = payload.period;
  $('weather-updated').textContent = 'Provider time: ' + payload.time.replace('T', ' ') + ' · Egypt local time';
  if (payload.seasonalText) { $('seasonal-weather').textContent = payload.seasonalText; $('seasonal-weather').hidden = false; }
 }
 async function getJSON(url, signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error('Weather service returned ' + response.status);
  const data = await response.json();
  if (data.error) throw new Error(data.reason || 'Weather service unavailable');
  return data;
 }
 function baseParams(city) {
  return new URLSearchParams({latitude:city.dataset.lat, longitude:city.dataset.lon, timezone:'Africa/Cairo', temperature_unit:'celsius',wind_speed_unit:'kmh',precipitation_unit:'mm'});
 }
 async function historicalMonth(city, date, signal, today) {
  // A fetched monthly reference from the last complete calendar year, explicitly not a forecast or climate normal.
  const year = Number(today.slice(0,4)) - 1, month = date.slice(5,7);
  const last = new Date(Date.UTC(year,Number(month),0)).getUTCDate();
  const params = baseParams(city);
  params.set('start_date',year + '-' + month + '-01'); params.set('end_date',year + '-' + month + '-' + last);
  params.set('daily','temperature_2m_max,temperature_2m_min');
  const data = await getJSON('https://archive-api.open-meteo.com/v1/archive?' + params, signal);
  const high = mean(data.daily?.temperature_2m_max || []), low = mean(data.daily?.temperature_2m_min || []);
  if (!finite(high) || !finite(low)) throw new Error('Historical temperatures unavailable');
  const monthName = new Date(date + 'T12:00:00').toLocaleDateString('en',{month:'long'});
  return monthName + ' ' + year + ' historical monthly average: ' + Math.round(high) + '°C high / ' + Math.round(low) + '°C low. Reference only; not a forecast for your trip.';
 }
 async function load(city, date, force = false) {
  selectedCity = city; selectedDate = date;
  const version = ++sequence;
  if (request) request.abort();
  request = new AbortController();
  const signal = request.signal;
  preview = null; actualTheme = 'neutral'; document.body.dataset.weather = 'neutral';
  $('preview-label').textContent = 'Effects follow the weather data.';
  $('weather-city').textContent = city.querySelector('strong').textContent;
  $('weather-source').textContent = 'FETCHING WEATHER';
  $('weather-description').textContent = 'Checking conditions for this city…';
  $('weather-period').textContent = ''; clearFields();
  const today = todayString(), mode = dateMode(date,today), key = city.dataset.city + ':' + date + ':' + today;
  const saved = cache.get(key);
  if (!force && saved && Date.now() - saved.at < 600000) {render(saved.payload); return;}
  const timeout = setTimeout(() => {if(version === sequence) request.abort('timeout');},15000);
  try {
   const params = baseParams(city);
   params.set('daily','weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max');
   let data, payload;
   if (mode === 'archive') {
    params.set('start_date',date); params.set('end_date',date);
    data = await getJSON('https://archive-api.open-meteo.com/v1/archive?' + params,signal);
    payload = {source:'HISTORICAL WEATHER',temperature:data.daily?.temperature_2m_max?.[0],code:data.daily?.weather_code?.[0],isDay:1,high:data.daily?.temperature_2m_max?.[0],low:data.daily?.temperature_2m_min?.[0],wind:data.daily?.wind_speed_10m_max?.[0],rain:data.daily?.precipitation_sum?.[0],period:'Historical conditions on ' + date + ' · shown temperature is the daily high.',time:date};
   } else {
    params.set('current','temperature_2m,weather_code,is_day,wind_speed_10m,precipitation');
    params.set('forecast_days','16');
    data = await getJSON('https://api.open-meteo.com/v1/forecast?' + params,signal);
    const index = data.daily?.time?.indexOf(mode === 'forecast' ? date : today) ?? -1;
    const current = mode === 'seasonal' || date === today;
    if (index < 0) throw new Error('Selected date is unavailable in the forecast');
    payload = {source:current?'CURRENT CONDITIONS':'TRIP DATE FORECAST',temperature:current ? data.current?.temperature_2m : data.daily?.temperature_2m_max?.[index],code:current ? data.current?.weather_code : data.daily?.weather_code?.[index],isDay:current ? data.current?.is_day : 1,high:data.daily?.temperature_2m_max?.[index],low:data.daily?.temperature_2m_min?.[index],wind:current ? data.current?.wind_speed_10m : data.daily?.wind_speed_10m_max?.[index],rain:data.daily?.precipitation_sum?.[index],period:mode === 'seasonal' ? 'Your arrival (' + date + ') is beyond the 16-day forecast range. The atmosphere shows current conditions.' : current ? 'Current conditions. High / low and rainfall refer to today.' : 'Forecast for arrival: ' + date + ' · shown temperature is the daily high.',time:current ? data.current?.time : date};
   }
   if (!finite(payload.temperature) || !finite(payload.code) || typeof payload.time !== 'string') throw new Error('Weather data is incomplete');
   if (version !== sequence) return;
   render(payload);
   cache.set(key,{at:Date.now(),payload});
   if (mode === 'seasonal') {
    try {payload.seasonalText = await historicalMonth(city,date,signal,today);}
    catch (_) {payload.seasonalText = 'The historical monthly reference is unavailable. Current conditions are shown above.';}
    if (version === sequence) {render(payload);cache.set(key,{at:Date.now(),payload});}
   }
  } catch (error) {
   if (version !== sequence) return;
   clearFields(); applyTheme('neutral');
   $('weather-source').textContent = 'WEATHER UNAVAILABLE';
   $('weather-description').textContent = 'Could not load weather. Check your connection and retry.';
   $('weather-period').textContent = 'No simulated temperatures are shown.';
  } finally {clearTimeout(timeout);}
 }
 $('refresh-weather').addEventListener('click', () => {if(selectedCity) load(selectedCity,selectedDate,true);});
 $('toggle-effects').addEventListener('click', () => {
  effects = !effects; document.body.dataset.effects = effects ? 'on' : 'off';
  $('toggle-effects').setAttribute('aria-pressed',String(effects)); $('toggle-effects').textContent = effects ? 'Effects on' : 'Effects off';
 });
 document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => {
  preview = button.dataset.preview === 'auto' ? null : button.dataset.preview;
  document.body.dataset.weather = preview || actualTheme;
  $('preview-label').textContent = preview ? 'Visual preview only. Temperatures above remain real weather data.' : 'Effects follow the weather data.';
 }));
 // Decorative particles contain no destination or weather data.
 const drops = document.createDocumentFragment();
 for(let i=0;i<85;i++) {
  const drop = document.createElement('i');drop.className='rain-drop';
  drop.style.setProperty('--left', Math.random()*125 + '%');
  drop.style.setProperty('--length', 12+Math.random()*20+'px');
  drop.style.setProperty('--speed', .55+Math.random()*.5+'s');
  drop.style.setProperty('--delay', -Math.random()*2+'s'); drops.appendChild(drop);
 }
 $('rain-drops').appendChild(drops);
 return {load,cancel(){sequence++;if(request)request.abort();document.body.dataset.weather='neutral';}};
}
globalThis.TrippioWeather = {create,classify,dateMode,mean};
})();

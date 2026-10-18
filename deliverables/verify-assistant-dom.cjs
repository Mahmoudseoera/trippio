const {parseHTML}=require('../.assistant-qa/node_modules/linkedom');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('ai-assistance.html','utf8');
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Africa/Cairo'});
const dateAdd=(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(fetchImpl){
 const {document,window:dom}=parseHTML(html);
 document.querySelectorAll('input,textarea').forEach(input=>{input.setCustomValidity=value=>input.validationMessage=value;});
 document.querySelectorAll('form').forEach(form=>{form.reset=()=>{};form.reportValidity=()=>!Array.from(form.querySelectorAll('input')).some(input=>input.validationMessage);});
 document.querySelectorAll('video').forEach(video=>{video.play=()=>Promise.resolve();video.pause=()=>{};});
 const store=new Map(),layers=new Set(),mapState={},timers=new Map(),media={plays:0};let clock=0,timerId=0;
 document.querySelectorAll('video').forEach(video=>{video.play=()=>{if(video.id==='intro-video')media.plays++;return Promise.resolve();};video.pause=()=>{};});
 function advance(ms=0){const target=clock+ms;let safety=0;while(true){const next=Array.from(timers.entries()).filter(([,timer])=>timer.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++safety>100)throw Error('Timer loop');clock=next[1].at;timers.delete(next[0]);next[1].fn();}clock=target;}
 const map={setView(){return this},on(){return this},once(){return this},addLayer(layer){layers.add(layer);return this},hasLayer(layer){return layers.has(layer)},removeLayer(layer){layers.delete(layer);return this},fitBounds(){mapState.fit=true;return this},flyToBounds(){mapState.cityZoom=true;return this},flyTo(point,zoom){mapState.stop=point;mapState.zoom=zoom;return this},invalidateSize(){},getZoom(){return mapState.zoom||6},panBy(){}};
 const layer=()=>({addTo(){layers.add(this);return this},on(){return this}});
 const leaflet={map(){return map},latLng(lat,lng){return {lat,lng}},point(x,y){return{x,y}},latLngBounds(){let count=0;return{extend(){count++;return this},isValid(){return count>0}}},control:{zoom:layer},tileLayer:layer,divIcon(options){return options},marker(point,options){const el=document.createElement('div');return{...layer(),point,options,getElement(){return el}}}};
 const events={};
 const ctx={document,console,URL,URLSearchParams,Date,Math,Number,String,Object,Array,Map,Set,AbortController,Promise,Event:dom.Event,SpeechSynthesisUtterance:class{constructor(text){this.text=text}},speechSynthesis:{cancel(){},getVoices(){return[]},speak(narration){narration.onstart?.()}},matchMedia(query){return{matches:query.includes('prefers-reduced-motion')}},innerHeight:900,setTimeout(fn,delay=0){const id=++timerId;timers.set(id,{fn,at:clock+delay});return id},clearTimeout(id){timers.delete(id)},setInterval(){return 1},clearInterval(){},fetch:fetchImpl||(async()=>{throw Error('offline')}),sessionStorage:{setItem(k,v){store.set(k,v)},getItem(k){return store.get(k)},removeItem(k){store.delete(k)}},FormData:class{constructor(form){this.items=Array.from(form.querySelectorAll('[name]')).filter(input=>input.type!=='checkbox'||input.hasAttribute('checked')).map(input=>[input.name,input.value]);}[Symbol.iterator](){return this.items[Symbol.iterator]();}},L:leaflet,addEventListener(name,fn){events[name]=fn}};
 ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
 const click=id=>document.getElementById(id).dispatchEvent(new dom.Event('click',{bubbles:true,cancelable:true}));
 const submit=index=>document.querySelectorAll('.chat-question')[index].dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true}));
 const run=path=>vm.runInContext(fs.readFileSync(path,'utf8'),ctx);
 return{ctx,document,store,mapState,click,submit,run,advance,media};
}
function fixture(temp=25){return{current:{temperature_2m:temp,weather_code:0,is_day:1,wind_speed_10m:10,precipitation:0,time:today+'T12:00'},daily:{time:Array.from({length:16},(_,i)=>dateAdd(today,i)),weather_code:Array(16).fill(0),temperature_2m_max:Array(16).fill(temp+5),temperature_2m_min:Array(16).fill(temp-5),precipitation_sum:Array(16).fill(0),wind_speed_10m_max:Array(16).fill(15)}};}
(async()=>{
 const h=harness(async()=>({ok:true,json:async()=>fixture()}));h.run('assets/js/assistant-weather.js');h.run('assets/js/ai-assistance.js');
 const d=h.document,forms=d.querySelectorAll('.chat-question');
 assert(!forms[0].hidden);assert(forms[1].hidden);assert.equal(d.querySelectorAll('.message.bot').length,1);
 d.querySelector('[name=full_name]').value='Mona';h.submit(0);assert(!forms[1].hidden);assert(d.getElementById('chat-log').textContent.includes('Mona'));
 h.submit(1);h.submit(2);
 d.getElementById('arrival').value=dateAdd(today,2);d.getElementById('departure').value=dateAdd(today,1);h.submit(3);assert(!forms[3].hidden,'invalid dates must stay in the date question');
 d.getElementById('departure').value=dateAdd(today,10);h.submit(3);
 d.querySelector('[name=interest][value=beach]').setAttribute('checked','');h.submit(4);
 d.querySelector('[name=city][value=cairo]').setAttribute('checked','');d.querySelector('[name=city][value=luxor]').setAttribute('checked','');h.submit(5);
 d.querySelector('[name=email]').value='mona@example.com';d.querySelector('[name=message]').value='Quiet hotel please';h.submit(6);
 assert.equal(d.body.dataset.stage,'intro');assert.equal(h.media.plays,0,'intro must stay paused before CTA');assert.equal(d.getElementById('intro-video').loop,false);h.click('explore-map');h.click('explore-map');h.advance(0);assert.equal(h.media.plays,1,'double-click cannot replay the intro');assert.equal(d.body.dataset.stage,'intro','map waits for video end');d.getElementById('intro-video').dispatchEvent(new h.ctx.Event('ended'));h.advance(0);await flush();
 assert.equal(d.body.dataset.stage,'map');assert.equal(d.querySelectorAll('.city-tab:not([hidden])').length,2);assert(h.mapState.fit);assert.equal(d.getElementById('choose-tour').getAttribute('aria-disabled'),'false');
 assert(d.querySelector('.itinerary-panel').hidden,'city selection must not auto-open a tour itinerary');
 assert.equal(d.querySelector('[data-city=cairo] .city-tour-count').textContent,'2 tours');
 assert.equal(d.querySelectorAll('.tour-option:not([hidden])').length,2);
 d.querySelector('[data-tour=giza-pyramids-sphinx] .select-tour').dispatchEvent(new h.ctx.Event('click'));
 assert.equal(d.querySelectorAll('.attraction:not([hidden])').length,2,'Giza day tour only shows its two stops');
 assert.equal(d.getElementById('guide-title').textContent,'Giza Pyramids & Sphinx');
 assert.equal(d.getElementById('guide-toggle').textContent,'Ⅱ','tour selection starts narration');
 d.querySelector('[data-stop=giza] button').dispatchEvent(new h.ctx.Event('click'));
 assert.equal(h.mapState.zoom,17);assert.equal(h.mapState.stop.lat,29.9792);assert(d.getElementById('guide-title').textContent.includes('Giza'));
 d.querySelector('[data-tour=nile-cruise-8-days] .select-tour').dispatchEvent(new h.ctx.Event('click'));assert.equal(d.querySelectorAll('.attraction:not([hidden])').length,13);h.click('choose-tour');const draft=JSON.parse(h.store.get('trippio-assistant-booking'));assert.equal(draft.full_name,'Mona');assert.equal(draft.email,'mona@example.com');assert.equal(draft.check_in,dateAdd(today,2));assert(draft.message.includes('Quiet hotel please'));assert(draft.message.includes('beach'));
 d.querySelector('.city-tab[data-city=luxor]').dispatchEvent(new h.ctx.Event('click'));assert(d.querySelector('.itinerary-panel').hidden);assert(d.querySelector('[data-tour=giza-pyramids-sphinx]').hidden);assert(!d.querySelector('[data-tour=karnak-valley-kings]').hidden);

 for(const card of d.querySelectorAll('.city-day-tour')){
  d.querySelector('.city-tab[data-city="'+card.dataset.cities+'"]').dispatchEvent(new h.ctx.Event('click'));
  card.querySelector('.select-tour').dispatchEvent(new h.ctx.Event('click'));
  card.querySelector('[data-assistant-booking]').dispatchEvent(new h.ctx.Event('click',{cancelable:true}));
  const saved=JSON.parse(h.store.get('trippio-assistant-booking'));
  assert.equal(saved.tour,card.dataset.tour);
  const detailFile=card.querySelector('a').getAttribute('href').split('#')[0];
  const detail=parseHTML(fs.readFileSync(detailFile,'utf8')).document;
  const detailContext={document:detail,Date,JSON,Object,Number,Event:h.ctx.Event,sessionStorage:{getItem(key){return h.store.get(key)},removeItem(key){h.store.delete(key)}}};
  vm.runInNewContext(fs.readFileSync('assets/js/assistant-booking.js','utf8'),detailContext);
  assert.equal(detail.querySelector('[name=full_name]').value,'Mona');
  assert.equal(detail.querySelector('[name=email]').value,'mona@example.com');
  assert.equal(detail.querySelector('[name=check_in]').value,dateAdd(today,2));
  assert(detail.querySelector('[name=message]').value.includes(card.querySelector('h4').textContent));
  assert(!h.store.has('trippio-assistant-booking'));
 }
 console.log('PASS: every day-tour detail page receives matching quiz data and consumes its saved draft');
 h.click('edit-trip');assert.equal(d.body.dataset.stage,'chat');assert(!forms[0].hidden);
 console.log('PASS: seven-question chat, invalid dates, guide intro, city filtering, satellite stop zoom, tour handoff and edit flow');
function readyIntro(reduce=true){const next=harness();if(!reduce)next.ctx.matchMedia=()=>({matches:false});next.run('assets/js/ai-assistance.js');next.document.querySelector('[name=full_name]').value='Omar';next.document.getElementById('arrival').value=dateAdd(today,2);next.document.getElementById('departure').value=dateAdd(today,10);for(let i=0;i<7;i++){next.submit(i);if(!reduce&&i<6)next.advance(450);}assert.equal(next.document.body.dataset.stage,'intro');return next;}
 const normal=readyIntro(false);normal.click('explore-map');normal.click('explore-map');assert.equal(normal.media.plays,0);normal.advance(500);assert.equal(normal.media.plays,1);assert.equal(normal.document.body.dataset.stage,'intro');normal.document.getElementById('intro-video').dispatchEvent(new normal.ctx.Event('ended'));normal.advance(250);assert.equal(normal.document.body.dataset.stage,'map');normal.advance(60000);assert.equal(normal.media.plays,1);
 const skip=readyIntro();skip.click('explore-map');skip.click('skip-intro');skip.advance(60000);assert.equal(skip.document.body.dataset.stage,'map');assert.equal(skip.media.plays,0);
 const failed=readyIntro();failed.document.getElementById('intro-video').play=()=>Promise.reject(Error('media blocked'));failed.click('explore-map');failed.advance(0);await flush();failed.advance(0);assert.equal(failed.document.body.dataset.stage,'map');
 const cancelled=readyIntro(false);cancelled.click('explore-map');cancelled.click('restart');cancelled.advance(60000);assert.equal(cancelled.document.body.dataset.stage,'chat');assert.equal(cancelled.media.plays,0);
 console.log('PASS: normal-motion intro timing, skip, rejected playback, repeat protection and cancellation');
 const w=h.ctx.TrippioWeather;
 assert.equal(w.classify(63,1).theme,'rainy');assert.equal(w.classify(0,1).theme,'sunny');assert.equal(w.classify(0,0).theme,'night');assert.equal(w.classify(3,1).theme,'cloudy');assert.equal(w.classify(75,1).theme,'snowy');assert.equal(w.classify(null).theme,'neutral');assert.equal(w.dateMode(dateAdd(today,15),today),'forecast');assert.equal(w.dateMode(dateAdd(today,16),today),'seasonal');assert.equal(w.dateMode(dateAdd(today,-1),today),'archive');assert.equal(w.mean([10,null,20]),15);
 console.log('PASS: WMO weather themes, null data and 16-day forecast boundary');
 let resolveCairo;
 const race=harness(async url=>{
  if(url.includes('latitude=30.0444'))return new Promise(resolve=>{resolveCairo=()=>resolve({ok:true,json:async()=>fixture(12)})});
  return{ok:true,json:async()=>fixture(31)};
 });race.run('assets/js/assistant-weather.js');const weather=race.ctx.TrippioWeather.create();
 const old=weather.load(race.document.querySelector('[data-city=cairo]'),today);
 await flush();await weather.load(race.document.querySelector('[data-city=aswan]'),today);resolveCairo();await old;
 assert.equal(race.document.getElementById('weather-city').textContent,'Aswan');assert.equal(race.document.getElementById('weather-temp').textContent,'31°C');
 race.document.querySelector('[data-preview=rainy]').dispatchEvent(new race.ctx.Event('click'));assert.equal(race.document.body.dataset.weather,'rainy');assert.equal(race.document.getElementById('weather-temp').textContent,'31°C');race.click('toggle-effects');assert.equal(race.document.body.dataset.effects,'off');
 console.log('PASS: stale city response protection, rain preview keeps real temperatures, effects toggle');
 const offline=harness(async()=>{throw Error('offline')});offline.run('assets/js/assistant-weather.js');await offline.ctx.TrippioWeather.create().load(offline.document.querySelector('[data-city=cairo]'),today);assert.equal(offline.document.getElementById('weather-temp').textContent,'—');assert.equal(offline.document.body.dataset.weather,'neutral');assert(offline.document.getElementById('weather-description').textContent.includes('retry'));
 console.log('PASS: offline failure clears data and atmosphere instead of showing fake weather');
 let archiveRequested=false;
 const seasonal=harness(async url=>({ok:true,json:async()=>{if(url.includes('archive-api')){archiveRequested=true;return{daily:{temperature_2m_max:[30,32],temperature_2m_min:[20,22]}}}return fixture(26)}}));seasonal.run('assets/js/assistant-weather.js');await seasonal.ctx.TrippioWeather.create().load(seasonal.document.querySelector('[data-city=cairo]'),dateAdd(today,90));assert(archiveRequested);assert(!seasonal.document.getElementById('seasonal-weather').hidden);assert(seasonal.document.getElementById('seasonal-weather').textContent.includes('historical monthly average'));assert(seasonal.document.getElementById('weather-period').textContent.includes('beyond the 16-day'));
 console.log('PASS: distant travel dates fetch historical monthly temperatures and label current conditions separately');
})().catch(error=>{console.error(error);process.exit(1)});

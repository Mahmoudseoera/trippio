/* Quiz prompts, cities, coordinates, stops and tour facts are authored in HTML.
   Only visitor answers and runtime map/weather state are held in JavaScript. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const questions = document.querySelectorAll('.chat-question');
const cities = document.querySelectorAll('.city-tab');
const tours = document.querySelectorAll('.tour-option');
const introVideo = $('intro-video');
let selectedTour = null, introPhase = 'ready', introRun = 0;
const introTimers = new Set();
const stops = document.querySelectorAll('.attraction');
stops.forEach(stop=>{stop.dataset.originalLabel=stop.querySelector('small').textContent;});
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const weather = window.TrippioWeather?.create();
const markers = new Map();
let questionIndex = 0, questionVersion = 0, map, activeCity, activeStop, speaking = false, narration, voiceVersion = 0, activeStory = '', photoURL, photoReady = false, labelLayer, weatherTimer;
const state = {};
function localToday(){return new Date().toLocaleDateString('sv-SE',{timeZone:'Africa/Cairo'});}
$('arrival').min = localToday(); $('departure').min = localToday();
function stopVoice(){
 voiceVersion++; if('speechSynthesis' in window) speechSynthesis.cancel();
 speaking = false; $('guide-video').pause(); $('guide-toggle').textContent = '▶'; $('guide-toggle').setAttribute('aria-label','Listen to the selected place');
}
function speak(story){
 stopVoice();
 if(!story) return;
 if(!('speechSynthesis' in window)) {$('map-status').textContent='Voice is unavailable in this browser. Read the story beneath your guide.';return;}
 const version = voiceVersion;
 narration = new SpeechSynthesisUtterance(story); narration.lang='en-GB'; narration.rate=.93;
 const voice=speechSynthesis.getVoices().find(item=>item.lang.startsWith('en'));
 if(voice) narration.voice=voice;
 narration.onstart=()=>{
  if(version!==voiceVersion)return;
  speaking=true;$('guide-toggle').textContent='Ⅱ';$('guide-toggle').setAttribute('aria-label','Stop narration');
  if(!reduceMotion)$('guide-video').play().catch(()=>{});
 };
 narration.onend=()=>{if(version===voiceVersion)stopVoice();};
 narration.onerror=()=>{if(version===voiceVersion)stopVoice();};
 speechSynthesis.speak(narration);
}
function story(title, text, autoplay=true){
 $('guide-title').textContent=title;$('guide-subtitles').textContent=text;activeStory=text;
 if(autoplay)speak(text);else stopVoice();
}
function stage(name){
 stopVoice();
 document.body.dataset.stage=name;
 document.querySelectorAll('main>.stage').forEach(section=>section.hidden=section.id!==name+'-stage');
 if(name!=='map'){weather?.cancel();clearInterval(weatherTimer);}
 if(name!=='intro'){introRun++;introTimers.forEach(clearTimeout);introTimers.clear();introVideo.pause();}
}
function message(text,who,index){
 const item=document.createElement('div');item.className='message '+who;item.dataset.question=String(index);
 const speaker=document.createElement('span');speaker.className='message-speaker';speaker.textContent=who==='bot'?'YOUR EGYPT GUIDE':'YOU';item.appendChild(speaker);
 const content=document.createElement('span');content.textContent=text;item.appendChild(content);$('chat-log').appendChild(item);
 $('chat-log').scrollTop=$('chat-log').scrollHeight;return item;
}
function ask(index, immediate=false){
 questionIndex=index;const version=++questionVersion;
 questions.forEach(form=>form.hidden=true);
 $('question-progress').textContent=String(index+1).padStart(2,'0')+' / '+String(questions.length).padStart(2,'0');
 $('previous-question').hidden=index===0;
 const loading=document.createElement('div');loading.className='message bot typing';loading.dataset.question=String(index);loading.setAttribute('aria-label','Your guide is typing');
 for(let i=0;i<3;i++)loading.appendChild(document.createElement('i'));
 $('chat-log').appendChild(loading);$('chat-log').scrollTop=$('chat-log').scrollHeight;
 const show=()=>{
  if(version!==questionVersion)return;
  loading.remove();const form=questions[index];
  message((index===1 && state.full_name ? 'Lovely to meet you, '+state.full_name+'! ' : '')+form.dataset.question,'bot',index);
  form.hidden=false;
  const input=form.querySelector('input:not([type=checkbox]):not([type=file]),textarea');
  if(input && matchMedia('(min-width: 901px)').matches)input.focus({preventScroll:true});
 };
 if(immediate||reduceMotion)show();else setTimeout(show,450);
}
function gather(){
 questions.forEach(form=>{for(const [name,value] of new FormData(form))if(name!=='interest'&&name!=='city')state[name]=value;});
 state.interests=Array.from(document.querySelectorAll('[name=interest]:checked'),input=>input.value);
 state.cities=Array.from(document.querySelectorAll('[name=city]:checked'),input=>input.value);
}
function formattedDate(value){return new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
questions.forEach((form,index)=>form.addEventListener('submit',event=>{
 event.preventDefault();
 if(index!==questionIndex)return;
 if(form.dataset.answer==='dates'){
  $('departure').setCustomValidity($('departure').value<=$('arrival').value?'Choose a departure after your arrival.':'');
 }
 if(!form.reportValidity())return;
 gather();let answer='';
 const kind=form.dataset.answer;
 if(kind==='name')answer=state.full_name;
 if(kind==='photo')answer=photoReady?'Photo attached as inspiration.':'Let’s explore without a photo.';
 if(kind==='travelers')answer=state.adults+' adults · '+state.children+' children · '+state.infants+' infants';
 if(kind==='dates')answer=formattedDate(state.check_in)+' → '+formattedDate(state.check_out);
 if(kind==='interests')answer=Array.from(form.querySelectorAll('input:checked'),input=>input.nextElementSibling.textContent).join(' · ')||'Keep an open mind — show me your recommendations.';
 if(kind==='cities')answer=Array.from(form.querySelectorAll('input:checked'),input=>input.nextElementSibling.textContent).join(' · ')||'Please recommend a route for me.';
 if(kind==='contact')answer=state.message || (state.email?'My details are ready. Let’s go!':'All set. Show me my Egypt!');
 const reply=message(answer,'user',index);
 if(kind==='photo'&&photoReady){const image=document.createElement('img');image.src=photoURL;image.alt='Your travel inspiration';reply.appendChild(image);}
 if(index<questions.length-1)ask(index+1);
 else{
  questions.forEach(question=>question.hidden=true);
  stage('intro');$('intro-title').textContent='Your Egyptian adventure starts here, '+state.full_name+'.';$('intro-title').focus();
  prepareIntro();
 }
}));
$('arrival').addEventListener('input',()=>{
 $('departure').setCustomValidity('');
 if(!$('arrival').value)return;
 const next=new Date($('arrival').value+'T12:00:00');next.setDate(next.getDate()+1);
 $('departure').min=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')+'-'+String(next.getDate()).padStart(2,'0');
});
$('departure').addEventListener('input',()=>$('departure').setCustomValidity(''));
$('inspiration').addEventListener('change',event=>{
 const file=event.target.files[0];photoReady=false;$('photo-preview').hidden=true;
 if(photoURL)URL.revokeObjectURL(photoURL);
 $('photo-next').textContent='Skip for now →';
 if(!file){$('photo-status').textContent='No photo attached.';return;}
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024){event.target.value='';$('photo-status').textContent='Choose a JPG, PNG or WebP under 10 MB.';return;}
 photoURL=URL.createObjectURL(file);$('photo-preview').src=photoURL;$('photo-preview').hidden=false;photoReady=true;
 $('photo-next').textContent='Use this inspiration →';$('photo-status').textContent='Photo attached. Choose its city later in the quiz. Automatic recognition is not connected yet.';
});
$('previous-question').addEventListener('click',()=>{
 const previous=Math.max(0,questionIndex-1);
 document.querySelectorAll('#chat-log [data-question]').forEach(item=>{if(Number(item.dataset.question)>=previous)item.remove();});
 gather();ask(previous,true);
});
function latLng(element){return L.latLng(Number(element.dataset.lat),Number(element.dataset.lon));}
function cityTours(city){return Array.from(tours).filter(tour=>tour.dataset.cities.split(' ').includes(city.dataset.city));}
function pinIcon(name,city=false,count=0){
 const container=document.createElement('div');
 const core=document.createElement('span');core.className='pin-core';container.appendChild(core);
 const label=document.createElement('span');label.className='pin-label';label.textContent=name;container.appendChild(label);
 if(city){const badge=document.createElement('span');badge.className='tour-count';badge.textContent=count+' '+(count===1?'tour':'tours');label.appendChild(badge);}
 return L.divIcon({className:'map-pin'+(city?' map-city-pin':''),html:container,iconSize:L.point(20,20),iconAnchor:L.point(10,10)});
}
function showMarkerSelection(element){
 markers.forEach((marker,node)=>marker.getElement()?.classList.toggle('selected',node===element));
}
function initMap(){
 if(map)return;
 if(!window.L){$('map-loading').textContent='The map library could not load. Check your connection and reload.';return;}
 const view=$('satellite-map');
 map=L.map(view,{zoomControl:false,scrollWheelZoom:true,attributionControl:true}).setView(latLng(view),Number(view.dataset.zoom));
 L.control.zoom({position:'topright'}).addTo(map);
 const tiles=L.tileLayer(view.dataset.satelliteUrl,{maxZoom:19,maxNativeZoom:19,attribution:'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community'}).addTo(map);
 let tileErrors=0;
 tiles.on('tileerror',()=>{if(++tileErrors>=3)$('map-status').textContent='Some satellite tiles could not load. Check your connection or zoom out.';});
 tiles.on('tileload',()=>{tileErrors=0;if($('map-status').textContent.startsWith('Some satellite'))$('map-status').textContent='';});
 labelLayer=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Labels © Esri'}).addTo(map);
 stops.forEach(stop=>{
  const title=stop.querySelector('strong').textContent;
  const marker=L.marker(latLng(stop),{icon:pinIcon(title),title,keyboard:true}).addTo(map);
  marker.on('click',()=>selectStop(stop));markers.set(stop,marker);
 });
 cities.forEach(city=>{
  const title=city.querySelector('strong').textContent;
  const marker=L.marker(latLng(city),{icon:pinIcon(title,true,cityTours(city).length),title,keyboard:true,zIndexOffset:500}).addTo(map);
  marker.on('click',()=>selectCity(city));markers.set(city,marker);
 });
 map.on('zoomend',()=>{
  const detailed=map.getZoom()>=12;
  markers.forEach((marker,node)=>{const el=marker.getElement();if(el)el.classList.toggle('landmark-visible',detailed||node===activeStop);});
 });
 $('map-loading')?.remove();
}
function selectedCities(){return Array.from(cities).filter(city=>!city.hidden);}
function fitRoute(all=false){
 if(!map)return;
 const bounds=L.latLngBounds();
 (all?Array.from(stops):selectedCities()).forEach(element=>bounds.extend(latLng(element)));
 const mobile=matchMedia('(max-width:600px)').matches;
 if(bounds.isValid())map.fitBounds(bounds,{paddingTopLeft:L.point(mobile?35:330,mobile?115:120),paddingBottomRight:L.point(mobile?35:340,mobile?Math.round(innerHeight*.25):240),maxZoom:8,animate:!reduceMotion});
}
function updateMarkerVisibility(all=false){
 if(!map)return;
 const visible=selectedCities().map(city=>city.dataset.city);
 markers.forEach((marker,node)=>{
  const key=node.dataset.city;
  if(all||visible.includes(key)){if(!map.hasLayer(marker))marker.addTo(map);}
  else if(map.hasLayer(marker))map.removeLayer(marker);
 });
}
function selectCity(city,autoplay=true){
 activeCity=city;activeStop=null;city.hidden=false;selectedTour=null;
 const available=cityTours(city);
 tours.forEach(tour=>{tour.hidden=!available.includes(tour);tour.classList.remove('is-selected');tour.querySelector('.select-tour').setAttribute('aria-pressed','false');});
 $('tour-list-title').textContent=city.querySelector('strong').textContent+' · '+available.length+' '+(available.length===1?'tour':'tours');
 document.querySelector('.itinerary-panel').hidden=true;
 $('selected-tour-summary').hidden=true;
 document.querySelectorAll('.tour-price').forEach(price=>price.hidden=true);
 updateMarkerVisibility();
 cities.forEach(item=>item.setAttribute('aria-pressed',String(item===city)));
 stops.forEach(stop=>{
  stop.hidden=true;
  stop.querySelector('button').setAttribute('aria-pressed','false');stop.querySelector('p').hidden=true;
 });
 const name=city.querySelector('strong').textContent;
 $('itinerary-title').textContent=name;
 story(name,city.querySelector('small').textContent+'. Choose a tour to see its itinerary and hear its story.',autoplay);
 weather?.load(city,state.check_in);
 showMarkerSelection(city);
 if(map){
  const bounds=L.latLngBounds();bounds.extend(latLng(city));
  stops.forEach(stop=>{if(stop.dataset.city===city.dataset.city)bounds.extend(latLng(stop));});
  const mobile=matchMedia('(max-width:600px)').matches;
  map.flyToBounds(bounds,{maxZoom:city.dataset.city==='edfu'?9:11,paddingTopLeft:L.point(mobile?45:340,mobile?110:120),paddingBottomRight:L.point(mobile?45:330,mobile?150:240),animate:!reduceMotion,duration:1.4});
 }
}
function selectStop(stop){
 const city=Array.from(cities).find(item=>item.dataset.city===stop.dataset.city);
 if(selectedTour&&!selectedTour.dataset.stops.split(' ').includes(stop.dataset.stop))selectCity(city,false);
 if(!selectedTour&&city!==activeCity)selectCity(city,false);
 if(selectedTour&&city!==activeCity){activeCity=city;cities.forEach(item=>item.setAttribute('aria-pressed',String(item===city)));weather?.load(city,state.check_in);}
 if(!selectedTour){const tour=cityTours(city).find(item=>item.dataset.stops.split(' ').includes(stop.dataset.stop));if(tour)selectTour(tour,false);}
 activeStop=stop;
 stops.forEach(item=>{const chosen=item===stop;item.querySelector('button').setAttribute('aria-pressed',String(chosen));item.querySelector('p').hidden=!chosen;});
 const title=stop.querySelector('strong').textContent;
 story(title,stop.querySelector('p').textContent);
 showMarkerSelection(stop);
 if(map){
  map.flyTo(latLng(stop),Number(stop.dataset.zoom),{animate:!reduceMotion,duration:1.8});
  const mobile=matchMedia('(max-width:600px)').matches;
  map.once('moveend',()=>{if(activeStop===stop&&mobile)map.panBy(L.point(0,Math.round(innerHeight*.12)),{animate:false});});
 }
}
cities.forEach(city=>city.addEventListener('click',()=>selectCity(city)));
stops.forEach(stop=>stop.querySelector('button').addEventListener('click',()=>selectStop(stop)));
function explore(){
 gather();$('map-stage').classList.remove('map-entering');stage('map');
 $('trip-summary').textContent=state.full_name+' · '+formattedDate(state.check_in)+' – '+formattedDate(state.check_out)+' · '+state.adults+' adults · '+state.children+' children · '+state.infants+' infants';
 let recommendationCount=0;
 cities.forEach(city=>{
  const recommend=state.interests.length?state.interests.some(interest=>city.dataset.interests.split(' ').includes(interest)):city.dataset.city==='cairo'||city.dataset.city==='luxor'||city.dataset.city==='aswan';
  city.hidden=state.cities.length?!state.cities.includes(city.dataset.city):(!recommend||recommendationCount>=3);
  if(!city.hidden)recommendationCount++;
 });
 if(!recommendationCount)cities[0].hidden=false;
 $('city-list-label').textContent=state.cities.length?'YOUR SELECTED CITIES':'RECOMMENDED FOR YOU';
 $('city-selection-note').textContent=state.cities.length?'Your choices, ready to explore.':'Suggested from your interests. All attractions opens the complete tour route.';
 const days=Math.round((Date.parse(state.check_out)-Date.parse(state.check_in))/86400000)+1;
 const tooShort=days<Number(document.querySelector('.tour-option').dataset.days);
 $('choose-tour').setAttribute('aria-disabled',String(tooShort));
 $('tour-match-note').textContent=tooShort?'Your window is '+days+' days; this tour needs 8. Edit your dates or request a tailor-made trip.':'Fits your '+days+'-day window. Exact departures and availability must be confirmed.';
 initMap();
 if(map){map.invalidateSize();updateMarkerVisibility();}
 const first=selectedCities()[0];
 if(first)selectCity(first,false);
 if(map)fitRoute();
 $('map-title').focus({preventScroll:true});
 clearInterval(weatherTimer);
 weatherTimer=setInterval(()=>{if(activeCity&&!document.hidden)weather?.load(activeCity,state.check_in,true);},300000);
}
function later(callback,delay){
 const timer=setTimeout(()=>{introTimers.delete(timer);callback();},delay);introTimers.add(timer);
}
function prepareIntro(){
 introRun++;introTimers.forEach(clearTimeout);introTimers.clear();introPhase='ready';
 $('intro-stage').classList.remove('intro-playing','intro-revealing');
 $('intro-copy').inert=false;introVideo.loop=false;introVideo.pause();
 try{introVideo.currentTime=0;}catch(_){}
 $('intro-status').textContent='';$('explore-map').disabled=false;
}
function revealMap(run){
 if(run!==introRun||introPhase==='revealing'||introPhase==='done'||document.body.dataset.stage!=='intro')return;
 introPhase='revealing';introTimers.forEach(clearTimeout);introTimers.clear();introVideo.pause();
 $('intro-stage').classList.add('intro-revealing');
 later(()=>{if(run!==introRun||document.body.dataset.stage!=='intro')return;introPhase='done';explore();$('map-stage').classList.add('map-entering');},reduceMotion?0:250);
}
function beginIntro(){
 if(introPhase!=='ready')return;
 introPhase='playing';const run=++introRun;
 $('explore-map').disabled=true;$('intro-copy').inert=true;$('skip-intro').focus({preventScroll:true});
 $('intro-stage').classList.add('intro-playing');$('intro-status').textContent='';
 later(()=>{
  if(run!==introRun||introPhase!=='playing')return;
  try{introVideo.currentTime=0;}catch(_){}
  introVideo.play().catch(()=>{if(run===introRun){$('intro-status').textContent='Video unavailable. Opening your journey…';revealMap(run);}});
  const wait=Number.isFinite(introVideo.duration)?Math.min(90000,introVideo.duration*1000+8000):30000;
  later(()=>revealMap(run),wait);
 },reduceMotion?0:500);
}
introVideo.addEventListener('ended',()=>{if(introPhase==='playing')revealMap(introRun);});
introVideo.addEventListener('error',()=>{if(introPhase==='playing')revealMap(introRun);});
$('explore-map').addEventListener('click',beginIntro);
$('skip-intro').addEventListener('click',()=>{introPhase='done';explore();$('map-stage').classList.add('map-entering');});
function selectTour(tour,autoplay=true){
 selectedTour=tour;
 const ids=tour.dataset.stops.split(' ');
 tours.forEach(item=>{item.classList.toggle('is-selected',item===tour);item.querySelector('.select-tour').setAttribute('aria-pressed',String(item===tour));item.querySelector('.tour-price')?.setAttribute('hidden','');});
 tour.querySelector('.tour-price')?.removeAttribute('hidden');
 document.querySelector('.itinerary-panel').hidden=false;
 $('attraction-list').hidden=false;$('toggle-itinerary').setAttribute('aria-expanded','true');$('toggle-itinerary').textContent='−';$('toggle-itinerary').setAttribute('aria-label','Collapse itinerary');
 const title=tour.querySelector('h4').textContent;
 $('itinerary-title').textContent=title;
 const bounds=map?L.latLngBounds():null;
 ids.forEach(id=>{const stop=Array.from(stops).find(item=>item.dataset.stop===id);if(stop){$('attraction-list').appendChild(stop);if(bounds)bounds.extend(latLng(stop));}});
 stops.forEach(stop=>{stop.hidden=!ids.includes(stop.dataset.stop);stop.querySelector('small').textContent=tour.dataset.tour==='nile-cruise-8-days'?stop.dataset.originalLabel:'Stop '+(ids.indexOf(stop.dataset.stop)+1);stop.querySelector('p').hidden=true;stop.querySelector('button').setAttribute('aria-pressed','false');});
 markers.forEach((marker,node)=>{if(!map)return;const show=node.classList.contains('city-tab')?(!node.hidden||tour.dataset.cities.split(' ').includes(node.dataset.city)):ids.includes(node.dataset.stop);if(show){if(!map.hasLayer(marker))marker.addTo(map);}else if(map.hasLayer(marker))map.removeLayer(marker);});
 $('selected-tour-name').textContent=title;$('selected-tour-description').textContent=tour.dataset.description;$('selected-tour-summary').hidden=false;
 story(title,tour.dataset.description+' Your itinerary includes '+ids.map(id=>Array.from(stops).find(stop=>stop.dataset.stop===id)?.querySelector('strong').textContent).filter(Boolean).join(', ')+'.',autoplay);
 if(map&&bounds.isValid()){const mobile=matchMedia('(max-width:600px)').matches;map.fitBounds(bounds,{paddingTopLeft:L.point(mobile?35:330,mobile?110:120),paddingBottomRight:L.point(mobile?35:330,mobile?140:260),maxZoom:12,animate:!reduceMotion});}
}
tours.forEach(tour=>tour.querySelector('.select-tour').addEventListener('click',()=>selectTour(tour)));
cities.forEach(city=>{const count=document.createElement('span');count.className='city-tour-count';const total=cityTours(city).length;count.textContent=total+' '+(total===1?'tour':'tours');city.appendChild(count);});
$('guide-toggle').addEventListener('click',()=>speaking?stopVoice():speak(activeStory));
$('show-all').addEventListener('click',()=>{updateMarkerVisibility(true);fitRoute(true);$('map-status').textContent='Showing all '+stops.length+' places from the tour catalogue. Select a marker to explore.';});
$('toggle-labels').addEventListener('click',event=>{
 const on=event.currentTarget.getAttribute('aria-pressed')!=='true';event.currentTarget.setAttribute('aria-pressed',String(on));$('map-stage').classList.toggle('hide-labels',!on);
 if(map&&labelLayer){if(on)labelLayer.addTo(map);else map.removeLayer(labelLayer);}
});
function edit(){
 stage('chat');document.querySelectorAll('#chat-log [data-question]').forEach(item=>{if(Number(item.dataset.question)>=0)item.remove();});ask(0,true);
}
$('edit-trip').addEventListener('click',edit);
$('restart').addEventListener('click',()=>{
 questions.forEach(form=>form.reset());Object.keys(state).forEach(key=>delete state[key]);
 photoReady=false;if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;$('photo-preview').hidden=true;
 $('photo-next').textContent='Skip for now →';$('photo-status').textContent='Your photo stays in this browser. Automatic recognition is not connected.';
 $('departure').setCustomValidity('');$('departure').min=localToday();$('handoff-status').textContent='';
 try{sessionStorage.removeItem('trippio-assistant-booking');}catch(_){}
 edit();
});
$('toggle-itinerary').addEventListener('click',event=>{
 const open=event.currentTarget.getAttribute('aria-expanded')==='true';$('attraction-list').hidden=open;event.currentTarget.setAttribute('aria-expanded',String(!open));event.currentTarget.textContent=open?'+':'−';event.currentTarget.setAttribute('aria-label',open?'Expand itinerary':'Collapse itinerary');
});
$('toggle-tour').addEventListener('click',event=>{
 const open=event.currentTarget.getAttribute('aria-expanded')==='true';$('tour-options').hidden=open;$('selected-tour-summary').hidden=open||!selectedTour;document.querySelector('.tour-dock-footer').hidden=open;event.currentTarget.setAttribute('aria-expanded',String(!open));event.currentTarget.textContent=open?'+':'−';event.currentTarget.setAttribute('aria-label',open?'Expand tours':'Collapse tours');document.querySelector('.tour-dock').classList.toggle('collapsed',open);$('map-stage').classList.toggle('tour-collapsed',open);
});
document.querySelectorAll('[data-assistant-booking]').forEach(link=>link.addEventListener('click',event=>{
 if(event.currentTarget.getAttribute('aria-disabled')==='true'){event.preventDefault();$('handoff-status').textContent='Choose at least 8 travel days, or use the tailor-made trip link.';return;}
 gather();const details={};
 for(const input of document.querySelectorAll('.chat-question input[name]:not([type=checkbox]),.chat-question textarea[name]'))details[input.name]=input.value;
 details.message='AI planner interests: '+(state.interests.join(', ')||'Open to suggestions')+'. Cities: '+selectedCities().map(city=>city.querySelector('strong').textContent).join(', ')+'. '+details.message;
 details.savedAt=Date.now();details.tour=event.currentTarget.closest('.tour-option').dataset.tour;
 details.message='Selected tour: '+event.currentTarget.closest('.tour-option').querySelector('h4').textContent+'. '+details.message;
 try{sessionStorage.setItem('trippio-assistant-booking',JSON.stringify(details));}
 catch(_){event.preventDefault();$('handoff-status').textContent='Your browser blocked session storage. Enable it to carry your answers, or open tour-details.html and enter them manually.';}
}));
window.addEventListener('pagehide',()=>{introRun++;introTimers.forEach(clearTimeout);introVideo.pause();stopVoice();weather?.cancel();clearInterval(weatherTimer);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopVoice();});
window.addEventListener('resize',()=>{if(map&&document.body.dataset.stage==='map')map.invalidateSize();});
ask(0,true);
})();

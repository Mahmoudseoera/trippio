/* Quiz prompts, cities, coordinates, stops and tour facts are authored in HTML.
   Only visitor answers and runtime map/weather state are held in JavaScript. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const questions = document.querySelectorAll('.chat-question');
const cities = document.querySelectorAll('.city-tab');
const tours = document.querySelectorAll('.tour-option');
const introVideo = $('intro-video');
function positionTablet(){
 const width=introVideo.clientWidth,height=introVideo.clientHeight;
 if(!width||!height)return;
 const scale=Math.max(width/1280,height/720);
 const position=matchMedia('(max-width:900px)').matches ? .492 : .65;
 Object.assign($('explore-map').style,{
  left:(492*scale+(width-1280*scale)*position)+'px',
  top:(453*scale+(height-720*scale)*.5)+'px',
  width:(280*scale)+'px',height:(169*scale)+'px'
 });
}
introVideo.addEventListener('loadedmetadata',positionTablet);
window.addEventListener('resize',positionTablet);
let routeLayer, routeNumbers, openingMap=false;
let selectedTour = null, introPhase = 'ready', introRun = 0;
const introTimers = new Set();
const stops = document.querySelectorAll('.attraction');
stops.forEach(stop=>{stop.dataset.originalLabel=stop.querySelector('small').textContent;});
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const weather = window.TrippioWeather?.create();
const markers = new Map();
let questionIndex = 0, questionVersion = 0, map, activeCity, activeStop, speaking = false, narration, voiceVersion = 0, activeStory = '', labelLayer, weatherTimer;
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
 narration = new SpeechSynthesisUtterance(story); narration.lang='en-GB'; narration.rate=.78; narration.pitch=.95; narration.volume=.8;
 const voices=speechSynthesis.getVoices().filter(item=>item.lang.startsWith('en'));
 const voice=voices.find(item=>/\b(David|Mark|George|Daniel|James|Ryan|Guy|Thomas|Oliver|Alex)\b/i.test(item.name));
 if(!voice){$('map-status').textContent='No recognised male English voice is installed. Install one in your device speech settings; the itinerary remains available as text.';return;}
 narration.voice=voice; narration.lang=voice.lang;
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
 if(!openingMap)document.querySelectorAll('.tablet-expansion').forEach(element=>{element.getAnimations().forEach(animation=>animation.cancel());element.remove();});
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
  const input=form.querySelector('input:not([type=checkbox]),textarea');
  if(input && matchMedia('(min-width: 901px)').matches)input.focus({preventScroll:true});
 };
 if(immediate||reduceMotion)show();else setTimeout(show,450);
}
function gather(){
 questions.forEach(form=>{for(const input of form.querySelectorAll('[name]'))if(input.name!=='interest'&&input.name!=='city')state[input.name]=input.value;});
 state.interests=Array.from(document.querySelectorAll('[name=interest]:checked'),input=>input.value);
 state.cities=Array.from(document.querySelectorAll('[name=city]:checked'),input=>input.value);
}
function formattedDate(value){return new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
questions.forEach((form,index)=>form.querySelector('[data-next-question]').addEventListener('click',event=>{
 event.preventDefault();
 if(index!==questionIndex)return;
 if(form.dataset.answer==='name')validatePhone(form);
 if(form.dataset.answer==='dates'){
  $('departure').setCustomValidity($('departure').value<=$('arrival').value?'Choose a departure after your arrival.':'');
 }
 if(!Array.from(form.querySelectorAll('input,textarea')).every(input=>input.reportValidity()))return;
 gather();let answer='';
 const kind=form.dataset.answer;
 if(kind==='name')answer=state.full_name;
 if(kind==='travelers')answer=state.adults+' adults · '+state.children+' children · '+state.infants+' infants';
 if(kind==='dates')answer=formattedDate(state.check_in)+' → '+formattedDate(state.check_out);
 if(kind==='interests')answer=Array.from(form.querySelectorAll('input:checked'),input=>input.nextElementSibling.textContent).join(' · ')||'Keep an open mind — show me your recommendations.';
 if(kind==='cities')answer=Array.from(form.querySelectorAll('input:checked'),input=>input.nextElementSibling.textContent).join(' · ')||'Please recommend a route for me.';
 if(kind==='contact')answer=state.message || (state.email?'My details are ready. Let’s go!':'All set. Show me my Egypt!');
 message(answer,'user',index);
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
$('previous-question').addEventListener('click',()=>{
 const previous=Math.max(0,questionIndex-1);
 document.querySelectorAll('#chat-log [data-question]').forEach(item=>{if(Number(item.dataset.question)>=previous)item.remove();});
 gather();ask(previous,true);
});
const artworkAnchors=Array.from(document.querySelectorAll('[data-map-x][data-lat]'),element=>({
 latitude:Number(element.dataset.lat),longitude:Number(element.dataset.lon),
 x:Number(element.dataset.mapX)*16.78,y:(100-Number(element.dataset.mapY))*9.38
}));
function projectToArtwork(latitude,longitude){
 const ranked=artworkAnchors.map(anchor=>({...anchor,distance:(anchor.latitude-latitude)**2+(anchor.longitude-longitude)**2})).sort((first,second)=>first.distance-second.distance);
 if(ranked[0].distance<1e-12)return L.latLng(ranked[0].y,ranked[0].x);
 const nearby=ranked.slice(0,4);
 const total=nearby.reduce((sum,anchor)=>sum+1/anchor.distance**2,0);
 return L.latLng(nearby.reduce((sum,anchor)=>sum+anchor.y/anchor.distance**2,0)/total,nearby.reduce((sum,anchor)=>sum+anchor.x/anchor.distance**2,0)/total);
}
function latLng(element){return projectToArtwork(Number(element.dataset.lat),Number(element.dataset.lon));}
function clearRoute(){if(routeLayer)routeLayer.remove();if(routeNumbers)routeNumbers.remove();routeLayer=null;routeNumbers=null;}
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
 const bounds=[[0,0],[938,1678]];
 map=L.map(view,{crs:L.CRS.Simple,minZoom:-2,maxZoom:2,zoomSnap:.25,zoomControl:false,scrollWheelZoom:true,maxBounds:[[-250,-400],[1188,2078]],maxBoundsViscosity:.8});
 L.control.zoom({position:'topright'}).addTo(map);
 L.imageOverlay('assets/images/assistant/egypt-illustrated-v2.png',bounds,{alt:'Illustrated Egypt travel map with approximate artwork positions and real destination coordinates'}).addTo(map);
 map.fitBounds(bounds,{animate:false});
 map.attributionControl.addAttribution('Illustrated positions · destination coordinates are geographic');
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
  const detailed=map.getZoom()>=.5;
  markers.forEach((marker,node)=>{const el=marker.getElement();if(el)el.classList.toggle('landmark-visible',detailed||node===activeStop);});
 });
 $('map-loading')?.remove();
}
function selectedCities(){return Array.from(cities).filter(city=>!city.hidden);}
function mapPadding(){
 const mobile=matchMedia('(max-width:600px)').matches;
 const dock=document.querySelector('.tour-dock').getBoundingClientRect();
 return {paddingTopLeft:L.point(mobile?24:340,mobile?145:130),paddingBottomRight:L.point(mobile?24:340,mobile?Math.round(innerHeight*.48):Math.ceil(dock.height)+55)};
}
function fitRoute(all=false){
 if(!map)return;
 const bounds=L.latLngBounds();
 (all?[...stops,...cities]:selectedCities()).forEach(element=>bounds.extend(latLng(element)));
 const mobile=matchMedia('(max-width:600px)').matches;
 if(bounds.isValid())map.fitBounds(bounds,{...mapPadding(),maxZoom:-.25,animate:!reduceMotion&&!openingMap});
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
 clearRoute();activeCity=city;activeStop=null;city.hidden=false;selectedTour=null;
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
 $('coordinate-readout').textContent=name+' · '+Number(city.dataset.lat).toFixed(5)+'° N, '+Number(city.dataset.lon).toFixed(5)+'° E';
 if(!available.length)$('tour-list-title').textContent=name+' · no catalogue tours yet';
 $('itinerary-title').textContent=name;
 story(name,city.querySelector('small').textContent+(available.length?'. Choose a tour to see its itinerary and hear its story.':'. No catalogue tours are published here yet. You can request a tailor-made trip.'),autoplay);
 weather?.load(city,state.check_in);
 showMarkerSelection(city);
 if(map){
  const bounds=L.latLngBounds();bounds.extend(latLng(city));
  stops.forEach(stop=>{if(stop.dataset.city===city.dataset.city)bounds.extend(latLng(stop));});
  const mobile=matchMedia('(max-width:600px)').matches;
  map.flyToBounds(bounds,{...mapPadding(),maxZoom:.5,animate:!reduceMotion&&!openingMap,duration:1.4});
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
 $('coordinate-readout').textContent=title+' · '+Number(stop.dataset.lat).toFixed(5)+'° N, '+Number(stop.dataset.lon).toFixed(5)+'° E';
 story(title,stop.querySelector('p').textContent);
 showMarkerSelection(stop);
 if(map){
  map.flyTo(latLng(stop),1,{animate:!reduceMotion&&!openingMap,duration:1.8});
  const mobile=matchMedia('(max-width:600px)').matches;
  map.once('moveend',()=>{if(activeStop===stop&&mobile)map.panBy(L.point(0,Math.round(innerHeight*.12)),{animate:false});});
 }
}
cities.forEach(city=>city.addEventListener('click',()=>selectCity(city)));
stops.forEach(stop=>stop.querySelector('button').addEventListener('click',()=>selectStop(stop)));
function explore(){
 gather();$('map-stage').classList.remove('map-entering');stage('map');
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
 if(map){if(openingMap)map.fitBounds([[0,0],[938,1678]],{animate:false});else fitRoute();}
 $('satellite-map').focus({preventScroll:true});
 clearInterval(weatherTimer);
 weatherTimer=setInterval(()=>{if(activeCity&&!document.hidden)weather?.load(activeCity,state.check_in,true);},300000);
}
function later(callback,delay){
 const timer=setTimeout(()=>{introTimers.delete(timer);callback();},delay);introTimers.add(timer);
}
function prepareIntro(){
 positionTablet();
 introRun++;introTimers.forEach(clearTimeout);introTimers.clear();introPhase='ready';
 $('intro-stage').classList.remove('intro-playing','intro-revealing');
 $('intro-copy').inert=false;introVideo.loop=false;introVideo.pause();
 try{introVideo.currentTime=0;}catch(_){}
 $('intro-status').textContent='';$('explore-map').disabled=false;
}
function finishOpening(run,clone){
 if(run!==introRun||document.body.dataset.stage!=='intro'){clone?.remove();return;}
 openingMap=true;
 introPhase='done';
 explore();
 openingMap=false;
 requestAnimationFrame(()=>{
  map?.invalidateSize({animate:false});
  if(!clone)return;
  const fade=clone.animate([{opacity:1},{opacity:0}],{duration:reduceMotion?0:220,fill:'forwards'});
  fade.finished.then(()=>clone.remove()).catch(()=>clone.remove());
 });
}
async function beginIntro(){
 if(introPhase!=='ready')return;
 introPhase='loading';
 const run=++introRun,tablet=$('explore-map');
 tablet.disabled=true;
 try{await tablet.querySelector('img').decode();}catch(error){
  if(run!==introRun)return;
  introPhase='ready';tablet.disabled=false;$('intro-status').textContent='The map image could not load. Check your connection and try again.';return;
 }
 if(run!==introRun||document.body.dataset.stage!=='intro')return;
 introPhase='playing';
 if(reduceMotion){finishOpening(run);return;}
 const rect=tablet.getBoundingClientRect(),target=$('intro-stage').getBoundingClientRect();
 const clone=tablet.cloneNode(true);
 clone.removeAttribute('id');clone.className='tablet-expansion';clone.setAttribute('aria-hidden','true');clone.tabIndex=-1;
 Object.assign(clone.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
 document.body.append(clone);
 $('intro-stage').classList.add('intro-playing');
 try{
  await clone.animate([
   {left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',borderRadius:'5px',opacity:1},
   {left:target.left+'px',top:target.top+'px',width:target.width+'px',height:target.height+'px',borderRadius:'0px',opacity:1}
  ],{duration:1000,easing:'cubic-bezier(.7,0,.25,1)',fill:'forwards'}).finished;
  finishOpening(run,clone);
 }catch(error){
  clone.remove();
  if(run===introRun&&document.body.dataset.stage==='intro'){introPhase='ready';tablet.disabled=false;$('intro-stage').classList.remove('intro-playing');}
 }
}
$('return-tablet').addEventListener('click',()=>{stage('intro');prepareIntro();$('explore-map').focus();});
$('explore-map').addEventListener('click',beginIntro);
$('skip-intro').addEventListener('click',()=>{const run=++introRun;document.querySelectorAll('.tablet-expansion').forEach(element=>{element.getAnimations().forEach(animation=>animation.cancel());element.remove();});finishOpening(run);});
function selectTour(tour,autoplay=true){
 clearRoute();selectedTour=tour;
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
 const orderedStops=ids.map(id=>Array.from(stops).find(stop=>stop.dataset.stop===id)).filter(Boolean);
 if(map){
  routeLayer=L.polyline(orderedStops.map(latLng),{color:'#b85632',weight:4,opacity:.95,dashArray:'9 8',className:'tour-route'}).addTo(map);
  routeNumbers=L.layerGroup().addTo(map);
  orderedStops.forEach((stop,index)=>{
   const icon=L.divIcon({className:'route-number',html:String(index+1),iconSize:[24,24],iconAnchor:[12,30]});
   L.marker(latLng(stop),{icon,title:'Stop '+(index+1)+': '+stop.querySelector('strong').textContent,zIndexOffset:1000}).on('click',()=>selectStop(stop)).addTo(routeNumbers);
  });
 }
 if(orderedStops[0]){orderedStops[0].querySelector('p').hidden=false;orderedStops[0].querySelector('button').setAttribute('aria-pressed','true');}
 $('selected-tour-name').textContent=title;$('selected-tour-description').textContent=tour.dataset.description;$('selected-tour-summary').hidden=false;
 story(title,tour.dataset.description+' Your itinerary includes '+ids.map(id=>Array.from(stops).find(stop=>stop.dataset.stop===id)?.querySelector('strong').textContent).filter(Boolean).join(', ')+'.',autoplay);
 if(map&&bounds.isValid())map.fitBounds(bounds,{...mapPadding(),maxZoom:.5,animate:!reduceMotion&&!openingMap});
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
 questions.forEach(form=>form.querySelectorAll('input,textarea').forEach(input=>{if(input.type==='checkbox')input.checked=input.defaultChecked;else input.value=input.defaultValue||'';}));$('requests-field').hidden=true;clearRoute();Object.keys(state).forEach(key=>delete state[key]);
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
let bookingTour=null;
const bookingForm=$('assistant-confirm-form');
function validatePhone(container){
 const code=container.querySelector('[name=phone_code]'),phone=container.querySelector('[name=phone]');
 phone.setCustomValidity(code.value.length+phone.value.length>15?'Country code and phone number must contain at most 15 digits together.':'');
}
document.querySelectorAll('[name=phone],[name=phone_code]').forEach(input=>{
 input.addEventListener('input',()=>{
  input.value=input.value.replace(/[^0-9]/g,'');
  validatePhone(input.closest('.chat-question,form'));
 });
});
document.querySelectorAll('[data-assistant-booking]').forEach(link=>{
 link.addEventListener('click',event=>{
  if(link.getAttribute('aria-disabled')==='true'){event.preventDefault();$('handoff-status').textContent='Choose at least 8 travel days or request a tailor-made trip.';return;}
  gather();
  try{sessionStorage.setItem('trippio-assistant-booking',JSON.stringify({...state,tour:link.closest('.tour-option').dataset.tour,savedAt:Date.now()}));}
  catch(error){event.preventDefault();$('handoff-status').textContent='Temporary storage is unavailable. Enable session storage to carry your details to the tour page.';}
 });
 const button=document.createElement('button');button.type='button';button.className='confirm-trip';
 button.textContent='Confirm this trip →';link.after(button);
 button.addEventListener('click',()=>{
  gather();bookingTour=link.closest('.tour-option');
  if(link.getAttribute('aria-disabled')==='true'){$('handoff-status').textContent='Choose at least 8 travel days or request a tailor-made trip.';return;}
  for(const name of ['full_name','email','phone_code','phone','message'])bookingForm.elements[name].value=state[name]||'';
  bookingForm.elements.consent.checked=false;
  $('booking-trip').textContent=bookingTour.querySelector('h4').textContent;
  $('booking-dates').textContent=formattedDate(state.check_in)+' – '+formattedDate(state.check_out)+' · '+state.adults+' adults · '+state.children+' children · '+state.infants+' infants';
  $('booking-preferences').textContent='Cities: '+(state.cities.join(', ')||'Recommended route')+' · Interests: '+(state.interests.join(', ')||'Open to suggestions');
  $('booking-error').textContent='';stopVoice();$('booking-review').showModal();
 });
});
$('close-booking').addEventListener('click',()=>$('booking-review').close());
bookingForm.addEventListener('submit',event=>{
 event.preventDefault();validatePhone(bookingForm);
 if(!bookingForm.reportValidity()||!bookingTour)return;
 const details={...state,tour:bookingTour.dataset.tour,tour_title:bookingTour.querySelector('h4').textContent,stops:bookingTour.dataset.stops.split(' '),savedAt:Date.now(),mode:'preview',sent:false};
 for(const name of ['full_name','email','phone_code','phone','message'])details[name]=bookingForm.elements[name].value.trim();
 try{
  sessionStorage.setItem('trippio-assistant-confirmation',JSON.stringify(details));
  location.assign('assistant-confirmation.html');
 }catch(error){$('booking-error').textContent='Your browser blocked temporary storage. Allow session storage and try again. Nothing has been sent.';}
});
window.addEventListener('pagehide',()=>{introRun++;introTimers.forEach(clearTimeout);introVideo.pause();stopVoice();weather?.cancel();clearInterval(weatherTimer);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopVoice();});
window.addEventListener('resize',()=>{if(map&&document.body.dataset.stage==='map')map.invalidateSize();});
document.querySelectorAll('[name=city]').forEach(input=>{
 const city=Array.from(cities).find(item=>item.dataset.city===input.value);
 if(city)input.nextElementSibling.append(' · '+cityTours(city).length+' tours');
});
$('has-requests').addEventListener('change',event=>{
 $('requests-field').hidden=!event.target.checked;
 const input=$('requests-field').querySelector('textarea');
 if(event.target.checked)input.focus();else input.value='';
});
questions.forEach(question=>question.addEventListener('keydown',event=>{
 if(event.key==='Enter'&&event.target.tagName==='INPUT'&&!['checkbox'].includes(event.target.type)){
  event.preventDefault();question.querySelector('[data-next-question]').click();
 }
}));
tours.forEach(tour=>{
 const button=tour.querySelector('.select-tour');
 const heading=tour.querySelector('h4');
 const titleButton=document.createElement('button');titleButton.type='button';titleButton.className='tour-title-button';titleButton.textContent=heading.textContent;heading.replaceChildren(titleButton);titleButton.addEventListener('click',()=>button.click());
 const photo=tour.querySelector('img');const photoButton=document.createElement('button');photoButton.type='button';photoButton.className='tour-photo-button';photoButton.setAttribute('aria-label','View '+heading.textContent+' itinerary');photo.replaceWith(photoButton);photoButton.append(photo);photoButton.addEventListener('click',()=>button.click());
 const content=document.createElement('p');content.className='tour-description';content.textContent=tour.dataset.description;heading.after(content);
 if(!tour.querySelector('.tour-price strong')){const price=document.createElement('p');price.className='price-label';price.textContent='Price per person · on request';button.before(price);}
});
document.querySelectorAll('.attraction-story').forEach(content=>{
 const toggle=document.createElement('button');toggle.type='button';toggle.className='story-more';toggle.textContent='Show more';toggle.setAttribute('aria-expanded','false');content.after(toggle);
 toggle.addEventListener('click',()=>{const expanded=content.classList.toggle('expanded');toggle.textContent=expanded?'Show less':'Show more';toggle.setAttribute('aria-expanded',String(expanded));});
});
$('planner-schema').textContent=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:document.title,description:document.querySelector('meta[name=description]').content,mainEntity:{'@type':'ItemList',itemListElement:Array.from(tours,(tour,index)=>({'@type':'ListItem',position:index+1,item:{'@type':'TouristTrip',name:tour.querySelector('h4').textContent,description:tour.dataset.description}}))}});
ask(0,true);
})();

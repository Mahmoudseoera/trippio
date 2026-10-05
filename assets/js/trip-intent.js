/* Trip Intent: one recoverable draft shared by comparison and recommendation. */
(() => {
'use strict';
const comparison = window.TrippioComparison;
if (!comparison) return;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Editorial facts from existing tour titles/descriptions; no inferred luxury/family claims.
const facts = {
 'giza-pyramids-sphinx': {culture:['Giza Pyramids','Sphinx','Burial chamber']},
 'karnak-valley-of-kings': {culture:['Karnak Temple','Valley of the Kings']},
 'felucca-sunset-sail': {relaxation:['Sunset felucca sail','Mint tea on board']},
 'diving-in-hurghada': {adventure:['Diving in Hurghada']}
};
const catalog = comparison.tours.map(t => ({...t, facts:facts[t.id] || {},
 items:Object.entries(facts[t.id] || {}).flatMap(([priority, names]) => names.map((title,i) => ({
 item_id:t.id+'-'+priority+'-'+i,title,priority,source_tour_id:t.id,source_tour_title:t.title
 })))}));
const key = 'trippio-trip-intent:v1';
// randomUUID requires a secure context; getRandomValues also supports local HTTP.
function createRequestKey() {
 if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
 const bytes = crypto.getRandomValues(new Uint8Array(16));
 bytes[6] = (bytes[6] & 15) | 64;
 bytes[8] = (bytes[8] & 63) | 128;
 const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
const fresh = () => ({request_key:createRequestKey(),version:1,status:'draft',journey_type:'customized_trip',source_tours:[],preferences:{culture:5,adventure:5,relaxation:5},
 recommended_tour:null,alternatives:[],selected_experiences:[],removed_experiences:[],customizations:[],
 travel_details:{travel_date:'',travelers:2,duration:1},estimated_price:null,notes:''});
let draft = fresh(), step=0, busy=false, contact={}, opener;
try {
 const saved=JSON.parse(localStorage.getItem(key));
 if(saved?.version===1) {
  draft={...fresh(),...saved,status:'draft'};
  draft.source_tours=(Array.isArray(saved.source_tours)?saved.source_tours:[]).filter(t=>catalog.some(c=>c.id===t.id));
  draft.selected_experiences=(Array.isArray(saved.selected_experiences)?saved.selected_experiences:[]).flatMap(i=>catalog.flatMap(t=>t.items).filter(x=>x.item_id===i.item_id));
  draft.removed_experiences=Array.isArray(saved.removed_experiences)?saved.removed_experiences:[];
  draft.preferences=Object.fromEntries(['culture','adventure','relaxation'].map(p=>[p,Math.max(0,Math.min(10,Number(saved.preferences?.[p])||0))]));
  draft.travel_details={...fresh().travel_details,...saved.travel_details};
  for(const [field,max] of [['travelers',99],['duration',90]]) {
   const value=Number(draft.travel_details[field]);
   draft.travel_details[field]=Number.isInteger(value)&&value>=1&&value<=max?value:fresh().travel_details[field];
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.travel_details.travel_date))draft.travel_details.travel_date='';
  if(!draft.recommended_tour||!catalog.some(t=>t.id===draft.recommended_tour.id))draft.recommended_tour=null;
  if(typeof draft.request_key!=='string'||!/^[a-f0-9-]{36}$/i.test(draft.request_key))draft.request_key=createRequestKey();
  draft.customizations=Array.isArray(saved.customizations)?saved.customizations:[];
  draft.estimated_price=null;
  draft.notes=typeof saved.notes==='string'?saved.notes.slice(0,2000):'';
 }
} catch (_) {}
const emit=(name,detail={})=>document.dispatchEvent(new CustomEvent('trippio:analytics',{detail:{event:name,...detail}}));
const persist=()=>{try {localStorage.setItem(key,JSON.stringify(draft));} catch (_) {status('Your browser could not save this draft. Keep this tab open.');}};
const root=document.getElementById('tc-root');
const modal=document.createElement('dialog');
modal.id='ti-dialog';modal.setAttribute('aria-labelledby','ti-title');
root.append(modal);
const button=(label,action,extra='')=>'<button type="button" class="button" data-ti="'+action+'" '+extra+'>'+label+'</button>';
const toolbar=document.createElement('div');toolbar.className='ti-entry';
toolbar.innerHTML='<div><strong>Your trip, your way</strong><p>Compare favourites, find your match, or build a trip from the experiences you love.</p></div><div class="ti-actions">'+button('Find my best match','recommend')+button('Build my ideal trip','build')+button('Resume my trip','resume')+'</div>';
document.querySelector('.tour-card-v2, [data-compare-card]').parentElement.before(toolbar);
const footer=document.querySelector('#tc-comparison-dialog .modal-footer');
footer.insertAdjacentHTML('afterbegin','<div class="ti-actions">'+button('Build my ideal trip','build')+button('Find my best match','recommend')+'</div>');
const observer=new MutationObserver(()=>{
 document.querySelectorAll('#tc-matrix-head .matrix-card').forEach(card=>{
  if(card.querySelector('[data-ti]'))return;
  const id=card.querySelector('[data-remove]').dataset.remove;
  card.insertAdjacentHTML('beforeend','<div class="ti-actions">'+button('Choose this tour','choose','data-id="'+esc(id)+'"')+button('Add to my trip','add','data-id="'+esc(id)+'"')+'</div>');
 });
});
observer.observe(document.getElementById('tc-matrix-head'),{childList:true});
function status(message){const el=modal.querySelector('[role="status"]');if(el)el.textContent=message;}
function pool(){return draft.source_tours.map(t=>catalog.find(c=>c.id===t.id)).filter(Boolean);}
function addSources(tours){for(const t of tours)if(!draft.source_tours.some(x=>x.id===t.id))draft.source_tours.push({id:t.id,title:t.title,url:t.url});}
function ranking(){
 const total=Object.values(draft.preferences).reduce((a,b)=>a+b,0);
 return catalog.map(t=>({tour:t,score:total?Math.round(Object.entries(draft.preferences).reduce((sum,[p,w])=>sum+(t.facts[p]?w:0),0)/total*100):0}))
 .sort((a,b)=>b.score-a.score||a.tour.id.localeCompare(b.tour.id));
}
function choose(id,recommended=false){
 const t=catalog.find(t=>t.id===id);if(!t)return;
 addSources([t]);
 for(const item of t.items)if(!draft.selected_experiences.some(i=>i.item_id===item.item_id))draft.selected_experiences.push(item);
 draft.removed_experiences=draft.removed_experiences.filter(i=>!t.items.some(x=>x.item_id===i.item_id));
 if(recommended){
  const results=ranking();draft.recommended_tour={id:t.id,title:t.title,match_score:results.find(x=>x.tour.id===id).score};
  draft.alternatives=results.filter(x=>x.tour.id!==id).map(x=>({id:x.tour.id,title:x.tour.title,match_score:x.score}));
 }
}
function open(action,id){
 opener=document.activeElement;
 document.getElementById('tc-comparison-dialog').close();
 if(action==='recommend'){draft.journey_type='recommendation';step=0;emit('recommendation_started');}
 else if(action!=='resume'){
  draft.journey_type=action==='choose'?'comparison':'customized_trip';
  addSources(id?catalog.filter(t=>t.id===id):comparison.getSelected().length?comparison.getSelected():catalog);
  if(action==='choose')choose(id);
  step=1;emit('trip_builder_started');
 }
 persist();render();modal.showModal();document.body.classList.add('tc-modal-open');emit('trip_request_started');
}
function validTravel(){
 return ['travelers','duration'].every(k=>Number.isInteger(draft.travel_details[k])&&draft.travel_details[k]>=1&&draft.travel_details[k]<=(k==='travelers'?99:90)) &&
 (!draft.travel_details.travel_date || /^\d{4}-\d{2}-\d{2}$/.test(draft.travel_details.travel_date));
}
function review(){
 const items=draft.selected_experiences.map(i=>'<li>'+esc(i.title)+'<small>From '+esc(i.source_tour_title)+'</small></li>').join('');
 return '<div class="ti-summary"><h3>Your trip request</h3>'+
 (draft.recommended_tour?'<p><strong>'+esc(draft.recommended_tour.title)+'</strong> · '+esc(draft.recommended_tour.match_score)+'% priority match</p>':'')+
 '<p><strong>Your priorities:</strong> '+Object.entries(draft.preferences).map(([p,w])=>esc(p)+' '+w+'/10').join(' · ')+'</p>'+
 '<ul>'+items+'</ul><p><strong>Travel:</strong> '+esc(draft.travel_details.travelers)+' travelers · '+esc(draft.travel_details.duration)+' days · '+esc(draft.travel_details.travel_date||'Date flexible')+'</p>'+
 '<p><strong>Estimated trip price: Price to be confirmed</strong></p><p>Individual experiences are not separately priced. Final price and availability will be confirmed by our travel team.</p>'+
 (draft.notes?'<details><summary>Special requests</summary><p class="ti-notes">'+esc(draft.notes)+'</p></details>':'')+
 '<details><summary>Tours considered ('+draft.source_tours.length+')</summary><ul>'+draft.source_tours.map(t=>'<li>'+esc(t.title)+'</li>').join('')+'</ul></details></div>';
}
function render(){
 const titles=['Find your best match','Build your ideal trip','Review your trip','Send your trip request'];
 modal.innerHTML='<div class="modal-heading"><div><p class="eyebrow">YOUR TRIP, YOUR WAY</p><h2 id="ti-title" tabindex="-1">'+titles[step]+'</h2></div>'+button('×','close','aria-label="Close trip builder"')+'</div>'+
 '<nav class="ti-steps" aria-label="Trip progress">'+['Priorities','Experiences','Review','Contact'].map((s,i)=>'<button type="button" data-ti="step" data-step="'+i+'" '+(i===step?'aria-current="step"':'')+'>'+ (i+1)+'. '+s+'</button>').join('')+'</nav><div class="ti-body"></div><p class="ti-status" role="status" aria-live="polite"></p>';
 const body=modal.querySelector('.ti-body');
 if(step===0){
  body.innerHTML='<p>Tell us what matters most. Weight each priority from 0 (not important) to 10.</p><div class="ti-priorities">'+Object.entries(draft.preferences).map(([p,w])=>'<label>'+p+' <output id="ti-value-'+p+'">'+w+'</output><input type="range" min="0" max="10" value="'+w+'" data-priority="'+p+'" aria-label="'+p+' priority"></label>').join('')+'</div><p class="ti-muted">Matching uses documented cultural, adventure and relaxation experiences. The score is the share of your weighted priorities supported by each tour, not a quality rating. Other attributes need verified catalog data.</p>'+button('Find my match','calculate')+'<div id="ti-results"></div>';
 } else if(step===1){
  if(!pool().length)addSources(catalog);
  body.innerHTML='<p>Pick the experiences you love. We keep the source tour with every selection.</p><div class="ti-tour-grid">'+pool().map(t=>'<section class="ti-tour"><a href="'+esc(t.url)+'"><img src="'+esc(t.image)+'" alt="'+esc(t.title)+'" title="'+esc(t.title)+'" width="360" height="180"><h3>'+esc(t.title)+'</h3></a><p>'+esc(t.duration)+' · '+esc(t.city)+'</p><p class="ti-muted">Listed estimate: '+esc(t.price)+' / person for the original tour</p>'+t.items.map(item=>'<label class="ti-check"><input type="checkbox" data-item="'+esc(item.item_id)+'" '+(draft.selected_experiences.some(i=>i.item_id===item.item_id)?'checked':'')+'>'+esc(item.title)+'</label>').join('')+(!t.items.length?'<p>Individual experiences need confirmation from the travel team.</p>':'')+'</section>').join('')+'</div>'+button('Review my trip','review');
 } else if(step===2){
  body.innerHTML='<div class="ti-fields"><label>Travel date (optional)<input type="date" data-travel="travel_date" value="'+esc(draft.travel_details.travel_date)+'"></label><label>Travelers<input type="number" min="1" max="99" step="1" data-travel="travelers" value="'+esc(draft.travel_details.travelers)+'"></label><label>Desired duration (days)<input type="number" min="1" max="90" step="1" data-travel="duration" value="'+esc(draft.travel_details.duration)+'"></label><label class="ti-wide">Special requests<textarea maxlength="2000" data-notes>'+esc(draft.notes)+'</textarea></label></div><div id="ti-review">'+review()+'</div><div class="ti-actions">'+button('Edit experiences','step','data-step="1"')+button('Continue to contact','contact')+'</div>';
 } else {
  body.innerHTML='<p><strong>Here’s what we’ll send to our travel team</strong></p>'+review()+
  '<form id="ti-contact"><div class="ti-fields"><label>Full name<input name="name" autocomplete="name" required maxlength="120" value="'+esc(contact.name||'')+'"></label><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254" value="'+esc(contact.email||'')+'"></label><label>Country calling code<input name="country_code" type="tel" inputmode="numeric" pattern="[0-9]{1,4}" maxlength="4" placeholder="Country code without +" required value="'+esc(contact.country_code||'')+'"></label><label>WhatsApp / phone<input name="phone" type="tel" autocomplete="tel-national" inputmode="numeric" pattern="[0-9]{6,15}" maxlength="15" required value="'+esc(contact.phone||'')+'"></label></div><label class="ti-check"><input type="checkbox" name="consent" required> I agree to be contacted about this trip request.</label><p class="ti-muted">'+(window.TrippioTripTransport?'Your complete trip summary is attached automatically.':'Online delivery is not connected yet. You can download your request; it will not be sent to the travel team.')+'</p><div class="ti-actions"><button class="button" type="submit" '+(!window.TrippioTripTransport?'disabled':'')+'>Send my trip request</button>'+button('Download trip request','download')+button('Edit my trip','step','data-step="2"')+'</div></form>';
  body.querySelector('form').addEventListener('input',e=>{if(['phone','country_code'].includes(e.target.name))e.target.value=e.target.value.replace(/\D/g,'');contact=Object.fromEntries(new FormData(e.currentTarget));});
  body.querySelector('form').addEventListener('submit',submit);
 }
 modal.querySelector('#ti-title').focus({preventScroll:true});
}
async function submit(e){
 e.preventDefault();if(busy||!window.TrippioTripTransport)return;
 const form=e.currentTarget;if(!form.reportValidity()||!validTravel())return;
 contact=Object.fromEntries(new FormData(form));
 busy=true;form.querySelector('[type="submit"]').disabled=true;status('Sending your trip request…');
 try{
  const result=await window.TrippioTripTransport.submit({...draft,customer:{...contact},estimated_price:null});
  if(!result?.id||result.status!=='submitted')throw Error('The travel team has not confirmed receipt. Please try again.');
  try {localStorage.removeItem(key);} catch (_) {} emit('trip_request_submitted',{request_id:result.id});
  location.assign('thank-you.html');
 }catch(error){status(error.message||'Unable to send. Your draft is preserved.');}
 finally{busy=false;form.querySelector('[type="submit"]').disabled=false;}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-ti]');if(!b)return;
 const action=b.dataset.ti;
 if(['build','recommend','resume','choose','add'].includes(action)){open(action,b.dataset.id);return;}
 if(!modal.contains(b))return;
 if(action==='close'){modal.close();return;}
 if(action==='calculate'){
  if(!Object.values(draft.preferences).some(Boolean)){status('Choose at least one priority above zero.');return;}
  const results=ranking();addSources(catalog);
  modal.querySelector('#ti-results').innerHTML='<h3>Your best matches</h3>'+results.map((r,i)=>'<article class="ti-match"><strong>'+esc(r.tour.title)+'</strong><span>'+r.score+'% priority match'+(i===0?' · Best match':'')+'</span><p>Supported priorities: '+Object.keys(r.tour.facts).filter(p=>draft.preferences[p]>0).map(esc).join(', ')+'<br>Documented experiences: '+r.tour.items.map(x=>esc(x.title)).join(', ')+'</p>'+button('Use this trip','accept','data-id="'+esc(r.tour.id)+'"')+'</article>').join('')+button('Compare top alternatives','alternatives');
  emit('recommendation_completed');persist();return;
 }
 if(action==='accept'){choose(b.dataset.id,true);step=1;}
 if(action==='alternatives'){modal.close();comparison.compare(ranking().slice(0,3).map(r=>r.tour.id));return;}
 if(action==='step'||action==='review'||action==='contact'){
  const next=action==='step'?Number(b.dataset.step):action==='review'?2:3;
  if(next>=2&&!draft.selected_experiences.length){status('Select at least one experience to review your trip.');return;}
  if(next===3&&!validTravel()){status('Enter a valid traveler count (1-99) and duration (1-90 days).');return;}
  if(next===3){
   const fields=[...modal.querySelectorAll('[data-travel]')];if(fields.some(f=>!f.reportValidity()))return;
  }
  step=next;
 }
 if(action==='download'){
  const form=modal.querySelector('form');if(!form.reportValidity()||!validTravel())return;
  contact=Object.fromEntries(new FormData(form));
  const blob=new Blob([JSON.stringify({...draft,customer:contact},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-trip-request.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Downloaded to your device. This request has not been sent.');return;
 }
 persist();render();
});
modal.addEventListener('input',e=>{
 const el=e.target;
 if(el.dataset.priority){draft.preferences[el.dataset.priority]=Number(el.value);modal.querySelector('#ti-value-'+el.dataset.priority).textContent=el.value;modal.querySelector('#ti-results').innerHTML='';draft.recommended_tour=null;draft.alternatives=[];}
 if(el.dataset.travel){draft.travel_details[el.dataset.travel]=el.type==='number'?Number(el.value):el.value;}
 if(el.hasAttribute('data-notes'))draft.notes=el.value;
 if(el.dataset.travel||el.hasAttribute('data-notes'))modal.querySelector('#ti-review').innerHTML=review();
 if(el.dataset.item){
  const item=catalog.flatMap(t=>t.items).find(i=>i.item_id===el.dataset.item);
  if(el.checked){draft.selected_experiences.push(item);draft.removed_experiences=draft.removed_experiences.filter(i=>i.item_id!==item.item_id);emit('experience_added',{item_id:item.item_id});}
  else{draft.selected_experiences=draft.selected_experiences.filter(i=>i.item_id!==item.item_id);draft.removed_experiences.push(item);emit('experience_removed',{item_id:item.item_id});}
 }
 persist();
});
modal.addEventListener('close',()=>{document.body.classList.remove('tc-modal-open');opener?.focus({preventScroll:true});});
})();


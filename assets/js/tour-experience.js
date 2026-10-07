(function () {
"use strict";

/* Markup is static HTML (what Blade will output). The script only reads data-* attributes and animates. */
const root=document.querySelector('.tour-experience'); if(!root)return; const $=s=>root.querySelector(s),clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),ease=t=>t*t*(3-2*t);
// Keep the five-tile mosaic while retaining every item in the lightbox.
const galleryItems = Array.from($('#gal').querySelectorAll('a'));
galleryItems.forEach((item, index) => {
 item.hidden = index >= 5;
 item.querySelector('.gallery-more-count')?.remove();
});
const extraGalleryItems = Math.max(0, galleryItems.length - 5);
if (extraGalleryItems) {
 const count = document.createElement('span');
 count.className = 'gallery-more-count';
 count.textContent = '+' + extraGalleryItems;
 count.setAttribute('aria-label', extraGalleryItems + ' more gallery items');
 galleryItems[4].appendChild(count);
}
try {
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const scenes=[...root.querySelectorAll('.scene')],cards=[...root.querySelectorAll('.card')];
const N=cards.length,W=420,H=450,MAXS=N-.4;
const hav=(a,b)=>{const r=x=>x*Math.PI/180,dl=r(b[1]-a[1]),dn=r(b[0]-a[0]),h=Math.sin(dl/2)**2+Math.cos(r(a[1]))*Math.cos(r(b[1]))*Math.sin(dn/2)**2;return 2*6371*Math.asin(Math.sqrt(h))};
const fmtD=km=>Math.round(km).toLocaleString('en')+' km';
const fmtT=m=>m<60?m+' min':Math.floor(m/60)+' h'+(m%60?' '+m%60+' min':'');
const STOPS=cards.map(c=>({n:c.dataset.name,ll:[+c.dataset.lon,+c.dataset.lat],km:+c.dataset.km,min:+c.dataset.min,via:c.dataset.via}));
const legs=STOPS.map((s,i)=>i?{}:null);
const legText=l=>'Route overview';
const dusk=scenes.map(e=>e.children[1]),bgs=scenes.map(e=>e.children[0]);
const proj=([o,a])=>[(o-24.5)*32.7,(32-a)*43];

// distance from the visitor to the first stop (needs HTTPS or localhost, and permission)
function ask(){
 const out=$('#qdv'),st=STOPS[0];
 if(!navigator.geolocation){out.textContent='Not available in this browser';return}
 out.textContent='Locating you...';
 navigator.geolocation.getCurrentPosition(p=>{
  const km=hav([p.coords.longitude,p.coords.latitude],st.ll);
  out.innerHTML=km<2?`You are at ${st.n}`:`${fmtD(km)}<small>in a straight line to the start in ${st.n}</small>`;
 },()=>{out.innerHTML='Location unavailable <small>Allow location access, then <button type="button" class="lnk">try again</button></small>'},{timeout:10000,maximumAge:600000});
}
$('#qdv').addEventListener('click',e=>{if(e.target.closest('.lnk'))ask()});
$('#skip').addEventListener('click',e=>{const t=$(e.currentTarget.dataset.target);if(t)t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'})});

// day dots: jump straight to a stop
const dots=$('#dots');
const dotEls=[...dots.children];
dots.addEventListener('click',e=>{const k=dotEls.indexOf(e.target.closest('button'));if(k>=0)goDay(k)});
let act=-1;

// timeline in the header: jump to a day inside the pinned journey
function goDay(k){if(reduce){const day=cards[k];day.scrollIntoView({behavior:'auto',block:'start'});return}const st=$('#story'),y=scrollY+st.getBoundingClientRect().top+(k/MAXS)*(st.offsetHeight-innerHeight);scrollTo({top:y+(k?2:0),behavior:'smooth'})}
$('.tl').addEventListener('click',e=>{const b=e.target.closest('button');if(b)goDay(+b.dataset.day)});

// gallery lightbox (plain image links still work if the library is missing)
if(window.lightGallery)lightGallery($('#gal'),{plugins:[window.lgZoom,window.lgThumbnail,window.lgVideo].filter(Boolean),selector:'a',speed:400,thumbnail:true});

// hero: zoom the photo in, fade the title and the map while scrolling down; scrolling back to the top restores them
const hero=$('.hero');let hq=0;
const vid=$('.hero-video');if(vid)vid.muted=true;
// video stays on its first frame until the visitor starts scrolling; it pauses once the hero leaves the screen and resets at the very top
function heroVid(){if(!vid||reduce)return;const y=scrollY;
 if(y<=2){if(!vid.paused||vid.currentTime>0){vid.pause();vid.currentTime=0}}
 else if(y<hero.offsetHeight){if(vid.paused)vid.play().catch(()=>{})}
 else if(!vid.paused)vid.pause()}
function heroFx(){const p=reduce?0:clamp(scrollY/(Math.max(1,hero.offsetHeight)*.6));hero.style.setProperty('--hz',p.toFixed(3));hero.classList.toggle('fx',p>.55);heroVid()}
addEventListener('scroll',()=>{if(!hq)hq=requestAnimationFrame(()=>{hq=0;heroFx()})},{passive:true});addEventListener('resize',heroFx);heroFx();

// map
const pts=STOPS.map(s=>proj(s.ll));
let d=`M${pts[0]}`;
for(let i=0;i<pts.length-1;i++){const a=pts[Math.max(i-1,0)],b=pts[i],c=pts[i+1],e=pts[Math.min(i+2,pts.length-1)];d+=`C${b[0]+(c[0]-a[0])/6},${b[1]+(c[1]-a[1])/6} ${c[0]-(e[0]-b[0])/6},${c[1]-(e[1]-b[1])/6} ${c[0]},${c[1]}`}
const land=[[25,31.6],[32.3,31.3],[34.9,29.5],[34.2,28],[33.6,27.3],[34.9,25.1],[36.9,22],[25,22]].map(p=>proj(p)).join(' ');
const svg=$('#svg');
svg.innerHTML=`<polygon class="land" points="${land}"/><path id="route" class="ghost" d="${d}"/><path id="trail" class="trail" d="${d}"/>`+
 STOPS.map((s,i)=>`<g class="city"><circle cx="${pts[i][0]}" cy="${pts[i][1]}" fill="#fff" stroke="#061d35"/><text x="${pts[i][0]}" y="${pts[i][1]}" fill="#fff" font-family="Manrope,sans-serif" font-weight="700" paint-order="stroke" stroke="#061d35">${s.n}</text></g>`).join('')+
 `<g id="mk"><circle r="15" fill="rgba(227,189,104,.3)"/><circle r="6.5" fill="#fff" stroke="#e3bd68" stroke-width="3"/><polygon points="13,0 6,-5.5 6,5.5" fill="#e3bd68"/></g>`;
const route=$('#route'),trail=$('#trail'),mk=$('#mk'),L=route.getTotalLength(),cityEls=[...root.querySelectorAll('.city')];
let previousCityLength=0;
const cityLen=pts.map(p=>{let best=previousCityLength,bd=1e9;for(let l=previousCityLength;l<=L;l+=1){const q=route.getPointAtLength(l),dd=(q.x-p[0])**2+(q.y-p[1])**2;if(dd<bd){bd=dd;best=l}}previousCityLength=best;return best});
let chipKey=-1;

function draw(s){
 const i=Math.min(Math.floor(s),N-1),f=s-i,last=i>=N-1;
 const m=last?0:ease(clamp((f-.25)/.75)),pos=last?cityLen[i]:cityLen[i]+(cityLen[i+1]-cityLen[i])*m,fade=last?0:clamp((f-.55)/.45);
 let r=0;
 scenes.forEach((el,k)=>{
  el.style.opacity=k==i?1:k==i+1?fade:0; // only the current and next scene are painted
  const rv=k==i?(last?clamp(f/.6):f):k<i?1:0;if(k==i)r=rv;
  dusk[k].style.clipPath=`inset(0 ${(1-rv)*100}% 0 0)`;
  bgs[k].style.transform=`scale(${1.1-.1*clamp(s-k+.4)})`;
 });
 const hd=$('#handle');hd.style.left=r*100+'%';hd.style.opacity=1-fade;
 cards.forEach((c,k)=>{c.style.opacity=clamp(1-Math.abs(s-k)*1.7);c.style.transform=`translateY(${(k-s)*70}px)`});
 $('#bar').style.transform=`scaleX(${clamp(s/MAXS)})`;$('#hint').style.opacity=clamp(1-s*4);
 $('#skip').classList.toggle('off',s>MAXS-.1);
 const a=Math.min(N-1,Math.round(s));
 if(a!==act){act=a;dotEls.forEach((b,k)=>b.classList.toggle('on',k===a));$('#live').textContent=cards[a].querySelector('small').textContent}
 const leg=last?null:legs[i+1],chip=$('#chip');
 if(leg){
  if(chipKey!==i){chipKey=i;$('#ct').innerHTML=`${STOPS[i].n} to ${STOPS[i+1].n}<br>${legText(leg)}`}
  $('#ck').textContent='Next stop';chip.style.opacity=clamp(Math.sin(Math.PI*m)*2.5);
 }else chip.style.opacity=0;
 const pt=route.getPointAtLength(pos),p0=route.getPointAtLength(Math.max(0,pos-6)),p1=route.getPointAtLength(Math.min(L,pos+6));
 const ang=Math.atan2(p1.y-p0.y,p1.x-p0.x)*180/Math.PI,px=svg.clientWidth||300,ar=(svg.clientHeight||375)/px;
 const vw=170+150*Math.sin(Math.PI*m),vh=vw*ar,k=vw/px;
 const vx=clamp(pt.x-vw/2,0,Math.max(0,W-vw)),vy=clamp(pt.y-vh/2,0,Math.max(0,H-vh));
 svg.setAttribute('viewBox',`${vx} ${vy} ${vw} ${vh}`);
 mk.setAttribute('transform',`translate(${pt.x} ${pt.y}) rotate(${ang}) scale(${k})`);
 trail.style.strokeDasharray=`${pos} ${L+10}`;
 cityEls.forEach((c,j)=>{
  const a=c.children[0],t=c.children[1],seen=cityLen[j]<=pos+2;
  a.setAttribute('r',(seen?6:4.5)*k);a.setAttribute('stroke-width',2*k);a.setAttribute('fill',seen?'#e3bd68':'#fff');
  t.setAttribute('font-size',12*k);t.setAttribute('dx',11*k);t.setAttribute('dy',4*k);t.setAttribute('stroke-width',3*k);t.style.opacity=seen?1:.75;
 });
}
let cur=0,tgt=0;
const bar=$('#bookbar'),inc=$('#included'),bk=$('#quote');
const sync=()=>{
 const b=$('#story').getBoundingClientRect();tgt=clamp(-b.top/Math.max(1,b.height-innerHeight))*MAXS;
 // floating book bar: after the journey, hidden again once the booking section is on screen
 bar.classList.toggle('show',hero.getBoundingClientRect().bottom<0&&bk.getBoundingClientRect().top>innerHeight*.7);
};
let animationFrame=0;
function tick(){cur=reduce?tgt:cur+(tgt-cur)*.12;if(Math.abs(tgt-cur)<.0004)cur=tgt;draw(cur);animationFrame=cur!==tgt?requestAnimationFrame(tick):0;}
function schedule(){sync();if(!animationFrame)animationFrame=requestAnimationFrame(tick);}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);sync();cur=tgt;draw(cur);

} catch (error) { console.warn('Tour journey animation unavailable; itinerary remains readable.', error); }

// ---- quote request form ----

const f=$('#bf'),E=f.elements,ok=$('#ok'),G=['adults','children','infants'],T=new Set();

const today=(()=>{const d=new Date();d.setHours(0,0,0,0);return d})(),day=v=>v?new Date(v+'T00:00:00'):null,val=n=>E[n].value.trim();
const num=(n,min,max,what)=>{const v=val(n);if(v==='')return `Enter the number of ${what}.`;const x=+v;return Number.isInteger(x)&&x>=min&&x<=max?'':`Enter a whole number of ${what} from ${min} to ${max}.`};
const V={
 full_name:()=>{const v=val('full_name');if(!v)return'Please enter your full name.';return /^\p{L}[\p{L}\s'.-]*\p{L}$/u.test(v)&&v.split(/\s+/).length>1?'':'Enter your first and last name, using letters only.'},
 email:()=>{const v=val('email');if(!v)return'Please enter your email address.';return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)?'':'Enter a valid email, like name@example.com.'},
 phone:()=>{if(!E.phone_code.value)return'Choose your country code.';const v=val('phone');if(!v)return'Please enter your phone number.';if(!/^\d+$/.test(v))return'Use digits only.';const n=v.replace(/\D/g,'').length;return n<6||n>14?'A phone number has 6 to 14 digits.':''},
 nationality:()=>E.nationality.value?'':'Please select your nationality.',
 check_in:()=>{const d=day(val('check_in'));return!d||Number.isNaN(d.getTime())?'Please choose a check-in date.':d<today?'Check-in cannot be in the past.':''},
 check_out:()=>{const a=day(val('check_in')),b=day(val('check_out'));return!b||Number.isNaN(b.getTime())?'Please choose a check-out date.':a&&b<=a?'Check-out must be after check-in.':b<today?'Check-out cannot be in the past.':''},
 adults:()=>num('adults',1,99,'adults'),
 children:()=>num('children',0,99,'children'),
 infants:()=>num('infants',0,99,'infants')||(+val('infants')>+val('adults')?'Each infant needs an adult, so infants cannot exceed adults.':''),
 message:()=>val('message').length>1000?'Please keep your message under 1000 characters.':''
};
const vis=n=>E[n]._flatpickr?.altInput||E[n];
function setErr(n,m){
 $('#e-'+n).textContent=m;
 (n==='phone'?[E.phone_code,E.phone]:[vis(n)]).forEach(el=>{el.setAttribute('aria-invalid',m?'true':'false');el.setAttribute('aria-describedby','e-'+n)});
}
const check=n=>{const m=V[n]();setErr(n,m);return m};
const key=e=>e.target.name==='phone_code'?'phone':e.target.name;

// Match the published adult ranges without assigning rates to unlisted group sizes.
const pricingRows = Array.from(root.querySelectorAll('.td-price-table tbody tr[data-adults-min]'));
const pricingStatus = $('#pricingTierStatus');
function updatePricingTier() {
 const adults = Number(E.adults.value);
 const valid = Number.isInteger(adults) && adults >= 1 && adults <= Number(E.adults.max);
 const selected = valid ? pricingRows.find(row => adults >= Number(row.dataset.adultsMin) && adults <= Number(row.dataset.adultsMax)) : undefined;
 pricingRows.forEach(row => {
  row.classList.toggle('is-selected', row === selected);
  if (row === selected) row.setAttribute('aria-current', 'true');
  else row.removeAttribute('aria-current');
 });
 pricingStatus.textContent = selected ? 'Selected pricing: ' + selected.cells[0].textContent + ' - ' + selected.cells[1].textContent + '.' : valid ? 'Contact us for pricing for ' + adults + ' adults.' : 'Enter a valid adult count to highlight your pricing.';
}
E.adults.addEventListener('input', updatePricingTier);
E.adults.addEventListener('change', updatePricingTier);
f.addEventListener('reset', () => setTimeout(updatePricingTier, 0));
updatePricingTier();

f.addEventListener('focusout',e=>{const n=key(e);if(!V[n]||(n==='phone'&&[E.phone,E.phone_code].includes(e.relatedTarget)))return;T.add(n);check(n)});
E.phone.addEventListener('input',()=>{E.phone.value=E.phone.value.replace(/\D/g,'')});
f.addEventListener('input',e=>{const n=key(e);if(!V[n])return;
 if(G.includes(n)){T.add(n);G.forEach(x=>T.has(x)&&check(x));return}
 if(T.has(n))check(n)});
f.addEventListener('change',e=>{const n=key(e);if(n==='phone'||n==='nationality'){T.add(n);check(n)}});
root.querySelectorAll('.step button').forEach(b=>b.addEventListener('click',()=>{const i=b.parentElement.querySelector('input');i.value=clamp((+i.value||0)+ +b.dataset.d,+i.min,+i.max);i.dispatchEvent(new Event('input',{bubbles:true}))}));


// dates: flatpickr (check-out follows check-in; default stay is 7 nights, editable)
let fpIn,fpOut;
if(window.flatpickr){
 const mk=(n,x={})=>flatpickr(E[n],{altInput:true,altFormat:'d M Y',dateFormat:'Y-m-d',minDate:'today',disableMobile:true,onClose:()=>{T.add(n);check(n)},...x});
 fpOut=mk('check_out');
 fpIn=mk('check_in',{onChange:([d])=>{if(!d)return;const min=new Date(d);min.setDate(min.getDate()+1);fpOut.set('minDate',min);
  const cur=fpOut.selectedDates[0];if(!cur||cur<min){const e=new Date(d);e.setDate(e.getDate()+7);fpOut.setDate(e,true)}
  if(T.has('check_out'))check('check_out')}});
 [['check_in','ci'],['check_out','co']].forEach(([n,id])=>{const a=E[n]._flatpickr.altInput;a.id=id+'_alt';a.placeholder='Select date';a.removeAttribute('required');document.querySelector(`label[for=${id}]`).htmlFor=a.id});
}else{E.check_in.type=E.check_out.type='date';E.check_in.min=E.check_out.min=today.toISOString().slice(0,10)}

f.addEventListener('submit',async e=>{
 e.preventDefault();ok.className='';ok.textContent='';
 const bad=Object.keys(V).filter(n=>{T.add(n);return check(n)});
 if(bad.length){const n=bad[0];(n==='phone'?(E.phone_code.value?E.phone:E.phone_code):vis(n)).focus();ok.className='bad';ok.textContent='Please fix the highlighted fields and try again.';return}
 window.location.assign('thank-you.html?type=preview');
});

})();


// Independent controls stay usable even when a third-party library is unavailable.
(function () {
  'use strict';
  const root = document.querySelector('.tour-experience');
  if (!root) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const days = Array.from(root.querySelectorAll('#cards .card'));
  root.querySelector('.tour-print')?.addEventListener('click', () => window.print());

  const floating = document.getElementById('tourSectionFloat');
  const toggle = document.getElementById('tourSectionToggle');
  const panel = document.getElementById('tourSectionPanel');
  const currentLabel = document.getElementById('tourSectionCurrent');
  const list = document.getElementById('tourSectionLinks');
  const sections = Array.from(document.querySelectorAll('[data-tour-section]'));
  const links = sections.map(section => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = '#' + section.id;
    link.textContent = section.dataset.tourSection;
    li.appendChild(link);
    list.appendChild(li);
    return link;
  });
  function setOpen(open, restoreFocus = false) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('click', event => {
    if (!floating.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { setOpen(false, true); }
  });
  list.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || !list.contains(link)) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    setOpen(false);
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', link.hash);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
  let scheduled = false;
  function updateSection() {
    scheduled = false;
    floating.hidden = window.scrollY <= 16;
    const threshold = Math.min(window.innerHeight * .3, 180);
    let active = sections[0];
    sections.forEach(section => {
      if (section.getBoundingClientRect().top <= threshold) active = section;
    });
    currentLabel.textContent = active.dataset.tourSection;
    links.forEach(link => {
      if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const bookbar = root.querySelector('#bookbar');
    const quote = root.querySelector('#quote');
    bookbar.classList.toggle('show', root.querySelector('.hero').getBoundingClientRect().bottom < 0 && quote.getBoundingClientRect().top > window.innerHeight * .7);
    floating.classList.toggle('is-above-bookbar', bookbar.classList.contains('show'));
    if (floating.hidden) setOpen(false);
  }
  function scheduleSectionUpdate() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateSection); }
  }
  window.addEventListener('scroll', scheduleSectionUpdate, { passive: true });
  window.addEventListener('resize', scheduleSectionUpdate);
  updateSection();

  const pockets = Array.from(root.querySelectorAll('.bg-pocket'));
  pockets.forEach((pocket, index) => {
    const paragraph = pocket.querySelector('p');
    paragraph.id = 'packing-tip-' + index;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'bg-readmore'; button.textContent = 'Show more';
    button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', paragraph.id);
    paragraph.after(button);
    button.addEventListener('click', () => {
      const expanded = pocket.classList.toggle('is-expanded');
      button.setAttribute('aria-expanded', String(expanded)); button.textContent = expanded ? 'Show less' : 'Show more';
    });
    function measure() { button.hidden = !pocket.classList.contains('is-expanded') && paragraph.scrollHeight <= paragraph.clientHeight + 1; }
    measure(); window.addEventListener('resize', measure); document.fonts?.ready.then(measure);
  });

  // Generate metadata from the tour rendered on this page rather than the demo's tour.
  function schema(id, data) {
    let script = document.getElementById(id);
    if (!script) { script = document.createElement('script'); script.id = id; script.type = 'application/ld+json'; document.head.appendChild(script); }
    script.textContent = JSON.stringify(data);
  }
  schema('tour-trip-schema', {
    '@context': 'https://schema.org', '@type': 'TouristTrip', name: root.querySelector('h1').textContent,
    description: root.querySelector('#trip-overview p').textContent.trim(),
    itinerary: { '@type': 'ItemList', itemListElement: days.map((day, i) => ({ '@type': 'ListItem', position: i + 1, name: day.querySelector('h3').textContent })) },
    offers: { '@type': 'Offer', priceCurrency: 'USD', price: root.querySelector('.qbox-r b').textContent.replace(/[^0-9.]/g, ''), url: window.location.href.split('#')[0] }
  });
  const newsletter = document.querySelector('.newsletter-form');
  newsletter?.addEventListener('submit', event => {
    event.preventDefault();
    if (newsletter.reportValidity()) window.location.assign('thank-you.html?type=preview');
  });
})();

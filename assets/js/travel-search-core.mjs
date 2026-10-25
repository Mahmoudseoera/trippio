// Shared adapter: the authored assistant HTML remains the catalog, never a copy.
const clean = s => String(s || '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const attr = (s,k) => clean(s.match(new RegExp('\\b'+k+'="([^"]*)"'))?.[1]);
export function catalogFromHTML(html) {
  const stops = new Map([...html.matchAll(/<article\b([^>]*data-stop="[^"]+"[^>]*)>([\s\S]*?)<\/article>/g)].map(m=>[attr(m[1],'data-stop'),clean(m[2].match(/<strong>([\s\S]*?)<\/strong>/)?.[1])]));
  return [...html.matchAll(/<article\b([^>]*data-tour="[^"]+"[^>]*)>([\s\S]*?)<\/article>/g)].map(m=>{
    const [,a,b]=m, id=attr(a,'data-tour');
    let url=attr(b.match(/<a\b[^>]*data-assistant-booking[^>]*>/)?.[0] || '', 'href');
    // Existing detail pages were moved by the owner to AI Assistance/.
    if (/^tour-(?!details)[a-z-]+\.html/.test(url)) url='AI Assistance/'+url;
    if (!/^(?:AI Assistance\/)?tour-[a-z0-9-]+\.html(?:#quote)?$/.test(url)) return null;
    return {id,title:clean(b.match(/<h4>([\s\S]*?)<\/h4>/)?.[1]),description:attr(a,'data-description'),cities:attr(a,'data-cities').split(' '),attractions:attr(a,'data-stops').split(' ').map(x=>stops.get(x)).filter(Boolean),duration:clean(b.match(/<p>([\s\S]*?)<\/p>/)?.[1]),days:Number(attr(a,'data-days'))||null,image:attr(b.match(/<img\b[^>]*>/)?.[0]||'','src'),price:clean(b.match(/<strong>(\$[\d,]+)<\/strong>/)?.[1])||null,url};
  }).filter(Boolean);
}
export const normalize = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه');
const aliases={cairo:['cairo','القاهره','giza','جيزه'],aswan:['aswan','اسوان'],luxor:['luxor','الاقصر'],hurghada:['hurghada','الغردقه'],sharm:['sharm','شرم'],alexandria:['alexandria','اسكندريه'],edfu:['edfu','ادفو']};
export function parseIntent(query) {
  const words={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  const q=normalize(query).replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g,w=>words[w]).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  const days=Number(q.match(/(\d+)\s*(?:days?|ايام|يوم)/)?.[1])||(/يومين/.test(q)?2:null);
  const terms=q.split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>2&&!['want','find','tour','tours','trip','عايز','رحله','لمده','with','the','and','for','days','day'].includes(x));
  if (/بحر|beach|diving|غوص/.test(q)) terms.push('red sea','diving');
  if (/تاريخ|معابد|histor/.test(q)) terms.push('temple','pyramids');
  return {destinations:Object.entries(aliases).filter(([,a])=>a.some(x=>q.includes(x))).map(([k])=>k),terms:[...new Set(terms)].slice(0,30),days:days&&days<=30?days:null,preferences:query};
}
export function validateIntent(raw, query) {
  if (!raw || !Array.isArray(raw.destinations)||!Array.isArray(raw.terms)) throw Error('Invalid AI response');
  const local=parseIntent(query);
  const strings=a=>a.filter(x=>typeof x==='string'&&x.length<100).slice(0,30);
  return {destinations:[...new Set([...local.destinations,...strings(raw.destinations).map(normalize)])],terms:strings(raw.terms),days:local.days||(Number.isInteger(raw.days)&&raw.days>0&&raw.days<=30?raw.days:null),preferences:query};
}
export function matchTours(catalog,intent,mode='find') {
  return catalog.map(t=>{
    if(intent.destinations.length&&!intent.destinations.every(d=>t.cities.includes(d)))return null;
    if(mode==='find'&&intent.days&&t.days&&intent.days!==t.days)return null;
    const hay=normalize([t.title,t.description,...t.attractions].join(' '));
    const attraction=t.attractions.filter(a=>intent.terms.some(w=>normalize(w).length>3&&normalize(a).includes(normalize(w))));
    const hits=intent.terms.filter(w=>hay.includes(normalize(w)));
    const score=intent.destinations.length*100+attraction.length*50+hits.length*4;
    if(!score)return null;
    return {tour:t,score,reasons:[...intent.destinations.map(x=>'Catalog destination: '+x),...attraction.map(x=>'Listed stop: '+x),...(hits.length?['Catalog text: '+hits.slice(0,4).join(', ')]:[])],limitations:[...(!t.days&&intent.days?['Exact duration needs confirmation.']:[]),'Age suitability, budget fit and departure availability are not verified.']};
  }).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,12);
}
export function buildPlan(results,intent) {
  if(!intent.days)return {question:'How many days would you like? Include a destination in your request.',days:[]};
  const usable=results.filter(r=>r.tour.days===1||(!r.tour.days&&/hours|Full day/.test(r.tour.duration)));
  return {days:Array.from({length:intent.days},(_,i)=>({day:i+1,productId:usable[i]?.tour.id||null,label:usable[i]?.tour.title||'Free time / tailor-made activity to arrange',status:usable[i]?'Catalog product — availability requires confirmation':'Suggested time only — not a bookable product'})),limitations:'Proposed schedule, not a package booking. No complete price total is available. Multi-day packages appear separately and are not split into bookable days.'};
}

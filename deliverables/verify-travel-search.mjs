import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {catalogFromHTML,parseIntent,matchTours,buildPlan,validateIntent} from '../assets/js/travel-search-core.mjs';
import {server,validateImage} from '../travel-search-server.mjs';
const catalog=catalogFromHTML(await readFile(new URL('../ai-assistance.html',import.meta.url),'utf8'));
assert.equal(parseIntent('Four days in Sharm with my family').days,4);
const page=await readFile(new URL('../ai-travel-search.html',import.meta.url),'utf8');
assert.ok(page.includes('defer src="assets/js/ai-travel-search.js"'));
const bundle=await readFile(new URL('../assets/js/ai-travel-search.js',import.meta.url),'utf8');
assert.ok(!/^import /m.test(bundle));assert.ok(bundle.includes('globalThis.TrippioTravelCatalog='));
assert.equal(catalog.length,5);for(const t of catalog){assert.ok(t.title&&t.image&&t.url);await access(new URL('../'+t.url.split('#')[0],import.meta.url));}
assert.equal(parseIntent('عايز رحلة بحر في إسكندرية لمدة يومين').days,2);
assert.equal(matchTours(catalog,parseIntent('عايز رحلة بحر في إسكندرية لمدة يومين')).length,0);
assert.equal(matchTours(catalog,parseIntent('4 days in Sharm with children aged 5 and 8')).length,0);
const matches=matchTours(catalog,parseIntent('Giza Pyramids and Sphinx'));assert.ok(matches.some(x=>x.tour.id==='giza-pyramids-sphinx'));assert.equal(matches[0].tour,catalog.find(t=>t.id===matches[0].tour.id));
assert.equal(buildPlan([],parseIntent('4 days in Sharm')).days.length,4);assert.ok(buildPlan([],parseIntent('4 days in Sharm')).days.every(d=>d.productId===null));
assert.throws(()=>validateIntent({destinations:'SQL',terms:[]},''));assert.throws(()=>validateImage({mimeType:'image/png',data:Buffer.from('fake image payload').toString('base64')}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
try{assert.equal((await fetch(base+'/ai-travel-search.html')).status,200);assert.equal((await fetch(base+'/travel-search-server.mjs')).status,404);assert.equal((await fetch(base+'/.env.travel-search.example')).status,404);
const post=body=>fetch(base+'/api/travel-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
assert.equal((await post({mode:'image',query:'',image:{mimeType:'text/html',data:'bad'}})).status,400);
const response=await post({mode:'find',query:'Giza Pyramids'});assert.equal(response.status,200);assert.ok((await response.json()).results.length);
console.log('PASS: catalog integrity, existing links, Arabic, English, empty results, planner, image validation, API fallback and private-file protection.');
}finally{server.close();}

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/js/trip-intent.js','utf8');
const part=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const catalog=[
 {id:'culture',title:'Culture tour',url:'tour-details.html',facts:{culture:['Temple']},items:[{item_id:'temple',title:'Temple',source_tour_id:'culture',source_tour_title:'Culture tour'}]},
 {id:'adventure',title:'Adventure tour',facts:{adventure:['Dive']},items:[{item_id:'dive',title:'Dive',source_tour_id:'adventure',source_tour_title:'Adventure tour'}]},
 {id:'relax',title:'Relax tour',facts:{relaxation:['Sail']},items:[]}
];
const draft={source_tours:[],preferences:{culture:10,adventure:5,relaxation:0},selected_experiences:[],removed_experiences:[],travel_details:{travelers:2,duration:8,travel_date:'2027-06-01'}};
const context=vm.createContext({catalog,draft});
vm.runInContext(part('function addSources(', 'function open(')+part('function validTravel(', 'function review('),context);
assert.equal(context.ranking()[0].tour.id,'culture');
assert.equal(context.ranking()[0].score,67);
assert.equal(context.ranking()[1].score,33);
context.choose('culture',true);
assert.equal(draft.recommended_tour.match_score,67);
assert.equal(draft.selected_experiences[0].source_tour_id,'culture');
assert.equal(draft.selected_experiences[0].source_tour_title,'Culture tour');
assert.equal(draft.alternatives.length,2);
context.choose('culture',true);
assert.equal(draft.selected_experiences.length,1);
context.choose('adventure');
assert.equal(draft.selected_experiences.length,2);
assert.equal(draft.source_tours.length,2);
context.choose('unknown');
assert.equal(draft.source_tours.length,2);
draft.removed_experiences=[catalog[0].items[0]];
context.choose('culture');
assert.equal(draft.removed_experiences.length,0);
assert.equal(context.validTravel(),true);
for(const value of [0,100,1.5,NaN]){draft.travel_details.travelers=value;assert.equal(context.validTravel(),false);}
draft.travel_details.travelers=2;draft.travel_details.duration=91;assert.equal(context.validTravel(),false);
draft.preferences={culture:0,adventure:0,relaxation:0};
assert.ok(context.ranking().every(r=>r.score===0));
draft.preferences={culture:5,adventure:5,relaxation:5};
assert.deepEqual(Array.from(context.ranking(),r=>r.tour.id),['adventure','culture','relax']);
const restored=JSON.parse(JSON.stringify(draft));
assert.equal(restored.selected_experiences[0].source_tour_title,'Culture tour');
console.log('PASS: weighted scoring, zero weights, deterministic ties, provenance, alternatives, deduplication, unknown IDs, restored snapshots and travel bounds.');


// Regression: the homepage must load the trip engine after comparison.
for (const page of ['index.html','subcategory.html','tour-details.html']) {
 const markup=fs.readFileSync(page,'utf8');
 for (const asset of ['assets/js/tour-comparison.js','assets/js/trip-intent.js','assets/css/trip-intent.css']) {
  assert.equal(markup.split('"'+asset+'"').length-1,1,page+': '+asset+' must load exactly once');
 }
 assert.ok(markup.indexOf('src="assets/js/tour-comparison.js"')<markup.indexOf('src="assets/js/trip-intent.js"'),page+': script order');
}
const crypto=require('node:crypto').webcrypto;
const localContext=vm.createContext({crypto:{getRandomValues:array=>crypto.getRandomValues(array)},Uint8Array});
vm.runInContext(part('function createRequestKey()', 'const fresh ='),localContext);
const key1=localContext.createRequestKey(),key2=localContext.createRequestKey();
assert.match(key1,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
assert.notEqual(key1,key2);
console.log('PASS: page integration, load order and local HTTP request-key fallback.');

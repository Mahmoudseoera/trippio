(() => {
 'use strict';
 const key='trippio-assistant-confirmation';
 let details;
 try{details=JSON.parse(sessionStorage.getItem(key));}catch(error){return;}
 if(!details||details.mode!=='preview'||details.sent!==false||!Number.isFinite(details.savedAt)||Date.now()-details.savedAt>7200000){
  try{sessionStorage.removeItem(key);}catch(error){}
  return;
 }
 document.getElementById('confirmation-status').textContent='Your trip details are ready. Thank you! This preview has not been submitted.';
 const rows=[
  ['Tour',details.tour_title],
  ['Traveler',details.full_name],
  ['Phone','+'+details.phone_code+' '+details.phone],
  ['Email',details.email||'Not supplied'],
  ['Travel dates',details.check_in+' → '+details.check_out],
  ['Travelers',details.adults+' adults · '+details.children+' children · '+details.infants+' infants'],
  ['Cities',Array.isArray(details.cities)&&details.cities.length?details.cities.join(', '):'Recommended route'],
  ['Interests',Array.isArray(details.interests)&&details.interests.length?details.interests.join(', '):'Open to suggestions'],
  ['Requests',details.message||'None']
 ];
 const summary=document.getElementById('confirmation-summary');
 rows.forEach(([label,value])=>{
  const term=document.createElement('dt'),description=document.createElement('dd');
  term.textContent=label;description.textContent=value;summary.append(term,description);
 });
 document.getElementById('confirmation-details').hidden=false;
 const clear=document.getElementById('clear-preview');clear.hidden=false;
 clear.addEventListener('click',()=>{
  try{sessionStorage.removeItem(key);}catch(error){}
  summary.replaceChildren();document.getElementById('confirmation-details').hidden=true;clear.hidden=true;
  document.getElementById('confirmation-status').textContent='Your saved preview details have been cleared.';
 });
})();

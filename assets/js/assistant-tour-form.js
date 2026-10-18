(() => {
'use strict';
const form=document.getElementById('bf');
if(!form)return;
const arrival=form.elements.check_in,departure=form.elements.check_out;
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Africa/Cairo'});
arrival.min=today;departure.min=today;
function dates(){
 departure.setCustomValidity(departure.value&&arrival.value&&departure.value<=arrival.value?'Departure must be after arrival.':'');
}
arrival.addEventListener('input',dates);departure.addEventListener('input',dates);
form.addEventListener('submit',event=>{
 event.preventDefault();dates();
 if(form.reportValidity())document.getElementById('enquiry-status').textContent='Your details are ready to review. This preview has not sent an enquiry.';
});
})();
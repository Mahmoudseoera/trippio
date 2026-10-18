/* One-tab booking handoff. Values stay out of URLs and expire after two hours. */
(() => {
 'use strict';
 const form = document.getElementById('bf');
 if (!form) return;
 let draft;
 try {draft = JSON.parse(sessionStorage.getItem('trippio-assistant-booking'));} catch (_) {return;}
 if (!draft || draft.tour !== (form.dataset.assistantTour || 'nile-cruise-8-days') || !Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > 7200000) return;
 for (const input of form.querySelectorAll('input[name], textarea[name]')) {
  const name = input.name;
  if (!Object.hasOwn(draft, name) || typeof draft[name] !== 'string') continue;
  let value = draft[name];
  if (input.type === 'number' && (!/^\d+$/.test(value) || Number(value) < Number(input.min) || Number(value) > Number(input.max))) continue;
  if (/^check_/.test(name) && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) continue;
  if (input.maxLength > 0) value = value.slice(0, input.maxLength);
  if (input._flatpickr) input._flatpickr.setDate(value, true);
  else input.value = value;
  input.dispatchEvent(new Event('input', {bubbles:true}));
  input.dispatchEvent(new Event('change', {bubbles:true}));
 }
 const note = document.createElement('p');
 note.textContent = 'Your AI planner details are filled in below. Review them before continuing.';
 note.setAttribute('role','status'); form.prepend(note);
 try {sessionStorage.removeItem('trippio-assistant-booking');} catch (_) {}
})();

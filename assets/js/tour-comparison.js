/* Adapts the supplied comparison interaction to existing project cards.
   Values come from the visible inventory; no sample package claims are added. */
(() => {
  'use strict';
  const cards = [...document.querySelectorAll('.tour-card-v2, [data-compare-card]')];
  if (!cards.length) return;
  const text = node => node?.textContent.replace(/\s+/g, ' ').trim() || '';
  const tours = cards.map(card => {
    const link = card.querySelector('.tour-card-v2__title a, .ticket-tour__title a');
    const title = text(link);
    const meta = [...card.querySelectorAll('.tour-card-v2__meta > span:not(.dot), .ticket-tour__meta > li')];
    return {id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title,
      image: card.querySelector('img').getAttribute('src'), alt: title,
      url: link.getAttribute('href'), city: text(meta[1]), duration: text(meta[0]),
      description: text(card.querySelector('.tour-card-v2__desc, .ticket-tour__desc')),
      price: text(card.querySelector('.tour-card-v2__price strong, .ticket-tour__price strong')) || 'Request a quote',
      rating: text(card.querySelector('.tour-card-v2__top, .ticket-tour__rating')).replace('rating', '').trim()};
  });
  const root = document.createElement('div');
  root.id = 'tc-root';
  root.innerHTML = "  <!-- Fixed selection tray: buttons remain reachable at narrow viewport widths. -->\n  <aside id=\"tc-compare-bar\" class=\"compare-bar\" aria-label=\"Selected journeys\" hidden>\n    <div class=\"bar-summary\"><div id=\"tc-selected-thumbnails\" class=\"selected-thumbnails\"></div><div><strong id=\"tc-bar-count\">1 journey selected</strong><span>Select 2 or 3 tours to compare.</span></div></div>\n    <div class=\"bar-actions\"><button id=\"tc-clear-all\" class=\"text-button\" type=\"button\">Clear all</button><button id=\"tc-compare-now\" class=\"button button-gold\" type=\"button\">Compare now <span aria-hidden=\"true\">↗</span></button></div>\n  </aside>\n  <div id=\"tc-toast\" class=\"toast\" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\"></div>\n\n  <!-- Native dialog supplies modal semantics, focus containment and an inert background. -->\n  <dialog id=\"tc-comparison-dialog\" aria-labelledby=\"tc-comparison-title\" aria-describedby=\"tc-comparison-hint\">\n    <div class=\"modal-heading\"><div><p class=\"eyebrow\">YOUR SHORTLIST</p><h2 id=\"tc-comparison-title\">Compare your tours</h2></div><button id=\"tc-close-dialog\" class=\"icon-button\" type=\"button\" aria-label=\"Close comparison\">×</button></div>\n    <div class=\"matrix-toolbar\"><p id=\"tc-comparison-hint\">Compare the little details before your next big adventure.</p><label class=\"switch-label\"><input id=\"tc-differences\" type=\"checkbox\"><span class=\"switch\" aria-hidden=\"true\"></span>Highlight differences</label></div>\n    <p class=\"scroll-hint\">Swipe or scroll sideways to explore every journey. Row labels stay in view.</p>\n    <div id=\"tc-matrix-scroll\" class=\"matrix-scroll\" tabindex=\"0\" role=\"region\" aria-label=\"Tour comparison table, horizontally scrollable\">\n      <table id=\"tc-comparison-table\"><caption class=\"sr-only\">Selected tours, prices and included features</caption><thead id=\"tc-matrix-head\"></thead><tbody id=\"tc-matrix-body\"></tbody></table>\n    </div>\n    <div class=\"modal-footer\"><span>From prices per person · Confirm details before booking</span><button id=\"tc-keep-exploring\" class=\"text-button\" type=\"button\">Keep exploring</button></div>\n  </dialog>";
  document.body.append(root);
  const LIMIT = 3;
  const STORAGE_KEY = 'trippio-tour-comparison:v1';
  const byId = new Map(tours.map(t => [t.id, t]));
  const $ = id => document.getElementById('tc-' + id);
  const grid = document.body;
  const dialog = $('comparison-dialog');
  const switchInput = $('differences');
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let selected = [];
  let toastTimer;
  let restoreFocus = null;

  // Ignore stale/unknown IDs, duplicates and corrupted storage. Private browsing
  // or disabled storage still leaves comparison fully usable in this tab.
  function cleanSelection(value) {
    return Array.isArray(value) ? [...new Set(value)].filter(id => byId.has(id)).slice(0,LIMIT) : [];
  }
  try { selected = cleanSelection(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch (_) { selected = []; }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(selected)); } catch (_) { /* In-memory selection remains available. */ }
  }
  function announce(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    toastTimer = setTimeout(() => { $('toast').textContent = ''; },4000);
  }
  const booking = tour => escape(tour.url);
  const duration = tour => escape(tour.duration);

  // Cards are built once. Updating selection only changes the button and border,
  // preserving keyboard focus and avoiding repeated image loads.
  function renderCards() {
    cards.forEach((card, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tc-toggle';
      button.dataset.toggle = tours[index].id;
      card.append(button);
    });
  }

  // Comparison rows are data-driven; their complete displayed values determine
  // whether the row differs. A single selected tour cannot have differences.
  const rows = [
    {label:'Price per person',value:t=>t.price,html:t=>escape(t.price)},
    {label:'Duration',value:t=>t.duration,html:t=>duration(t)},
    {label:'City',value:t=>t.city,html:t=>escape(t.city)},
    {label:'Tour highlights',value:t=>t.description,html:t=>`<p class="comparison-description">${escape(t.description)}</p><button type="button" class="text-button" data-expand aria-expanded="false">Show more</button>`},
    {label:'Guest rating',value:t=>t.rating,html:t=>escape(t.rating)+' / 5'}
  ];
  function renderMatrix() {
    const shortlist = selected.map(id=>byId.get(id));
    $('comparison-table').style.setProperty('--columns',shortlist.length);
    $('matrix-head').innerHTML = `<tr><th scope="col">Your next adventure<br><span class="feature-secondary">${shortlist.length} ${shortlist.length===1?'journey':'journeys'} selected</span></th>${shortlist.map(t=>`<th scope="col"><div class="matrix-card"><a href="${booking(t)}"><img src="${escape(t.image)}" alt="${escape(t.alt)}" title="${escape(t.title)}" width="400" height="230"></a><button class="icon-button column-remove" data-remove="${t.id}" type="button" aria-label="Remove ${escape(t.title)} from comparison">×</button><h3><a href="${booking(t)}">${escape(t.title)}</a></h3><div class="price"><strong>${escape(t.price)}</strong><small>From / per person</small></div><span class="rating" aria-label="Rated ${escape(t.rating)} out of 5">★ ${escape(t.rating)} / 5</span><a class="button" href="${booking(t)}" aria-label="View ${escape(t.title)}">View tour <span aria-hidden="true">↗</span></a></div></th>`).join('')}</tr>`;
    $('matrix-body').innerHTML = rows.map(row=>{
      const differs = shortlist.length>1 && new Set(shortlist.map(t=>JSON.stringify(row.value(t)))).size>1;
      return `<tr class="${differs?'is-different':'is-same'}"><th scope="row">${row.label}</th>${shortlist.map(t=>`<td>${row.html(t)}</td>`).join('')}</tr>`;
    }).join('');
    switchInput.disabled = shortlist.length<2;
    $('comparison-hint').textContent = shortlist.length<2 ? 'Add another journey to highlight differences. You can still explore this package.' : 'Compare the little details before your next big adventure.';
    $('comparison-table').classList.toggle('differences-on',switchInput.checked && shortlist.length>1);
  }
  function sync() {
    grid.querySelectorAll('.tc-toggle').forEach(button=>{
      const active = selected.includes(button.dataset.toggle);
      button.setAttribute('aria-pressed',String(active));
      button.setAttribute('aria-label',`${active?'Remove':'Add'} ${byId.get(button.dataset.toggle).title} ${active?'from':'to'} comparison`);
      button.innerHTML = `<span aria-hidden="true">${active?'✓':'＋'}</span> ${active?'Added to compare':'Add to compare'}`;
      button.closest('.tour-card-v2, [data-compare-card]').classList.toggle('is-selected',active);
    });
    $('compare-now').disabled = selected.length < 2;
    $('bar-count').textContent = `${selected.length} ${selected.length===1?'journey':'journeys'} selected`;
    $('compare-bar').hidden = selected.length===0;
    document.body.classList.toggle('tc-has-selection',selected.length>0);
    $('selected-thumbnails').innerHTML = selected.map(id=>{const t=byId.get(id);return `<button class="thumbnail-button" type="button" data-remove="${id}" aria-label="Remove ${escape(t.title)} from comparison"><img src="${escape(t.image)}" alt="${escape(t.title)}" title="${escape(t.title)}" width="43" height="47"><span aria-hidden="true">×</span></button>`;}).join('');
    if (dialog.open) {
      if (!selected.length) closeDialog();
      else renderMatrix();
    }
  }
  function toggle(id) {
    if (!byId.has(id)) return;
    if (selected.includes(id)) { remove(id); return; }
    if (selected.length===LIMIT) { announce('Your shortlist is full. Remove a journey to compare another.'); return; }
    selected.push(id); persist(); sync();
    announce(`${byId.get(id).title} added to your shortlist.`);
  }
  function remove(id) {
    if (!selected.includes(id)) return;
    const index = selected.indexOf(id);
    const inModal = dialog.open;
    const fromThumb = document.activeElement?.closest('.thumbnail-button');
    selected = selected.filter(item=>item!==id); persist(); sync();
    announce(`${byId.get(id).title} removed.`);
    // Rebuilding columns/thumbnail buttons removes their focused element. Move
    // focus to the nearest remaining remove control rather than losing it.
    if (inModal && dialog.open) {
      const buttons=dialog.querySelectorAll('[data-remove]');
      (buttons[Math.min(index,buttons.length-1)] || $('close-dialog')).focus({preventScroll:true});
    } else if (fromThumb) {
      const buttons=$('selected-thumbnails').querySelectorAll('[data-remove]');
      (buttons[Math.min(index,buttons.length-1)] || grid.querySelector(`[data-toggle="${id}"]`)).focus({preventScroll:true});
    }
  }
  function openDialog() {
    if (selected.length < 2) return;
    restoreFocus = document.activeElement;
    renderMatrix(); dialog.showModal(); document.body.classList.add('tc-modal-open');
    $('matrix-scroll').scrollLeft=0; $('matrix-scroll').scrollTop=0;
    $('close-dialog').focus({preventScroll:true});
  }
  function closeDialog() { if(dialog.open) dialog.close(); }
  dialog.addEventListener('close',()=>{
    document.body.classList.remove('tc-modal-open');
    const target=selected.length && restoreFocus?.isConnected ? restoreFocus : grid.querySelector('[data-toggle]');
    target?.focus({preventScroll:true});
  });
  // Delegation also handles controls rebuilt after removing a column.
  grid.addEventListener('click',event=>{const button=event.target.closest('.tc-toggle');if(button)toggle(button.dataset.toggle);});
  for (const container of [dialog,$('selected-thumbnails')]) container.addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(button)remove(button.dataset.remove);});
  $('clear-all').addEventListener('click',()=>{selected=[];persist();sync();announce('Your shortlist has been cleared.');grid.querySelector('[data-toggle]')?.focus({preventScroll:true});});
  $('compare-now').addEventListener('click',openDialog);
  $('close-dialog').addEventListener('click',closeDialog);
  $('keep-exploring').addEventListener('click',closeDialog);
  switchInput.addEventListener('change',()=>{$('comparison-table').classList.toggle('differences-on',switchInput.checked && selected.length>1);});
  // Close only when both press and release land outside the dialog rectangle.
  let backdropPress=false;
  const outside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',event=>{backdropPress=event.target===dialog && outside(event);});
  dialog.addEventListener('click',event=>{if(backdropPress && event.target===dialog && outside(event))closeDialog();backdropPress=false;});
  // Keep multiple tabs consistent without rewriting the originating tab's state.
  window.addEventListener('storage',event=>{
    if (event.key!==STORAGE_KEY && event.key!==null) return;
    try { selected=cleanSelection(JSON.parse(event.newValue || '[]')); } catch (_) { selected=[]; }
    const hadModalFocus=dialog.open;sync();if(hadModalFocus && dialog.open)$('close-dialog').focus({preventScroll:true});
  });
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-expand]');
    if (!button) return;
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    button.previousElementSibling.classList.toggle('expanded', expanded);
    button.textContent = expanded ? 'Show less' : 'Show more';
  });
  window.TrippioComparison = { tours: [...byId.values()], getSelected: () => selected.map(id => byId.get(id)), compare: ids => { selected = cleanSelection(ids); persist(); sync(); openDialog(); } };
  renderCards();sync();
})();


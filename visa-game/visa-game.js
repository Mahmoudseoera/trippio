/* Passport planner. Frontend request handoff; connect passport:complete to the booking service. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = { vibe: '', arrival: '', departure: '', adults: 1, children: 0, infants: 0 };
  const today = new Date();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let month = new Date(today.getFullYear(), today.getMonth(), 1);
  const cards = $$('.visa-card');
  const labels = ['Your style', 'Your dates', 'Your people', 'Your story'];
  const icons = ['✧', '◷', '♧', '✓'];
  const notice = text => { $('#live').textContent = text; };
  function show(step) {
    $('#game').hidden = false; $('#checkin').hidden = true;
    cards.forEach((card,i) => card.hidden = i !== step);
    cards[step].querySelector('h2').focus({preventScroll:true});
  }
  function stamp(step, text) {
    const slot = $$('.slot')[step]; slot.classList.add('is-stamped');
    slot.querySelector('.slot__stamp').replaceChildren();
    const mark = document.createElement('span'); mark.className = 'visa-stamp';
    const icon = document.createElement('b'); icon.textContent = icons[step];
    const caption = document.createElement('small'); caption.textContent = text;
    mark.append(icon,caption); slot.querySelector('.slot__stamp').append(mark);
    const done = $$('.slot.is-stamped').length; $('#stamp-count').textContent = done;
    notice(`${labels[step]} stamp collected. ${done} of 4.`);
    if(step < 3) show(step+1); else review();
  }
  const vibes = ['History & culture','Beach escape','Family adventure','Desert & stars','Nile cruise','Diving & reefs'];
  vibes.forEach((label,i) => {
    const button = document.createElement('button'); button.type='button'; button.className='tag';
    button.setAttribute('aria-pressed','false');
    const symbol = document.createElement('span'); symbol.className='vibe-symbol'; symbol.textContent=['△','☀','♧','✧','≈','≋'][i];
    const text = document.createElement('span'); text.textContent=label; button.append(symbol,text);
    button.addEventListener('click',()=>{state.vibe=label; $$('.tag').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));stamp(0,label);});
    $('#vibe-grid').append(button);
  });
  $$('.slot').forEach((slot,i)=>{
    const button=document.createElement('button'); button.type='button';button.className='stamp-edit';button.textContent='Edit';button.setAttribute('aria-label',`Edit ${labels[i].toLowerCase()}`);
    button.addEventListener('click',()=>show(i));slot.append(button);
  });
  cards.forEach((card,i)=>{if(!i)return;const b=document.createElement('button');b.type='button';b.className='visa-back';b.textContent='← Back';b.addEventListener('click',()=>show(i-1));card.append(b);});
  function calendar() {
    $('#cal-month').textContent=new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(month);
    $('#cal-grid').replaceChildren();
    $('#cal-prev').disabled=month.getFullYear()===today.getFullYear()&&month.getMonth()===today.getMonth();
    for(let i=0;i<month.getDay();i++){const pad=document.createElement('span');pad.className='cal__pad';$('#cal-grid').append(pad);}
    for(let day=1;day<=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();day++){
      const date=new Date(month.getFullYear(),month.getMonth(),day), value=iso(date), b=document.createElement('button');
      b.type='button';b.className='cal__day';b.textContent=day;b.disabled=value<iso(today);b.setAttribute('aria-label',date.toLocaleDateString('en',{dateStyle:'full'}));
      if(value===state.arrival)b.classList.add('is-start');if(value===state.departure)b.classList.add('is-end');
      if(value>state.arrival&&value<state.departure)b.classList.add('in-range');
      b.setAttribute('aria-pressed',String(value===state.arrival||value===state.departure));
      b.addEventListener('click',()=>{if(!state.arrival||state.departure||value<=state.arrival){state.arrival=value;state.departure='';}else state.departure=value;calendar();});$('#cal-grid').append(b);
    }
    $('#cal-summary').textContent=state.departure?`${state.arrival} → ${state.departure}`:state.arrival?'Now choose your departure date.':'Choose an arrival date.';
    $('#dates-confirm').disabled=!state.departure;
  }
  $('#cal-prev').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);calendar();};
  $('#cal-next').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);calendar();};
  $('#dates-confirm').onclick=()=>stamp(1,'Dates selected');calendar();
  function paxValid(values){return values.adults>=1&&values.children>=0&&values.infants>=0&&values.infants<=values.adults&&values.adults+values.children+values.infants<=9;}
  function renderPax(){
    $$('.pax__row').forEach(row=>{const key=row.dataset.pax;row.querySelector('output').textContent=state[key];row.querySelector('.pax__seats').textContent='♧ '.repeat(state[key]);row.querySelectorAll('[data-dir]').forEach(b=>{b.disabled=!paxValid({...state,[key]:state[key]+Number(b.dataset.dir)});});});
  }
  $$('.pax__row [data-dir]').forEach(b=>b.onclick=()=>{const key=b.closest('[data-pax]').dataset.pax;state[key]+=Number(b.dataset.dir);renderPax();});
  $('#pax-confirm').onclick=()=>stamp(2,`${state.adults+state.children+state.infants} travelers`);renderPax();
  const COUNTRIES = [
    ['Egypt', 'EG', '+20'], ['United Kingdom', 'GB', '+44'], ['United States', 'US', '+1'], ['Canada', 'CA', '+1'],
    ['Germany', 'DE', '+49'], ['France', 'FR', '+33'], ['Italy', 'IT', '+39'], ['Spain', 'ES', '+34'],
    ['Netherlands', 'NL', '+31'], ['Belgium', 'BE', '+32'], ['Switzerland', 'CH', '+41'], ['Austria', 'AT', '+43'],
    ['Sweden', 'SE', '+46'], ['Norway', 'NO', '+47'], ['Denmark', 'DK', '+45'], ['Finland', 'FI', '+358'],
    ['Poland', 'PL', '+48'], ['Czechia', 'CZ', '+420'], ['Hungary', 'HU', '+36'], ['Romania', 'RO', '+40'],
    ['Greece', 'GR', '+30'], ['Turkey', 'TR', '+90'], ['Ireland', 'IE', '+353'], ['Portugal', 'PT', '+351'],
    ['Russia', 'RU', '+7'], ['Ukraine', 'UA', '+380'], ['Saudi Arabia', 'SA', '+966'], ['United Arab Emirates', 'AE', '+971'],
    ['Kuwait', 'KW', '+965'], ['Qatar', 'QA', '+974'], ['Oman', 'OM', '+968'], ['Bahrain', 'BH', '+973'],
    ['Jordan', 'JO', '+962'], ['Lebanon', 'LB', '+961'], ['Morocco', 'MA', '+212'], ['Tunisia', 'TN', '+216'],
    ['Algeria', 'DZ', '+213'], ['South Africa', 'ZA', '+27'], ['Nigeria', 'NG', '+234'], ['Kenya', 'KE', '+254'],
    ['India', 'IN', '+91'], ['Pakistan', 'PK', '+92'], ['China', 'CN', '+86'], ['Japan', 'JP', '+81'],
    ['South Korea', 'KR', '+82'], ['Singapore', 'SG', '+65'], ['Malaysia', 'MY', '+60'], ['Indonesia', 'ID', '+62'],
    ['Thailand', 'TH', '+66'], ['Australia', 'AU', '+61'], ['New Zealand', 'NZ', '+64'], ['Brazil', 'BR', '+55'],
    ['Argentina', 'AR', '+54'], ['Mexico', 'MX', '+52'], ['Chile', 'CL', '+56'], ['Israel', 'IL', '+972'],
  ];
  COUNTRIES.sort((a,b)=>a[0].localeCompare(b[0])).forEach(([name,code,dial])=>{
    $('#nationality').add(new Option(name,name));$('#review-nationality').add(new Option(name,name));$('#dial').add(new Option(`${name} (${dial})`,dial));
  });
  $('#dial').insertBefore(new Option('Country code',''),$('#dial').firstChild);$('#dial').value='';$('#dial').required=true;
  $('#nationality').onchange=()=>{$('#final-confirm').disabled=!$('#nationality').value;};
  function promo(input,message){const code=input.value.trim().toUpperCase();input.value=code;message.textContent=code?'Code added to your request. Our team will confirm eligibility.':'Enter a promo code first.';}
  $('#promo-apply').onclick=()=>promo($('#promo-input'),$('#promo-msg'));
  $('#review-apply').onclick=()=>promo($('#review-promo'),$('#review-promo-msg'));
  $('#final-confirm').onclick=()=>{if($('#nationality').reportValidity())stamp(3,'Ready to explore');};
  function review(){
    $('#game').hidden=true;$('#checkin').hidden=false;$('#passport-sub').textContent='All stamped. Your Egypt story starts here.';
    $('#review-nationality').value=$('#nationality').value;$('#review-promo').value=$('#promo-input').value;
    for(const key of ['arrival','departure','adults','children','infants'])$('#review-'+key).value=state[key];
    $('#review-arrival').min=iso(today);$('#review-departure').min=state.arrival;
    $('#checkin-summary').replaceChildren();for(const text of [state.vibe,`${state.adults+state.children+state.infants} travelers`,`${state.arrival} → ${state.departure}`]){const chip=document.createElement('span');chip.textContent=text;$('#checkin-summary').append(chip);}
    $('#checkin-title').focus({preventScroll:true});$('#checkin').scrollIntoView({block:'start',behavior:'smooth'});
  }
  $$('[data-count]').forEach(b=>b.onclick=()=>{const input=$('#review-'+b.dataset.count);const values=Object.fromEntries(['adults','children','infants'].map(k=>[k,Number($('#review-'+k).value)]));values[b.dataset.count]+=Number(b.dataset.change);if(paxValid(values))input.value=values[b.dataset.count];});
  $('#phone').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'');});
  $('#review-arrival').onchange=()=>{$('#review-departure').min=$('#review-arrival').value;};
  $('#checkin-form').addEventListener('submit',e=>{
    e.preventDefault();const form=e.currentTarget, data=Object.fromEntries(new FormData(form));
    const pax=Object.fromEntries(['adults','children','infants'].map(k=>[k,Number(data[k])]));
    if(data.departure<=data.arrival){$('#request-error').textContent='Departure must be after arrival.';$('#review-departure').focus();return;}
    if(!paxValid(pax)){$('#request-error').textContent='Choose up to 9 travelers, with at least one adult and no more infants than adults.';return;}
    if(!data.name.trim()||!data.journey.trim()){$('#request-error').textContent='Please complete your name and journey notes.';return;}
    document.dispatchEvent(new CustomEvent('passport:complete',{detail:{...data,...pax,vibe:state.vibe}}));
    window.location.assign('thank-you.html');
  });
  const schema=document.createElement('script');schema.type='application/ld+json';schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:document.title,description:$('meta[name="description"]').content,url:location.href.split('#')[0],mainEntity:{'@type':'Service',name:'Tailor made Egypt trip planning',serviceType:'Custom travel itinerary',areaServed:'Egypt'}});document.head.append(schema);
})();

  document.addEventListener('DOMContentLoaded', () => {

      // Header: switch from floating transparent-over-hero to a solid fixed bar on scroll
      const headerWrap = document.getElementById('headerWrap');
      if (headerWrap) {
        const toggleHeaderFixed = () => {
          if (window.scrollY > 80) {
            headerWrap.classList.add('is-fixed');
          } else {
            headerWrap.classList.remove('is-fixed');
          }
        };
        toggleHeaderFixed();
        window.addEventListener('scroll', toggleHeaderFixed, { passive: true });
      }

  //* ── NAVBAR scroll ── *//


      // Mobile menu: open/close + Viator-style drill-down into subcategories
      const mobileMenu = document.getElementById('mobileMenu');
      const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
      const burgerBtn = document.getElementById('burgerBtn');
      const mobileMenuClose = document.getElementById('mobileMenuClose');
      const mobileMenuBack = document.getElementById('mobileMenuBack');
      const mobileSubpanels = document.querySelectorAll('.mobile-menu__subpanel');
      const mobileDropdownToggles = document.querySelectorAll('.mobile-menu__dropdown-toggle');

      function closeMobileDropdowns(exceptToggle) {
        mobileDropdownToggles.forEach(toggle => {
          if (toggle === exceptToggle) return;
          const menu = document.getElementById(toggle.getAttribute('aria-controls'));
          toggle.setAttribute('aria-expanded', 'false');
          toggle.closest('.mobile-menu__dropdown')?.classList.remove('is-open');
          if (menu) menu.hidden = true;
        });
      }

      function openMobileMenu() {
        mobileMenu.classList.add('is-open');
        mobileMenuOverlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }
      function closeMobileMenu() {
        mobileMenu.classList.remove('is-open');
        mobileMenuOverlay.classList.remove('is-open');
        mobileMenu.classList.remove('is-drilled');
        closeMobileDropdowns();
        document.body.style.overflow = '';
      }

      if (burgerBtn) burgerBtn.addEventListener('click', openMobileMenu);
      if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMobileMenu);
      if (mobileMenuOverlay) mobileMenuOverlay.addEventListener('click', closeMobileMenu);

      mobileDropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
          const menu = document.getElementById(toggle.getAttribute('aria-controls'));
          if (!menu) return;

          const willOpen = toggle.getAttribute('aria-expanded') !== 'true';
          closeMobileDropdowns(willOpen ? toggle : null);
          toggle.setAttribute('aria-expanded', String(willOpen));
          toggle.closest('.mobile-menu__dropdown')?.classList.toggle('is-open', willOpen);
          menu.hidden = !willOpen;
        });
      });

      document.querySelectorAll('.mobile-menu__dropdown-menu [data-value]').forEach(option => {
        option.addEventListener('click', () => {
          const dropdown = option.closest('.mobile-menu__dropdown');
          const toggle = dropdown?.querySelector('.mobile-menu__dropdown-toggle');
          const currentValue = toggle?.querySelector('.mobile-menu__current-value');
          if (currentValue) currentValue.textContent = option.dataset.value;
          closeMobileDropdowns();
        });
      });


      // Arrow click drills into subcategories; the category name link still navigates normally
      document.querySelectorAll('.mobile-menu__cat-arrow').forEach(arrow => {
        arrow.addEventListener('click', () => {
          const row = arrow.closest('.mobile-menu__cat-row');
          const key = row.getAttribute('data-cat');
          const panel = document.querySelector(`.mobile-menu__subpanel[data-subpanel="${key}"]`);
          if (!panel) return;

          mobileSubpanels.forEach(p => p.classList.remove('is-active'));
          panel.classList.add('is-active');

          mobileMenu.classList.add('is-drilled');
        });
      });

      if (mobileMenuBack) {
        mobileMenuBack.addEventListener('click', () => {
          mobileMenu.classList.remove('is-drilled');
        });
      }
});
  

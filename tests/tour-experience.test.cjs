const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const rootDir = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(rootDir, 'assets/js/tour-experience.js'), 'utf8');
const html = fs.readFileSync(path.join(rootDir, 'tour-details.html'), 'utf8').replaceAll('\r\n', '\n');
const activeHTML = html.split('<!-- LEGACY TOUR DETAILS SOURCE')[0];

class Element {
  constructor() {
    this.children = []; this.events = {}; this.attrs = {}; this.hidden = false;
    this.classes = new Set();
    this.classList = {
      contains: name => this.classes.has(name),
      toggle: (name, force) => {
        const enabled = force ?? !this.classes.has(name);
        enabled ? this.classes.add(name) : this.classes.delete(name);
        return enabled;
      }
    };
  }
  setAttribute(name, value) { this.attrs[name] = value; }
  removeAttribute(name) { delete this.attrs[name]; }
  getAttribute(name) { return this.attrs[name]; }
  addEventListener(name, fn) { this.events[name] = fn; }
  appendChild(child) { this.children.push(child); }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  closest(tag) { return tag === 'a' && this.href ? this : null; }
  get hash() { return this.href?.slice(this.href.indexOf('#')); }
  focus() { this.focused = true; }
  scrollIntoView(options) { this.scrolled = options; }
}

// Execute the actual navigation code, with deterministic geometry for scroll tests.
const ids = Object.fromEntries(['tourSectionFloat', 'tourSectionToggle', 'tourSectionPanel', 'tourSectionCurrent', 'tourSectionLinks'].map(id => [id, new Element()]));
ids.tourSectionFloat.children = [ids.tourSectionToggle, ids.tourSectionPanel];
ids.tourSectionPanel.children = [ids.tourSectionLinks];
ids.tourSectionPanel.hidden = true;
const windowEvents = {}, documentEvents = {};
const win = { scrollY: 0, innerHeight: 800, addEventListener: (type, fn) => { windowEvents[type] = fn; } };
const sections = Array.from(activeHTML.matchAll(/id="([^"]+)" data-tour-section="([^"]+)"/g), (match, i) => {
  const el = new Element(); el.id = match[1]; el.dataset = { tourSection: match[2] };
  el.getBoundingClientRect = () => ({ top: i * 600 - win.scrollY });
  ids[el.id] = el; return el;
});
assert.equal(sections.length, 11);
const bookbar = new Element();
const context = {
  window: win, root: { querySelector: selector => selector === '#bookbar' ? bookbar : selector === '#quote' ? ids.quote : { getBoundingClientRect: () => ({ bottom: 550 - win.scrollY }) } },
  document: {
    getElementById: id => ids[id], querySelectorAll: () => sections,
    createElement: () => new Element(), addEventListener: (name, fn) => { documentEvents[name] = fn; }
  },
  requestAnimationFrame: fn => { fn(); return 1; }, reducedMotion: false,
  history: { replaceState: (_, __, hash) => { context.lastHash = hash; } }
};
const navCode = source.slice(source.indexOf('  const floating ='), source.indexOf('  const pockets ='));
vm.runInNewContext(navCode, context);
assert.equal(ids.tourSectionFloat.hidden, true);
assert.equal(ids.tourSectionLinks.children.length, 11);
win.scrollY = 1300; windowEvents.scroll();
assert.equal(ids.tourSectionFloat.hidden, false);
assert.equal(ids.tourSectionCurrent.textContent, 'Overview');
assert.equal(ids.tourSectionLinks.children[2].children[0].attrs['aria-current'], 'location');
ids.tourSectionToggle.events.click();
assert.equal(ids.tourSectionPanel.hidden, false);
const suitcaseIndex = sections.findIndex(item => item.id === 'before-you-go-suitcase');
const suitcaseLink = ids.tourSectionLinks.children[suitcaseIndex].children[0];
ids.tourSectionLinks.events.click({ target: suitcaseLink, preventDefault() {} });
assert.equal(ids.tourSectionPanel.hidden, true);
assert.equal(context.lastHash, '#before-you-go-suitcase');
assert.equal(ids['before-you-go-suitcase'].scrolled.behavior, 'smooth');
assert.equal(ids['before-you-go-suitcase'].focused, true);
ids.tourSectionToggle.events.click(); documentEvents.keydown({ key: 'Escape' });
assert.equal(ids.tourSectionPanel.hidden, true);
assert.equal(ids.tourSectionToggle.focused, true);
ids.tourSectionToggle.events.click(); documentEvents.click({ target: new Element() });
assert.equal(ids.tourSectionPanel.hidden, true);
win.scrollY = 0; windowEvents.scroll(); assert.equal(ids.tourSectionFloat.hidden, true);

// Run the actual form validators, without submitting or storing any personal data.
const E = Object.fromEntries(['full_name', 'email', 'phone', 'phone_code', 'nationality', 'check_in', 'check_out', 'adults', 'children', 'infants', 'message'].map(name => [name, { value: '' }]));
const validation = { E };
const validatorCode = source.slice(source.indexOf('const today='), source.indexOf('const vis='));
vm.runInNewContext(validatorCode + '\nglobalThis.rules = V;', validation);
assert.notEqual(validation.rules.full_name(), '');
E.phone_code.value = '+20'; E.phone.value = '12ab34';
assert.notEqual(validation.rules.phone(), '');
E.adults.value = '1.5'; assert.notEqual(validation.rules.adults(), '');
E.adults.value = '2'; assert.equal(validation.rules.adults(), '');
E.infants.value = '3'; assert.notEqual(validation.rules.infants(), '');
E.check_in.value = 'not-a-date'; assert.notEqual(validation.rules.check_in(), '');
E.check_in.value = '2099-01-10'; E.check_out.value = '2099-01-09';
assert.notEqual(validation.rules.check_out(), '');
E.check_out.value = '2099-01-17'; assert.equal(validation.rules.check_out(), '');

assert.equal((activeHTML.match(/class="journey-day"/g) || []).length, 0);
assert.equal((activeHTML.match(/class="card"/g) || []).length, 8);
assert.equal((activeHTML.match(/<h1\b/g) || []).length, 1);
assert.equal((activeHTML.match(/class="bg-pocket"/g) || []).length, 6);
const galleryHTML = activeHTML.match(/<div class="gal" id="gal">([\s\S]*?)<\/div>/)[1];
assert.equal((galleryHTML.match(/<a\b/g) || []).length, 8);
assert.equal((galleryHTML.match(/<a\b[^>]* hidden/g) || []).length, 3);
assert.equal((galleryHTML.match(/class="gallery-more-count"/g) || []).length, 1);
assert(galleryHTML.includes('>+3</span>'));
for (const removed of ['itinerary-details', 'tour-location', 'faq', 'blogs']) {
  assert(!activeHTML.includes('id="' + removed + '"'));
  assert(!activeHTML.includes('href="#' + removed + '"'));
}
assert(!activeHTML.includes('class="journey-nav"'));
assert(!activeHTML.includes('apiKey='));
assert(!activeHTML.includes('5-day Nile Journey'));
assert(!source.includes('if(DEMO)'));
assert(source.includes("window.location.assign('thank-you.html?type=preview')"));
const archive = html.split('LEGACY_SOURCE_BEGIN\n')[1].split('\nLEGACY_SOURCE_END')[0]
  .replaceAll('&lt;!--', '<!--').replaceAll('--&gt;', '-->').replaceAll('--!&gt;', '--!>').replaceAll('\r\n', '\n');
assert(archive.includes('id="reservationForm"'));
assert(archive.includes("window.location.href = 'thank-you.html'"));
console.log('PASS: section tracking, menu open/close, jump and focus, booking validation, eight days, six suitcase tips, and inactive legacy source.');

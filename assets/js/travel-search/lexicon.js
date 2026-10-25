/* Travel search · language layer.
   Normalises Arabic/English text and maps words to concept keys. This is language
   knowledge only: it never states anything about a tour. Whether a tour supports a
   concept is decided later from the real catalog records (see matcher.js). */
(function (root) {
  'use strict';
  const T = (root.TrippioTravel = root.TrippioTravel || {});

  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  // Lower-case, strip diacritics/tatweel, unify Arabic letter variants and digits.
  function norm(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[̀-ًͯ-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)))
      .replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)))
      .replace(/&/g, ' and ')
      .replace(/[^\p{L}\p{N}\s$€£]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      // Attached Arabic prepositions: بالغردقه / للاقصر / وبالاقصر -> الغردقه / الاقصر
      .split(' ').map(w => w.replace(/^(?:بال|وال|فال|كال)/, 'ال').replace(/^لل/, 'ال')).join(' ');
  }

  // Whole-word / whole-phrase containment on normalised text.
  function has(haystack, needle) {
    const n = norm(needle);
    if (!n) return false;
    return (' ' + haystack + ' ').includes(' ' + n + ' ');
  }

  // Places. `catalog: true` keys must also exist in the catalog's own city list to count as covered.
  const PLACES = {
    cairo: ['cairo', 'القاهره', 'giza', 'الجيزه', 'cairo and giza'],
    aswan: ['aswan', 'اسوان'],
    edfu: ['edfu', 'ادفو', 'kom ombo', 'كوم امبو'],
    luxor: ['luxor', 'الاقصر'],
    hurghada: ['hurghada', 'الغرده', 'الغردقه'],
    sharm: ['sharm el sheikh', 'sharm', 'شرم الشيخ', 'شرم'],
    'saint-catherine': ['saint catherine', 'st catherine', 'سانت كاترين']
  };
  // Well-known destinations that may have no tours. Recognising them lets us say so honestly.
  const OTHER_PLACES = {
    alexandria: { label: 'Alexandria', aliases: ['alexandria', 'الاسكندريه', 'اسكندريه', 'اسكندريا'] },
    dahab: { label: 'Dahab', aliases: ['dahab', 'دهب'] },
    'marsa-alam': { label: 'Marsa Alam', aliases: ['marsa alam', 'مرسي علم'] },
    siwa: { label: 'Siwa', aliases: ['siwa', 'سيوه'] },
    taba: { label: 'Taba', aliases: ['taba', 'طابا'] },
    'el-gouna': { label: 'El Gouna', aliases: ['el gouna', 'gouna', 'الجونه'] },
    'port-said': { label: 'Port Said', aliases: ['port said', 'بورسعيد'] },
    fayoum: { label: 'Fayoum', aliases: ['fayoum', 'faiyum', 'الفيوم'] },
    nuweiba: { label: 'Nuweiba', aliases: ['nuweiba', 'نويبع'] }
  };

  // Attractions: aliases for stops that exist in the catalog (keyed by the stop id authored in
  // ai-assistance.html) plus known landmarks that no tour covers.
  const ATTRACTION_ALIASES = {
    giza: ['pyramids', 'pyramid', 'giza pyramids', 'great pyramid', 'الاهرامات', 'الاهرام', 'هرم'],
    sphinx: ['sphinx', 'great sphinx', 'ابو الهول'],
    gem: ['grand egyptian museum', 'gem', 'المتحف المصري الكبير', 'المتحف الكبير'],
    'egyptian-museum': ['egyptian museum', 'tahrir museum', 'المتحف المصري', 'متحف التحرير'],
    khan: ['khan el khalili', 'khan al khalili', 'خان الخليلي', 'خان الخليلى'],
    philae: ['philae', 'فيله'],
    felucca: ['felucca', 'فلوكه', 'فلوكة'],
    'kom-ombo': ['kom ombo', 'كوم امبو'],
    'edfu-temple': ['edfu temple', 'temple of horus', 'horus temple', 'معبد ادفو', 'معبد حورس'],
    'valley-kings': ['valley of the kings', 'valley of kings', 'وادي الملوك'],
    hatshepsut: ['hatshepsut', 'حتشبسوت', 'معبد حتشبسوت'],
    karnak: ['karnak', 'الكرنك', 'معبد الكرنك'],
    'luxor-temple': ['luxor temple', 'معبد الاقصر'],
    redsea: ['red sea', 'البحر الاحمر']
  };
  const EXTERNAL_ATTRACTIONS = {
    'ext:citadel': { label: 'Saladin Citadel', aliases: ['citadel', 'saladin citadel', 'salah el din citadel', 'قلعه صلاح الدين', 'قلعه'] },
    'ext:abu-simbel': { label: 'Abu Simbel', aliases: ['abu simbel', 'ابو سمبل'] },
    'ext:white-desert': { label: 'White Desert', aliases: ['white desert', 'الصحراء البيضاء'] },
    'ext:bibliotheca': { label: 'Bibliotheca Alexandrina', aliases: ['bibliotheca alexandrina', 'مكتبه الاسكندريه'] },
    'ext:qaitbay': { label: 'Qaitbay Citadel', aliases: ['qaitbay', 'قايتباي'] },
    'ext:mount-sinai': { label: 'Mount Sinai', aliases: ['mount sinai', 'جبل موسي', 'جبل سيناء'] }
  };

  // Activity / experience concepts. `evidence` lists catalog words that would support the concept.
  // An empty list means the catalog cannot verify it (shown as a limitation, never as a match).
  const ACTIVITIES = {
    beach: { label: 'beach', aliases: ['beach', 'beaches', 'seaside', 'شاطي', 'شواطي', 'ساحل'], evidence: ['beach', 'coast', 'seaside'] },
    sea: { label: 'sea', aliases: ['sea', 'sea trip', 'boat trip', 'بحر', 'رحله بحريه', 'رحلات بحريه'], evidence: ['red sea', 'sea', 'coast', 'beach', 'underwater'] },
    diving: { label: 'diving', aliases: ['diving', 'dive', 'snorkel', 'snorkeling', 'غوص', 'غطس'], evidence: ['diving', 'dive', 'underwater', 'snorkel'] },
    sailing: { label: 'sailing', aliases: ['felucca', 'sailing', 'sail', 'فلوكه', 'مركب', 'ابحار'], evidence: ['felucca', 'sail', 'boat'] },
    cruise: { label: 'Nile cruise', aliases: ['cruise', 'nile cruise', 'كروز', 'رحله نيليه', 'نيل'], evidence: ['cruise'] },
    historical: { label: 'history & heritage', aliases: ['historical', 'history', 'ancient', 'heritage', 'temples', 'tombs', 'landmarks', 'تاريخيه', 'تاريخي', 'تاريخ', 'اثار', 'اثريه', 'معابد', 'مزارات'], evidence: ['temple', 'tomb', 'pyramid', 'ancient', 'museum', 'pharaoh', 'monument', 'sphinx'] },
    outdoor: { label: 'outdoor activities', aliases: ['outdoor', 'outdoors', 'adventure', 'مغامره', 'مغامرات', 'خارجيه'], evidence: ['felucca', 'sail', 'diving', 'beach', 'hike', 'outdoor'] },
    relaxation: { label: 'relaxation', aliases: ['relax', 'relaxing', 'relaxation', 'unwind', 'استجمام', 'راحه', 'استرخاء'], evidence: ['relax', 'unwind'] },
    sunset: { label: 'sunset', aliases: ['sunset', 'غروب'], evidence: ['sunset'] }
  };
  // Preferences the catalog data cannot confirm tour by tour.
  const PREFERENCES = {
    quiet: { label: 'quiet', aliases: ['quiet', 'peaceful', 'calm', 'secluded', 'هادي', 'هادئه', 'هادئ', 'هاديه'] },
    family: { label: 'family-friendly', aliases: ['family', 'families', 'kids', 'children', 'child', 'عائليه', 'عيله', 'اطفال', 'طفل', 'اولاد'] },
    honeymoon: { label: 'honeymoon', aliases: ['honeymoon', 'romantic', 'couple', 'شهر عسل', 'رومانسي', 'رومانسيه'] },
    luxury: { label: 'luxury', aliases: ['luxury', 'luxurious', 'premium', 'فاخر', 'فخمه'] }
  };

  const STOPWORDS = new Set(('a an the and or of in on at for to with by from is are be i we you want need find me us my our trip trips tour tours ' +
    'holiday holidays travel travelling traveling suitable short long some any that this it include includes including i m looking look give show ' +
    'activities activity experiences experience friendly four three five six seven eight nine ten when about also please ' +
    'عايز عايزه عاوز اريد ابغي ابحث رحله رحلات في علي مع او و ل ب من الي لمده يومين ايام تشمل تشتمل دولار جنيه الي ان انا').split(' '));

  const NUMBER_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14,
    واحد: 1, يوم: 1, يومين: 2, اتنين: 2, اثنين: 2, ثلاثه: 3, تلاته: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6,
    سبعه: 7, سبع: 7, ثمانيه: 8, تمانيه: 8, تسعه: 9, عشره: 10, عشر: 10
  };

  function invert(map) {
    const out = [];
    for (const [key, aliases] of Object.entries(map)) for (const a of aliases) out.push([norm(a), key]);
    return out;
  }
  // Longest alias first so "sharm el sheikh" wins over "sharm".
  function sortedAliases(pairs) { return pairs.sort((a, b) => b[0].length - a[0].length); }

  const placeAliases = sortedAliases(invert(PLACES).concat(
    Object.entries(OTHER_PLACES).flatMap(([k, v]) => v.aliases.map(a => [norm(a), 'outside:' + k]))));
  const attractionAliases = sortedAliases(invert(ATTRACTION_ALIASES).concat(
    Object.entries(EXTERNAL_ATTRACTIONS).flatMap(([k, v]) => v.aliases.map(a => [norm(a), k]))));
  const activityAliases = sortedAliases(invert(Object.fromEntries(Object.entries(ACTIVITIES).map(([k, v]) => [k, v.aliases]))));
  const preferenceAliases = sortedAliases(invert(Object.fromEntries(Object.entries(PREFERENCES).map(([k, v]) => [k, v.aliases]))));

  // Finds every alias occurrence, removes consumed words, returns canonical keys in query order.
  function scan(text, aliasPairs) {
    let rest = ' ' + text + ' ';
    const found = [];
    for (const [alias, key] of aliasPairs) {
      const needle = ' ' + alias + ' ';
      let at = rest.indexOf(needle);
      while (at !== -1) {
        if (!found.some(f => f.key === key)) found.push({ key, at });
        rest = rest.slice(0, at) + ' '.repeat(needle.length) + rest.slice(at + needle.length);
        at = rest.indexOf(needle);
      }
    }
    found.sort((a, b) => a.at - b.at);
    return { keys: found.map(f => f.key), rest: rest.replace(/\s+/g, ' ').trim() };
  }

  T.lexicon = {
    norm, has, scan, STOPWORDS, NUMBER_WORDS,
    PLACES, OTHER_PLACES, ATTRACTION_ALIASES, EXTERNAL_ATTRACTIONS, ACTIVITIES, PREFERENCES,
    placeAliases, attractionAliases, activityAliases, preferenceAliases,
    labelFor(key) {
      if (key.startsWith('outside:')) return (OTHER_PLACES[key.slice(8)] || {}).label || key;
      if (key.startsWith('ext:')) return (EXTERNAL_ATTRACTIONS[key] || {}).label || key;
      return (ACTIVITIES[key] || PREFERENCES[key] || {}).label || key;
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = T.lexicon;
})(typeof globalThis !== 'undefined' ? globalThis : this);

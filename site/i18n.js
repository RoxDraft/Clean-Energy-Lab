/* Clean Energy Lab: Thai / English switch.
   Thai is written in the source. When English is chosen, i18n/en.json (Thai → English) is fetched,
   data objects are translated with I18N.deep(), and a MutationObserver translates text that lands in the page.
   T(th) translates one string, L(th, en) picks between two template literals written side by side. */
(function () {
  const KEY = 'cel-lang';
  const qs = new URLSearchParams(location.search).get('lang');
  let lang = qs === 'en' || qs === 'th' ? qs : null;
  try { if (lang) localStorage.setItem(KEY, lang); else lang = localStorage.getItem(KEY); } catch (e) {}
  if (lang !== 'en') lang = 'th';
  document.documentElement.lang = lang;
  if (lang === 'en') { // hide the Thai first paint until the English text is in place
    document.documentElement.classList.add('i18n-wait');
    document.head.insertAdjacentHTML('beforeend', '<style>html.i18n-wait body{visibility:hidden}</style>');
    setTimeout(() => document.documentElement.classList.remove('i18n-wait'), 4000);
  }

  const base = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  // data-dict on the script tag picks the dictionary file (the originals use their own).
  const dictName = (document.currentScript && document.currentScript.dataset.dict) || 'en';
  let DICT = {};
  const TH = /[฀-๿]/;
  // Pieces that appear inside longer strings built at run time (units, joiners). Longest first.
  const FRAG = [
    ['(รอบละ ~12.4 ชม.)', '(cycle ~12.4 h)'], ['(น้ำขึ้น)', '(flood)'], ['(น้ำลง)', '(ebb)'], ['· ส่งช่างได้', '· crew transfer OK'],
    ['· เกินเกณฑ์ส่งช่างทั่วไป (~1.5–2 m)', '· above typical crew-transfer limit (~1.5–2 m)'],
    [' พัน ลบ.ม./ชม.', ' thousand m³/h'], [' ลบ.ม./วินาที', ' m³/s'], [' ตัน CH4/ชม.', ' t CH4/h'], [' ตัน/ชม.', ' t/h'],
    [' กรัม/ชม.', ' g/h'], [' ลิตร/ชม.', ' L/h'], [' บาท/ชม.', ' THB/h'], [' kg/ชม.', ' kg/h'], [' รอบ/นาที', ' rpm'],
    ['ชม./วินาที', 'h/s'], [' ครัวเรือน', ' homes'], [' ชม. ที่โหลดนี้)', ' h at this load)'], [' ชม.', ' h'],
    [': สรุปสำหรับการตัดสินใจ', ': summary for decision-makers'], ['วงจรชีวิตวัสดุ: ', 'Material life cycle: '],
    ['แตะชิ้นส่วนเพื่อดูวัสดุ แหล่งที่มา และวงจรชีวิต', 'tap a part to see its materials, origin and life cycle'],
    ['อายุใช้งาน ', 'Service life '], ['อัปเดต ', 'Updated '], ['อ้างอิง ', 'cited '], ['ปรับปรุง ', 'updated '], ['ขั้น ', 'Stage '], [' (ประมาณ)', ' (est.)'],
    ['ผันแปรตามเชื้อเพลิง', 'varies with fuel'], ['ผันแปร', 'varies'], ['ชาร์จ ', 'Charging '], ['จ่าย ', 'Discharging '],
    [' น.', '']
  ];
  function T(s) {
    if (lang !== 'en' || typeof s !== 'string' || !TH.test(s)) return s;
    const k = s.trim();
    if (DICT[k] != null) return s.replace(k, DICT[k]);
    let o = s;
    if (dictName === 'en') for (const [a, b] of FRAG) if (o.includes(a)) o = o.split(a).join(b);
    return o;
  }
  const L = (th, en) => lang === 'en' ? en : th;
  function deep(o) {
    if (lang !== 'en') return o;
    if (typeof o === 'string') return T(o);
    if (Array.isArray(o)) return o.map(deep);
    if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = deep(o[k]); return r; }
    return o;
  }
  // only write when the text changes, so the observer never loops on text it cannot translate
  function txt(n) { const v = n.nodeValue; const pe = n.parentElement; if (TH.test(v) && pe && !SKIP.test(pe.tagName) && !pe.closest('[data-no-i18n]')) { const t = T(v); if (t !== v) n.nodeValue = t; } }
  const SKIP = /^(SCRIPT|STYLE|TEMPLATE|TEXTAREA)$/;
  const ATTRS = ['aria-label', 'title', 'placeholder'];
  function dom(root) {
    if (lang !== 'en' || !root) return;
    if (root.nodeType === 3) { txt(root); return; }
    if (root.nodeType !== 1 || root.closest && root.closest('[data-no-i18n]')) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = root;
    do {
      if (n.nodeType === 3) txt(n);
      else for (const a of ATTRS) { const v = n.getAttribute(a); if (v && TH.test(v)) { const t = T(v); if (t !== v) n.setAttribute(a, t); } }
    } while ((n = w.nextNode()));
  }
  function watch() {
    dom(document.body);
    // observe the whole document: some bundled pages swap <body> after this script runs
    document.title = T(document.title);
    new MutationObserver(ms => ms.forEach(m => {
      if (m.type === 'characterData') dom(m.target); else m.addedNodes.forEach(dom);
    })).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    requestAnimationFrame(() => document.documentElement.classList.remove('i18n-wait'));
  }
  function set(l) {
    try { localStorage.setItem(KEY, l); } catch (e) {}
    const u = new URL(location.href); u.searchParams.set('lang', l); location.replace(u.href);
  }
  function button() {
    const b = document.createElement('div');
    b.className = 'langsw'; b.setAttribute('role', 'group'); b.setAttribute('aria-label', 'ภาษา / Language');
    b.setAttribute('data-no-i18n', '');
    b.innerHTML = ['th', 'en'].map(l => `<button type="button" lang="${l}" aria-pressed="${l === lang}">${l === 'th' ? 'ไทย' : 'EN'}</button>`).join('');
    b.querySelectorAll('button').forEach(x => x.onclick = () => { if (x.lang !== lang) set(x.lang); });
    return b;
  }
  const ready = (lang === 'en'
    ? fetch(base + 'i18n/' + dictName + '.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))
    : Promise.resolve({})).then(d => { DICT = d; });
  // Fallback look for pages that don't style the switch themselves (the bundled originals).
  const CSS = ':where(.langsw){display:inline-flex;border:1px solid var(--line,#c9c5bc);border-radius:999px;overflow:hidden;background:var(--panel,#fff);font:600 13px system-ui,sans-serif}' +
    ':where(.langsw button){font:inherit;border:0;background:none;color:var(--fg2,#4a4d52);padding:6px 14px;min-height:34px;cursor:pointer}' +
    ':where(.langsw button[aria-pressed="true"]){background:var(--fg,#1d1f22);color:var(--bg,#fff)}';
  function start() {
    document.head.insertAdjacentHTML('afterbegin', '<style>' + CSS + '</style>');
    document.querySelectorAll('[data-lang-slot]').forEach(s => s.replaceWith(button()));
    if (lang === 'en') ready.then(watch);
    // The report PDF has a separate all-English edition; links (including ones rendered later) open it in EN mode.
    if (lang === 'en') document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href$="solar-storage-grid-report.pdf"]');
      if (a) a.setAttribute('href', a.getAttribute('href').replace(/\.pdf$/, '-en.pdf'));
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.I18N = { lang, ready, deep, dom, set };
  window.T = T; window.L = L;
})();

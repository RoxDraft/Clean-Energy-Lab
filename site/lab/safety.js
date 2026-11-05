/* Clean Energy Lab · Safety simulation
   แผนที่จำลองอย่างง่าย: โรงไฟฟ้า ชุมชน มหาวิทยาลัย เมือง (โรงพยาบาล + โรงงานชิป) แม่น้ำ/ทะเล และสัตว์
   เลือกเหตุการณ์จาก data/safety.json แล้วดูว่ามลพิษ ก๊าซ น้ำปนเปื้อน รังสี แรงสั่น เสียง ไฟ หรือน้ำท่วม ไปถึงใครบ้าง
   และถ้าโรงไฟฟ้าต้องหยุด เมืองจะไฟดับไหม ตัวเลขเป็นค่าประมาณเพื่อการเรียนรู้ */
(function () {
'use strict';
const { W, H, clamp, lerp, rr, txt, pipe, polyLen, polyAt, person, houses } = LabSim.H;
const EN = () => document.documentElement.lang === 'en';
const tx = o => o && typeof o === 'object' ? (EN() ? o.en : o.th) : (o == null ? '' : String(o));
const fmt = (v, d = 0) => (isFinite(v) ? v : 0).toLocaleString(EN() ? 'en-US' : 'th-TH', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtA = v => v >= 100 ? fmt(v) : v >= 10 ? fmt(v, 1) : v >= 1 ? fmt(v, 2) : fmt(v, 3);
const SEV = { ok: '#1baf7a', warn: '#eda100', bad: '#e5484d' };

/* ---------- scenes ---------- */
const LAND = {
  plant: [210, 215], out: [214, 178],
  river: [[0, 95], [120, 150], [214, 178], [300, 250], [420, 330], [540, 385], [680, 410], [800, 420]],
  R: [
    { id: 'vil', x: 430, y: 235, n: 3000, t: { th: 'ชุมชนใกล้โรงไฟฟ้า', en: 'Nearby village' }, s: { th: 'ชุมชน', en: 'Village' }, h: 1 },
    { id: 'uni', x: 615, y: 285, n: 25000, t: { th: 'มหาวิทยาลัย', en: 'University' }, s: { th: 'มหาวิทยาลัย', en: 'University' }, h: 1 },
    { id: 'city', x: 705, y: 105, n: 500000, t: { th: 'เมือง · โรงพยาบาล · โรงงานชิป', en: 'City · hospital · chip fab' }, s: { th: 'เมือง', en: 'City' }, h: 1, city: 1 },
    { id: 'farm', x: 360, y: 388, n: 400, t: { th: 'นาข้าวและเกษตรกร', en: 'Rice fields and farmers' }, s: { th: 'นาข้าว', en: 'Rice fields' }, h: 1, wet: 1 },
    { id: 'intake', x: 560, y: 392, n: 80000, t: { th: 'จุดสูบน้ำประปาท้ายน้ำ', en: 'Downstream water intake' }, s: { th: 'ประปา', en: 'Water intake' }, h: 1, wet: 1, river: 1 },
    { id: 'wild', x: 92, y: 345, n: 0, t: { th: 'ป่าและสัตว์ป่า', en: 'Forest and wildlife' }, s: { th: 'สัตว์ป่า', en: 'Wildlife' }, eco: 1 }
  ]
};
const SEA = {
  plant: [230, 230], out: [230, 230], coast: [[560, 0], [600, 90], [575, 180], [610, 260], [590, 350], [630, 450]],
  R: [
    { id: 'vil', x: 640, y: 200, n: 3000, t: { th: 'หมู่บ้านประมงชายฝั่ง', en: 'Coastal fishing village' }, s: { th: 'ชุมชน', en: 'Village' }, h: 1 },
    { id: 'uni', x: 715, y: 320, n: 25000, t: { th: 'มหาวิทยาลัย', en: 'University' }, s: { th: 'มหาวิทยาลัย', en: 'University' }, h: 1 },
    { id: 'city', x: 720, y: 95, n: 500000, t: { th: 'เมือง · โรงพยาบาล · โรงงานชิป', en: 'City · hospital · chip fab' }, s: { th: 'เมือง', en: 'City' }, h: 1, city: 1 },
    { id: 'shell', x: 545, y: 385, n: 300, t: { th: 'ฟาร์มหอยและประมงชายฝั่ง', en: 'Shellfish farms and coastal fishing' }, s: { th: 'ฟาร์มหอย', en: 'Shellfish farm' }, h: 1, wet: 1 },
    { id: 'dolph', x: 390, y: 320, n: 0, t: { th: 'โลมาและวาฬ', en: 'Dolphins and whales' }, s: { th: 'โลมา/วาฬ', en: 'Dolphins' }, eco: 1, wet: 1, marine: 1 },
    { id: 'reef', x: 110, y: 350, n: 0, t: { th: 'แนวปะการังและปลา', en: 'Reef and fish' }, s: { th: 'ปะการัง', en: 'Reef' }, eco: 1, wet: 1, marine: 1 },
    { id: 'birds', x: 420, y: 100, n: 0, t: { th: 'นกทะเล', en: 'Seabirds' }, s: { th: 'นกทะเล', en: 'Seabirds' }, eco: 1 }
  ]
};
const DIRS = [['e', 0, 'ไปทางตะวันออก', 'towards the east'], ['ne', -40, 'ไปทางตะวันออกเฉียงเหนือ', 'towards the north-east'], ['n', -90, 'ไปทางเหนือ', 'towards the north'],
  ['se', 35, 'ไปทางตะวันออกเฉียงใต้', 'towards the south-east'], ['s', 90, 'ไปทางใต้', 'towards the south'], ['w', 180, 'ไปทางตะวันตก', 'towards the west']];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const k = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1); return [Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dy), k]; }
function alongRiver(pts, p) { let best = 1e9, at = 0, acc = 0; for (let i = 1; i < pts.length; i++) { const [d, k] = segDist(p, pts[i - 1], pts[i]); const l = dist(pts[i - 1], pts[i]); if (d < best) { best = d; at = acc + k * l; } acc += l; } return [best, at]; }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

/* ---------- drawing ---------- */
function drawLand(c, P, sc, t) {
  c.fillStyle = P.ground; c.fillRect(0, 0, W, H);
  // fields
  c.globalAlpha = P.dark ? .35 : .5; for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) rr(c, 300 + i * 34, 362 + j * 30, 30, 26, 2, P.dark ? '#3a4a2a' : '#c9d9a6'); c.globalAlpha = 1;
  // forest
  for (let i = 0; i < 14; i++) { const x = 40 + (i * 37) % 120, y = 300 + (i * 53) % 110; c.fillStyle = P.dark ? '#24452f' : '#7fb37a'; c.beginPath(); c.arc(x, y, 12 + (i % 3) * 3, 0, 7); c.fill(); }
  // river
  pipe(c, sc.river, P.water2, 18); pipe(c, sc.river, P.water, 12);
  for (let i = 0; i < 8; i++) { const L = polyLen(sc.river), d = (t * 25 + i * L / 8) % L, [x, y] = polyAt(sc.river, d); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x - 3, y - 1, 6, 2); }
  // roads
  pipe(c, [[sc.plant[0] + 30, sc.plant[1]], [430, 235], [615, 285], [705, 105]], P.dark ? '#3c4740' : '#b9c2b4', 3);
}
function drawSea(c, P, sc, t) {
  c.fillStyle = P.water; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { const x = (i * 97 + t * 12) % 560, y = 20 + (i * 61) % 420; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y - 4, x + 16, y); c.stroke(); }
  c.fillStyle = P.ground; c.beginPath(); c.moveTo(W, 0); sc.coast.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(W, H); c.fill();
  c.fillStyle = P.dark ? '#5b5340' : '#e9dcb4'; c.beginPath(); sc.coast.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); for (let i = sc.coast.length - 1; i >= 0; i--) c.lineTo(sc.coast[i][0] + 12, sc.coast[i][1]); c.fill();
  // reef
  for (let i = 0; i < 9; i++) { c.fillStyle = ['#f08a8a', '#f2b451', '#c58af2'][i % 3]; c.globalAlpha = .7; c.beginPath(); c.arc(80 + (i * 23) % 70, 335 + (i * 17) % 40, 5, 0, 7); c.fill(); c.globalAlpha = 1; }
  pipe(c, [sc.plant, [400, 210], [600, 205]], P.dk, 2); // export cable
}
function drawPlant(c, P, it, sc, t, tripped, sev) {
  const [x, y] = sc.plant;
  if (sc === SEA) { for (let i = 0; i < 6; i++) { const px = x - 90 + (i % 3) * 50, py = y - 60 + Math.floor(i / 3) * 110; c.strokeStyle = P.panel; c.lineWidth = 3; c.beginPath(); c.moveTo(px, py + 18); c.lineTo(px, py - 8); c.stroke(); LabSim.H.rotor(c, px, py - 8, 14, tripped ? 0 : t * 1.4 + i, P.dark ? '#e6ece9' : '#fff', 3, 2); } }
  rr(c, x - 34, y - 26, 68, 52, 6, P.panel, tripped ? SEV.bad : P.line);
  const ic = { coal: 'ถ่านหิน', gas: 'ก๊าซ', oil: 'น้ำมัน', nuc: 'นิวเคลียร์', hydro: 'เขื่อน', pv: 'โซลาร์', pvs: 'โซลาร์+แบต', csp: 'CSP', won: 'ลม', woff: 'ลมทะเล', geo: 'ใต้พิภพ', tide: 'คลื่น', bio: 'ชีวมวล', wte: 'ขยะ', h2: 'H₂', fmcf: 'ฟิวชัน', ficf: 'ฟิวชัน', falt: 'ฟิวชัน' };
  const en = { coal: 'Coal', gas: 'Gas', oil: 'Oil', nuc: 'Nuclear', hydro: 'Dam', pv: 'Solar', pvs: 'Solar+BESS', csp: 'CSP', won: 'Wind', woff: 'Offshore', geo: 'Geothermal', tide: 'Tidal', bio: 'Biomass', wte: 'WtE', h2: 'H₂', fmcf: 'Fusion', ficf: 'Fusion', falt: 'Fusion' };
  txt(c, EN() ? en[it.id] : ic[it.id], x, y - 6, P.fg, 12);
  txt(c, tripped ? L('หยุดเดินเครื่อง', 'Tripped') : fmt(it.mw) + ' MW', x, y + 12, tripped ? SEV.bad : P.fg2, 10);
  if (it.id === 'hydro') { pipe(c, [[x - 6, y - 40], [x + 26, y - 30]], P.metal, 8); }
}
function drawRec(c, P, r, st, label) {
  const col = st ? SEV[st] : P.line;
  if (r.city) {
    for (let i = 0; i < 7; i++) { const h = 22 + (i * 13) % 30; rr(c, r.x - 48 + i * 14, r.y - h + 12, 12, h, 1, P.panel, P.line); }
    rr(c, r.x - 58, r.y + 14, 24, 18, 3, '#fff', '#e5484d'); txt(c, 'H', r.x - 46, r.y + 23, '#e5484d', 11);
    rr(c, r.x + 30, r.y + 14, 30, 18, 3, P.panel, P.cond); txt(c, 'FAB', r.x + 45, r.y + 23, P.cond, 8);
  } else if (r.eco || r.id === 'intake' || r.id === 'shell') {
    // drawn by animals / river
  } else {
    for (let i = 0; i < 5; i++) { const hx = r.x - 24 + (i % 3) * 18, hy = r.y - 8 + Math.floor(i / 3) * 16; c.fillStyle = P.panel; c.fillRect(hx, hy, 12, 9); c.beginPath(); c.moveTo(hx - 2, hy); c.lineTo(hx + 6, hy - 6); c.lineTo(hx + 14, hy); c.fillStyle = P.fossil; c.fill(); }
    if (r.id === 'uni') { rr(c, r.x - 30, r.y - 22, 60, 12, 2, P.cond); txt(c, L('มหาวิทยาลัย', 'UNIVERSITY'), r.x, r.y - 16, '#fff', 7); }
  }
  if (r.id === 'intake') { rr(c, r.x - 10, r.y - 22, 20, 14, 2, P.panel, P.line); txt(c, L('ประปา', 'Water'), r.x, r.y - 15, P.fg2, 7); }
  if (r.id === 'shell') { for (let i = 0; i < 6; i++) { c.strokeStyle = P.fg2; c.lineWidth = 1; c.beginPath(); c.moveTo(r.x - 20 + i * 8, r.y - 6); c.lineTo(r.x - 20 + i * 8, r.y + 6); c.stroke(); } }
  if (label) {
    c.font = '600 10.5px "IBM Plex Sans Thai",system-ui,sans-serif'; const w = c.measureText(label).width + 14;
    const bx = clamp(r.x - w / 2, 4, W - w - 4), by = r.city ? r.y + 36 : r.y + 14;
    rr(c, bx, by, w, 18, 9, col); txt(c, label, bx + w / 2, by + 9.5, '#fff', 10.5);
  }
}
function arrow(c, x, y, ang, len, col) { const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len; pipe(c, [[x, y], [x2, y2]], col, 3); c.fillStyle = col; c.beginPath(); c.moveTo(x2 + Math.cos(ang) * 8, y2 + Math.sin(ang) * 8); c.lineTo(x2 + Math.cos(ang + 2.4) * 8, y2 + Math.sin(ang + 2.4) * 8); c.lineTo(x2 + Math.cos(ang - 2.4) * 8, y2 + Math.sin(ang - 2.4) * 8); c.fill(); }
function ring(c, x, y, r, col, a = .25, dash) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = col; c.globalAlpha = a; c.fill(); c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 1.5; if (dash) c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]); }

/* ---------- the model ---------- */
function build(it, hz, D) {
  const m = hz.m || {}, k = hz.k, sc = it.sc === 'sea' ? SEA : LAND;
  const kmpp = (m.km || 10) / 700; // km per pixel
  const src = k === 'gas' && it.id === 'gas' ? [330, 205] : sc.plant;
  const R = sc.R;
  const vilD = dist(src, [R[0].x, R[0].y]);
  const usesWind = ['air', 'gas', 'rad', 'fire'].includes(k) || (k === 'water' && sc === SEA);
  const ctr = [];
  if (k === 'air') ctr.push({ id: 'eff', label: tx(m.effL), min: m.eff[1], max: m.eff[2], step: .1, val: m.eff[0], unit: '%' });
  if (k === 'water') ctr.push({ id: 'eff', label: tx(m.effL), min: m.eff[1], max: m.eff[2], step: .1, val: m.eff[0], unit: '%' });
  if (k === 'gas') { ctr.push({ id: 'hole', label: L('ขนาดรอยรั่ว', 'Leak size'), min: m.hole[1], max: m.hole[2], step: 1, val: m.hole[0], unit: 'mm' }); ctr.push({ id: 'g', type: 'toggle', label: tx(m.guardL), val: true }); if (!m.toxic) ctr.push({ id: 'ign', type: 'toggle', label: L('ก๊าซติดไฟ', 'Gas ignites'), val: false }); }
  if (k === 'rad') { ctr.push({ id: 'lvl', type: 'select', label: L('ระดับเหตุการณ์', 'Event level'), val: '2', opts: [['0', L('ปกติ', 'Normal')], ['1', L('ผิดปกติเล็กน้อย (หยุดเครื่องปลอดภัย)', 'Minor (safe shutdown)')], ['2', L('รั่วไหลบางส่วน', 'Partial release')], ['3', L('รุนแรง (แกนหลอม)', 'Severe (core damage)')]].map(o => m.fusion && o[0] === '3' ? ['3', L('รุนแรงที่สุดที่เป็นไปได้ (ทริเทียมทั้งหมดในเครื่อง)', 'Worst case (all tritium in the machine)')] : o) }); ctr.push({ id: 'g', type: 'toggle', label: tx(m.guardL), val: true }); }
  if (k === 'quake') { if (m.induced) { ctr.push({ id: 'inj', label: L('แรงดันอัดน้ำ', 'Injection pressure'), min: 0, max: 100, step: 1, val: 50, unit: '%' }); ctr.push({ id: 'g', type: 'toggle', label: L('ระบบไฟจราจร (หยุดอัดน้ำเมื่อเกินเกณฑ์)', 'Traffic-light system (stop injection at threshold)'), val: true }); } else { ctr.push({ id: 'M', label: L('ขนาดแผ่นดินไหว', 'Magnitude'), min: 4, max: 8.5, step: .1, val: 6.5, unit: 'M' }); ctr.push({ id: 'Rk', label: L('ระยะจากศูนย์กลาง', 'Distance from epicentre'), min: 5, max: 300, step: 5, val: 40, unit: 'km' }); } }
  if (k === 'noise') ctr.push({ id: 'red', label: m.marine ? L('ลดเสียงด้วยม่านฟองอากาศ', 'Bubble-curtain reduction') : L('มาตรการลดเสียง', 'Noise mitigation'), min: m.red[1], max: m.red[2], step: 1, val: m.red[0], unit: 'dB' });
  if (k === 'fire') { ctr.push({ id: 'sz', label: L('ขนาดไฟ', 'Fire size'), min: 5, max: 100, step: 5, val: 40, unit: '%' }); ctr.push({ id: 'g', type: 'toggle', label: tx(m.guardL), val: true }); }
  if (k === 'flood') { ctr.push({ id: 'br', label: L('ขนาดรอยแตก / ปริมาณน้ำ', 'Breach size / water released'), min: 10, max: 100, step: 5, val: 60, unit: '%' }); ctr.push({ id: 'g', type: 'toggle', label: tx(m.guardL), val: true }); }
  if (k === 'eco') ctr.push({ id: 'red', label: tx(m.effL), min: m.red[1], max: m.red[2], step: 5, val: m.red[0], unit: '%' });
  if (usesWind) { ctr.push({ id: 'wd', type: 'select', label: sc === SEA && k === 'water' ? L('กระแสน้ำและลม', 'Current and wind') : L('ทิศลม', 'Wind direction'), val: k === 'rad' || k === 'air' ? 'e' : 'e', opts: DIRS.map(d => [d[0], EN() ? d[3] : d[2]]) }); ctr.push({ id: 'u', label: L('ความเร็วลม', 'Wind speed'), min: 1, max: 10, step: .5, val: 3, unit: 'm/s' }); }
  const canTrip = hz.trip === true || (hz.trip == null && ['quake', 'rad', 'flood'].includes(k));
  if (canTrip) ctr.push({ id: 'res', label: L('กำลังผลิตสำรองพร้อมจ่ายในระบบ', 'Spinning reserve on the grid'), min: 0, max: 3000, step: 100, val: 1000, unit: 'MW' });

  const recIn = r => [r.x, r.y];
  const align = (s, r) => { if (!usesWind) return 1; const d = DIRS.find(x => x[0] === s.wd) || DIRS[0]; const a = d[1] * Math.PI / 180, b = Math.atan2(r.y - src[1], r.x - src[0]); const dd = angDiff(a, b); return Math.exp(-dd * dd / (2 * .38 * .38)); };
  const windAng = s => (DIRS.find(x => x[0] === s.wd) || DIRS[0])[1] * Math.PI / 180;
  const rm = r => dist(src, recIn(r)) * kmpp * 1000; // metres

  // evaluate every receptor → {v, st, lab}
  function evalAll(s) {
    const out = {}; let trip = false, note = '', atRisk = 0, plant = '';
    const human = R.filter(r => r.h);
    if (k === 'air') {
      const e = (100 - s.eff) / Math.max(.01, 100 - m.eff[0]);
      human.filter(r => !r.river).forEach(r => { const v = (m.bg || 0) + m.c0 * e * Math.pow(vilD / dist(src, recIn(r)), 1.6) * align(s, r) * 3 / s.u; const st = v >= m.std ? 'bad' : v >= m.std * .7 ? 'warn' : 'ok'; out[r.id] = { v, st, lab: `${tx(m.pol)} ${fmtA(v)}` }; if (st === 'bad') atRisk += r.n; });
      plant = L(`ดักได้ ${fmt(s.eff, 1)}% · ปล่อยมากกว่าปกติ ${fmt(e, 1)} เท่า`, `Captures ${fmt(s.eff, 1)}% · ${fmt(e, 1)}× normal emissions`);
      note = tx(m.stdL) || L(`มาตรฐาน ${tx(m.pol)} ของไทย ${m.std} ${m.unit}`, `Thai ${tx(m.pol)} standard ${m.std} ${m.unit}`);
    }
    if (k === 'water') {
      const e = (100 - s.eff) / Math.max(.01, 100 - m.eff[0]);
      const wetR = R.filter(r => r.wet);
      wetR.forEach(r => {
        let f;
        if (sc === SEA) f = Math.pow(120 / Math.max(60, dist(src, recIn(r))), 1.2) * (.25 + .75 * align(s, r));
        else { const [d, at] = alongRiver(sc.river, recIn(r)); const [, a0] = alongRiver(sc.river, sc.out); f = at < a0 ? 0 : Math.pow(150 / Math.max(80, at - a0), .6) * (d < 40 ? 1 : .35); }
        const v = m.c0 * e * f * 4; const st = v >= m.std ? 'bad' : v >= m.std * .5 ? 'warn' : 'ok'; out[r.id] = { v, st, lab: `${tx(m.pol)} ${fmtA(v)} ${m.unit}` }; if (st === 'bad') atRisk += r.n;
      });
      plant = L(`กัก/บำบัดได้ ${fmt(s.eff, 1)}%`, `Contained/treated ${fmt(s.eff, 1)}%`);
      note = tx(m.stdL);
    }
    if (k === 'gas') {
      const r0 = m.k * s.hole * (s.g ? .55 : 1); // metres
      human.concat(R.filter(r => r.eco)).forEach(r => {
        const d = rm(r); let inZ;
        if (m.toxic) { const a = windAng(s), b = Math.atan2(r.y - src[1], r.x - src[0]); const along = d * Math.cos(angDiff(b, a)), across = Math.abs(d * Math.sin(angDiff(b, a))); inZ = along > -r0 * .3 && along < r0 * 2.2 * 3 / s.u && across < r0 * .6; }
        else inZ = d < r0 * (s.ign ? 1 : .7);
        const near = !inZ && d < r0 * 2;
        const st = inZ ? 'bad' : near ? 'warn' : 'ok';
        out[r.id] = { v: d, st, lab: inZ ? (m.toxic ? L('อยู่ในกลุ่มก๊าซ', 'In gas cloud') : s.ign ? L('ในรัศมีความร้อน', 'In heat zone') : L('ในเขตติดไฟ', 'In flammable zone')) : near ? L('ใกล้เขตอันตราย', 'Near hazard zone') : L('ปลอดภัย', 'Safe') }; if (inZ) atRisk += r.n;
      });
      trip = !!hz.trip && (s.g || s.hole >= m.hole[0] * 2);
      plant = L(`${tx(m.gas)} · เขตอันตราย ~${fmt(r0 * (m.toxic ? 2.2 * 3 / s.u : 1))} m · ตัดก๊าซใน ${s.g ? '~1 นาที' : '~1–2 ชม.'}`, `${tx(m.gas)} · hazard zone ~${fmt(r0 * (m.toxic ? 2.2 * 3 / s.u : 1))} m · gas isolated in ${s.g ? '~1 min' : '~1–2 h'}`);
      note = m.toxic ? L('ก๊าซพิษลอยตามลม ยิ่งลมอ่อนยิ่งสะสม', 'Toxic gas drifts downwind; it builds up most in light wind') : L('ก๊าซติดไฟลอยขึ้นและกระจายเร็ว อันตรายมากถ้าเจอประกายไฟ', 'Flammable gas rises and disperses fast; dangerous if it finds a spark');
    }
    if (k === 'rad') {
      const lv = +s.lvl; const f = [0, .002, .05, 1][lv] * (s.g ? .03 : 1);
      human.forEach(r => { const v = m.d0 * f * Math.pow(vilD / dist(src, recIn(r)), 1.6) * align(s, r) * 3 / s.u; const st = v >= 100 ? 'bad' : v >= 1 ? 'warn' : 'ok'; out[r.id] = { v, st, lab: v < .001 ? L('~พื้นหลัง', '~background') : `${fmtA(v)} mSv` }; if (st !== 'ok') atRisk += r.n; });
      trip = lv >= 1;
      plant = lv ? (m.fusion ? L('พลาสมาดับเอง ไม่มีปฏิกิริยาลูกโซ่', 'Plasma stops by itself; no chain reaction') : L('SCRAM: แท่งควบคุมตก ปฏิกิริยาหยุด แต่ยังต้องระบายความร้อนต่อ', 'SCRAM: rods drop and fission stops, but decay heat must still be removed')) : L('เดินเครื่องปกติ', 'Normal operation');
      note = L('ปริมาณรังสีสัปดาห์แรก: ต่ำกว่า 1 mSv = ต่ำกว่าขีดจำกัดสาธารณะต่อปี · 1–100 = หลบในอาคารตามคำสั่ง · ≥100 = อพยพ (เกณฑ์ทั่วไปของ IAEA)', 'First-week dose: under 1 mSv is below the public annual limit · 1–100 shelter as instructed · ≥100 evacuate (IAEA generic criterion)');
    }
    if (k === 'quake') {
      let M, Rk;
      if (m.induced) { M = s.g ? Math.min(2 + s.inj * .025, 3) : 2 + s.inj * .036; Rk = 3; } else { M = s.M; Rk = s.Rk; }
      const pga = Math.pow(10, .3 * M - 1.2 * Math.log10(Rk + 10) - 1.0);
      s._pga = pga; s._M = M;
      human.forEach(r => { const st = pga >= .3 ? 'bad' : pga >= .08 ? 'warn' : 'ok'; out[r.id] = { v: pga, st, lab: `${fmt(pga, 2)} g` }; if (st === 'bad') atRisk += r.n; });
      trip = pga >= m.trip;
      plant = pga >= m.dsg ? L(`${fmt(pga, 2)} g เกินค่าออกแบบ ${m.dsg} g ต้องตรวจความเสียหาย`, `${fmt(pga, 2)} g exceeds the ${m.dsg} g design value; damage inspection needed`) : trip ? L(`${fmt(pga, 2)} g ถึงเกณฑ์หยุดอัตโนมัติ ${m.trip} g`, `${fmt(pga, 2)} g reached the ${m.trip} g automatic trip level`) : L(`${fmt(pga, 2)} g ต่ำกว่าเกณฑ์หยุด เดินเครื่องต่อ`, `${fmt(pga, 2)} g below trip level; keeps running`);
      note = L(`M${fmt(M, 1)} ห่าง ${fmt(Rk)} km · ความเร่งพื้นดินสูงสุด (PGA) ประมาณจากสูตรลดทอนอย่างง่าย · 0.1 g ขึ้นไปอาคารเก่าเริ่มเสียหาย`, `M${fmt(M, 1)} at ${fmt(Rk)} km · peak ground acceleration (PGA) from a simple attenuation formula · old buildings start to suffer above ~0.1 g`);
    }
    if (k === 'noise') {
      const tgt = m.marine ? R.filter(r => r.marine).concat(R.filter(r => r.id === 'vil')) : human.filter(r => !r.river);
      tgt.forEach(r => { const d = Math.max(50, rm(r)); const absorb = m.marine ? .0002 * d : .004 * d; let v = m.l0 - 20 * Math.log10(d / 100) - s.red - absorb; if (m.marine && !r.marine) v = null; const st = v == null ? 'ok' : v >= m.std ? 'bad' : v >= m.std - 5 ? 'warn' : 'ok'; out[r.id] = { v, st, lab: v == null ? L('บนฝั่งแทบไม่ได้ยิน', 'Barely audible on shore') : `${fmt(v)} dB` }; if (st === 'bad' && r.n) atRisk += r.n; });
      const l750 = m.l0 - 20 * Math.log10(7.5) - s.red - (m.marine ? .15 : 3);
      plant = m.marine ? L(`ที่ 750 m: ${fmt(l750)} dB (เกณฑ์ ${m.std})`, `At 750 m: ${fmt(l750)} dB (limit ${m.std})`) : L(`ที่ 100 m: ${fmt(m.l0 - s.red)} dB`, `At 100 m: ${fmt(m.l0 - s.red)} dB`);
      note = tx(m.stdL) + L(' · เสียงลดลงราว 6 dB ทุกครั้งที่ระยะเพิ่มเป็น 2 เท่า', ' · sound drops about 6 dB each time distance doubles');
    }
    if (k === 'fire') {
      const r0 = m.r0 * s.sz / 100 * (s.g ? .45 : 1);
      human.concat(R.filter(r => r.eco)).forEach(r => { const d = rm(r); const smoke = m.smoke && align(s, r) > .45 && d < r0 * 12 * 3 / s.u; const st = d < r0 ? 'bad' : (d < r0 * 2 || smoke) ? 'warn' : 'ok'; out[r.id] = { v: d, st, lab: d < r0 ? L('ในรัศมีความร้อน', 'In heat zone') : smoke ? L('ควันเข้า ปิดหน้าต่าง', 'Smoke: shelter indoors') : d < r0 * 2 ? L('ใกล้เขตอันตราย', 'Near hazard zone') : L('ปลอดภัย', 'Safe') }; if (st === 'bad') atRisk += r.n; });
      trip = !!hz.trip && s.sz >= 30;
      plant = L(`รัศมีความร้อนอันตราย ~${fmt(r0)} m`, `Dangerous heat radius ~${fmt(r0)} m`);
      note = m.smoke ? L('ความร้อนอันตรายอยู่ใกล้ แต่ควันลอยไปได้ไกลตามลม', 'Dangerous heat stays close, but smoke travels far downwind') : L('เปลวไฟไฮโดรเจนแทบไม่มีควันและมองไม่เห็นตอนกลางวัน', 'Hydrogen flames make almost no smoke and are hard to see in daylight');
    }
    if (k === 'flood') {
      const spd = m.spd * (.5 + s.br / 100), warn = s.g ? .3 : 99;
      const [, a0] = alongRiver(sc.river, sc.plant);
      human.forEach(r => { const [d, at] = alongRiver(sc.river, recIn(r)); if (d > 95 || at < a0) { out[r.id] = { v: null, st: 'ok', lab: L('พื้นที่สูง ปลอดภัย', 'High ground, safe') }; return; } const hrs = (at - a0) * kmpp / spd; const lead = hrs - warn; const evac = clamp(lead / 1.5, 0, 1) * .97; const st = evac > .9 ? 'warn' : 'bad'; out[r.id] = { v: hrs, st, lab: L(`น้ำถึงใน ${fmt(hrs, 1)} ชม. · อพยพได้ ${fmt(evac * 100)}%`, `Water in ${fmt(hrs, 1)} h · ${fmt(evac * 100)}% evacuated`) }; atRisk += Math.round(r.n * (1 - evac)); });
      trip = true;
      plant = L(`มวลน้ำเคลื่อนที่ ~${fmt(spd)} km/ชม.`, `Flood wave moves at ~${fmt(spd)} km/h`);
      note = s.g ? L('ไซเรนและ SMS เตือนภายในราว 20 นาทีหลังพบความผิดปกติ', 'Sirens and SMS go out about 20 minutes after the problem is detected') : L('ไม่มีระบบเตือน ชาวบ้านรู้ตัวเมื่อน้ำมาถึง', 'No warning system: people only know when the water arrives');
    }
    if (k === 'eco') {
      const v = m.base * (1 - s.red / 100); const st = v >= m.base * .7 ? 'bad' : v >= m.base * .3 ? 'warn' : 'ok';
      const ecoR = R.filter(r => r.eco); const pick = sc === SEA ? (/นก|bird/i.test(tx(m.anim)) ? ecoR.filter(r => r.id === 'birds') : ecoR.filter(r => r.marine)) : ecoR; pick.forEach(r => { out[r.id] = { v, st, lab: L(`${tx(m.anim)} ${fmt(v)}/100`, `${tx(m.anim)} ${fmt(v)}/100`) }; });
      plant = L(`มาตรการลดผลกระทบ ${fmt(s.red)}%`, `Mitigation ${fmt(s.red)}%`);
      note = L(`ดัชนีผลกระทบต่อ${tx(m.anim)}ในแบบจำลอง (100 = ไม่มีมาตรการ)`, `Model impact index for ${tx(m.anim)} (100 = no mitigation)`);
    }
    // city power
    let city = null;
    if (trip && canTrip) { const lost = it.mw, short = Math.max(0, lost - s.res); city = { lost, short, homes: houses(short) }; }
    return { out, trip, note, atRisk, plant, city };
  }

  const spotPlant = { at: () => [sc.plant[0] + 30, sc.plant[1] - 26], k: 'm', t: () => tx(hz.t), d: () => tx(hz.guard) };
  const spotCity = { at: () => [sc === SEA ? 720 : 705, (sc === SEA ? 95 : 105) - 30], k: 'm', t: () => L('เมือง โรงพยาบาล และโรงงานชิป', 'City, hospital and chip fab'), d: s => { const e = evalAll(s); if (!e.city) return L('โรงไฟฟ้ายังจ่ายไฟปกติ หรือเหตุการณ์นี้ไม่ทำให้โรงหยุด ถ้าโรงหยุด ศูนย์ควบคุมจะสั่งโรงอื่นเพิ่มกำลังแทน', 'The plant is still supplying power, or this event does not stop it. If it does stop, the control centre ramps up other plants'); return e.city.short > 0 ? L(`เสียไป ${fmt(e.city.lost)} MW แต่สำรองมี ${fmt(s.res)} MW ระบบจึงตัดโหลดอัตโนมัติ (UFLS) ~${fmt(e.city.short)} MW ราว ${fmt(e.city.homes)} ครัวเรือน ไฟฟ้าดับเป็นพื้นที่หมุนเวียนจนกว่าจะหาไฟมาแทนได้ โรงพยาบาล: UPS จ่ายไฟห้องผ่าตัดและ ICU ทันที เครื่องปั่นไฟติดใน 10 วินาที · โรงงานชิป: UPS พาเครื่องจักรหยุดอย่างปลอดภัย เวเฟอร์ที่กำลังผลิตอาจต้องทิ้ง`, `${fmt(e.city.lost)} MW lost but only ${fmt(s.res)} MW in reserve, so relays shed ~${fmt(e.city.short)} MW (about ${fmt(e.city.homes)} homes) and blackouts rotate by area until supply is found. Hospital: UPS carries theatres and ICU instantly and generators start within 10 s · Chip fab: UPS lets tools stop safely; wafers in process may be scrapped`) : L(`เสียไป ${fmt(e.city.lost)} MW แต่ระบบมีสำรอง ${fmt(s.res)} MW โรงอื่นเพิ่มกำลังแทนภายในไม่กี่วินาที ความถี่ไฟแค่กระตุกเล็กน้อย ไฟในเมืองไม่ดับ`, `${fmt(e.city.lost)} MW lost, but ${fmt(s.res)} MW of reserve covers it within seconds. Frequency dips slightly and the city keeps its lights`); } };
  const spotVil = { at: () => [R[0].x - 46, R[0].y + 6], k: 'p', t: () => tx(R[0].t), d: s => { const e = evalAll(s), o = e.out.vil; const base = o ? (o.st === 'bad' ? L('อยู่ในพื้นที่อันตราย ทำตามประกาศของ ปภ. และท้องถิ่น: หลบในอาคาร ปิดหน้าต่าง หรืออพยพตามเส้นทาง', 'In the danger area: follow DDPM and local instructions to shelter indoors, close windows or evacuate along set routes') : o.st === 'warn' ? L('ใกล้เกณฑ์ ควรติดตามประกาศ ลดกิจกรรมกลางแจ้ง โดยเฉพาะเด็กและผู้สูงอายุ', 'Close to the limit: follow announcements and cut outdoor activity, especially for children and older people') : L('ปลอดภัยในสถานการณ์นี้ ชุมชนช่วยแจ้งเหตุผิดปกติ เช่น กลิ่น ฝุ่น หรือน้ำเปลี่ยนสี', 'Safe in this scenario; residents help by reporting odours, dust or discoloured water')) : L('เหตุการณ์นี้ไม่กระทบชุมชนโดยตรง', 'This event does not affect the village directly'); return base + ' · ' + tx(D.ppl[0].r); } };
  const uniR = R.find(r => r.id === 'uni');
  const spotUni = { at: () => [uniR.x + 34, uniR.y - 10], k: 'p', t: () => L('นักวิจัยและนักศึกษา', 'Researchers and students'), d: () => tx(D.ppl[1].r) };
  const spotGov = { at: () => [sc.plant[0] - 70, sc.plant[1] + 70], k: 'p', t: () => tx(it.gov[0].n), d: () => it.gov.slice(0, 3).map(g => tx(g.n) + ': ' + tx(g.r)).join(' · ') };
  const spots = [spotPlant, spotGov, spotVil, spotUni, spotCity];

  return {
    controls: ctr,
    init(s) { s.et = 0; s.parts = []; s.sh = 0; },
    step(s, dt) { s.et += dt; },
    metrics(s) {
      const e = evalAll(s);
      const rows = [[L('เหตุการณ์', 'Event'), tx(D.kinds[k]) + ' · ' + tx(hz.t)], [L('ที่โรงไฟฟ้า', 'At the plant'), e.plant]];
      R.filter(r => e.out[r.id]).sort((a, b) => ({ bad: 0, warn: 1, ok: 2 }[e.out[a.id].st] - { bad: 0, warn: 1, ok: 2 }[e.out[b.id].st])).slice(0, 4).forEach(r => rows.push([tx(r.t), (e.out[r.id].st === 'bad' ? '● ' : e.out[r.id].st === 'warn' ? '◐ ' : '○ ') + e.out[r.id].lab]));
      if (e.atRisk) rows.push([L('คนในพื้นที่เสี่ยง (ประมาณ)', 'People at risk (est.)'), fmt(e.atRisk) + L(' คน', '')]);
      if (canTrip) rows.push([L('ไฟฟ้าในเมือง', 'City power'), !e.city ? L('ปกติ', 'Normal') : e.city.short > 0 ? L(`ตัดไฟบางพื้นที่ ~${fmt(e.city.homes)} ครัวเรือน · โรงพยาบาลใช้ไฟสำรอง`, `Load shedding ~${fmt(e.city.homes)} homes · hospital on backup`) : L('ไม่ดับ (สำรองพอ)', 'No blackout (reserve covers it)')]);
      rows.push([L('เกณฑ์ที่ใช้', 'Reference'), e.note]);
      return rows;
    },
    spots,
    draw(c, s, t, P) {
      const e = evalAll(s);
      // screen shake for earthquakes
      c.save(); if (k === 'quake') { const a = clamp(s._pga * 30, 0, 9) * (Math.sin(t * 40) * .5 + .5); c.translate(Math.sin(t * 53) * a, Math.cos(t * 47) * a * .6); }
      (sc === SEA ? drawSea : drawLand)(c, P, sc, t);
      // hazard visuals under receptors
      const [px, py] = src;
      if (k === 'air' || k === 'rad' || (k === 'fire' && m.smoke) || (k === 'gas' && m.toxic)) {
        const a = windAng(s); const amt = k === 'air' ? clamp((100 - s.eff) / Math.max(.01, 100 - m.eff[0]) / 6, .08, 1) : k === 'rad' ? (+s.lvl >= 2 ? (s.g ? .25 : 1) : 0) : k === 'fire' ? s.sz / 100 : clamp(s.hole / m.hole[2], .15, 1) * (s.g ? .5 : 1);
        const col = k === 'air' ? (P.dark ? '150,150,150' : '90,90,90') : k === 'rad' ? '200,90,220' : k === 'fire' ? '60,60,60' : '210,190,60';
        const n = Math.round(34 * amt) + 12, spd = 18 * s.u;
        const hsh = q => { const v = Math.sin(q * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
        for (let i = 0; i < n; i++) { const kk = ((t * spd / 400) + hsh(i)) % 1; const d = kk * 560; const spread = 10 + d * .28; const off = (hsh(i + 50) - .5) * 2 * spread; const x = px + Math.cos(a) * d - Math.sin(a) * off, y = py + Math.sin(a) * d + Math.cos(a) * off; c.fillStyle = `rgba(${col},${(1 - kk) * .5 * Math.max(.55, amt)})`; c.beginPath(); c.arc(x, y, 6 + kk * 22, 0, 7); c.fill(); }
      }
      if (k === 'rad' && !m.fusion) { [5, 30].forEach(km => { const r = km / kmpp; if (r < 900) ring(c, sc.plant[0], sc.plant[1], r, '#c85adc', .05, true); txt(c, `${km} km`, sc.plant[0] + r * .7, sc.plant[1] - r * .7, '#c85adc', 10); }); }
      if (k === 'gas') { if (it.id === 'gas') { pipe(c, [sc.plant, [330, 205], [430, 205], [W, 190]], P.dark ? '#c9b26a' : '#a68a2c', 4); } const r0 = m.k * s.hole * (s.g ? .55 : 1) / 1000 / kmpp; if (!m.toxic) { ring(c, px, py, r0 * (s.ign ? 1 : .7) * (1 + .04 * Math.sin(t * 6)), s.ign ? '#ff6a2b' : '#f2d44d', s.ign ? .35 : .18); if (s.ign) { for (let i = 0; i < 10; i++) { const a2 = t * 3 + i; c.fillStyle = 'rgba(255,170,40,.6)'; c.beginPath(); c.arc(px + Math.cos(a2) * r0 * .3, py - Math.abs(Math.sin(a2)) * r0 * .5, 8, 0, 7); c.fill(); } } } else { const a = windAng(s); c.save(); c.translate(px, py); c.rotate(a); c.beginPath(); c.ellipse(r0 * 2.2 * 3 / s.u / 2 - r0 * .3, 0, r0 * 2.2 * 3 / s.u / 2 + r0 * .3, r0 * .6, 0, 0, 7); c.fillStyle = 'rgba(210,190,60,.22)'; c.fill(); c.strokeStyle = '#c9a400'; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]); c.restore(); } txt(c, L('จุดรั่ว', 'Leak'), px, py - 34, P.fossil, 10); }
      if (k === 'water') {
        const e2 = (100 - s.eff) / Math.max(.01, 100 - m.eff[0]); const col = `rgba(140,90,40,${clamp(.15 + e2 * .12, .15, .75)})`;
        if (sc === SEA) { const a = windAng(s); const r = 60 + ((s.et * 20) % 260); c.save(); c.translate(px, py); c.rotate(a); c.beginPath(); c.ellipse(r * .45, 0, r * .7, r * .4, 0, 0, 7); c.fillStyle = col; c.fill(); c.restore(); }
        else { const [, a0] = alongRiver(sc.river, sc.out); const L0 = polyLen(sc.river); const front = Math.min(L0, a0 + ((s.et * 40) % (L0 - a0 + 200))); const pts = []; for (let d = a0; d <= front; d += 8) pts.push(polyAt(sc.river, d)); if (pts.length > 1) pipe(c, pts, col, 14); pipe(c, [[sc.plant[0], sc.plant[1] - 26], sc.out], '#8c5a28', 3); }
      }
      if (k === 'fire') { const r0 = m.r0 * s.sz / 100 * (s.g ? .45 : 1) / 1000 / kmpp; ring(c, px, py, r0, '#ff6a2b', .28); ring(c, px, py, r0 * 2, '#ff6a2b', .06, true); for (let i = 0; i < 8; i++) { const f = (t * 2 + i / 8) % 1; c.fillStyle = `rgba(255,${120 + i * 12},40,${1 - f})`; c.beginPath(); c.arc(px - 16 + i * 4, py - 26 - f * 26, 6 * (1 - f) + 2, 0, 7); c.fill(); } }
      if (k === 'noise') { const n = 5; for (let i = 0; i < n; i++) { const f = ((t * .6) + i / n) % 1; c.strokeStyle = m.marine ? 'rgba(255,255,255,' + (1 - f) * .7 + ')' : 'rgba(229,72,77,' + (1 - f) * .6 + ')'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 30 + f * 380 * (1 - s.red / 40), 0, 7); c.stroke(); } if (m.marine && s.red > 0) ring(c, px, py, 40, '#ffffff', .25, true); }
      if (k === 'flood') { const [, a0] = alongRiver(sc.river, sc.plant); const L0 = polyLen(sc.river); const spd = m.spd * (.5 + s.br / 100); const hrs = (s.et * .6) % 8; const front = Math.min(L0, a0 + hrs * spd / kmpp); for (let d = a0; d <= front; d += 6) { const [x, y] = polyAt(sc.river, d); c.fillStyle = 'rgba(70,130,200,.35)'; c.beginPath(); c.arc(x, y, 30 + s.br * .5, 0, 7); c.fill(); } txt(c, L(`ผ่านไป ${fmt(hrs, 1)} ชม.`, `${fmt(hrs, 1)} h after breach`), 120, 30, P.fg, 12, 'left'); }
      if (k === 'quake') { const n = 4; for (let i = 0; i < n; i++) { const f = ((t * .5) + i / n) % 1; c.strokeStyle = `rgba(237,161,0,${(1 - f) * .7})`; c.lineWidth = 3; c.beginPath(); c.arc(-40, -40, 60 + f * 900, 0, 7); c.stroke(); } txt(c, m.induced ? L(`แผ่นดินไหวถูกกระตุ้น M${fmt(s._M, 1)}`, `Induced quake M${fmt(s._M, 1)}`) : L(`ศูนย์กลาง M${fmt(s.M, 1)} ห่าง ${fmt(s.Rk)} km`, `Epicentre M${fmt(s.M, 1)}, ${fmt(s.Rk)} km away`), 20, 24, P.s4, 12, 'left'); }
      // animals for eco
      if (k === 'eco' || sc === SEA) {
        const birds = /นก|bird|ค้างคาว|bat/i.test(tx(m.anim) || '') || sc === SEA, fish = /ปลา|fish|แมวน้ำ|seal/i.test(tx(m.anim) || '');
        const hit = k === 'eco' ? 1 - s.red / 100 : 0;
        if (birds && k === 'eco') for (let i = 0; i < 9; i++) { const a = t * .5 + i * .7, rr2 = 50 + (i % 3) * 30; const x = sc.plant[0] + Math.cos(a) * rr2 * 1.6, y = sc.plant[1] - 50 + Math.sin(a) * rr2 * .5; const dead = (i / 9) < hit * .5 && Math.sin(t * 2 + i) > .7; c.strokeStyle = dead ? SEV.bad : P.fg; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 6, y); c.quadraticCurveTo(x - 3, y - 4 - Math.sin(t * 8 + i) * 2, x, y); c.quadraticCurveTo(x + 3, y - 4 - Math.sin(t * 8 + i) * 2, x + 6, y); c.stroke(); }
        if (fish && sc === LAND) { const L0 = polyLen(sc.river), [, a0] = alongRiver(sc.river, sc.out); for (let i = 0; i < 8; i++) { let d = L0 - ((t * 30 + i * 70) % (L0 - 20)); const blocked = (i / 8) < hit; if (blocked && d < a0 + 20) d = a0 + 20 + (i * 7) % 20; const [x, y] = polyAt(sc.river, d); c.fillStyle = blocked && d < a0 + 45 ? SEV.bad : '#f2b451'; c.beginPath(); c.ellipse(x, y, 5, 2.5, 0, 0, 7); c.fill(); } if (it.id === 'hydro') txt(c, L('ปลาว่ายทวนน้ำ', 'Fish swimming upstream'), 470, 345, P.fg2, 10); }
        if (sc === SEA) { for (let i = 0; i < 3; i++) { const x = 390 + Math.sin(t * .4 + i * 2) * 50, y = 325 + i * 14; c.fillStyle = P.dark ? '#9fb6c8' : '#5c7c96'; c.beginPath(); c.ellipse(x, y, 12, 4, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - 2, y - 3); c.lineTo(x + 2, y - 9); c.lineTo(x + 5, y - 3); c.fill(); } for (let i = 0; i < 5; i++) { const x = 420 + Math.cos(t * .7 + i) * 40, y = 95 + Math.sin(t * 1.1 + i) * 10; c.strokeStyle = P.fg; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 5, y); c.quadraticCurveTo(x - 2, y - 4, x, y); c.quadraticCurveTo(x + 2, y - 4, x + 5, y); c.stroke(); } }
      }
      // wind arrow
      if (usesWind) { const a = windAng(s); rr(c, W - 118, H - 58, 104, 44, 8, P.dark ? 'rgba(17,24,22,.8)' : 'rgba(255,255,255,.85)', P.line); arrow(c, W - 96 - Math.cos(a) * 12, H - 36 - Math.sin(a) * 12, a, 18, P.cond); txt(c, `${fmt(s.u, 1)} m/s`, W - 50, H - 36, P.fg, 11); }
      // scale bar
      const sb = [1, 2, 5, 10, 20].find(v => v / kmpp > 60) || 20; pipe(c, [[16, H - 16], [16 + sb / kmpp, H - 16]], P.fg, 3); txt(c, `${sb} km`, 16 + sb / kmpp / 2, H - 28, P.fg, 10);
      // plant & receptors
      drawPlant(c, P, it, sc, t, e.trip, e);
      R.forEach(r => { const o = e.out[r.id]; drawRec(c, P, r, o && o.st, o ? tx(r.s) + ' · ' + o.lab : (r.city || r.id === 'vil' || r.id === 'uni') ? tx(r.s) : ''); });
      // city lights / blackout
      const cr = R.find(r => r.city);
      if (e.city) { const dark = e.city.short > 0; if (dark) { c.fillStyle = 'rgba(10,14,20,.6)'; c.fillRect(cr.x - 50, cr.y - 44, 102, 58); c.fillStyle = Math.sin(t * 4) > 0 ? '#ffd65a' : '#fff3b0'; c.beginPath(); c.arc(cr.x - 46, cr.y + 10, 3, 0, 7); c.fill(); } txt(c, dark ? L('⚡ ตัดไฟบางพื้นที่', '⚡ Load shedding') : L('⚡ ไฟไม่ดับ', '⚡ Lights stay on'), cr.x, cr.y - 54, dark ? SEV.bad : SEV.ok, 11); if (dark) { const lb2 = L('โรงพยาบาล: UPS → เครื่องปั่นไฟ ≤10 วิ', 'Hospital: UPS → generator ≤10 s'); c.font = '500 10px "IBM Plex Sans Thai",system-ui,sans-serif'; const w2 = c.measureText(lb2).width + 12; rr(c, W - w2 - 6, cr.y + 58, w2, 16, 8, P.dk); txt(c, lb2, W - w2 / 2 - 6, cr.y + 66.5, '#fff', 10); } }
      // people
      person(c, sc.plant[0] - 70, sc.plant[1] + 70, P.cond, P, 0, '#ffffff');
      person(c, R[0].x - 46, R[0].y + 6, P.s4, P, t * 3, '#c99a78');
      c.restore();
      // event banner (not shaken)
      const lb = tx(D.kinds[k]) + ' · ' + tx(hz.t); c.font = '600 12px "IBM Plex Sans Thai",system-ui,sans-serif'; const w = Math.min(W - 40, c.measureText(lb).width + 26);
      if (k !== 'quake' && k !== 'flood') { rr(c, 20, 14, w, 28, 8, P.dark ? 'rgba(17,24,22,.88)' : 'rgba(255,255,255,.92)', P.line); txt(c, lb, 33, 28.5, P.fossil, 12, 'left'); }
    }
  };
}

/* ---------- backup-power room: detection, evacuation, suppression ---------- */
function backup(D) {
  const B = D.backup;
  const ctr = [
    { id: 'room', type: 'select', label: L('ห้องไฟสำรอง', 'Backup room'), val: 'li', opts: [['li', tx(B.rooms.li.t)], ['la', tx(B.rooms.la.t)], ['dg', tx(B.rooms.dg.t)]] },
    { id: 'det', type: 'toggle', label: L('เซนเซอร์ตรวจเร็ว (ก๊าซจากแบต / H₂ / น้ำมันรั่ว)', 'Early sensors (battery off-gas / H₂ / fuel leak)'), val: true },
    { id: 'vesda', type: 'toggle', label: L('เครื่องตรวจควันแบบดูดอากาศ (VESDA) + ตรวจเปลวไฟ', 'Aspirating smoke (VESDA) + flame detection'), val: true },
    { id: 'vent', type: 'toggle', label: L('พัดลมระบายก๊าซ', 'Exhaust ventilation'), val: true },
    { id: 'sup', type: 'select', label: L('ระบบดับเพลิง', 'Suppression'), val: 'water', opts: [['water', L('น้ำ: สปริงเกลอร์ / ละอองน้ำ', 'Water: sprinklers / mist')], ['agent', L('ก๊าซดับเพลิงสะอาด', 'Clean agent gas')], ['none', L('ไม่มี (ถังดับเพลิงมือถือ)', 'None (hand extinguishers)')]] }
  ];
  const sig = s => [s.room, s.det, s.vesda, s.vent, s.sup].join();
  function tl(s) { // timeline events in seconds for the current setup
    const e = { room: s.room };
    if (s.room === 'li') {
      e.vent0 = 60; e.flame = s.det ? 170 : 150; e.alarm = s.det ? 62 : s.vesda ? 95 : e.flame + 25;
      e.supT = s.sup === 'water' ? e.flame + 20 : s.sup === 'agent' ? Math.max(e.alarm + 30, e.flame) : null;
      e.spread = s.det ? null : 240; if (e.supT && s.sup === 'water' && e.spread && e.supT < e.spread) e.spread = null;
      e.reign = s.sup === 'agent' ? e.supT + 90 : null;
    } else if (s.room === 'la') {
      e.alarm = s.det ? 100 : null; e.stop = e.alarm; e.boom = !s.vent && !s.det ? 400 : null; if (e.boom) e.alarm = e.boom;
    } else {
      e.leak = 0; e.shut = s.det ? 10 : null; e.flame = s.det ? null : 90; e.alarm = s.det ? 10 : s.vesda ? 95 : 120; e.supT = e.flame != null && s.sup !== 'none' ? e.flame + (s.sup === 'water' ? 25 : 30) : null;
    }
    return e;
  }
  const people = [{ x0: 160, y: 398 }, { x0: 330, y: 398 }, { x0: 480, y: 398 }];
  function state(s) {
    const e = tl(s), T = s.T; const o = { e, flame: 0, gas: 0, temp: 28, stage: '', bad: false, ok: false };
    if (e.room === 'li') {
      o.temp = T < e.vent0 ? 30 + T * 1.5 : T < e.flame ? 120 + (T - e.vent0) * 1.2 : 600;
      o.gas = T < e.vent0 ? 0 : Math.min(100, (T - e.vent0) * (s.vent ? .12 : .5)); // % of LFL
      o.flame = T >= e.flame ? (e.spread && T >= e.spread ? Math.min(1, .35 + (T - e.spread) / 200) : .3) : 0;
      if (e.supT && T >= e.supT) { o.flame = 0; o.temp = s.sup === 'water' ? Math.max(60, 600 - (T - e.supT) * 6) : 400; }
      if (e.reign && T >= e.reign) { o.flame = .45; o.temp = 600; }
      if (s.det && T >= 62) { o.gas = Math.min(o.gas, s.vent ? 8 : 40); }
      o.stage = T < e.vent0 ? L('เซลล์หนึ่งเริ่มร้อนผิดปกติ', 'One cell starts overheating') : T < e.flame ? (s.det && T >= 62 ? L('BMS ตัดแร็กนั้นออก พัดลมระบายก๊าซ สัญญาณอพยพ', 'BMS isolates that rack, fans vent the gas, evacuation alarm') : L('เซลล์ปล่อยก๊าซ (off-gas) ยังไม่มีควันให้เห็น', 'Cell vents gas; no visible smoke yet')) : (e.supT && T >= e.supT) ? (e.reign && T >= e.reign ? L('ก๊าซดับเปลวได้แต่แบตยังร้อน ไฟลุกขึ้นอีก ต้องใช้น้ำทำความเย็น', 'Gas knocked the flames down but the cells stayed hot and re-ignited; water cooling is needed') : s.sup === 'water' ? L('น้ำทำความเย็น ไฟหยุดลาม เฝ้าระวังต่อหลายชั่วโมง', 'Water cools the cells and stops the spread; watch for hours') : L('ก๊าซดับเพลิงดับเปลวแล้ว', 'Clean agent has knocked down the flames')) : e.spread && T >= e.spread ? L('ไฟลามข้ามเซลล์และแร็ก (thermal runaway propagation)', 'Fire spreads cell to cell and rack to rack') : L('เกิดเปลวไฟที่แร็กเดียว', 'Flames at one rack');
      o.bad = (e.spread && T >= e.spread && !(e.supT && T >= e.supT)) || (e.reign && T >= e.reign) || (!s.vent && o.gas > 25 && !o.flame);
      o.ok = (e.supT && T >= e.supT && !(e.reign && T >= e.reign) && s.sup === 'water') || (s.det && s.vent && T >= 62 && !o.flame);
    } else if (e.room === 'la') {
      const h2 = s.vent ? Math.min(.3, T * .004) : (e.stop && T >= e.stop ? 1 : Math.min(4.2, T * .0105)); o.gas = h2 / 4 * 100; o.temp = 27;
      o.stage = s.vent ? L('พัดลมทำงาน ไฮโดรเจนต่ำกว่า 0.3% ปลอดภัย', 'Fans running: hydrogen stays under 0.3%, safe') : e.stop && T >= e.stop ? L('เซนเซอร์ H₂ เตือนที่ 1% ระบบหยุดชาร์จ ทุกคนออกจากห้อง', 'H₂ sensor alarms at 1%, charging stops and everyone leaves') : e.boom && T >= e.boom ? L('ไฮโดรเจนถึง 4% เจอประกายไฟ ระเบิด', 'Hydrogen reached 4% and a spark ignited it') : L('พัดลมเสีย ไฮโดรเจนสะสมระหว่างชาร์จ', 'Fan failed: hydrogen builds up while charging');
      o.flame = e.boom && T >= e.boom && T < e.boom + 4 ? 1 : 0; o.bad = !!(e.boom && T >= e.boom); o.ok = s.vent || (e.stop && T >= e.stop);
    } else {
      const pool = e.shut != null ? Math.min(1, e.shut / 60) * .3 : Math.min(1, T / 120); o.pool = pool; o.gas = 0; o.temp = 35;
      o.flame = e.flame != null && T >= e.flame ? (e.supT && T >= e.supT ? 0 : Math.min(1, .3 + (T - e.flame) / 120)) : 0; if (o.flame) o.temp = 500;
      o.stage = e.shut != null ? L('เซนเซอร์ในถาดรองจับน้ำมันรั่ว ตัดวาล์วน้ำมัน เครื่องปั่นไฟสลับไปถังสำรอง', 'Bund leak sensor trips: fuel valve closes and the generator switches to the reserve tank') : o.flame ? L('น้ำมันรั่วถึงท่อไอเสียร้อน ไฟลุก', 'Leaking fuel reached the hot exhaust and ignited') : e.supT && T >= e.supT ? L('ระบบดับเพลิงดับไฟแล้ว คันกั้นเก็บน้ำมันไว้ไม่ให้ไหลออก', 'Suppression put the fire out; the bund kept fuel from escaping') : L('น้ำมันรั่วสะสมในถาดรอง', 'Fuel leaking into the bund');
      o.bad = o.flame > .6; o.ok = e.shut != null || (e.supT && T >= e.supT);
    }
    return o;
  }
  return {
    controls: ctr,
    init(s) { s.T = 0; s._sig = ''; },
    step(s, dt) { if (sig(s) !== s._sig) { s._sig = sig(s); s.T = 0; } s.T += dt * 4; if (s.T > 520) s.T = 0; },
    metrics(s) { const o = state(s), e = o.e; return [
      [L('เวลาหลังเริ่มเหตุ', 'Time since start'), `${fmt(s.T)} s`], [L('สถานะ', 'Status'), o.stage],
      [s.room === 'li' ? L('อุณหภูมิเซลล์ / ก๊าซ (% ของจุดติดไฟ)', 'Cell temp / gas (% of LFL)') : s.room === 'la' ? L('ไฮโดรเจนในห้อง', 'Hydrogen in room') : L('อุณหภูมิห้อง', 'Room temperature'), s.room === 'li' ? `${fmt(o.temp)} °C · ${fmt(o.gas)}%` : s.room === 'la' ? `${fmt(o.gas / 25, 2)}%` : `${fmt(o.temp)} °C`],
      [L('สัญญาณเตือนอพยพ', 'Evacuation alarm'), e.alarm != null ? L(`ที่ ${fmt(e.alarm)} วินาที`, `at ${fmt(e.alarm)} s`) : L('ไม่ต้องอพยพ', 'not needed')],
      [L('ผลลัพธ์', 'Outcome'), o.bad ? L('● ลุกลาม / อันตราย', '● Spreading / dangerous') : o.ok ? L('○ ควบคุมได้', '○ Under control') : L('◐ กำลังรับมือ', '◐ Responding')],
      [L('มาตรฐานหลัก', 'Key standards'), s.room === 'dg' ? 'NFPA 110 · NFPA 37 · NFPA 30' : s.room === 'la' ? 'IEC 62485-2 · NFPA 855' : 'NFPA 855 · UL 9540A · NFPA 72']]; },
    spots: [
      { x: 300, y: 72, k: 'm', t: () => L('เซนเซอร์บนเพดาน', 'Ceiling sensors'), d: s => tx(B.rooms[s.room].detect) },
      { x: 470, y: 72, k: 'm', t: () => L('ระบบดับเพลิงและระบายก๊าซ', 'Suppression and ventilation'), d: s => tx(B.rooms[s.room].supp) },
      { x: 120, y: 250, k: 'm', t: s => tx(B.rooms[s.room].t), d: s => tx(B.rooms[s.room].risk) },
      { x: 720, y: 395, k: 'p', t: () => L('จุดรวมพล', 'Assembly point'), d: () => tx(B.evac) }
    ],
    draw(c, s, t, P) {
      const o = state(s), e = o.e, T = s.T;
      c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
      c.fillStyle = P.ground; c.fillRect(620, 0, 180, H);
      rr(c, 40, 50, 580, 352, 6, P.panel, P.line); c.lineWidth = 4; c.strokeStyle = P.fg2; c.strokeRect(40, 50, 580, 352);
      txt(c, L('ผนังกันไฟ 2 ชม.', '2-hour fire-rated wall'), 330, 40, P.muted, 10);
      // door
      const open = e.alarm != null && T >= e.alarm && T < e.alarm + 40; c.fillStyle = open ? P.ground : P.metal2; c.fillRect(612, 300, 12, 100); txt(c, L('ทางออก', 'EXIT'), 618, 288, SEV.ok, 10);
      // equipment
      if (s.room !== 'dg') {
        for (let i = 0; i < 5; i++) { const x = 80 + i * 92, hot = i === 0; rr(c, x, 180, 70, 216, 4, P.dk, P.line); for (let j = 0; j < 8; j++) { let col = s.room === 'la' ? '#6b7a86' : '#3d6b8c'; if (hot && s.room === 'li') { const k = clamp((o.temp - 30) / 300, 0, 1); col = `rgb(${Math.round(lerp(61, 255, k))},${Math.round(lerp(107, 90, k))},${Math.round(lerp(140, 40, k))})`; } if (o.flame && e.spread && T >= e.spread && i <= Math.floor((T - e.spread) / 60) && !(e.supT && T >= e.supT)) col = '#ff6a2b'; rr(c, x + 6, 188 + j * 25, 58, 20, 2, col); } }
        txt(c, s.room === 'li' ? 'BMS' : L('เครื่องชาร์จ', 'Charger'), 545, 220, P.fg2, 10); rr(c, 525, 230, 40, 70, 3, P.metal2, P.line); c.fillStyle = (s.det && e.alarm != null && T >= e.alarm) ? (Math.sin(t * 10) > 0 ? SEV.bad : SEV.warn) : SEV.ok; c.beginPath(); c.arc(545, 245, 5, 0, 7); c.fill();
      } else {
        rr(c, 90, 230, 260, 160, 8, P.metal2, P.line); txt(c, L('เครื่องปั่นไฟดีเซล', 'Diesel generator'), 220, 300, P.fg, 12); pipe(c, [[330, 230], [330, 120], [620, 120]], P.metal, 10); txt(c, L('ท่อไอเสียร้อน', 'Hot exhaust'), 470, 108, P.fossil, 10);
        rr(c, 410, 300, 150, 95, 4, P.panel, P.line); rr(c, 430, 260, 110, 70, 6, P.metal, P.line); txt(c, L('ถังน้ำมันประจำวัน', 'Day tank'), 485, 295, '#fff', 10); txt(c, L('คันกั้น 110%', '110% bund'), 485, 382, P.fg2, 9);
        if (o.pool) { c.fillStyle = 'rgba(140,100,30,.55)'; c.beginPath(); c.ellipse(485, 385, 70 * o.pool + 6, 6, 0, 0, 7); c.fill(); if (!e.shut) { c.beginPath(); c.ellipse(lerp(410, 330, o.pool), 390, 50 * o.pool, 5, 0, 0, 7); c.fill(); } }
        pipe(c, [[430, 300], [350, 300]], P.dk, 4); if (e.shut != null && T >= e.shut) { txt(c, L('ตัดวาล์ว', 'Valve shut'), 390, 288, SEV.ok, 10); }
      }
      // flames
      if (o.flame) { const fx = s.room === 'dg' ? 340 : 115, fy = s.room === 'dg' ? 230 : 180; for (let i = 0; i < 14 * o.flame + 4; i++) { const f = (t * 2.4 + i / 10) % 1; c.fillStyle = `rgba(255,${110 + (i % 5) * 25},30,${1 - f})`; c.beginPath(); c.arc(fx - 30 + (i * 13) % 60 + (o.flame > .5 ? (i % 3) * 60 : 0), fy - f * 60 * o.flame - 4, 9 * (1 - f) + 3, 0, 7); c.fill(); } }
      if (s.room === 'la' && o.flame) { c.fillStyle = 'rgba(255,240,180,.7)'; c.fillRect(40, 50, 580, 352); }
      // gas haze
      if (o.gas > 1) { c.fillStyle = s.room === 'la' ? `rgba(120,180,255,${clamp(o.gas / 140, 0, .5)})` : `rgba(200,200,200,${clamp(o.gas / 120, 0, .55)})`; c.fillRect(42, 52, 576, 120 + o.gas * 1.5); }
      // ceiling: sensors, VESDA pipe, nozzles, fan
      pipe(c, [[60, 66], [600, 66]], s.vesda ? '#e5484d' : P.line, 3); if (s.vesda) txt(c, 'VESDA', 90, 78, '#e5484d', 9);
      [180, 300, 420].forEach(x => { rr(c, x - 8, 60, 16, 10, 3, s.det ? SEV.ok : P.metal2); });
      if (s.sup !== 'none') [150, 270, 390, 510].forEach(x => { c.fillStyle = P.metal; c.fillRect(x - 3, 52, 6, 22); if (e.supT != null && T >= e.supT) { for (let i = 0; i < 10; i++) { const f = (t * 3 + i / 10) % 1; c.fillStyle = s.sup === 'water' ? `rgba(95,168,211,${1 - f})` : `rgba(230,230,240,${(1 - f) * .7})`; c.beginPath(); c.arc(x + Math.sin(i * 2) * f * 40, 76 + f * 200, s.sup === 'water' ? 2.5 : 8, 0, 7); c.fill(); } } });
      const fan = s.vent && !(s.room === 'li' && o.flame && s.sup === 'agent' && e.supT && T >= e.supT); rr(c, 560, 56, 40, 26, 4, P.metal2, P.line); LabSim.H.rotor(c, 580, 69, 10, fan ? t * 12 : 0, P.fg2, 4, 2); if (fan) for (let i = 0; i < 4; i++) { const f = (t + i / 4) % 1; c.fillStyle = `rgba(160,160,160,${1 - f})`; c.beginPath(); c.arc(600 + f * 60, 60 - f * 30, 5, 0, 7); c.fill(); }
      // alarm strobe
      if (e.alarm != null && T >= e.alarm && Math.sin(t * 12) > 0) { c.fillStyle = 'rgba(229,72,77,.12)'; c.fillRect(40, 50, 580, 352); c.fillStyle = '#e5484d'; c.beginPath(); c.arc(60, 110, 8, 0, 7); c.fill(); }
      if (s.sup === 'agent' && e.alarm != null && T >= e.alarm && T < e.alarm + 30) txt(c, L(`หน่วงเวลาก่อนปล่อยก๊าซ ${fmt(30 - (T - e.alarm))} วินาที`, `Agent release in ${fmt(30 - (T - e.alarm))} s`), 330, 140, '#e5484d', 13);
      // people: work → walk to exit → assembly
      people.forEach((p, i) => { let x = p.x0 + Math.sin(t * .8 + i) * 10, walk = 0; if (e.alarm != null && T >= e.alarm) { const k = clamp((T - e.alarm - i * 3) / 30, 0, 1); x = lerp(p.x0, 610, Math.min(1, k * 1.3)); if (k > .77) x = lerp(610, 700 + i * 18, (k - .77) / .23); walk = k < 1 ? t * 8 : 0; } person(c, x, p.y, P.cond, P, walk, '#f2b451'); });
      rr(c, 680, 400, 90, 6, 3, SEV.ok); txt(c, L('จุดรวมพล', 'Assembly'), 725, 418, SEV.ok, 10);
      const lb = tx(B.rooms[s.room].t); c.font = '600 12px "IBM Plex Sans Thai",system-ui,sans-serif'; const w = c.measureText(lb).width + 26; rr(c, 56, 92, w, 26, 8, P.dark ? 'rgba(17,24,22,.88)' : 'rgba(255,255,255,.92)', P.line); txt(c, lb, 69, 105.5, P.fossil, 12, 'left');
    }
  };
}
window.LabSafety = { build, backup };
})();

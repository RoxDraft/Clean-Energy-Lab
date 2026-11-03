/* Clean Energy Lab · Simulations
   แบบจำลองอย่างง่ายเพื่อการเรียนรู้ ตัวเลขเป็นค่าประมาณ ไม่ตามสเกลจริง
   แต่ละฉากวาดบนพื้นที่เสมือน 800x450 แล้วย่อ/ขยายตามจอ */
(function () {
'use strict';
const W = 800, H = 450, GROUND = 400;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const fmt = (v, d = 0) => (isFinite(v) ? v : 0).toLocaleString('th-TH', { maximumFractionDigits: d, minimumFractionDigits: d });

/* ---------- palette from page tokens ---------- */
function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  const dark = document.documentElement.dataset.theme === 'dark' ||
    (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  return {
    dark, bg: v('--bg'), panel: v('--panel'), line: v('--line'), fg: v('--fg'), fg2: v('--fg2'), muted: v('--muted'),
    clean: v('--clean'), fossil: v('--fossil'), cond: v('--cond'), s4: v('--s4'),
    sky: dark ? ['#0f1a22', '#1a2a33'] : ['#cfe7f3', '#eef6f9'],
    ground: dark ? '#22302b' : '#d9e2d6', soil: dark ? '#2e2a24' : '#b9a58a',
    metal: dark ? '#55636b' : '#9aa7ad', metal2: dark ? '#3b474e' : '#c3ccd0', dk: dark ? '#0b1114' : '#2b3338',
    water: dark ? '#1f5a7a' : '#5fa8d3', water2: dark ? '#163f56' : '#3d86b5',
    steam: dark ? 'rgba(220,230,235,.55)' : 'rgba(255,255,255,.9)', smoke: dark ? 'rgba(140,140,140,.5)' : 'rgba(90,90,90,.35)',
    hot: '#ff6a2b', warm: '#f2b451', glow: '#7fd8ff', elec: dark ? '#ffd65a' : '#e0a400', h2: '#53b7ff'
  };
}

/* ---------- drawing helpers ---------- */
function rr(c, x, y, w, h, r, fill, stroke) {
  c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h);
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
}
function txt(c, s, x, y, col, size = 11, align = 'center') {
  c.fillStyle = col; c.font = `500 ${size}px "IBM Plex Sans Thai",system-ui,sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y);
}
function sky(c, P, night = 0) {
  const g = c.createLinearGradient(0, 0, 0, GROUND);
  const top = night > 0 ? mix(P.sky[0], '#060b14', night) : P.sky[0];
  const bot = night > 0 ? mix(P.sky[1], '#18233a', night) : P.sky[1];
  g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, W, GROUND);
}
function ground(c, P, y = GROUND) { c.fillStyle = P.ground; c.fillRect(0, y, W, H - y); }
function mix(a, b, k) {
  const p = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`;
}
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function polyAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l) { const k = d / l; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]; } d -= l;
  } return pts[pts.length - 1];
}
function pipe(c, pts, col, w = 6) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
/* moving dots along a path: rate 0..1 controls speed & density */
function flow(c, pts, t, rate, col, size = 3, n = 10) {
  if (rate <= 0.01) return; const L = polyLen(pts); c.fillStyle = col;
  const k = Math.max(2, Math.round(n * Math.min(1, rate + .2)));
  for (let i = 0; i < k; i++) { const d = ((t * 60 * (0.4 + rate) + i * L / k) % L); const [x, y] = polyAt(pts, d); c.beginPath(); c.arc(x, y, size, 0, 7); c.fill(); }
}
function rotor(c, x, y, r, ang, col, blades = 3, w = 5) {
  c.save(); c.translate(x, y); c.rotate(ang); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
  for (let i = 0; i < blades; i++) { c.beginPath(); c.moveTo(0, 0); const a = i * 2 * Math.PI / blades; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke(); }
  c.restore(); c.beginPath(); c.arc(x, y, w * .9, 0, 7); c.fillStyle = col; c.fill();
}
function puffs(c, x, y, amount, t, col, spread = 1, rise = 1) {
  if (amount <= 0.02) return; const n = Math.round(4 + amount * 10);
  for (let i = 0; i < n; i++) {
    const k = ((t * 0.35 * rise + i / n) % 1); const r = 6 + k * 26 * spread * (0.5 + amount);
    c.globalAlpha = (1 - k) * Math.min(1, amount * 1.4); c.fillStyle = col;
    c.beginPath(); c.arc(x + k * 50 * spread + Math.sin(i * 7 + t) * 4, y - k * 110 * rise, r, 0, 7); c.fill();
  } c.globalAlpha = 1;
}
function pylon(c, x, P, rate, t) {
  c.strokeStyle = P.metal; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x - 16, GROUND); c.lineTo(x - 4, GROUND - 150); c.lineTo(x + 4, GROUND - 150); c.lineTo(x + 16, GROUND); c.stroke();
  for (let i = 0; i < 4; i++) { const y = GROUND - 20 - i * 34; c.beginPath(); c.moveTo(x - 14 + i * 2.5, y); c.lineTo(x + 14 - i * 2.5, y - 17); c.stroke(); }
  c.beginPath(); c.moveTo(x - 24, GROUND - 130); c.lineTo(x + 24, GROUND - 130); c.moveTo(x - 18, GROUND - 105); c.lineTo(x + 18, GROUND - 105); c.stroke();
  [[-24, -130], [24, -130], [-18, -105], [18, -105]].forEach(([dx, dy]) => pipe(c, [[x + dx, GROUND + dy], [W + 10, GROUND + dy + 10]], P.metal, 1));
  flow(c, [[x + 24, GROUND - 130], [W, GROUND - 120]], t, rate, P.elec, 2.4, 4);
  flow(c, [[x + 18, GROUND - 105], [W, GROUND - 95]], t + .3, rate, P.elec, 2.4, 4);
}
function transformer(c, x, y, P, on) {
  rr(c, x, y, 34, 40, 3, P.metal2, P.metal);
  for (let i = 0; i < 4; i++) rr(c, x + 4 + i * 7, y - 8, 4, 10, 1, P.metal);
  c.fillStyle = on ? P.elec : P.muted; c.beginPath(); c.arc(x + 17, y + 20, 4, 0, 7); c.fill();
}
/* small worker figure with hard hat; walk phase animates legs */
function person(c, x, y, col, P, walk = 0, hat = '#f2b451', facing = 1) {
  c.save(); c.translate(x, y); c.scale(facing, 1);
  c.strokeStyle = P.fg; c.lineWidth = 2.2; c.lineCap = 'round';
  const sw = Math.sin(walk) * 4;
  c.beginPath(); c.moveTo(0, -10); c.lineTo(-sw, 0); c.moveTo(0, -10); c.lineTo(sw, 0); c.stroke();
  rr(c, -4, -22, 8, 13, 3, col);
  c.beginPath(); c.moveTo(-3, -19); c.lineTo(-6 - sw * .5, -11); c.moveTo(3, -19); c.lineTo(6 + sw * .5, -11); c.stroke();
  c.beginPath(); c.arc(0, -26, 4, 0, 7); c.fillStyle = P.dark ? '#d9b99b' : '#c99a78'; c.fill();
  c.beginPath(); c.arc(0, -28, 4.6, Math.PI, 0); c.fillStyle = hat; c.fill();
  c.restore();
}
/* ping-pong walker between two x positions */
function walker(t, x0, x1, speed = 20) { const L = Math.abs(x1 - x0); const d = (t * speed) % (2 * L); const fw = d < L; return { x: fw ? x0 + Math.sign(x1 - x0) * d : x1 - Math.sign(x1 - x0) * (d - L), dir: (fw ? 1 : -1) * Math.sign(x1 - x0), walk: t * speed * .35 }; }
function controlRoom(c, x, y, P, t, alarm) {
  rr(c, x, y, 90, GROUND - y, 3, P.panel, P.line);
  rr(c, x + 8, y + 10, 74, 26, 2, P.dark ? '#0d1a22' : '#203040');
  for (let i = 0; i < 4; i++) { c.fillStyle = (alarm && Math.sin(t * 10) > 0) ? '#ff4d4d' : [P.clean, P.elec, P.glow, P.clean][i]; c.fillRect(x + 12 + i * 18, y + 15 + (i % 2) * 6, 12, 8); }
  txt(c, 'ห้องควบคุม', x + 45, GROUND - 6, P.fg2, 10);
}
function sun(c, x, y, k, P) { if (k <= 0) return; c.globalAlpha = clamp(k, 0, 1); const g = c.createRadialGradient(x, y, 4, x, y, 40); g.addColorStop(0, '#fff3b0'); g.addColorStop(.4, '#ffd34d'); g.addColorStop(1, 'rgba(255,210,77,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 40, 0, 7); c.fill(); c.globalAlpha = 1; }
function cloud(c, x, y, s, a) { if (a <= 0) return; c.globalAlpha = a; c.fillStyle = '#e8edf0'; [[0, 0, 18], [18, -8, 20], [38, 0, 16], [20, 6, 18]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill(); }); c.globalAlpha = 1; }
function houses(mw) { return mw * 1000 / 0.3; } // ครัวเรือนไทยใช้ไฟเฉลี่ยราว 0.3 kW (~220 kWh/เดือน)

/* =========================================================
   THERMAL TEMPLATE (ถ่านหิน ก๊าซ นิวเคลียร์ ชีวมวล ขยะ ความร้อนใต้พิภพ)
   heat source -> steam -> turbine -> generator -> grid
   ========================================================= */
function thermal(cfg) {
  return {
    controls: [
      { id: 'load', label: cfg.loadLabel || 'กำลังผลิต (โหลด)', min: cfg.minLoad ?? 20, max: 100, step: 1, val: 80, unit: '%' },
      { id: 'cw', label: 'อุณหภูมิน้ำหล่อเย็น', min: 20, max: 36, step: 1, val: 28, unit: '°C' },
      ...(cfg.extraControls || []),
      { id: 'trip', type: 'toggle', label: 'จำลองหยุดเครื่องฉุกเฉิน (trip)', val: false }
    ],
    init(s) { s.out = s.load / 100; s.ang = 0; },
    step(s, dt) {
      const target = s.trip ? 0 : s.load / 100 * (cfg.limit ? cfg.limit(s) : 1);
      s.out = lerp(s.out, target, clamp(dt * (s.trip ? 1.5 : cfg.ramp || 0.6), 0, 1));
      s.ang += dt * (s.out * 14);
    },
    calc(s) {
      const eff = clamp(cfg.eff - Math.max(0, s.cw - 25) * cfg.eff * 0.004 - (1 - s.out) * cfg.eff * 0.08, 0.05, 0.7);
      const mw = cfg.rated * s.out; const mwth = mw / eff;
      return { mw, mwth, eff, co2: mw * (cfg.co2op || 0) / 1000 };
    },
    metrics(s) {
      const r = this.calc(s);
      const m = [
        ['ไฟฟ้าออกสายส่ง', fmt(r.mw) + ' MW'],
        ['ความร้อนจากเชื้อเพลิง', fmt(r.mwth) + ' MWth'],
        ['ประสิทธิภาพ', fmt(r.eff * 100, 1) + '%'],
        [cfg.fuelLabel, cfg.fuel(r.mwth, s)],
        ['CO2 ขณะเดินเครื่อง', fmt(r.co2, 1) + ' ตัน/ชม.'],
        ['จ่ายไฟได้ราว', fmt(houses(r.mw)) + ' ครัวเรือน']
      ];
      return m;
    },
    spots: [
      ...cfg.spots,
      { x: 420, y: 220, k: 'm', t: 'กังหันไอน้ำ', d: 'ไอน้ำแรงดันสูงขยายตัวผ่านใบกังหันหลายชั้น หมุนที่ 3,000 รอบ/นาที เพื่อให้ไฟฟ้าความถี่ 50 Hz ตามระบบไทย' },
      { x: 525, y: 220, k: 'm', t: 'เครื่องกำเนิดไฟฟ้า', d: 'ขดลวดหมุนในสนามแม่เหล็กเหนี่ยวนำกระแสไฟฟ้า แรงดันราว 20 kV ก่อนเข้าหม้อแปลง' },
      { x: 458, y: 315, k: 'm', t: 'คอนเดนเซอร์', d: s => `ควบแน่นไอน้ำที่ใช้แล้วกลับเป็นน้ำ น้ำหล่อเย็นยิ่งร้อน (${s.cw}°C) สุญญากาศยิ่งแย่ ประสิทธิภาพยิ่งลดลง` },
      { x: 670, y: 330, k: 'm', t: 'หอหล่อเย็น', d: 'ไอสีขาวคือไอน้ำ ไม่ใช่ควัน ระบายความร้อนส่วนที่เหลือจากการแปลงพลังงานซึ่งมีมากกว่าไฟฟ้าที่ได้' },
      { x: 525, y: 392, k: 'p', t: 'ผู้ควบคุมห้องควบคุม', d: s => s.trip ? 'สัญญาณเตือนดัง! ผู้ควบคุมยืนยันการ trip ตรวจว่าระบบความปลอดภัยทำงาน และแจ้งศูนย์ควบคุมระบบไฟฟ้า (กฟผ.) ให้เรียกโรงอื่นมาทดแทน' : 'เฝ้าดูอุณหภูมิ แรงดัน และความถี่บนจอ SCADA ปรับกำลังผลิตตามคำสั่งศูนย์ควบคุมระบบไฟฟ้า' },
      { at: (s, t) => { const w = walker(t, 370, 470, 14); return [w.x, 395]; }, k: 'p', t: 'ช่างซ่อมบำรุง', d: 'เดินตรวจการสั่นสะเทือน เสียง และน้ำมันหล่อลื่นของกังหันทุกกะ ข้อมูลนี้ใช้วางแผนหยุดซ่อมก่อนเครื่องเสีย' }
    ],
    draw(c, s, t, P) {
      const r = this.calc(s); const k = s.out;
      sky(c, P); ground(c, P);
      cfg.drawSource(c, s, t, P, k, r);
      // steam line
      const steam = cfg.steamFrom || [[320, 205]];
      pipe(c, [...steam, [365, 205]], P.metal, 7);
      flow(c, [...steam, [365, 205]], t, k, P.steam, 3);
      // turbine
      c.beginPath(); c.moveTo(365, 195); c.lineTo(475, 182); c.lineTo(475, 258); c.lineTo(365, 245); c.closePath(); c.fillStyle = P.metal2; c.fill(); c.strokeStyle = P.metal; c.lineWidth = 1.5; c.stroke();
      for (let i = 0; i < 6; i++) { const x = 378 + i * 17; const ph = (s.ang * 3 + i) % 1; c.strokeStyle = P.metal; c.beginPath(); c.moveTo(x + ph * 6, 195 - i * 2); c.lineTo(x + ph * 6, 245 + i * 2); c.stroke(); }
      // shaft + generator
      pipe(c, [[475, 220], [490, 220]], P.dk, 5);
      rr(c, 490, 195, 70, 50, 8, P.cond, P.line);
      rotor(c, 525, 220, 18, s.ang, P.panel, 4, 3);
      // to transformer and grid
      pipe(c, [[560, 220], [606, 220], [606, 352]], P.metal, 2);
      flow(c, [[560, 220], [606, 220], [606, 352]], t, k, P.elec, 2.5, 5);
      transformer(c, 590, 356, P, k > .02);
      pipe(c, [[624, 360], [740, 300], [740, GROUND - 130]], P.metal, 1.5);
      pylon(c, 750, P, k, t);
      // condenser + cooling loop
      pipe(c, [[420, 252], [420, 292]], P.metal, 6); flow(c, [[420, 252], [420, 292]], t, k, P.steam, 2.5, 4);
      rr(c, 370, 292, 100, 46, 6, P.metal2, P.metal); txt(c, 'คอนเดนเซอร์', 420, 315, P.fg2, 10);
      const ret = cfg.waterReturn || [[370, 330], [330, 330], [330, 250]];
      pipe(c, ret, P.water2, 4); flow(c, ret, t, k, P.water, 2, 6);
      pipe(c, [[470, 330], [640, 330]], P.water2, 4); flow(c, [[470, 322], [640, 322]], t, k, P.water, 2, 6);
      // cooling tower
      c.beginPath(); c.moveTo(636, GROUND); c.quadraticCurveTo(658, 330, 642, 262); c.lineTo(700, 262); c.quadraticCurveTo(684, 330, 706, GROUND); c.closePath();
      c.fillStyle = P.metal2; c.fill(); c.strokeStyle = P.metal; c.stroke();
      puffs(c, 671, 258, k * (0.6 + (s.cw - 20) / 40), t, P.steam, .8, .9);
      // control room + people
      controlRoom(c, 480, 300, P, t, s.trip);
      person(c, 525, 392, P.cond, P, 0, '#ffffff');
      const w = walker(t, 370, 470, 14); person(c, w.x, 398, P.s4, P, w.walk, '#f2b451', w.dir);
      if (s.trip) { c.fillStyle = Math.sin(t * 10) > 0 ? 'rgba(255,60,60,.12)' : 'rgba(0,0,0,0)'; c.fillRect(0, 0, W, H); txt(c, 'TRIP · หยุดเครื่องฉุกเฉิน', 400, 24, '#ff4d4d', 14); }
    }
  };
}

function stack(c, x, y, w, h, P, amount, t, col) {
  rr(c, x, y, w, h, 2, P.metal2, P.metal);
  c.fillStyle = '#d24'; c.fillRect(x, y + 6, w, 4); c.fillRect(x, y + 18, w, 4);
  puffs(c, x + w / 2, y, amount, t, col || P.smoke, 1, 1);
}
function boiler(c, x, y, w, h, P, k, t, label) {
  rr(c, x, y, w, h, 4, P.metal2, P.metal);
  const fh = (h - 40) * (0.3 + k * 0.7);
  const g = c.createLinearGradient(0, y + h - 10, 0, y + h - 10 - fh); g.addColorStop(0, P.hot); g.addColorStop(.6, P.warm); g.addColorStop(1, 'rgba(242,180,81,0)');
  c.fillStyle = g;
  for (let i = 0; i < 5; i++) { const fx = x + 10 + i * (w - 20) / 4; const ff = fh * (0.75 + 0.25 * Math.sin(t * 9 + i * 2)); c.beginPath(); c.moveTo(fx - 9, y + h - 10); c.quadraticCurveTo(fx, y + h - 10 - ff * 1.2, fx + 9, y + h - 10); c.fill(); }
  for (let i = 0; i < 6; i++) { c.strokeStyle = P.water2; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 4 + i * (w - 8) / 5, y + 30); c.lineTo(x + 4 + i * (w - 8) / 5, y + h - 14); c.stroke(); }
  txt(c, label || 'หม้อไอน้ำ', x + w / 2, y + 16, P.fg2, 10);
}

const SIMS = {};

/* ---------- ถ่านหิน ---------- */
SIMS.coal = thermal({
  rated: 600, eff: 0.38, co2op: 900, fuelLabel: 'ถ่านหินที่ใช้', fuel: m => fmt(m * 3.6 / 24) + ' ตัน/ชม.',
  extraControls: [{ id: 'esp', type: 'toggle', label: 'เปิดเครื่องดักฝุ่น ESP + FGD', val: true }],
  spots: [
    { x: 60, y: 370, k: 'm', t: 'ลานกองถ่าน', d: 'กองถ่านสำรองหลายสัปดาห์ ต้องฉีดน้ำและคลุมเพื่อลดฝุ่นและการลุกไหม้เอง' },
    { x: 140, y: 290, k: 'm', t: 'สายพานและเครื่องบดถ่าน', d: 'ลำเลียงถ่านไปบดเป็นผงละเอียดกว่าแป้ง เพื่อให้เผาไหม้หมดในเวลาไม่กี่วินาที' },
    { x: 255, y: 270, k: 'm', t: 'หม้อไอน้ำ', d: 'เผาผงถ่านที่ ~1,400°C ท่อน้ำรอบผนังเตาเปลี่ยนน้ำเป็นไอน้ำแรงดันสูงกว่า 200 bar ในโรงแบบ supercritical' },
    { x: 165, y: 90, k: 'm', t: 'ปล่องควัน', d: s => s.esp ? 'ไอเสียผ่าน ESP ดักฝุ่น ~99% และ FGD ล้าง SO2 ด้วยหินปูนก่อนออกปล่อง แต่ CO2 ยังออกไปเต็มที่' : 'ปิดระบบดักฝุ่น: PM2.5 และ SO2 ออกปล่องโดยตรง นี่คือสาเหตุที่กฎหมายบังคับให้มีระบบนี้' },
    { at: (s, t) => [walker(t, 30, 110, 10).x, 398], k: 'p', t: 'พนักงานลานถ่าน', d: 'ขับรถตักและตรวจอุณหภูมิกองถ่าน ใส่หน้ากากกันฝุ่นตลอดเวลา' }
  ],
  drawSource(c, s, t, P, k) {
    c.beginPath(); c.moveTo(10, GROUND); c.lineTo(60, 340); c.lineTo(115, GROUND); c.fillStyle = P.dk; c.fill();
    pipe(c, [[80, 370], [190, 250]], P.metal, 5); flow(c, [[80, 366], [190, 246]], t, k, P.dk, 3, 8);
    rr(c, 120, 280, 40, 36, 4, P.metal2, P.metal);
    stack(c, 155, 70, 22, GROUND - 70, P, k * (s.esp ? .55 : 1.1), t, s.esp ? P.smoke : (P.dark ? 'rgba(110,90,70,.75)' : 'rgba(70,55,40,.55)'));
    boiler(c, 200, 120, 120, GROUND - 120, P, k, t);
    rr(c, 180, 330, 18, 60, 2, s.esp ? P.clean : P.muted); txt(c, 'ESP', 189, 322, P.fg2, 9);
    const w = walker(t, 30, 110, 10); person(c, w.x, 398, P.s4, P, w.walk, '#f2b451', w.dir);
  }
});

/* ---------- ก๊าซธรรมชาติ (CCGT) ---------- */
SIMS.gas = thermal({
  rated: 800, eff: 0.58, co2op: 360, ramp: 1.4, fuelLabel: 'ก๊าซที่ใช้', fuel: m => fmt(m * 3600 / 38 / 1000, 1) + ' พัน ลบ.ม./ชม.',
  steamFrom: [[300, 150], [340, 150], [340, 205]],
  extraControls: [{ id: 'mode', type: 'select', label: 'โหมดเดินเครื่อง', val: 'cc', opts: [['cc', 'Combined cycle (GT+ST)'], ['oc', 'Open cycle (GT อย่างเดียว)']] }],
  spots: [
    { x: 30, y: 230, k: 'm', t: 'ท่อก๊าซ', d: 'ก๊าซจากอ่าวไทย ท่อจากเมียนมา หรือ LNG ที่แปรสภาพที่มาบตาพุด ผ่านสถานีลดแรงดันและวัดปริมาณ' },
    { x: 125, y: 225, k: 'm', t: 'กังหันก๊าซ', d: 'อัดอากาศ ผสมก๊าซ จุดระเบิดที่ ~1,400°C ก๊าซร้อนหมุนกังหันโดยตรง ผลิตไฟราว 2 ใน 3 ของทั้งโรง' },
    { x: 255, y: 200, k: 'm', t: 'HRSG', d: s => s.mode === 'cc' ? 'ดึงความร้อนจากไอเสีย ~600°C มาต้มน้ำ ส่งไอไปกังหันไอน้ำ นี่คือเหตุที่ประสิทธิภาพสูงถึง ~60%' : 'โหมด open cycle: ไอเสียร้อนทิ้งออกปล่องเลย ประสิทธิภาพเหลือ ~35% แต่เดินเครื่องเร็ว ใช้ช่วงพีก' }
  ],
  limit: s => 1,
  drawSource(c, s, t, P, k) {
    pipe(c, [[0, 232], [55, 232]], P.s4, 6); flow(c, [[0, 232], [55, 232]], t, k, P.warm, 2, 4);
    rr(c, 8, 250, 44, 40, 8, P.cond, P.line); rotor(c, 30, 270, 14, s.ang, P.panel, 4, 3); pipe(c, [[52, 270], [60, 245]], P.dk, 3);
    c.beginPath(); c.moveTo(60, 205); c.lineTo(110, 215); c.lineTo(110, 245); c.lineTo(60, 255); c.closePath(); c.fillStyle = P.metal2; c.fill(); c.strokeStyle = P.metal; c.stroke();
    rr(c, 110, 210, 30, 40, 4, P.hot); c.globalAlpha = .4 + .4 * Math.sin(t * 12); rr(c, 114, 214, 22, 32, 3, '#ffe08a'); c.globalAlpha = 1;
    c.beginPath(); c.moveTo(140, 215); c.lineTo(190, 205); c.lineTo(190, 255); c.lineTo(140, 245); c.closePath(); c.fillStyle = P.metal2; c.fill(); c.stroke();
    txt(c, 'กังหันก๊าซ', 125, 268, P.fg2, 10);
    const cc = s.mode === 'cc';
    rr(c, 200, 120, 110, 160, 4, cc ? P.metal2 : P.line, P.metal); txt(c, 'HRSG', 255, 136, P.fg2, 10);
    if (cc) for (let i = 0; i < 5; i++) pipe(c, [[212 + i * 21, 150], [212 + i * 21, 270]], P.water2, 2);
    flow(c, [[190, 230], [255, 230], [255, 110]], t, k, 'rgba(255,140,60,.8)', 3, 6);
    stack(c, 240, 50, 26, 72, P, k * (cc ? .35 : .8), t, cc ? P.smoke : 'rgba(255,150,80,.35)');
    pipe(c, [[310, 150], [340, 150]], P.metal, 7);
  }
});
// open-cycle: no steam turbine contribution
(function () {
  const g = SIMS.gas, base = g.calc;
  g.calc = function (s) { const r = base.call(this, s); if (s.mode === 'oc') { r.mw *= 0.62; r.eff = 0.36 * (r.mw > 0 ? 1 : 0) || 0.36; r.mwth = r.mw / 0.36; r.co2 = r.mw * 560 / 1000; } return r; };
  const d = g.draw; g.draw = function (c, s, t, P) { const a = s.ang; if (s.mode === 'oc') s.ang = 0; d.call(this, c, s, t, P); s.ang = a; };
})();

/* ---------- น้ำมัน / ดีเซล ---------- */
SIMS.oil = {
  controls: [
    { id: 'n', label: 'จำนวนเครื่องยนต์ที่เดิน', min: 0, max: 4, step: 1, val: 2, unit: 'เครื่อง' },
    { id: 'load', label: 'โหลดต่อเครื่อง', min: 30, max: 100, step: 1, val: 80, unit: '%' },
    { id: 'pv', label: 'โซลาร์บนเกาะ (ช่วยลดน้ำมัน)', min: 0, max: 8, step: .5, val: 0, unit: 'MW' }
  ],
  init(s) { s.ang = 0; },
  step(s, dt) { s.ang += dt * 10 * (s.load / 100); },
  calc(s) { const demand = 8; const pv = Math.min(s.pv * 0.75, demand * 0.6); const need = Math.max(0, demand - pv); const cap = s.n * 2.5 * s.load / 100; const mw = Math.min(need, cap); return { mw, pv, demand, short: Math.max(0, need - cap), litres: mw * 1000 / 3.9 }; },
  metrics(s) { const r = this.calc(s); return [['ความต้องการไฟบนเกาะ', fmt(r.demand) + ' MW'], ['ไฟจากเครื่องยนต์', fmt(r.mw, 1) + ' MW'], ['ไฟจากโซลาร์', fmt(r.pv, 1) + ' MW'], ['น้ำมันดีเซลที่ใช้', fmt(r.litres) + ' ลิตร/ชม.'], ['ค่าน้ำมันโดยประมาณ', fmt(r.litres * 33) + ' บาท/ชม.'], ['CO2', fmt(r.mw * 0.7, 1) + ' ตัน/ชม.'], ['ไฟขาด', r.short > 0.05 ? fmt(r.short, 1) + ' MW ⚠' : 'ไม่มี']]; },
  spots: [
    { x: 60, y: 330, k: 'm', t: 'ถังน้ำมันดีเซล', d: 'น้ำมันมาทางเรือ ค่าขนส่งทำให้ค่าไฟบนเกาะแพงกว่าบนฝั่งมาก' },
    { x: 260, y: 300, k: 'm', t: 'เครื่องยนต์ดีเซล', d: 'เครื่องยนต์จุดระเบิดด้วยแรงอัดขับเครื่องกำเนิดไฟฟ้า แต่ละเครื่อง 2.5 MW เปิด-ปิดตามความต้องการไฟ' },
    { x: 620, y: 330, k: 'm', t: 'โซลาร์ไมโครกริด', d: 'ทุก MW ของโซลาร์ช่วยลดน้ำมันกลางวัน ลองเพิ่มแถบโซลาร์แล้วดูค่าน้ำมันที่ลดลง' },
    { at: (s, t) => [walker(t, 160, 420, 12).x, 398], k: 'p', t: 'ช่างเครื่อง', d: 'ตรวจอุณหภูมิไอเสียแต่ละสูบ เปลี่ยนน้ำมันเครื่องและไส้กรองตามชั่วโมงทำงาน ต้องใส่ที่ครอบหูเพราะเสียงดังเกิน 100 dB' }
  ],
  draw(c, s, t, P) {
    const r = this.calc(s);
    sky(c, P); c.fillStyle = P.water; c.fillRect(0, GROUND + 10, W, H); ground(c, P); c.fillStyle = P.water; c.beginPath(); c.moveTo(0, GROUND + 25); for (let x = 0; x <= W; x += 20) c.lineTo(x, GROUND + 25 + Math.sin(x / 30 + t * 2) * 3); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    rr(c, 20, 300, 80, 100, 30, P.metal2, P.metal); txt(c, 'ดีเซล', 60, 350, P.fg2, 11);
    rr(c, 140, 230, 340, 170, 4, P.panel, P.line); txt(c, 'โรงเครื่องยนต์', 310, 244, P.fg2, 10);
    pipe(c, [[100, 360], [150, 360]], P.s4, 4);
    for (let i = 0; i < 4; i++) {
      const x = 160 + i * 80, on = i < s.n;
      rr(c, x, 290, 60, 60, 4, on ? P.metal2 : P.line, P.metal);
      for (let p = 0; p < 3; p++) { const dy = on ? Math.sin(s.ang * 2 + p * 2.1) * 6 : 0; rr(c, x + 8 + p * 16, 296 + dy, 12, 14, 2, P.metal); }
      rr(c, x + 10, 352, 40, 30, 6, on ? P.cond : P.line); if (on) rotor(c, x + 30, 367, 10, s.ang, P.panel, 4, 2);
      stack(c, x + 24, 160, 12, 70, P, on ? s.load / 100 * .8 : 0, t + i, 'rgba(70,70,70,.45)');
      if (on) flow(c, [[x + 30, 382], [x + 30, 392], [500, 392]], t + i * .2, s.load / 100, P.elec, 2, 3);
    }
    transformer(c, 500, 356, P, r.mw > 0);
    // PV array
    const n = Math.round(s.pv * 2);
    for (let i = 0; i < 16; i++) { const x = 560 + (i % 4) * 34, y = 300 + Math.floor(i / 4) * 24; c.globalAlpha = i < n ? 1 : .25; c.save(); c.translate(x, y); c.transform(1, 0, -.4, 1, 0, 0); rr(c, 0, 0, 30, 14, 1, P.cond); c.restore(); c.globalAlpha = 1; }
    sun(c, 680, 80, 1, P);
    pylon(c, 760, P, (r.mw + r.pv) / 8, t);
    const w = walker(t, 160, 420, 12); person(c, w.x, 398, P.s4, P, w.walk, '#f2b451', w.dir);
    if (r.short > 0.05) { c.fillStyle = Math.sin(t * 8) > 0 ? '#ff4d4d' : P.fg; txt(c, 'ไฟไม่พอ! ต้องเปิดเครื่องเพิ่มหรือดับไฟบางพื้นที่', 400, 24, '#ff4d4d', 13); }
  }
};

/* ---------- นิวเคลียร์ ---------- */
SIMS.nuc = thermal({
  rated: 1000, eff: 0.33, co2op: 0, ramp: .25, minLoad: 0, loadLabel: 'ถอนแท่งควบคุม (กำลังเตา)', fuelLabel: 'ยูเรเนียม-235 ที่ฟิชชัน', fuel: m => fmt(m * 0.044, 1) + ' กรัม/ชม.',
  steamFrom: [[260, 160], [330, 160], [330, 205]], waterReturn: [[370, 330], [300, 330], [300, 250], [270, 250]],
  spots: [
    { x: 130, y: 300, k: 'm', t: 'เตาปฏิกรณ์ (PWR)', d: s => `แท่งเชื้อเพลิงยูเรเนียมเกิดฟิชชัน แสงสีฟ้าคือรังสี Cherenkov ในน้ำ ตอนนี้ถอนแท่งควบคุม ${s.load}% ถ้า trip แท่งควบคุมจะตกลงทันทีด้วยแรงโน้มถ่วง` },
    { x: 220, y: 230, k: 'm', t: 'เครื่องผลิตไอน้ำ', d: 'น้ำวงจรแรกที่ ~320°C แรงดัน ~155 bar ไม่เดือด ส่งความร้อนให้น้ำวงจรที่สองกลายเป็นไอ น้ำสองวงจรไม่ปนกัน กันสารกัมมันตรังสีออกจากกังหัน' },
    { x: 150, y: 120, k: 'm', t: 'อาคารคลุมเตา', d: 'คอนกรีตเสริมเหล็กหนากว่า 1 เมตร พร้อมผนังเหล็ก เป็นด่านสุดท้ายกันรังสีรั่วออกนอกโรง' },
    { at: (s, t) => [walker(t, 30, 60, 6).x, 398], k: 'p', t: 'เจ้าหน้าที่ฟิสิกส์สุขภาพ', d: 'ตรวจวัดรังสีด้วยเครื่องวัดพกพา คนงานทุกคนติด dosimeter บันทึกปริมาณรังสีที่ได้รับรายวัน' }
  ],
  drawSource(c, s, t, P, k) {
    c.beginPath(); c.moveTo(40, GROUND); c.lineTo(40, 170); c.arc(150, 170, 110, Math.PI, 0); c.lineTo(260, GROUND); c.closePath(); c.fillStyle = P.metal2; c.fill(); c.strokeStyle = P.metal; c.lineWidth = 3; c.stroke();
    rr(c, 95, 240, 70, 130, 30, P.dk);
    const g = c.createRadialGradient(130, 310, 5, 130, 310, 60); g.addColorStop(0, `rgba(120,210,255,${.25 + k * .7})`); g.addColorStop(1, 'rgba(120,210,255,0)'); c.fillStyle = g; c.fillRect(90, 240, 80, 130);
    for (let i = 0; i < 5; i++) rr(c, 104 + i * 11, 280, 6, 70, 2, `rgba(255,${180 + k * 60},120,${.5 + k * .5})`);
    const rod = (1 - (s.trip ? 0 : s.load / 100)) * 60; for (let i = 0; i < 4; i++) rr(c, 109 + i * 11, 220 + rod, 4, 70, 1, P.fg);
    rr(c, 200, 190, 40, 130, 14, P.metal, P.line);
    pipe(c, [[165, 280], [200, 280]], P.hot, 5); pipe(c, [[165, 330], [200, 330]], P.water2, 5);
    flow(c, [[165, 280], [200, 280]], t, k, '#ffb08a', 2, 3); flow(c, [[200, 330], [165, 330]], t, k, P.water, 2, 3);
    pipe(c, [[220, 190], [220, 160], [260, 160]], P.metal, 6); flow(c, [[220, 190], [220, 160], [260, 160]], t, k, P.steam, 2.5, 4);
    txt(c, 'อาคารคลุมเตา', 150, 86, P.fg2, 10);
    const w = walker(t, 30, 60, 6); person(c, w.x, 398, P.clean, P, w.walk, '#ffffff', w.dir);
  }
});
SIMS.nuc.controls[0].val = 90;

/* ---------- ชีวมวล ---------- */
SIMS.bio = thermal({
  rated: 25, eff: 0.27, co2op: 0, fuelLabel: 'ชีวมวลที่ใช้', fuel: (m, s) => fmt(m * 3.6 / ({ bag: 7.5, husk: 13, wood: 10 }[s.fuelType] || 10), 1) + ' ตัน/ชม.',
  extraControls: [{ id: 'fuelType', type: 'select', label: 'ชนิดเชื้อเพลิง', val: 'bag', opts: [['bag', 'ชานอ้อย (ชื้น ~50%)'], ['husk', 'แกลบ'], ['wood', 'เศษไม้ยูคาลิปตัส']] }],
  spots: [
    { x: 70, y: 370, k: 'm', t: 'ลานกองชีวมวล', d: s => ({ bag: 'ชานอ้อยจากโรงงานน้ำตาลข้างเคียง มีมากช่วงหีบอ้อย พ.ย.–เม.ย. ความชื้นสูงจึงให้ความร้อนต่ำ', husk: 'แกลบจากโรงสีข้าว ค่าความร้อนดี ขี้เถ้าแกลบมีซิลิกาสูง ใช้ทำปูนซีเมนต์ได้', wood: 'เศษไม้จากสวนป่า ต้องตรวจย้อนกลับว่าไม่ได้มาจากการตัดป่าธรรมชาติ' })[s.fuelType] },
    { x: 255, y: 280, k: 'm', t: 'เตาตะกรับ', d: 'ชีวมวลเผาบนตะกรับที่สั่นหรือเคลื่อนที่ ขี้เถ้าตกลงด้านล่าง ไอน้ำส่วนหนึ่งส่งไปเป็นความร้อนให้โรงงาน (cogeneration)' },
    { at: (s, t) => [lerp(-40, 120, (t * .08) % 1), 380], k: 'p', t: 'คนขับรถส่งเชื้อเพลิง', d: 'เกษตรกรและผู้รวบรวมขายเศษวัสดุให้โรงไฟฟ้า เป็นรายได้เสริมแทนการเผาทิ้งในไร่ซึ่งก่อฝุ่น PM2.5' }
  ],
  drawSource(c, s, t, P, k) {
    const col = { bag: '#c9b27a', husk: '#d8c48e', wood: '#9a7a52' }[s.fuelType];
    c.beginPath(); c.moveTo(20, GROUND); c.quadraticCurveTo(70, 320, 130, GROUND); c.fillStyle = col; c.fill();
    const tx = lerp(-40, 120, (t * .08) % 1); rr(c, tx - 30, 362, 46, 26, 3, P.clean); rr(c, tx + 16, 368, 18, 20, 3, P.cond); c.fillStyle = P.dk; [tx - 20, tx + 4, tx + 24].forEach(x => { c.beginPath(); c.arc(x, 392, 6, 0, 7); c.fill(); });
    pipe(c, [[110, 370], [200, 300]], P.metal, 5); flow(c, [[110, 366], [200, 296]], t, k, col, 3, 7);
    boiler(c, 200, 170, 120, GROUND - 170, P, k, t, 'เตาตะกรับ');
    stack(c, 160, 110, 18, GROUND - 110, P, k * .45, t);
    person(c, tx + 40, 398, P.s4, P, t * 4, '#f2b451');
  }
});

/* ---------- ขยะเป็นพลังงาน ---------- */
SIMS.wte = thermal({
  rated: 30, eff: 0.22, co2op: 0, fuelLabel: 'ขยะที่เผา', fuel: (m, s) => fmt(m * 3.6 / (12 - s.wet / 10), 1) + ' ตัน/ชม.',
  extraControls: [{ id: 'wet', label: 'ความชื้นของขยะ', min: 20, max: 60, step: 1, val: 45, unit: '%' }, { id: 'plastic', label: 'สัดส่วนพลาสติกในขยะ', min: 5, max: 40, step: 1, val: 20, unit: '%' }],
  limit: s => clamp(1.25 - s.wet / 80, .3, 1),
  spots: [
    { x: 90, y: 330, k: 'm', t: 'บ่อพักขยะและเครนคีบ', d: s => `เครนผสมขยะให้ความชื้นสม่ำเสมอ ความชื้น ${s.wet}% ${s.wet > 50 ? 'สูงมาก เผายาก ต้องพักขยะให้น้ำซึมออกก่อน' : 'พอเผาได้'} บ่อมีแรงดันต่ำกว่าภายนอกเพื่อกันกลิ่นออก` },
    { x: 255, y: 280, k: 'm', t: 'เตาเผาตะกรับเคลื่อนที่', d: 'เผาที่ 850–1,100°C นานอย่างน้อย 2 วินาทีเพื่อทำลายไดออกซิน' },
    { x: 165, y: 120, k: 'm', t: 'ระบบบำบัดก๊าซไอเสีย', d: s => `ถุงกรอง ถ่านกัมมันต์ และสครับเบอร์ CO2 ส่วนที่มาจากพลาสติก ${s.plastic}% นับเป็น CO2 ฟอสซิล` },
    { at: (s, t) => [lerp(-40, 60, (t * .07) % 1) + 40, 398], k: 'p', t: 'พนักงานเก็บขยะ', d: 'รถขยะจากเทศบาลเทลงบ่อ ค่ากำจัดขยะ (tipping fee) คือรายได้หลักของโรง มากกว่ารายได้จากขายไฟ' }
  ],
  drawSource(c, s, t, P, k) {
    rr(c, 20, 300, 140, 100, 3, P.dk); for (let i = 0; i < 18; i++) { c.fillStyle = ['#7c6', '#c84', '#46a', '#bb5', '#888'][i % 5]; c.beginPath(); c.arc(30 + (i * 37) % 120, 360 + (i * 13) % 34, 7, 0, 7); c.fill(); }
    const cx = 40 + (Math.sin(t * .6) * .5 + .5) * 100; pipe(c, [[20, 290], [160, 290]], P.metal, 3); pipe(c, [[cx, 290], [cx, 320 + Math.sin(t * 1.2) * 15]], P.metal, 2); rr(c, cx - 8, 320 + Math.sin(t * 1.2) * 15, 16, 10, 2, P.s4);
    boiler(c, 200, 170, 120, GROUND - 170, P, k, t, 'เตาเผาขยะ');
    rr(c, 150, 150, 40, 140, 3, P.metal2, P.metal); txt(c, 'บำบัด', 170, 220, P.fg2, 9);
    stack(c, 160, 70, 20, 80, P, k * (.2 + s.plastic / 80), t);
    const tx = lerp(-40, 60, (t * .07) % 1); rr(c, tx - 30, 270, 50, 24, 3, P.clean);
    person(c, tx + 40, 398, P.s4, P, t * 4, '#f2b451');
  }
});
(function () { const g = SIMS.wte, b = g.calc; g.calc = function (s) { const r = b.call(this, s); const wasteT = r.mwth * 3.6 / (12 - s.wet / 10); r.co2 = wasteT * (s.plastic / 100) * 2.2; /* ~2.2 tCO2 ต่อพลาสติกผสม 1 ตัน (ประมาณ) */ return r; }; })();

/* ---------- ความร้อนใต้พิภพ ---------- */
SIMS.geo = thermal({
  rated: 50, eff: 0.14, co2op: 40, minLoad: 30, ramp: .3, fuelLabel: 'น้ำร้อนจากบ่อ', fuel: (m, s) => fmt(m * 3.6 / (0.0042 * (s.temp - 70)) / 1000, 0) + ' ตัน/ชม.',
  extraControls: [{ id: 'temp', label: 'อุณหภูมิแหล่งน้ำร้อน', min: 120, max: 300, step: 5, val: 240, unit: '°C' }],
  steamFrom: [[250, 200], [330, 200], [330, 205]],
  limit: s => 1,
  spots: [
    { x: 120, y: 430, k: 'm', t: 'ชั้นหินร้อนใต้ดิน', d: s => `น้ำในชั้นหินถูกแมกมาด้านล่างให้ความร้อนถึง ${s.temp}°C ${s.temp < 180 ? 'ร้อนไม่พอสำหรับแบบ flash ต้องใช้แบบ binary (แบบเดียวกับโรงไฟฟ้าฝาง)' : 'ร้อนพอสำหรับแบบ flash'}` },
    { x: 200, y: 230, k: 'm', t: 'ถังแยกไอ (separator)', d: 'ลดความดันให้น้ำร้อนเดือดเป็นไอ (flash) ไอไปกังหัน น้ำที่เหลือกลับลงบ่ออัดกลับ' },
    { x: 60, y: 300, k: 'm', t: 'บ่ออัดกลับ', d: 'อัดน้ำกลับลงใต้ดินเพื่อรักษาแรงดันแหล่ง ทำให้เป็นพลังงานหมุนเวียน ถ้าไม่อัดกลับ แหล่งจะหมดแรง' },
    { at: (s, t) => [walker(t, 150, 260, 8).x, 398], k: 'p', t: 'นักธรณีวิทยา', d: 'เก็บตัวอย่างน้ำและก๊าซจากบ่อทุกสัปดาห์ ดูแร่ธาตุและ H2S ที่อาจกัดกร่อนท่อ' }
  ],
  drawSource(c, s, t, P, k) {
    const g = c.createLinearGradient(0, GROUND, 0, H); g.addColorStop(0, P.soil); g.addColorStop(1, mix('#b5432a', '#ff7a3a', (s.temp - 120) / 180)); c.fillStyle = g; c.fillRect(0, GROUND, 340, H - GROUND);
    pipe(c, [[150, H], [150, 240], [190, 240]], P.metal, 7); flow(c, [[150, H], [150, 240], [190, 240]], t, k, P.hot, 3, 8);
    rr(c, 180, 200, 60, 70, 20, P.metal2, P.metal); txt(c, 'separator', 210, 186, P.fg2, 9);
    pipe(c, [[240, 200], [250, 200]], P.metal, 6);
    pipe(c, [[210, 270], [210, 300], [60, 300], [60, H]], P.water2, 5); flow(c, [[210, 270], [210, 300], [60, 300], [60, H]], t, k, P.water, 2.5, 8);
    puffs(c, 210, 200, k * .3, t, P.steam, .5, .6);
    txt(c, 'บ่อผลิต', 150, GROUND - 8, P.fg2, 9); txt(c, 'บ่ออัดกลับ', 60, GROUND - 8, P.fg2, 9);
    const w = walker(t, 150, 260, 8); person(c, w.x, 398, P.clean, P, w.walk, '#f2b451', w.dir);
  }
});
(function () { const g = SIMS.geo, b = g.calc; g.calc = function (s) { const r = b.call(this, s); r.eff = clamp(0.05 + (s.temp - 120) / 180 * 0.11, .05, .16) * (r.mw > 0 ? 1 : 1); r.mwth = r.mw / r.eff; return r; }; })();

/* ---------- พลังน้ำ ---------- */
SIMS.hydro = {
  controls: [
    { id: 'lvl', label: 'ระดับน้ำในอ่าง (หัวน้ำ)', min: 30, max: 120, step: 1, val: 90, unit: 'm' },
    { id: 'gate', label: 'เปิดประตูน้ำ', min: 0, max: 100, step: 1, val: 60, unit: '%' },
    { id: 'spill', type: 'toggle', label: 'เปิดทางระบายน้ำล้น (spillway)', val: false }
  ],
  init(s) { s.ang = 0; s.q = 0; },
  step(s, dt) { const tq = s.gate / 100 * 400 * Math.sqrt(s.lvl / 90); s.q = lerp(s.q, tq, clamp(dt * .8, 0, 1)); s.ang += dt * s.q / 25; },
  calc(s) { const mw = 1000 * 9.81 * s.q * s.lvl * 0.9 / 1e6; return { mw }; },
  metrics(s) { const r = this.calc(s); return [['ไฟฟ้าออกสายส่ง', fmt(r.mw) + ' MW'], ['อัตราการไหลผ่านกังหัน', fmt(s.q) + ' ลบ.ม./วินาที'], ['หัวน้ำ', fmt(s.lvl) + ' m'], ['ประสิทธิภาพกังหัน', '90%'], ['สูตร', 'P = ρ·g·Q·H·η'], ['จ่ายไฟได้ราว', fmt(houses(r.mw)) + ' ครัวเรือน']]; },
  spots: [
    { x: 100, y: 300, k: 'm', t: 'อ่างเก็บน้ำ', d: s => `น้ำสูง ${s.lvl} m เหนือกังหัน พลังงานศักย์ยิ่งมาก ช่วงแล้งระดับน้ำลดลง ผลิตไฟได้น้อยลง` },
    { x: 330, y: 300, k: 'm', t: 'ท่อส่งน้ำ (penstock)', d: 'ท่อเหล็กขนาดใหญ่นำน้ำลงสู่กังหัน ความเร็วน้ำสูงมาก การปิดประตูน้ำเร็วเกินไปทำให้เกิดแรงกระแทก (water hammer)' },
    { x: 470, y: 370, k: 'm', t: 'กังหัน Francis + เครื่องกำเนิดไฟฟ้า', d: 'น้ำหมุนกังหันที่ต่อตรงกับเครื่องกำเนิดไฟฟ้า เร่งจาก 0 ถึงเต็มกำลังได้ในไม่กี่นาที จึงใช้รับไฟพีกได้ดี' },
    { x: 660, y: 405, k: 'p', t: 'ชาวประมงท้ายเขื่อน', d: s => s.spill ? 'เปิด spillway: ระดับน้ำท้ายเขื่อนเพิ่มเร็ว เขื่อนต้องแจ้งเตือนชุมชนท้ายน้ำล่วงหน้า' : 'การปล่อยน้ำที่เปลี่ยนเร็วกระทบการทำประมงและตลิ่ง เขื่อนแม่น้ำโขงต้องมีทางปลาผ่าน (fish ladder)' },
    { at: (s, t) => [walker(t, 250, 300, 6).x, 130], k: 'p', t: 'เจ้าหน้าที่ตรวจเขื่อน', d: 'เดินตรวจรอยร้าวและเครื่องวัดแรงดันน้ำในตัวเขื่อน ข้อมูลส่งเข้าระบบเฝ้าระวังความปลอดภัยเขื่อน' }
  ],
  draw(c, s, t, P) {
    const r = this.calc(s); const k = clamp(r.mw / 400, 0, 1);
    sky(c, P); ground(c, P, 420);
    c.beginPath(); c.moveTo(0, 150); c.lineTo(120, 150); c.lineTo(240, 420); c.lineTo(0, 420); c.fillStyle = P.soil; c.fill();
    const wy = 420 - s.lvl * 2.4; c.fillStyle = P.water; c.beginPath(); c.moveTo(0, wy); for (let x = 0; x <= 255; x += 15) c.lineTo(x, wy + Math.sin(x / 20 + t) * 1.5); c.lineTo(255, 420); c.lineTo(0, 420); c.fill();
    c.beginPath(); c.moveTo(250, 130); c.lineTo(290, 130); c.lineTo(340, 420); c.lineTo(250, 420); c.fillStyle = P.metal2; c.fill(); c.strokeStyle = P.metal; c.stroke();
    txt(c, 'เขื่อน', 285, 200, P.fg2, 11);
    pipe(c, [[255, 380], [300, 380], [440, 380]], P.dk, 14); flow(c, [[255, 380], [440, 380]], t, s.gate / 100, P.water, 3, 10);
    rr(c, 430, 320, 100, 100, 4, P.panel, P.line); txt(c, 'โรงไฟฟ้า', 480, 332, P.fg2, 10);
    rotor(c, 470, 380, 18, s.ang, P.cond, 6, 3); rr(c, 495, 350, 28, 40, 6, P.cond); rotor(c, 509, 370, 9, s.ang, P.panel, 4, 2);
    c.fillStyle = P.water; c.beginPath(); c.moveTo(530, 410); c.lineTo(W, 405 - (s.spill ? 10 : 0)); c.lineTo(W, 430); c.lineTo(530, 430); c.fill();
    flow(c, [[530, 415], [W, 412]], t, s.q / 400, P.steam, 2, 8);
    if (s.spill) { flow(c, [[290, 132], [340, 420]], t, 1, P.water, 4, 16); puffs(c, 340, 420, .5, t, P.steam, .6, .3); }
    pipe(c, [[523, 360], [600, 300]], P.metal, 2); flow(c, [[523, 360], [600, 300]], t, k, P.elec, 2.5, 4);
    pylon(c, 620, P, k, t);
    rr(c, 640, 405, 40, 8, 4, '#a67c52'); person(c, 660, 405, P.cond, P, 0, '#2a78d6');
    const w = walker(t, 250, 300, 6); person(c, w.x, 130, P.s4, P, w.walk, '#f2b451', w.dir);
    person(c, 465, 418, P.cond, P, 0, '#ffffff');
  }
};

/* ---------- โซลาร์เซลล์ ---------- */
function solarIrr(h, cloud) { const day = Math.sin(Math.PI * (h - 6) / 12); return day > 0 ? 1000 * Math.pow(day, 1.2) * (1 - cloud * 0.75) : 0; }
function sunPos(h) { const a = Math.PI * (h - 6) / 12; return [lerp(60, 740, (h - 6) / 12), 300 - Math.sin(a) * 250]; }
SIMS.pv = {
  controls: [
    { id: 'h', label: 'เวลาของวัน', min: 5, max: 19, step: .1, val: 11, unit: 'น.' },
    { id: 'cloud', label: 'เมฆปกคลุม', min: 0, max: 100, step: 1, val: 15, unit: '%' },
    { id: 'air', label: 'อุณหภูมิอากาศ', min: 20, max: 40, step: 1, val: 33, unit: '°C' },
    { id: 'dirt', type: 'toggle', label: 'แผงสกปรก (ฝุ่นสะสม 1 เดือน)', val: false },
    { id: 'auto', type: 'toggle', label: 'เดินเวลาอัตโนมัติ', val: true }
  ],
  init(s) {},
  step(s, dt) { if (s.auto) { s.h += dt * .25; if (s.h > 19) s.h = 5; } },
  calc(s) { const irr = solarIrr(s.h, s.cloud / 100); const tc = s.air + irr * 0.03; const mw = 50 * irr / 1000 * (1 - 0.0035 * (tc - 25)) * (s.dirt ? .9 : 1) * 0.86; return { irr, tc, mw: Math.max(0, mw) }; },
  metrics(s) { const r = this.calc(s); return [['เวลา', `${Math.floor(s.h)}:${String(Math.floor((s.h % 1) * 60)).padStart(2, '0')} น.`], ['แสงแดด', fmt(r.irr) + ' W/m²'], ['อุณหภูมิแผง', fmt(r.tc) + ' °C'], ['ไฟฟ้า (ฟาร์ม 50 MWp)', fmt(r.mw, 1) + ' MW'], ['CO2 ขณะผลิต', '0 ตัน/ชม.'], ['จ่ายไฟได้ราว', fmt(houses(r.mw)) + ' ครัวเรือน']]; },
  spots: [
    { x: 200, y: 330, k: 'm', t: 'แผงโซลาร์', d: s => { const r = SIMS.pv.calc(s); return `แผงร้อน ${fmt(r.tc)}°C ทุก 1°C ที่เกิน 25°C กำลังลดราว 0.35% ดูโครงสร้างชั้นวัสดุของเซลล์แต่ละแบบได้ใน Energy Anatomy`; } },
    { x: 560, y: 360, k: 'm', t: 'อินเวอร์เตอร์', d: 'แปลงไฟ DC เป็น AC และใช้ MPPT ไล่หาจุดกำลังสูงสุดตลอดเวลาเมื่อแสงเปลี่ยน' },
    { at: (s, t) => [walker(t, 90, 460, 10).x, 398], k: 'p', t: 'ทีมล้างแผง', d: s => s.dirt ? 'ฝุ่นทำให้ไฟหายไปราว 10% ทีมล้างแผงด้วยน้ำบริสุทธิ์ตอนเช้าหรือเย็นเพื่อไม่ให้แผงร้อนช็อก' : 'ล้างแผงทุก 1–2 เดือน ช่วงหน้าแล้งที่ฝุ่นมากต้องถี่ขึ้น' },
    { x: 360, y: 425, k: 'p', t: 'แกะเล็มหญ้าใต้แผง', d: 'agrivoltaics: ใช้พื้นที่ใต้แผงเลี้ยงสัตว์หรือปลูกพืชที่ชอบร่ม ลดค่าตัดหญ้าและเพิ่มรายได้ให้ชุมชน' }
  ],
  draw(c, s, t, P) {
    const r = this.calc(s); const night = clamp(1 - r.irr / 250, 0, 1) * (s.h < 6.3 || s.h > 17.7 ? 1 : .2);
    sky(c, P, night); const [sx, sy] = sunPos(s.h); sun(c, sx, sy, s.h > 5.6 && s.h < 18.4 ? 1 : 0, P);
    for (let i = 0; i < 4; i++) cloud(c, ((i * 230 + t * 12) % 900) - 60, 70 + i * 22, 1 + i * .2, s.cloud / 100 * .95);
    ground(c, P);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
      const x = 60 + i * 50 + row * 12, y = 300 + row * 34;
      c.save(); c.translate(x, y); c.transform(1, 0, -.35, 1, 0, 0);
      rr(c, 0, 0, 44, 22, 2, s.dirt ? mix('#2a5aa0', '#8a7a5a', .45) : '#2a5aa0', P.metal);
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; for (let g = 1; g < 4; g++) { c.beginPath(); c.moveTo(g * 11, 0); c.lineTo(g * 11, 22); c.stroke(); }
      c.restore(); pipe(c, [[x + 4, y + 22], [x + 4, y + 32]], P.metal, 2);
      if (r.irr > 50 && (i + row) % 3 === 0) flow(c, [[x + 20, y + 10], [sx, sy]].reverse(), t + i, r.irr / 1000, 'rgba(255,220,90,.6)', 1.5, 3);
    }
    pipe(c, [[500, 380], [545, 380]], P.metal, 2); flow(c, [[500, 380], [545, 380]], t, r.mw / 50, P.elec, 2.5, 3);
    rr(c, 545, 345, 36, 50, 3, P.metal2, P.metal); txt(c, 'INV', 563, 370, P.fg2, 9);
    transformer(c, 600, 356, P, r.mw > .5); pipe(c, [[634, 370], [700, 300]], P.metal, 1.5); flow(c, [[581, 370], [600, 370]], t, r.mw / 50, P.elec, 2, 2);
    pylon(c, 720, P, r.mw / 50, t);
    [[340, 425], [380, 432]].forEach(([x, y], i) => { const dx = Math.sin(t * .5 + i) * 6; c.fillStyle = '#f2f2ee'; c.beginPath(); c.ellipse(x + dx, y, 11, 7, 0, 0, 7); c.fill(); c.fillStyle = '#333'; c.beginPath(); c.arc(x + dx + 10, y - 3, 4, 0, 7); c.fill(); });
    const w = walker(t, 90, 460, 10); person(c, w.x, 398, P.clean, P, w.walk, '#f2b451', w.dir);
  }
};

/* ---------- โซลาร์ + แบตเตอรี่ ---------- */
function loadCurve(h) { return 18 + 6 * Math.exp(-Math.pow((h - 13) / 3, 2)) + 14 * Math.exp(-Math.pow((h - 19.5) / 1.8, 2)) - 4 * Math.exp(-Math.pow((h - 4) / 3, 2)); }
SIMS.pvs = {
  controls: [
    { id: 'pvmw', label: 'ขนาดโซลาร์', min: 0, max: 80, step: 1, val: 50, unit: 'MWp' },
    { id: 'bat', label: 'ขนาดแบตเตอรี่', min: 0, max: 200, step: 5, val: 100, unit: 'MWh' },
    { id: 'cloud', label: 'เมฆปกคลุม', min: 0, max: 100, step: 1, val: 20, unit: '%' },
    { id: 'spd', label: 'ความเร็วเวลา', min: .2, max: 4, step: .1, val: 1.2, unit: 'ชม./วินาที' }
  ],
  init(s) { s.h = 6; s.soc = .3; s.hist = []; s.grid = 0; s.self = 0; s.tot = 0; },
  step(s, dt) {
    const dh = dt * s.spd; s.h += dh; if (s.h >= 24) { s.h -= 24; s.hist = []; s.self = 0; s.tot = 0; }
    const pv = s.pvmw * solarIrr(s.h, s.cloud / 100) / 1000 * .85, load = loadCurve(s.h), pw = s.bat / 4;
    let bat = 0; const cap = s.bat; const net = pv - load;
    if (cap > 0) { if (net > 0) bat = Math.min(net, pw, (1 - s.soc) * cap / dh * .95 || 0); else bat = -Math.min(-net, pw, s.soc * cap / dh * .95 || 0); s.soc = clamp(s.soc + bat * dh * (bat > 0 ? .92 : 1 / .92) / cap, 0, 1); }
    const grid = load - pv + bat; s.cur = { pv, load, bat, grid }; s.tot += load * dh; s.self += Math.min(load, load - Math.max(0, grid)) * dh;
    if (!s.hist.length || s.h - s.hist[s.hist.length - 1].h > .1) s.hist.push({ h: s.h, pv, load, bat, grid, soc: s.soc });
  },
  metrics(s) { const r = s.cur || { pv: 0, load: 0, bat: 0, grid: 0 }; return [['เวลา', `${Math.floor(s.h)}:${String(Math.floor((s.h % 1) * 60)).padStart(2, '0')} น.`], ['โซลาร์ผลิต', fmt(r.pv, 1) + ' MW'], ['ความต้องการไฟ', fmt(r.load, 1) + ' MW'], ['แบตเตอรี่', (r.bat > .05 ? 'ชาร์จ ' : r.bat < -.05 ? 'จ่าย ' : '') + fmt(Math.abs(r.bat), 1) + ' MW'], ['ระดับแบต (SOC)', fmt(s.soc * 100) + '%'], ['ซื้อไฟจากกริด', fmt(Math.max(0, r.grid), 1) + ' MW'], ['พึ่งตนเองวันนี้', fmt(s.tot ? s.self / s.tot * 100 : 0) + '%']]; },
  spots: [
    { x: 160, y: 330, k: 'm', t: 'ฟาร์มโซลาร์', d: 'กลางวันผลิตเกินความต้องการ ส่วนเกินจะชาร์จแบตเตอรี่ ถ้าแบตเต็มต้องลดกำลัง (curtail) หรือขายเข้ากริด' },
    { x: 455, y: 360, k: 'm', t: 'ตู้แบตเตอรี่ LFP', d: s => `ความจุ ${s.bat} MWh จ่ายได้สูงสุด ${fmt(s.bat / 4)} MW (4 ชั่วโมง) BMS คุมอุณหภูมิทุกเซลล์ด้วยระบบปรับอากาศในตู้ ดูโครงสร้างเซลล์ใน Energy Anatomy` },
    { x: 560, y: 360, k: 'm', t: 'EMS + อินเวอร์เตอร์สองทิศทาง', d: 'ระบบจัดการพลังงานตัดสินใจทุกวินาทีว่าจะชาร์จ จ่าย หรือซื้อไฟ โดยดูราคาค่าไฟตามช่วงเวลา (TOU)' },
    { at: () => [640, 398], k: 'p', t: 'ผู้จัดการพลังงานโรงพยาบาล', d: 'ดูกราฟด้านล่าง: เป้าหมายคือใช้แบตเตอรี่ตัดพีกหัวค่ำ 18–21 น. ที่ค่าไฟแพงที่สุด และเก็บไว้ส่วนหนึ่งเป็นไฟสำรองฉุกเฉินสำหรับห้องผ่าตัด' }
  ],
  draw(c, s, t, P) {
    const r = s.cur || { pv: 0, load: 1, bat: 0, grid: 0 }; const irr = solarIrr(s.h, s.cloud / 100);
    sky(c, P, clamp(1 - irr / 200, 0, 1) * .9); const [sx, sy] = sunPos(clamp(s.h, 5, 19)); sun(c, sx, sy * .8, s.h > 5.6 && s.h < 18.4 ? 1 : 0, P);
    for (let i = 0; i < 3; i++) cloud(c, ((i * 300 + t * 10) % 900) - 60, 50 + i * 20, 1, s.cloud / 100);
    ground(c, P);
    const n = Math.round(s.pvmw / 80 * 18);
    for (let i = 0; i < 18; i++) { const x = 40 + (i % 6) * 50 + Math.floor(i / 6) * 10, y = 290 + Math.floor(i / 6) * 32; c.globalAlpha = i < n ? 1 : .2; c.save(); c.translate(x, y); c.transform(1, 0, -.35, 1, 0, 0); rr(c, 0, 0, 44, 20, 2, '#2a5aa0', P.metal); c.restore(); c.globalAlpha = 1; }
    pipe(c, [[350, 380], [420, 380]], P.metal, 2); flow(c, [[350, 380], [420, 380]], t, r.pv / 50, P.elec, 2.5, 4);
    rr(c, 420, 330, 70, 66, 3, P.metal2, P.metal); txt(c, 'LFP', 455, 344, P.fg2, 10);
    rr(c, 430, 352, 50, 36, 2, P.line); rr(c, 430, 352 + 36 * (1 - s.soc), 50, 36 * s.soc, 2, s.soc < .2 ? P.fossil : P.clean);
    if (r.bat > .05) flow(c, [[490, 365], [470, 365]].reverse(), t, .6, P.elec, 2, 3); if (r.bat < -.05) flow(c, [[490, 365], [545, 365]], t, .6, P.elec, 2, 3);
    rr(c, 545, 340, 36, 56, 3, P.metal2, P.metal); txt(c, 'EMS', 563, 368, P.fg2, 9);
    // hospital building (load)
    rr(c, 600, 250, 120, 150, 3, P.panel, P.line); c.fillStyle = '#e04848'; c.fillRect(652, 262, 16, 5); c.fillRect(657, 257, 6, 15);
    for (let i = 0; i < 12; i++) { c.fillStyle = (s.h > 18 || s.h < 6) ? P.elec : P.line; c.fillRect(612 + (i % 4) * 26, 285 + Math.floor(i / 4) * 30, 16, 14); }
    txt(c, 'โรงพยาบาล / โรงงาน', 660, 392, P.fg2, 9);
    flow(c, [[581, 368], [600, 368]], t, r.load / 40, P.elec, 2, 2);
    if (r.grid > .1) { pipe(c, [[790, 240], [720, 300]], P.metal, 1.5); flow(c, [[790, 240], [720, 300]], t, r.grid / 30, P.fossil, 2.5, 4); txt(c, 'ไฟจากกริด', 760, 230, P.fossil, 10); }
    person(c, 640, 398, P.cond, P, 0, '#ffffff');
    // chart strip
    const cx = 20, cy = 20, cw = 300, ch = 90; rr(c, cx, cy, cw, ch, 6, P.dark ? 'rgba(17,24,22,.8)' : 'rgba(255,255,255,.85)', P.line);
    const X = h => cx + 8 + h / 24 * (cw - 16), Y = v => cy + ch - 10 - v / 45 * (ch - 22);
    const line = (key, col) => { c.beginPath(); s.hist.forEach((p, i) => { const y = Y(Math.max(0, p[key])); i ? c.lineTo(X(p.h), y) : c.moveTo(X(p.h), y); }); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); };
    line('pv', P.s4); line('load', P.fg); line('grid', P.fossil);
    c.beginPath(); s.hist.forEach((p, i) => { const y = cy + ch - 10 - p.soc * (ch - 22); i ? c.lineTo(X(p.h), y) : c.moveTo(X(p.h), y); }); c.strokeStyle = P.clean; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    txt(c, 'โซลาร์', cx + 30, cy + 10, P.s4, 9); txt(c, 'ความต้องการ', cx + 88, cy + 10, P.fg, 9); txt(c, 'กริด', cx + 140, cy + 10, P.fossil, 9); txt(c, 'SOC แบต', cx + 185, cy + 10, P.clean, 9); txt(c, '0–24 น.', cx + 260, cy + 10, P.muted, 9);
  }
};

/* ---------- โซลาร์ความร้อน CSP ---------- */
SIMS.csp = {
  controls: [
    { id: 'h', label: 'เวลาของวัน', min: 0, max: 24, step: .1, val: 10, unit: 'น.' },
    { id: 'dni', label: 'ความเข้มแดดตรง (DNI)', min: 0, max: 1000, step: 10, val: 850, unit: 'W/m²' },
    { id: 'load', label: 'สั่งจ่ายไฟ', min: 0, max: 100, step: 1, val: 80, unit: 'MW' },
    { id: 'auto', type: 'toggle', label: 'เดินเวลาอัตโนมัติ', val: true }
  ],
  init(s) { s.store = .35; s.ang = 0; s.mw = 0; },
  step(s, dt) {
    const dh = dt * .6; if (s.auto) { s.h += dh; if (s.h >= 24) s.h -= 24; }
    const sunk = Math.max(0, Math.sin(Math.PI * (s.h - 6) / 12)); const collect = sunk * s.dni / 1000 * 260; // MWth to storage
    const wantTh = s.load / 0.4; const can = s.store > 0.01 ? wantTh : 0; s.mw = lerp(s.mw, can * 0.4, clamp(dt, 0, 1));
    s.store = clamp(s.store + (collect - s.mw / 0.4) * (s.auto ? dh : dt * .2) / 1500, 0, 1); s.collect = collect; s.ang += dt * s.mw / 8;
  },
  metrics(s) { return [['เวลา', `${Math.floor(s.h)}:${String(Math.floor((s.h % 1) * 60)).padStart(2, '0')} น.`], ['ความร้อนที่เก็บได้', fmt(s.collect) + ' MWth'], ['เกลือร้อนในถัง', fmt(s.store * 100) + '% (~' + fmt(s.store * 1500 * .4 / Math.max(1, s.load), 1) + ' ชม. ที่โหลดนี้)'], ['ไฟฟ้าออก', fmt(s.mw) + ' MW'], ['CO2 ขณะผลิต', '0 ตัน/ชม.']]; },
  spots: [
    { x: 120, y: 360, k: 'm', t: 'สนามกระจก heliostat', d: 'กระจกแต่ละบานมีมอเตอร์สองแกนหมุนตามดวงอาทิตย์ทุกไม่กี่วินาที สะท้อนแสงไปจุดเดียวบนหอคอย' },
    { x: 330, y: 90, k: 'm', t: 'ตัวรับความร้อนบนยอดหอ', d: 'เกลือหลอมเหลว (โซเดียม/โพแทสเซียมไนเตรต) ไหลผ่าน ร้อนขึ้นจาก ~290°C เป็น ~565°C' },
    { x: 470, y: 340, k: 'm', t: 'ถังเกลือร้อน/เย็น', d: s => `ตอนนี้เก็บได้ ${fmt(s.store * 100)}% ความร้อนที่เก็บไว้ทำให้ผลิตไฟต่อได้หลังพระอาทิตย์ตก ลองดูช่วง 18–24 น.` },
    { at: (s, t) => [walker(t, 40, 240, 9).x, 398], k: 'p', t: 'รถล้างกระจก', d: 'ฝุ่นทะเลทรายลดแสงสะท้อนได้มาก รถล้างวิ่งตอนกลางคืนเพื่อไม่บังแสง ใช้น้ำปริมาณมากในพื้นที่แห้งแล้ง' }
  ],
  draw(c, s, t, P) {
    const sunk = Math.max(0, Math.sin(Math.PI * (s.h - 6) / 12));
    sky(c, P, clamp(1 - sunk * 3, 0, 1) * .9); const [sx, sy] = sunPos(clamp(s.h, 5, 19)); sun(c, sx, sy * .7, s.h > 5.6 && s.h < 18.4 ? 1 : 0, P);
    c.fillStyle = P.dark ? '#3a3226' : '#e3cf9f'; c.fillRect(0, GROUND, W, H - GROUND);
    rr(c, 320, 110, 20, GROUND - 110, 2, P.metal2, P.metal);
    const recv = s.collect / 260; rr(c, 312, 80, 36, 34, 4, mix('#555', '#ffe27a', recv)); if (recv > .1) { c.globalAlpha = recv * .6; const g = c.createRadialGradient(330, 97, 4, 330, 97, 50); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = g; c.beginPath(); c.arc(330, 97, 50, 0, 7); c.fill(); c.globalAlpha = 1; }
    for (let i = 0; i < 18; i++) {
      const x = 30 + (i % 9) * 32 + (i > 8 ? 16 : 0), y = 360 + (i > 8 ? 26 : 0); const a = Math.atan2(97 - y, 330 - x) / 2 + Math.atan2(sy - y, sx - x) / 2;
      c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); rr(c, -11, -2, 22, 4, 1, '#bfe0f0'); c.restore(); pipe(c, [[x, y + 2], [x, y + 12]], P.metal, 2);
      if (recv > .05 && i % 2 === 0) { c.globalAlpha = recv * .35; pipe(c, [[x, y], [330, 97]], '#ffe27a', 1); c.globalAlpha = 1; }
    }
    pipe(c, [[330, 114], [330, 300], [440, 300]], P.hot, 4); flow(c, [[330, 114], [330, 300], [440, 300]], t, recv, '#ffb08a', 2, 6);
    rr(c, 430, 290, 40, 110, 6, P.metal2, P.metal); rr(c, 433, 290 + 110 * (1 - s.store), 34, 110 * s.store, 4, P.hot); txt(c, 'ร้อน', 450, 282, P.fg2, 9);
    rr(c, 480, 290, 40, 110, 6, P.metal2, P.metal); rr(c, 483, 290 + 110 * s.store, 34, 110 * (1 - s.store), 4, P.s4); txt(c, 'เย็น', 500, 282, P.fg2, 9);
    rr(c, 540, 300, 90, 100, 4, P.panel, P.line); txt(c, 'กังหันไอน้ำ', 585, 312, P.fg2, 9); rotor(c, 585, 355, 20, s.ang, P.cond, 5, 3);
    flow(c, [[470, 330], [540, 330]], t, s.mw / 100, P.steam, 2, 4);
    pylon(c, 700, P, s.mw / 100, t); pipe(c, [[630, 340], [690, 290]], P.metal, 1.5);
    const w = walker(t, 40, 240, 9); rr(c, w.x - 14, 384, 28, 14, 3, P.cond); person(c, w.x, 384, P.cond, P, 0, '#f2b451');
  }
};

/* ---------- ลมบนบก ---------- */
function windPower(v, rated) { if (v < 3 || v > 25) return 0; if (v >= 12) return rated; return rated * Math.pow((v - 3) / 9, 3) ; }
SIMS.won = {
  controls: [
    { id: 'v', label: 'ความเร็วลมที่ความสูงดุมใบพัด', min: 0, max: 30, step: .5, val: 8, unit: 'm/s' },
    { id: 'n', label: 'จำนวนกังหันในฟาร์ม', min: 1, max: 40, step: 1, val: 20, unit: 'ต้น' },
    { id: 'tech', type: 'toggle', label: 'ส่งช่างขึ้นซ่อมต้นที่ 2', val: false }
  ],
  init(s) { s.ang = [0, 0, 0]; s.climb = 0; },
  step(s, dt) { const rpm = s.v < 3 || s.v > 25 ? 0 : clamp(4 + s.v * .9, 0, 14); s.rpm = rpm; s.ang = s.ang.map((a, i) => a + dt * rpm / 60 * 2 * Math.PI * (i === 1 && s.tech ? 0 : 1)); s.climb = clamp(s.climb + (s.tech ? dt * .15 : -dt * .3), 0, 1); },
  metrics(s) { const p = windPower(s.v, 5); const farm = p * (s.n - (s.tech ? 1 : 0)); return [['กำลังต่อต้น (5 MW)', fmt(p, 2) + ' MW'], ['ทั้งฟาร์ม', fmt(farm, 1) + ' MW'], ['รอบใบพัด', fmt(s.rpm || 0, 1) + ' รอบ/นาที'], ['สถานะ', s.v < 3 ? 'ลมอ่อนเกิน (ต่ำกว่า cut-in 3 m/s)' : s.v > 25 ? 'ลมแรงเกิน หยุดป้องกัน (cut-out)' : s.v >= 12 ? 'เต็มกำลัง (rated) ปรับ pitch ลดแรง' : 'ผลิตตามลม ∝ v³'], ['จ่ายไฟได้ราว', fmt(houses(farm)) + ' ครัวเรือน']]; },
  spots: [
    { x: 400, y: 120, k: 'm', t: 'ห้องเครื่อง (nacelle)', d: 'มีเกียร์ เครื่องกำเนิดไฟฟ้า และมอเตอร์ yaw หมุนหันรับลม เซนเซอร์บนหลังคาวัดความเร็วและทิศลมตลอดเวลา' },
    { x: 220, y: 160, k: 'm', t: 'ใบพัดและระบบ pitch', d: s => `ใบยาว ~80 m ลม ${s.v} m/s ${s.v >= 12 ? 'แรงกว่า rated แล้ว ระบบ pitch บิดใบให้รับลมน้อยลงเพื่อคงกำลังที่ 5 MW' : 'ลมเพิ่ม 2 เท่า พลังงานเพิ่ม ~8 เท่า เพราะ P ∝ v³'}` },
    { at: (s) => [400, 395 - s.climb * 250], k: 'p', t: 'ช่างกังหันลม', d: s => s.tech ? 'ต้องหยุดกังหันและล็อกโรเตอร์ก่อน ช่างปีนบันไดในเสาสูงกว่า 100 m พร้อมสายรัดนิรภัย ถ้าลมเกิน ~15 m/s ห้ามขึ้น' : 'ประจำอยู่ที่อาคารควบคุม ตรวจข้อมูลจาก SCADA ของทุกต้นจากระยะไกล' },
    { x: 690, y: 392, k: 'p', t: 'ชุมชนและเกษตรกร', d: 'พื้นที่ใต้กังหันยังทำเกษตรได้ เจ้าของที่ดินได้ค่าเช่า แต่ต้องคำนึงเสียงและเงาใบพัดกระพริบใกล้บ้าน' }
  ],
  draw(c, s, t, P) {
    sky(c, P); c.fillStyle = P.ground; c.beginPath(); c.moveTo(0, 400); c.quadraticCurveTo(200, 340, 400, 380); c.quadraticCurveTo(600, 420, W, 360); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    for (let i = 0; i < 14; i++) { const y = 40 + (i * 53) % 280; const x = ((t * s.v * 12 + i * 97) % 900) - 50; c.globalAlpha = clamp(s.v / 15, .1, .6); pipe(c, [[x, y], [x + 30 + s.v * 2, y]], P.fg2, 1); c.globalAlpha = 1; }
    [[200, 1.0, 0], [400, 1.0, 1], [610, .8, 2]].forEach(([x, sc, i]) => {
      const top = 400 - 270 * sc, by = i === 2 ? 392 : 390;
      c.beginPath(); c.moveTo(x - 6 * sc, by); c.lineTo(x - 3 * sc, top); c.lineTo(x + 3 * sc, top); c.lineTo(x + 6 * sc, by); c.fillStyle = P.panel; c.fill(); c.strokeStyle = P.line; c.stroke();
      rr(c, x - 6, top - 8, 26 * sc, 14 * sc, 4, P.panel, P.line);
      const pitch = s.v >= 12 ? 3 : 5; rotor(c, x - 6, top, 110 * sc, s.ang[i], P.dark ? '#e6ece9' : '#ffffff', 3, pitch * sc + 1);
      c.beginPath(); c.arc(x - 6, top, 5, 0, 7); c.fillStyle = P.line; c.fill();
      if (i === 1 && s.tech) txt(c, 'หยุดซ่อม · ล็อกโรเตอร์', x, top - 26, P.fossil, 10);
    });
    if (s.climb > 0) person(c, 404, 395 - s.climb * 250, P.s4, P, t * 6, '#f2b451');
    rr(c, 660, 350, 60, 40, 3, P.panel, P.line); txt(c, 'ควบคุม', 690, 370, P.fg2, 9);
    person(c, 690, 392, P.clean, P, 0, '#2a78d6');
    pylon(c, 760, P, windPower(s.v, 5) / 5, t);
  }
};

/* ---------- ลมนอกชายฝั่ง ---------- */
SIMS.woff = {
  controls: [
    { id: 'v', label: 'ความเร็วลม', min: 0, max: 30, step: .5, val: 11, unit: 'm/s' },
    { id: 'wave', label: 'ความสูงคลื่น', min: .2, max: 5, step: .1, val: 1.2, unit: 'm' },
    { id: 'send', type: 'toggle', label: 'ส่งเรือพาช่างไปกังหัน', val: false }
  ],
  init(s) { s.ang = [0, 0, 0]; s.boat = 0; },
  step(s, dt) { const rpm = s.v < 3 || s.v > 25 ? 0 : clamp(3 + s.v * .6, 0, 10); s.rpm = rpm; s.ang = s.ang.map((a, i) => a + dt * rpm / 60 * 2 * Math.PI * (1 - i * .05)); const ok = s.wave <= 1.75; s.boat = clamp(s.boat + (s.send && ok ? dt * .12 : -dt * .12), 0, 1); },
  metrics(s) { const p = windPower(s.v, 15); return [['กำลังต่อต้น (15 MW)', fmt(p, 1) + ' MW'], ['ฟาร์ม 80 ต้น', fmt(p * 80) + ' MW'], ['คลื่น', fmt(s.wave, 1) + ' m ' + (s.wave > 1.75 ? '· เกินเกณฑ์ส่งช่างทั่วไป (~1.5–2 m)' : '· ส่งช่างได้')], ['เรือ', s.send ? (s.wave > 1.75 ? 'รอคลื่นลด (weather window)' : s.boat >= 1 ? 'เทียบท่ากังหันแล้ว' : 'กำลังแล่น') : 'จอดที่ท่าเรือ'], ['จ่ายไฟได้ราว', fmt(houses(p * 80)) + ' ครัวเรือน']]; },
  spots: [
    { x: 340, y: 110, k: 'm', t: 'กังหัน 15 MW', d: 'ใบพัดยาวกว่า 110 m รอบเดียวผลิตไฟพอให้บ้านใช้ได้ทั้งวัน ลมทะเลแรงและสม่ำเสมอกว่าบนบก' },
    { x: 340, y: 415, k: 'm', t: 'ฐานราก monopile', d: 'เสาเหล็กเส้นผ่านศูนย์กลาง 8–10 m ตอกลึกลงพื้นทะเล 30–40 m ในน้ำลึกกว่า ~60 m ต้องใช้ฐานลอยน้ำแทน' },
    { x: 560, y: 350, k: 'm', t: 'สถานีไฟฟ้ากลางทะเล', d: 'รวมไฟจากทุกกังหันผ่านสายเคเบิลใต้น้ำ ยกแรงดันแล้วส่งขึ้นฝั่ง ไกลมากใช้ HVDC เพื่อลดการสูญเสีย' },
    { at: (s) => [lerp(740, 380, s.boat), 362], k: 'p', t: 'ช่างบนเรือ CTV', d: s => s.wave > 1.75 ? 'คลื่นสูงเกิน ช่างข้ามจากเรือไปบันไดกังหันไม่ปลอดภัย ต้องรอ weather window ซึ่งเป็นต้นทุนแฝงสำคัญของลมนอกชายฝั่ง' : 'เรือดันหัวชนกันชนของกังหัน ช่างก้าวข้ามไปบันไดในจังหวะคลื่น สวมชูชีพและสายรัด' }
  ],
  draw(c, s, t, P) {
    sky(c, P);
    const sea = 370; c.fillStyle = P.water2; c.fillRect(0, sea, W, H - sea);
    c.fillStyle = P.water; c.beginPath(); c.moveTo(0, sea); for (let x = 0; x <= W; x += 10) c.lineTo(x, sea + Math.sin(x / 25 + t * 2) * s.wave * 3); c.lineTo(W, sea + 20); c.lineTo(0, sea + 20); c.fill();
    c.fillStyle = P.soil; c.fillRect(0, 430, W, 20);
    for (let i = 0; i < 10; i++) { const y = 40 + (i * 41) % 200; const x = ((t * s.v * 12 + i * 113) % 900) - 50; c.globalAlpha = clamp(s.v / 15, .1, .5); pipe(c, [[x, y], [x + 30 + s.v * 2, y]], P.fg2, 1); c.globalAlpha = 1; }
    [[140, .55, 2], [340, 1, 0], [520, .7, 1]].forEach(([x, sc, i]) => {
      const top = sea - 270 * sc; pipe(c, [[x, 430], [x, sea + 10]], P.s4, 10 * sc); pipe(c, [[x, sea + 10], [x, top]], P.panel, 6 * sc);
      rr(c, x - 6, top - 8, 30 * sc, 14 * sc, 4, P.panel, P.line); rotor(c, x - 6, top, 130 * sc, s.ang[i], P.dark ? '#e6ece9' : '#ffffff', 3, 5 * sc + 1);
    });
    pipe(c, [[340, 430], [560, 430], [800, 430]], P.dk, 3); flow(c, [[340, 430], [800, 430]], t, windPower(s.v, 15) / 15, P.elec, 2, 8);
    pipe(c, [[560, 430], [560, 330]], P.s4, 8); rr(c, 530, 300, 60, 34, 3, P.metal2, P.metal); txt(c, 'สถานีไฟฟ้า', 560, 317, P.fg2, 9);
    const bx = lerp(740, 380, s.boat), by = sea - 4 + Math.sin(t * 2 + bx / 25) * s.wave * 3; rr(c, bx - 26, by - 10, 52, 14, 4, '#f2b451'); rr(c, bx - 10, by - 22, 22, 12, 2, P.panel, P.line);
    person(c, bx + 4, by - 10, P.fossil, P, 0, '#f2b451');
  }
};

/* ---------- ความร้อนใต้พิภพ / คลื่น-น้ำขึ้นลง ---------- */
SIMS.tide = {
  controls: [
    { id: 'range', label: 'ช่วงน้ำขึ้น-ลง', min: .5, max: 10, step: .1, val: 5, unit: 'm' },
    { id: 'spd', label: 'ความเร็วเวลา', min: .2, max: 4, step: .1, val: 1.5, unit: 'ชม./วินาที' },
    { id: 'n', label: 'จำนวนกังหันใต้น้ำ', min: 1, max: 60, step: 1, val: 20, unit: 'ต้น' }
  ],
  init(s) { s.h = 0; s.ang = 0; },
  step(s, dt) { s.h = (s.h + dt * s.spd) % 24.84; const ph = 2 * Math.PI * s.h / 12.42; s.lvl = Math.sin(ph) * s.range / 2; s.cur = Math.cos(ph) * s.range * 0.32; s.ang += dt * s.cur * 1.2; },
  metrics(s) { const v = Math.abs(s.cur || 0); const p = Math.min(1.5, 0.5 * 1025 * Math.PI * 9 * 9 * Math.pow(v, 3) * 0.4 / 1e6); return [['เวลาในรอบน้ำ', fmt(s.h, 1) + ' ชม. (รอบละ ~12.4 ชม.)'], ['ระดับน้ำ', (s.lvl >= 0 ? '+' : '') + fmt(s.lvl || 0, 2) + ' m'], ['กระแสน้ำ', fmt(v, 2) + ' m/s ' + ((s.cur || 0) > 0 ? '(น้ำขึ้น)' : '(น้ำลง)')], ['กำลังต่อต้น (ใบ 18 m)', fmt(p, 2) + ' MW'], ['ทั้งแถว', fmt(p * s.n, 1) + ' MW']]; },
  spots: [
    { x: 300, y: 340, k: 'm', t: 'กังหันใต้น้ำ', d: 'น้ำหนาแน่นกว่าอากาศ ~800 เท่า กระแสน้ำ 2–3 m/s ก็ให้พลังงานมาก ช่วงน้ำนิ่ง (slack tide) จะผลิตไม่ได้เลย แต่รู้ล่วงหน้าได้เป็นปี' },
    { x: 560, y: 80, k: 'm', t: 'ดวงจันทร์', d: 'แรงโน้มถ่วงของดวงจันทร์ (และดวงอาทิตย์) ดึงน้ำทะเลให้ขึ้นลงวันละราว 2 รอบ ช่วงจันทร์เต็มดวงและจันทร์ดับน้ำขึ้นลงมากที่สุด (spring tide)' },
    { x: 600, y: 310, k: 'p', t: 'นักประดาน้ำ/ทีมตรวจ', d: 'ตรวจใบพัดและสิ่งมีชีวิตที่เกาะ (biofouling) ทำได้เฉพาะช่วงน้ำนิ่งไม่กี่สิบนาที ต้นทุนบำรุงรักษาใต้ทะเลจึงสูง' },
    { x: 150, y: 360, k: 'm', t: 'ปลาและระบบนิเวศ', d: 'กังหันหมุนช้า ความเสี่ยงต่อปลาต่ำ แต่ต้องศึกษาผลต่อสัตว์ทะเลขนาดใหญ่และตะกอน' }
  ],
  draw(c, s, t, P) {
    const surf = 140 - (s.lvl || 0) * 8;
    sky(c, P); c.fillStyle = P.dark ? '#e8e2c8' : '#fdfbe8'; c.beginPath(); c.arc(560, 80, 18, 0, 7); c.fill();
    const g = c.createLinearGradient(0, surf, 0, H); g.addColorStop(0, P.water); g.addColorStop(1, P.water2); c.fillStyle = g;
    c.beginPath(); c.moveTo(0, surf); for (let x = 0; x <= W; x += 10) c.lineTo(x, surf + Math.sin(x / 30 + t * 2) * 2); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = P.soil; c.fillRect(0, 420, W, 30);
    for (let i = 0; i < 18; i++) { const y = surf + 30 + (i * 37) % (400 - surf - 40); const x = ((t * (s.cur || 0) * 40 + i * 97) % 900 + 900) % 900 - 50; c.globalAlpha = .35; pipe(c, [[x, y], [x + 20, y]], '#ffffff', 1); c.globalAlpha = 1; }
    [[300, 1], [480, .7]].forEach(([x, sc]) => { pipe(c, [[x, 420], [x, 340]], P.metal, 8 * sc); rr(c, x - 20 * sc, 330 - 8 * sc, 40 * sc, 16 * sc, 6, P.metal2, P.metal); rotor(c, x - 20 * sc, 330, 46 * sc, s.ang || 0, P.s4, 3, 4); });
    for (let i = 0; i < 3; i++) { const fx = ((t * 20 + i * 200) % 900) - 50, fy = 300 + i * 30; c.fillStyle = P.s4; c.beginPath(); c.ellipse(fx, fy, 8, 4, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(fx - 8, fy); c.lineTo(fx - 14, fy - 4); c.lineTo(fx - 14, fy + 4); c.fill(); }
    person(c, 600, 310 + Math.sin(t) * 4, P.dk, P, t * 2, '#f2b451');
    pipe(c, [[300, 420], [800, 420]], P.dk, 3); flow(c, [[300, 420], [800, 420]], t, Math.abs(s.cur || 0) / 2, P.elec, 2, 6);
    const bx = 680, by = surf - 2; rr(c, bx - 30, by - 10, 60, 12, 4, '#f2b451');
    txt(c, (s.cur || 0) > 0 ? 'น้ำกำลังขึ้น →' : '← น้ำกำลังลง', 400, surf + 20, '#ffffff', 11);
  }
};

/* ---------- ไฮโดรเจน: Green vs Blue ---------- */
SIMS.h2 = {
  controls: [
    { id: 'route', type: 'select', label: 'เส้นทางผลิต', val: 'green', opts: [['green', 'สีเขียว: แยกน้ำด้วยไฟฟ้าสะอาด'], ['blue', 'สีฟ้า: ก๊าซ + ดักจับ CO2'], ['grey', 'สีเทา: ก๊าซ ไม่ดักจับ']] },
    { id: 'rate', label: 'อัตราผลิตไฮโดรเจน', min: 0, max: 2000, step: 50, val: 1000, unit: 'kg/ชม.' },
    { id: 'capture', label: 'อัตราดักจับ CO2 (สีฟ้า)', min: 50, max: 95, step: 1, val: 85, unit: '%' },
    { id: 'leak', label: 'มีเทนรั่วในห่วงโซ่ก๊าซ', min: 0, max: 4, step: .1, val: 1.5, unit: '%' },
    { id: 'gwp', type: 'select', label: 'มองผลกระทบช่วง', val: '100', opts: [['100', '100 ปี (GWP100 = 30)'], ['20', '20 ปี (GWP20 = 83)']] },
    { id: 'fc', label: 'เซลล์เชื้อเพลิงจ่ายไฟ', min: 0, max: 100, step: 1, val: 60, unit: '%' }
  ],
  init(s) { s.tank = .4; s.bub = 0; },
  calc(s) {
    const gwp = s.gwp === '20' ? 83 : 30, ch4 = 3.3; // kg CH4 per kg H2 (feed + fuel) ประมาณ
    let co2 = 0, power = 0;
    if (s.route === 'green') { power = s.rate * 53 / 1000; co2 = 0.6; }
    else { const direct = 9.5; co2 = direct * (s.route === 'blue' ? (1 - s.capture / 100) : 1) + ch4 * s.leak / 100 * gwp + (s.route === 'blue' ? 0.8 : 0); }
    const fcOut = s.fc / 100 * 2000 * 33.3 * 0.55 / 1000; // MW
    return { co2, power, fcOut, use: s.fc / 100 * 2000 };
  },
  step(s, dt) { const r = this.calc(s); s.tank = clamp(s.tank + (s.rate - r.use) * dt / 20000, 0, 1); if (s.tank <= 0) s.fcAvail = 0; else s.fcAvail = 1; s.bub += dt; },
  metrics(s) { const r = this.calc(s); return [['ไฮโดรเจนผลิต', fmt(s.rate) + ' kg/ชม.'], [s.route === 'green' ? 'ไฟฟ้าที่ใช้แยกน้ำ' : 'ก๊าซธรรมชาติที่ใช้', s.route === 'green' ? fmt(r.power, 1) + ' MW' : fmt(s.rate * 3.3 / 1000, 1) + ' ตัน CH4/ชม.'], ['CO2e ต่อ kg H2', fmt(r.co2, 1) + ' kg'], ['เทียบเผาก๊าซให้ความร้อนเท่ากัน', fmt(r.co2 / ((2.75 * 3) + 3 * s.leak / 100 * (s.gwp === '20' ? 83 : 30)) * 100) + '%'], ['ไฟออกจากเซลล์เชื้อเพลิง', fmt(s.fcAvail ? r.fcOut : 0, 1) + ' MW'], ['ไฟ→H2→ไฟ', s.route === 'green' ? '~30–40%' : '–'], ['ถังเก็บ', fmt(s.tank * 100) + '%']]; },
  spots: [
    { x: 110, y: 290, k: 'm', t: 'ต้นทาง', d: s => s.route === 'green' ? 'โซลาร์และลมจ่ายไฟให้เครื่องแยกน้ำ ถ้าใช้ไฟจากกริดที่มีก๊าซและถ่านหินมาก ไฮโดรเจนจะไม่เขียวจริง' : 'หลุมก๊าซธรรมชาติและท่อส่ง มีเทนที่รั่วระหว่างทางทำให้โลกร้อนแรงกว่า CO2 หลายสิบเท่า ลองเลื่อนแถบมีเทนรั่วและเปลี่ยนเป็นมุมมอง 20 ปี' },
    { x: 290, y: 300, k: 'm', t: s => s.route === 'green' ? 'เครื่องแยกน้ำ (electrolyzer)' : 'เครื่องปฏิรูปไอน้ำ (SMR)', d: s => s.route === 'green' ? 'ไฟฟ้าแยก H2O เป็น H2 ที่ขั้วลบ และ O2 ที่ขั้วบวก ใช้ไฟราว 50–55 kWh ต่อ H2 1 kg' : 'CH4 + H2O → CO + 3H2 แล้ว CO + H2O → CO2 + H2 ได้ CO2 ราว 9–10 kg ต่อ H2 1 kg' },
    { x: 290, y: 425, k: 'm', t: 'CCS ใต้ดิน', d: s => s.route === 'blue' ? `ดักจับ CO2 ${s.capture}% อัดลงชั้นหินลึก แต่ CO2 จากการเผาให้ความร้อนในเตามักดักได้ยากกว่า โรงจริงหลายแห่งดักได้ต่ำกว่าเป้า` : 'สีเทาไม่ดักจับ CO2 ออกสู่บรรยากาศทั้งหมด (ไฮโดรเจนส่วนใหญ่ของโลกวันนี้)' },
    { x: 470, y: 300, k: 'm', t: 'ถังเก็บไฮโดรเจน', d: 'อัดที่ 350–700 bar หรือเปลี่ยนเป็นแอมโมเนียเพื่อขนส่ง H2 โมเลกุลเล็กมาก รั่วง่ายและทำให้เหล็กเปราะ' },
    { x: 620, y: 300, k: 'm', t: 'เซลล์เชื้อเพลิง PEM', d: 'H2 + ½O2 → H2O + ไฟฟ้า + ความร้อน ประสิทธิภาพ ~50–60% ผลพลอยได้มีแค่น้ำ' },
    { at: () => [540, 398], k: 'p', t: 'เจ้าหน้าที่ความปลอดภัย', d: 'เครื่องตรวจจับ H2 ติดทั่วพื้นที่ เปลวไฟไฮโดรเจนแทบมองไม่เห็นตอนกลางวัน จึงใช้กล้องอินฟราเรดตรวจ' }
  ],
  draw(c, s, t, P) {
    const r = this.calc(s); const k = s.rate / 2000;
    sky(c, P); ground(c, P);
    if (s.route === 'green') {
      sun(c, 80, 70, 1, P);
      for (let i = 0; i < 6; i++) { c.save(); c.translate(30 + (i % 3) * 44, 300 + Math.floor(i / 3) * 30); c.transform(1, 0, -.35, 1, 0, 0); rr(c, 0, 0, 40, 20, 2, '#2a5aa0', P.metal); c.restore(); }
      pipe(c, [[150, GROUND], [152, 170], [156, 170], [160, GROUND]], P.panel, 4); rotor(c, 154, 170, 50, t * 1.5, P.dark ? '#e6ece9' : '#fff', 3, 3);
      pipe(c, [[180, 340], [250, 340]], P.metal, 2); flow(c, [[180, 340], [250, 340]], t, k, P.elec, 2.5, 4);
    } else {
      rr(c, 40, 320, 30, 80, 2, P.metal2, P.metal); pipe(c, [[55, 320], [55, 290], [90, 290]], P.metal, 3); txt(c, 'หลุมก๊าซ', 55, 308, P.fg2, 9);
      pipe(c, [[70, 360], [250, 360]], P.s4, 6); flow(c, [[70, 360], [250, 360]], t, k, P.warm, 2, 6);
      if (s.leak > 0) for (let i = 0; i < Math.round(s.leak * 3); i++) { const x = 90 + (i * 47) % 150, kk = (t * .5 + i * .3) % 1; c.globalAlpha = (1 - kk) * .8; c.fillStyle = '#c47bd8'; c.beginPath(); c.arc(x, 352 - kk * 90, 3 + kk * 4, 0, 7); c.fill(); c.globalAlpha = 1; }
      txt(c, 'CH4 รั่ว', 150, 250, '#c47bd8', 10);
    }
    rr(c, 250, 270, 90, 120, 6, P.metal2, P.metal); txt(c, s.route === 'green' ? 'Electrolyzer' : 'SMR', 295, 284, P.fg2, 10);
    if (s.route === 'green') { for (let i = 0; i < Math.round(4 + k * 12); i++) { const kk = (s.bub * .8 + i / 12) % 1; c.fillStyle = i % 3 ? P.h2 : '#ff8a8a'; c.beginPath(); c.arc(265 + (i * 23) % 60, 380 - kk * 85, 2.5, 0, 7); c.fill(); } }
    else { rr(c, 262, 300, 66, 80, 4, P.hot); c.globalAlpha = .5 + .3 * Math.sin(t * 8); rr(c, 268, 306, 54, 68, 4, '#ffd08a'); c.globalAlpha = 1;
      const vent = s.route === 'blue' ? 1 - s.capture / 100 : 1; stack(c, 320, 180, 14, 90, P, vent * k * 1.2, t, P.smoke);
      if (s.route === 'blue') { pipe(c, [[295, 390], [295, H]], P.dk, 5); flow(c, [[295, 392], [295, H]], t, k * s.capture / 100, P.muted, 2.5, 4); c.fillStyle = P.soil; c.fillRect(200, 420, 200, 30); txt(c, 'CO2 → ชั้นหินลึก', 340, 437, P.fg, 10); }
    }
    pipe(c, [[340, 320], [440, 320]], P.h2, 4); flow(c, [[340, 320], [440, 320]], t, k, P.h2, 2.5, 6);
    rr(c, 440, 260, 60, 130, 26, P.metal2, P.metal); rr(c, 446, 266 + 118 * (1 - s.tank), 48, 118 * s.tank, 22, P.h2); txt(c, 'H2', 470, 250, P.fg2, 11);
    pipe(c, [[500, 320], [590, 320]], P.h2, 4); flow(c, [[500, 320], [590, 320]], t, s.fcAvail ? s.fc / 100 : 0, P.h2, 2.5, 5);
    rr(c, 590, 270, 70, 100, 4, P.panel, P.line); txt(c, 'Fuel cell', 625, 284, P.fg2, 10);
    for (let i = 0; i < 6; i++) rr(c, 598 + i * 10, 296, 6, 60, 1, i % 2 ? P.cond : P.clean);
    flow(c, [[625, 370], [625, 392], [580, 392]], t, s.fc / 100, P.water, 2, 3); txt(c, 'น้ำ', 575, 382, P.water, 9);
    pipe(c, [[660, 320], [740, 280]], P.metal, 1.5); flow(c, [[660, 320], [740, 280]], t, s.fcAvail ? s.fc / 100 : 0, P.elec, 2.5, 4);
    pylon(c, 750, P, s.fcAvail ? s.fc / 100 : 0, t);
    person(c, 540, 398, P.fossil, P, 0, '#ffffff');
    const col = { green: P.clean, blue: P.cond, grey: P.muted }[s.route];
    rr(c, 20, 20, 250, 54, 8, P.dark ? 'rgba(17,24,22,.8)' : 'rgba(255,255,255,.88)', P.line);
    txt(c, 'CO2e ต่อ H2 1 kg', 32, 36, P.fg2, 10, 'left'); txt(c, fmt(r.co2, 1) + ' kg', 32, 58, col, 18, 'left');
    const bw = 120 * clamp(r.co2 / 16, 0, 1); rr(c, 140, 50, 120, 10, 4, P.line); rr(c, 140, 50, Math.max(2, bw), 10, 4, col);
  }
};

/* =========================================================
   ENGINE
   ========================================================= */
function mount(root, id) {
  const sim = SIMS[id]; if (!sim) { root.innerHTML = '<div class="empty">ยังไม่มีแบบจำลองสำหรับแหล่งนี้</div>'; return () => {}; }
  root.innerHTML = `<div class="sim">
    <div class="simstage"><canvas aria-label="แบบจำลองแบบโต้ตอบ แตะจุดวงกลมเพื่อดูคำอธิบาย"></canvas>
      <div class="simbar"><button class="play" aria-pressed="true">⏸ หยุด</button><span class="hint">แตะวงกลม <b>เครื่องจักร</b> หรือ <b>คน</b> เพื่อดูว่ากำลังทำอะไร</span></div></div>
    <div class="simside"><div class="ctrls"></div><dl class="metrics"></dl><div class="spot" aria-live="polite"><b>เลือกจุดในภาพ</b><p>วงกลมสีเขียวคือเครื่องจักร วงกลมสีส้มคือคนที่ทำงานในสถานที่</p></div></div>
  </div>`;
  const cv = root.querySelector('canvas'), c = cv.getContext('2d');
  const ctrl = root.querySelector('.ctrls'), met = root.querySelector('.metrics'), spotBox = root.querySelector('.spot');
  const s = {}; sim.controls.forEach(o => s[o.id] = o.val); sim.init && sim.init(s);
  ctrl.innerHTML = sim.controls.map(o => {
    if (o.type === 'toggle') return `<label class="tg"><input type="checkbox" data-id="${o.id}" ${o.val ? 'checked' : ''}> ${o.label}</label>`;
    if (o.type === 'select') return `<label class="sl"><span>${o.label}</span><select data-id="${o.id}">${o.opts.map(([v, l]) => `<option value="${v}" ${v === o.val ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    return `<label class="rg"><span>${o.label} <output data-o="${o.id}">${o.val}</output> ${o.unit || ''}</span><input type="range" data-id="${o.id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.val}"></label>`;
  }).join('');
  ctrl.querySelectorAll('[data-id]').forEach(el => el.addEventListener('input', () => {
    const id = el.dataset.id; s[id] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    const o = ctrl.querySelector(`[data-o="${id}"]`); if (o) o.textContent = el.value; if (sel) showSpot(sel);
  }));
  const syncRanges = () => sim.controls.forEach(o => { if (o.type) return; const el = ctrl.querySelector(`input[data-id="${o.id}"]`); if (el && document.activeElement !== el && +el.value !== s[o.id]) { el.value = s[o.id]; ctrl.querySelector(`[data-o="${o.id}"]`).textContent = (+s[o.id]).toFixed(o.step < 1 ? 1 : 0); } });
  let P = palette(), playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, t = 0, last = performance.now(), sel = null, raf, mt = 0;
  const playBtn = root.querySelector('.play');
  const setPlay = v => { playing = v; playBtn.textContent = v ? '⏸ หยุด' : '▶ เล่น'; playBtn.setAttribute('aria-pressed', v); };
  setPlay(playing); playBtn.onclick = () => setPlay(!playing);
  const val = (f) => typeof f === 'function' ? f(s, t) : f;
  const posOf = sp => sp.at ? sp.at(s, t) : [sp.x, sp.y];
  function showSpot(sp) { sel = sp; spotBox.innerHTML = `<span class="kind ${sp.k}">${sp.k === 'p' ? 'คนในสถานที่' : 'เครื่องจักร / ส่วนประกอบ'}</span><b>${val(sp.t)}</b><p>${val(sp.d)}</p>`; }
  function resize() { const w = cv.clientWidth; cv.width = Math.round(w * devicePixelRatio); cv.height = Math.round(w * H / W * devicePixelRatio); }
  new ResizeObserver(resize).observe(cv); resize();
  cv.addEventListener('click', e => {
    const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * W, y = (e.clientY - b.top) / b.height * H;
    let best = null, bd = 30; sim.spots.forEach(sp => { const [sx, sy0] = posOf(sp); const sy = sy0 - (sp.k === 'p' ? 46 : 0); const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = sp; } });
    if (best) showSpot(best);
  });
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, .05); last = now;
    if (playing) { t += dt; sim.step && sim.step(s, dt); }
    const sc = cv.width / W; c.setTransform(sc, 0, 0, sc, 0, 0); c.clearRect(0, 0, W, H);
    sim.draw(c, s, t, P);
    sim.spots.forEach((sp, i) => { const [x, y] = posOf(sp); const on = sp === sel; const col = sp.k === 'p' ? P.s4 : P.clean;
      c.beginPath(); c.arc(x, y - (sp.k === 'p' ? 46 : 0), on ? 10 : 8 + Math.sin(t * 3 + i) * 1.2, 0, 7); c.fillStyle = col; c.globalAlpha = on ? 1 : .85; c.fill(); c.globalAlpha = 1;
      c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); txt(c, String(i + 1), x, y - (sp.k === 'p' ? 46 : 0) + .5, '#fff', 10); });
    if (now - mt > 200) { mt = now; met.innerHTML = sim.metrics(s).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join(''); syncRanges(); if (sel && sel.at) showSpot(sel); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  const onTheme = () => { P = palette(); };
  const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', onTheme);
  const mo = new MutationObserver(onTheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => { cancelAnimationFrame(raf); mq.removeEventListener('change', onTheme); mo.disconnect(); };
}

window.LabSim = { mount, has: id => !!SIMS[id] };
})();

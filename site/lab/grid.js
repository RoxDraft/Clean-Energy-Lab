/* Clean Energy Lab · Grid Lab
   ส่งไฟจากโรงไฟฟ้าถึงปลั๊กและหัวชาร์จ: แปลงแรงดัน การสูญเสียของสายแต่ละแบบ ความถี่ 50 Hz และมิเตอร์ไฟฟ้า
   แบบจำลองอย่างง่ายเพื่อการเรียนรู้ ตัวเลขเป็นค่าประมาณ */
(function () {
'use strict';
const { W, H, clamp, lerp, rr, txt, pipe, polyLen, polyAt, person } = LabSim.H;
const EN = () => document.documentElement.lang === 'en';
const tx = o => o && typeof o === 'object' ? (EN() ? o.en : o.th) : (o == null ? '' : String(o));
const P2 = (th, en) => ({ th, en });
const fmt = (v, d = 0) => (isFinite(v) ? v : 0).toLocaleString(EN() ? 'en-US' : 'th-TH', { maximumFractionDigits: d, minimumFractionDigits: d });
const gau = x => Math.exp(-x * x);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ===================== 1) power path ===================== */
const MED = {
  ac_oh: { t: P2('สายเหนือดิน AC', 'Overhead AC line'), R: .02, cor: 1, dc: 0 },
  ac_ug: { t: P2('สายใต้ดิน AC (XLPE)', 'Underground AC cable (XLPE)'), R: .015, C: .25, dc: 0 },
  ac_sea: { t: P2('สายใต้ทะเล AC', 'Subsea AC cable'), R: .015, C: .3, dc: 0 },
  dc_oh: { t: P2('HVDC เหนือดิน', 'Overhead HVDC'), R: .006, dc: 1 },
  dc_sea: { t: P2('HVDC ใต้ทะเล', 'Subsea HVDC'), R: .01, dc: 1 },
  space: { t: P2('ไร้สายจากอวกาศ (ทดลอง)', 'Wireless from space (experimental)'), dc: 0, beam: 1 }
};
const CHG = {
  home: { t: P2('AC ที่บ้าน 7 kW', 'Home AC 7 kW'), kw: 7, eff: .92, d: P2('ไฟ AC เข้ารถ เครื่องชาร์จในรถแปลงเป็น DC', 'AC goes into the car; the on-board charger converts it to DC') },
  dc: { t: P2('DC ชาร์จเร็ว 150 kW', 'DC fast 150 kW'), kw: 150, eff: .94, d: P2('ตู้ชาร์จแปลง AC 3 เฟสเป็น DC ส่งตรงเข้าแบตเตอรี่', 'The cabinet converts 3-phase AC to DC straight into the battery') },
  mcs: { t: P2('รถบรรทุก MCS 1 MW', 'Truck MCS 1 MW'), kw: 1000, eff: .95, d: P2('มาตรฐาน Megawatt Charging System รองรับสูงสุด 3.75 MW ต้องมีหม้อแปลงแรงดันกลางของตัวเอง', 'The Megawatt Charging System standard goes up to 3.75 MW and needs its own medium-voltage transformer') },
  wl: { t: P2('ชาร์จไร้สาย 11 kW (SAE J2954)', 'Wireless pad 11 kW (SAE J2954)'), kw: 11, eff: .9, d: P2('ขดลวดใต้พื้นส่งพลังงานผ่านสนามแม่เหล็กไปขดลวดใต้รถ ระยะห่างไม่กี่สิบเซนติเมตร', 'A coil in the floor transfers energy through a magnetic field to a coil under the car, tens of centimetres away') },
  swap: { t: P2('สถานีสลับแบตมอเตอร์ไซค์', 'Motorcycle battery-swap station'), kw: 2, eff: .92, d: P2('ชาร์จแบตเตอรี่ก้อนเล็กหลายก้อนไว้ล่วงหน้า ผู้ขับสลับก้อนใน 1 นาที', 'Charges many small packs ahead of time; riders swap a pack in a minute') }
};
function pathModel(s) {
  const m = MED[s.med], Pin = s.P; // MW
  const st = []; let p = Pin;
  const take = (k, lossMW) => { lossMW = Math.max(0, Math.min(p, lossMW)); st.push([k, lossMW]); p -= lossMW; };
  take(P2('หม้อแปลงยกแรงดันที่โรงไฟฟ้า', 'Step-up transformer at the plant'), p * .004);
  let lim = null, note = '';
  if (m.beam) { take(P2('แปลงไฟ DC → ไมโครเวฟ บนดาวเทียม', 'DC → microwave on the satellite'), p * .3); take(P2('ลำคลื่นกระจายนอกจานรับ', 'Beam spill outside the receiving antenna'), p * .15); take(P2('สายอากาศรับ (rectenna) แปลงกลับเป็นไฟ', 'Rectenna converts back to electricity'), p * .2); note = L('สมมติประสิทธิภาพปลายทางราว 45% ยังเป็นงานทดลอง เช่นดาวเทียม MAPLE ของ Caltech ที่ส่งพลังงานไร้สายในอวกาศได้ในปี 2023', 'Assumes ~45% end-to-end; still experimental, e.g. Caltech\'s MAPLE satellite beamed power in space in 2023'); }
  else if (m.dc) {
    take(P2('สถานีแปลง AC → DC', 'AC → DC converter station'), p * .007);
    const V = s.V * 1000, I = p * 1e6 / (2 * V); const loss = 2 * I * I * m.R * s.km / 1e6; take(P2('ความร้อนในสาย HVDC (I²R)', 'Heat in the HVDC line (I²R)'), loss);
    take(P2('สถานีแปลง DC → AC', 'DC → AC converter station'), p * .007);
    note = L(`HVDC ±${s.V} kV: กระแส ~${fmt(I)} A ต่อขั้ว ไม่มีกระแสประจุสาย จึงส่งใต้ทะเลได้ไกลหลายร้อยกิโลเมตร`, `HVDC ±${s.V} kV: ~${fmt(I)} A per pole and no charging current, so it can run hundreds of km under the sea`);
  } else {
    const V = s.V * 1000, Il = p * 1e6 / (Math.sqrt(3) * V); let Ieff = Il;
    if (m.C) { const Ic = V / Math.sqrt(3) * 2 * Math.PI * 50 * m.C * 1e-6 * s.km; Ieff = Math.sqrt(Il * Il + (Ic / 2) * (Ic / 2)); const Imax = 1200; if (Math.sqrt(Il * Il + Ic * Ic) > Imax) lim = L(`สาย AC ยาว ${fmt(s.km)} km กระแสประจุสาย ~${fmt(Ic)} A กินความจุสายจนส่งกำลังจริงแทบไม่ได้ ต้องเปลี่ยนเป็น HVDC หรือติดตัวชดเชย`, `A ${fmt(s.km)} km AC cable draws ~${fmt(Ic)} A of charging current, using up its capacity; switch to HVDC or add compensation`); note = L(`กระแสโหลด ~${fmt(Il)} A + กระแสประจุสาย ~${fmt(Ic)} A`, `Load current ~${fmt(Il)} A + charging current ~${fmt(Ic)} A`); }
    else note = L(`กระแส ~${fmt(Il)} A ต่อเฟส · ส่งแรงดันสูงขึ้น 2 เท่า กระแสลดครึ่ง การสูญเสียลดเหลือ 1/4`, `~${fmt(Il)} A per phase · double the voltage, half the current, a quarter of the loss`);
    take(P2('ความร้อนในสาย (I²R)', 'Heat in the line (I²R)'), 3 * Ieff * Ieff * m.R * s.km / 1e6);
    if (m.cor) take(P2('Corona (ประจุรั่วสู่อากาศรอบสาย)', 'Corona (charge leaking into the air)'), (s.V >= 500 ? 3 : s.V >= 230 ? 1 : .3) * (s.rain ? 5 : 1) * s.km / 1000);
  }
  take(P2('สถานีไฟฟ้าย่อย ลดเป็น 22/33 kV', 'Substation steps down to 22/33 kV'), p * .003);
  take(P2('สายจำหน่ายแรงดันกลาง/ต่ำ', 'Medium/low-voltage distribution'), p * .025);
  take(P2('หม้อแปลงบนเสา 230/400 V', 'Pole transformer 230/400 V'), p * .012);
  const c = CHG[s.chg]; take(P2('เครื่องชาร์จ / แปลง AC→DC เข้าแบต', 'Charger / AC→DC into the battery'), p * (1 - c.eff));
  return { st, out: p, lim, note, Pin };
}
const STEPS_COL = ['#9aa7ad', '#e5484d', '#eda100', '#2a78d6', '#1baf7a', '#8a5cf6', '#ff5fb7', '#53b7ff', '#c98500', '#7b8590'];
function pathSim() {
  return {
    controls: [
      { id: 'P', label: L('กำลังที่โรงไฟฟ้าส่งออก', 'Power leaving the plant'), min: 10, max: 2000, step: 10, val: 500, unit: 'MW' },
      { id: 'med', type: 'select', label: L('วิธีส่ง', 'Transmission'), val: 'ac_oh', opts: Object.entries(MED).map(([k, v]) => [k, tx(v.t)]) },
      { id: 'V', type: 'select', label: L('แรงดันส่ง (kV)', 'Transmission voltage (kV)'), val: '230', opts: [['115', '115 kV'], ['230', '230 kV'], ['500', '500 kV']] },
      { id: 'km', label: L('ระยะทาง', 'Distance'), min: 10, max: 1500, step: 10, val: 200, unit: 'km' },
      { id: 'rain', type: 'toggle', label: L('ฝนตก / ความชื้นสูง (corona เพิ่ม)', 'Rain / high humidity (more corona)'), val: false },
      { id: 'chg', type: 'select', label: L('ปลายทาง', 'Destination'), val: 'dc', opts: Object.entries(CHG).map(([k, v]) => [k, tx(v.t)]) }
    ],
    init() {},
    metrics(s) { s.V = +s.V; const r = pathModel(s); const tot = r.Pin - r.out; const c = CHG[s.chg];
      return [[L('ถึงปลายทาง', 'Delivered'), `${fmt(r.out, 1)} MW (${fmt(r.out / r.Pin * 100, 1)}%)`], [L('สูญเสียรวม', 'Total loss'), `${fmt(tot, 1)} MW (${fmt(tot / r.Pin * 100, 1)}%)`],
        ...r.st.filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => [tx(k), `${fmt(v, 2)} MW`]),
        [L('จ่ายหัวชาร์จพร้อมกันได้', 'Chargers it can run at once'), `${fmt(r.out * 1000 / c.kw)} ${L('หัว', 'units')} × ${c.kw} kW`], [L('หมายเหตุ', 'Note'), r.lim || r.note]]; },
    spots: [
      { x: 60, y: 300, k: 'm', t: () => L('เครื่องกำเนิดไฟฟ้า + หม้อแปลงยกแรงดัน', 'Generator + step-up transformer'), d: () => L('เครื่องกำเนิดไฟผลิตราว 11–25 kV แล้วหม้อแปลงยกเป็น 115–500 kV เพราะกำลัง P = V × I ถ้าแรงดันสูง กระแสจะต่ำ ความร้อนในสาย (I²R) จึงลดลงมาก', 'Generators make about 11–25 kV, then a transformer raises it to 115–500 kV. Since P = V × I, high voltage means low current, which cuts heat in the line (I²R)') },
      { x: 420, y: 196, k: 'm', t: s => tx(MED[s.med].t), d: s => ({ ac_oh: L('สายอะลูมิเนียมแกนเหล็กแขวนบนเสา อากาศเป็นฉนวนและช่วยระบายความร้อน ถูกที่สุดต่อกิโลเมตร แต่โดนฟ้าผ่า พายุ และต้นไม้', 'Steel-cored aluminium conductors on towers; air insulates and cools them. Cheapest per km, but exposed to lightning, storms and trees'), ac_ug: L('สายทองแดงหุ้มฉนวน XLPE ในท่อใต้ถนน ปลอดภัยและไม่บังวิว แต่แพงกว่า 5–10 เท่า ระบายความร้อนยาก และมีกระแสประจุสายจำกัดระยะ', 'Copper cable insulated with XLPE in ducts under streets: safe and invisible, but 5–10× the cost, harder to cool, and charging current limits its length'), ac_sea: L('สายใต้ทะเลมีค่าความจุสูง AC ส่งได้ไม่กี่สิบกิโลเมตร จึงเหมาะกับฟาร์มลมใกล้ฝั่งหรือเกาะใกล้ ๆ', 'Subsea cables have high capacitance, so AC only reaches a few tens of km; fine for near-shore wind or nearby islands'), dc_oh: L('HVDC ใช้สายน้อยกว่า ไม่มี reactive power เหมาะส่งไกลกว่า ~600–800 km แต่สถานีแปลงแพง', 'HVDC uses fewer conductors and no reactive power, so it wins beyond ~600–800 km, but converter stations are costly'), dc_sea: L('ใต้ทะเลระยะไกลต้องใช้ HVDC เช่นสายเชื่อมฟาร์มลมนอกชายฝั่งและสายเชื่อมระหว่างประเทศ', 'Long subsea links need HVDC, such as offshore wind export cables and international interconnectors'), space: L('ดาวเทียมเก็บแสงอาทิตย์ตลอดวันแล้วส่งเป็นลำไมโครเวฟลงสายอากาศรับบนพื้นขนาดหลายกิโลเมตร ยังเป็นงานทดลอง', 'Satellites collect sunlight around the clock and beam microwaves to a ground antenna several km wide; still experimental') })[s.med] },
      { x: 600, y: 300, k: 'm', t: () => L('สถานีไฟฟ้าย่อย', 'Substation'), d: () => L('ลดแรงดันเป็น 22/33 kV (กฟภ.) หรือ 12/24 kV (กฟน.) มีเบรกเกอร์ตัดวงจรเมื่อลัดวงจร และรีเลย์ตัดโหลดเมื่อความถี่ตก', 'Steps down to 22/33 kV (PEA) or 12/24 kV (MEA), with breakers that clear faults and relays that shed load when frequency falls') },
      { x: 700, y: 250, k: 'm', t: () => L('หม้อแปลงบนเสา', 'Pole transformer'), d: () => L('ลดเหลือ 230 V (1 เฟส) / 400 V (3 เฟส) เข้าบ้านและหัวชาร์จ หม้อแปลงหนึ่งลูกรับได้จำกัด หัวชาร์จเร็วจึงมักต้องมีหม้อแปลงของตัวเอง', 'Steps down to 230 V (single-phase) / 400 V (three-phase) for homes and chargers. Each transformer has limited capacity, so fast chargers usually get their own') },
      { x: 760, y: 380, k: 'p', t: s => tx(CHG[s.chg].t), d: s => tx(CHG[s.chg].d) + ' · ' + L('จุดชาร์จไม่จำเป็นต้องอยู่ใกล้โรงไฟฟ้า เพราะไฟจากทุกโรงเข้าโครงข่ายเดียวกัน แต่ต้องอยู่ใกล้สถานีย่อยหรือหม้อแปลงที่มีความจุเหลือ และอยู่บนเส้นทางที่รถผ่าน', 'Chargers need not be near power plants, since every plant feeds the same grid, but they must be near a substation or transformer with spare capacity and on routes vehicles use') }
    ],
    draw(c, s, t, P) {
      s.V = +s.V; const r = pathModel(s), m = MED[s.med];
      const sky = c.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, P.sky[0]); sky.addColorStop(1, P.sky[1]); c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const gy = 330; c.fillStyle = P.ground; c.fillRect(0, gy, W, H - gy);
      // plant
      rr(c, 20, gy - 80, 70, 80, 4, P.panel, P.line); c.fillStyle = P.metal; c.fillRect(30, gy - 120, 14, 40); txt(c, L('โรงไฟฟ้า', 'Plant'), 55, gy - 60, P.fg, 11); txt(c, '11–25 kV', 55, gy - 44, P.fg2, 10);
      rr(c, 98, gy - 40, 28, 40, 3, P.metal2, P.line); txt(c, '↑', 112, gy - 20, P.fg, 14);
      // line segment 130..570
      const x0 = 140, x1 = 570; const vtxt = m.beam ? L('ไมโครเวฟ 2.45/5.8 GHz', 'Microwave 2.45/5.8 GHz') : m.dc ? `±${s.V} kV DC` : `${s.V} kV AC`;
      const flowCol = P.elec; const kOut = r.out / r.Pin;
      if (s.med === 'ac_oh' || s.med === 'dc_oh') {
        for (let x = x0 + 30; x < x1; x += 110) { c.strokeStyle = P.metal; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 12, gy); c.lineTo(x - 3, gy - 140); c.lineTo(x + 3, gy - 140); c.lineTo(x + 12, gy); c.stroke(); c.beginPath(); c.moveTo(x - 22, gy - 125); c.lineTo(x + 22, gy - 125); c.stroke(); }
        const ys = m.dc ? [-125] : [-125, -110, -95]; ys.forEach((dy, i) => { const pts = []; for (let x = x0; x <= x1; x += 10) pts.push([x, gy + dy + 10 * Math.sin((x - x0) / 110 * Math.PI) ** 2]); pipe(c, pts, P.dk, m.dc ? 3 : 2); LabSim.H.flow(c, pts, t + i * .3, .6, flowCol, 2.2, 8); if (s.rain && !m.dc) for (let k = 0; k < 10; k++) { const [px, py] = polyAt(pts, ((t * 30 + k * 47) % polyLen(pts))); c.fillStyle = 'rgba(160,120,255,.7)'; c.beginPath(); c.arc(px, py, 3 + Math.sin(t * 20 + k) * 1.5, 0, 7); c.fill(); } });
        if (s.rain) for (let k = 0; k < 60; k++) { const x = (k * 53 + t * 40) % W, y = (k * 37 + t * 300) % gy; c.strokeStyle = 'rgba(120,150,200,.5)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y + 8); c.stroke(); }
      } else if (s.med === 'ac_ug') {
        rr(c, x0, gy + 30, x1 - x0, 26, 4, P.soil); pipe(c, [[x0, gy + 43], [x1, gy + 43]], P.dk, 10); LabSim.H.flow(c, [[x0, gy + 43], [x1, gy + 43]], t, .6, flowCol, 2.5, 10);
        for (let x = x0 + 40; x < x1; x += 120) { rr(c, x, gy - 4, 20, 8, 2, P.metal2, P.line); } txt(c, L('ท่อร้อยสายใต้ถนน', 'Cable duct under the road'), (x0 + x1) / 2, gy + 70, P.fg2, 10);
      } else if (s.med === 'ac_sea' || s.med === 'dc_sea') {
        c.fillStyle = P.water; c.fillRect(x0 + 20, gy - 6, x1 - x0 - 40, H - gy + 6); for (let i = 0; i < 12; i++) { const x = x0 + 30 + (i * 41 + t * 15) % (x1 - x0 - 60); c.strokeStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(x, gy + 4); c.quadraticCurveTo(x + 8, gy, x + 16, gy + 4); c.stroke(); }
        const pts = [[x0, gy - 2], [x0 + 40, H - 20], [x1 - 40, H - 20], [x1, gy - 2]]; pipe(c, pts, P.dk, 8); LabSim.H.flow(c, pts, t, .6, flowCol, 2.5, 12);
        if (m.dc) { rr(c, x0 - 10, gy - 60, 34, 54, 4, P.panel, P.cond); txt(c, 'AC/DC', x0 + 7, gy - 33, P.cond, 8); rr(c, x1 - 24, gy - 60, 34, 54, 4, P.panel, P.cond); txt(c, 'DC/AC', x1 - 7, gy - 33, P.cond, 8); }
      } else if (m.beam) {
        c.fillStyle = P.dark ? '#0b1020' : '#1b2440'; c.fillRect(x0, 0, x1 - x0, 90); for (let i = 0; i < 30; i++) { c.fillStyle = '#fff'; c.fillRect(x0 + (i * 97) % (x1 - x0), (i * 31) % 85, 1.5, 1.5); }
        rr(c, (x0 + x1) / 2 - 70, 30, 140, 22, 3, '#2a78d6'); rr(c, (x0 + x1) / 2 - 10, 26, 20, 30, 3, P.metal);
        for (let i = 0; i < 6; i++) { const f = (t * .8 + i / 6) % 1; c.strokeStyle = `rgba(255,95,183,${(1 - f) * .8})`; c.lineWidth = 3; const y = lerp(60, gy - 30, f), w2 = lerp(10, 90, f); c.beginPath(); c.moveTo((x0 + x1) / 2 - w2, y); c.lineTo((x0 + x1) / 2 + w2, y); c.stroke(); }
        for (let i = 0; i < 9; i++) { c.strokeStyle = P.metal; c.lineWidth = 2; c.beginPath(); c.moveTo((x0 + x1) / 2 - 80 + i * 20, gy); c.lineTo((x0 + x1) / 2 - 80 + i * 20, gy - 20); c.stroke(); } txt(c, L('สายอากาศรับ (rectenna)', 'Rectenna'), (x0 + x1) / 2 + 130, gy - 24, P.fg2, 10);
        pipe(c, [[(x0 + x1) / 2 + 90, gy - 10], [x1, gy - 10]], P.dk, 3);
      }
      txt(c, vtxt, (x0 + x1) / 2, m.beam ? 110 : 150, P.fg, 13); txt(c, m.beam ? L('วงโคจร ~36,000 km', 'orbit ~36,000 km') : `${fmt(s.km)} km`, (x0 + x1) / 2, m.beam ? 128 : 168, P.fg2, 11);
      // substation, distribution, charger
      rr(c, 580, gy - 50, 50, 50, 3, P.metal2, P.line); txt(c, '↓', 605, gy - 25, P.fg, 14); txt(c, '22/33 kV', 605, gy - 60, P.fg2, 10);
      c.strokeStyle = P.metal; c.lineWidth = 3; c.beginPath(); c.moveTo(700, gy); c.lineTo(700, gy - 100); c.stroke(); rr(c, 688, gy - 90, 24, 22, 4, P.metal2, P.line); pipe(c, [[630, gy - 40], [700, gy - 96]], P.dk, 1.5); txt(c, '230/400 V', 700, gy - 108, P.fg2, 10);
      pipe(c, [[700, gy - 70], [745, gy - 50]], P.dk, 1.5);
      const ch = CHG[s.chg]; rr(c, 738, gy - 62, 24, 62, 4, P.panel, P.clean); c.fillStyle = P.clean; c.fillRect(743, gy - 54, 14, 10);
      if (s.chg === 'swap') { for (let i = 0; i < 6; i++) rr(c, 768 + (i % 2) * 12, gy - 60 + Math.floor(i / 2) * 18, 10, 14, 2, Math.sin(t * 2 + i) > 0 ? P.clean : P.s4); }
      else { const big = s.chg === 'mcs'; rr(c, 640, gy + 20, big ? 120 : 80, big ? 34 : 26, 8, big ? '#4b6f8c' : P.cond); c.fillStyle = P.dk; [0, 1].forEach(k => { c.beginPath(); c.arc(652 + k * (big ? 90 : 56), gy + (big ? 56 : 48), 8, 0, 7); c.fill(); }); if (s.chg === 'wl') { for (let i = 0; i < 3; i++) { const f = (t + i / 3) % 1; c.strokeStyle = `rgba(42,120,214,${1 - f})`; c.beginPath(); c.ellipse(680, gy + 58 - f * 10, 30, 4, 0, 0, 7); c.stroke(); } } else pipe(c, [[750, gy - 30], [720, gy + 30]], P.dk, 3); }
      // flow dots shrinking along the chain
      const chain = [[90, gy - 20], [x0, gy - 20]]; LabSim.H.flow(c, chain, t, 1, flowCol, 3, 4);
      // loss bars (stacked) at the bottom-left
      const bx = 20, by = m.beam ? 362 : 30, bw = 440; rr(c, bx - 6, by - 20, bw + 12, 50 + 16 * Math.ceil(r.st.length / 2), 8, P.dark ? 'rgba(17,24,22,.85)' : 'rgba(255,255,255,.9)', P.line);
      txt(c, L(`ไฟถึงปลายทาง ${fmt(kOut * 100, 1)}%`, `${fmt(kOut * 100, 1)}% delivered`), bx, by - 6, P.fg, 12, 'left');
      let xx = bx; c.fillStyle = P.clean; const wOut = bw * kOut; c.fillRect(xx, by + 4, wOut, 14); xx += wOut;
      r.st.forEach(([k, v], i) => { const w2 = bw * v / r.Pin; c.fillStyle = STEPS_COL[i % STEPS_COL.length]; c.fillRect(xx, by + 4, w2, 14); xx += w2; });
      r.st.forEach(([k, v], i) => { const col = i % 2, row = Math.floor(i / 2); c.fillStyle = STEPS_COL[i % STEPS_COL.length]; c.fillRect(bx + col * 225, by + 28 + row * 16, 8, 8); txt(c, `${tx(k).slice(0, 34)} ${fmt(v / r.Pin * 100, 1)}%`, bx + col * 225 + 12, by + 32 + row * 16, P.fg2, 9, 'left'); });
      if (r.lim) { rr(c, 390, 190, 300, 26, 6, '#e5484d'); txt(c, L('สาย AC ยาวเกินไป: ต้องใช้ HVDC', 'AC cable too long: use HVDC'), 540, 203, '#fff', 11); }
    }
  };
}

/* ===================== 2) 50 Hz balance ===================== */
function freqSim() {
  const S = 40000; // MW online system size
  return {
    controls: [
      { id: 'trip', type: 'select', label: L('โรงไฟฟ้าหยุดกะทันหัน', 'Sudden plant trip'), val: '1000', opts: [['0', L('ไม่มี', 'None')], ['500', '500 MW'], ['1000', '1,000 MW'], ['2000', '2,000 MW'], ['3000', L('3,000 MW (หลายโรงพร้อมกัน)', '3,000 MW (several plants)')]] },
      { id: 'res', label: L('กำลังสำรองพร้อมจ่าย (spinning reserve)', 'Spinning reserve'), min: 0, max: 3000, step: 100, val: 1200, unit: 'MW' },
      { id: 'bat', label: L('แบตเตอรี่ตอบสนองเร็ว', 'Fast battery response'), min: 0, max: 2000, step: 100, val: 300, unit: 'MW' },
      { id: 'ibr', label: L('สัดส่วนโซลาร์/ลม (ไม่มีแรงเฉื่อย)', 'Solar/wind share (no inertia)'), min: 0, max: 80, step: 5, val: 20, unit: '%' },
      { id: 'ev', label: L('จำนวนรถ EV', 'Number of EVs'), min: 0, max: 5, step: .5, val: 2, unit: L('ล้านคัน', 'million') },
      { id: 'smart', type: 'toggle', label: L('ชาร์จอัจฉริยะ / ค่าไฟตามช่วงเวลา (TOU)', 'Smart charging / time-of-use tariff'), val: true }
    ],
    init(s) { s.T = 0; s._k = ''; s.tr = []; },
    step(s, dt) {
      const key = [s.trip, s.res, s.bat, s.ibr].join(); if (key !== s._k) { s._k = key; s.T = 0; s.f = 50; s.gov = 0; s.b = 0; s.shed = 0; s.tr = []; s.nadir = 50; }
      const sub = 10; for (let i = 0; i < sub; i++) {
        const h = dt * 2 / sub; s.T += h; if (s.T > 30) { s.T = 0; s.f = 50; s.gov = 0; s.b = 0; s.shed = 0; s.tr = []; s.nadir = 50; }
        const lost = s.T > 2 ? +s.trip : 0; const df = s.f - 50;
        const Hs = 5 * (1 - s.ibr / 100) + .3 * s.ibr / 100; // seconds
        const need = Math.max(0, lost - s.shed);
        if (lost) { s.gov += (Math.min(s.res, need) - s.gov) * Math.min(1, h / 6); s.b += (Math.min(s.bat, Math.max(0, need - s.gov)) - s.b) * Math.min(1, h / .3); }
        if (s.f < 49.0 && s.shed < lost) s.shed = Math.min(lost * 1.1, s.shed + lost * .35); // UFLS stage
        const dP = -lost + s.b + s.gov + s.shed - 1500 * df; // 1500 MW/Hz load self-regulation + droop
        s.f += dP / (2 * Hs * S) * 50 * h; s.f = clamp(s.f, 47, 51);
        s.nadir = Math.min(s.nadir, s.f);
      }
      s.tr.push([s.T, s.f]); if (s.tr.length > 600) s.tr.shift();
    },
    metrics(s) { const rocof = s.tr.length > 5 ? (s.tr[s.tr.length - 1][1] - s.tr[s.tr.length - 5][1]) / Math.max(.01, s.tr[s.tr.length - 1][0] - s.tr[s.tr.length - 5][0]) : 0;
      const evPk = evPeak(s);
      return [[L('ความถี่ตอนนี้', 'Frequency now'), `${fmt(s.f || 50, 2)} Hz`], [L('ต่ำสุด (nadir)', 'Lowest (nadir)'), `${fmt(s.nadir || 50, 2)} Hz`], [L('อัตราเปลี่ยน (RoCoF)', 'Rate of change (RoCoF)'), `${fmt(rocof, 2)} Hz/s`],
        [L('ตัดโหลดอัตโนมัติ (UFLS)', 'Automatic load shedding (UFLS)'), s.shed ? L(`${fmt(s.shed)} MW ≈ ${fmt(s.shed * 1000 / .3)} ครัวเรือน`, `${fmt(s.shed)} MW ≈ ${fmt(s.shed * 1000 / .3)} homes`) : L('ไม่ต้องตัด', 'None')],
        [L('พีกจาก EV ช่วงค่ำ', 'EV evening peak'), `${fmt(evPk.dumb)} MW → ${fmt(s.smart ? evPk.smart : evPk.dumb)} MW`],
        [L('เกิดอะไรขึ้น', 'What happens'), !+s.trip ? L('ผลิตเท่ากับใช้ ความถี่นิ่งที่ 50 Hz', 'Supply equals demand, so frequency holds at 50 Hz') : s.shed ? L('สำรองตอบสนองไม่ทัน ความถี่ตกถึง 49 Hz รีเลย์ตัดไฟบางพื้นที่เพื่อรักษาทั้งระบบ', 'Reserves were too slow; frequency hit 49 Hz and relays shed some areas to save the grid') : L('แรงเฉื่อยของเครื่องหมุนชะลอการตก แบตเตอรี่จ่ายภายในเสี้ยววินาที แล้วโรงสำรองเพิ่มกำลังใน 10–30 วินาที', 'Spinning machines\' inertia slows the fall, batteries respond within a fraction of a second, then reserve plants ramp up in 10–30 s')]]; },
    spots: [
      { x: 120, y: 60, k: 'm', t: () => L('ความถี่ 50 Hz', '50 Hz frequency'), d: () => L('เครื่องกำเนิดไฟทุกเครื่องหมุนพร้อมกันที่ 3,000 รอบ/นาที (2 ขั้ว) ถ้าใช้ไฟมากกว่าผลิต เครื่องจะชะลอและความถี่ตก ถ้าผลิตมากกว่าใช้ ความถี่จะขึ้น ศูนย์ควบคุมจึงต้องปรับกำลังผลิตตามการใช้ตลอดเวลาด้วยระบบ AGC', 'Every generator spins in sync at 3,000 rpm (2-pole). If demand exceeds supply they slow and frequency falls; if supply exceeds demand it rises. The control centre matches output to demand continuously with AGC') },
      { x: 520, y: 60, k: 'm', t: () => L('แรงเฉื่อยและโซลาร์/ลม', 'Inertia and solar/wind'), d: () => L('เครื่องกำเนิดไฟหนักหลายร้อยตันเก็บพลังงานจลน์ไว้ ช่วยชะลอการตกของความถี่ โซลาร์และลมต่อผ่านอินเวอร์เตอร์ ไม่มีแรงเฉื่อยตามธรรมชาติ ระบบที่มีพลังงานหมุนเวียนมากจึงต้องมีแบตเตอรี่ grid-forming หรือ synchronous condenser ช่วย', 'Generators weighing hundreds of tonnes store kinetic energy that slows a frequency fall. Solar and wind connect through inverters with no natural inertia, so high-renewable grids add grid-forming batteries or synchronous condensers') },
      { x: 300, y: 330, k: 'm', t: () => L('รถ EV กับพีกช่วงค่ำ', 'EVs and the evening peak'), d: () => L('ถ้าทุกคนเสียบชาร์จตอนกลับบ้าน 18–21 น. พีกจะสูงขึ้นมาก ต้องลงทุนโรงไฟฟ้าและหม้อแปลงเพิ่ม การชาร์จอัจฉริยะและค่าไฟตามช่วงเวลา (TOU) เลื่อนไปชาร์จหลัง 22 น. ใช้โครงข่ายเดิมได้คุ้มขึ้น และในอนาคตรถยังส่งไฟกลับช่วยระบบได้ (V2G)', 'If everyone plugs in on arriving home at 6–9 pm the peak jumps and needs more plants and transformers. Smart charging and time-of-use tariffs shift charging past 10 pm so existing grids go further, and in future cars can feed power back (V2G)') }
    ],
    draw(c, s, t, P) {
      c.fillStyle = P.panel; c.fillRect(0, 0, W, H);
      // frequency chart (top)
      const fx0 = 50, fx1 = 780, fy0 = 30, fy1 = 200; const fy = f => lerp(fy1, fy0, (f - 48.5) / 2);
      c.strokeStyle = P.line; c.lineWidth = 1; [49, 49.5, 50, 50.5].forEach(v => { c.beginPath(); c.moveTo(fx0, fy(v)); c.lineTo(fx1, fy(v)); c.stroke(); txt(c, `${v}`, fx0 - 6, fy(v), P.muted, 9, 'right'); });
      c.fillStyle = 'rgba(229,72,77,.12)'; c.fillRect(fx0, fy(49), fx1 - fx0, fy1 - fy(49)); txt(c, L('UFLS ตัดโหลดที่ 49 Hz', 'UFLS sheds load at 49 Hz'), fx1 - 4, fy(49) + 10, '#e5484d', 9, 'right');
      if (s.tr && s.tr.length > 1) { c.beginPath(); s.tr.forEach(([tt, f], i) => { const x = lerp(fx0, fx1, tt / 30), y = fy(f); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.strokeStyle = P.cond; c.lineWidth = 2.5; c.stroke(); }
      txt(c, L('ความถี่ระบบ (Hz) ใน 30 วินาที', 'Grid frequency (Hz) over 30 s'), fx0, 16, P.fg, 12, 'left'); if (+s.trip) { const x = lerp(fx0, fx1, 2 / 30); c.strokeStyle = '#e5484d'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(x, fy0); c.lineTo(x, fy1); c.stroke(); c.setLineDash([]); txt(c, L(`หยุด ${fmt(+s.trip)} MW`, `${fmt(+s.trip)} MW trip`), x + 4, fy0 + 8, '#e5484d', 10, 'left'); }
      // spinning generator icon
      const rpm = 3000 * (s.f || 50) / 50; LabSim.H.rotor(c, 760, 60, 14, t * rpm / 60 * .05, P.fg2, 2, 3); txt(c, `${fmt(rpm)} rpm`, 760, 86, P.fg2, 9);
      // daily demand (bottom)
      const dx0 = 50, dx1 = 780, dy0 = 250, dy1 = 425; const base = h => 24000 + 6000 * gau((h - 14) / 3.5) + 4500 * gau((h - 20) / 2) - 3000 * gau((h - 4) / 3);
      const ev = h => evLoad(s, h); const mx = 40000; const dy = v => lerp(dy1, dy0, v / mx);
      c.strokeStyle = P.line; [10000, 20000, 30000, 40000].forEach(v => { c.beginPath(); c.moveTo(dx0, dy(v)); c.lineTo(dx1, dy(v)); c.stroke(); txt(c, `${v / 1000} GW`, dx0 - 6, dy(v), P.muted, 9, 'right'); });
      c.beginPath(); for (let h = 0; h <= 24; h += .25) { const x = lerp(dx0, dx1, h / 24); h ? c.lineTo(x, dy(base(h))) : c.moveTo(x, dy(base(h))); } c.lineTo(dx1, dy1); c.lineTo(dx0, dy1); c.fillStyle = P.dark ? 'rgba(90,110,120,.5)' : 'rgba(150,170,180,.45)'; c.fill();
      c.beginPath(); for (let h = 0; h <= 24; h += .25) { const x = lerp(dx0, dx1, h / 24); h ? c.lineTo(x, dy(base(h) + ev(h))) : c.moveTo(x, dy(base(h) + ev(h))); } for (let h = 24; h >= 0; h -= .25) c.lineTo(lerp(dx0, dx1, h / 24), dy(base(h))); c.fillStyle = s.smart ? 'rgba(27,175,122,.7)' : 'rgba(229,72,77,.7)'; c.fill();
      for (let h = 0; h <= 24; h += 6) txt(c, `${h}:00`, lerp(dx0, dx1, h / 24), dy1 + 12, P.muted, 9);
      txt(c, L('ความต้องการไฟฟ้าทั้งวัน (สีเทา) + รถ EV (สี)', 'Daily demand (grey) + EVs (colour)'), dx0, dy0 - 14, P.fg, 12, 'left');
    }
  };
}
function evLoad(s, h) { const n = s.ev * 1e6, kWh = 8; // ~50 km/day
  const cd = (a, b) => { const d = Math.abs(a - b) % 24; return Math.min(d, 24 - d); };
  const prof = s.smart ? (hh => gau(cd(hh, 1.5) / 3) + .15 * gau((hh - 12) / 2)) : (hh => gau((hh - 19.5) / 1.6) + .1 * gau((hh - 12) / 2));
  let sum = 0; for (let x = 0; x < 24; x += .25) sum += prof(x) * .25; return n * kWh / 1000 * prof(h) / sum; }
function evPeak(s) { let d = 0, m = 0; const sm = s.smart; s.smart = false; for (let h = 17; h < 23; h += .25) d = Math.max(d, evLoad(s, h)); s.smart = true; for (let h = 17; h < 23; h += .25) m = Math.max(m, evLoad(s, h)); s.smart = sm; return { dumb: d, smart: m }; }

/* ===================== 3) meters ===================== */
function meterSim() {
  return {
    controls: [
      { id: 'type', type: 'select', label: L('ชนิดมิเตอร์', 'Meter type'), val: 'disc', opts: [['disc', L('จานหมุน (electromechanical)', 'Rotating disc (electromechanical)')], ['dig', L('ดิจิทัล / สมาร์ทมิเตอร์', 'Digital / smart meter')]] },
      { id: 'ph', type: 'select', label: L('ระบบไฟ', 'Supply'), val: '1', opts: [['1', L('1 เฟส 230 V (บ้านทั่วไป)', 'Single-phase 230 V (most homes)')], ['3', L('3 เฟส 400 V (ร้านค้า โรงงาน)', 'Three-phase 400 V (shops, factories)')]] },
      { id: 'kw', label: L('โหลดที่เปิดใช้', 'Load switched on'), min: 0, max: 30, step: .1, val: 3, unit: 'kW' },
      { id: 'pf', label: L('ตัวประกอบกำลัง (cos φ)', 'Power factor (cos φ)'), min: .5, max: 1, step: .01, val: .95, unit: '' },
      { id: 'sol', label: L('โซลาร์บนหลังคาผลิต', 'Rooftop solar output'), min: 0, max: 10, step: .1, val: 0, unit: 'kW' }
    ],
    init(s) { s.kwh = 1234.5; s.exp = 0; s.ang = 0; s.pulse = 0; s.pt = 0; },
    step(s, dt) { const net = s.kw - s.sol; const sp = dt * 60; // 1 s = 1 min
      if (net >= 0) s.kwh += net * sp / 3600; else s.exp += -net * sp / 3600;
      s.ang += (s.type === 'disc' ? net * 600 / 3600 * 2 * Math.PI * sp : 0); // 600 rev/kWh
      s.pt += Math.abs(net) * 1000 / 3600 * sp; // 1000 imp/kWh
    },
    metrics(s) { const ph = +s.ph, V = ph === 1 ? 230 : 400, net = s.kw - s.sol; const I = Math.abs(s.kw) * 1000 / ((ph === 1 ? V : Math.sqrt(3) * V) * s.pf);
      const Q = s.kw * Math.tan(Math.acos(s.pf));
      return [[L('สูตรกำลัง', 'Power formula'), ph === 1 ? 'P = V × I × cos φ' : 'P = √3 × V(LL) × I × cos φ'], [L('กระแส', 'Current'), ph === 1 ? `${fmt(I, 1)} A` : L(`${fmt(I, 1)} A ต่อเฟส`, `${fmt(I, 1)} A per phase`)],
        [L('กำลังจริง / กำลังรีแอกทีฟ', 'Real / reactive power'), `${fmt(s.kw, 2)} kW · ${fmt(Q, 2)} kvar`], [L('สุทธิหลังหักโซลาร์', 'Net after solar'), net >= 0 ? L(`ซื้อไฟ ${fmt(net, 2)} kW`, `Importing ${fmt(net, 2)} kW`) : L(`ขายไฟคืน ${fmt(-net, 2)} kW`, `Exporting ${fmt(-net, 2)} kW`)],
        s.type === 'disc' ? [L('จานหมุน (600 รอบ/kWh)', 'Disc (600 rev/kWh)'), net >= 0 ? `${fmt(net * 600 / 60, 1)} ${L('รอบ/นาที', 'rpm')}` : L('หมุนกลับหรือหยุด (รุ่นมีตัวกันหมุนกลับ)', 'Runs backward or stops (if it has a ratchet)')] : [L('ไฟกะพริบ (1,000 imp/kWh)', 'Pulse LED (1,000 imp/kWh)'), `${fmt(Math.abs(net) * 1000 / 3600, 2)} ${L('ครั้ง/วินาที', 'per second')}`],
        [L('หน่วยที่ใช้ (kWh)', 'Energy used (kWh)'), `${fmt(s.kwh, 2)}${s.type === 'dig' ? L(` · ขาย ${fmt(s.exp, 2)}`, ` · exported ${fmt(s.exp, 2)}`) : ''}`],
        [L('ขนาดมิเตอร์ที่เหมาะ', 'Suitable meter size'), ph === 1 ? (I <= 15 ? '5(15) A' : I <= 45 ? '15(45) A' : I <= 100 ? '30(100) A' : L('เกิน 100 A ใช้ 3 เฟส', 'over 100 A: use 3-phase')) : (I <= 15 ? '3×5(15) A' : I <= 45 ? '3×15(45) A' : I <= 100 ? '3×30(100) A' : L('ใช้มิเตอร์ต่อผ่าน CT', 'CT-connected meter'))]]; },
    spots: [
      { x: 186, y: 165, k: 'm', t: s => s.type === 'disc' ? L('ขดลวดแรงดัน + ขดลวดกระแส', 'Voltage coil + current coil') : L('เซนเซอร์กระแส (shunt/CT) + วงจรแบ่งแรงดัน', 'Current sensor (shunt/CT) + voltage divider'), d: s => s.type === 'disc' ? L('ขดลวดแรงดันต่อคร่อมสาย ขดลวดกระแสต่ออนุกรมกับโหลด สนามแม่เหล็กสองชุดเหนี่ยวนำกระแสวน (eddy current) ในจานอะลูมิเนียม เกิดแรงบิดที่แปรตาม V × I × cos φ จานจึงหมุนเร็วตามกำลังจริงที่ใช้', 'The voltage coil sits across the supply and the current coil in series with the load. Their two fields induce eddy currents in the aluminium disc, creating torque proportional to V × I × cos φ, so the disc spins at a speed that follows real power') : L('วัดแรงดันและกระแสเป็นสัญญาณเล็ก ๆ แล้วส่งเข้าตัวแปลง ADC สุ่มวัดหลายพันครั้งต่อวินาที', 'Voltage and current are scaled down to small signals and fed to an ADC that samples thousands of times per second') },
      { x: 455, y: 175, k: 'm', t: s => s.type === 'disc' ? L('จานอะลูมิเนียม + แม่เหล็กเบรก', 'Aluminium disc + brake magnet') : L('ชิปวัดพลังงาน', 'Metering chip'), d: s => s.type === 'disc' ? L('แม่เหล็กถาวรสร้างแรงต้านที่แปรตามความเร็ว ทำให้ความเร็วจานแปรตามกำลังพอดี มีชุดเฟืองนับรอบไปหมุนหน้าปัดตัวเลข มิเตอร์ 3 เฟสมีชุดขดลวด 2–3 ชุดดันจานบนแกนเดียวกัน', 'A permanent magnet creates drag proportional to speed so disc speed tracks power exactly; gears count the turns and drive the dials. Three-phase meters have 2–3 coil sets pushing discs on one shaft') : L('คูณ v × i ทุกจุดที่สุ่มวัดแล้วรวมเป็นพลังงาน (∫ v·i dt) วัดได้ทั้งกำลังจริง รีแอกทีฟ ซื้อและขายไฟแยกกัน ไฟ LED กะพริบตามพลังงานให้ตรวจความเที่ยงได้ ความแม่นยำมักอยู่ใน class 1 (±1%)', 'Multiplies v × i at every sample and sums it into energy (∫ v·i dt), measuring real and reactive power and import/export separately. An LED pulses per unit of energy for accuracy checks; accuracy is typically class 1 (±1%)') },
      { x: 640, y: 120, k: 'm', t: s => s.type === 'disc' ? L('หน้าปัดตัวเลข', 'Dial register') : L('จอ LCD + สื่อสาร (AMI)', 'LCD + communications (AMI)'), d: s => s.type === 'disc' ? L('เจ้าหน้าที่ต้องเดินมาจดเลขทุกเดือน วัดได้ทางเดียว รุ่นเก่าอาจหมุนกลับเมื่อขายไฟโซลาร์ จึงต้องเปลี่ยนเป็นมิเตอร์ดิจิทัลสองทิศทาง', 'Someone has to read it every month, and it only measures one way; old units can run backwards with solar export, so a bidirectional digital meter is fitted') : L('เก็บค่าตามช่วงเวลา (TOU) ส่งข้อมูลทางคลื่นวิทยุ เครือข่ายมือถือ หรือสายไฟ (PLC) ให้การไฟฟ้าอ่านจากระยะไกล แจ้งไฟดับและการงัดแงะได้ทันที กฟภ. และ กฟน. ทยอยติดตั้งสมาร์ทมิเตอร์ (AMI) ในหลายเมือง', 'Stores time-of-use data and sends it by radio, cellular or power-line carrier for remote reading, reporting outages and tampering at once. PEA and MEA are rolling out smart meters (AMI) in several cities') },
      { x: 120, y: 360, k: 'm', t: s => +s.ph === 1 ? L('1 เฟส: สายไฟ L + N', 'Single-phase: L + N') : L('3 เฟส: L1 L2 L3 + N', 'Three-phase: L1 L2 L3 + N'), d: s => +s.ph === 1 ? L('สายเฟส (L) กับสายนิวทรัล (N) แรงดัน 230 V ใช้กับบ้านทั่วไป แอร์ ตู้เย็น และหัวชาร์จ EV 7 kW (~32 A)', 'Live (L) and neutral (N) at 230 V for ordinary homes, air-conditioners, fridges and 7 kW EV chargers (~32 A)') : L('สามเฟสห่างกัน 120° แรงดันระหว่างเฟส 400 V ระหว่างเฟสกับนิวทรัล 230 V ส่งกำลังได้มากด้วยกระแสต่อเส้นน้อยกว่า เหมาะกับมอเตอร์ ลิฟต์ และหัวชาร์จ AC 22 kW ควรแบ่งโหลดให้สมดุลทั้งสามเฟส', 'Three phases 120° apart: 400 V between phases, 230 V phase-to-neutral. It moves more power with less current per wire, suiting motors, lifts and 22 kW AC chargers; loads should be balanced across the phases') }
    ],
    draw(c, s, t, P) {
      const ph = +s.ph, net = s.kw - s.sol;
      c.fillStyle = P.panel; c.fillRect(0, 0, W, H);
      // meter body
      rr(c, 170, 40, 300, 280, 16, P.dark ? '#26302d' : '#eef1ef', P.line);
      if (s.type === 'disc') {
        rr(c, 200, 60, 240, 70, 8, '#fff', P.line); const digits = String(Math.floor(s.kwh)).padStart(5, '0'); digits.split('').forEach((d, i) => { c.beginPath(); c.arc(225 + i * 47, 95, 20, 0, 7); c.fillStyle = '#fafafa'; c.fill(); c.strokeStyle = '#999'; c.stroke(); const a = (+d / 10) * 2 * Math.PI - Math.PI / 2; pipe(c, [[225 + i * 47, 95], [225 + i * 47 + Math.cos(a) * 15, 95 + Math.sin(a) * 15]], '#222', 2); txt(c, d, 225 + i * 47, 124, '#222', 9); });
        const coils = ph === 1 ? 1 : 3; for (let k = 0; k < coils; k++) { const cx = 320 + (k - (coils - 1) / 2) * 70; rr(c, cx - 22, 150, 44, 40, 4, '#c98500'); txt(c, 'V', cx, 170, '#fff', 11); rr(c, cx - 22, 250, 44, 30, 4, '#b5651d'); txt(c, 'I', cx, 265, '#fff', 11); }
        c.save(); c.translate(320, 220); c.scale(1, .28); c.beginPath(); c.arc(0, 0, 110, 0, 7); c.fillStyle = '#c9ced1'; c.fill(); c.strokeStyle = '#8a9296'; c.stroke(); c.fillStyle = '#222'; c.beginPath(); c.arc(Math.cos(s.ang) * 100, Math.sin(s.ang) * 100, 9, 0, 7); c.fill(); c.restore();
        rr(c, 410, 205, 40, 30, 4, '#5a6b8c'); txt(c, 'N S', 430, 220, '#fff', 9);
        for (let i = 0; i < 4; i++) { const a = s.ang * 3 + i * Math.PI / 2; c.strokeStyle = 'rgba(42,120,214,.5)'; c.lineWidth = 2; c.beginPath(); c.arc(320 + Math.cos(a) * 60, 220 + Math.sin(a) * 16, 8, 0, 5); c.stroke(); }
        txt(c, L('กระแสวนในจาน → แรงบิด', 'Eddy currents → torque'), 320, 300, P.fg2, 10);
      } else {
        rr(c, 195, 60, 250, 90, 8, '#9fbf8f', P.line); c.font = '600 30px ui-monospace,monospace'; c.fillStyle = '#1f2a1a'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(fmt(s.kwh, 1).replace(/,/g, ''), 400, 95); txt(c, 'kWh', 425, 98, '#1f2a1a', 11);
        const show = Math.floor(t / 2) % 3; txt(c, [`${fmt(Math.abs(net), 2)} kW ${net < 0 ? '◀' : '▶'}`, `${ph === 1 ? 230 : 400} V · ${fmt(Math.abs(s.kw) * 1000 / ((ph === 1 ? 230 : 400 * Math.sqrt(3)) * s.pf), 1)} A`, `PF ${fmt(s.pf, 2)} · TOU`][show], 320, 132, '#1f2a1a', 12);
        rr(c, 215, 175, 90, 60, 6, P.dk); txt(c, 'ADC', 260, 195, '#fff', 11); txt(c, L('สุ่มวัด 4,000/วิ', '4,000 samples/s'), 260, 215, '#9fd', 9);
        rr(c, 335, 175, 100, 60, 6, P.dk); txt(c, 'Σ v·i·Δt', 385, 200, '#fff', 12); txt(c, L('ชิปวัดพลังงาน', 'Metering chip'), 385, 220, '#9fd', 9);
        const on = (s.pt % 1) < .25 && Math.abs(net) > 0; c.fillStyle = on ? '#ff3b3b' : '#5a1f1f'; c.beginPath(); c.arc(215, 270, 7, 0, 7); c.fill(); txt(c, '1000 imp/kWh', 270, 270, P.fg2, 9);
        for (let i = 0; i < 3; i++) { const f = (t * .7 + i / 3) % 1; c.strokeStyle = `rgba(42,120,214,${1 - f})`; c.lineWidth = 2; c.beginPath(); c.arc(430, 275, 6 + f * 26, -1, .2); c.stroke(); } txt(c, 'AMI', 430, 300, P.cond, 10);
      }
      // wires
      const wires = ph === 1 ? [['L', '#8a5a2b'], ['N', '#2a78d6']] : [['L1', '#8a5a2b'], ['L2', '#222'], ['L3', '#888'], ['N', '#2a78d6']];
      wires.forEach(([n, col], i) => { const y = 340 + i * 14; pipe(c, [[20, y], [200 + i * 20, y], [200 + i * 20, 320]], col, 3); txt(c, n, 12, y, P.fg2, 9); pipe(c, [[300 + i * 20, 320], [300 + i * 20, y], [480, y]], col, 3); });
      rr(c, 480, 330, 70, 70, 6, P.metal2, P.line); txt(c, L('ตู้ไฟ', 'Panel'), 515, 365, P.fg, 10);
      if (s.sol > 0) { rr(c, 560, 330, 46, 30, 3, '#2a4f7a'); txt(c, L('โซลาร์', 'Solar'), 583, 345, '#fff', 9); }
      // waveform panel
      const gx = 500, gy = 40, gw = 280, gh = 150; rr(c, gx, gy, gw, gh, 8, P.bg, P.line); const phi = Math.acos(s.pf);
      for (let k = 0; k < ph; k++) { const off = k * 2 * Math.PI / 3; const col = ['#8a5a2b', P.fg, '#888'][k]; c.beginPath(); for (let x = 0; x <= gw - 20; x += 2) { const a = x / (gw - 20) * 4 * Math.PI - t * 4 - off; const y = gy + gh / 2 - Math.sin(a) * 45; x ? c.lineTo(gx + 10 + x, y) : c.moveTo(gx + 10 + x, y); } c.strokeStyle = col; c.lineWidth = 2; c.stroke(); }
      const ia = clamp(s.kw / (ph === 1 ? 10 : 30), .05, 1); c.beginPath(); for (let x = 0; x <= gw - 20; x += 2) { const a = x / (gw - 20) * 4 * Math.PI - t * 4 - phi; const y = gy + gh / 2 - Math.sin(a) * 45 * ia; x ? c.lineTo(gx + 10 + x, y) : c.moveTo(gx + 10 + x, y); } c.strokeStyle = '#e5484d'; c.setLineDash([5, 3]); c.lineWidth = 2; c.stroke(); c.setLineDash([]);
      txt(c, ph === 1 ? L('แรงดัน v (ทึบ) กับกระแส i (ประ) · เฟสต่างกัน φ', 'Voltage v (solid) and current i (dashed) · phase shift φ') : L('3 เฟสห่างกัน 120° + กระแส L1 (ประ)', '3 phases 120° apart + L1 current (dashed)'), gx + gw / 2, gy + gh + 12, P.fg2, 10);
      // power bar
      txt(c, L(`ใช้ ${fmt(s.kw, 1)} kW · โซลาร์ ${fmt(s.sol, 1)} kW`, `Load ${fmt(s.kw, 1)} kW · solar ${fmt(s.sol, 1)} kW`), 640, 230, P.fg, 12);
      rr(c, 520, 245, 240, 14, 7, P.line); rr(c, 520, 245, 240 * clamp(s.kw / 30, 0, 1), 14, 7, '#e5484d'); rr(c, 520, 265, 240, 14, 7, P.line); rr(c, 520, 265, 240 * clamp(s.sol / 30, 0, 1), 14, 7, P.clean);
    }
  };
}

/* ===================== page content ===================== */
const REFS = {
  egat_tx: ['EGAT', 2025, 'Transmission system (500/230/115 kV)', 'https://www.egat.co.th/home/en?p=4386'],
  wb_loss: ['World Bank', 2024, 'Electric power transmission and distribution losses (% of output)', 'https://data.worldbank.org/indicator/EG.ELC.LOSS.ZS'],
  cigre_th: ['CIGRE', 2018, 'National power system: Thailand', 'https://www.cigre.org/userfiles/files/Community/NC/2018_National-power-system_Thailand.pdf'],
  maple: ['IEEE Spectrum', 2023, 'Space-based solar power: Caltech MAPLE demonstrates wireless power transfer in space', 'https://spectrum.ieee.org/space-based-solar-power'],
  j2954: ['Electrive', 2020, 'SAE introduces J2954 standard for wireless charging up to 11 kW', 'https://www.electrive.com/2020/10/24/sae-introduces-standard-for-wireless-charging-up-to-11-kw'],
  mcs: ['InsideEVs', 2022, 'CharIN officially launches the Megawatt Charging System (MCS)', 'https://insideevs.com/news/592360/megawatt-charging-system-mcs-launch/'],
  ltms: ['Keppel', 2022, 'Lao PDR, Thailand, Malaysia and Singapore commence cross-border power trade (LTMS-PIP)', 'https://www.keppel.com/media/lao-pdr-thailand-malaysia-and-singapore-commence-cross-border-power-trade'],
  pea_ami: ['Trilliant', 2022, 'Advanced metering infrastructure delivered for the Provincial Electricity Authority of Thailand', 'https://trilliant.com/partnership-between-trilliant-and-samart-telcoms-reaches-first-milestone-with-the-successful-delivery-of-advanced-metering-infrastructure-for-provincial-electricity-authority-in-thailand/'],
  hvdc: ['RIFS Potsdam (Kreusel, ABB)', 2014, 'HVDC: technology and losses (presentation)', 'https://www.rifs-potsdam.de/sites/default/files/files/kreusel_presentation.pdf'],
  spot_ng: ['National Grid', 2023, 'Spot the robot dog carries out safety inspections', 'https://www.nationalgrid.com/stories/grid-work-stories/spot-robot-dog-carries-out-safety-inspections'],
  dji_pl: ['DJI Enterprise', 2025, 'Powerline inspection solutions', 'https://enterprise.dji.com/it/inspection/powerline-inspection']
};
const MEDIA = [
  [P2('สายเหนือดิน AC', 'Overhead AC'), P2('ความร้อน I²R, corona (มากขึ้นตอนฝนตก), เสียงฮัม', 'I²R heat, corona (worse in rain), hum'), P2('ถูกที่สุด ซ่อมง่าย ไทยใช้ 500/230/115 kV', 'Cheapest and easy to repair; Thailand uses 500/230/115 kV'), P2('ฟ้าผ่า พายุ ต้นไม้ ไฟป่า ทัศนียภาพ', 'Lightning, storms, trees, wildfire, visual impact')],
  [P2('สายใต้ดิน AC', 'Underground AC'), P2('I²R, การสูญเสียในฉนวน, กระแสประจุสาย', 'I²R, dielectric loss, charging current'), P2('ในเมืองและสนามบิน ปลอดภัย ไม่บังวิว', 'Cities and airports: safe and out of sight'), P2('แพง 5–10 เท่า ระบายความร้อนยาก หาจุดเสียยาก ระยะ AC จำกัด', '5–10× the cost, hard to cool, faults hard to find, AC length limited')],
  [P2('สายใต้ทะเล', 'Subsea cable'), P2('เหมือนใต้ดิน กระแสประจุสายสูงกว่า', 'As underground, with higher charging current'), P2('เชื่อมเกาะ ฟาร์มลมนอกชายฝั่ง และระหว่างประเทศ', 'Islands, offshore wind and interconnectors'), P2('สมอเรือเกี่ยว ซ่อมต้องใช้เรือวางสาย AC ไกลไม่ได้ ต้อง HVDC', 'Anchor strikes; repairs need cable ships; long distances need HVDC')],
  [P2('HVDC', 'HVDC'), P2('I²R ต่ำกว่าเพราะไม่มี reactive power + สถานีแปลง ~0.7% ต่อสถานี', 'Lower I²R with no reactive power + ~0.7% per converter station'), P2('ส่งไกลมากและใต้ทะเล รวมระบบที่ความถี่ต่างกัน', 'Very long and subsea links; joins grids at different frequencies'), P2('สถานีแปลงแพง ต่อแยกกลางทางยาก', 'Costly converters; hard to tap mid-route')],
  [P2('ไร้สายระยะสั้น (เหนี่ยวนำ)', 'Short-range wireless (inductive)'), P2('สนามแม่เหล็กรั่ว ความร้อนในขดลวด ~7–10%', 'Stray field and coil heating, ~7–10%'), P2('ชาร์จรถจอดโดยไม่ต้องเสียบ รถเมล์ชาร์จที่ป้าย', 'Charging parked cars without plugs; buses at stops'), P2('ต้องจอดตรงตำแหน่ง ระยะห่างไม่กี่สิบ cm', 'Needs precise parking within tens of cm')],
  [P2('ไร้สายระยะไกล / จากอวกาศ', 'Long-range / space wireless'), P2('แปลงไฟเป็นคลื่นและกลับ + ลำคลื่นกระจาย', 'Converting to waves and back + beam spread'), P2('ดาวเทียมโซลาร์ส่งไฟได้ทั้งวันทั้งคืน', 'Solar satellites could deliver day and night'), P2('ยังทดลอง ประสิทธิภาพต่ำ ต้องใช้จานรับขนาดใหญ่มาก', 'Experimental, low efficiency, very large receivers')]
];
const KEEP = [
  [P2('ศูนย์ควบคุมระบบไฟฟ้า', 'National control centre'), P2('กฟผ. สั่งเดินเครื่องโรงไฟฟ้าทุกโรงตามความต้องการรายนาที ใช้ระบบ AGC ปรับกำลังอัตโนมัติ และเตรียมกำลังสำรองตามหลัก N-1 (ระบบต้องรับได้แม้อุปกรณ์ใหญ่ที่สุดเสียหนึ่งชิ้น)', 'EGAT dispatches every plant minute by minute, uses AGC to adjust output automatically, and holds reserve under N-1 (the grid must survive losing its largest single element)')],
  [P2('ควบคุมแรงดัน', 'Voltage control'), P2('ใช้ตัวเก็บประจุ รีแอกเตอร์ SVC/STATCOM และแท็ปหม้อแปลงรักษาแรงดันให้อยู่ในช่วง ±5–10% เพื่อไม่ให้อุปกรณ์เสียหายหรือระบบล่มแบบแรงดันตก', 'Capacitors, reactors, SVC/STATCOM and transformer taps hold voltage within about ±5–10% so equipment is safe and the grid avoids voltage collapse')],
  [P2('ป้องกันและแยกจุดเสีย', 'Protection and fault isolation'), P2('รีเลย์ตรวจลัดวงจรแล้วสั่งเบรกเกอร์ตัดภายในไม่กี่สิบมิลลิวินาที สายเหนือดินมีระบบต่อกลับอัตโนมัติ (auto-reclose) เพราะฟ้าผ่าส่วนใหญ่เป็นเหตุชั่วคราว', 'Relays detect faults and trip breakers within tens of milliseconds; overhead lines auto-reclose because most lightning faults are temporary')],
  [P2('บำรุงรักษา', 'Maintenance'), P2('ตัดต้นไม้ใต้แนวสาย ล้างลูกถ้วยฉนวน ทำงานขณะมีไฟ (hot-line) ใช้โดรนกล้องความร้อนและ LiDAR ตรวจสาย และหุ่นยนต์เดินตรวจสถานีย่อย', 'Tree trimming under lines, insulator washing, live-line (hot-line) work, thermal and LiDAR drones for lines and walking robots in substations'), ['dji_pl', 'spot_ng']],
  [P2('เพิ่ม / ลดกำลัง', 'Scaling up or down'), P2('วางแผนล่วงหน้า 10–20 ปีในแผน PDP และแผนขยายระบบส่ง เพิ่มวงจรหรือยกแรงดันสายเดิม ใช้การจัดอันดับสายตามสภาพอากาศจริง (dynamic line rating) แบตเตอรี่ช่วยเลื่อนการลงทุน และโหลดตอบสนอง (demand response) ลดพีก', 'Planned 10–20 years ahead in the PDP and transmission plans: add circuits or upgrade voltage, use dynamic line rating based on real weather, batteries to defer upgrades, and demand response to cut peaks')],
  [P2('เชื่อมกับประเทศเพื่อนบ้าน', 'Links with neighbours'), P2('ไทยซื้อไฟพลังน้ำจาก สปป.ลาว และเป็นทางผ่านโครงการ LTMS-PIP ที่ส่งไฟจากลาวผ่านไทยและมาเลเซียไปสิงคโปร์ตั้งแต่ปี 2022 เป็นก้าวแรกของ ASEAN Power Grid', 'Thailand buys Lao hydropower and is the transit route for LTMS-PIP, sending Lao power through Thailand and Malaysia to Singapore since 2022, a first step toward the ASEAN Power Grid'), ['ltms']]
];
const CHARGE = [
  [P2('ไม่ต้องอยู่ใกล้โรงไฟฟ้า', 'No need to be near a power plant'), P2('ไฟจากทุกโรงไหลรวมในโครงข่ายเดียวกัน จุดชาร์จจึงเลือกตามเส้นทางรถ ที่จอด และความจุของสถานีย่อยหรือหม้อแปลงในพื้นที่ ถ้าหม้อแปลงเต็มต้องขยายก่อน ซึ่งใช้เวลาหลายเดือน', 'Power from every plant mixes in one grid, so chargers are sited by traffic, parking and local substation or transformer capacity. If the transformer is full it must be upgraded first, which takes months')],
  [P2('ตามขนาดหัวชาร์จ', 'By charger size'), P2('AC ที่บ้าน 7 kW ใช้ไฟ 1 เฟส · AC 22 kW ใช้ 3 เฟส · DC 50–350 kW ต้องต่อแรงดันกลาง 22/33 kV พร้อมหม้อแปลง · รถบรรทุก MCS สูงสุด 3.75 MW ใกล้เคียงโรงงานขนาดกลาง · สถานีสลับแบตมอเตอร์ไซค์ใช้ไฟน้อยแต่ต่อเนื่อง', 'Home AC 7 kW on single-phase · 22 kW AC on three-phase · DC 50–350 kW needs a 22/33 kV connection and transformer · truck MCS up to 3.75 MW, like a mid-sized factory · motorcycle swap stations draw little but steadily'), ['mcs']],
  [P2('ลดภาระโครงข่าย', 'Easing the load on the grid'), P2('ติดโซลาร์และแบตเตอรี่ที่สถานีเพื่อตัดพีก จำกัดกำลังรวมแบบอัจฉริยะ (load management) ชาร์จรถเมล์ไฟฟ้าตอนกลางคืนที่อู่ และในอนาคตรถส่งไฟคืน (V2G)', 'Solar and batteries on site to shave peaks, smart load management, overnight charging at bus depots, and in future vehicle-to-grid (V2G)')],
  [P2('ชาร์จไร้สาย', 'Wireless charging'), P2('มาตรฐาน SAE J2954 สำหรับรถยนต์สูงสุด 11 kW ประสิทธิภาพราว 90% ใกล้เคียงการเสียบสาย สะดวกกับรถแท็กซี่และรถเมล์ที่จอดเป็นช่วงสั้น', 'SAE J2954 covers cars up to 11 kW at about 90% efficiency, close to plugging in; handy for taxis and buses that stop briefly'), ['j2954']]
];
const METER = [
  [P2('มิเตอร์จานหมุน', 'Rotating-disc meter'), P2('ขดลวดแรงดันและขดลวดกระแสสร้างสนามแม่เหล็กเหนี่ยวนำกระแสวนในจานอะลูมิเนียม แรงบิดแปรตาม V·I·cos φ แม่เหล็กเบรกทำให้ความเร็วจานแปรตามกำลัง ชุดเฟืองนับรอบเป็น kWh (เช่น 600 รอบต่อ 1 หน่วย) ทนทาน ไม่ต้องใช้ไฟเลี้ยง แต่วัดทางเดียวและต้องจดเลขด้วยคน', 'Voltage and current coils induce eddy currents in an aluminium disc; torque follows V·I·cos φ and a brake magnet makes speed track power. Gears count turns as kWh (e.g. 600 turns per unit). Rugged and needs no supply of its own, but measures one way and must be read by hand')],
  [P2('มิเตอร์ดิจิทัล / สมาร์ทมิเตอร์', 'Digital / smart meter'), P2('วัดแรงดันด้วยวงจรแบ่งแรงดัน วัดกระแสด้วย shunt หรือ CT ชิปสุ่มวัดหลายพันครั้งต่อวินาที คูณ v×i แล้วรวมเป็นพลังงาน วัดได้ทั้งกำลังจริง รีแอกทีฟ ซื้อและขายไฟโซลาร์ เก็บค่าตามช่วงเวลา (TOU) และส่งข้อมูลระยะไกล (AMI) แจ้งไฟดับหรือการงัดแงะได้', 'A divider measures voltage and a shunt or CT measures current; a chip samples thousands of times a second, multiplies v×i and sums energy. It records real and reactive power, solar import/export and time-of-use data, and reports remotely (AMI), including outages and tampering'), ['pea_ami']],
  [P2('1 เฟส กับ 3 เฟส', 'Single-phase vs three-phase'), P2('1 เฟส: สาย L + N 230 V ขนาดมิเตอร์ เช่น 5(15) A, 15(45) A, 30(100) A · 3 เฟส: สาย L1 L2 L3 + N 400 V วัดกำลังแต่ละเฟสแล้วรวมกัน (P = √3·V·I·cos φ เมื่อสมดุล) ส่งกำลังมากได้โดยกระแสต่อเส้นน้อยลง โหลดใหญ่มากใช้มิเตอร์ต่อผ่านหม้อแปลงกระแส (CT)', 'Single-phase: L + N at 230 V with meter sizes such as 5(15) A, 15(45) A, 30(100) A · Three-phase: L1 L2 L3 + N at 400 V, measuring each phase and summing (P = √3·V·I·cos φ when balanced), carrying more power with less current per wire; very large loads use CT-connected meters')]
];
const refLink = k => { const r = REFS[k]; return r ? `<a href="${esc(r[3])}" target="_blank" rel="noopener">${esc(r[0])} (${r[1]}) ${esc(r[2])}</a>` : ''; };
const cards = arr => `<div class="resg">${arr.map(x => `<div class="box"><b>${esc(tx(x[0]))}</b><p>${esc(tx(x[1]))}</p>${x[2] ? `<p class="note">${x[2].map(refLink).join('<br>')}</p>` : ''}</div>`).join('')}</div>`;

let unm = [];
function render(app) {
  unm.forEach(f => f()); unm = [];
  document.title = 'Grid Lab · Power Plant Lab';
  app.innerHTML = `<div class="sf">
   <header><div class="eyebrow">Clean Energy Lab · Grid Lab</div><h1>${L('ส่งไฟจากโรงไฟฟ้าถึงปลั๊กและหัวชาร์จ', 'Getting power from the plant to the plug and charger')}</h1>
   <p>${L('ไฟฟ้าต้องเปลี่ยนแรงดันหลายครั้งระหว่างทาง สูญเสียไปเป็นความร้อนบางส่วน และต้องผลิตให้เท่ากับที่ใช้ทุกวินาที ลองปรับสายส่ง แรงดัน ระยะทาง หัวชาร์จ และดูว่ามิเตอร์ที่บ้านนับหน่วยไฟอย่างไร', 'Electricity changes voltage several times on the way, loses some energy as heat, and must be produced in step with use every second. Try different lines, voltages, distances and chargers, and see how the meter at home counts units')}</p></header>
   <section><h3>${L('1. เส้นทางไฟ: แปลงแรงดันและการสูญเสียแต่ละช่วง', '1. The power path: voltage steps and losses')}</h3><div id="g1"></div></section>
   <section><h3>${L('สายส่งแต่ละแบบสูญเสียจากอะไร', 'What each kind of line loses energy to')}</h3><div class="compwrap"><table class="comp"><thead><tr><th>${L('แบบ', 'Type')}</th><th>${L('สูญเสียจาก', 'Losses')}</th><th>${L('ใช้เมื่อ', 'Used for')}</th><th>${L('ข้อจำกัด', 'Limits')}</th></tr></thead><tbody>${MEDIA.map(r => `<tr>${r.map(x => `<td>${esc(tx(x))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="note">${L('ไม่ใช่ข้อมูลเฉพาะของไทย: การสูญเสียในระบบส่งและจำหน่ายรวมกันของหลายประเทศอยู่ราว 5–8% ดูตัวเลขของแต่ละประเทศได้ที่ข้อมูลธนาคารโลก', 'Not Thailand-specific: combined transmission and distribution losses are around 5–8% in many countries; see World Bank data for each country')} · ${refLink('wb_loss')}</p></section>
   <section><h3>${L('2. สมดุล 50 Hz: เมื่อโรงไฟฟ้าหยุดกะทันหัน และเมื่อรถ EV ชาร์จพร้อมกัน', '2. Keeping 50 Hz: when a plant trips and when EVs all charge at once')}</h3><div id="g2"></div></section>
   <section><h3>${L('ดูแลโครงข่ายให้เสถียร และขยายหรือลดได้อย่างไร', 'Keeping the grid stable, and how it grows or shrinks')}</h3>${cards(KEEP)}</section>
   <section><h3>${L('จุดชาร์จรถไฟฟ้ากับโครงข่าย', 'EV charging and the grid')}</h3>${cards(CHARGE)}</section>
   <section><h3>${L('3. มิเตอร์ไฟฟ้า: จานหมุนกับดิจิทัล 1 เฟสและ 3 เฟส', '3. Electricity meters: rotating disc vs digital, single- and three-phase')}</h3><div id="g3"></div>${cards(METER)}</section>
   <section><h3>${L('แหล่งอ้างอิง', 'References')}</h3><ol class="refs">${Object.keys(REFS).map(k => `<li>${refLink(k)}</li>`).join('')}</ol></section>
   <p class="note">${L('แบบจำลองอย่างง่ายเพื่อการเรียนรู้ ค่าความต้านทานสาย ประสิทธิภาพ และขนาดระบบเป็นค่าประมาณ ไม่ใช่ข้อมูลโครงข่ายจริงของไทย', 'A simplified teaching model: line resistance, efficiencies and system size are estimates, not real Thai grid data')}</p></div>`;
  unm.push(LabSim.mount(document.getElementById('g1'), pathSim()));
  unm.push(LabSim.mount(document.getElementById('g2'), freqSim()));
  unm.push(LabSim.mount(document.getElementById('g3'), meterSim()));
  return () => { unm.forEach(f => f()); unm = []; };
}
window.GridLab = { render };
})();

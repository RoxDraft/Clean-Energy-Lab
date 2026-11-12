/* Clean Energy Lab · Origin (กำเนิด)
   แหล่งพลังงานแต่ละแบบเกิดขึ้นอย่างไร เปลี่ยนแปลงอย่างไร และสลายหรือหมดไปอย่างไร
   แบบจำลองอย่างง่ายเพื่อการเรียนรู้ ความลึก อุณหภูมิ และเวลาเป็นค่าประมาณ */
(function () {
'use strict';
const { W, H, clamp, lerp, rr, txt } = LabSim.H;
const EN = () => document.documentElement.lang === 'en';
const tx = o => o && typeof o === 'object' && !Array.isArray(o) ? (EN() ? o.en : o.th) : (o == null ? '' : String(o));
const P2 = (th, en) => ({ th, en });
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixc = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };
const fmt = (v, d = 0) => (isFinite(v) ? v : 0).toLocaleString(EN() ? 'en-US' : 'th-TH', { maximumFractionDigits: d, minimumFractionDigits: d });

function stageOf(st, p) { let i = st.findIndex(s => p >= s[0] && p < s[1]); return i < 0 ? st.length - 1 : i; }
function pill(c, t, x, y, P, fg) { c.font = '600 12px "IBM Plex Sans Thai",system-ui,sans-serif'; const w = c.measureText(t).width + 16; rr(c, x, y - 11, w, 22, 11, P.dark ? 'rgba(17,24,22,.86)' : 'rgba(255,255,255,.92)'); txt(c, t, x + 8, y, fg || P.fg, 12, 'left'); }
function gauges(c, P, arr) { let x = W - 10; c.font = '600 12px "IBM Plex Sans Thai",system-ui,sans-serif'; for (let i = arr.length - 1; i >= 0; i--) { const [k, v] = arr[i]; const w = Math.max(c.measureText(k).width, c.measureText(v).width) + 18; x -= w; rr(c, x, 8, w, 40, 8, P.dark ? 'rgba(17,24,22,.86)' : 'rgba(255,255,255,.92)'); txt(c, k, x + 9, 19, P.muted, 10.5, 'left'); txt(c, v, x + 9, 36, P.fg, 13, 'left'); x -= 6; } }
function stageBanner(c, P, st, p) { const i = stageOf(st, p); const t = `${L('ขั้นที่', 'Step')} ${i + 1}/${st.length} · ${tx(st[i][2])}`; c.font = '700 13px "IBM Plex Sans Thai",system-ui,sans-serif'; const w = c.measureText(t).width + 20; rr(c, 10, 8, w, 26, 13, P.fg); txt(c, t, 20, 21, P.bg, 13, 'left'); }
const autoStep = (s, dt, sec) => { if (s.auto) { s.p += dt / sec * 100; if (s.p > 104) s.p = 0; } };
const timeCtl = (lab) => [{ id: 'p', label: lab || L('เวลา (เลื่อนเพื่อดูแต่ละขั้น)', 'Time (drag to step through)'), min: 0, max: 100, step: .1, val: 0, unit: '%' }, { id: 'auto', type: 'toggle', label: L('เล่นต่อเนื่อง', 'Play continuously'), val: true }];

/* =============== coal: swamp → peat → burial → rank → uplift & weathering =============== */
const COAL_ST = [
  [0, .15, P2('ป่าพรุ', 'Swamp forest'), P2('ยุคคาร์บอนิเฟอรัส (359–299 ล้านปีก่อน) มีป่าพรุน้ำจืดกว้างใหญ่ ต้นไม้ตระกูลเฟิร์นและหางม้ายักษ์ขึ้นในน้ำขัง', 'In the Carboniferous (359–299 million years ago) vast freshwater swamps held giant fern and horsetail trees standing in water')],
  [.15, .3, P2('สะสมเป็นพีต', 'Peat builds up'), P2('ต้นไม้ล้มลงในน้ำที่ขาดออกซิเจน จุลินทรีย์ย่อยได้ไม่หมด ซากพืชจึงทับถมเป็นพีต หนาขึ้นไม่กี่มิลลิเมตรต่อปี', 'Trees fall into oxygen-poor water where microbes cannot finish decay, so plant debris piles up as peat a few millimetres a year')],
  [.3, .55, P2('ตะกอนทับถม', 'Burial'), P2('ทะเลหรือแม่น้ำพาทรายและโคลนมาทับ ชั้นพีตถูกฝังลึกและถูกกดให้บางลง พีตหนา 10 เมตรเหลือถ่านหินราว 1 เมตร', 'Sea or river sediment covers the peat, burying and squeezing it; about 10 m of peat becomes roughly 1 m of coal')],
  [.55, .78, P2('ความร้อนเปลี่ยนชั้นถ่าน', 'Heat raises the rank'), P2('ยิ่งลึกยิ่งร้อน น้ำและก๊าซถูกไล่ออก คาร์บอนเข้มข้นขึ้น จากพีตเป็นลิกไนต์ ซับบิทูมินัส บิทูมินัส และแอนทราไซต์ (กฎของฮิลต์: ยิ่งลึกชั้นถ่านยิ่งสูง)', 'Deeper means hotter; water and gas are driven off and carbon concentrates: peat → lignite → sub-bituminous → bituminous → anthracite (Hilt\'s law: rank rises with depth)')],
  [.78, 1.01, P2('ยกตัว ผุพัง และสลาย', 'Uplift, weathering and breakdown'), P2('แผ่นเปลือกโลกยกชั้นหินขึ้นและเอียง การกัดเซาะเปิดชั้นถ่านถึงผิวดิน ออกซิเจนทำให้ถ่านผุ และบางแห่งลุกไหม้เองได้ เมื่อเราขุดมาเผา คาร์บอนที่สะสมนับล้านปีกลับเป็น CO₂ ในไม่กี่วินาที', 'Tectonics lift and tilt the layers, erosion exposes the seam, oxygen weathers it and some outcrops self-ignite. When we mine and burn coal, carbon stored for millions of years returns to CO₂ in seconds')]];
const RANK = [[0, P2('พีต', 'Peat'), '#6b4a2b', 50], [.25, P2('ลิกไนต์', 'Lignite'), '#4d3825', 65], [.5, P2('ซับบิทูมินัส', 'Sub-bituminous'), '#33291f', 73], [.75, P2('บิทูมินัส', 'Bituminous'), '#1f1c1b', 82], [1, P2('แอนทราไซต์', 'Anthracite'), '#101117', 92]];
function rankAt(k) { for (let i = RANK.length - 1; i >= 0; i--) if (k >= RANK[i][0]) { const a = RANK[i], b = RANK[Math.min(i + 1, RANK.length - 1)], t = b === a ? 0 : (k - a[0]) / (b[0] - a[0]); return { name: tx(a[1]), col: mixc(a[2], b[2], t), C: lerp(a[3], b[3], t) }; } }
function coalState(s) { const p = s.p / 100; const bury = lerp(0, 120, seg(p, .3, .55)) + lerp(0, 150, seg(p, .55, .78)); const up = seg(p, .8, 1); const d = bury * (1 - .78 * up); const tilt = .5 * up; const th = lerp(6, 56, seg(p, .1, .3)) * lerp(1, .28, seg(p, .3, .78)); return { p, d, tilt, th, maxD: bury, rank: rankAt(seg(p, .45, .78)) }; }
function coalSim() {
  const S = 150;
  return {
    controls: timeCtl(), init() {}, step(s, dt) { autoStep(s, dt, 26); },
    metrics(s) { const k = coalState(s), km = k.maxD / 55, i = stageOf(COAL_ST, k.p);
      return [[L('ขั้นตอน', 'Stage'), tx(COAL_ST[i][2])], [L('เวลาที่ผ่านไป', 'Time elapsed'), L(`~${fmt(k.p * 70)} ล้านปี`, `~${fmt(k.p * 70)} million years`)], [L('ความลึกสูงสุด', 'Deepest burial'), `${fmt(km, 1)} km`], [L('อุณหภูมิสูงสุด', 'Peak temperature'), `${fmt(20 + 28 * km)} °C`], [L('ชนิดถ่าน / คาร์บอน', 'Rank / carbon'), `${k.rank.name} · ~${fmt(k.rank.C)}%`], [L('เกิดอะไรขึ้น', 'What happens'), tx(COAL_ST[i][3])]]; },
    spots: [
      { at: (s) => [120, coalState(s).p < .3 ? 120 : 140], k: 'm', t: () => L('ต้นไม้ยุคถ่านหิน', 'Coal-age trees'), d: () => L('Lepidodendron และ Sigillaria สูงได้ 30–40 เมตร ลำต้นมีลิกนินมาก ซึ่งย่อยยาก งานวิจัย Floudas et al. (2012) เสนอว่าราที่ย่อยลิกนินยังไม่วิวัฒน์ แต่ Nelsen et al. (2016) แย้งว่าเหตุหลักคือภูมิอากาศชื้นและแอ่งที่ทรุดตัวขณะประกอบเป็นมหาทวีปแพนเจีย', 'Lepidodendron and Sigillaria grew 30–40 m tall with lignin-rich trunks that resist decay. Floudas et al. (2012) proposed lignin-digesting fungi had not yet evolved; Nelsen et al. (2016) argued the main causes were a wet climate and basins sinking as Pangea assembled') },
      { at: (s) => { const k = coalState(s); return [560, Math.min(H - 20, S + k.d + 400 * k.tilt * 0 + k.th / 2)]; }, k: 'm', t: s => coalState(s).rank.name, d: () => L('ชั้นถ่านหินที่กำลังถูกบ่ม ยิ่งชั้นสูง ยิ่งมีคาร์บอนมาก ความชื้นน้อย และให้ความร้อนต่อกิโลกรัมสูงขึ้น ถ่านหินลิกไนต์แม่เมาะของไทยอายุราว 10–20 ล้านปี จึงยังเป็นชั้นต่ำ', 'The seam being cooked. Higher rank means more carbon, less moisture and more heat per kilogram. Thailand\'s Mae Moh lignite is only about 10–20 million years old, so it is still low rank') },
      { x: 700, y: 400, k: 'm', t: () => L('ความร้อนใต้พิภพ', 'Heat from below'), d: () => L('อุณหภูมิเพิ่มราว 25–30 °C ทุก 1 กิโลเมตร ความร้อนนี้มาจากการสลายของธาตุกัมมันตรังสีในหินและความร้อนตั้งแต่โลกเกิด', 'Temperature rises about 25–30 °C per kilometre; the heat comes from radioactive decay in rocks and heat left from Earth\'s formation') }
    ],
    draw(c, s, t, P) {
      const k = coalState(s), p = k.p, D = P.dark;
      const sky = c.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, P.sky[0]); sky.addColorStop(1, P.sky[1]); c.fillStyle = sky; c.fillRect(0, 0, W, S);
      const g = c.createLinearGradient(0, S, 0, H); g.addColorStop(0, D ? '#3b3a30' : '#c9b893'); g.addColorStop(1, mixc(D ? '#3b3a30' : '#c9b893', '#a3462c', .2 + .5 * seg(p, .5, .78) * (1 - .6 * seg(p, .8, 1)))); c.fillStyle = g; c.fillRect(0, S, W, H - S);
      const top = x => S + k.d - k.tilt * (x - 160);
      c.save(); c.beginPath(); c.rect(0, S, W, H - S); c.clip();
      // overburden stripes parallel to seam
      for (let i = 13; i >= 0; i--) { c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, top(x) - (i + 1) * 22); for (let x = W; x >= 0; x -= 20) c.lineTo(x, top(x) - i * 22); c.closePath(); c.fillStyle = i % 2 ? (D ? '#5a5444' : '#d8c9a3') : (D ? '#4a4a40' : '#b9ab88'); c.fill(); }
      // seam
      c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, top(x)); for (let x = W; x >= 0; x -= 20) c.lineTo(x, top(x) + k.th); c.closePath(); c.fillStyle = k.rank.col; c.fill();
      if (p < .35) for (let i = 0; i < 36; i++) { const x = hash(i) * W, y = top(x) + hash(i + 9) * k.th; c.strokeStyle = D ? '#8a6b45' : '#7d5a33'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 16 * hash(i + 3) + 5, y + 3 * hash(i + 5) - 1.5); c.stroke(); }
      // rock below
      c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, top(x) + k.th); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fillStyle = D ? '#2b2e2c' : '#8f8a7c'; c.fill();
      c.restore();
      // surface scene
      const grow = seg(p, 0, .12), fall = seg(p, .15, .28), flood = seg(p, .28, .4) * (1 - seg(p, .78, .86));
      if (p < .45) for (let i = 0; i < 8; i++) { const x = 40 + i * 100 + hash(i) * 30, h = lerp(10, 110, grow) * (.7 + .4 * hash(i + 2)); const a = fall * (hash(i + 7) > .5 ? 1 : -1) * 1.45 * (hash(i + 5) > .25 ? 1 : 0); c.save(); c.translate(x, S); c.rotate(a); c.strokeStyle = D ? '#7f8a52' : '#5e6b35'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -h); c.stroke(); c.fillStyle = D ? '#8fae5a' : '#6f8f3a'; for (let q = 0; q < 5; q++) { c.beginPath(); c.ellipse(0, -h + q * 6, 20 - q * 2, 5, (q % 2 ? .5 : -.5), 0, 7); c.fill(); } c.restore(); }
      const wl = lerp(5, 42, flood); if (wl > 1) { c.fillStyle = D ? 'rgba(70,130,160,.55)' : 'rgba(80,140,170,.45)'; c.fillRect(0, S - wl, W, wl); }
      if (p > .3 && p < .6) for (let i = 0; i < 60; i++) { const x = hash(i + 60) * W, y = S - wl + ((t * 30 + hash(i) * wl * 3) % (wl + 4)); c.fillStyle = D ? '#c9b37f' : '#a68a52'; c.fillRect(x, y, 2, 2); }
      if (p > .78) { // modern land, outcrop weathering, smoke, mine
        c.fillStyle = D ? '#4b5a3a' : '#9fb07a'; c.fillRect(0, S - 4, W, 4);
        let ox = null; for (let x = 0; x <= W; x += 4) { if (top(x) <= S + 2 && top(x) + k.th >= S) { ox = x; break; } }
        if (ox != null) { c.fillStyle = 'rgba(190,90,40,.55)'; c.fillRect(ox - 10, S - 2, 60, 8); for (let i = 0; i < 8; i++) { const f = (t * .4 + i / 8) % 1; c.fillStyle = `rgba(130,130,130,${.5 * (1 - f)})`; c.beginPath(); c.arc(ox + 20 + Math.sin(i + t) * 8, S - 8 - f * 70, 6 + f * 14, 0, 7); c.fill(); } pill(c, L('ชั้นถ่านโผล่และผุ', 'Exposed seam weathers'), ox + 50, S - 22, P); }
        c.strokeStyle = P.fg; c.lineWidth = 2; c.beginPath(); c.moveTo(560, S - 2); c.lineTo(580, S - 46); c.lineTo(600, S - 2); c.moveTo(580, S - 46); c.lineTo(580, Math.min(H - 10, top(580) + k.th / 2)); c.stroke(); txt(c, L('เหมือง', 'Mine'), 610, S - 30, P.fg, 12, 'left');
      }
      if (p > .3 && p < .8) { c.globalAlpha = seg(p, .3, .4); for (let i = 0; i < 5; i++) { const x = 100 + i * 150, y1 = top(x) - 36; if (y1 > S + 6) { c.strokeStyle = P.fg; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y1); c.lineTo(x, y1 + 24); c.lineTo(x - 5, y1 + 17); c.moveTo(x, y1 + 24); c.lineTo(x + 5, y1 + 17); c.stroke(); } } c.globalAlpha = 1; }
      if (k.th > 6) pill(c, `${k.rank.name} · C ~${fmt(k.rank.C)}%`, 14, Math.max(S + 14, Math.min(H - 14, top(14) + k.th / 2)), P);
      stageBanner(c, P, COAL_ST, p);
      const km = k.d / 55; gauges(c, P, [[L('ความลึก', 'Depth'), `${fmt(km, 1)} km`], [L('อุณหภูมิ', 'Temp'), `${fmt(20 + 28 * km)} °C`]]);
    }
  };
}

/* =============== oil & gas: plankton → source rock → window → trap → seep & biodegrade =============== */
const PETRO_ST = gas => [
  [0, .14, P2('แพลงก์ตอนบาน', 'Plankton bloom'), gas ? P2('ก๊าซส่วนใหญ่เริ่มจากสาหร่ายและแพลงก์ตอนเช่นเดียวกับน้ำมัน หรือจากซากพืชบนบก ก๊าซอีกส่วนหนึ่งเกิดจากจุลินทรีย์ที่ผลิตมีเทนในตะกอนตื้น (ก๊าซชีวภาพ)', 'Most gas starts, like oil, from algae and plankton or from land plants; some is made by methane-producing microbes in shallow sediment (biogenic gas)') : P2('ทะเลอุ่นและตื้น เช่นยุคจูแรสซิก–ครีเทเชียส แพลงก์ตอนพืชและสาหร่ายเซลล์เดียวเติบโตมหาศาลใกล้ผิวน้ำ', 'Warm shallow seas, as in the Jurassic–Cretaceous, grow huge blooms of phytoplankton and single-celled algae')],
  [.14, .26, P2('จมสู่ก้นทะเลที่ขาดออกซิเจน', 'Sinking to an oxygen-poor seabed'), P2('ซากจมลงก้นทะเลที่ขาดออกซิเจน จึงไม่เน่าหมด กลายเป็นโคลนดำที่มีสารอินทรีย์สูง (Demaison & Moore, 1980)', 'Remains sink to an oxygen-poor seabed and escape decay, forming black organic-rich mud (Demaison & Moore, 1980)')],
  [.26, .42, P2('เป็นหินต้นกำเนิด', 'Source rock forms'), P2('ตะกอนทับถมจนโคลนกลายเป็นหินดินดาน สารอินทรีย์เปลี่ยนเป็นเคโรเจน ทรายด้านบนเป็นหินทรายมีรูพรุน และโคลนชั้นบนเป็นหินปิด', 'Burial turns the mud into shale and its organic matter into kerogen; sand above becomes porous sandstone and mud above that becomes a seal')],
  [.42, .6, gas ? P2('บ่มในหน้าต่างก๊าซ', 'Cooking in the gas window') : P2('บ่มในหน้าต่างน้ำมัน', 'Cooking in the oil window'), P2('ลึก 2–4 กม. ราว 60–120 °C เคโรเจนแตกตัวเป็นน้ำมัน ลึกและร้อนกว่านั้น (ราว 120–200 °C) น้ำมันและเคโรเจนแตกเป็นก๊าซ (Tissot & Welte)', 'At 2–4 km and about 60–120 °C kerogen cracks to oil; deeper and hotter (about 120–200 °C) oil and kerogen crack to gas (Tissot & Welte)')],
  [.6, .8, P2('ไหลขึ้นและติดกับดัก', 'Migration and trapping'), P2('น้ำมันและก๊าซเบากว่าน้ำ จึงซึมขึ้นผ่านหินทรายจนติดใต้หินปิดตรงโครงสร้างรูปโดม ก๊าซอยู่บน น้ำมันอยู่กลาง น้ำอยู่ล่าง', 'Lighter than water, oil and gas rise through the sandstone until a dome of sealing rock traps them: gas on top, oil in the middle, water below')],
  [.8, 1.01, P2('รั่วซึมและถูกย่อยสลาย', 'Leakage and breakdown'), P2('รอยเลื่อนทำให้หินปิดแตก น้ำมันและก๊าซซึมขึ้นผิวดินหรือก้นทะเล จุลินทรีย์กินส่วนที่เบา เหลือน้ำมันหนักและยางมะตอย ก๊าซมีเทนถูกจุลินทรีย์และอากาศออกซิไดซ์เป็น CO₂ ถ้าเราเจาะมาเผา ก็กลับเป็น CO₂ เช่นกัน', 'A fault breaks the seal; oil and gas seep to the surface or seabed. Microbes eat the light fractions, leaving heavy oil and tar, and methane is oxidised to CO₂ by microbes and air. Burning it does the same, only faster')]];
function petroState(s, gas) { const p = s.p / 100; const d = lerp(0, 140, seg(p, .26, .42)) + lerp(0, gas ? 150 : 100, seg(p, .42, .6)); const A = lerp(0, 75, seg(p, .6, .72)); const leak = seg(p, .82, 1); return { p, d, A, leak, km: d / 60 }; }
function petroSim(gas) {
  const S = 160, ST = PETRO_ST(gas);
  return {
    controls: timeCtl(), init() {}, step(s, dt) { autoStep(s, dt, 30); },
    metrics(s) { const k = petroState(s, gas), i = stageOf(ST, k.p), T = 20 + 30 * k.km;
      return [[L('ขั้นตอน', 'Stage'), tx(ST[i][2])], [L('เวลาที่ผ่านไป', 'Time elapsed'), L(`~${fmt(k.p * 120)} ล้านปี`, `~${fmt(k.p * 120)} million years`)], [L('ความลึกหินต้นกำเนิด', 'Source rock depth'), `${fmt(k.km, 1)} km`], [L('อุณหภูมิ', 'Temperature'), `${fmt(T)} °C · ${T < 60 ? L('ยังไม่สุก', 'immature') : T < 120 ? L('หน้าต่างน้ำมัน', 'oil window') : T < 200 ? L('หน้าต่างก๊าซ', 'gas window') : L('สุกเกิน', 'overmature')}`], [L('เกิดอะไรขึ้น', 'What happens'), tx(ST[i][3])]]; },
    spots: [
      { x: 160, y: 80, k: 'm', t: () => L('แพลงก์ตอนพืช', 'Phytoplankton'), d: () => L('หลักฐานว่าน้ำมันมาจากสิ่งมีชีวิต: Alfred Treibs (1936) พบสาร porphyrin ในน้ำมันดิบ ซึ่งมีโครงสร้างเดียวกับคลอโรฟิลล์ ปัจจุบันนักธรณีเคมีใช้สาร biomarker ระบุได้ว่าน้ำมันแต่ละแหล่งมาจากสิ่งมีชีวิตกลุ่มไหน', 'Evidence that oil comes from life: Alfred Treibs (1936) found porphyrins in crude oil with the same structure as chlorophyll. Today geochemists use biomarkers to tell which organisms each oil came from') },
      { at: s => { const k = petroState(s, gas); return [230, Math.min(H - 16, S + k.d + 12 - k.A * Math.exp(-(((230 - 420) / 200) ** 2)))]; }, k: 'm', t: () => L('หินต้นกำเนิด', 'Source rock'), d: () => L('Klemme & Ulmishek (1991) พบว่าหินต้นกำเนิดเพียง 6 ช่วงอายุให้น้ำมันและก๊าซกว่า 90% ของที่ค้นพบ โดยยุคจูแรสซิกตอนปลาย 25% และครีเทเชียสตอนกลาง 29% ซึ่งตรงกับยุคไดโนเสาร์ แต่ตัวน้ำมันมาจากแพลงก์ตอน ไม่ใช่ไดโนเสาร์', 'Klemme & Ulmishek (1991) found six source-rock intervals yielded over 90% of discovered oil and gas, with the Upper Jurassic at 25% and middle Cretaceous at 29%, the age of dinosaurs. The oil itself came from plankton, not dinosaurs') },
      { x: 420, y: 330, k: 'm', t: () => L('กับดักปิโตรเลียม', 'Petroleum trap'), d: () => L('ต้องมีครบ 4 อย่าง: หินต้นกำเนิด หินกักเก็บ หินปิด และโครงสร้างกับดักที่เกิดก่อนน้ำมันเคลื่อนมา ตัวอย่างแปลก: แหล่ง Cantarell ในเม็กซิโก หินกักเก็บเป็นหินกรวดที่เกิดจากการชนของอุกกาบาต Chicxulub เมื่อ 66 ล้านปีก่อน (Grajales-Nishimura et al., 2000)', 'It needs four things: source, reservoir, seal and a trap that formed before the oil arrived. An unusual case: Mexico\'s Cantarell field sits in breccia created by the Chicxulub impact 66 million years ago (Grajales-Nishimura et al., 2000)') },
      { x: 600, y: 150, k: 'm', t: () => L('จุดรั่วซึม', 'Seep'), d: () => L('น้ำมันที่ซึมขึ้นผิวดินคือที่มาของยางมะตอยที่คนโบราณใช้ แหล่งทรายน้ำมันขนาดใหญ่ของแคนาดาคือน้ำมันที่ถูกจุลินทรีย์ย่อยจนข้นหนืด ก๊าซที่ซึมขึ้นก้นทะเลส่วนมากถูกจุลินทรีย์กินก่อนถึงผิวน้ำ', 'Seeping oil gave ancient people bitumen. Canada\'s oil sands are oil that microbes degraded into a thick tar. Most gas seeping from the seabed is eaten by microbes before it reaches the surface') }
    ],
    draw(c, s, t, P) {
      const k = petroState(s, gas), p = k.p, D = P.dark;
      const fold = x => -k.A * Math.exp(-(((x - 420) / 200) ** 2));
      const sea = 1 - seg(p, .74, .84);
      c.fillStyle = P.sky[1]; c.fillRect(0, 0, W, S);
      if (sea > 0) { c.fillStyle = D ? `rgba(40,90,120,${.85 * sea})` : `rgba(60,130,170,${.7 * sea})`; c.fillRect(0, 40, W, S - 40);
        const bloom = seg(p, 0, .1) * (1 - seg(p, .24, .34)); for (let i = 0; i < 150 * bloom; i++) { const sink = seg(p, .12, .25); const x = (hash(i) * W + Math.sin(t + i) * 6 + W) % W, y = lerp(48 + hash(i + 3) * 46, S - 4, clamp(sink * (.6 + hash(i + 5)), 0, 1)); c.fillStyle = sink > .2 ? (D ? '#2d2a20' : '#3e3a2a') : (D ? '#8fcf7a' : '#4f9a4a'); c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); } }
      if (sea < 1) { c.fillStyle = D ? '#4b5a3a' : '#9fb07a'; c.fillRect(0, S - 5, W, 5); }
      const src = x => S + k.d + fold(x) + (x > 600 ? 26 * k.leak : 0);
      const L4 = [{ top: x => src(x) + 28, col: D ? '#2c302d' : '#8e897b' }, { top: src, col: D ? '#22201c' : '#3b3529', n: L('หินต้นกำเนิด', 'Source rock') }, { top: x => src(x) - 40, col: D ? '#7d6a3e' : '#d9be7a', n: L('หินกักเก็บ (หินทราย)', 'Reservoir (sandstone)'), dots: 1 }, { top: x => src(x) - 68, col: D ? '#4b5560' : '#8d98a0', n: L('หินปิด', 'Seal') }];
      for (let i = 0; i < 9; i++) L4.push({ top: x => src(x) - 68 - (i + 1) * 24, col: i % 2 ? (D ? '#55503f' : '#c8b98f') : (D ? '#4a4a3e' : '#b5a986') });
      c.save(); c.beginPath(); c.rect(0, S, W, H - S); c.clip();
      for (let j = L4.length - 1; j >= 0; j--) { const a = L4[j].top, b = j === 0 ? null : L4[j - 1].top; c.beginPath(); for (let x = 0; x <= W; x += 10) c.lineTo(x, a(x)); for (let x = W; x >= 0; x -= 10) c.lineTo(x, b ? b(x) : H); c.closePath(); c.fillStyle = L4[j].col; c.fill(); if (L4[j].dots) { c.save(); c.clip(); c.fillStyle = D ? 'rgba(255,240,200,.18)' : 'rgba(120,90,30,.25)'; for (let i = 0; i < 220; i++) { const x = hash(i + 300) * W; c.fillRect(x, a(x) + hash(i + 301) * 40, 2, 2); } c.restore(); } }
      if (p > .14 && p < .27) { c.fillStyle = D ? '#22201c' : '#3b3529'; c.fillRect(0, S, W, lerp(0, 26, seg(p, .14, .25))); }
      // generation & migration
      const gen = seg(p, .44, .58), gasF = gas ? .35 + .5 * seg(p, .48, .6) : clamp((k.d - 190) / 70, 0, .45), mig = seg(p, .62, .78);
      const cap = x => src(x) - 40, crestX = 420;
      for (let i = 0; i < 64 * gen; i++) { const sx = hash(i + 500) * W, sy = src(sx) + 5 + hash(i + 501) * 18, isG = hash(i + 502) < gasF; const tx2 = crestX + (hash(i + 503) - .5) * 200, ty = cap(tx2) + 5 + hash(i + 504) * 18; const m = clamp(mig * 1.4 - hash(i + 505) * .4, 0, 1); if (mig >= .98) continue; const x = lerp(sx, tx2, m), y = lerp(sy, ty, m); c.fillStyle = isG ? '#f4f6ff' : (D ? '#e3a03c' : '#b8700f'); c.beginPath(); c.arc(x, y, isG ? 3.2 : 2.8, 0, 7); c.fill(); if (isG) { c.strokeStyle = 'rgba(80,90,120,.6)'; c.lineWidth = 1; c.stroke(); } }
      if (mig > .3) { const f = seg(mig, .3, 1) * (1 - .55 * k.leak); c.save(); c.beginPath(); for (let x = 0; x <= W; x += 10) c.lineTo(x, cap(x)); for (let x = W; x >= 0; x -= 10) c.lineTo(x, src(x)); c.closePath(); c.clip(); const crest = cap(crestX), oilB = crest + lerp(0, 50, f), gasB = crest + lerp(0, gas ? 34 : 18, f) * (gas ? 1 : gasF + .25); c.fillStyle = D ? 'rgba(90,150,190,.35)' : 'rgba(70,130,170,.3)'; c.fillRect(0, oilB, W, H); { c.fillStyle = D ? '#c9861f' : '#a8650c'; c.fillRect(0, gasB, W, Math.max(0, oilB - gasB)); } c.fillStyle = D ? '#d6dbe8' : '#eef1f8'; c.fillRect(0, crest - 2, W, gasB - crest + 2); c.restore();
        if (f > .5) { pill(c, L('ก๊าซ', 'Gas'), crestX - 30, crest - 18, P); pill(c, L('น้ำมัน', 'Oil'), crestX + 40, crest + 22, P, D ? '#e3a03c' : '#8a520a'); } }
      // leakage along a fault
      if (k.leak > 0) { c.strokeStyle = P.fg; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(560, H); c.lineTo(600, S); c.stroke(); c.setLineDash([]);
        for (let i = 0; i < 24 * k.leak; i++) { const f = (t * .25 + hash(i + 700)) % 1; const y = lerp(cap(560) + 10, S, f), x = lerp(565, 600, 1 - (y - S) / (H - S)); const isG = hash(i + 701) < (gas ? .7 : .3); c.fillStyle = isG ? '#f4f6ff' : (D ? '#e3a03c' : '#b8700f'); c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); } }
      c.restore();
      if (k.leak > 0) { c.fillStyle = D ? '#151310' : '#2b241b'; c.beginPath(); c.ellipse(610, S - 2, 34 * k.leak, 6, 0, 0, 7); c.fill(); for (let i = 0; i < 10; i++) { const f = (t * .5 + i / 10) % 1; c.fillStyle = `rgba(180,190,200,${.5 * (1 - f) * (gas ? 1 : .5)})`; c.beginPath(); c.arc(600 + Math.sin(i * 3 + t) * 10, S - 8 - f * 60, 3 + f * 8, 0, 7); c.fill(); } pill(c, gas ? L('ก๊าซรั่ว → CO₂', 'Gas leaks → CO₂') : L('รั่วซึม → ยางมะตอย', 'Seep → tar'), 650, S - 26, P); }
      if (p > .3) for (let j = 1; j < 4; j++) { const y = (L4[j].top(20) + L4[j - 1].top(20)) / 2; if (y > S + 10 && y < H - 10) pill(c, L4[j].n, 10, y, P); }
      if (sea < .2 && k.leak < .5) { const x = crestX, y = S - 5; c.strokeStyle = P.fg; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 20, y); c.lineTo(x, y - 60); c.lineTo(x + 20, y); c.moveTo(x - 12, y - 22); c.lineTo(x + 12, y - 22); c.stroke(); c.setLineDash([5, 4]); c.beginPath(); c.moveTo(x, y); c.lineTo(x, cap(x) + 6); c.stroke(); c.setLineDash([]); }
      stageBanner(c, P, ST, p);
      gauges(c, P, [[L('ความลึก', 'Depth'), `${fmt(k.km, 1)} km`], [L('อุณหภูมิ', 'Temp'), `${fmt(20 + 30 * k.km)} °C`]]);
    }
  };
}

/* =============== uranium: born in stars → concentrated by water → radioactive decay =============== */
const L238 = Math.LN2 / 4.468, L235 = Math.LN2 / 0.7038; // per billion years
const EARTH = 4.54;
function u235pct(tFromNow) { const r = 0.0072 / 0.9928 * Math.exp((L235 - L238) * -tFromNow); return 100 * r / (1 + r); }
function uraniumSim(startScene) {
  return {
    controls: [
      { id: 'scene', type: 'select', label: L('ฉาก', 'Scene'), val: startScene || 'star', opts: [['star', L('1. เกิดในการชนของดาวนิวตรอน', '1. Born in neutron-star collisions')], ['ore', L('2. น้ำใต้ดินพามาสะสมเป็นแร่', '2. Groundwater concentrates ore')], ['decay', L('3. สลายตัวตามเวลา', '3. Radioactive decay over time')]] },
      { id: 'gy', label: L('เวลานับจากโลกเกิด (ฉาก 3)', 'Time since Earth formed (scene 3)'), min: 0, max: 10, step: .01, val: 4.54, unit: L('พันล้านปี', 'billion yr') },
      { id: 'auto', type: 'toggle', label: L('เล่นต่อเนื่อง', 'Play continuously'), val: true }
    ],
    init(s) { s.k = 0; },
    step(s, dt) { s.k = (s.k + dt / 14) % 1; if (s.scene === 'decay' && s.auto) { s.gy += dt * .35; if (s.gy > 10) s.gy = 0; } },
    metrics(s) {
      if (s.scene === 'star') return [[L('ที่มา', 'Origin'), L('ธาตุหนักกว่าเหล็กครึ่งหนึ่งเกิดจากการจับนิวตรอนอย่างรวดเร็ว (r-process) ในการชนของดาวนิวตรอนและซูเปอร์โนวาบางชนิด', 'About half the elements heavier than iron form by rapid neutron capture (the r-process) in neutron-star mergers and some supernovae')], [L('เมื่อไร', 'When'), L('ก่อนระบบสุริยะเกิด (4,600 ล้านปีก่อน) ฝุ่นที่มียูเรเนียมรวมตัวเป็นดวงอาทิตย์และโลก', 'Before the Solar System formed 4.6 billion years ago; uranium-bearing dust became the Sun and Earth')], [L('ไม่มีการสร้างใหม่บนโลก', 'Not made on Earth'), L('ยูเรเนียมทั้งหมดบนโลกมีมาตั้งแต่โลกเกิด และลดลงเรื่อย ๆ จากการสลายตัว', 'All of Earth\'s uranium dates from its formation and has been shrinking through decay ever since')]];
      if (s.scene === 'ore') return [[L('ละลายได้เมื่อมีออกซิเจน', 'Dissolves with oxygen'), L('U⁶⁺ ละลายในน้ำฝนและน้ำใต้ดินที่มีออกซิเจน ไหลผ่านหินแกรนิตที่มียูเรเนียมเล็กน้อย', 'U⁶⁺ dissolves in oxygen-rich rain and groundwater passing through granite that holds a little uranium')], [L('ตกตะกอนเมื่อขาดออกซิเจน', 'Drops out without oxygen'), L('เมื่อน้ำไหลถึงชั้นที่มีสารอินทรีย์หรือแร่ไพไรต์ ยูเรเนียมถูกรีดิวซ์เป็น U⁴⁺ ซึ่งไม่ละลาย สะสมเป็นแร่รูปจันทร์เสี้ยว (roll-front)', 'Where water meets organic matter or pyrite, uranium is reduced to insoluble U⁴⁺ and builds a crescent-shaped roll-front ore body')], [L('ความเข้มข้น', 'Grade'), L('เปลือกโลกเฉลี่ยราว 2–3 ppm แร่ที่ขุดคุ้มอยู่ราว 0.05–20% ขึ้นกับแหล่ง', 'Crust averages about 2–3 ppm; mined ores run about 0.05–20% depending on the deposit')]];
      const tn = s.gy - EARTH, f8 = Math.exp(-L238 * s.gy), f5 = Math.exp(-L235 * s.gy);
      return [[L('ยุค', 'Epoch'), tn < -0.01 ? L(`${fmt(-tn, 2)} พันล้านปีก่อน`, `${fmt(-tn, 2)} billion years ago`) : tn > .01 ? L(`อีก ${fmt(tn, 2)} พันล้านปีข้างหน้า`, `${fmt(tn, 2)} billion years from now`) : L('ปัจจุบัน', 'Today')], [L('U-238 เหลือ (ครึ่งชีวิต 4,468 ล้านปี)', 'U-238 left (half-life 4,468 Myr)'), `${fmt(f8 * 100, 1)}%`], [L('U-235 เหลือ (ครึ่งชีวิต 704 ล้านปี)', 'U-235 left (half-life 704 Myr)'), `${fmt(f5 * 100, 1)}%`], [L('สัดส่วน U-235 ในแร่', 'U-235 share of uranium'), `${fmt(u235pct(tn), 2)}%`], [L('ความหมาย', 'Meaning'), u235pct(tn) > 3 ? L('U-235 สูงพอให้แร่ในธรรมชาติเกิดปฏิกิริยาลูกโซ่เองได้ถ้ามีน้ำช่วย เช่นที่ Oklo ประเทศกาบอง ราว 2,000 ล้านปีก่อน', 'U-235 was high enough for natural ore to sustain a chain reaction with water, as at Oklo, Gabon, about 2 billion years ago') : L('วันนี้ U-235 เหลือ 0.72% โรงไฟฟ้าส่วนใหญ่จึงต้องเสริมสมรรถนะเป็น 3–5%', 'Today U-235 is 0.72%, so most reactors need fuel enriched to 3–5%')]];
    },
    spots: [
      { x: 400, y: 225, k: 'm', t: s => s.scene === 'star' ? L('การชนของดาวนิวตรอน', 'Neutron-star merger') : s.scene === 'ore' ? L('แนวรีดอกซ์', 'Redox front') : L('อะตอมยูเรเนียม', 'Uranium atoms'), d: s => s.scene === 'star' ? L('ในปี 2017 กล้องโทรทรรศน์และเครื่องตรวจคลื่นความโน้มถ่วง LIGO/Virgo จับการชน GW170817 ได้ และเห็นแสงจากธาตุหนักที่เพิ่งเกิด (kilonova)', 'In 2017 LIGO/Virgo and telescopes caught the GW170817 merger and saw light from freshly made heavy elements (a kilonova)') : s.scene === 'ore' ? L('เส้นแบ่งระหว่างน้ำที่มีออกซิเจนกับชั้นหินที่ขาดออกซิเจน ยูเรเนียมจะตกตะกอนตรงนี้ และแนวนี้ค่อย ๆ เคลื่อนตามทิศน้ำไหล', 'The boundary between oxygenated water and oxygen-poor rock. Uranium precipitates here and the front creeps downstream') : L('แต่ละจุดคืออะตอม เมื่อสลายจะกลายเป็นธาตุลูกหลายทอดจนเป็นตะกั่วที่เสถียร U-238 → Pb-206 และ U-235 → Pb-207 ความร้อนจากการสลายของ U, Th, K เป็นราวครึ่งหนึ่งของความร้อนที่ไหลออกจากโลก (KamLAND, 2011)', 'Each dot is an atom. Decay passes through a chain of daughters to stable lead: U-238 → Pb-206, U-235 → Pb-207. Heat from U, Th and K decay is about half of the heat flowing out of Earth (KamLAND, 2011)') }
    ],
    draw(c, s, t, P) {
      const D = P.dark;
      if (s.scene === 'star') {
        c.fillStyle = D ? '#070a12' : '#0e1424'; c.fillRect(0, 0, W, H); for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${.3 + .5 * hash(i)})`; c.fillRect(hash(i + 1) * W, hash(i + 2) * H, 1.5, 1.5); }
        const k = s.k, cx = 400, cy = 225;
        if (k < .45) { const r = lerp(120, 8, k / .45), a = t * lerp(1, 14, k / .45); [0, Math.PI].forEach(o => { c.fillStyle = '#cfe6ff'; c.beginPath(); c.arc(cx + Math.cos(a + o) * r, cy + Math.sin(a + o) * r * .5, 9, 0, 7); c.fill(); }); txt(c, L('ดาวนิวตรอน 2 ดวงหมุนเข้าหากัน', 'Two neutron stars spiral in'), cx, 400, '#e6edf5', 14); }
        else if (k < .7) { const f = (k - .45) / .25; const g = c.createRadialGradient(cx, cy, 0, cx, cy, 40 + f * 300); g.addColorStop(0, `rgba(255,240,200,${1 - f * .6})`); g.addColorStop(.4, `rgba(255,140,90,${.7 - f * .5})`); g.addColorStop(1, 'rgba(255,80,80,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); for (let i = 0; i < 120; i++) { const a = hash(i) * 7, r = f * (120 + 260 * hash(i + 5)); const heavy = hash(i + 9) < .25; c.fillStyle = heavy ? '#ffd65a' : '#ffb3a0'; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .7, heavy ? 3 : 2, 0, 7); c.fill(); } txt(c, L('ชนกัน: นิวตรอนถูกจับรวดเร็ว เกิดทอง แพลทินัม ทอเรียม ยูเรเนียม', 'Merger: rapid neutron capture makes gold, platinum, thorium, uranium'), cx, 400, '#ffe7b0', 14); }
        else { const f = (k - .7) / .3; c.fillStyle = 'rgba(160,120,200,.18)'; c.beginPath(); c.ellipse(cx, cy, 340 - f * 120, 150 - f * 60, .2, 0, 7); c.fill(); for (let i = 0; i < 160; i++) { const a = hash(i) * 7 + t * .1 * (1 + f), r = lerp(80 + 260 * hash(i + 5), 30 + 120 * hash(i + 5), f); c.fillStyle = hash(i + 9) < .15 ? '#ffd65a' : 'rgba(200,190,230,.8)'; c.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .45, 2, 2); } c.fillStyle = `rgba(255,220,120,${f})`; c.beginPath(); c.arc(cx, cy, 6 + f * 14, 0, 7); c.fill(); c.fillStyle = '#7fa6c9'; c.beginPath(); c.arc(cx + 110 * f, cy - 10 * f, 3 + 3 * f, 0, 7); c.fill(); txt(c, L('ฝุ่นที่มียูเรเนียมผสมในเมฆก๊าซ ยุบตัวเป็นดวงอาทิตย์และโลก', 'Uranium-bearing dust mixes into a cloud that collapses into the Sun and Earth'), cx, 400, '#e6edf5', 14); }
        txt(c, L('ยูเรเนียมเกิดในอวกาศ ไม่ได้เกิดบนโลก', 'Uranium is made in space, not on Earth'), 20, 24, '#e6edf5', 14, 'left');
        return;
      }
      if (s.scene === 'ore') {
        const S = 120; c.fillStyle = P.sky[1]; c.fillRect(0, 0, W, S);
        c.fillStyle = D ? '#5b4f55' : '#c7a9a9'; c.beginPath(); c.moveTo(0, S); c.lineTo(0, 60); c.lineTo(160, 40); c.lineTo(280, S); c.closePath(); c.fill(); txt(c, L('หินแกรนิต (มี U เล็กน้อย)', 'Granite (a little U)'), 90, 90, P.fg, 12);
        for (let i = 0; i < 30; i++) { const x = 40 + hash(i) * 220, y = ((t * 120 + hash(i + 1) * 60) % 60); c.strokeStyle = 'rgba(90,140,200,.7)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y + 8); c.stroke(); }
        c.fillStyle = D ? '#4a4a3e' : '#c8b98f'; c.fillRect(0, S, W, 90); c.fillStyle = D ? '#7d6a3e' : '#e2c98a'; c.fillRect(0, S + 90, W, 150); c.fillStyle = D ? '#3b3f44' : '#8d98a0'; c.fillRect(0, S + 240, W, H - S - 240);
        const fr = 470 + 60 * Math.sin(t * .05); c.fillStyle = D ? 'rgba(140,170,120,.25)' : 'rgba(120,150,90,.25)'; c.fillRect(fr, S + 90, W - fr, 150); txt(c, L('ชั้นขาดออกซิเจน (มีสารอินทรีย์/ไพไรต์)', 'Oxygen-poor zone (organics/pyrite)'), (fr + W) / 2, S + 225, P.fg, 12);
        txt(c, L('น้ำใต้ดินมีออกซิเจน →', 'Oxygenated groundwater →'), 200, S + 225, P.fg, 12);
        c.fillStyle = D ? '#d9c24a' : '#b59a12'; c.beginPath(); c.moveTo(fr, S + 92); c.quadraticCurveTo(fr + 70, S + 165, fr, S + 238); c.quadraticCurveTo(fr + 30, S + 165, fr, S + 92); c.fill(); pill(c, L('แร่ยูเรเนียม (roll-front)', 'Uranium ore (roll front)'), fr + 60, S + 160, P);
        for (let i = 0; i < 70; i++) { const y = S + 100 + hash(i) * 130, x = (hash(i + 3) * fr + t * 40) % fr; c.fillStyle = D ? '#ffe36b' : '#c9a400'; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); }
        txt(c, L('U⁶⁺ ละลายในน้ำ', 'Dissolved U⁶⁺'), 120, S + 70, P.fg2, 12);
        return;
      }
      // decay
      c.fillStyle = P.panel; c.fillRect(0, 0, W, H);
      const f8 = Math.exp(-L238 * s.gy), f5 = Math.exp(-L235 * s.gy); const n = 20 * 14;
      for (let i = 0; i < n; i++) { const x = 40 + (i % 20) * 19, y = 70 + Math.floor(i / 20) * 19; const alive = hash(i + 900) < f8; c.fillStyle = alive ? (D ? '#9fd36b' : '#4f8f2a') : (D ? '#6b7178' : '#9aa1a6'); c.beginPath(); c.arc(x, y, alive ? 6 : 4, 0, 7); c.fill(); }
      txt(c, L('U-238 (เขียว) · ตะกั่ว Pb-206 (เทา)', 'U-238 (green) · lead Pb-206 (grey)'), 40, 46, P.fg, 13, 'left');
      for (let i = 0; i < 6 * 14; i++) { const x = 460 + (i % 6) * 19, y = 70 + Math.floor(i / 6) * 19; const alive = hash(i + 1900) < f5; c.fillStyle = alive ? (D ? '#ffcf5a' : '#c98500') : (D ? '#6b7178' : '#9aa1a6'); c.beginPath(); c.arc(x, y, alive ? 6 : 4, 0, 7); c.fill(); }
      txt(c, L('U-235 (ส้ม) · Pb-207', 'U-235 (amber) · Pb-207'), 460, 46, P.fg, 13, 'left');
      // timeline
      const tx0 = 40, tx1 = 760, ty = 380, gx = g => lerp(tx0, tx1, g / 10); c.strokeStyle = P.line; c.lineWidth = 6; c.beginPath(); c.moveTo(tx0, ty); c.lineTo(tx1, ty); c.stroke();
      c.strokeStyle = P.cond; c.beginPath(); c.moveTo(tx0, ty); c.lineTo(gx(s.gy), ty); c.stroke();
      [[0, L('โลกเกิด', 'Earth forms')], [EARTH - 2, 'Oklo'], [EARTH, L('วันนี้', 'Today')], [10, '+5.5']].forEach(([g, lab]) => { c.fillStyle = P.fg; c.fillRect(gx(g) - 1, ty - 12, 2, 24); txt(c, lab, gx(g), ty + 24, P.fg2, 11); });
      c.fillStyle = P.cond; c.beginPath(); c.arc(gx(s.gy), ty, 9, 0, 7); c.fill();
      txt(c, L('พันล้านปีนับจากโลกเกิด', 'Billion years since Earth formed'), (tx0 + tx1) / 2, ty - 26, P.muted, 11);
      const pc = u235pct(s.gy - EARTH); rr(c, 600, 70, 170, 64, 10, D ? 'rgba(17,24,22,.86)' : 'rgba(255,255,255,.92)', P.line); txt(c, L('U-235 ในแร่', 'U-235 in ore'), 685, 90, P.muted, 11); txt(c, `${fmt(pc, 2)}%`, 685, 116, pc > 3 ? '#e5484d' : P.fg, 22);
    }
  };
}

/* =============== content for every source =============== */
const R = {
  treibs: ['Treibs, A.', 1936, 'Chlorophyll- und Häminderivate in organischen Mineralstoffen. Angewandte Chemie 49(38): 682–686', 'https://doi.org/10.1002/ange.19360493803'],
  klemme: ['Klemme, H.D. & Ulmishek, G.F.', 1991, 'Effective petroleum source rocks of the world. AAPG Bulletin 75(12): 1809–1851', 'https://archives.datapages.com/data/bulletns/1990-91/data/pg/0075/0012/0000/1809.htm'],
  demaison: ['Demaison, G.J. & Moore, G.T.', 1980, 'Anoxic environments and oil source bed genesis. AAPG Bulletin 64(8): 1179–1209', 'https://archives.datapages.com/data/bulletns/1980-81/data/pg/0064/0008/1150/1179.htm'],
  tissot: ['Tissot, B.P. & Welte, D.H.', 1984, 'Petroleum Formation and Occurrence (2nd ed.). Springer', 'https://doi.org/10.1007/978-3-642-87813-8'],
  grajales: ['Grajales-Nishimura, J.M. et al.', 2000, 'Chicxulub impact: the origin of reservoir and seal facies in the southeastern Mexico oil fields. Geology 28(4): 307–310', 'https://doi.org/10.1130/0091-7613(2000)28%3C307:CITOOR%3E2.0.CO;2'],
  rice: ['Rice, D.D. & Claypool, G.E.', 1981, 'Generation, accumulation, and resource potential of biogenic gas. AAPG Bulletin 65(1): 5–25', 'https://archives.datapages.com/data/bulletns/1980-81/data/pg/0065/0001/0000/0005.htm'],
  floudas: ['Floudas, D. et al.', 2012, 'The Paleozoic origin of enzymatic lignin decomposition reconstructed from 31 fungal genomes. Science 336: 1715–1719', 'https://doi.org/10.1126/science.1221748'],
  nelsen: ['Nelsen, M.P. et al.', 2016, 'Delayed fungal evolution did not cause the Paleozoic peak in coal production. PNAS 113(9): 2442–2447', 'https://doi.org/10.1073/pnas.1517943113'],
  ics: ['International Commission on Stratigraphy', 2024, 'International Chronostratigraphic Chart', 'https://stratigraphy.org/chart'],
  kamland: ['KamLAND Collaboration (Gando, A. et al.)', 2011, 'Partial radiogenic heat model for Earth revealed by geoneutrino measurements. Nature Geoscience 4: 647–651', 'https://doi.org/10.1038/ngeo1205'],
  gw170817: ['Abbott, B.P. et al. (LIGO & Virgo)', 2017, 'GW170817: observation of gravitational waves from a binary neutron star inspiral. Physical Review Letters 119: 161101', 'https://doi.org/10.1103/PhysRevLett.119.161101'],
  oklo: ['IAEA Bulletin', 'n.d.', 'Oklo: a natural nuclear reactor', 'https://www.iaea.org/sites/default/files/17304780204.pdf'],
  llr: ['NASA JPL', 2019, 'The Apollo experiment that keeps on giving (lunar laser ranging: the Moon recedes ~3.8 cm/yr)', 'https://jpl.nasa.gov/news/the-apollo-experiment-that-keeps-on-giving/'],
  eia_coal: ['U.S. EIA', 2024, 'Coal explained', 'https://www.eia.gov/energyexplained/coal/'],
  eia_oil: ['U.S. EIA', 2024, 'Oil and petroleum products explained', 'https://www.eia.gov/energyexplained/oil-and-petroleum-products/'],
  eia_gas: ['U.S. EIA', 2024, 'Natural gas explained', 'https://www.eia.gov/energyexplained/natural-gas/']
};
const SUN = { f: P2('ปฏิกิริยาฟิวชันไฮโดรเจนเป็นฮีเลียมในแกนดวงอาทิตย์ ซึ่งเกิดเมื่อ 4,600 ล้านปีก่อน', 'Hydrogen fuses to helium in the core of the Sun, which formed 4.6 billion years ago'), end: P2('ดวงอาทิตย์จะเผาไฮโดรเจนต่อไปอีกราว 5,000 ล้านปี สำหรับมนุษย์จึงนับว่าไม่หมด', 'The Sun will keep burning hydrogen for about another 5 billion years, effectively endless for us') };
const O = {
  coal: { sim: 'coal', f: P2('ซากพืชในป่าพรุที่ขาดออกซิเจนทับถมเป็นพีต ถ่านหินชั้นใหญ่ของโลกส่วนมากเกิดยุคคาร์บอนิเฟอรัส–เพอร์เมียน (359–252 ล้านปีก่อน) ก่อนยุคไดโนเสาร์ ส่วนลิกไนต์แม่เมาะของไทยอายุราว 10–20 ล้านปี', 'Plant debris in oxygen-poor swamps piles up as peat. Most of the world\'s big coal seams formed in the Carboniferous–Permian (359–252 million years ago), before the dinosaurs; Thailand\'s Mae Moh lignite is only about 10–20 million years old'), c: P2('ถูกฝัง ร้อนและถูกกด: พีต → ลิกไนต์ → ซับบิทูมินัส → บิทูมินัส → แอนทราไซต์ คาร์บอนเพิ่มจากราว 50% เป็นกว่า 90%', 'Burial, heat and pressure: peat → lignite → sub-bituminous → bituminous → anthracite, with carbon rising from about 50% to over 90%'), e: P2('ถ้าถูกยกขึ้นผิวดินจะผุและออกซิไดซ์ บางแห่งลุกไหม้เอง ถ้าร้อนมากต่อไปจะเป็นกราไฟต์ เมื่อเผา คาร์บอนกลับเป็น CO₂', 'Lifted to the surface it weathers and oxidises, and can self-ignite; cooked further it becomes graphite. Burning returns its carbon as CO₂'), time: P2('สะสมนับสิบล้านปี ใช้หมดในไม่กี่ร้อยปี', 'Tens of millions of years to form, a few centuries to use'), refs: ['nelsen', 'floudas', 'ics', 'eia_coal'] },
  oil: { sim: 'oil', f: P2('แพลงก์ตอนและสาหร่ายในทะเลหรือทะเลสาบที่ขาดออกซิเจนจมทับถมเป็นโคลนดำ ราวครึ่งหนึ่งของน้ำมันและก๊าซที่ค้นพบมาจากหินต้นกำเนิดยุคจูแรสซิกตอนปลายและครีเทเชียสตอนกลาง', 'Plankton and algae settle as black mud in oxygen-poor seas or lakes. About half of discovered oil and gas comes from Upper Jurassic and middle Cretaceous source rocks'), c: P2('ถูกฝังเป็นหินดินดาน สารอินทรีย์เป็นเคโรเจน แล้วแตกตัวเป็นน้ำมันที่ 60–120 °C ไหลขึ้นจนติดใต้หินปิด', 'Buried into shale, the organic matter becomes kerogen, cracks to oil at 60–120 °C, and migrates up until a seal traps it'), e: P2('ถ้าหินปิดแตก น้ำมันจะซึมออก จุลินทรีย์ย่อยจนเป็นน้ำมันหนักหรือยางมะตอย ถ้าร้อนเกินจะแตกเป็นก๊าซ เมื่อเผาก็กลับเป็น CO₂', 'If the seal breaks, oil seeps out and microbes degrade it to heavy oil or tar; overheated, it cracks to gas. Burning returns it to CO₂'), time: P2('สะสมและบ่มหลายล้านถึงร้อยล้านปี', 'Millions to a hundred million years to accumulate and mature'), refs: ['treibs', 'klemme', 'demaison', 'tissot', 'grajales', 'eia_oil'] },
  gas: { sim: 'gas', f: P2('มีสองทาง: ก๊าซจากความร้อน (หินต้นกำเนิดที่ลึกและร้อนกว่าช่วงเกิดน้ำมัน) และก๊าซชีวภาพที่จุลินทรีย์ผลิตในตะกอนตื้น Rice & Claypool (1981) ประเมินว่าก๊าซชีวภาพเป็นกว่า 20% ของก๊าซที่ค้นพบ', 'Two routes: thermogenic gas from source rocks hotter than the oil window, and biogenic gas made by microbes in shallow sediment. Rice & Claypool (1981) estimated biogenic gas at over 20% of discovered gas'), c: P2('ก๊าซเบามาก จึงเคลื่อนขึ้นได้ง่ายกว่าน้ำมันและติดอยู่ใต้หินปิดเหนือชั้นน้ำมัน ในอ่าวไทยมีแหล่งก๊าซและคอนเดนเสทหลายแหล่ง', 'Gas is very light, moves more easily than oil, and collects under the seal above any oil. The Gulf of Thailand holds many gas and condensate fields'), e: P2('ก๊าซรั่วผ่านรอยแตกได้ง่าย มีเทนที่รั่วถูกจุลินทรีย์ในดินและทะเลกิน ส่วนที่ถึงอากาศจะถูกออกซิไดซ์เป็น CO₂ ในราว 12 ปี และระหว่างนั้นเป็นก๊าซเรือนกระจกแรงกว่า CO₂ มาก', 'Gas escapes through cracks easily. Microbes in soil and sea consume much of it; methane reaching the air oxidises to CO₂ in about 12 years and warms far more strongly than CO₂ meanwhile'), time: P2('ล้านถึงร้อยล้านปี (ก๊าซชีวภาพเกิดได้เร็วกว่า)', 'Millions to hundreds of millions of years (biogenic gas forms faster)'), refs: ['rice', 'klemme', 'tissot', 'eia_gas'] },
  nuc: { sim: 'uranium', f: P2('ยูเรเนียมเกิดจากการชนของดาวนิวตรอนและซูเปอร์โนวาก่อนระบบสุริยะเกิด แล้วติดมากับฝุ่นที่รวมเป็นโลก', 'Uranium was forged in neutron-star mergers and supernovae before the Solar System, then arrived with the dust that formed Earth'), c: P2('น้ำใต้ดินที่มีออกซิเจนละลายยูเรเนียมจากหินแกรนิต แล้วตกตะกอนเป็นแร่ตรงชั้นที่ขาดออกซิเจน ในเตาปฏิกรณ์ U-235 แตกตัว (ฟิชชัน) ให้ความร้อน', 'Oxygenated groundwater leaches uranium from granite and drops it as ore where oxygen runs out. In a reactor, U-235 splits (fission) to release heat'), e: P2('สลายตัวเองตลอดเวลา: U-238 ครึ่งชีวิต 4,468 ล้านปี U-235 ครึ่งชีวิต 704 ล้านปี จนเป็นตะกั่ว เชื้อเพลิงใช้แล้วมีธาตุกัมมันตรังสีที่ต้องเก็บนับพันปี', 'It decays all the time: U-238 with a 4,468-million-year half-life and U-235 with 704 million years, ending as lead. Spent fuel holds radioactive products that must be stored for thousands of years'), time: P2('ไม่มีการสร้างใหม่บนโลก มีแต่ลดลง', 'Never replenished on Earth, only decreasing'), refs: ['gw170817', 'oklo', 'kamland'] },
  geo: { sim: 'decay', f: P2('ความร้อนตั้งแต่โลกก่อตัวจากการรวมตัวของฝุ่นและการจมของเหล็กลงแกนโลก รวมกับความร้อนจากการสลายของ U, Th และ K ในหิน', 'Heat left from Earth\'s accretion and iron sinking to the core, plus heat from the decay of U, Th and K in rocks'), c: P2('ความร้อนไหลออกจากโลกราว 44 TW การวัดนิวตริโนจากใต้ดิน (KamLAND, 2011) ชี้ว่าราวครึ่งหนึ่งมาจากการสลายกัมมันตรังสี น้ำใต้ดินพาความร้อนขึ้นมาใกล้ผิวในแนวภูเขาไฟและรอยเลื่อน', 'About 44 TW of heat flows out of Earth; geoneutrino measurements (KamLAND, 2011) suggest about half comes from radioactive decay. Groundwater carries it near the surface along volcanoes and faults'), e: P2('ทั้งโลกเย็นลงช้ามากในหลายพันล้านปี แต่แหล่งพลังงานความร้อนแต่ละแห่งอาจเย็นลงหรือแรงดันลดได้ถ้าดึงน้ำร้อนเร็วกว่าที่เติมกลับ', 'Earth as a whole cools over billions of years, but a single geothermal field can cool or lose pressure if hot water is drawn faster than it is replaced'), time: P2('ต่อเนื่องหลายพันล้านปี', 'Billions of years'), refs: ['kamland'] },
  hydro: { f: SUN.f, c: P2('แสงแดดทำให้น้ำทะเลระเหย ลมพาไอน้ำไปตกเป็นฝนบนภูเขา น้ำที่อยู่สูงมีพลังงานศักย์ ไหลผ่านกังหันในเขื่อน', 'Sunlight evaporates seawater, wind carries the vapour to fall as rain on mountains, and water held high has potential energy that turns dam turbines'), e: P2('วัฏจักรน้ำหมุนเวียนทุกปี แต่อ่างเก็บน้ำจะค่อย ๆ ถูกตะกอนถม และภัยแล้งทำให้ผลิตได้น้อยลง', 'The water cycle renews every year, but reservoirs slowly fill with sediment and droughts cut output'), time: P2('ฝนหมุนเวียนในไม่กี่วันถึงเดือน', 'Rain cycles in days to months'), refs: [] },
  pv: { f: SUN.f, c: P2('พลังงานจากแกนดวงอาทิตย์ใช้เวลาหลายหมื่นปีกว่าจะออกถึงผิว จากนั้นแสงเดินทางถึงโลกใน 8 นาที 20 วินาที แผงโซลาร์เปลี่ยนแสงเป็นไฟฟ้าได้ราว 20–23%', 'Energy from the Sun\'s core takes tens of thousands of years to reach its surface, then sunlight crosses to Earth in 8 minutes 20 seconds. Solar panels turn about 20–23% of it into electricity'), e: SUN.end, time: P2('ใช้แสงที่มาถึงทุกวัน', 'Uses sunlight arriving each day'), refs: [] },
  won: { f: SUN.f, c: P2('แดดทำให้เส้นศูนย์สูตรร้อนกว่าขั้วโลก และพื้นดินร้อนกว่าทะเล ความกดอากาศต่างกันทำให้อากาศเคลื่อนที่ การหมุนของโลกทำให้ลมเลี้ยว', 'The Sun heats the equator more than the poles and land more than sea; the pressure differences drive air, and Earth\'s spin bends the winds'), e: P2('พลังงานลมสลายเป็นความปั่นป่วนและความร้อนเล็กน้อยในอากาศ แล้วถูกแดดสร้างใหม่ตลอดเวลา', 'Wind energy dissipates into turbulence and a little heat, and sunlight renews it continuously'), time: P2('สร้างใหม่ทุกวัน', 'Renewed daily'), refs: [] },
  tide: { f: P2('แรงโน้มถ่วงของดวงจันทร์และดวงอาทิตย์ดึงน้ำทะเลให้โป่ง ประกอบกับการหมุนของโลก', 'The gravity of the Moon and Sun raises bulges in the ocean as Earth turns beneath them'), c: P2('น้ำขึ้นลงวันละ 2 รอบในหลายพื้นที่ กังหันหรือเขื่อนกั้นปากอ่าวดึงพลังงานจากกระแสน้ำที่ไหลเข้าออก', 'Many coasts see two tides a day; turbines or barrages capture energy from the flow in and out'), e: P2('แรงเสียดทานของน้ำขึ้นลงทำให้โลกหมุนช้าลงทีละน้อย และดวงจันทร์ถอยห่างออกไปราว 3.8 ซม. ต่อปี (วัดด้วยเลเซอร์สะท้อนกระจกที่ยาน Apollo วางไว้)', 'Tidal friction slowly brakes Earth\'s spin and the Moon drifts away about 3.8 cm a year, measured by lasers bounced off Apollo reflectors'), time: P2('ต่อเนื่องหลายพันล้านปี', 'Billions of years'), refs: ['llr'] },
  bio: { f: SUN.f, c: P2('พืชสังเคราะห์แสงเก็บพลังงานแดดราว 1–2% ไว้ในน้ำตาลและเนื้อไม้ เราเผาหรือหมักเป็นก๊าซชีวภาพ', 'Plants store about 1–2% of sunlight in sugar and wood through photosynthesis; we burn it or ferment it into biogas'), e: P2('ถ้าไม่เผา ซากพืชจะถูกจุลินทรีย์ย่อยกลับเป็น CO₂ ในไม่กี่ปี ถ้าถูกฝังในที่ขาดออกซิเจนนับล้านปี ก็คือจุดเริ่มต้นของถ่านหิน', 'Unburned, microbes return plant matter to CO₂ within years; buried without oxygen for millions of years, it is how coal begins'), time: P2('หมุนเวียนในหลายเดือนถึงหลายสิบปี', 'Cycles in months to decades'), refs: [] },
  wte: { f: P2('ขยะมาจากทั้งเชื้อเพลิงฟอสซิล (พลาสติก) และชีวมวล (เศษอาหาร กระดาษ ไม้)', 'Waste mixes fossil carbon (plastics) and biomass (food, paper, wood)'), c: P2('เตาเผาเปลี่ยนเป็นความร้อนและไอน้ำ ส่วนหลุมฝังกลบ จุลินทรีย์ย่อยแบบไม่ใช้ออกซิเจนเป็นก๊าซมีเทนที่เก็บมาผลิตไฟได้', 'Incinerators turn it to heat and steam; in landfills, anaerobic microbes produce methane that can be captured for power'), e: P2('เศษอาหารย่อยในไม่กี่ปี พลาสติกสลายช้ามากนับร้อยปีและแตกเป็นไมโครพลาสติก', 'Food waste breaks down in a few years; plastics take centuries and fragment into microplastics'), time: P2('ปี ถึงหลายร้อยปี', 'Years to centuries'), refs: [] },
  h2: { f: P2('ไฮโดรเจนไม่ใช่แหล่งพลังงานในตัวเอง ต้องผลิตจากก๊าซธรรมชาติ (เกือบทั้งหมดในปัจจุบัน) หรือแยกน้ำด้วยไฟฟ้า มีไฮโดรเจนธรรมชาติใต้ดินบางแห่ง เช่นที่มาลี เกิดจากน้ำทำปฏิกิริยากับหินที่มีเหล็ก', 'Hydrogen is a carrier, not a source: today it is made almost entirely from natural gas, or by splitting water with electricity. Some natural hydrogen exists underground, as in Mali, made when water reacts with iron-rich rock'), c: P2('เก็บในถังแรงดันสูงหรือแปลงเป็นแอมโมเนีย แล้วนำไปเผาหรือใช้ในเซลล์เชื้อเพลิง', 'Stored in high-pressure tanks or converted to ammonia, then burned or used in fuel cells'), e: P2('เมื่อใช้แล้วกลายเป็นน้ำ ไฮโดรเจนที่รั่วสู่อากาศทำให้มีเทนอยู่นานขึ้น จึงเป็นก๊าซเรือนกระจกทางอ้อม', 'It ends as water. Hydrogen leaking to the air lengthens methane\'s lifetime, making it an indirect greenhouse gas'), time: P2('ผลิตและใช้ในไม่กี่วันถึงเดือน', 'Made and used within days to months'), refs: [] }
};
O.pvs = O.pv; O.csp = Object.assign({}, O.pv, { c: P2('กระจกรวมแสงแดดให้ร้อนหลายร้อยองศา เก็บไว้ในเกลือหลอมเหลว แล้วต้มน้ำปั่นกังหัน', 'Mirrors concentrate sunlight to hundreds of degrees, store it in molten salt, then boil water to spin a turbine') }); O.woff = O.won;

const refLink = k => { const r = R[k]; return r ? `<li><a href="${esc(r[3])}" target="_blank" rel="noopener">${esc(r[0])} (${r[1]}) ${esc(r[2])}</a></li>` : ''; };
function render(v, s) {
  const o = O[s.id];
  if (!o) { v.innerHTML = `<div class="empty">${L('ยังไม่มีข้อมูลกำเนิดของแหล่งนี้', 'No origin story for this source yet')}</div>`; return null; }
  const simLabel = { coal: L('ภาพตัดขวาง: ถ่านหินเกิด เปลี่ยน และสลาย', 'Cross-section: how coal forms, changes and breaks down'), oil: L('ภาพตัดขวาง: น้ำมันเกิด เคลื่อนที่ ติดกับดัก และรั่วซึม', 'Cross-section: oil forms, migrates, gets trapped and seeps'), gas: L('ภาพตัดขวาง: ก๊าซเกิด ติดกับดัก และรั่วซึม', 'Cross-section: gas forms, gets trapped and leaks'), uranium: L('จากดวงดาวถึงแร่ และการสลายตัว', 'From the stars to ore, and decay'), decay: L('การสลายของยูเรเนียม แหล่งความร้อนส่วนหนึ่งใต้โลก', 'Uranium decay, part of Earth\'s inner heat') }[o.sim];
  v.innerHTML = `<div class="og">
    <div class="ogflow">
      <div class="box"><span class="ogk">${L('1 · เกิดจาก', '1 · Formation')}</span><p>${esc(tx(o.f))}</p></div>
      <div class="box"><span class="ogk">${L('2 · เปลี่ยนแปลง', '2 · Transformation')}</span><p>${esc(tx(o.c))}</p></div>
      <div class="box"><span class="ogk">${L('3 · สลาย / หมดไป', '3 · Breakdown / end')}</span><p>${esc(tx(o.e))}</p></div>
    </div>
    <p class="note"><b>${L('ช่วงเวลา', 'Timescale')}:</b> ${esc(tx(o.time))}</p>
    ${o.sim ? `<h3>${simLabel}</h3><div id="ogsim"></div>` : ''}
    ${o.refs.length ? `<h3>${L('งานวิจัยที่อ้างอิง', 'Research cited')}</h3><ol class="refs">${o.refs.map(refLink).join('')}</ol>` : ''}
    <p class="note">${L('แบบจำลองอย่างง่ายเพื่อการเรียนรู้ ความลึก อุณหภูมิ และเวลาเป็นค่าประมาณ แหล่งจริงแต่ละแห่งต่างกันมาก', 'A simplified teaching model; depths, temperatures and times are approximate and real deposits vary widely')}</p></div>`;
  if (!o.sim) return null;
  const sim = o.sim === 'coal' ? coalSim() : o.sim === 'oil' ? petroSim(false) : o.sim === 'gas' ? petroSim(true) : uraniumSim(o.sim === 'decay' ? 'decay' : 'star');
  return LabSim.mount(document.getElementById('ogsim'), sim);
}
window.LabOrigin = { render, has: id => !!O[id] };
})();

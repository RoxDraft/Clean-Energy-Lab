const C = {
  bg: '#0a0f14', ink: '#e8edf1', dim: '#93a1ae', line: '#2c3b47', panel: 'rgba(12,19,26,0.92)',
  concrete: 'oklch(0.80 0.10 80)', steel: 'oklch(0.76 0.11 250)', stainless: 'oklch(0.80 0.10 195)',
  alu: 'oklch(0.76 0.11 305)', co2: 'oklch(0.72 0.17 35)', co2b: 'oklch(0.82 0.12 65)', green: 'oklch(0.80 0.15 150)',
};
const TH = "'Anuphan', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const al = (c, a) => c.replace(')', ' / ' + a + ')');

const MOTION = {
  enter: (T, s, d = 0.7) => Easing.easeOutCubic(clamp((T - s) / d, 0, 1)),
  draw: (T, s, d = 1.2) => Easing.easeInOutCubic(clamp((T - s) / d, 0, 1)),
  pop: (T, s, d = 0.5) => Easing.easeOutBack(clamp((T - s) / d, 0, 1)),
};
const rise = (a, d = 16) => ({ opacity: a, transform: 'translateY(' + ((1 - a) * d) + 'px)' });
const COLX = [100, 540, 980, 1420], COLW = 400;
const MAT = [
  { k: 'concrete', th: 'คอนกรีต', en: 'Concrete / Cement', c: C.concrete },
  { k: 'steel', th: 'เหล็ก', en: 'Carbon steel', c: C.steel },
  { k: 'stainless', th: 'สแตนเลส', en: 'Stainless steel', c: C.stainless },
  { k: 'alu', th: 'อะลูมิเนียม', en: 'Aluminium', c: C.alu },
];

function Sec({ from, to, children, zoom = 0.03, origin = '50% 50%' }) {
  const { T } = useComposition();
  const o = MOTION.enter(T, from, 0.7) * (1 - MOTION.enter(T, to - 0.6, 0.6));
  const prog = clamp((T - from) / (to - from), 0, 1);
  const hidden = o < 0.002;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o, visibility: hidden ? 'hidden' : 'visible',
      transform: 'scale(' + (1 + zoom * prog) + ')', transformOrigin: origin }}>
      {hidden ? null : children}
    </div>
  );
}

function hl(str) {
  const parts = str.split(/(CO₂|Cr₂O₃|H₂O)/);
  return parts.map((p, i) => p === 'CO₂' ? <span key={i} style={{ color: C.co2, fontWeight: 700 }}>CO₂</span>
    : p === 'Cr₂O₃' ? <span key={i} style={{ color: C.stainless, fontWeight: 700 }}>Cr₂O₃</span>
    : p === 'H₂O' ? <span key={i} style={{ color: C.green, fontWeight: 700 }}>H₂O</span> : p);
}

function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function pointAt(pts, u) {
  let target = polyLen(pts) * u;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (target <= seg || i === pts.length - 1) {
      const f = seg ? Math.min(1, target / seg) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}
function Wire({ pts, color, p, T, dashed }) {
  if (p <= 0) return null;
  const d = 'M' + pts.map(q => q[0] + ' ' + q[1]).join(' L ');
  const end = pts[pts.length - 1];
  const dots = [];
  if (p >= 1) for (let k = 0; k < 3; k++) { const q = pointAt(pts, (T * 0.4 + k / 3) % 1); dots.push(<circle key={k} cx={q[0]} cy={q[1]} r="4.5" fill={color} />); }
  return (
    <g>
      {dashed
        ? <path d={d} fill="none" stroke={color} strokeWidth="2" strokeDasharray="8 8" strokeDashoffset={-T * 30} opacity={p} />
        : <path d={d} pathLength="1" fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.75" strokeDasharray="1 1" strokeDashoffset={1 - p} />}
      {dots}
      {p >= 1 && <circle cx={end[0]} cy={end[1]} r="5" fill={C.bg} stroke={color} strokeWidth="2" />}
    </g>
  );
}
function Wires({ items, T }) {
  return (
    <svg width="1920" height="1080" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {items.map((w, i) => <Wire key={i} {...w} T={T} />)}
    </svg>
  );
}

function Node({ x, y, w, h, title, sub, color, a, hot, T, dashed }) {
  const glow = hot ? '0 0 ' + (26 + 14 * Math.sin(T * 3)) + 'px ' + al(C.co2, 0.4) : 'none';
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', padding: '12px 16px',
      border: '1.5px ' + (dashed ? 'dashed ' : 'solid ') + color, background: C.panel, boxShadow: glow,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, ...rise(a) }}>
      <div style={{ font: '600 25px/1.2 ' + TH, color: C.ink }}>{title}</div>
      {sub && <div style={{ font: '400 24px/1.25 ' + MONO, color: hot ? C.co2b : C.dim }}>{sub}</div>}
    </div>
  );
}

function Puff({ x, y, a, T, label = 'CO₂ ↑' }) {
  const pv = a;
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: clamp(pv, 0, 1), transform: 'scale(' + (0.6 + 0.4 * pv) + ')', transformOrigin: '0 100%' }}>
      {[0, 1, 2].map(k => {
        const u = (T * 0.5 + k / 3) % 1;
        return <div key={k} style={{ position: 'absolute', left: 14 + k * 18 + Math.sin((u + k) * 6) * 5, top: -14 - u * 56,
          width: 10, height: 10, borderRadius: 6, border: '2px solid ' + C.co2, opacity: 1 - u }}></div>;
      })}
      <div style={{ font: '600 24px ' + MONO, color: C.co2, border: '1.5px solid ' + C.co2, padding: '2px 10px', background: C.bg, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
}

function ColHead({ x, y = 170, m, a }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: COLW, ...rise(a) }}>
      <div style={{ height: 5, background: m.c, width: COLW * a }}></div>
      <div style={{ font: '600 36px/1.2 ' + TH, color: m.c, marginTop: 14 }}>{m.th}</div>
      <div style={{ font: '400 24px ' + MONO, color: C.dim, marginTop: 2 }}>{m.en}</div>
    </div>
  );
}

function Panel({ x, y, w, h, a, children }) {
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', padding: 26,
    border: '1.5px solid ' + C.line, background: C.panel, ...rise(a) }}>{children}</div>;
}

function Grid({ T }) {
  return <div style={{ position: 'absolute', inset: 0,
    backgroundImage: 'linear-gradient(rgba(140,175,205,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(140,175,205,0.06) 1px, transparent 1px), linear-gradient(rgba(140,175,205,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(140,175,205,0.03) 1px, transparent 1px)',
    backgroundSize: '160px 160px, 160px 160px, 32px 32px, 32px 32px',
    backgroundPosition: (-T * 6) + 'px ' + (-T * 3) + 'px' }}></div>;
}

/* ---------------- persistent top bar ---------------- */
const SECS = [
  ['LifeCycle', '00', 'โมดูลวัฏจักรชีวิต', 'Life Cycle Modules · EN 15804'],
  ['Raw', '01', 'วัตถุดิบและปฏิกิริยาหลัก', 'A1 · Raw material supply'],
  ['Concrete', '02', 'คอนกรีต / ซีเมนต์', 'A3 · Clinker → Concrete'],
  ['Steel', '03', 'เหล็กกล้า', 'A3 · BF–BOF · Scrap-EAF · H₂-DRI'],
  ['Stainless', '04', 'สแตนเลส', 'A3 · EAF–AOD · 304 / 316 / 430'],
  ['Aluminium', '05', 'อะลูมิเนียม', 'A3 · Bayer · Hall–Héroult · 1xxx–7xxx'],
  ['Compare', '06', 'เปรียบเทียบคาร์บอน', 'A1–A3 · tCO₂e per tonne'],
  ['UseEoL', '07', 'ใช้งานและสิ้นอายุ', 'B1–B7 · C1–C4'],
  ['Recycling', '08', 'รีไซเคิล', 'Module D · Beyond the system boundary'],
  ['Levers', '09', 'เส้นทางลดคาร์บอน', 'Decarbonisation levers'],
  ['Outro', '10', 'สรุปสำหรับผู้ออกแบบ', 'Specify · Measure · Recover'],
];
function SecLabels({ T, CUES, total }) {
  return SECS.map((s, i) => {
    const a = CUES[s[0]];
    const b = i + 1 < SECS.length ? CUES[SECS[i + 1][0]] : total + 1;
    const o = MOTION.enter(T, a + 0.1, 0.6) * (1 - MOTION.enter(T, b - 0.5, 0.5));
    if (o < 0.002) return null;
    return (
      <div key={s[0]} style={{ position: 'absolute', left: 80, top: 34, display: 'flex', gap: 18, alignItems: 'flex-start', ...rise(o, 10) }}>
        <div style={{ font: '500 24px ' + MONO, color: C.dim, border: '1.5px solid ' + C.line, padding: '4px 10px', marginTop: 4 }}>{s[1]}</div>
        <div>
          <div style={{ font: '600 36px/1.15 ' + TH, color: C.ink }}>{s[2]}</div>
          <div style={{ font: '400 24px ' + MONO, color: C.dim, marginTop: 4 }}>{s[3]}</div>
        </div>
      </div>
    );
  });
}

const MODS = [
  { c: 'A1–A3', th: 'ผลิต', d: 'วัตถุดิบ · ขนส่ง · การผลิต' },
  { c: 'A4–A5', th: 'ก่อสร้าง', d: 'ขนส่งไปไซต์ · ติดตั้ง' },
  { c: 'B1–B7', th: 'ใช้งาน', d: 'ใช้ · ซ่อมบำรุง · เปลี่ยน · พลังงาน' },
  { c: 'C1–C4', th: 'สิ้นอายุ', d: 'รื้อถอน · ขนส่ง · คัดแยก · กำจัด' },
  { c: 'D', th: 'นอกขอบเขต', d: 'เครดิต Reuse · Recycle · Recovery' },
];
function env(T, a, b, f = 0.4) { return MOTION.enter(T, a, f) * (1 - MOTION.enter(T, b, f)); }
function modHL(T, CUES, total, i) {
  const L = CUES.LifeCycle;
  const segs = [
    [L + 1.2 + i * 0.9, L + 2.1 + i * 0.9, [i]],
    [L + 5.7, L + 8.7, [0]],
    [L + 8.7, CUES.Raw, [4]],
    [CUES.Raw, CUES.UseEoL, [0]],
    [CUES.UseEoL, CUES.Recycling, [2, 3]],
    [CUES.Recycling, CUES.Levers, [4]],
    [CUES.Levers, CUES.Outro, [0, 4]],
    [CUES.Outro, total + 1, [0, 1, 2, 3, 4]],
  ];
  let v = 0;
  segs.forEach(s => { if (s[2].indexOf(i) >= 0) v += env(T, s[0], s[1]); });
  return clamp(v, 0, 1);
}
function LCStrip({ T, CUES, total }) {
  const k = MOTION.enter(T, CUES.Raw - 1.0, 1.2);
  const L = (a, b) => a + (b - a) * k;
  const X = L(160, 1000), Y = L(330, 40), W = L(1600, 860), H = L(260, 64), G = L(24, 10);
  const bw = (W - 4 * G) / 5;
  return MODS.map((m, i) => {
    const a = MOTION.enter(T, CUES.LifeCycle + 0.3 + i * 0.35);
    if (a < 0.002) return null;
    const h = modHL(T, CUES, total, i);
    const isD = i === 4;
    const hc = isD ? C.green : C.ink;
    return (
      <div key={i} style={{ position: 'absolute', left: X + i * (bw + G), top: Y, width: bw, height: H, boxSizing: 'border-box',
        border: '1.5px solid ' + (h > 0.5 ? hc : C.line), background: h > 0.01 ? (isD ? al(C.green, 0.06 + 0.1 * h) : 'rgba(232,237,241,' + (0.03 + 0.09 * h) + ')') : C.panel,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', ...rise(a) }}>
        <div style={{ font: '600 ' + L(36, 24) + 'px ' + MONO, color: h > 0.5 ? hc : C.dim }}>{m.c}</div>
        <div style={{ height: L(150, 0), overflow: 'hidden', opacity: 1 - k, padding: '0 18px' }}>
          <div style={{ font: '600 32px/1.3 ' + TH, color: C.ink, marginTop: 10 }}>{m.th}</div>
          <div style={{ font: '400 25px/1.35 ' + TH, color: C.dim, marginTop: 8, textWrap: 'pretty' }}>{m.d}</div>
        </div>
      </div>
    );
  });
}

/* ---------------- sections ---------------- */
function Intro() {
  const { T, CUES } = useComposition();
  const s = CUES.Intro;
  return (
    <Sec from={s - 1} to={CUES.LifeCycle} zoom={0.04}>
      <div style={{ position: 'absolute', left: 160, top: 250, width: 1600 }}>
        <div style={{ font: '500 26px ' + MONO, color: C.dim, letterSpacing: '0.08em', ...rise(MOTION.enter(T, s + 0.3)) }}>LIFE CYCLE · EN 15804 · CRADLE TO CRADLE</div>
        <div style={{ font: '600 92px/1.12 ' + TH, color: C.ink, marginTop: 24, ...rise(MOTION.enter(T, s + 0.6, 0.9), 30) }}>จากแร่ สู่โครงสร้าง<br />และกลับมาอีกครั้ง</div>
        <div style={{ font: '400 34px/1.4 ' + TH, color: C.dim, marginTop: 28, maxWidth: 1300, ...rise(MOTION.enter(T, s + 1.2)) }}>กระบวนการผลิต เกรด การรีไซเคิล และการลดก๊าซเรือนกระจกของวัสดุโครงสร้างหลัก</div>
        <div style={{ height: 1.5, background: C.line, marginTop: 56, width: 1600 * MOTION.draw(T, s + 1.6, 1.4) }}></div>
        <div style={{ display: 'flex', gap: 40, marginTop: 36 }}>
          {MAT.map((m, i) => {
            const a = MOTION.pop(T, s + 2.2 + i * 0.3);
            return (
              <div key={m.k} style={{ display: 'flex', gap: 16, alignItems: 'center', width: 370, opacity: clamp(a, 0, 1), transform: 'translateY(' + ((1 - a) * 20) + 'px)' }}>
                <div style={{ width: 22, height: 22, background: m.c, transform: 'rotate(' + (45 * (1 - clamp(a, 0, 1))) + 'deg)' }}></div>
                <div>
                  <div style={{ font: '600 32px ' + TH, color: m.c }}>{m.th}</div>
                  <div style={{ font: '400 24px ' + MONO, color: C.dim }}>{m.en}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Sec>
  );
}

function LifeCycle() {
  const { T, CUES } = useComposition();
  const s = CUES.LifeCycle;
  const bx = i => 160 + i * (300.8 + 24);
  const g1 = MOTION.draw(T, s + 5, 0.8), g2 = MOTION.draw(T, s + 6.5, 1);
  const loop = MOTION.enter(T, s + 8.8, 0.8);
  const Br = ({ x1, x2, y, a, label, color }) => (
    <div style={{ position: 'absolute', left: x1, top: y, width: (x2 - x1) * a, height: 14, borderTop: '2px solid ' + color, borderLeft: '2px solid ' + color, borderRight: a > 0.98 ? '2px solid ' + color : 'none', opacity: a > 0 ? 1 : 0 }}>
      <div style={{ position: 'absolute', left: 0, top: -38, font: '500 24px ' + MONO, color, whiteSpace: 'nowrap', opacity: a }}>{label}</div>
    </div>
  );
  return (
    <Sec from={s} to={CUES.Raw + 0.2} zoom={0}>
      <div style={{ opacity: 1 - MOTION.enter(T, CUES.Raw - 1.4, 0.5) }}>
        <Br x1={bx(0)} x2={bx(0) + 300.8} y={300} a={g1} label="Cradle-to-Gate · A1–A3" color={C.ink} />
        <Br x1={bx(0)} x2={bx(3) + 300.8} y={234} a={g2} label="Cradle-to-Grave · A–C" color={C.dim} />
        <Wires T={T} items={[{ pts: [[bx(4) + 150, 594], [bx(4) + 150, 670], [bx(0) + 150, 670], [bx(0) + 150, 594]], color: C.green, p: loop, dashed: true }]} />
        <div style={{ position: 'absolute', left: 160, width: 1600, top: 690, textAlign: 'center', font: '500 26px ' + TH, color: C.green, ...rise(loop) }}>Cradle-to-Cradle · วัสดุกลับสู่การผลิตรอบใหม่</div>
      </div>
    </Sec>
  );
}

const RAW = [
  { items: [['หินปูน', 'CaCO₃'], ['ดินเหนียว / ดินดาน', 'SiO₂ · Al₂O₃ · Fe₂O₃'], ['ยิปซัม', 'CaSO₄·2H₂O'], ['ทราย หิน น้ำ', 'Aggregates + H₂O']], rx: 'CaCO₃ → CaO + CO₂', note: 'Calcination ≈ 60% ของ CO₂ จากปูนเม็ด', puff: true },
  { items: [['แร่เหล็ก', 'Fe₂O₃ / Fe₃O₄'], ['ถ่านโค้ก', 'C · ตัวรีดิวซ์'], ['หินปูน', 'Flux · CaCO₃'], ['เศษเหล็ก', 'Scrap → EAF']], rx: 'Fe₂O₃ + 3CO → 2Fe + 3CO₂', note: 'คาร์บอนเป็นทั้งเชื้อเพลิงและตัวรีดิวซ์', puff: true },
  { items: [['เศษสแตนเลส / เหล็ก', 'Scrap'], ['เฟอร์โรโครม', 'FeCr'], ['นิกเกิล', 'FeNi / NPI / Ni'], ['โมลิบดีนัม', 'Mo · สำหรับ 316']], rx: 'Cr ≥ 10.5% → ฟิล์ม Cr₂O₃', note: 'CO₂ แฝงสูงใน FeCr และ Ni', puff: false },
  { items: [['บอกไซต์', 'Bauxite'], ['โซดาไฟ', 'NaOH · Bayer'], ['ไครโอไลต์', 'Na₃AlF₆ · ตัวทำละลาย'], ['แอโนดคาร์บอน', 'C anode']], rx: '2Al₂O₃ + 3C → 4Al + 3CO₂', note: 'ไฟฟ้า 13–15 kWh ต่อ Al 1 kg', puff: true },
];
function Raw() {
  const { T, CUES } = useComposition();
  const s = CUES.Raw;
  return (
    <Sec from={s} to={CUES.Concrete}>
      {RAW.map((r, i) => {
        const m = MAT[i], x = COLX[i];
        const rxA = MOTION.enter(T, s + 6 + i * 0.6);
        return (
          <React.Fragment key={i}>
            <ColHead x={x} m={m} a={MOTION.enter(T, s + 0.6 + i * 0.35)} />
            <div style={{ position: 'absolute', left: x, top: 300, width: COLW, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {r.items.map((it, j) => (
                <div key={j} style={{ display: 'flex', gap: 14, ...rise(MOTION.enter(T, s + 1.6 + i * 0.35 + j * 0.3)) }}>
                  <div style={{ width: 10, height: 10, border: '2px solid ' + m.c, marginTop: 12, flex: 'none' }}></div>
                  <div>
                    <div style={{ font: '500 27px/1.25 ' + TH, color: C.ink }}>{it[0]}</div>
                    <div style={{ font: '400 24px/1.3 ' + MONO, color: C.dim }}>{it[1]}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', left: x, top: 640, width: COLW, boxSizing: 'border-box', padding: '22px 20px', border: '1.5px solid ' + C.line, background: C.panel, font: '500 26px/1.4 ' + MONO, color: C.ink, ...rise(rxA) }}>{hl(r.rx)}</div>
            {r.puff && <Puff x={x + COLW - 120} y={604} a={MOTION.pop(T, s + 7 + i * 0.6)} T={T} />}
            <div style={{ position: 'absolute', left: x, top: 790, width: COLW, font: '400 26px/1.4 ' + TH, color: i === 2 ? C.stainless : C.co2b, ...rise(MOTION.enter(T, s + 13.5 + i * 0.4)) }}>{r.note}</div>
          </React.Fragment>
        );
      })}
    </Sec>
  );
}

function Concrete() {
  const { T, CUES } = useComposition();
  const s = CUES.Concrete;
  const N = [
    ['เหมือง + บดวัตถุดิบ', 'Quarry · Raw mill'],
    ['Preheater / Calciner', '≈ 900 °C · CaCO₃→CaO', true],
    ['เตาเผาหมุน', 'Rotary kiln 1,450 °C', true],
    ['ปูนเม็ด', 'Clinker · C₃S C₂S'],
    ['บดปูนซีเมนต์', '+ ยิปซัม / SCM'],
    ['โรงผสมคอนกรีต', '+ ทราย หิน น้ำ สารผสม'],
  ];
  const w = 260, g = 38, y = 180, h = 150, x0 = 85;
  const nx = i => x0 + i * (w + g);
  const wires = N.slice(1).map((_, i) => ({ pts: [[nx(i) + w, y + h / 2], [nx(i + 1), y + h / 2]], color: C.concrete, p: MOTION.draw(T, s + 1.2 + i * 0.6, 0.6) }));
  const bp = MOTION.draw(T, s + 8.2, 1.8);
  const segs = [[60, C.co2, 'Calcination (CaCO₃ → CaO)'], [33, C.co2b, 'เชื้อเพลิงเผา'], [7, C.dim, 'ไฟฟ้า · บด · พัดลม']];
  const GR = [['C25/30', '25', '30', '≈ 280'], ['C30/37', '30', '37', '≈ 320'], ['C40/50', '40', '50', '≈ 390']];
  return (
    <Sec from={s} to={CUES.Steel} zoom={0.025} origin="50% 30%">
      <Wires T={T} items={wires} />
      {N.map((n, i) => <Node key={i} x={nx(i)} y={y} w={w} h={h} title={n[0]} sub={n[1]} hot={n[2]} color={n[2] ? C.co2 : C.concrete} a={MOTION.enter(T, s + 0.8 + i * 0.6)} T={T} />)}
      <Puff x={nx(1) + w - 110} y={136} a={MOTION.pop(T, s + 5)} T={T} />
      <Puff x={nx(2) + w - 110} y={136} a={MOTION.pop(T, s + 5.4)} T={T} />
      <Panel x={85} y={400} w={820} h={480} a={MOTION.enter(T, s + 7.6)}>
        <div style={{ font: '600 30px ' + TH, color: C.ink }}>ที่มาของ CO₂ ในปูนเม็ด</div>
        <div style={{ font: '600 44px ' + MONO, color: C.co2, marginTop: 8 }}>≈ 0.85 tCO₂ / t clinker</div>
        <div style={{ display: 'flex', marginTop: 26, height: 40, width: 766, background: 'rgba(255,255,255,0.04)' }}>
          {segs.map((sg, i) => <div key={i} style={{ width: 766 * sg[0] / 100 * clamp(bp * 3 - i, 0, 1), background: sg[1], borderRight: '2px solid ' + C.bg }}></div>)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          {segs.map((sg, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', ...rise(MOTION.enter(T, s + 8.6 + i * 0.5)) }}>
              <div style={{ width: 16, height: 16, background: sg[1] }}></div>
              <div style={{ font: '600 26px ' + MONO, color: C.ink, width: 80 }}>{sg[0]}%</div>
              <div style={{ font: '400 26px ' + TH, color: C.dim }}>{sg[2]}</div>
            </div>
          ))}
        </div>
        <div style={{ font: '500 27px/1.4 ' + TH, color: C.co2b, marginTop: 26, ...rise(MOTION.enter(T, s + 15)) }}>ซีเมนต์ ≈ 10–15% ของน้ำหนักคอนกรีต แต่เป็นที่มาของ CO₂ ≈ 85–90%</div>
      </Panel>
      <Panel x={985} y={400} w={850} h={480} a={MOTION.enter(T, s + 11)}>
        <div style={{ font: '600 30px ' + TH, color: C.ink }}>เกรดกำลังอัด · ตัวอย่างคาร์บอน (OPC 100%)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '190px 150px 150px 1fr', marginTop: 20, font: '400 24px ' + MONO, color: C.dim, borderBottom: '1.5px solid ' + C.line, paddingBottom: 10 }}>
          <div>Class</div><div>f'ck cyl</div><div>f'ck cube</div><div>kgCO₂e/m³</div>
        </div>
        {GR.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '190px 150px 150px 1fr', font: '500 28px ' + MONO, color: C.ink, padding: '14px 0', borderBottom: '1.5px solid ' + C.line, ...rise(MOTION.enter(T, s + 11.6 + i * 0.4)) }}>
            <div style={{ color: C.concrete }}>{r[0]}</div><div>{r[1]} MPa</div><div>{r[2]} MPa</div><div style={{ color: C.co2b }}>{r[3]}</div>
          </div>
        ))}
        <div style={{ font: '400 24px/1.5 ' + MONO, color: C.dim, marginTop: 20, ...rise(MOTION.enter(T, s + 13)) }}>Ec ≈ 4,700√f'c MPa (ACI 318)<br />ft ≈ 0.10 f'c · ρ ≈ 2.4 t/m³</div>
      </Panel>
    </Sec>
  );
}

function Steel() {
  const { T, CUES } = useComposition();
  const s = CUES.Steel;
  const LANES = [
    { y: 180, name: 'BF–BOF', val: '≈ 2.2 tCO₂/t', vc: C.co2, t: s + 0.8, nodes: [['Coke oven + Sinter', 'เตรียมโค้ก / แร่'], ['Blast Furnace', '≈1,500 °C → Pig iron', true], ['BOF', 'เป่า O₂ ลดคาร์บอน'], ['Casting + Rolling', 'หล่อต่อเนื่อง · รีด']] },
    { y: 390, name: 'Scrap-EAF', val: '≈ 0.4–0.7 tCO₂/t', vc: C.co2b, t: s + 7.5, nodes: [['Scrap / DRI', 'เศษเหล็ก + เหล็กพรุน'], ['Electric Arc Furnace', '≈1,600 °C · ไฟฟ้า'], ['Ladle furnace', 'ปรับส่วนผสม'], ['Casting + Rolling', 'หล่อต่อเนื่อง · รีด']] },
    { y: 600, name: 'H₂-DRI', val: '≈ 0.1–0.4 tCO₂/t', vc: C.green, t: s + 14.5, dashed: true, nodes: [['Iron ore pellets', 'Fe₂O₃'], ['Shaft furnace', 'H₂ แทนคาร์บอน'], ['EAF', 'ไฟฟ้าหมุนเวียน'], ['Casting + Rolling', 'หล่อต่อเนื่อง · รีด']] },
  ];
  const w = 220, g = 36, h = 140, x0 = 330;
  const nx = i => x0 + i * (w + g);
  const wires = [];
  LANES.forEach(L => L.nodes.slice(1).forEach((_, i) => wires.push({ pts: [[nx(i) + w, L.y + h / 2], [nx(i + 1), L.y + h / 2]], color: L.dashed ? C.green : C.steel, p: MOTION.draw(T, L.t + 0.6 + i * 0.5, 0.5), dashed: L.dashed })));
  const GR = [['SR24', 'มอก. 20 · เหล็กเส้นกลม', 'fy ≥ 235 · fu ≥ 385'], ['SD40', 'มอก. 24 · เหล็กข้ออ้อย', 'fy ≥ 390 · fu ≥ 560'], ['SD50', 'มอก. 24 · เหล็กข้ออ้อย', 'fy ≥ 490 · fu ≥ 620'], ['SS400', 'JIS G3101 · รูปพรรณ', 'fy ≥ 245 · fu 400–510'], ['S355', 'EN 10025 · รูปพรรณ', 'fy ≥ 355 · fu 470–630']];
  return (
    <Sec from={s} to={CUES.Stainless} zoom={0.025} origin="30% 40%">
      <Wires T={T} items={wires} />
      {LANES.map((L, li) => (
        <React.Fragment key={li}>
          <div style={{ position: 'absolute', left: 85, top: L.y + 18, width: 230, ...rise(MOTION.enter(T, L.t)) }}>
            <div style={{ font: '600 32px ' + MONO, color: L.dashed ? C.green : C.steel }}>{L.name}</div>
            <div style={{ font: '600 24px/1.3 ' + MONO, color: L.vc, marginTop: 8 }}>{L.val}</div>
          </div>
          {L.nodes.map((n, i) => <Node key={i} x={nx(i)} y={L.y} w={w} h={h} title={n[0]} sub={n[1]} hot={n[2]} dashed={L.dashed} color={L.dashed ? C.green : C.steel} a={MOTION.enter(T, L.t + 0.3 + i * 0.5)} T={T} />)}
        </React.Fragment>
      ))}
      <Puff x={nx(1) + w - 110} y={140} a={MOTION.pop(T, s + 3.5)} T={T} />
      <div style={{ position: 'absolute', left: 330, top: 770, font: '500 27px ' + MONO, color: C.ink, ...rise(MOTION.enter(T, s + 16.5)) }}>{hl('Fe₂O₃ + 3H₂ → 2Fe + 3H₂O')}<span style={{ fontFamily: TH, color: C.dim }}>  — ปล่อยไอน้ำแทน CO₂</span></div>
      <Panel x={1370} y={180} w={465} h={700} a={MOTION.enter(T, s + 10)}>
        <div style={{ font: '600 30px ' + TH, color: C.ink }}>เกรดเหล็กโครงสร้าง</div>
        <div style={{ font: '400 24px ' + MONO, color: C.dim, marginTop: 4 }}>MPa · ค่าต่ำสุดตามมาตรฐาน</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
          {GR.map((r, i) => (
            <div key={i} style={{ borderTop: '1.5px solid ' + C.line, paddingTop: 12, ...rise(MOTION.enter(T, s + 10.5 + i * 0.4)) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <div style={{ font: '700 28px ' + MONO, color: C.steel }}>{r[0]}</div>
                <div style={{ font: '400 22px ' + TH, color: C.dim }}>{r[1]}</div>
              </div>
              <div style={{ font: '500 24px ' + MONO, color: C.ink, marginTop: 4 }}>{r[2]}</div>
            </div>
          ))}
        </div>
        <div style={{ font: '400 24px ' + MONO, color: C.dim, marginTop: 20 }}>E = 200 GPa · ρ = 7.85 t/m³</div>
      </Panel>
    </Sec>
  );
}

function Bar({ label, v, max, c, w = 300, a }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ font: '500 24px ' + MONO, color: C.dim, width: 44 }}>{label}</div>
      <div style={{ width: w, height: 14, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: w * clamp(v / max, 0, 1) * a, height: 14, background: c }}></div>
      </div>
    </div>
  );
}

function Stainless() {
  const { T, CUES } = useComposition();
  const s = CUES.Stainless;
  const N = [['วัตถุดิบ', 'Scrap + FeCr + Ni'], ['EAF', 'หลอม ≈1,600 °C', true], ['AOD', 'Ar/O₂ · C < 0.03%'], ['Continuous casting', 'Slab'], ['รีดร้อน', 'Hot rolling'], ['รีดเย็น + อบ', 'Anneal · Pickle 2B/BA']];
  const w = 260, g = 38, y = 170, h = 150, x0 = 85;
  const nx = i => x0 + i * (w + g);
  const wires = N.slice(1).map((_, i) => ({ pts: [[nx(i) + w, y + h / 2], [nx(i + 1), y + h / 2]], color: C.stainless, p: MOTION.draw(T, s + 1.2 + i * 0.6, 0.6) }));
  const G = [
    { n: '304', id: '1.4301 · Austenitic', t: s + 7.5, cr: 19, ni: 9.25, mo: 0, crt: '18–20', nit: '8–10.5', mot: '—', p1: 'Rp0.2 ≥ 205 · Rm ≥ 515 MPa', p2: 'PREN ≈ 19 · ไม่ดูดแม่เหล็ก · งานทั่วไป ราวจับ ครัว' },
    { n: '316', id: '1.4401 · Austenitic', t: s + 9.5, cr: 17, ni: 12, mo: 2.5, crt: '16–18', nit: '10–14', mot: '2–3', p1: 'Rp0.2 ≥ 205 · Rm ≥ 515 MPa', p2: 'PREN ≈ 24 · ทนคลอไรด์ ชายทะเล สระว่ายน้ำ' },
    { n: '430', id: '1.4016 · Ferritic', t: s + 14.5, cr: 17, ni: 0.5, mo: 0, crt: '16–18', nit: '≤ 0.75', mot: '—', p1: 'Rp0.2 ≥ 205 · Rm ≥ 450 MPa', p2: 'ดูดแม่เหล็ก · ไม่มี Ni → ราคาและ CO₂ ต่ำกว่า' },
  ];
  return (
    <Sec from={s} to={CUES.Aluminium} zoom={0.025} origin="50% 60%">
      <Wires T={T} items={wires} />
      {N.map((n, i) => <Node key={i} x={nx(i)} y={y} w={w} h={h} title={n[0]} sub={n[1]} hot={n[2]} color={n[2] ? C.co2 : C.stainless} a={MOTION.enter(T, s + 0.8 + i * 0.6)} T={T} />)}
      {G.map((gd, i) => {
        const a = MOTION.enter(T, gd.t);
        const ba = MOTION.draw(T, gd.t + 0.4, 1);
        return (
          <Panel key={i} x={85 + i * 595} y={390} w={560} h={470} a={a}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <div style={{ font: '700 60px/1 ' + MONO, color: C.stainless }}>{gd.n}</div>
              <div style={{ font: '400 24px ' + MONO, color: C.dim }}>{gd.id}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 26 }}>
              {[['Cr', gd.cr, gd.crt], ['Ni', gd.ni, gd.nit], ['Mo', gd.mo, gd.mot]].map(r => (
                <div key={r[0]} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Bar label={r[0]} v={r[1]} max={22} c={C.stainless} w={300} a={ba} />
                  <div style={{ font: '500 24px ' + MONO, color: C.ink }}>{r[2] === '—' ? '—' : r[2] + '%'}</div>
                </div>
              ))}
            </div>
            <div style={{ font: '500 25px ' + MONO, color: C.ink, marginTop: 26 }}>{gd.p1}</div>
            <div style={{ font: '400 25px/1.4 ' + TH, color: C.dim, marginTop: 10, textWrap: 'pretty' }}>{gd.p2}</div>
          </Panel>
        );
      })}
      <div style={{ position: 'absolute', left: 85, top: 890, font: '500 26px ' + TH, color: C.co2b, ...rise(MOTION.enter(T, s + 17)) }}>นิกเกิลเป็นตัวขับคาร์บอนหลัก · 304 ≈ 2.8 tCO₂e/t (เฉลี่ยโลก) · Recycled content เฉลี่ย ≈ 60%</div>
    </Sec>
  );
}

function Aluminium() {
  const { T, CUES } = useComposition();
  const s = CUES.Aluminium;
  const N = [['เหมืองบอกไซต์', 'Bauxite'], ['Bayer refinery', 'NaOH → Al₂O₃'], ['Hall–Héroult', '≈ 960 °C · 13–15 kWh/kg', true], ['หล่อ Billet / Slab', 'Casting'], ['Extrusion / Rolling', 'รีดขึ้นรูป']];
  const w = 300, g = 50, y = 160, h = 140, x0 = 110;
  const nx = i => x0 + i * (w + g);
  const wires = N.slice(1).map((_, i) => ({ pts: [[nx(i) + w, y + h / 2], [nx(i + 1), y + h / 2]], color: C.alu, p: MOTION.draw(T, s + 1.2 + i * 0.6, 0.6) }));
  const rl = MOTION.enter(T, s + 5);
  wires.push({ pts: [[nx(4) + w / 2, y + h], [nx(4) + w / 2, 375], [nx(3) + w, 375]], color: C.green, p: rl, dashed: true });
  wires.push({ pts: [[nx(3) + w / 2, 330], [nx(3) + w / 2, y + h]], color: C.green, p: rl, dashed: true });
  const chips = [['Primary · เฉลี่ยโลก', '≈ 16', C.co2, s + 9], ['Primary · พลังน้ำ', '≈ 4', C.co2b, s + 10], ['Recycled', '≈ 0.6', C.green, s + 11]];
  const G = [
    { n: '1100-H14', f: '≥ 99.0% Al · Non-heat-treatable', rp: 117, rm: 124, u: 'ฟอยล์ แผ่นสะท้อน งานไฟฟ้า' },
    { n: '6063-T6', f: 'Al-Mg-Si · Extrusion', rp: 214, rm: 241, u: 'กรอบหน้าต่าง Curtain wall' },
    { n: '6061-T6', f: 'Al-Mg-Si-Cu', rp: 276, rm: 310, u: 'โครงสร้าง ข้อต่อ แผ่นรับแรง' },
    { n: '7075-T6', f: 'Al-Zn-Mg-Cu', rp: 503, rm: 572, u: 'อากาศยาน งานรับแรงสูง' },
  ];
  return (
    <Sec from={s} to={CUES.Compare} zoom={0.025} origin="50% 40%">
      <Wires T={T} items={wires} />
      {N.map((n, i) => <Node key={i} x={nx(i)} y={y} w={w} h={h} title={n[0]} sub={n[1]} hot={n[2]} color={n[2] ? C.co2 : C.alu} a={MOTION.enter(T, s + 0.8 + i * 0.6)} T={T} />)}
      <Puff x={nx(2) + 20} y={118} a={MOTION.pop(T, s + 4)} T={T} />
      <Node x={nx(3)} y={330} w={w} h={90} title="หลอมเศษ (Remelt)" sub="≈ 5% ของพลังงาน" color={C.green} dashed a={rl} T={T} />
      <div style={{ position: 'absolute', left: 110, top: 340, display: 'flex', gap: 20 }}>
        {chips.map((c, i) => (
          <div key={i} style={{ border: '1.5px solid ' + c[2], padding: '8px 16px', background: C.panel, ...rise(MOTION.enter(T, c[3])) }}>
            <div style={{ font: '400 22px ' + TH, color: C.dim }}>{c[0]}</div>
            <div style={{ font: '600 30px ' + MONO, color: c[2] }}>{c[1]} <span style={{ font: '400 22px ' + MONO }}>tCO₂e/t</span></div>
          </div>
        ))}
      </div>
      {G.map((gd, i) => {
        const a = MOTION.enter(T, s + 14 + i * 0.6);
        const ba = MOTION.draw(T, s + 14.4 + i * 0.6, 1);
        return (
          <Panel key={i} x={110 + i * 436} y={480} w={400} h={400} a={a}>
            <div style={{ font: '700 40px ' + MONO, color: C.alu }}>{gd.n}</div>
            <div style={{ font: '400 22px/1.3 ' + MONO, color: C.dim, marginTop: 6, minHeight: 58 }}>{gd.f}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Bar label="Rp" v={gd.rp} max={600} c={C.alu} w={200} a={ba} /><div style={{ font: '500 24px ' + MONO, color: C.ink }}>{gd.rp}</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Bar label="Rm" v={gd.rm} max={600} c={C.alu} w={200} a={ba} /><div style={{ font: '500 24px ' + MONO, color: C.ink }}>{gd.rm}</div></div>
            </div>
            <div style={{ font: '400 25px/1.4 ' + TH, color: C.ink, marginTop: 22, textWrap: 'pretty' }}>{gd.u}</div>
          </Panel>
        );
      })}
      <div style={{ position: 'absolute', left: 110, top: 900, font: '400 24px ' + MONO, color: C.dim, ...rise(MOTION.enter(T, s + 17)) }}>MPa · ค่า typical · E ≈ 70 GPa (≈ 1/3 ของเหล็ก) · ρ = 2.70 t/m³</div>
    </Sec>
  );
}

function Compare() {
  const { T, CUES } = useComposition();
  const s = CUES.Compare;
  const R = [
    ['คอนกรีต C30/37', '≈ 320 kg/m³', 0.13, C.concrete],
    ['เหล็ก Scrap-EAF', 'Rebar / Section', 0.6, C.steel],
    ['เหล็ก BF–BOF', 'Virgin route', 2.2, C.steel],
    ['สแตนเลส 304', 'Global average', 2.8, C.stainless],
    ['อะลูมิเนียมรีไซเคิล', 'Secondary', 0.6, C.alu],
    ['อะลูมิเนียมใหม่', 'Primary · global', 16, C.alu],
  ];
  const BW = 1080, X0 = 600;
  const S = [['≈ 7–8%', 'ของ CO₂ โลก จากซีเมนต์', C.concrete], ['≈ 7–9%', 'จากเหล็กกล้า', C.steel], ['≈ 2%', 'จากอะลูมิเนียม', C.alu]];
  return (
    <Sec from={s} to={CUES.UseEoL} zoom={0.02}>
      <div style={{ position: 'absolute', left: X0, top: 160, width: BW, display: 'flex', justifyContent: 'space-between', font: '400 24px ' + MONO, color: C.dim, ...rise(MOTION.enter(T, s + 0.5)) }}>
        {[0, 4, 8, 12, 16].map(v => <div key={v}>{v}</div>)}
      </div>
      {R.map((r, i) => {
        const p = MOTION.draw(T, s + 0.8 + i * 0.45, i === 5 ? 2 : 1.1);
        const a = MOTION.enter(T, s + 0.6 + i * 0.45);
        const ww = Math.max(4, BW * r[2] / 16 * p);
        return (
          <div key={i} style={{ position: 'absolute', left: 85, top: 210 + i * 88, width: 1750, height: 70, display: 'flex', alignItems: 'center', ...rise(a) }}>
            <div style={{ width: 515 }}>
              <div style={{ font: '600 28px ' + TH, color: C.ink }}>{r[0]}</div>
              <div style={{ font: '400 22px ' + MONO, color: C.dim }}>{r[1]}</div>
            </div>
            <div style={{ width: ww, height: 38, background: r[3] }}></div>
            <div style={{ font: '600 30px ' + MONO, color: r[3], marginLeft: 16 }}>{(r[2] * p).toFixed(r[2] < 1 ? 2 : 1)}</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 85, top: 760, display: 'flex', gap: 60 }}>
        {S.map((st, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 16, ...rise(MOTION.enter(T, s + 8 + i * 0.5)) }}>
            <div style={{ font: '600 50px ' + MONO, color: st[2] }}>{st[0]}</div>
            <div style={{ font: '400 27px ' + TH, color: C.dim }}>{st[1]}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 85, top: 880, font: '400 24px ' + MONO, color: C.dim, ...rise(MOTION.enter(T, s + 10)) }}>ค่าชี้นำ A1–A3 (ค่าเฉลี่ยโลกโดยประมาณ, tCO₂e/t) · ใช้ EPD ของผลิตภัณฑ์จริงในการออกแบบ</div>
    </Sec>
  );
}

const USE = [
  { b: ['อายุออกแบบ 50–100 ปี', 'Carbonation ดูดซับ CO₂ กลับบางส่วน'], c: ['รื้อถอน → บดเป็น RCA', 'มวลรวม / งานถนน (Downcycle)'] },
  { b: ['ป้องกันสนิม: ทาสี / ชุบสังกะสี', 'โครงเหล็กถอดประกอบ Reuse ได้'], c: ['คัดแยกด้วยแม่เหล็ก', 'เก็บกลับในงานก่อสร้าง ≈ 85–90%'] },
  { b: ['ไม่ต้องเคลือบ บำรุงรักษาต่ำ', 'อายุยาว ลดภาระ B2–B4'], c: ['เศษมีมูลค่าสูง (Ni, Cr)', 'เก็บกลับ ≈ 80–90% → หลอมใหม่'] },
  { b: ['เบา ลดพลังงานขนส่ง A4', 'Anodize / Powder coat ทนทาน'], c: ['คัดแยกด้วย Eddy current', 'อาคาร: เก็บกลับ > 90%'] },
];
function Bullets({ x, y, title, items, c, T, t0 }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: COLW }}>
      <div style={{ font: '500 24px ' + MONO, color: C.dim, borderBottom: '1.5px solid ' + C.line, paddingBottom: 8, ...rise(MOTION.enter(T, t0)) }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
        {items.map((it, j) => (
          <div key={j} style={{ display: 'flex', gap: 14, ...rise(MOTION.enter(T, t0 + 0.4 + j * 0.35)) }}>
            <div style={{ width: 10, height: 10, background: c, marginTop: 13, flex: 'none' }}></div>
            <div style={{ font: '400 27px/1.4 ' + TH, color: C.ink, textWrap: 'pretty' }}>{it}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function UseEoL() {
  const { T, CUES } = useComposition();
  const s = CUES.UseEoL;
  return (
    <Sec from={s} to={CUES.Recycling}>
      {USE.map((u, i) => (
        <React.Fragment key={i}>
          <ColHead x={COLX[i]} m={MAT[i]} a={MOTION.enter(T, s + 0.5 + i * 0.3)} />
          <Bullets x={COLX[i]} y={320} title="B · ช่วงใช้งาน" items={u.b} c={MAT[i].c} T={T} t0={s + 1.5 + i * 0.4} />
          <Bullets x={COLX[i]} y={600} title="C · สิ้นอายุ" items={u.c} c={MAT[i].c} T={T} t0={s + 7 + i * 0.4} />
        </React.Fragment>
      ))}
    </Sec>
  );
}

function Recycling() {
  const { T, CUES } = useComposition();
  const s = CUES.Recycling;
  const cx = 520, cy = 560, r = 240;
  const ring = MOTION.draw(T, s + 0.4, 1.6);
  const ST = [[-90, 'ผลิต · A1–A3'], [0, 'ใช้งาน · B'], [90, 'รื้อถอน · C'], [180, 'หลอมใหม่ · D']];
  const pos = (deg, rr) => [cx + rr * Math.cos(deg * Math.PI / 180), cy + rr * Math.sin(deg * Math.PI / 180)];
  const R = [
    [C.alu, 'อะลูมิเนียม', 'ประหยัดพลังงาน', 95, '≈ 95%', 'หลอมเศษใช้พลังงาน ≈ 5% ของ Primary'],
    [C.steel, 'เหล็ก', 'ลด CO₂ · EAF vs BF–BOF', 72, '≈ 70–75%', 'Closed loop · กลับมาเป็นเกรดเดิมได้'],
    [C.stainless, 'สแตนเลส', 'Recycled content เฉลี่ย', 60, '≈ 60%', 'เศษแทน FeCr / Ni ใหม่ · มูลค่าสูง'],
    [C.concrete, 'คอนกรีต', 'ลด CO₂', null, 'จำกัด', 'RCA ลดการขุดหินและฝังกลบ — CO₂ อยู่ที่ซีเมนต์'],
  ];
  return (
    <Sec from={s} to={CUES.Levers} zoom={0.02} origin="30% 50%">
      <svg width="1920" height="1080" style={{ position: 'absolute', left: 0, top: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.line} strokeWidth="2" pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - ring} transform={'rotate(-90 ' + cx + ' ' + cy + ')'} />
        <circle cx={cx} cy={cy} r={r - 30} fill="none" stroke={al(C.green, 0.5)} strokeWidth="1.5" strokeDasharray="6 10" strokeDashoffset={-T * 20} opacity={ring} />
        {ST.map((st, i) => { const q = pos(st[0], r); return <rect key={i} x={q[0] - 8} y={q[1] - 8} width="16" height="16" fill={C.bg} stroke={C.ink} strokeWidth="2" opacity={MOTION.enter(T, s + 0.8 + i * 0.4)} />; })}
        {MAT.map((m, i) => { const q = pos(-90 + (T - s) * 36 + i * 90, r); return <circle key={m.k} cx={q[0]} cy={q[1]} r="11" fill={m.c} opacity={ring} />; })}
      </svg>
      {ST.map((st, i) => {
        const q = pos(st[0], r + 34);
        const a = MOTION.enter(T, s + 0.8 + i * 0.4);
        const st2 = st[0] === -90 ? { left: q[0] - 200, top: q[1] - 46, width: 400, textAlign: 'center' }
          : st[0] === 90 ? { left: q[0] - 200, top: q[1] + 4, width: 400, textAlign: 'center' }
          : st[0] === 0 ? { left: q[0], top: q[1] - 20 } : { left: q[0] - 260, top: q[1] - 20, width: 260, textAlign: 'right' };
        return <div key={i} style={{ position: 'absolute', ...st2, font: '500 27px ' + TH, color: i === 3 ? C.green : C.ink, opacity: a }}>{st[1]}</div>;
      })}
      <div style={{ position: 'absolute', left: cx - 160, top: cy - 50, width: 320, textAlign: 'center', ...rise(MOTION.enter(T, s + 2)) }}>
        <div style={{ font: '600 42px ' + MONO, color: C.green }}>Module D</div>
        <div style={{ font: '400 25px/1.35 ' + TH, color: C.dim, marginTop: 6 }}>เครดิตจากการนำกลับมาใช้</div>
      </div>
      <div style={{ position: 'absolute', left: 1000, top: 180, width: 835, display: 'flex', flexDirection: 'column', gap: 30 }}>
        {R.map((row, i) => {
          const t0 = s + 4 + i * 2.6;
          const a = MOTION.enter(T, t0), p = MOTION.draw(T, t0 + 0.3, 1.2);
          return (
            <div key={i} style={{ ...rise(a) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                  <div style={{ font: '600 30px ' + TH, color: row[0] }}>{row[1]}</div>
                  <div style={{ font: '400 22px ' + MONO, color: C.dim }}>{row[2]}</div>
                </div>
                <div style={{ font: '600 34px ' + MONO, color: row[3] == null ? C.dim : C.green }}>{row[4]}</div>
              </div>
              <div style={{ height: 14, marginTop: 10, background: 'rgba(255,255,255,0.06)', border: row[3] == null ? '1.5px dashed ' + C.line : 'none' }}>
                {row[3] != null && <div style={{ height: 14, width: 835 * row[3] / 100 * p, background: C.green }}></div>}
              </div>
              <div style={{ font: '400 25px ' + TH, color: C.dim, marginTop: 10 }}>{row[5]}</div>
            </div>
          );
        })}
      </div>
    </Sec>
  );
}

const LEV = [
  { m: 0, unit: 'kgCO₂e/m³ · C30/37', base: 330, dp: 0, steps: [[90, 'SCM: เถ้าลอย · GGBFS · ดินเผา LC3'], [35, 'ปูนไฮดรอลิก / Portland-limestone (มอก. 2594)'], [35, 'เชื้อเพลิงทดแทน + ประสิทธิภาพเตา'], [110, 'CCUS ที่โรงปูน']] },
  { m: 1, unit: 'tCO₂e/t', base: 2.2, dp: 2, steps: [[1.5, 'เปลี่ยนเส้นทาง: Scrap-EAF / H₂-DRI'], [0.3, 'ไฟฟ้าหมุนเวียนสำหรับ EAF'], [0.15, 'CCUS สำหรับ BF ที่ยังเหลือ']] },
  { m: 2, unit: 'tCO₂e/t · 304', base: 2.8, dp: 1, steps: [[0.8, 'เพิ่มสัดส่วน Scrap'], [0.5, 'ไฟฟ้าหมุนเวียน'], [0.6, 'FeCr / Ni คาร์บอนต่ำ']] },
  { m: 3, unit: 'tCO₂e/t', base: 16, dp: 1, steps: [[12, 'ถลุงด้วยไฟฟ้าพลังน้ำ / หมุนเวียน'], [1.5, 'Inert anode — ไม่ปล่อย CO₂ ที่แอโนด'], [1.9, 'Recycled content สูง']] },
];
function Levers() {
  const { T, CUES } = useComposition();
  const s = CUES.Levers;
  const BW = 770;
  return (
    <Sec from={s} to={CUES.Outro} zoom={0.015}>
      {LEV.map((L, i) => {
        const m = MAT[L.m];
        const t0 = s + 1.5 + i * 6.5;
        const x = i % 2 ? 975 : 85, y = i < 2 ? 160 : 530;
        const ps = L.steps.map((st, j) => MOTION.draw(T, t0 + 1.2 + j * 1.2, 0.9));
        let rem = L.base;
        L.steps.forEach((st, j) => { rem -= st[0] * ps[j]; });
        let cursor = rem;
        const segs = L.steps.map((st, j) => { const wv = st[0] * ps[j]; const seg = { left: cursor, w: wv }; cursor += wv; return seg; });
        const done = ps[ps.length - 1];
        return (
          <Panel key={i} x={x} y={y} w={860} h={350} a={MOTION.enter(T, t0)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                <div style={{ font: '600 32px ' + TH, color: m.c }}>{m.th}</div>
                <div style={{ font: '400 22px ' + MONO, color: C.dim }}>{L.unit}</div>
              </div>
              <div style={{ font: '600 32px ' + MONO, color: C.ink }}>
                <span style={{ color: C.dim }}>{L.base.toFixed(L.dp)} → </span><span style={{ color: done > 0.5 ? C.green : C.ink }}>{rem.toFixed(L.dp)}</span>
              </div>
            </div>
            <div style={{ position: 'relative', height: 40, marginTop: 18, width: BW }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: 40, width: BW * rem / L.base, background: m.c }}></div>
              {segs.map((sg, j) => <div key={j} style={{ position: 'absolute', top: 0, height: 40, left: BW * sg.left / L.base, width: BW * sg.w / L.base, boxSizing: 'border-box', border: sg.w > 0 ? '1.5px solid ' + C.green : 'none', background: al(C.green, 0.18) }}></div>)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
              {L.steps.map((st, j) => (
                <div key={j} style={{ display: 'flex', gap: 16, alignItems: 'baseline', ...rise(MOTION.enter(T, t0 + 1.1 + j * 1.2)) }}>
                  <div style={{ font: '600 24px ' + MONO, color: C.green, width: 100 }}>−{st[0]}</div>
                  <div style={{ font: '400 25px ' + TH, color: C.ink }}>{st[1]}</div>
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
      <div style={{ position: 'absolute', left: 85, top: 900, font: '400 24px ' + MONO, color: C.dim, ...rise(MOTION.enter(T, s + 4)) }}>เส้นทางชี้นำ (indicative) จากแผน Net-zero ของอุตสาหกรรม · ไม่ใช่ค่าออกแบบ</div>
    </Sec>
  );
}

function Outro() {
  const { T, CUES } = useComposition();
  const s = CUES.Outro;
  const I = [
    ['01', 'ระบุ EPD (EN 15804 / ISO 14025) และเพดาน kgCO₂e ในสเปก'],
    ['02', 'คอนกรีต: ปูนไฮดรอลิก + SCM ออกแบบกำลังและปริมาณให้พอดี'],
    ['03', 'โลหะ: ระบุ Recycled content และเส้นทางผลิตคาร์บอนต่ำ'],
    ['04', 'Design for disassembly → เก็บคุณค่าไว้ใน Module D'],
  ];
  return (
    <Sec from={s} to={CUES.Outro + 99} zoom={0.03}>
      <div style={{ position: 'absolute', left: 160, top: 220, font: '600 60px/1.2 ' + TH, color: C.ink, ...rise(MOTION.enter(T, s + 0.4, 0.9), 24) }}>วัสดุที่ดีที่สุด คือวัสดุที่ถูกวัด<br />และถูกนำกลับมาใช้</div>
      <div style={{ position: 'absolute', left: 160, top: 450, width: 1600, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px 60px' }}>
        {I.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 22, borderTop: '1.5px solid ' + C.line, paddingTop: 20, ...rise(MOTION.enter(T, s + 1.6 + i * 0.5)) }}>
            <div style={{ font: '600 28px ' + MONO, color: C.green }}>{it[0]}</div>
            <div style={{ font: '400 30px/1.4 ' + TH, color: C.ink, textWrap: 'pretty' }}>{it[1]}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 160, top: 800, display: 'flex', gap: 28, ...rise(MOTION.enter(T, s + 4)) }}>
        {MAT.map(m => <div key={m.k} style={{ width: 22, height: 22, background: m.c }}></div>)}
      </div>
    </Sec>
  );
}

function captionsFor(CUES) {
  const c = CUES;
  return [
    { at: c.Intro + 0.8, until: c.LifeCycle - 0.3, text: 'วัสดุ 4 ชนิดที่สร้างเมืองของเรา — ผลิตอย่างไร ปล่อยคาร์บอนเท่าไร และลดได้อย่างไร' },
    { at: c.LifeCycle + 0.5, text: 'EN 15804 แบ่งวัฏจักรชีวิตเป็นโมดูล A1–A3 (ผลิต) จนถึง D (นอกขอบเขตระบบ)' },
    { at: c.LifeCycle + 5, text: 'Cradle-to-Gate (A1–A3) มักเป็นส่วนที่ปล่อยคาร์บอนมากที่สุดของวัสดุโครงสร้าง' },
    { at: c.LifeCycle + 9, until: c.Raw - 0.2, text: 'Module D รายงานแยก — เป็นเครดิตจาก Reuse และ Recycle หลังสิ้นอายุ' },
    { at: c.Raw + 0.5, text: 'A1 · ทุกวัสดุเริ่มจากแร่ที่ต้องเปลี่ยนสภาพทางเคมี' },
    { at: c.Raw + 7, text: 'ปูนปล่อย CO₂ จากหินปูนเอง ส่วนเหล็กและอะลูมิเนียมใช้คาร์บอนดึงออกซิเจนออกจากแร่' },
    { at: c.Raw + 14, until: c.Concrete - 0.2, text: 'สแตนเลสทนสนิมด้วยโครเมียม ≥ 10.5% แต่ FeCr และนิกเกิลมีคาร์บอนแฝงสูง' },
    { at: c.Concrete + 0.5, text: 'ปูนซีเมนต์: บดวัตถุดิบ → เผาที่ 1,450 °C ในเตาหมุน → ได้ปูนเม็ด (Clinker)' },
    { at: c.Concrete + 8, text: 'ราว 60% ของ CO₂ มาจาก Calcination — เปลี่ยนเชื้อเพลิงอย่างเดียวจึงลดไม่หมด' },
    { at: c.Concrete + 15, until: c.Steel - 0.2, text: 'ซีเมนต์มีเพียง 10–15% ของน้ำหนักคอนกรีต แต่เป็นที่มาของคาร์บอนเกือบทั้งหมด' },
    { at: c.Steel + 0.5, text: 'BF–BOF ใช้ถ่านโค้กรีดิวซ์แร่เหล็ก — ราว 2.2 tCO₂ ต่อเหล็ก 1 ตัน' },
    { at: c.Steel + 7.5, text: 'Scrap-EAF หลอมเศษเหล็กด้วยไฟฟ้า เหลือ 0.4–0.7 ตัน ขึ้นกับไฟฟ้าในระบบ' },
    { at: c.Steel + 14.5, until: c.Stainless - 0.2, text: 'H₂-DRI ใช้ไฮโดรเจนสีเขียวแทนคาร์บอน — ผลพลอยได้คือไอน้ำ' },
    { at: c.Stainless + 0.5, text: 'สแตนเลส: หลอมใน EAF แล้วลดคาร์บอนใน AOD ด้วยอาร์กอน-ออกซิเจน' },
    { at: c.Stainless + 7.5, text: '304 และ 316 เป็นออสเทนนิติก — 316 เติม Mo จึงทนคลอไรด์ได้ดีกว่า' },
    { at: c.Stainless + 14.5, until: c.Aluminium - 0.2, text: '430 เป็นเฟอร์ริติก ไม่มีนิกเกิล — ดูดแม่เหล็ก ราคาและคาร์บอนต่ำกว่า' },
    { at: c.Aluminium + 0.5, text: 'อะลูมิเนียม: บอกไซต์ → อะลูมินา (Bayer) → อิเล็กโทรลิซิส (Hall–Héroult)' },
    { at: c.Aluminium + 8, text: 'ไฟฟ้าคือตัวแปรหลัก — โรงถลุงพลังถ่านหินปล่อยมากกว่าพลังน้ำหลายเท่า' },
    { at: c.Aluminium + 14, until: c.Compare - 0.2, text: 'งานอาคารใช้ 6xxx เป็นหลัก ส่วน 7xxx มีกำลังสูงใกล้เหล็กโครงสร้าง' },
    { at: c.Compare + 0.5, text: 'เทียบต่อ 1 ตัน: อะลูมิเนียมใหม่สูงที่สุด คอนกรีตต่ำที่สุด' },
    { at: c.Compare + 8, until: c.UseEoL - 0.2, text: 'แต่ต้องเทียบต่อ Functional unit — คอนกรีตใช้ปริมาณมหาศาลจนรวมแล้วสูงที่สุด' },
    { at: c.UseEoL + 0.5, text: 'B · ความทนทานช่วยลดการซ่อมบำรุงและการเปลี่ยนชิ้นส่วน' },
    { at: c.UseEoL + 7, until: c.Recycling - 0.2, text: 'C · โลหะคัดแยกและหลอมกลับได้ คอนกรีตถูกบดเป็นมวลรวมรีไซเคิล' },
    { at: c.Recycling + 0.5, text: 'D · โลหะรีไซเคิลได้หลายรอบ โดยคุณสมบัติแทบไม่ลดลง' },
    { at: c.Recycling + 8, text: 'อะลูมิเนียมรีไซเคิลใช้พลังงานเพียงราว 5% ของการผลิตใหม่' },
    { at: c.Recycling + 15, until: c.Levers - 0.2, text: 'คอนกรีตรีไซเคิลลดการขุดหินและฝังกลบ แต่ CO₂ ส่วนใหญ่ยังอยู่ที่ซีเมนต์' },
    { at: c.Levers + 1, text: 'คอนกรีต: ลดปูนเม็ดด้วย SCM และปูนไฮดรอลิก แล้วปิดท้ายด้วย CCUS' },
    { at: c.Levers + 7.5, text: 'เหล็ก: การเปลี่ยนเส้นทางผลิตสำคัญที่สุด — Scrap-EAF และ H₂-DRI' },
    { at: c.Levers + 14, text: 'สแตนเลส: เพิ่มเศษ ใช้ไฟฟ้าหมุนเวียน และเฟอร์โรอัลลอยคาร์บอนต่ำ' },
    { at: c.Levers + 20.5, until: c.Outro - 0.2, text: 'อะลูมิเนียม: ไฟฟ้าหมุนเวียนในการถลุงลดได้มากที่สุด รองลงมาคือรีไซเคิล' },
    { at: c.Outro + 1, until: c.Outro + 9, text: 'ตัวเลขทั้งหมดเป็นค่าชี้นำ — ใช้ EPD ของผลิตภัณฑ์จริงทุกครั้งในการออกแบบ' },
  ];
}

function Piece({ tw }) {
  const { T, CUES, time, authoredTotal } = useComposition();
  const total = authoredTotal;
  const g = MOTION.enter(T, 0, 0.6) * (1 - MOTION.enter(T, total - 0.8, 0.8));
  const bar = MOTION.enter(T, CUES.Raw - 0.4, 0.8);
  const caps = React.useMemo(() => captionsFor(CUES), [CUES]);
  return (
    <div data-screen-label={'t=' + Math.floor(time) + 's'} style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden', fontFamily: TH }}>
      {tw.showGrid !== false && <Grid T={T} />}
      <div style={{ position: 'absolute', inset: 0, opacity: g }}>
        <Intro /><LifeCycle /><Raw /><Concrete /><Steel /><Stainless /><Aluminium />
        <Compare /><UseEoL /><Recycling /><Levers /><Outro />
        <div style={{ position: 'absolute', left: 80, top: 128, height: 1.5, width: 1760 * bar, background: C.line }}></div>
        <SecLabels T={T} CUES={CUES} total={total} />
        <LCStrip T={T} CUES={CUES} total={total} />
      </div>
      {tw.showCaptions !== false && (
        <Captions items={caps} style={{ font: '500 32px/1.35 ' + TH, color: C.ink, bottom: '4%', textShadow: '0 2px 14px rgba(0,0,0,0.8)' }} />
      )}
    </div>
  );
}

function MaterialsApp() {
  const [tw, setTweak] = useTweaks(window.TWEAK_DEFAULTS || { motionEditor: true, showCaptions: true, showGrid: true });
  return (
    <React.Fragment>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={C.bg}>
        <Piece tw={tw} />
      </CompositionStage>
      <TweaksPanel title="Tweaks">
        <TweakSection label="Video" />
        <TweakToggle label="Motion editor" value={tw.motionEditor} onChange={v => setTweak('motionEditor', v)} />
        <TweakToggle label="คำบรรยาย (Captions)" value={tw.showCaptions} onChange={v => setTweak('showCaptions', v)} />
        <TweakToggle label="Blueprint grid" value={tw.showGrid} onChange={v => setTweak('showGrid', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}
window.MaterialsApp = MaterialsApp;

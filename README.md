# Clean Energy Lab

หน้าเว็บเปรียบเทียบวิธีผลิตไฟฟ้าทุกแบบ อัปเดตข้อมูลอัตโนมัติทุกวันด้วย GitHub Actions และเผยแพร่ผ่าน GitHub Pages

Tools and Mentors/Coworker : Claude Opus5.5

## ข้อมูลอะไรอัปเดตเอง อะไรแก้ด้วยมือ

| ไฟล์ | เนื้อหา | อัปเดตอย่างไร |
|---|---|---|
| `data/mix.json` | สัดส่วนผลิตไฟฟ้าโลกและไทย ย้อนหลัง 10 ปี | อัตโนมัติทุกวันจาก [Our World in Data](https://github.com/owid/energy-data) (ข้อมูลต้นทางเปลี่ยนเป็นรายเดือนหรือรายปี) |
| `data/research.json` | งานวิจัยใหม่ 60 วันล่าสุด พร้อมผู้เขียน สถาบัน และประเทศ | อัตโนมัติทุกวันจาก [OpenAlex](https://openalex.org) |
| `data/records.json` | สถิติประสิทธิภาพและราคาในอดีต พร้อมองค์กรที่ทำสถิติ | แก้ด้วยมือผ่าน Pull Request |
| `data/supply-chain.json` | ห่วงโซ่อุปทานและบริษัทในแต่ละขั้น | แก้ด้วยมือผ่าน Pull Request |
| `data/reports.json` | รายงานสรุปของแต่ละแหล่งผลิต พร้อมแหล่งอ้างอิง (ใช้ในหน้า Power Plant Lab) | แก้ด้วยมือผ่าน Pull Request |
| `data/fusion.json` | ฟิวชัน 3 แนวทาง (MCF, ICF, Alternative & Hybrid) โครงการตัวอย่าง และอ้างอิง ยังไม่เชิงพาณิชย์จึงไม่อยู่ในกราฟต้นทุน | แก้ด้วยมือผ่าน Pull Request |
| `data/sources.json` | CO2, ต้นทุน, capacity factor ของแต่ละแหล่ง | แก้ด้วยมือเมื่อรายงาน Lazard หรือ IRENA ฉบับใหม่ออก |

## Power Plant Lab (`site/lab/`)

หน้า `lab/` รวมแหล่งผลิตไฟฟ้าทั้ง 15 แบบ กดแต่ละตัวจะมีสองแท็บ

- **Simulation**: แบบจำลองเครื่องจักรที่ปรับค่าได้ (โหลด แดด ลม ระดับน้ำ ฯลฯ) พร้อมตัวเลขสด และจุดให้แตะดูทั้งเครื่องจักรและคนที่ทำงานในสถานที่ (`site/lab/sims.js`)
- **Report**: สรุปสำหรับการตัดสินใจ ตัวเลขสำคัญ เทียบกับแหล่งอื่น บริบทไทย ความเสี่ยง และแหล่งอ้างอิงแบบมีเลขกำกับ พิมพ์หรือบันทึก PDF ได้ (`data/reports.json` อ้างอิงในข้อความด้วย `{ref_id}`)

- **Materials**: ภาพแยกชิ้นส่วน วัสดุที่ใช้ ปริมาณต่อ MW ประเทศต้นทาง วงจรชีวิต 6 ขั้น และบริษัทใน Supply Chain (`data/materials.json`)
- **ต้นฉบับจาก Claude Design** อยู่ใน `site/lab/originals/`: Solar Storage Grid Report (PDF) Hydrogen Plant Green vs Blue v2 (โมเดล 3D) และ Materials Life Cycle (คลิปแอนิเมชัน) พร้อมไฟล์ runtime เดิมของ Claude Design (`three-d-stage.js`, `support.js`, `.jsx`) ซึ่งโหลด three.js, React และ Babel จาก unpkg

ลิงก์ตรงเข้าแต่ละแหล่งได้ เช่น `lab/#/pvs` หรือ `lab/#/h2/report`

## ภาษาไทย / English

ปุ่ม **ไทย | EN** มุมขวาบนของหน้าหลักและในแถบเมนูของ Lab สลับภาษาทั้งเว็บ (จำค่าไว้ในเบราว์เซอร์ และแชร์ลิงก์ภาษาอังกฤษได้ด้วย `?lang=en`)
- ข้อความเขียนเป็นภาษาไทยในโค้ดและไฟล์ `data/*.json` ตามเดิม คำแปลอังกฤษอยู่ใน `site/i18n/en.json` (ข้อความไทย → อังกฤษ) โหลดเฉพาะตอนเลือก EN
- `site/i18n.js` แปลข้อมูลที่โหลดมาและข้อความที่ขึ้นบนหน้า ถ้าแก้หรือเพิ่มข้อความไทยใน `data/*.json` ให้เพิ่มคำแปลใน `en.json` ด้วย ไม่อย่างนั้นโหมด EN จะแสดงภาษาไทยตรงจุดนั้น
- Energy Anatomy, Hydrogen Green vs Blue 3D และคลิป Materials Life Cycle มีปุ่ม ไทย | EN ของตัวเอง ใช้พจนานุกรมแยก `site/i18n/en-originals.json` (เลือกด้วย `data-dict="en-originals"` บนแท็ก script) ป้ายที่วาดบน canvas ของ Energy Anatomy ผ่าน `window.T` ใน bundle
- Solar Storage Grid Report มีฉบับภาษาอังกฤษล้วนแยกไฟล์ `site/lab/originals/solar-storage-grid-report-en.pdf` ลิงก์ไปที่ PDF จะเปิดฉบับอังกฤษเองเมื่ออยู่ในโหมด EN

## ติดตั้ง

1. สร้าง repo ใหม่บน GitHub แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ไปที่ branch `main`
2. ไปที่ **Settings → Pages** แล้วเลือก Source เป็น **GitHub Actions**
3. ไปที่แท็บ **Actions** เลือก **Daily update** แล้วกด **Run workflow** ครั้งแรก
4. หน้าเว็บจะอยู่ที่ `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/`

## รันบนเครื่อง

```bash
python3 scripts/update.py      # ดึงข้อมูลล่าสุด
bash scripts/build.sh          # ประกอบหน้าเว็บลง _site/
python3 -m http.server -d _site 8000
```

## การมีส่วนร่วม

เพิ่มสถิติใหม่หรือบริษัทในห่วงโซ่อุปทานได้โดยแก้ไฟล์ใน `data/` แล้วเปิด Pull Request ทุกรายการควรมีแหล่งอ้างอิง ประวัติใน git จะบอกว่าใครเพิ่มข้อมูลอะไรเมื่อไร

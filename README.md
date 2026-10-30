# Clean Energy Lab

หน้าเว็บเปรียบเทียบวิธีผลิตไฟฟ้าทุกแบบ อัปเดตข้อมูลอัตโนมัติทุกวันด้วย GitHub Actions และเผยแพร่ผ่าน GitHub Pages

## ข้อมูลอะไรอัปเดตเอง อะไรแก้ด้วยมือ

| ไฟล์ | เนื้อหา | อัปเดตอย่างไร |
|---|---|---|
| `data/mix.json` | สัดส่วนผลิตไฟฟ้าโลกและไทย ย้อนหลัง 10 ปี | อัตโนมัติทุกวันจาก [Our World in Data](https://github.com/owid/energy-data) (ข้อมูลต้นทางเปลี่ยนเป็นรายเดือนหรือรายปี) |
| `data/research.json` | งานวิจัยใหม่ 60 วันล่าสุด พร้อมผู้เขียน สถาบัน และประเทศ | อัตโนมัติทุกวันจาก [OpenAlex](https://openalex.org) |
| `data/records.json` | สถิติประสิทธิภาพและราคาในอดีต พร้อมองค์กรที่ทำสถิติ | แก้ด้วยมือผ่าน Pull Request |
| `data/supply-chain.json` | ห่วงโซ่อุปทานและบริษัทในแต่ละขั้น | แก้ด้วยมือผ่าน Pull Request |
| `data/sources.json` | CO2, ต้นทุน, capacity factor ของแต่ละแหล่ง | แก้ด้วยมือเมื่อรายงาน Lazard หรือ IRENA ฉบับใหม่ออก |

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

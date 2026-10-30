"""ดึงข้อมูลรายวัน: สัดส่วนผลิตไฟฟ้า (Our World in Data / Ember) และงานวิจัยล่าสุด (OpenAlex)
เขียนผลลัพธ์ลง data/mix.json และ data/research.json ถ้าดึงไม่สำเร็จจะเก็บไฟล์เดิมไว้"""
import csv, io, json, sys, urllib.parse, urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OWID_URL = "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv"
COUNTRIES = {"World": "world", "Thailand": "thai"}
# key ใน OWID -> ชื่อไทย, กลุ่ม (clean / cond / fossil)
SOURCES = [
    ("coal", "ถ่านหิน", "fossil"), ("gas", "ก๊าซธรรมชาติ", "fossil"), ("oil", "น้ำมัน", "fossil"),
    ("nuclear", "นิวเคลียร์", "clean"), ("hydro", "พลังน้ำ", "clean"), ("wind", "ลม", "clean"),
    ("solar", "โซลาร์", "clean"), ("biofuel", "ชีวมวล / ก๊าซชีวภาพ", "cond"),
    ("other_ex_bio", "หมุนเวียนอื่น (ความร้อนใต้พิภพ คลื่น)", "clean"),
]
TREND = ["coal", "gas", "wind", "solar"]
RESEARCH_TOPICS = {
    "solar": "perovskite silicon tandem solar cell efficiency",
    "wind": "offshore wind turbine capacity factor",
    "storage": "sodium-ion battery grid storage",
    "geothermal": "enhanced geothermal system",
    "hydrogen": "green hydrogen electrolyzer efficiency",
    "nuclear": "small modular reactor",
}
UA = {"User-Agent": "clean-energy-lab (https://github.com) mailto:noreply@example.com"}


def get(url, timeout=90):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


def num(v):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


def build_mix():
    rows = csv.DictReader(io.StringIO(get(OWID_URL).decode("utf-8")))
    by = {k: {} for k in COUNTRIES.values()}
    for r in rows:
        key = COUNTRIES.get(r["country"])
        if not key or not r.get("solar_share_elec"):
            continue
        y = int(r["year"])
        vals = {s: num(r.get(f"{s}_share_elec")) for s, _, _ in SOURCES if s != "other_ex_bio"}
        other, bio = num(r.get("other_renewables_share_elec")), vals.get("biofuel")
        vals["other_ex_bio"] = round(max(0.0, (other or 0) - (bio or 0)), 2)
        vals["low_carbon"] = num(r.get("low_carbon_share_elec"))
        by[key][y] = vals
    out = {"updated": date.today().isoformat(), "source": "Our World in Data energy-data (Ember, Energy Institute)",
           "labels": {s: [n, g] for s, n, g in SOURCES}, "places": {}}
    for key, years in by.items():
        latest = max(years)
        out["places"][key] = {
            "year": latest,
            "mix": years[latest],
            "trend": {"years": [y for y in sorted(years) if y >= latest - 10],
                      **{s: [years[y].get(s) for y in sorted(years) if y >= latest - 10] for s in TREND}},
        }
    return out


def build_research():
    since = (datetime.now(timezone.utc) - timedelta(days=60)).date().isoformat()
    out = {"updated": date.today().isoformat(), "source": "OpenAlex", "topics": {}}
    for key, q in RESEARCH_TOPICS.items():
        params = urllib.parse.urlencode({
            "search": q, "filter": f"from_publication_date:{since},type:article",
            "sort": "cited_by_count:desc", "per_page": 6,
            "select": "title,publication_date,doi,id,authorships,cited_by_count",
        })
        res = json.loads(get(f"https://api.openalex.org/works?{params}"))
        items = []
        for w in res.get("results", []):
            insts = []
            for a in w.get("authorships", []):
                for i in a.get("institutions", []):
                    label = f'{i.get("display_name")} ({i.get("country_code") or "?"})'
                    if label not in insts:
                        insts.append(label)
            items.append({
                "title": w.get("title"), "date": w.get("publication_date"),
                "url": w.get("doi") or w.get("id"), "cited": w.get("cited_by_count", 0),
                "authors": [a["author"]["display_name"] for a in w.get("authorships", [])[:4]],
                "institutions": insts[:4],
            })
        out["topics"][key] = items
    return out


def write(name, fn):
    path = DATA / name
    try:
        data = fn()
    except Exception as e:  # เครือข่ายล่มหรือรูปแบบข้อมูลเปลี่ยน: เก็บไฟล์เดิม
        print(f"skip {name}: {e}", file=sys.stderr)
        return False
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {name}")
    return True


if __name__ == "__main__":
    ok = [write("mix.json", build_mix), write("research.json", build_research)]
    sys.exit(0 if any(ok) else 1)

"""Fill name_mn in data/soums.geojson by transliterating the FAO GAUL Latin names into Mongolian Cyrillic,
with a short list of known exceptions, and write data/soum_names_mn.csv for review.

Usage: python3 tools/soum_names_mn.py      (then python3 tools/build_data.py)
"""
import csv, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Names the rules cannot get right (spelling in the source differs from the Mongolian name, or "ts" that is not ц).
EXCEPTIONS = {
    'Zamiin-Üüd': 'Замын-Үүд',
    'Tövzrüülekh': 'Төвшрүүлэх',
    'Batsümber': 'Батсүмбэр',
    'Sagili': 'Сагил',
    'Shariingol': 'Шарын гол',
    'Ugtaal': 'Угтаалцайдам',
}
# Longest first. "tsh" is т + ш (Batshireet), not ц + х.
PAIRS = [('tsh', 'тш'), ('kh', 'х'), ('ts', 'ц'), ('ch', 'ч'), ('sh', 'ш'), ('zh', 'ж'),
         ('ya', 'я'), ('yu', 'ю'), ('yo', 'ё'), ('ye', 'е'), ('ii', 'ий'),
         ('ai', 'ай'), ('oi', 'ой'), ('ui', 'уй'), ('üi', 'үй'), ('ei', 'эй')]
SINGLE = dict(zip('abdegijklmnorstuvyzöü', 'абдэгижклмнорстувызөү'))

def word(w):
    s, out, i = w.lower(), '', 0
    while i < len(s):
        for lat, cyr in PAIRS:
            if s.startswith(lat, i):
                out += cyr; i += len(lat); break
        else:
            out += SINGLE.get(s[i], s[i]); i += 1
    # Soft sign where Mongolian writes one.
    out = re.sub(r'гови$', 'говь', out)
    out = re.sub(r'мани$', 'мань', out)
    out = re.sub(r'морит$', 'морьт', out)
    return out[:1].upper() + out[1:]

def translit(name):
    return EXCEPTIONS.get(name) or '-'.join(word(part) for part in name.split('-'))

if __name__ == '__main__':
    path = ROOT / 'data' / 'soums.geojson'
    g = json.loads(path.read_text())
    rows = []
    for f in g['features']:
        p = f['properties']
        p['name_mn'] = translit(p['name_en'])
        rows.append((p['soum_id'], p['name_en'], p['aimag'], p['name_mn']))
    path.write_text(json.dumps(g, ensure_ascii=False, separators=(',', ':')))
    with open(ROOT / 'data' / 'soum_names_mn.csv', 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['soum_id', 'name_en', 'aimag', 'name_mn']); w.writerows(sorted(rows, key=lambda r: (r[2], r[1])))
    print(f'{len(rows)} soums: name_mn filled; review list in data/soum_names_mn.csv')

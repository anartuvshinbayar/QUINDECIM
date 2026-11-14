"""Give every CSS and JS link in index.html a new ?v= number, so browsers load the fresh files
after an update instead of an old cached copy.

Usage: python3 tools/bump_version.py      (run before each deploy)
"""
import pathlib, re, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
version = time.strftime("%Y%m%d%H%M")
for name in ["index.html", "404.html"]:
    p = ROOT / name
    s = p.read_text()
    # local .css / .js links only (not Google Fonts or other https links)
    s2 = re.sub(r'((?:href|src)="(?!https?:)[^"?]+\.(?:css|js))(?:\?v=[0-9]+)?"', rf'\1?v={version}"', s)
    p.write_text(s2)
    count = s2.count("?v=" + version)
    print(f"{name}: {count} links set to v={version}")

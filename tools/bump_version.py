"""Before each deploy: rebuild the pages readers without JavaScript see (tools/static_pages.js), then give every CSS
and JS link in index.html a new ?v= number, so browsers load the fresh files instead of an old cached copy.

Usage: python3 tools/bump_version.py      (run before each deploy; needs node for the first step)
"""
import pathlib, re, shutil, subprocess, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
if shutil.which("node"):
    subprocess.run(["node", str(ROOT / "tools/static_pages.js")], check=True, stdout=subprocess.DEVNULL)
    print("static pages rebuilt (index.html text and summary, methods.html, data/results.csv, llms.txt, sitemap.xml)")
else:
    print("node not found: static pages NOT rebuilt (run node tools/static_pages.js)")
version = time.strftime("%Y%m%d%H%M")
for name in ["index.html", "404.html"]:
    p = ROOT / name
    s = p.read_text()
    # local .css / .js links only (not Google Fonts or other https links)
    s2 = re.sub(r'((?:href|src)="(?!https?:)[^"?]+\.(?:css|js))(?:\?v=[0-9]+)?"', rf'\1?v={version}"', s)
    p.write_text(s2)
    count = s2.count("?v=" + version)
    print(f"{name}: {count} links set to v={version}")

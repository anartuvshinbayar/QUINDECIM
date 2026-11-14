"""Check the site's statistics (js/stats.js) against scipy.

Usage: python tools/check_stats.py   (needs node, numpy, scipy)
Runs several series through both and prints the largest difference per number.
"""
import json, subprocess, sys, pathlib
import numpy as np
from scipy import stats

ROOT = pathlib.Path(__file__).resolve().parent.parent

def mk_reference(y):
    y = np.asarray(y); n = len(y)
    s = sum(np.sign(y[j] - y[i]) for i in range(n - 1) for j in range(i + 1, n))
    _, counts = np.unique(y, return_counts=True)
    var = (n * (n - 1) * (2 * n + 5) - sum(t * (t - 1) * (2 * t + 5) for t in counts if t > 1)) / 18
    z = (s - 1) / np.sqrt(var) if s > 0 else (s + 1) / np.sqrt(var) if s < 0 else 0
    return float(s), float(z), float(2 * (1 - stats.norm.cdf(abs(z))))

rng = np.random.default_rng(42)
cases = []
for k in range(8):
    n = [20, 25, 30, 44, 45, 25, 25, 33][k]
    x = list(range(2026 - n, 2026))
    trend = [0.0, 0.003, -0.004, 0.02, -0.5, 0.0, 0.001, 0.0][k]
    y = (0.3 + trend * np.arange(n) + rng.normal(0, 0.03 if k < 3 else 1.0, n))
    if k == 5: y = np.round(y, 1)          # many ties
    if k == 7: y[10] = y[10] + 5           # one extreme year
    cases.append({"x": x, "y": [float(v) for v in y]})

js = """
eval(require('fs').readFileSync('js/stats.js', 'utf8'));
const { analyze } = globalThis.Q.stats;
const cases = JSON.parse(process.argv[1]);
console.log(JSON.stringify(cases.map(c => { const r = analyze(c.x, c.y);
  return { s: r.mk.s, z: r.mk.z, p: r.mk.p, sen: r.sen.slope, slope: r.lin.slope, lp: r.lin.p, lo: r.lin.ciLow, hi: r.lin.ciHigh }; })));
"""
out = subprocess.run(["node", "--input-type=commonjs", "-e", js, json.dumps(cases)], cwd=ROOT, capture_output=True, text=True)
if out.returncode: sys.exit(out.stderr)
site = json.loads(out.stdout)

worst = {}
for c, r in zip(cases, site):
    s, z, p = mk_reference(c["y"])
    lr = stats.linregress(c["x"], c["y"])
    tc = stats.t.ppf(0.975, len(c["x"]) - 2)
    ref = {"s": s, "z": z, "p": p, "sen": stats.theilslopes(c["y"], c["x"])[0], "slope": lr.slope,
           "lp": lr.pvalue, "lo": lr.slope - tc * lr.stderr, "hi": lr.slope + tc * lr.stderr}
    for key in ref:
        worst[key] = max(worst.get(key, 0), abs(ref[key] - r[key]))

ok = True
for key, diff in worst.items():
    flag = "OK " if diff < 1e-5 else "BAD"
    ok &= diff < 1e-5
    print(f"{flag} {key:6s} max difference {diff:.2e}")
print("ALL MATCH" if ok else "MISMATCH")
sys.exit(0 if ok else 1)

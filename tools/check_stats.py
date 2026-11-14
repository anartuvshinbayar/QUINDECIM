"""Check the site's statistics (js/stats.js) against independent Python versions.

Usage: python tools/check_stats.py   (needs node, numpy, scipy; pymannkendall too, if installed, as a third opinion)

Runs test series (trends, ties, an extreme year, strongly correlated years, alternating years, a gap in the years)
through js/stats.js and through the reference code below, and prints the largest difference per number:
  - Mann-Kendall S, Z and p (plain test, tie correction)
  - Hamed & Rao (1998) variance factor and corrected p, which the site uses (factor never below 1)
  - Sen's slope
  - straight-line slope, t-test p and 95% CI with the effective sample size n(1 - r1)/(1 + r1) (Santer et al. 2000)
  - Benjamini-Hochberg q values (scipy.stats.false_discovery_control)
"""
import json, subprocess, sys, pathlib
import numpy as np
from scipy import stats

ROOT = pathlib.Path(__file__).resolve().parent.parent


def mk_reference(y, factor=1.0):
    y = np.asarray(y); n = len(y)
    s = sum(np.sign(y[j] - y[i]) for i in range(n - 1) for j in range(i + 1, n))
    _, counts = np.unique(y, return_counts=True)
    var = (n * (n - 1) * (2 * n + 5) - sum(t * (t - 1) * (2 * t + 5) for t in counts if t > 1)) / 18 * factor
    z = (s - 1) / np.sqrt(var) if s > 0 else (s + 1) / np.sqrt(var) if s < 0 else 0
    return float(s), float(z), float(2 * stats.norm.sf(abs(z)))


def hamed_rao_reference(x, y, slope):
    """Hamed, K. H. and Rao, A. R. (1998), J. Hydrology 204, 182-196: variance factor n/n*_s for S."""
    x = np.asarray(x, float); y = np.asarray(y, float); n = len(y)
    r = stats.rankdata(y - (x - x[0] + 1) * slope)
    d = r - r.mean()
    acf = np.array([np.sum(d[:n - k] * d[k:]) for k in range(n)]) / np.sum(d * d)
    bound = stats.norm.ppf(0.975) / np.sqrt(n)
    total = sum((n - k) * (n - k - 1) * (n - k - 2) * acf[k] for k in range(1, n) if abs(acf[k]) > bound)
    return 1 + 2 * total / (n * (n - 1) * (n - 2))


def ols_reference(x, y):
    """Least squares with the effective sample size of Santer et al. (2000), JGR 105(D6), 7337-7356."""
    x = np.asarray(x, float); y = np.asarray(y, float); n = len(y)
    lr = stats.linregress(x, y)
    e = y - lr.intercept - lr.slope * x
    e0 = e - e.mean()
    r1 = np.sum(e0[:-1] * e0[1:]) / np.sum(e0 * e0)
    n_eff = max(3.0, n * (1 - max(0.0, r1)) / (1 + max(0.0, r1)))
    df = n_eff - 2
    se = np.sqrt(np.sum(e * e) / df / np.sum((x - x.mean()) ** 2))
    tc = stats.t.ppf(0.975, df)
    return {"slope": lr.slope, "lp": 2 * stats.t.sf(abs(lr.slope / se), df), "lo": lr.slope - tc * se, "hi": lr.slope + tc * se,
            "r1": r1, "neff": n_eff}


def ar1(n, rho, sd, rng):
    out, a = [], 0.0
    for _ in range(n):
        a = rho * a + rng.normal(0, sd)
        out.append(a)
    return np.array(out)


rng = np.random.default_rng(42)
cases = []
specs = [  # (years, trend per year, noise, kind)
    (20, 0.0, 0.03, "white"), (25, 0.003, 0.03, "white"), (30, -0.004, 0.03, "white"), (44, 0.02, 1.0, "white"),
    (45, -0.5, 1.0, "white"), (25, 0.0, 1.0, "ties"), (25, 0.001, 1.0, "white"), (33, 0.0, 1.0, "extreme"),
    (26, 0.002, 0.03, "ar0.6"), (45, 0.03, 0.6, "ar0.8"), (26, 0.0, 0.03, "ar0.8"), (40, 0.01, 0.5, "ar0.5"),
    (26, 0.003, 0.03, "alternate"), (44, 0.0, 1.0, "alternate"), (30, 0.01, 0.4, "gap"),
]
for n, trend, sd, kind in specs:
    x = list(range(2026 - n, 2026))
    if kind.startswith("ar"):
        noise = ar1(n, float(kind[2:]), sd, rng)
    elif kind == "alternate":
        noise = np.array([sd if i % 2 else -sd for i in range(n)]) + rng.normal(0, sd * 0.3, n)
    else:
        noise = rng.normal(0, sd, n)
    y = 0.3 + trend * np.arange(n) + noise
    if kind == "ties": y = np.round(y, 1)
    if kind == "extreme": y[10] += 5
    if kind == "gap":
        keep = [i for i in range(n) if i not in (7, 8, 19)]
        x = [x[i] for i in keep]; y = y[keep]
    cases.append({"kind": kind, "x": x, "y": [float(v) for v in y]})

ps = [float(v) for v in rng.uniform(0, 0.2, 60)] + [0.001, 0.001, 0.04, 0.5, 1.0]   # with ties

js = """
eval(require('fs').readFileSync('js/stats.js', 'utf8'));
const { analyze, hamedRaoFactor, fdr } = globalThis.Q.stats;
const input = JSON.parse(process.argv[1]);
const rows = input.cases.map(c => { const r = analyze(c.x, c.y);
  return { s: r.mk.s, z: r.mk.z, plainP: r.mk.plainP, p: r.mk.p, factor: hamedRaoFactor(r.x, r.y, r.sen.slope), sen: r.sen.slope,
           slope: r.lin.slope, lp: r.lin.p, lo: r.lin.ciLow, hi: r.lin.ciHigh, r1: r.lin.r1, neff: r.lin.nEff }; });
console.log(JSON.stringify({ rows, q: fdr(input.ps) }));
"""
out = subprocess.run(["node", "--input-type=commonjs", "-e", js, json.dumps({"cases": cases, "ps": ps})], cwd=ROOT,
                     capture_output=True, text=True)
if out.returncode: sys.exit(out.stderr)
site = json.loads(out.stdout)

try:
    import pymannkendall as pmk
except ImportError:
    pmk = None

worst, raised, lowered = {}, 0, 0
for c, r in zip(cases, site["rows"]):
    sen = stats.theilslopes(c["y"], c["x"])[0]
    factor = hamed_rao_reference(c["x"], c["y"], sen)
    used = max(1.0, factor)
    raised += factor > 1; lowered += factor < 1
    s, _, plain_p = mk_reference(c["y"])
    _, z, p = mk_reference(c["y"], used)
    ref = {"s": s, "z": z, "plainP": plain_p, "factor": factor, "p": p, "sen": sen, **ols_reference(c["x"], c["y"])}
    if pmk and c["kind"] != "gap":   # pymannkendall counts years by position, so it only matches without gaps
        hr = pmk.hamed_rao_modification_test(c["y"])
        if factor >= 1:   # below 1 (or even negative, where pymannkendall returns nan) the site keeps the plain test
            ref["pymannkendall p"] = hr.p
            r["pymannkendall p"] = r["p"]
    for key in ref:
        worst[key] = max(worst.get(key, 0), abs(ref[key] - r[key]))
q_ref = stats.false_discovery_control(ps, method="bh")
worst["fdr q"] = float(np.max(np.abs(q_ref - np.array(site["q"]))))

ok = True
for key, diff in worst.items():
    good = diff < 1e-6
    ok &= good
    print(f"{'OK ' if good else 'BAD'} {key:16s} max difference {diff:.2e}")
print(f"{len(cases)} series: {raised} with correlated years (variance widened), {lowered} with a factor below 1 (plain test kept)"
      + ("" if pmk else "; pymannkendall not installed, skipped"))
print("ALL MATCH" if ok else "MISMATCH")
sys.exit(0 if ok else 1)

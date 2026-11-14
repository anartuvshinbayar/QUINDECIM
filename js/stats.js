// Plain script (no modules) so the site also works when index.html is opened as a file.
(function (Q) {
// Trend statistics. Pure functions, no DOM, so they run in the browser and in node tests.
// Mann-Kendall (with tie correction and the Hamed & Rao correction for year-to-year correlation), Sen's slope,
// ordinary least squares with a t-test and 95% CI (effective sample size for correlated years), and the
// Benjamini-Hochberg false discovery rate for many places tested at once.

const MIN_YEARS = 20;

// ---------- distributions ----------

// Complementary error function, Numerical Recipes erfcc (fractional error < 1.2e-7).
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function normalCdf(z) {
  return 0.5 * erfc(-z / Math.SQRT2);
}

function lnGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// Continued fraction for the incomplete beta function (Numerical Recipes betacf).
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// Regularized incomplete beta I_x(a, b).
function incBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}

// Two-sided p value for Student's t with df degrees of freedom.
function tTwoSidedP(t, df) {
  return incBeta(df / (df + t * t), df / 2, 0.5);
}

// Critical t value for a two-sided interval at the given confidence (bisection).
function tCritical(df, confidence = 0.95) {
  const target = 1 - confidence;
  let lo = 0, hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSidedP(mid, df) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- helpers ----------

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Ranks from 1, ties sharing the average of their ranks.
function ranks(arr) {
  const order = arr.map((_, i) => i).sort((a, b) => arr[a] - arr[b]);
  const r = new Array(arr.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && arr[order[j + 1]] === arr[order[i]]) j++;
    for (let k = i; k <= j; k++) r[order[k]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

// Drop years with missing values and keep the two arrays aligned.
function clean(years, values) {
  const x = [], y = [];
  for (let i = 0; i < years.length; i++) {
    if (Number.isFinite(years[i]) && Number.isFinite(values[i])) { x.push(years[i]); y.push(values[i]); }
  }
  return { x, y };
}

// ---------- tests ----------

// Mann-Kendall S and its p value. factor widens the variance of S (1 = the plain test).
function mannKendall(y, factor = 1) {
  const n = y.length;
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) s += Math.sign(y[j] - y[i]);
  }
  // Tie correction.
  const counts = new Map();
  for (const v of y) counts.set(v, (counts.get(v) || 0) + 1);
  let tieTerm = 0;
  for (const t of counts.values()) if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18 * factor;
  let z = 0;
  if (s > 0) z = (s - 1) / Math.sqrt(varS);
  else if (s < 0) z = (s + 1) / Math.sqrt(varS);
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  const tau = s / (n * (n - 1) / 2);
  return { n, s, varS, z, p, tau, factor };
}

// Hamed & Rao (1998) correction for year-to-year correlation. A dry year is often followed by another dry year;
// such runs make S swing more than the plain test assumes, so it finds too many trends. Take away Sen's trend, rank
// what is left, and add up its autocorrelations that are significant at the 5% level: the result is the factor by
// which the variance of S grows. Returns the raw factor (below 1 when neighbouring years alternate).
const Z975 = 1.959963984540054;   // two-sided 5% point of the normal distribution
function hamedRaoFactor(x, y, slope) {
  const n = y.length;
  if (n < 3) return 1;
  // Years counted from 1 (the same numbers as y - slope * year, shifted; this way rounding matches other tools).
  const r = ranks(y.map((v, i) => v - (x[i] - x[0] + 1) * slope));
  const m = mean(r), d = r.map(v => v - m);
  let c0 = 0;
  for (const v of d) c0 += v * v;
  if (!(c0 > 0)) return 1;
  const bound = Z975 / Math.sqrt(n);
  let sum = 0;
  for (let k = 1; k < n - 2; k++) {
    let ck = 0;
    for (let i = 0; i < n - k; i++) ck += d[i] * d[i + k];
    const rk = ck / c0;
    if (Math.abs(rk) > bound) sum += (n - k) * (n - k - 1) * (n - k - 2) * rk;
  }
  return 1 + 2 * sum / (n * (n - 1) * (n - 2));
}

function sensSlope(x, y) {
  const slopes = [];
  for (let i = 0; i < x.length - 1; i++) {
    for (let j = i + 1; j < x.length; j++) {
      if (x[j] !== x[i]) slopes.push((y[j] - y[i]) / (x[j] - x[i]));
    }
  }
  const slope = median(slopes);
  const intercept = median(y.map((v, i) => v - slope * x[i]));
  return { slope, intercept };
}

// Straight-line fit with a t-test. Correlated years carry less information than independent ones, so the test uses
// the effective sample size n(1 - r1)/(1 + r1) from the lag-1 autocorrelation r1 of the residuals (Santer et al. 2000).
// Only positive r1 counts, so the correction can only widen the interval, never narrow it.
function linearTrend(x, y) {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const e = y.map((v, i) => v - intercept - slope * x[i]);
  const em = mean(e);
  let sse = 0, lag = 0;
  for (let i = 0; i < n; i++) sse += e[i] ** 2;
  let den = 0;
  for (let i = 0; i < n; i++) den += (e[i] - em) ** 2;
  for (let i = 0; i < n - 1; i++) lag += (e[i] - em) * (e[i + 1] - em);
  const r1 = den > 0 ? lag / den : 0;
  const rho = Math.max(0, r1);
  const nEff = Math.max(3, n * (1 - rho) / (1 + rho));
  const df = nEff - 2;
  const s = Math.sqrt(sse / df);
  const se = s / Math.sqrt(sxx);
  const t = se > 0 ? slope / se : (slope === 0 ? 0 : Infinity);
  const p = se > 0 ? tTwoSidedP(t, df) : (slope === 0 ? 1 : 0);
  const tc = tCritical(df, 0.95);
  const ssTot = y.reduce((a, v) => a + (v - my) ** 2, 0);
  // 95% confidence band for the fitted line at year xv (used to shade the chart).
  const band = xv => tc * s * Math.sqrt(1 / n + (xv - mx) ** 2 / sxx);
  return { slope, intercept, se, t, df, p, r1, nEff, ciLow: slope - tc * se, ciHigh: slope + tc * se, r2: ssTot ? 1 - sse / ssTot : 0, band };
}

// Benjamini-Hochberg false discovery rate. When hundreds of places are tested at once, about 1 in 20 of them passes
// p < 0.05 by pure chance. The q value of each place is its p value adjusted for all the others; calling only
// q < 0.05 a real trend keeps the share of chance results among them to about 5%. Same order as ps.
function fdr(ps) {
  const m = ps.length, order = ps.map((_, i) => i).sort((a, b) => ps[a] - ps[b]);
  const q = new Array(m);
  let min = 1;
  for (let k = m - 1; k >= 0; k--) {
    const i = order[k];
    min = Math.min(min, ps[i] * m / (k + 1));
    q[i] = min;
  }
  return q;
}

// ---------- verdict ----------

// p: the place's own Mann-Kendall p value (corrected for year-to-year correlation).
// q: its false discovery rate q value among all places tested at once (q >= p; without q, q = p).
// Real: q < 0.05, so it holds up even with every place tested at once. Possible: p < 0.10 but not real.
// Otherwise not proven.
function verdictLevel(p, q = p) {
  if (q < 0.05 && p < 0.05) return 'real';
  if (p < 0.10) return 'possible';
  return 'not-proven';
}

// Full analysis of one series. Returns { ok:false, reason } when there is too little data.
function analyze(years, values) {
  const { x, y } = clean(years, values);
  if (x.length < MIN_YEARS) return { ok: false, reason: 'too-short', n: x.length, x, y };
  const sen = sensSlope(x, y);
  const plain = mannKendall(y);
  const rawFactor = hamedRaoFactor(x, y, sen.slope);
  // The correction may only make the test stricter, never more confident than the plain test.
  const mk = rawFactor > 1 ? mannKendall(y, rawFactor) : plain;
  mk.plainP = plain.p;
  const lin = linearTrend(x, y);
  const level = verdictLevel(mk.p);
  const direction = sen.slope > 0 ? 'up' : sen.slope < 0 ? 'down' : 'flat';
  const linSig = lin.p < 0.05, mkSig = mk.p < 0.05;
  return {
    ok: true, x, y, n: x.length, first: x[0], last: x[x.length - 1], mean: mean(y),
    mk, sen, lin, level, direction,
    testsDisagree: linSig !== mkSig,
  };
}

Q.stats = { MIN_YEARS, normalCdf, tTwoSidedP, tCritical, mean, ranks, clean, mannKendall, hamedRaoFactor, sensSlope, linearTrend, fdr, verdictLevel, analyze };
})(globalThis.Q = globalThis.Q || {});

"""
Pembuat nilai acuan untuk arima.test.ts (numpy + scipy, tanpa statsmodels).

Metode acuan sengaja BERBEDA dari implementasi TypeScript supaya tesnya
independen:
  - PACF  : solve sistem Yule-Walker (np.linalg.solve), bukan rekursi Durbin-Levinson.
  - AR(2) : OLS (np.linalg.lstsq) bersyarat pada 2 observasi pertama — untuk AR murni
            dengan konstanta, CSS == OLS, jadi optimizer Nelder-Mead harus mendarat di sini.
  - Ramalan AR(2): rekursi langsung + bobot psi analitik.

Jalankan:  python lib/engine/__tests__/fixtures/make_arima_ref.py
"""

import json
import pathlib

import numpy as np
from scipy import stats

rng = np.random.default_rng(2026)


def simulate_ar2(n, c=10.0, p1=0.5, p2=-0.3):
    burn = 100
    e = rng.normal(0, 1, n + burn)
    x = np.zeros(n + burn)
    x[:2] = c / (1 - p1 - p2)
    for t in range(2, n + burn):
        x[t] = c + p1 * x[t - 1] + p2 * x[t - 2] + e[t]
    return np.round(x[burn:], 4)


def acf(x, k_max):
    m = x.mean()
    c0 = ((x - m) ** 2).sum()
    return [float(((x[k:] - m) * (x[:-k] - m)).sum() / c0) for k in range(1, k_max + 1)]


def pacf_yule_walker(x, k_max):
    r = np.array([1.0] + acf(x, k_max))
    out = []
    for k in range(1, k_max + 1):
        R = np.array([[r[abs(i - j)] for j in range(k)] for i in range(k)])
        out.append(float(np.linalg.solve(R, r[1 : k + 1])[-1]))
    return out


def kpss(x):
    n = len(x)
    e = x - x.mean()
    eta = (np.cumsum(e) ** 2).sum() / n**2
    lags = int(4 * (n / 100) ** 0.25)
    s2 = (e**2).sum()
    for l in range(1, lags + 1):
        s2 += 2 * (1 - l / (lags + 1)) * (e[l:] * e[:-l]).sum()
    return float(eta / (s2 / n)), lags


def ljung_box(res, lags, fitdf):
    n = len(res)
    r = acf(res, lags)
    q = n * (n + 2) * sum(r[k - 1] ** 2 / (n - k) for k in range(1, lags + 1))
    return float(q), float(stats.chi2.sf(q, lags - fitdf))


ar = simulate_ar2(200)
X = np.column_stack([np.ones(len(ar) - 2), ar[1:-1], ar[:-2]])
y = ar[2:]
beta, *_ = np.linalg.lstsq(X, y, rcond=None)
res = y - X @ beta
c, p1, p2 = (float(v) for v in beta)
sigma2 = float((res**2).sum() / len(y))

# Ramalan 3 langkah + se dari psi: psi0=1, psi1=p1, psi2=p1^2+p2
hist = list(ar)
fc = []
for _ in range(3):
    v = c + p1 * hist[-1] + p2 * hist[-2]
    fc.append(float(v))
    hist.append(v)
psi = [1.0, p1, p1 * p1 + p2]
se = [float(np.sqrt(sigma2 * sum(p * p for p in psi[: h + 1]))) for h in range(3)]

lb_q, lb_p = ljung_box(res, 10, 2)

rw = np.round(100 + np.cumsum(rng.normal(0.5, 1.0, 150)), 4)
kpss_rw, lags_rw = kpss(rw)
kpss_drw, _ = kpss(np.diff(rw))
kpss_ar, lags_ar = kpss(ar)

out = {
    "_source": "lib/engine/__tests__/fixtures/make_arima_ref.py (numpy %s, scipy %s)"
    % (np.__version__, __import__("scipy").__version__),
    "ar2": {
        "data": [float(v) for v in ar],
        "acf": acf(ar, 5),
        "pacf": pacf_yule_walker(ar, 5),
        "ols": {"c": c, "phi1": p1, "phi2": p2, "mu": c / (1 - p1 - p2), "sigma2": sigma2},
        "forecast": fc,
        "se": se,
        "ljungBox": {"lags": 10, "fitdf": 2, "q": lb_q, "pValue": lb_p},
        "kpss": {"stat": kpss_ar, "lags": lags_ar},
    },
    "randomWalk": {
        "data": [float(v) for v in rw],
        "kpss": {"stat": kpss_rw, "lags": lags_rw},
        "kpssDiff": {"stat": kpss_drw},
    },
}
path = pathlib.Path(__file__).with_name("arima-ref.json")
path.write_text(json.dumps(out, indent=1))
print("ditulis:", path, "| OLS", round(c, 4), round(p1, 4), round(p2, 4), "| KPSS rw", round(kpss_rw, 3), "diff", round(kpss_drw, 3))

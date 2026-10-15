import { mulberry32 } from "../../multivariate";

/**
 * Data churn sintetis: churn ditentukan keluhan ≥ 3 DAN langganan < 12 bulan,
 * diberi 10% label noise. kota = fitur pengganggu (tidak berpengaruh).
 * Balanced accuracy optimal (Bayes) ≈ 0,76 karena noise.
 */
export function churnCsv(n = 600, seed = 77): string {
  const rand = mulberry32(seed);
  const lines = ["id_pelanggan,kota,paket,lama_langganan_bulan,keluhan,tagihan_bulanan,churn"];
  for (let i = 0; i < n; i++) {
    const lama = Math.round(1 + rand() * 47);
    const keluhan = Math.floor(rand() * 6);
    const paket = ["Basic", "Plus", "Pro"][Math.floor(rand() * 3)];
    const tagihan = Math.round((paket === "Basic" ? 99 : paket === "Plus" ? 149 : 249) * 1000 * (0.9 + rand() * 0.2));
    let churn = keluhan >= 3 && lama < 12;
    if (rand() < 0.1) churn = !churn;
    lines.push(
      [`P${String(i + 1).padStart(4, "0")}`, ["Surabaya", "Malang", "Kediri"][Math.floor(rand() * 3)], paket, lama, keluhan, tagihan, churn ? "Ya" : "Tidak"].join(","),
    );
  }
  return lines.join("\n");
}

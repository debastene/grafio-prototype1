/**
 * OpenRouter client (free-tier first).
 *
 * Strategy: chain banyak free model dari provider berbeda. Saat satu kena
 * 429 (rate-limited upstream), langsung lompat ke model berikutnya. Provider
 * sengaja didiversifikasi (Qwen / NVIDIA / Z-AI / Google / OpenAI / Meta /
 * MiniMax) supaya 1 provider down tidak mematikan seluruh chain.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Per-task PRIMARY model. Lihat CHAINS untuk fallback order.
 */
export const MODELS = {
  insight: "qwen/qwen3-next-80b-a3b-instruct:free",
  deep: "nvidia/nemotron-3-super-120b-a12b:free",
  chat: "openai/gpt-oss-20b:free",
  fallback: "meta-llama/llama-3.3-70b-instruct:free",
} as const;

/**
 * Diversified free-tier chains. Urutan: MODEL CEPAT (MoE / small active params)
 * dulu, baru model besar. Beda provider supaya 1 provider down tidak mematikan
 * seluruh chain. Per-attempt timeout (lihat callOpenRouter) jaga supaya tidak
 * stuck di model lambat.
 */
export const CHAINS = {
  // Untuk structured JSON (analyze/clarify/narrate/followup). Fast first.
  structured: [
    "qwen/qwen3-next-80b-a3b-instruct:free",   // MoE 3B active, structured ✓
    "nvidia/nemotron-nano-9b-v2:free",         // 9B, fast, structured ✓
    "google/gemma-3-27b-it:free",              // response_format ✓
    "minimax/minimax-m2.5:free",               // response_format ✓
    "nvidia/nemotron-3-super-120b-a12b:free",  // MoE 12B active, structured ✓
    "meta-llama/llama-3.3-70b-instruct:free",  // last resort (no native JSON)
  ],
  // Untuk reasoning dalam (narrate insights). Lebih lambat tapi tajam.
  reasoning: [
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "minimax/minimax-m2.5:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],
  // Untuk chat (response cepat). Small/MoE models dulu.
  chat: [
    "openai/gpt-oss-20b:free",                 // MoE 3.6B active, fastest
    "z-ai/glm-4.5-air:free",                   // MoE compact
    "nvidia/nemotron-nano-9b-v2:free",         // 9B
    "qwen/qwen3-next-80b-a3b-instruct:free",   // MoE 3B active
    "google/gemma-3-12b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],
} as const;

/** Per-attempt timeout. 10s = enough untuk model cepat, fast-fail untuk lambat. */
const DEFAULT_TIMEOUT_MS = 10_000;

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

type CallOpts = {
  model: string;
  messages: ChatMsg[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json_object" | "text";
  signal?: AbortSignal;
  /** Per-call timeout (ms). Default 10s. */
  timeoutMs?: number;
};

export async function callOpenRouter({
  model,
  messages,
  temperature = 0.4,
  maxTokens,
  responseFormat = "text",
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CallOpts): Promise<{ text: string; model: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY belum diset. Daftar gratis di openrouter.ai/keys, lalu tambahkan ke .env.local dan restart `npm run dev`.",
    );
  }

  const body: Record<string, unknown> = { model, messages, temperature };
  if (maxTokens) body.max_tokens = maxTokens;
  if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  // Combine caller signal with our timeout signal so EITHER cancels the fetch.
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), timeoutMs);
  const onCallerAbort = () => timeoutCtrl.abort();
  if (signal) signal.addEventListener("abort", onCallerAbort, { once: true });

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.OPENROUTER_REFERER ?? "https://grafio.local",
        "X-Title": "Grafio",
      },
      body: JSON.stringify(body),
      signal: timeoutCtrl.signal,
    });
  } catch (e) {
    const err = e as Error & { name?: string };
    const isAbort = err.name === "AbortError";
    const wrapped = new Error(isAbort ? `Timeout ${timeoutMs}ms` : err.message ?? "Network error");
    (wrapped as Error & { status?: number }).status = isAbort ? 504 : 599;
    throw wrapped;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onCallerAbort);
  }

  if (!res.ok) {
    const err = await res.text();
    // Tag with status so callers (and callWithFallback) can detect 429.
    const e = new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
    (e as Error & { status?: number }).status = res.status;
    throw e;
  }
  const json = await res.json();

  // OpenRouter sometimes returns 200 with an embedded provider error
  // (e.g. upstream 429 wrapped in choices.error). Treat as failure so the
  // fallback chain can move on instead of returning empty.
  if (json?.error) {
    const e = new Error(
      `OpenRouter provider error: ${typeof json.error === "string" ? json.error : json.error.message ?? "unknown"}`,
    );
    (e as Error & { status?: number }).status = Number(json.error.code) || 502;
    throw e;
  }

  const txt = json?.choices?.[0]?.message?.content;
  if (typeof txt !== "string" || txt.length === 0) {
    const e = new Error("OpenRouter: response kosong");
    (e as Error & { status?: number }).status = 502;
    throw e;
  }
  return { text: txt, model: json?.model ?? model };
}

/**
 * Try each model in order. On 429 (or upstream-rate-limit), pause briefly
 * before next attempt so we don't burn the whole chain in a single tick.
 */
export async function callWithFallback(
  models: readonly string[],
  opts: Omit<CallOpts, "model">,
): Promise<{ text: string; model: string }> {
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    try {
      return await callOpenRouter({ ...opts, model: m });
    } catch (e) {
      lastErr = e;
      const status = (e as Error & { status?: number }).status;
      // Brief backoff only between attempts, only for transient errors.
      // 504 = our own timeout, 599 = network. Move on quickly.
      if (
        i < models.length - 1 &&
        (status === 429 || status === 502 || status === 503 || status === 504 || status === 599)
      ) {
        await sleep(80);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Semua model gagal");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip ```json fences and parse JSON resiliently. */
export function safeParseJSON<T = unknown>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Output AI bukan JSON valid");
    return JSON.parse(m[0]) as T;
  }
}

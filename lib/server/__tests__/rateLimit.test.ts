import { afterEach, describe, it, expect, vi } from "vitest";
import { resetMemoryLimiter, take, takeMemory, takeUpstash } from "../rateLimit";

afterEach(() => {
  resetMemoryLimiter();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("takeMemory — sliding window", () => {
  it("izinkan sampai limit, tolak sesudahnya dengan Retry-After yang benar", () => {
    const t0 = 1_000_000;
    expect(takeMemory("k", 2, 60_000, t0)).toMatchObject({ ok: true, remaining: 1 });
    expect(takeMemory("k", 2, 60_000, t0 + 1_000)).toMatchObject({ ok: true, remaining: 0 });
    const denied = takeMemory("k", 2, 60_000, t0 + 2_000);
    expect(denied).toMatchObject({ ok: false, retryAfterSec: 58 });
  });

  it("slot terbuka lagi setelah window lewat", () => {
    const t0 = 1_000_000;
    takeMemory("k", 1, 10_000, t0);
    expect(takeMemory("k", 1, 10_000, t0 + 5_000).ok).toBe(false);
    expect(takeMemory("k", 1, 10_000, t0 + 10_001).ok).toBe(true);
  });

  it("key berbeda tidak saling memengaruhi", () => {
    takeMemory("a", 1, 10_000, 0);
    expect(takeMemory("b", 1, 10_000, 0).ok).toBe(true);
  });
});

describe("takeUpstash — REST + Lua", () => {
  it("mengirim EVAL ke Upstash dan memetakan hasil diizinkan/ditolak", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: [1, 4] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: [0, 1_000] })));
    vi.stubGlobal("fetch", fetchMock);

    expect(await takeUpstash("chat:user:x", 5, 60_000, 2_000)).toEqual({ ok: true, remaining: 4, backend: "upstash" });
    expect(await takeUpstash("chat:user:x", 5, 60_000, 2_000)).toEqual({ ok: false, retryAfterSec: 59, backend: "upstash" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.upstash.io");
    expect(init.headers.Authorization).toBe("Bearer tok");
    const body = JSON.parse(init.body);
    expect(body[0]).toBe("EVAL");
    expect(body[3]).toBe("grafio:rl:chat:user:x");
  });

  it("Upstash error → take() jatuh ke in-memory (tetap membatasi, tidak fail-open)", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await take("analyze:ip:1", 1, 60_000)).toMatchObject({ ok: true, backend: "memory" });
    expect(await take("analyze:ip:1", 1, 60_000)).toMatchObject({ ok: false, backend: "memory" });
  });

  it("tanpa env Upstash → langsung in-memory", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(await take("x", 1, 1_000)).toMatchObject({ ok: true, backend: "memory" });
  });
});

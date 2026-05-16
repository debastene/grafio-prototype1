"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Sparkles, User, Bot, Cpu, Database } from "lucide-react";
import { EngineResult } from "@/lib/engine";
import { answerQuery, suggestQuestions, QueryAnswer } from "@/lib/engine/query";

type Msg = {
  role: "user" | "ai";
  text: string;
  data?: QueryAnswer["data"];
  matched?: string[];
  confidence?: number;
  via?: "engine" | "ai";
  model?: string;
};

const AI_FALLBACK_MARKERS = [
  "Saya belum mengerti pertanyaan itu",
  "saya belum mengerti",
  "tidak bisa menjawab",
];

function buildChatContext(ctx: EngineResult) {
  return {
    fileName: ctx.fileName,
    rowCount: ctx.rowCount,
    columnCount: ctx.columnCount,
    domain: `${ctx.domain.name}${ctx.domain.description ? " — " + ctx.domain.description : ""}`,
    userContext: ctx.userContext,
    conclusion: ctx.conclusion,
    columns: ctx.profile.slice(0, 30).map((p) => ({
      name: p.name,
      type: p.type,
      nulls: p.missing,
      mean: p.summary?.mean,
      median: p.summary?.median,
      min: p.summary?.min,
      max: p.summary?.max,
      topValues: p.topValues?.slice(0, 3).map((t) => ({
        value: String(t.value),
        count: t.count,
      })),
    })),
    sample: ctx.tableSnapshot.rows.slice(0, 5),
    insights: ctx.insights.slice(0, 4),
  };
}

async function askAi(
  question: string,
  history: Msg[],
  ctx: EngineResult,
  signal: AbortSignal,
): Promise<{ text: string; model: string }> {
  const apiMessages = history
    .filter((m, i) => !(i === 0 && m.role === "ai"))
    .map((m) => ({
      role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
      content: m.text,
    }))
    .concat([{ role: "user" as const, content: question }]);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: apiMessages,
      dataset: buildChatContext(ctx),
    }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI gagal merespons");
  return { text: data.reply, model: data.model };
}

type Props = {
  context?: EngineResult | null;
};

const DEFAULT_SUGGESTIONS = [
  "Apa tren utama dari data ini?",
  "Identifikasi anomali",
  "Rekomendasikan chart terbaik",
  "Ringkas data ini",
];

export default function AiAssistant({ context }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [followups, setFollowups] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  // After each AI reply, fetch 3 contextual follow-up suggestions.
  const fetchFollowups = async (lastQ: string, lastA: string) => {
    if (!context) return;
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "followup",
          context: {
            lastQuestion: lastQ,
            lastAnswer: lastA,
            columns: context.profile.slice(0, 15).map((p) => p.name),
            domain: context.domain.name,
          },
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.questions)) {
        setFollowups(data.questions.slice(0, 3));
      }
    } catch {
      /* non-blocking — ignore failures */
    }
  };

  // Reset chat when context changes
  useEffect(() => {
    if (context) {
      setMsgs([
        {
          role: "ai",
          text: `Halo! Saya sudah membaca ${context.fileName} (${context.rowCount} baris × ${context.columnCount} kolom). Tanyakan apa saja — rata-rata, total, top N, korelasi, tren, anomali, atau filter spesifik.`,
        },
      ]);
    } else {
      setMsgs([
        {
          role: "ai",
          text: "Halo! Upload data terlebih dulu, lalu tanyakan apa saja tentangnya.",
        },
      ]);
    }
  }, [context]);

  // Scroll the chat container internally — bukan page-level scroll.
  // Sebelumnya `endRef.scrollIntoView` mem-bubble scroll ke window sehingga
  // setiap reply chat bikin halaman seluruh dashboard auto-scroll ke bawah.
  // Sekarang langsung set scrollTop di parent scroll container.
  useEffect(() => {
    const end = endRef.current;
    if (!end) return;
    const scrollContainer = end.parentElement; // div overflow-y-auto
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [msgs, thinking]);

  const dynamicSuggestions = useMemo(() => {
    if (context) return suggestQuestions(context);
    return DEFAULT_SUGGESTIONS;
  }, [context]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    const newHistory: Msg[] = [...msgs, { role: "user", text: t }];
    setMsgs(newHistory);
    setInput("");
    setThinking(true);
    setFollowups([]); // clear old chips while new reply is being generated

    if (!context) {
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: "Saya butuh data untuk menjawab. Upload file CSV/JSON lalu klik 'Mulai Analisis' di atas.",
        },
      ]);
      setThinking(false);
      return;
    }

    // 1. Try local rule-based engine first (fast, deterministic for structured Q)
    const ans = answerQuery(t, context);
    const lowConfidence =
      ans.confidence < 0.5 ||
      AI_FALLBACK_MARKERS.some((m) => ans.text.includes(m));

    // 2. If engine confident → use it. Otherwise → fall back to AI.
    if (!lowConfidence) {
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: ans.text,
          data: ans.data,
          matched: ans.matchedColumns,
          confidence: ans.confidence,
          via: "engine",
        },
      ]);
      setThinking(false);
      fetchFollowups(t, ans.text);
      return;
    }

    try {
      const ac = new AbortController();
      const ai = await askAi(t, msgs, context, ac.signal);
      setMsgs((m) => [
        ...m,
        { role: "ai", text: ai.text, via: "ai", model: ai.model },
      ]);
      fetchFollowups(t, ai.text);
    } catch {
      // AI not available (rate-limit, network, no key) — fall back silently
      // to the engine answer. No scary error in the bubble.
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text: ans.text,
          data: ans.data,
          matched: ans.matchedColumns,
          confidence: ans.confidence,
          via: "engine",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="glass rounded-xl flex flex-col h-[460px]">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-borderColor">
        <div className="w-8 h-8 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center">
          <Cpu className="w-4 h-4 text-cyan" />
        </div>
        <div>
          <p className="font-syne font-bold text-white text-sm">Grafio Engine Q&amp;A</p>
          <p className="text-[10px] uppercase tracking-widest text-mint flex items-center gap-1">
            {context ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
                Connected · {context.rowCount} rows
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                Awaiting data
              </>
            )}
          </p>
        </div>
        {context && (
          <span className="ml-auto text-[10px] text-muted font-mono truncate max-w-[120px]" title={context.fileName}>
            <Database className="w-3 h-3 inline mr-1" />
            {context.fileName}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center ${
                m.role === "user" ? "bg-purple/20 text-purple" : "bg-cyan/15 text-cyan"
              }`}
            >
              {m.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={`max-w-[85%] ${m.role === "user" ? "text-right" : ""}`}>
              <div
                className={`rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-cyan text-bgDeep inline-block"
                    : "bg-bgSurface border border-borderColor text-white"
                }`}
              >
                {m.text}
              </div>
              {m.data && (
                <div className="mt-2 rounded-md border border-borderColor bg-bgSurface/60 p-2">
                  {m.data.kind === "scalar" && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted truncate">{m.data.label}</span>
                      <span className="font-mono font-semibold text-cyan ml-2">{m.data.value}</span>
                    </div>
                  )}
                  {m.data.kind === "table" && (
                    <table className="w-full text-xs">
                      <tbody>
                        {m.data.rows.map((r, j) => (
                          <tr key={j} className="border-b border-borderColor/40 last:border-0">
                            <td className="py-1.5 pr-2 text-muted truncate max-w-[140px]">{r.name}</td>
                            <td className="py-1.5 pl-2 text-right font-mono text-cyan">{r.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {m.data.kind === "list" && (
                    <ul className="text-xs text-muted space-y-1">
                      {m.data.items.slice(0, 8).map((it, j) => (
                        <li key={j} className="flex gap-1.5">
                          <span className="text-cyan">•</span>
                          <span>{it}</span>
                        </li>
                      ))}
                      {m.data.items.length > 8 && (
                        <li className="text-[10px] italic">+ {m.data.items.length - 8} lagi…</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
              {m.matched && m.matched.length > 0 && (
                <p className="text-[10px] text-muted mt-1 font-mono">
                  Kolom: {m.matched.join(", ")}
                </p>
              )}
              {m.role === "ai" && m.via && (
                <p className="text-[9px] text-muted mt-1 uppercase tracking-widest">
                  {m.via === "ai"
                    ? `via AI · ${(m.model || "openrouter").split("/")[1]?.split(":")[0] ?? m.model}`
                    : "via Grafio Engine"}
                </p>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-md bg-cyan/15 text-cyan flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1 bg-bgSurface border border-borderColor rounded-lg px-3 py-2.5">
              <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" style={{ animationDelay: "0.15s" }} />
              <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {msgs.length <= 1 && (
        <div className="px-5 pb-2 flex flex-wrap gap-1.5">
          {dynamicSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-borderColor text-muted hover:border-cyan hover:text-cyan transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {msgs.length > 1 && followups.length > 0 && !thinking && (
        <div className="px-5 pb-2">
          <p className="text-[9px] uppercase tracking-widest text-muted mb-1.5">
            ✨ Tanya lanjutan
          </p>
          <div className="flex flex-wrap gap-1.5">
            {followups.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-purple/40 bg-purple/5 text-purple hover:bg-purple/20 transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-borderColor px-3 py-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={context ? "Tanya apa saja tentang datamu…" : "Upload data dulu untuk mulai bertanya…"}
          disabled={!context}
          className="flex-1 bg-bgSurface border border-borderColor rounded-md px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-cyan/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!context || !input.trim()}
          aria-label="Send"
          className="w-9 h-9 rounded-md bg-cyan text-bgDeep flex items-center justify-center hover:bg-cyanSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

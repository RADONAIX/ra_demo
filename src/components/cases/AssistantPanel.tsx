import { useEffect, useRef, useState } from "react";
import { Bot, Paperclip, Pin, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, type AssuranceCase } from "@/lib/casesDemo";

// DEMO-ONLY. There is no LLM anywhere in this project — no dependency, no
// /chat endpoint — so every reply here is scripted and keyword-matched against
// the open case. Wiring this to a real model means a new backend integration.

interface Message {
  id: string;
  role: "user" | "assistant";
  body: string;
  pinned?: boolean;
}

// Canned answers, written for revenue assurance. First matching rule wins.
function reply(question: string, c: AssuranceCase): string {
  const q = question.toLowerCase();
  const traceN = c.trace.length;
  const mismatches = c.trace.filter((t) => t.status === "AMOUNT_MISMATCH").length;
  const rawOnly = c.trace.filter((t) => t.status === "RAW_ONLY").length;

  if (q.includes("analyz") || q.includes("linked record") || q.includes("trace")) {
    if (!traceN) return `No linked records are attached to ${c.reference}. The finding was raised at file level on batch ${c.linkedBatch}, so there is nothing to trace at record level.`;
    return `Batch ${c.linkedBatch} (${c.stream} · ${c.nodeId}) carries ${traceN} linked records: ${mismatches} amount mismatches and ${rawOnly} raw-only. Estimated exposure ${fmtMoney(c.estimatedImpact)}. The mismatch spread is consistent — a rating-table drift rather than random loss.`;
  }
  if (q.includes("impact") || q.includes("leak") || q.includes("revenue") || q.includes("cost")) {
    return `Estimated revenue at risk for ${c.reference} is ${fmtMoney(c.estimatedImpact)}, derived from the raw-vs-processed delta across the linked records. Treat it as an upper bound until the re-delivery lands.`;
  }
  if (q.includes("why") || q.includes("cause") || q.includes("root")) {
    return `The ${c.findingType.replace(/_/g, " ")} check fired on ${c.linkedBatch}. The pattern is confined to ${c.nodeId}, which points at a node-local cause — collector restart or a stale rating table — rather than a platform-wide issue.`;
  }
  if (q.includes("recommend") || q.includes("next") || q.includes("action") || q.includes("should")) {
    return `Suggested next step for ${c.reference}: confirm whether ${c.linkedBatch} was re-delivered upstream. If it was, re-run the reconciliation and close as adjusted. If not, escalate to the carrier and set the action to "Escalated to carrier".`;
  }
  if (q.includes("similar") || q.includes("before") || q.includes("history") || q.includes("recur")) {
    return `Two comparable findings on ${c.stream}/${c.nodeId} in the last 30 days, both ${c.findingType.replace(/_/g, " ")}. Both closed as adjusted & rebilled within 48h. Recurrence on the same node suggests a standing config issue worth raising.`;
  }
  return `I can help with ${c.reference}. Try: "analyze linked records", "what's the revenue impact", "why did this fire", "what should I do next", or "any similar cases".`;
}

export function AssistantPanel({
  activeCase,
  onPin,
}: Readonly<{ activeCase: AssuranceCase; onPin: (body: string) => void }>) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset the thread whenever a different case is opened.
  useEffect(() => {
    setMessages([]);
    setInput("");
    setThinking(false);
  }, [activeCase.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setMessages((m) => [...m, { id: `u-${m.length}`, role: "user", body: q }]);
    setInput("");
    setThinking(true);
    // Small delay so the exchange reads as a live interaction.
    window.setTimeout(() => {
      setMessages((m) => [...m, { id: `a-${m.length}`, role: "assistant", body: reply(q, activeCase) }]);
      setThinking(false);
    }, 700);
  };

  const pin = (m: Message) => {
    onPin(m.body);
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, pinned: true } : x)));
    toast.success("Pinned to Saved Insights");
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground leading-none">Assurance Assistant</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[220px]">
        {messages.length === 0 && !thinking && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-8">
            <Sparkles className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground max-w-[220px]">
              Ask about the linked records, revenue impact, or what to do next on {activeCase.reference}.
            </p>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground">{m.body}</div>
            </div>
          ) : (
            <div key={m.id} className="flex flex-col gap-1 items-start">
              <div className="max-w-[92%] rounded-xl rounded-bl-sm border border-border bg-muted/30 px-3 py-2 text-xs text-foreground/90 leading-relaxed">
                {m.body}
              </div>
              <div className="flex items-center gap-2 pl-1">
                <button
                  onClick={() => pin(m)}
                  disabled={m.pinned}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary disabled:opacity-40 disabled:hover:text-muted-foreground"
                >
                  <Pin className="h-3 w-3" /> {m.pinned ? "Pinned" : "Pin"}
                </button>
              </div>
            </div>
          ),
        )}

        {thinking && (
          <div className="flex items-center gap-1.5 pl-1" aria-label="Assistant is typing">
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
            placeholder="Ask a question…"
            aria-label="Ask the assistant"
            className="flex-1 bg-transparent text-xs focus:outline-none"
          />
          <button
            onClick={() => ask(input)}
            disabled={!input.trim() || thinking}
            aria-label="Send"
            className="h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          onClick={() => ask("Analyze linked records")}
          disabled={thinking}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> Analyze linked records
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import ChatInput from "@/components/ChatInput";
import MessageList from "@/components/MessageList";
import { Message } from "@/lib/types";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const handleSend = async (query: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        sources: [],
        subQuestions: [],
        phase: "searching",
      },
    ]);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";
      let streamSources: any[] = [];
      let streamSubQuestions: string[] = [];
      let streamHasContradictions = false;
      let streamVerificationNotes: string[] = [];
      let lastEventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            lastEventType = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ")) {
            const rawData = line.slice(6);
            try {
              const eventData = JSON.parse(rawData);

              if (lastEventType === "chunk") {
                // Streaming text chunk
                accumulated += eventData.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...msg,
                          content: accumulated,
                          phase: "writing",
                        }
                      : msg
                  )
                );
              } else if (lastEventType === "done") {
                streamSources = eventData.sources || [];
                streamSubQuestions = eventData.sub_questions_used || [];
                streamHasContradictions = eventData.has_contradictions || false;
                streamVerificationNotes = eventData.verification_notes || [];
              } else if (lastEventType === "error") {
                throw new Error(eventData.message || "Stream error");
              }
            } catch (e) {
              // Skip malformed JSON lines
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      // Finalize message with all metadata
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: accumulated || "Sorry, I couldn't find an answer.",
                sources: streamSources,
                subQuestions: streamSubQuestions,
                hasContradictions: streamHasContradictions,
                verificationNotes: streamVerificationNotes,
                phase: "done",
              }
            : msg
        )
      );
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: `Error: ${errMessage}`,
                phase: "done",
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-cyan-600 flex items-center justify-center shadow-lg shadow-accent/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--surface)]" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-[var(--foreground)] text-sm tracking-wide">AI Research Tool</span>
            <span className="text-[10px] text-[var(--muted)] leading-none mt-0.5">Multi-step agentic search</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[var(--muted)] px-2 py-1 rounded-md bg-[var(--surface-light)] border border-[var(--border)] font-mono">
            v0.7 — Phase 7
          </span>
        </div>
      </header>

      {/* Messages area */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <MessageList messages={messages} isLoading={isLoading} />
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input area */}
      <footer className="relative z-10 px-4 py-4 border-t border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSend} isLoading={isLoading} />
        </div>
      </footer>
    </div>
  );
}

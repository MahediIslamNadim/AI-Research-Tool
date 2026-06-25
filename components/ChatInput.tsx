"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (query: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [query]);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={`relative border rounded-2xl bg-[var(--surface)] p-3 transition-all duration-200 ${
        isFocused
          ? "border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-glow)]"
          : "border-[var(--border)] hover:border-[var(--surface-light)]"
      }`}
    >
      <textarea
        ref={textareaRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Ask anything... (complex research questions work best)"
        rows={1}
        className="w-full resize-none bg-transparent text-[var(--foreground)] placeholder-[var(--muted)] outline-none text-base leading-relaxed"
        disabled={isLoading}
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]">
        <span className="text-[11px] text-[var(--muted)]">
          Enter to send · Shift+Enter for new line
        </span>
        <button
          onClick={handleSubmit}
          disabled={!query.trim() || isLoading}
          className="relative px-5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-[var(--accent)] text-black hover:bg-cyan-300 active:scale-95"
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-black/70 animate-typing-dot" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 rounded-full bg-black/70 animate-typing-dot" style={{ animationDelay: "200ms" }} />
                <span className="w-1 h-1 rounded-full bg-black/70 animate-typing-dot" style={{ animationDelay: "400ms" }} />
              </span>
              Researching
            </span>
          ) : (
            "Search"
          )}
        </button>
      </div>
    </div>
  );
}

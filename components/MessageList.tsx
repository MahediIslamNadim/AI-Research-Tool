"use client";

import { Message } from "@/lib/types";
import AnswerStream from "./AnswerStream";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12">
        <div className="animate-fade-in-up">
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-cyan-600 flex items-center justify-center mb-5 mx-auto shadow-lg shadow-accent/20">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full border-2 border-black bg-[var(--accent)] animate-pulse-glow flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          AI Research Tool
        </h2>
        <p className="text-[var(--muted)] max-w-md text-sm leading-relaxed animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          Ask complex questions and I&apos;ll research them with multi-step search, source verification, and cited answers.
        </p>

        <div className="mt-8 flex flex-col gap-2.5 w-full max-w-sm animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          {[
            "What is quantum computing and how does it work?",
            "Compare React vs Vue for large-scale apps",
            "Latest developments in fusion energy 2025",
          ].map((example, i) => (
            <div
              key={i}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--muted)] text-left hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-all duration-200 cursor-default"
              style={{ animationDelay: `${400 + i * 100}ms` }}
            >
              {example}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          className="flex flex-col gap-2 animate-fade-in-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {msg.role === "user" && (
            <div className="flex justify-end">
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[var(--user-bubble)] text-white font-medium text-sm border border-[var(--border)]">
                {msg.content}
              </div>
            </div>
          )}

          {msg.role === "assistant" && (
            <div className="max-w-[95%]">
              <AnswerStream
                content={msg.content}
                sources={msg.sources}
                phase={msg.phase}
                subQuestions={msg.subQuestions}
                hasContradictions={msg.hasContradictions}
                verificationNotes={msg.verificationNotes}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

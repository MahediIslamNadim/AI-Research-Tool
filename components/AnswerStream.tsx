"use client";

import { Source } from "@/lib/types";

interface AnswerStreamProps {
  content: string;
  sources?: Source[];
  phase?: string;
  subQuestions?: string[];
  hasContradictions?: boolean;
  verificationNotes?: string[];
}

export default function AnswerStream({
  content,
  sources,
  phase,
  subQuestions,
  hasContradictions,
  verificationNotes,
}: AnswerStreamProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Phase indicator — animated loading */}
      {phase && phase !== "done" && (
        <div className="flex items-center gap-2.5 text-xs text-[var(--accent)]">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-typing-dot" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-typing-dot" style={{ animationDelay: "200ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-typing-dot" style={{ animationDelay: "400ms" }} />
          </div>
          <span>
            {phase === "searching" && "Searching the web..."}
            {phase === "reading" && "Reading sources..."}
            {phase === "writing" && "Writing answer..."}
            {phase === "verifying" && "Verifying against sources..."}
          </span>
        </div>
      )}

      {/* Answer content with markdown-like formatting */}
      {content && (
        <div className="text-[var(--foreground)] leading-[1.7] text-[15px] whitespace-pre-wrap">
          {content}
        </div>
      )}

      {/* Verification badge */}
      {phase === "done" && (
        <div className="flex items-center gap-2 flex-wrap">
          {hasContradictions === false && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Verified — no contradictions
            </span>
          )}
          {hasContradictions === true && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Contradictions detected
            </span>
          )}
          {verificationNotes && verificationNotes.length > 0 && (
            <span className="text-[11px] text-[var(--muted)]">
              {verificationNotes.length} verification note{verificationNotes.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Sub-questions explored */}
      {subQuestions && subQuestions.length > 0 && (
        <div className="px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <span className="text-[11px] text-[var(--muted)] font-semibold uppercase tracking-wider">
            Sub-questions explored ({subQuestions.length})
          </span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {subQuestions.map((q, i) => (
              <li
                key={i}
                className="text-xs text-[var(--foreground)] pl-3 border-l-2 border-[var(--accent)] leading-relaxed"
              >
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources / Citations */}
      {sources && sources.length > 0 && (
        <div className="border-t border-[var(--border)] pt-3 mt-1">
          <h4 className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2.5">
            Sources ({sources.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {sources.map((source, i) => (
              <CitationPill key={i} index={i + 1} source={source} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CitationPill({ index, source }: { index: number; source: Source }) {
  const hostname = (() => {
    try {
      return new URL(source.url).hostname;
    } catch {
      return source.url;
    }
  })();

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--accent)] hover:bg-[var(--surface-light)] hover:border-[var(--accent)] transition-all duration-200"
    >
      <span className="font-mono text-[10px] bg-[var(--accent)]/15 text-[var(--accent)] px-1.5 py-0.5 rounded font-bold group-hover:bg-[var(--accent)]/25 transition-colors">
        {index}
      </span>
      <span className="truncate max-w-[180px] group-hover:text-cyan-300 transition-colors">
        {source.title || hostname}
      </span>
      <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

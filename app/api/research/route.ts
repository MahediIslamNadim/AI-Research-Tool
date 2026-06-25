import { NextRequest } from "next/server";
import * as https from "https";
import { Source } from "@/lib/types";
import { MODELS } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 180;

function httpsFetch(url: string, options: any): Promise<{ ok: boolean; json: () => Promise<any>; status: number }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: options.method || "GET",
        headers: options.headers || {},
        timeout: 10000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            json: async () => JSON.parse(body),
          });
        });
      }
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    req.on("error", (e) => reject(e));
    if (options.body) req.write(options.body);
    req.end();
  });
}

function httpsFetchStream(url: string, options: any): Promise<{ body: NodeJS.ReadableStream }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: "POST",
        headers: options.headers || {},
        timeout: 120000,
      },
      (res) => {
        resolve({ body: res as unknown as NodeJS.ReadableStream });
      }
    );
    req.on("error", (e) => reject(e));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function callOpenRouter(
  messages: any[],
  model: string,
  maxTokens: number = 2048,
  temperature: number = 0.3
): Promise<string> {
  // Tiered fallback: if primary model fails with 429, try fallback chain
  const fallbackChain: Record<string, string[]> = {
    [MODELS.cheap]: [MODELS.strong],
    [MODELS.mid]: [MODELS.strong],
    [MODELS.strong]: [],
  };
  const fallbacks = fallbackChain[model] || [];
  const modelsToTry = [model, ...fallbacks];

  for (const tryModel of modelsToTry) {
    try {
      const result = await callOpenRouterInner(messages, tryModel, maxTokens, temperature);
      if (tryModel !== model) {
        console.log(`[ModelRouter] Fallback: ${model} → ${tryModel}`);
      }
      return result;
    } catch (err: any) {
      const isRateLimit = err?.message?.includes("429") || err?.message?.includes("rate limit");
      if (isRateLimit && fallbacks.length > 0) {
        console.warn(`[ModelRouter] Rate limited on ${model}, trying fallback...`);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`All models failed. Started with: ${model}`);
}

async function callOpenRouterInner(
  messages: any[],
  model: string,
  maxTokens: number = 2048,
  temperature: number = 0.3
): Promise<string> {
  const res = await httpsFetchStream("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.OPENROUTER_API_KEY,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "AI Research Tool",
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
  });

  let answer = "";
  const decoder = new TextDecoder();
  const reader = res.body as unknown as AsyncIterable<Uint8Array>;
  for await (const chunk of reader) {
    const text = decoder.decode(chunk, { stream: true });
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) answer += delta;
        } catch { /* skip */ }
      }
    }
  }
  return answer;
}

async function tavilySearch(query: string, maxResults: number = 5): Promise<any[]> {
  try {
    const res = await httpsFetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: "advanced",
        include_raw_content: true,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.results || [];
    }
  } catch { /* skip */ }
  return [];
}

// Agentic research loop
async function agenticResearch(query: string) {
  const subQuestionsUsed: string[] = [];
  const allResults: any[] = [];

  // Step 1: Decompose
  const decomposePrompt = `Decompose this research query into 2-4 specific sub-questions that together cover the full scope. Return ONLY a JSON array of strings. If simple, return ["${query}"].

Query: "${query}"`;

  let subQuestions: string[] = [query];
  try {
    const result = await callOpenRouter(
      [{ role: "user", content: decomposePrompt }],
      MODELS.cheap,
      512,
      0.3
    );
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      subQuestions = parsed;
    }
  } catch { /* fallback to original query */ }

  // Step 2: Search each sub-question (sequential)
  for (const sq of subQuestions.slice(0, 4)) {
    const results = await tavilySearch(sq, 5);
    if (results.length > 0) {
      allResults.push(...results);
      subQuestionsUsed.push(sq);
    }
  }

  // Step 3: Deduplicate by URL
  const seen = new Set<string>();
  const uniqueResults = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Step 4: Gap check
  const contentPreview = uniqueResults
    .slice(0, 10)
    .map((r: any) => (r.content || "").slice(0, 200))
    .join("\n---\n");

  let hasEnough = true;
  try {
    const gapResult = await callOpenRouter(
      [
        {
          role: "system",
          content: `Check if there is enough information to fully answer the query. Respond with ONLY: {"hasEnough": true/false}`,
        },
        {
          role: "user",
          content: `Query: "${query}"\n\nCollected content:\n${contentPreview}`,
        },
      ],
      MODELS.cheap,
      100,
      0.2
    );
    const cleaned = gapResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    hasEnough = parsed.hasEnough !== false;
  } catch { /* assume enough */ }

  // Step 5: If not enough, do one more search with follow-up query
  if (!hasEnough && subQuestions.length < 6) {
    const followUpPrompt = `Based on what we've searched so far, what additional search query would fill information gaps? Return ONLY a JSON array with 1-2 questions. If no gaps, return [].`;

    try {
      const followUpResult = await callOpenRouter(
        [
          { role: "system", content: followUpPrompt },
          { role: "user", content: `Query: "${query}"\nAlready searched: ${JSON.stringify(subQuestionsUsed)}` },
        ],
        MODELS.cheap,
        200,
        0.4
      );
      const cleaned = followUpResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const followUps = JSON.parse(cleaned);
      if (Array.isArray(followUps)) {
        for (const fq of followUps.slice(0, 2)) {
          const results = await tavilySearch(fq, 5);
          if (results.length > 0) {
            uniqueResults.push(...results);
            subQuestionsUsed.push(fq);
          }
        }
      }
    } catch { /* skip follow-ups */ }
  }

  // Step 6: Synthesize final answer
  const sourcesSection = uniqueResults
    .map(
      (r: any, i: number) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\n${(r.content || "").slice(0, 800)}`
    )
    .join("\n\n");

  const synthesisMessages = [
    {
      role: "system",
      content: `You are a research answer synthesizer. Write a comprehensive answer with inline citations like [1], [2] mapped to the source list.

Rules:
- Use inline citations after claims from specific sources.
- Be thorough but concise. Use paragraphs or bullet points.
- If sources conflict, note the disagreement.
- Output in markdown.`,
    },
    {
      role: "user",
      content: `Query: "${query}"

Sources:
${sourcesSection}

Write a comprehensive answer:`,
    },
  ];

  const answer = await callOpenRouter(synthesisMessages, MODELS.strong, 4096, 0.7);

  // Step 7: Verification pass — cross-source contradiction check
  const verificationContent = uniqueResults
    .slice(0, 15)
    .map((r: any, i: number) => `[${i + 1}] ${r.title}\n${(r.content || "").slice(0, 400)}`)
    .join("\n\n");

  const verificationMessages = [
    {
      role: "system",
      content: `You are a fact-checking assistant. Given a draft research answer and its sources, check for contradictions BETWEEN the sources.

Rules:
- Only flag contradictions if sources directly disagree on a specific factual claim.
- Do NOT flag differences in opinion, perspective, or emphasis — only hard factual contradictions.
- Respond with ONLY a JSON object: {"hasContradictions": true/false, "notes": ["note about contradiction 1", "note 2"]}`,
    },
    {
      role: "user",
      content: `Draft answer:\n${answer}\n\nSources:\n${verificationContent}`,
    },
  ];

  let hasContradictions = false;
  let verificationNotes: string[] = [];

  try {
    const verifyResult = await callOpenRouter(verificationMessages, MODELS.mid, 512, 0.2);
    const cleaned = verifyResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const verifyParsed = JSON.parse(cleaned);
    hasContradictions = verifyParsed.hasContradictions === true;
    verificationNotes = Array.isArray(verifyParsed.notes) ? verifyParsed.notes : [];
  } catch { /* skip verification on failure */ }

  // Final dedup
  const finalSeen = new Set<string>();
  const finalResults = uniqueResults.filter((r: any) => {
    if (finalSeen.has(r.url)) return false;
    finalSeen.add(r.url);
    return true;
  });

  const sources: Source[] = finalResults.map((r: any) => ({
    url: r.url,
    title: r.title,
    content: (r.content || "").slice(0, 200),
  }));

  return { answer, sources, subQuestionsUsed, hasContradictions, verificationNotes };
}

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check API keys early for graceful error
  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!process.env.TAVILY_API_KEY) {
    return new Response(JSON.stringify({ error: "TAVILY_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SSE streaming response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1-6: Run full research pipeline (non-streaming for search/decompose/verify)
        const result = await agenticResearch(query);

        if (!result.answer) {
          throw new Error("No response from synthesis model");
        }

        // Step 7: Stream the answer word-by-word for typewriter effect
        const words = result.answer.split(/(\s+)/);
        for (const word of words) {
          send("chunk", { text: word });
          // Small delay for visual effect (remove if too slow)
          await new Promise((r) => setTimeout(r, 15));
        }

        // Step 8: Send completion with metadata
        send("done", {
          sources: result.sources,
          sub_questions_used: result.subQuestionsUsed,
          has_contradictions: result.hasContradictions,
          verification_notes: result.verificationNotes,
        });

        controller.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Research pipeline error:", message);
        send("error", { message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

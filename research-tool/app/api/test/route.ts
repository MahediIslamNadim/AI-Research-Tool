import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Simple debug endpoint to test each step
export async function GET() {
  const results: Record<string, any> = {};

  // Test Tavily
  try {
    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: "quantum computing",
        max_results: 2,
      }),
    });
    const tavilyData = await tavilyRes.json();
    results.tavily = {
      ok: true,
      count: tavilyData.results?.length || 0,
      firstTitle: tavilyData.results?.[0]?.title || "",
    };
  } catch (e: unknown) {
    results.tavily = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Test OpenRouter (cheap model)
  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b:free",
        messages: [{ role: "user", content: "Say hello in one word" }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const orData = await orRes.json();
    results.openrouter_cheap = {
      ok: !orData.error,
      status: orRes.status,
      content: orData.choices?.[0]?.message?.content || "",
      error: orData.error?.message || "",
    };
  } catch (e: unknown) {
    results.openrouter_cheap = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Test OpenRouter (strong model)
  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openrouter/owl-alpha",
        messages: [{ role: "user", content: "Say hello in one word" }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const orData = await orRes.json();
    results.openrouter_strong = {
      ok: !orData.error,
      status: orRes.status,
      content: orData.choices?.[0]?.message?.content || "",
      error: orData.error?.message || "",
    };
  } catch (e: unknown) {
    results.openrouter_strong = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json(results);
}

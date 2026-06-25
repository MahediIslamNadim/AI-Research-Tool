import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    openrouter_key: !!process.env.OPENROUTER_API_KEY,
    tavily_key: !!process.env.TAVILY_API_KEY,
    node_version: process.versions.node,
    timestamp: new Date().toISOString(),
  };

  const allOk = checks.openrouter_key && checks.tavily_key;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "warning",
      ...checks,
      message: allOk
        ? "All API keys configured"
        : "Missing API keys. Set OPENROUTER_API_KEY and TAVILY_API_KEY in .env",
    },
    { status: allOk ? 200 : 503 }
  );
}

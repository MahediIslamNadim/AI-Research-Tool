// Tavily search wrapper
const TAVILY_BASE = "https://api.tavily.com";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResponse {
  query: string;
  results: TavilyResult[];
}

export async function search(
  query: string,
  options: {
    maxResults?: number;
    searchDepth?: "basic" | "advanced";
    includeRawContent?: boolean;
  } = {}
): Promise<TavilyResult[]> {
  const {
    maxResults = 8,
    searchDepth = "advanced",
    includeRawContent = true,
  } = options;

  const res = await fetch(`${TAVILY_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: searchDepth,
      include_raw_content: includeRawContent,
      max_results: maxResults,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavily error ${res.status}: ${err}`);
  }

  const data: TavilyResponse = await res.json();
  return data.results;
}

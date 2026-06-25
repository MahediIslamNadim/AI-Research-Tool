// OpenRouter API wrapper + model routing
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export const MODELS = {
  // Decompose uses nemotron (larger free model)
  cheap: "nvidia/nemotron-3-super-120b-a12b:free",
  // Gemma for verification
  mid: "google/gemma-4-31b-it:free",
  // Final synthesis
  strong: "openrouter/owl-alpha",
} as const;

export type ModelTier = keyof typeof MODELS;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
) {
  const {
    model = MODELS.strong,
    temperature = 0.7,
    max_tokens = 4096,
    stream = false,
  } = options;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  return res;
}

// Streaming version — returns a ReadableStream of text chunks
export async function chatStream(
  messages: ChatMessage[],
  options: Omit<ChatOptions, "stream"> = {}
): Promise<ReadableStream<string>> {
  const res = await chat(messages, { ...options, stream: true });

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const chunk = decoder.decode(value, { stream: true });
      // SSE format: "data: {...}\n\n"
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              controller.enqueue(delta);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    },
  });
}

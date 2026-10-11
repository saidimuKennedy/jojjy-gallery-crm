/**
 * Provider-agnostic model client for the OpenUI assistant.
 *
 * Speaks the OpenAI-compatible Chat Completions API, so compatible providers
 * work by changing env vars only — including DeepSeek, OpenAI, Azure OpenAI,
 * OpenRouter, Groq, Together,
 * Fireworks, vLLM, LM Studio, Ollama (`/v1`), etc. Nothing here is tied to a
 * specific vendor.
 *
 *   OPENUI_MODEL_BASE_URL   e.g. https://api.deepinfra.com/v1/openai
 *                                https://api.deepseek.com
 *                                https://api.openai.com/v1
 *                                https://openrouter.ai/api/v1
 *                                http://localhost:11434/v1
 *   OPENUI_MODEL_API_KEY    bearer token (may be empty for local servers)
 *   OPENUI_MODEL_NAME       e.g. gpt-4o-mini, llama-3.1-70b, mistral-large
 *   OPENUI_MODEL_PROVIDER   optional label, e.g. "openai", "ollama"
 *
 * Server-only: the key is never sent to the browser.
 */

export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  provider: string;
}

export function getModelConfig(): ModelConfig | null {
  const baseUrl = process.env.OPENUI_MODEL_BASE_URL?.trim();
  const apiKey = process.env.OPENUI_MODEL_API_KEY?.trim() ?? "";
  const model = process.env.OPENUI_MODEL_NAME?.trim();
  if (!baseUrl || !model) return null;
  let isLocalProvider = false;
  try {
    const hostname = new URL(baseUrl).hostname;
    isLocalProvider =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";
  } catch {
    return null;
  }
  // Hosted APIs such as DeepSeek need a key. Local inference servers may omit it.
  if (!apiKey && !isLocalProvider) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model,
    provider: process.env.OPENUI_MODEL_PROVIDER?.trim() || "openai-compatible",
  };
}

export function isModelConfigured(): boolean {
  return getModelConfig() !== null;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatResult {
  content: string;
  toolCall: ToolCall | null;
}

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
}

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ChatCompletionResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: OpenAiToolCall[];
    };
  }[];
}

/**
 * One-shot chat call that may return a tool call. Uses the OpenAI-compatible
 * wire format; `tool_choice: "auto"` lets the model answer in prose or pick a
 * single allowlisted action.
 */
export async function chatWithTools(params: {
  system: string;
  user: string;
  tools: ToolDef[];
  temperature?: number;
  timeoutMs?: number;
}): Promise<ChatResult> {
  const cfg = getModelConfig();
  if (!cfg) throw new Error("Model provider not configured");

  const messages: OpenAiMessage[] = [
    { role: "system", content: params.system },
    { role: "user", content: params.user },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    params.timeoutMs ?? 20_000
  );

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: params.temperature ?? 0.2,
        tools: params.tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Model request failed (${res.status}): ${text.slice(0, 300)}`
      );
    }

    const body = (await res.json()) as ChatCompletionResponse;
    const message = body.choices?.[0]?.message;
    const call = message?.tool_calls?.[0];
    let args: Record<string, unknown> = {};
    if (call?.function.arguments) {
      try {
        args = JSON.parse(call.function.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }
    return {
      content: message?.content ?? "",
      toolCall:
        call?.function?.name
          ? { name: call.function.name, arguments: args }
          : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

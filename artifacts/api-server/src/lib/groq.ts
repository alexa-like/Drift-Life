import { logger } from "./logger";

// ── Available Groq models ─────────────────────────────────────────────────────
export interface GroqModel {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  supportsTools: boolean;
}

export const GROQ_MODELS: GroqModel[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B (Smartest)",
    description: "Most intelligent, best for complex analysis and planning",
    contextWindow: 128_000,
    supportsTools: true,
  },
  {
    id: "llama-3.1-70b-versatile",
    label: "Llama 3.1 70B",
    description: "Very smart, reliable fallback for 3.3",
    contextWindow: 128_000,
    supportsTools: true,
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B (Fastest)",
    description: "Blazing fast, best for quick commands",
    contextWindow: 128_000,
    supportsTools: true,
  },
  {
    id: "mixtral-8x7b-32768",
    label: "Mixtral 8x7B",
    description: "Good for long context game history",
    contextWindow: 32_768,
    supportsTools: true,
  },
  {
    id: "gemma2-9b-it",
    label: "Gemma 2 9B",
    description: "Balanced speed and intelligence",
    contextWindow: 8_192,
    supportsTools: false,
  },
];

export const DEFAULT_VANTA_MODEL = "llama-3.3-70b-versatile";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: GroqToolCall[];
}

export interface GroqToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface GroqTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      role: string;
      content: string | null;
      tool_calls?: GroqToolCall[];
    };
    finish_reason?: string;
  }>;
  error?: { message: string };
}

// ── Core call ─────────────────────────────────────────────────────────────────
export async function callGroq(opts: {
  model: string;
  messages: GroqMessage[];
  tools?: GroqTool[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}): Promise<{ content: string | null; toolCalls?: GroqToolCall[]; finishReason?: string }> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const messages: GroqMessage[] = opts.systemPrompt
    ? [{ role: "system", content: opts.systemPrompt }, ...opts.messages]
    : opts.messages;

  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.7,
  };

  const modelInfo = GROQ_MODELS.find((m) => m.id === opts.model);
  if (opts.tools?.length && modelInfo?.supportsTools !== false) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
    // Disable parallel tool calls — some Groq models append XML </function> tags
    // to arguments when generating multiple calls simultaneously, causing tool_use_failed 400.
    body.parallel_tool_calls = false;
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as GroqResponse;
  if (data.error) throw new Error(`Groq error: ${data.error.message}`);

  const choice = data.choices?.[0];
  if (!choice) throw new Error("No choice returned from Groq");

  return {
    content: choice.message?.content ?? null,
    toolCalls: choice.message?.tool_calls,
    finishReason: choice.finish_reason,
  };
}

// ── Ping / health check ───────────────────────────────────────────────────────
export async function pingModel(modelId: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) return { ok: false, latencyMs: 0, error: "GROQ_API_KEY not set" };

  const t0 = Date.now();
  try {
    const result = await callGroq({
      model: modelId,
      messages: [{ role: "user", content: 'Reply with exactly: "Vanta online."' }],
      maxTokens: 20,
      temperature: 0,
    });
    const ok = typeof result.content === "string" && result.content.length > 0;
    return { ok, latencyMs: Date.now() - t0 };
  } catch (err: unknown) {
    return { ok: false, latencyMs: Date.now() - t0, error: String(err) };
  }
}

// ── NPC dialogue (kept for backward compat) ───────────────────────────────────
let warnedMissingKey = false;

const FALLBACK_TAUNTS: Record<string, string[]> = {
  default: [
    '"You picked the wrong street to walk down."',
    '"New Vanta chews up people like you."',
    '"Turn around while you still can."',
  ],
};

function fallbackDialogue(npcName: string): string {
  const pool = FALLBACK_TAUNTS[npcName] ?? FALLBACK_TAUNTS["default"]!;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export async function generateNpcDialogue(
  npc: { name: string; description: string },
  outcome: "pre-fight" | "player-won" | "player-lost"
): Promise<string> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    if (!warnedMissingKey) {
      logger.info("GROQ_API_KEY not set — NPC dialogue uses static fallback lines");
      warnedMissingKey = true;
    }
    return fallbackDialogue(npc.name);
  }
  const situation =
    outcome === "pre-fight"
      ? "about to fight the player"
      : outcome === "player-won"
      ? "just been defeated by the player"
      : "just defeated the player";
  try {
    const result = await callGroq({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `NPC: ${npc.name} — ${npc.description}. This NPC has ${situation}. Give one line of in-character dialogue.`,
        },
      ],
      systemPrompt:
        "You write single-line, in-character dialogue for NPCs in a gritty cyberpunk crime RPG called Neonoir set in New Vanta, 2047. Respond with ONLY one short quoted line of dialogue (under 20 words), no narration.",
      maxTokens: 60,
      temperature: 0.9,
    });
    return result.content?.trim() || fallbackDialogue(npc.name);
  } catch (err) {
    logger.warn({ err }, "Groq NPC dialogue error");
    return fallbackDialogue(npc.name);
  }
}

import { logger } from "./logger";

let warnedMissingKey = false;

const FALLBACK_TAUNTS: Record<string, string[]> = {
  default: [
    "\"You picked the wrong street to walk down.\"",
    "\"New Vanta chews up people like you.\"",
    "\"Turn around while you still can.\"",
  ],
};

function fallbackDialogue(npcName: string): string {
  const pool = FALLBACK_TAUNTS[npcName] ?? FALLBACK_TAUNTS["default"];
  return pool[Math.floor(Math.random() * pool.length)] as string;
}

/**
 * Generates a short in-character taunt/line for an NPC encounter using Groq's
 * LLM API. Gracefully falls back to static flavor text when GROQ_API_KEY is
 * not configured (Phase 2 feature — game must run without it).
 */
export async function generateNpcDialogue(npc: { name: string; description: string }, outcome: "pre-fight" | "player-won" | "player-lost"): Promise<string> {
  const apiKey = process.env["GROQ_API_KEY"];

  if (!apiKey) {
    if (!warnedMissingKey) {
      logger.info("GROQ_API_KEY not set — NPC dialogue uses static fallback lines (Phase 2 feature)");
      warnedMissingKey = true;
    }
    return fallbackDialogue(npc.name);
  }

  try {
    const situation = outcome === "pre-fight"
      ? "about to fight the player"
      : outcome === "player-won"
        ? "just been defeated by the player"
        : "just defeated the player";

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You write single-line, in-character dialogue for NPCs in a gritty cyberpunk crime RPG called Neonoir set in New Vanta, 2047. Respond with ONLY one short quoted line of dialogue (under 20 words), no narration, no quotes formatting beyond the line itself.",
          },
          {
            role: "user",
            content: `NPC: ${npc.name} — ${npc.description}. This NPC has ${situation}. Give one line of dialogue they'd say.`,
          },
        ],
        max_tokens: 60,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body }, "Groq dialogue generation failed");
      return fallbackDialogue(npc.name);
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const line = data.choices?.[0]?.message?.content?.trim();
    return line || fallbackDialogue(npc.name);
  } catch (err) {
    logger.warn({ err }, "Groq dialogue generation error");
    return fallbackDialogue(npc.name);
  }
}

// Game emoji catalog — mirrors backend EMOJI_CATALOG (16 slugs)
export const GAME_EMOJIS: Record<string, { displayName: string; emoji: string; theme: string }> = {
  driftcar:      { displayName: "Drift Car",      emoji: "🚗", theme: "action" },
  swordclash:    { displayName: "Sword Clash",    emoji: "⚔️", theme: "action" },
  stimshot:      { displayName: "Stim Shot",      emoji: "💉", theme: "action" },
  nitroflame:    { displayName: "Nitro Flame",    emoji: "🔥", theme: "action" },
  smokepistol:   { displayName: "Smoke Pistol",   emoji: "🔫", theme: "action" },
  barriershield: { displayName: "Barrier Shield", emoji: "🛡️", theme: "action" },
  goldtrophy:    { displayName: "Gold Trophy",    emoji: "🏆", theme: "economy" },
  cashspill:     { displayName: "Cash Spill",     emoji: "💰", theme: "economy" },
  jackpot:       { displayName: "Jackpot",        emoji: "🎰", theme: "economy" },
  neonskull:     { displayName: "Neon Skull",     emoji: "💀", theme: "urban" },
  voltbolt:      { displayName: "Volt Bolt",      emoji: "⚡", theme: "urban" },
  neoncity:      { displayName: "Neon City",      emoji: "🏙️", theme: "urban" },
  chainlock:     { displayName: "Chain Lock",     emoji: "🔗", theme: "urban" },
  medcross:      { displayName: "Med Cross",      emoji: "➕", theme: "tech" },
  cybereye:      { displayName: "Cyber Eye",      emoji: "👁️", theme: "tech" },
  botscan:       { displayName: "Bot Scan",       emoji: "🤖", theme: "tech" },
};

// ── 6.3b — Valid in-game route locations for /location link parsing ────────────
// Only these known routes render as clickable orange links; all others are plain text.
// Slugs players type in chat (e.g. /event, /race) mapped to the actual
// App.tsx page key when they differ. Anything not in this map navigates as-is.
const LOCATION_ALIASES: Record<string, string> = {
  event: "events",   // App uses "events", not "event"
  race:  "race-hub", // App uses "race-hub", not "race"
};

const VALID_LOCATIONS = new Set([
  "arena", "market", "auction", "crimes", "race", "gym", "bank",
  "profile", "event", "leaderboard", "chat", "jobs", "store",
]);

/** Resolve a user-typed slug to the actual App.tsx page key */
function resolveLocationPage(slug: string): string {
  return LOCATION_ALIASES[slug] ?? slug;
}

interface Props {
  text: string;
  /**
   * 6.3a — usernames stored in message.mentions[] by the backend.
   * When provided, only @tokens whose username appears in this array
   * are rendered as cyan clickable links. All other @tokens render as
   * plain text (prevents false highlighting of arbitrary @words).
   * When omitted (e.g. DMs), all @tokens are rendered as plain links
   * for backward-compatibility.
   */
  mentions?: string[];
  onUserClick?: (username: string) => void;
  onLocationClick?: (location: string) => void;
}

export function MentionText({ text, mentions, onUserClick, onLocationClick }: Props) {
  // Build a lower-case Set for fast lookup when mentions[] is provided
  const mentionSet = mentions
    ? new Set(mentions.map(m => m.toLowerCase()))
    : null; // null → no filtering (backward-compat)

  const parts = tokenize(text);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "mention") {
          // 6.3a — only highlight if username is in the mentions array
          const isVerified = mentionSet === null || mentionSet.has(part.value.toLowerCase());
          if (!isVerified) {
            return <span key={i}>@{part.value}</span>;
          }
          return (
            <button
              key={i}
              onClick={() => onUserClick?.(part.value)}
              style={{
                color: "#00d4ff",
                background: "rgba(0,212,255,0.08)",
                border: "none",
                padding: "0 2px",
                borderRadius: 3,
                fontFamily: "monospace",
                fontSize: "inherit",
                cursor: onUserClick ? "pointer" : "default",
                fontWeight: 700,
              }}
            >
              @{part.value}
            </button>
          );
        }

        if (part.type === "location") {
          return (
            // 6.3b — orange (#f97316) to match text-orange-400
            <button
              key={i}
              onClick={() => onLocationClick?.(resolveLocationPage(part.value))}
              style={{
                color: "#f97316",
                background: "rgba(249,115,22,0.08)",
                border: "none",
                padding: "0 2px",
                borderRadius: 3,
                fontFamily: "monospace",
                fontSize: "inherit",
                cursor: onLocationClick ? "pointer" : "default",
                fontWeight: 700,
              }}
            >
              /{part.value}
            </button>
          );
        }

        if (part.type === "emoji") {
          const def = GAME_EMOJIS[part.value];
          if (def) {
            return (
              <span
                key={i}
                title={def.displayName}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 3,
                  padding: "0 3px",
                  fontSize: "1.1em",
                  lineHeight: 1,
                  verticalAlign: "middle",
                  cursor: "default",
                }}
              >
                {def.emoji}
              </span>
            );
          }
          // Unknown slug — render raw
          return <span key={i}>:{part.value}:</span>;
        }

        return <span key={i}>{part.value}</span>;
      })}
    </>
  );
}

interface Token {
  type: "text" | "mention" | "location" | "emoji";
  value: string;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Match @mention, /location, or :emoji_slug:
  const re = /(@[\w]+|\/[\w-]+|:([\w]+):)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith("@")) {
      tokens.push({ type: "mention", value: raw.slice(1) });
    } else if (raw.startsWith(":") && raw.endsWith(":")) {
      const slug = m[2];
      tokens.push({ type: "emoji", value: slug });
    } else {
      // /location — only emit as "location" token for known routes
      const loc = raw.slice(1);
      if (VALID_LOCATIONS.has(loc)) {
        tokens.push({ type: "location", value: loc });
      } else {
        tokens.push({ type: "text", value: raw });
      }
    }
    last = m.index + raw.length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

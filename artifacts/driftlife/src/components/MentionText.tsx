interface Props {
  text: string;
  onUserClick?: (username: string) => void;
  onLocationClick?: (location: string) => void;
}

export function MentionText({ text, onUserClick, onLocationClick }: Props) {
  const parts = tokenize(text);
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "mention") {
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
            <button
              key={i}
              onClick={() => onLocationClick?.(part.value)}
              style={{
                color: "#a855f7",
                background: "rgba(168,85,247,0.08)",
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
        return <span key={i}>{part.value}</span>;
      })}
    </>
  );
}

interface Token {
  type: "text" | "mention" | "location";
  value: string;
}

const VALID_LOCATIONS = new Set([
  "feed","chat","crimes","combat","jobs","market","bank","hospital",
  "garage","gym","faction","district","auction","leaderboard",
  "inventory","skills","profile","hack","properties","crafting",
  "races","chatframes",
]);

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /(@[\w]+|\/[\w]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith("@")) {
      tokens.push({ type: "mention", value: raw.slice(1) });
    } else {
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

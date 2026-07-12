import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../lib/api";

const GAME_LOCATIONS: { id: string; label: string }[] = [
  { id: "feed",        label: "City Feed"       },
  { id: "chat",        label: "Chat"            },
  { id: "crimes",      label: "Crimes"          },
  { id: "combat",      label: "Combat"          },
  { id: "jobs",        label: "Jobs"            },
  { id: "market",      label: "Black Market"    },
  { id: "bank",        label: "Bank"            },
  { id: "hospital",    label: "Hospital"        },
  { id: "garage",      label: "Garage"          },
  { id: "gym",         label: "Gym"             },
  { id: "faction",     label: "Faction HQ"      },
  { id: "district",    label: "Districts"       },
  { id: "auction",     label: "Auction House"   },
  { id: "leaderboard", label: "Leaderboard"     },
  { id: "inventory",   label: "Inventory"       },
  { id: "skills",      label: "Skills"          },
  { id: "profile",     label: "Profile"         },
  { id: "hack",        label: "Net (Hacking)"   },
  { id: "properties",  label: "Properties"      },
  { id: "crafting",    label: "Crafting"        },
  { id: "races",       label: "Street Races"    },
];

interface Suggestion {
  type: "user" | "location";
  id: string;
  display: string;
  sub?: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onInspectPlayer?: (id: string) => void;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  maxLength = 280,
  multiline = false,
  className = "",
  style = {},
}: Props) {
  const [suggestions, setSuggestions]   = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeSug,    setActiveSug]    = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionType,  setMentionType]  = useState<"@" | "/" | null>(null);
  const inputRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 1) { setSuggestions([]); setShowDropdown(false); return; }
    try {
      const users = await api.get<{ id: string; username: string; level: number; rank?: string }[]>(
        `/user/search?q=${encodeURIComponent(q)}`
      );
      const sugs: Suggestion[] = users.slice(0, 6).map(u => ({
        type: "user",
        id:   u.id,
        display: u.username,
        sub: `Lv.${u.level}`,
      }));
      setSuggestions(sugs);
      setShowDropdown(sugs.length > 0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, []);

  const searchLocations = useCallback((q: string) => {
    const filtered = GAME_LOCATIONS.filter(l =>
      l.id.startsWith(q.toLowerCase()) || l.label.toLowerCase().startsWith(q.toLowerCase())
    ).slice(0, 6);
    const sugs: Suggestion[] = filtered.map(l => ({
      type: "location",
      id:   l.id,
      display: `/${l.id}`,
      sub: l.label,
    }));
    setSuggestions(sugs);
    setShowDropdown(sugs.length > 0);
    setActiveSug(0);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const text   = e.target.value.slice(0, maxLength);
    const cursor = e.target.selectionStart ?? text.length;
    onChange(text);

    const before = text.slice(0, cursor);
    const atMatch = before.match(/@([\w]*)$/);
    const slashMatch = before.match(/\/([\w]*)$/);

    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length);
      setMentionType("@");
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => searchUsers(atMatch[1]), 250);
    } else if (slashMatch) {
      setMentionStart(cursor - slashMatch[0].length);
      setMentionType("/");
      searchLocations(slashMatch[1]);
    } else {
      setShowDropdown(false);
      setMentionType(null);
      setMentionStart(-1);
    }
  }

  function pickSuggestion(sug: Suggestion) {
    if (mentionStart < 0 || !mentionType) return;
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const insert = mentionType === "@" ? `@${sug.display} ` : `${sug.display} `;
    const newVal = value.slice(0, mentionStart) + insert + value.slice(cursor);
    onChange(newVal.slice(0, maxLength));
    setShowDropdown(false);
    setMentionType(null);
    setMentionStart(-1);
    setTimeout(() => {
      if (el) {
        const pos = mentionStart + insert.length;
        el.setSelectionRange(pos, pos);
        el.focus();
      }
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveSug(i => (i + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveSug(i => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Tab" || (e.key === "Enter" && showDropdown)) {
        e.preventDefault();
        pickSuggestion(suggestions[activeSug]);
        return;
      }
      if (e.key === "Escape") { setShowDropdown(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !multiline && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Enter" && !e.shiftKey && multiline && e.ctrlKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  useEffect(() => {
    function onClickOut(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

  const baseStyle: React.CSSProperties = {
    background: "#0a0a0f",
    border: "1px solid #1e1e2e",
    color: "#e2e8f0",
    outline: "none",
    ...style,
  };

  const baseClass = `font-mono text-xs px-3 py-2 rounded w-full ${className}`;

  return (
    <div style={{ position: "relative" }}>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={2}
          className={baseClass}
          style={{ ...baseStyle, resize: "none" }}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          className={baseClass}
          style={baseStyle}
        />
      )}

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropRef}
          style={{
            position: "absolute",
            bottom: "110%",
            left: 0,
            right: 0,
            background: "#111118",
            border: "1px solid #1e1e2e",
            borderRadius: 6,
            zIndex: 100,
            boxShadow: "0 -4px 20px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "4px 8px 2px", borderBottom: "1px solid #1e1e2e" }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "#334155" }}>
              {mentionType === "@" ? "PLAYERS" : "LOCATIONS"} — ↑↓ navigate · Tab select · Esc close
            </span>
          </div>
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              onMouseDown={e => { e.preventDefault(); pickSuggestion(s); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 10px",
                background: i === activeSug ? "#1e1e2e" : "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={() => setActiveSug(i)}
            >
              <span style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: s.type === "user" ? "#00d4ff" : "#a855f7",
                fontWeight: 700,
                minWidth: 80,
              }}>
                {s.display}
              </span>
              {s.sub && (
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "#475569" }}>
                  {s.sub}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

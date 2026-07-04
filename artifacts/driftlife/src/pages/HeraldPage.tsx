import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface Article {
  id: string;
  title: string;
  content: string;
  author: string;
  pinned: boolean;
  publishedAt: string;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function HeraldPage({ user, addToast }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const isStaff = user.role === "owner" || user.role === "admin" || user.role === "staff";

  const load = () => {
    api.get<Article[]>("/herald").then(data => {
      setArticles(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handlePublish = async () => {
    if (!title.trim() || !content.trim()) return;
    setPosting(true);
    try {
      await api.post("/herald", { title: title.trim(), content: content.trim() });
      addToast("Article published", "success");
      setTitle("");
      setContent("");
      load();
    } catch (e: any) {
      addToast(e.message || "Publish failed", "error");
    } finally {
      setPosting(false);
    }
  };

  const handlePin = async (id: string) => {
    try {
      await api.patch(`/herald/${id}/pin`, {});
      load();
    } catch (e: any) {
      addToast(e.message || "Action failed", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/herald/${id}`);
      addToast("Article deleted", "success");
      load();
    } catch (e: any) {
      addToast(e.message || "Delete failed", "error");
    }
  };

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div className="font-mono font-bold" style={{ color: "#00d4ff", fontSize: 18, letterSpacing: "0.12em", marginBottom: 4 }}>
        NEW VANTA HERALD
      </div>
      <div className="font-mono" style={{ color: "#475569", fontSize: 11, marginBottom: 20 }}>
        Official dispatches from the city.
      </div>

      {isStaff && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div className="font-mono font-bold" style={{ color: "#f59e0b", fontSize: 12, marginBottom: 10, letterSpacing: "0.08em" }}>
            PUBLISH ARTICLE
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            maxLength={120}
            className="font-mono"
            style={{
              width: "100%", background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 4,
              padding: "8px 10px", color: "#e2e8f0", fontSize: 12, marginBottom: 8,
            }}
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Content"
            maxLength={5000}
            rows={4}
            className="font-mono"
            style={{
              width: "100%", background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 4,
              padding: "8px 10px", color: "#e2e8f0", fontSize: 12, marginBottom: 10, resize: "vertical",
            }}
          />
          <button
            onClick={handlePublish}
            disabled={posting || !title.trim() || !content.trim()}
            className="font-mono"
            style={{
              padding: "6px 16px", borderRadius: 4, cursor: "pointer",
              background: "#00d4ff18", border: "1px solid #00d4ff40",
              color: "#00d4ff", fontSize: 11, fontWeight: "bold",
              opacity: posting || !title.trim() || !content.trim() ? 0.5 : 1,
              letterSpacing: "0.06em",
            }}
          >
            {posting ? "PUBLISHING..." : "PUBLISH"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="font-mono" style={{ color: "#334155", textAlign: "center", padding: 40 }}>
          Loading dispatches...
        </div>
      ) : articles.length === 0 ? (
        <div className="font-mono" style={{ color: "#334155", textAlign: "center", padding: 40, fontSize: 12 }}>
          No articles yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {articles.map(a => (
            <div
              key={a.id}
              style={{
                background: "#111118",
                border: `1px solid ${a.pinned ? "#f59e0b40" : "#1e1e2e"}`,
                borderRadius: 8,
                padding: 14,
                boxShadow: a.pinned ? "0 0 14px #f59e0b18" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 14 }}>
                  {a.pinned && <span style={{ color: "#f59e0b" }}>[PINNED] </span>}
                  {a.title}
                </div>
                {isStaff && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handlePin(a.id)}
                      className="font-mono"
                      style={{ fontSize: 10, color: "#f59e0b", border: "1px solid #f59e0b40", borderRadius: 4, padding: "2px 8px", cursor: "pointer", background: "transparent" }}
                    >
                      {a.pinned ? "UNPIN" : "PIN"}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="font-mono"
                      style={{ fontSize: 10, color: "#ff2d55", border: "1px solid #ff2d5540", borderRadius: 4, padding: "2px 8px", cursor: "pointer", background: "transparent" }}
                    >
                      DELETE
                    </button>
                  </div>
                )}
              </div>
              <div className="font-mono" style={{ color: "#94a3b8", fontSize: 12, whiteSpace: "pre-wrap", marginBottom: 8 }}>
                {a.content}
              </div>
              <div className="font-mono" style={{ color: "#334155", fontSize: 10 }}>
                By {a.author} — {new Date(a.publishedAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

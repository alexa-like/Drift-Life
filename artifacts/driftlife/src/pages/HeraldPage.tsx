import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function HeraldPage({ user, addToast }: Props) {
  const qc = useQueryClient();
  const isStaff = user.role === "owner" || user.role === "admin" || user.role === "staff";
  const [showPublish, setShowPublish] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", pinned: false });
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ["herald"],
    queryFn: () => api.get("/herald"),
  });

  const publish = useMutation({
    mutationFn: () => api.post("/herald", form),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      setForm({ title: "", content: "", pinned: false });
      setShowPublish(false);
      qc.invalidateQueries({ queryKey: ["herald"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const deleteArticle = useMutation({
    mutationFn: (id: string) => api.delete(`/herald/${id}`),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["herald"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const pinArticle = useMutation({
    mutationFn: (id: string) => api.patch(`/herald/${id}/pin`, {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["herald"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono font-bold text-lg" style={{ color: "#00d4ff" }}>THE HERALD</h2>
            <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>New Vanta's city-wide broadcast. Official news and announcements.</p>
          </div>
          {isStaff && (
            <button
              onClick={() => setShowPublish(!showPublish)}
              className="font-mono text-xs px-3 py-1 rounded"
              style={{ background: "#00d4ff22", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}
            >
              + Publish
            </button>
          )}
        </div>
      </div>

      {showPublish && isStaff && (
        <div className="rounded-lg p-4 space-y-3" style={{ background: "#111118", border: "1px solid #00d4ff40" }}>
          <div className="font-mono text-sm font-bold" style={{ color: "#00d4ff" }}>Publish Article</div>
          <div>
            <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Title</div>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Breaking: Downtown Core goes dark..."
              className="w-full font-mono text-xs px-3 py-2 rounded"
              style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e", outline: "none" }}
            />
          </div>
          <div>
            <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Content</div>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Full article body..."
              rows={6}
              className="w-full font-mono text-xs px-3 py-2 rounded resize-none"
              style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e", outline: "none" }}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} />
            <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>Pin to top</span>
          </label>
          <button
            onClick={() => publish.mutate()}
            disabled={publish.isPending || !form.title || !form.content}
            className="font-mono text-sm px-6 py-2 rounded font-bold"
            style={{ background: "#00d4ff22", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}
          >
            {publish.isPending ? "Publishing..." : "Publish"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading herald...</div>
      ) : articles.length === 0 ? (
        <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>No articles published yet. The city is silent.</div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <div
              key={a.id}
              className="rounded-lg p-4"
              style={{ background: "#111118", border: `1px solid ${a.pinned ? "#f59e0b40" : "#1e1e2e"}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && <span className="font-mono text-xs px-1 rounded" style={{ background: "#f59e0b22", color: "#f59e0b" }}>PINNED</span>}
                    <span className="font-mono font-bold" style={{ color: "#e2e8f0" }}>{a.title}</span>
                  </div>
                  <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                    By {a.author} · {fmtDate(a.publishedAt)}
                  </div>
                  {expanded === a.id ? (
                    <div className="mt-3 font-mono text-sm whitespace-pre-wrap" style={{ color: "#94a3b8" }}>{a.content}</div>
                  ) : (
                    <div className="mt-2 font-mono text-xs" style={{ color: "#64748b" }}>
                      {a.content.slice(0, 120)}{a.content.length > 120 ? "..." : ""}
                    </div>
                  )}
                  <button
                    onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                    className="font-mono text-xs mt-2"
                    style={{ color: "#00d4ff", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                  >
                    {expanded === a.id ? "Show less" : "Read more"}
                  </button>
                </div>
                {isStaff && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => pinArticle.mutate(a.id)}
                      className="font-mono text-xs px-2 py-0.5 rounded"
                      style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b40", cursor: "pointer" }}
                    >
                      {a.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button onClick={() => { if (confirm("Delete this article?")) deleteArticle.mutate(a.id); }}
                      className="font-mono text-xs px-2 py-0.5 rounded"
                      style={{ background: "#ff2d5522", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer" }}
                    >
                      Del
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

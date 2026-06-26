import { Toast } from "../hooks/useToast";

const COLORS: Record<string, string> = {
  success: "#39d353",
  error: "#ff2d55",
  info: "#00d4ff",
  warning: "#f59e0b",
};

interface Props {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: Props) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 p-3 rounded-lg font-mono text-sm cursor-pointer"
          style={{
            background: "#111118",
            border: `1px solid ${COLORS[t.type]}40`,
            color: "#e2e8f0",
            boxShadow: `0 0 12px ${COLORS[t.type]}20`,
          }}
          onClick={() => removeToast(t.id)}
        >
          <span style={{ color: COLORS[t.type], flexShrink: 0 }}>
            {t.type === "success" ? "+" : t.type === "error" ? "!" : t.type === "warning" ? "~" : "i"}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

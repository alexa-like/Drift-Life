import { useState, useEffect, useRef } from "react";
import { User, Frame } from "../lib/types";
import { api } from "../lib/api";
import { getFrame, FrameRarity } from "../lib/frames";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8",
  uncommon: "#39d353",
  rare: "#00d4ff",
  epic: "#a855f7",
  legendary: "#f59e0b",
  mythic: "#ff2d55",
};

// ── Live animated frame preview (mini canvas) ──────────────────────────────────
function drawPreview(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  t: number,
  rarity: FrameRarity,
  color: string,
) {
  const cRect = canvas.getBoundingClientRect();
  const w = Math.round(cRect.width);
  const h = Math.round(cRect.height);
  if (w === 0 || h === 0) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  const r = 8;
  const inset = 2;

  const path = () => {
    ctx.beginPath();
    ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(0, r - inset));
  };

  if (rarity === "common") {
    ctx.strokeStyle = color + "a0";
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    path(); ctx.stroke();
    ctx.shadowBlur = 0;
    const acs = 10;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    for (const [cx, cy, sx, sy] of [[inset,inset,1,1],[w-inset,inset,-1,1],[inset,h-inset,1,-1],[w-inset,h-inset,-1,-1]] as const) {
      ctx.beginPath(); ctx.moveTo(cx+sx*acs,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy+sy*acs); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    return;
  }

  if (rarity === "uncommon") {
    ctx.strokeStyle = color + "20"; ctx.lineWidth = 2; path(); ctx.stroke();
    const perim = 2 * (w + h);
    const pts = previewPerimPts(w, h, r, 120);
    const total = pts.length;
    const headIdx = Math.floor(((t * 2.5) % perim) / perim * total) % total;
    for (let i = 0; i < 30; i++) {
      const idx = (headIdx - i + total) % total;
      const pt = pts[idx];
      const alpha = (1 - i / 30) ** 1.4;
      ctx.beginPath(); ctx.arc(pt[0], pt[1], 1.5 + (1-i/30), 0, Math.PI*2);
      ctx.fillStyle = color + Math.floor(alpha*255).toString(16).padStart(2,"0");
      ctx.shadowColor = color; ctx.shadowBlur = alpha * 10; ctx.fill();
    }
    const head = pts[headIdx];
    ctx.beginPath(); ctx.arc(head[0], head[1], 3, 0, Math.PI*2);
    ctx.fillStyle = "#fff"; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fill();
    ctx.shadowBlur = 0;
    return;
  }

  if (rarity === "rare") {
    const pulse = 0.5 + 0.5 * Math.sin((t/40)*Math.PI*2);
    ctx.strokeStyle = color + "30"; ctx.lineWidth = 7 + pulse*4;
    ctx.shadowColor = color; ctx.shadowBlur = 20*pulse; path(); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6+0.4*pulse; ctx.shadowBlur = 10*pulse; path(); ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // Ripple
    const rph = (t%80)/80;
    if (rph < 0.6) {
      const exp = rph * 14;
      ctx.strokeStyle = color + Math.floor((1-rph/0.6)*70).toString(16).padStart(2,"0");
      ctx.lineWidth = 1; ctx.globalAlpha = 1-rph/0.6;
      ctx.beginPath(); ctx.roundRect(inset-exp, inset-exp, w-inset*2+exp*2, h-inset*2+exp*2, r+exp); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    return;
  }

  if (rarity === "epic") {
    const angle = (t/80)*Math.PI*2;
    const grad = ctx.createConicGradient(angle, w/2, h/2);
    grad.addColorStop(0, color); grad.addColorStop(0.15,"#ffffff");
    grad.addColorStop(0.3,color+"20"); grad.addColorStop(0.5,color);
    grad.addColorStop(0.7,"#ffffff80"); grad.addColorStop(0.85,color+"20"); grad.addColorStop(1,color);
    ctx.strokeStyle = grad; ctx.lineWidth = 3;
    ctx.shadowColor = color; ctx.shadowBlur = 14; path(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = color+"28"; ctx.lineWidth = 9; path(); ctx.stroke();
    const corners: [number,number][] = [[inset,inset],[w-inset,inset],[w-inset,h-inset],[inset,h-inset]];
    corners.forEach(([x,y],i) => {
      const ph = angle + (i*Math.PI)/2;
      ctx.beginPath(); ctx.arc(x+Math.cos(ph)*7, y+Math.sin(ph)*7, 2.5, 0, Math.PI*2);
      ctx.fillStyle="#fff"; ctx.shadowColor=color; ctx.shadowBlur=12; ctx.fill();
    });
    ctx.shadowBlur = 0;
    return;
  }

  if (rarity === "legendary") {
    ctx.strokeStyle = color+"15"; ctx.lineWidth = 14; ctx.shadowColor=color; ctx.shadowBlur=32; path(); ctx.stroke();
    ctx.strokeStyle = color+"40"; ctx.lineWidth = 5; ctx.shadowBlur=18; path(); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.shadowBlur=16; path(); ctx.stroke(); ctx.shadowBlur=0;
    ctx.strokeStyle = "#ffffff45"; ctx.lineWidth = 0.5;
    const i2=5; ctx.beginPath(); ctx.roundRect(i2,i2,w-i2*2,h-i2*2,Math.max(0,r-i2)); ctx.stroke();
    const orn=14;
    ctx.strokeStyle="#ffffff90"; ctx.lineWidth=2; ctx.shadowColor=color; ctx.shadowBlur=8;
    for (const [x,y,sx,sy] of [[inset,inset,1,1],[w-inset,inset,-1,1],[inset,h-inset,1,-1],[w-inset,h-inset,-1,-1]] as const) {
      ctx.beginPath(); ctx.moveTo(x+sx*orn,y); ctx.lineTo(x,y); ctx.lineTo(x,y+sy*orn); ctx.stroke();
    }
    ctx.shadowBlur=0;
    if (t%5===0) {
      for (let i=0;i<3;i++) {
        const side=Math.floor(Math.random()*4);
        let x1:number, y1:number;
        if(side===0){x1=Math.random()*w;y1=inset;}
        else if(side===1){x1=w-inset;y1=Math.random()*h;}
        else if(side===2){x1=Math.random()*w;y1=h-inset;}
        else{x1=inset;y1=Math.random()*h;}
        ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.globalAlpha=0.5+Math.random()*0.5;
        ctx.shadowColor=color; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.moveTo(x1,y1);
        let lx=x1,ly=y1;
        for(let s=0;s<3;s++){lx+=(Math.random()-0.5)*12;ly+=(Math.random()-0.5)*12;ctx.lineTo(lx,ly);}
        ctx.stroke(); ctx.globalAlpha=1;
      }
      ctx.shadowBlur=0;
    }
    return;
  }

  if (rarity === "mythic") {
    const hShift = (t/3)%360;
    const cyc = hslHex(hShift,100,60);
    ctx.strokeStyle=cyc+"18"; ctx.lineWidth=16; ctx.shadowColor=cyc; ctx.shadowBlur=38; path(); ctx.stroke();
    ctx.strokeStyle=color+"50"; ctx.lineWidth=6; ctx.shadowBlur=22; path(); ctx.stroke();
    const flick=0.7+0.3*Math.abs(Math.sin((t/8)*Math.PI));
    ctx.strokeStyle=cyc; ctx.lineWidth=2.5; ctx.globalAlpha=flick; ctx.shadowColor=cyc; ctx.shadowBlur=18;
    path(); ctx.stroke(); ctx.globalAlpha=1; ctx.shadowBlur=0;
    ctx.strokeStyle="#ffffff28"; ctx.lineWidth=0.5;
    const mi=6; ctx.beginPath(); ctx.roundRect(mi,mi,w-mi*2,h-mi*2,Math.max(0,r-mi)); ctx.stroke();
    const chars="01アイウ#!@$%█▒░";
    ctx.font="bold 7px monospace"; ctx.fillStyle=cyc; ctx.shadowColor=cyc; ctx.shadowBlur=8;
    const topPos=Array.from({length:Math.floor(w/9)},(_,i)=>i*9+5);
    topPos.forEach(p=>{
      const ci=Math.floor((t+p)/6)%chars.length;
      const alpha=0.3+0.7*Math.abs(Math.sin((t+p)/14));
      ctx.globalAlpha=alpha; ctx.fillText(chars[ci],p,inset+7);
    });
    const btmPos=topPos;
    btmPos.forEach(p=>{
      const ci=Math.floor((t+p+30)/6)%chars.length;
      const alpha=0.3+0.7*Math.abs(Math.sin((t+p+30)/14));
      ctx.globalAlpha=alpha; ctx.fillText(chars[ci],p,h-inset-2);
    });
    ctx.globalAlpha=1; ctx.shadowBlur=0;
    const surge=t%120;
    if(surge<8){
      ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.globalAlpha=(1-surge/8)*0.8;
      ctx.shadowColor=cyc; ctx.shadowBlur=32; path(); ctx.stroke(); ctx.globalAlpha=1; ctx.shadowBlur=0;
    }
  }
}

function previewPerimPts(w: number, h: number, r: number, n: number): [number, number][] {
  const pts: [number, number][] = [];
  const perim = 2*(w+h);
  for (let i=0;i<n;i++) pts.push(previewPerimPt((i/n)*perim, w, h, r, perim));
  return pts;
}

function previewPerimPt(d: number, w: number, h: number, r: number, perim: number): [number, number] {
  const inset=2, x0=inset, y0=inset, x1=w-inset, y1=h-inset;
  const rr=Math.min(r,w/2,h/2);
  const arcLen=(Math.PI/2)*rr;
  const sw=x1-x0-2*rr, sh=y1-y0-2*rr;
  const segs=[sw,arcLen,sh,arcLen,sw,arcLen,sh,arcLen];
  let rem=d%perim;
  for(let i=0;i<segs.length;i++){
    if(rem<=segs[i]){
      const t=rem/segs[i];
      if(i===0)return[x0+rr+t*sw,y0];
      if(i===1){const a=-Math.PI/2+t*Math.PI/2;return[x1-rr+rr*Math.cos(a),y0+rr+rr*Math.sin(a)];}
      if(i===2)return[x1,y0+rr+t*sh];
      if(i===3){const a=t*Math.PI/2;return[x1-rr+rr*Math.cos(a),y1-rr+rr*Math.sin(a)];}
      if(i===4)return[x1-rr-t*sw,y1];
      if(i===5){const a=Math.PI/2+t*Math.PI/2;return[x0+rr+rr*Math.cos(a),y1-rr+rr*Math.sin(a)];}
      if(i===6)return[x0,y1-rr-t*sh];
      if(i===7){const a=Math.PI+t*Math.PI/2;return[x0+rr+rr*Math.cos(a),y0+rr+rr*Math.sin(a)];}
    }
    rem-=segs[i];
  }
  return[x0+rr,y0];
}

function hslHex(h: number, s: number, l: number): string {
  s/=100;l/=100;
  const k=(n:number)=>(n+h/30)%12;
  const a=s*Math.min(l,1-l);
  const f=(n:number)=>{const v=l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return Math.round(255*v).toString(16).padStart(2,"0");};
  return`#${f(0)}${f(8)}${f(4)}`;
}

function FrameLivePreview({ frameId, colorOverride, width = 88, height = 60 }: {
  frameId: string;
  colorOverride?: string | null;
  width?: number;
  height?: number;
}) {
  const frame = getFrame(frameId);
  const color = colorOverride || frame.glowColor;
  const rarity = frame.rarity as FrameRarity;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isStatic = rarity === "common";

    function draw() {
      if (!canvas || !ctx) return;
      drawPreview(canvas, ctx, tRef.current, rarity, color);
      tRef.current++;
      if (!isStatic) animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    let ro: ResizeObserver | null = null;
    if (isStatic) {
      ro = new ResizeObserver(() => { if (canvas && ctx) drawPreview(canvas, ctx, 0, rarity, color); });
      ro.observe(canvas);
    }

    return () => { cancelAnimationFrame(animRef.current); ro?.disconnect(); };
  }, [frameId, rarity, color]);

  const rarityColor = RARITY_COLORS[rarity] || "#94a3b8";

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        flexShrink: 0,
        borderRadius: 8,
        background: "#0a0a0f",
        boxShadow: rarity !== "common" ? `0 0 12px ${color}20` : undefined,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 8 }}
      />
      {/* Center rarity icon */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 2, pointerEvents: "none",
      }}>
        <div style={{ fontSize: 18, lineHeight: 1 }}>
          {rarity === "mythic" ? "☠" : rarity === "legendary" ? "⚡" : rarity === "epic" ? "✦" : rarity === "rare" ? "◆" : rarity === "uncommon" ? "◈" : "□"}
        </div>
        <div className="font-mono" style={{ fontSize: 8, color: rarityColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {rarity}
        </div>
      </div>
    </div>
  );
}

export function FramesStorePage({ user, refreshUser, addToast }: Props) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [previewFrame, setPreviewFrame] = useState<Frame | null>(null);

  useEffect(() => {
    api.get<Frame[]>("/frames").then(f => { setFrames(f); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function purchase(frameId: string, cost: number, currency: string) {
    const bal = currency === "nc" ? user.nc : user.dc;
    if (bal < cost) { addToast(`Not enough ${currency.toUpperCase()}`, "error"); return; }
    if (!confirm(`Purchase frame for ${cost.toLocaleString()} ${currency.toUpperCase()}?`)) return;
    setActing(frameId);
    try {
      const data = await api.post<any>(`/frames/purchase/${frameId}`);
      addToast(data.message, "success");
      setFrames(prev => prev.map(f => f.frameId === frameId ? { ...f, owned: true } : f));
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  async function equip(frameId: string) {
    setActing(frameId);
    try {
      const data = await api.post<any>(`/frames/equip/${frameId}`);
      addToast(data.message, "success");
      setFrames(prev => prev.map(f => ({ ...f, equipped: f.frameId === frameId })));
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing(null);
    }
  }

  const rarities = ["all", "common", "uncommon", "rare", "epic", "legendary", "mythic"];
  const filtered = filterRarity === "all" ? frames : frames.filter(f => f.rarity === filterRarity);
  const owned = frames.filter(f => f.owned).length;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-mono font-bold" style={{ color: "#a855f7" }}>Frame Store</h2>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#64748b" }}>
            Owned: {owned}/{frames.length} · Balance: {user.dc.toLocaleString()} DC / {user.nc.toLocaleString()} NC
          </p>
        </div>
      </div>

      {/* Live preview modal */}
      {previewFrame && (
        <div
          style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
          onClick={() => setPreviewFrame(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12, padding: 24, minWidth: 280, textAlign: "center" }}>
            <div className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>LIVE PREVIEW</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <FrameLivePreview frameId={previewFrame.frameId} colorOverride={previewFrame.glowColor} width={220} height={130} />
            </div>
            <div className="font-mono font-bold text-sm mb-1" style={{ color: "#e2e8f0" }}>{previewFrame.displayName}</div>
            <div className="font-mono text-xs mb-4 capitalize" style={{ color: RARITY_COLORS[previewFrame.rarity] }}>{previewFrame.rarity}</div>
            <button onClick={() => setPreviewFrame(null)} className="font-mono text-xs px-4 py-1.5 rounded" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>Close</button>
          </div>
        </div>
      )}

      {/* Rarity filter */}
      <div className="flex gap-1.5 flex-wrap">
        {rarities.map(r => {
          const color = RARITY_COLORS[r] ?? "#94a3b8";
          const active = filterRarity === r;
          return (
            <button
              key={r}
              onClick={() => setFilterRarity(r)}
              className="px-2.5 py-1 rounded font-mono capitalize"
              style={{
                fontSize: 11,
                background: active ? (r === "all" ? "#ffffff10" : color + "18") : "transparent",
                color: active ? (r === "all" ? "#e2e8f0" : color) : "#475569",
                border: `1px solid ${active ? (r === "all" ? "#ffffff30" : color + "50") : "#1e1e2e"}`,
              }}
            >
              {r}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#475569" }}>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(frame => {
            const color = RARITY_COLORS[frame.rarity] ?? "#94a3b8";
            return (
              <div
                key={frame.frameId}
                className="rounded-lg p-4 flex items-center gap-4"
                style={{
                  background: "#111118",
                  border: `1px solid ${frame.equipped ? color + "70" : frame.owned ? color + "30" : "#1e1e2e"}`,
                  boxShadow: frame.equipped ? `0 0 12px ${color}18` : undefined,
                }}
              >
                {/* Live animated frame preview */}
                <div style={{ position: "relative" }}>
                  <FrameLivePreview frameId={frame.frameId} colorOverride={frame.glowColor} />
                  <button
                    onClick={() => setPreviewFrame(frame)}
                    title="Preview fullscreen"
                    style={{
                      position: "absolute", bottom: 2, right: 2,
                      background: "#000000aa", border: "none", borderRadius: 3,
                      color: "#94a3b8", fontSize: 9, padding: "1px 4px",
                      cursor: "pointer", fontFamily: "monospace",
                    }}
                  >
                    ⛶
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{frame.displayName}</span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded capitalize" style={{ color, background: color + "15", border: `1px solid ${color}30` }}>
                      {frame.rarity}
                    </span>
                    {frame.equipped && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#39d35320", color: "#39d353", border: "1px solid #39d35340" }}>
                        equipped
                      </span>
                    )}
                    {frame.isFree && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#00d4ff10", color: "#00d4ff", border: "1px solid #00d4ff30" }}>
                        free
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono" style={{ color: "#64748b" }}>
                    {frame.description}
                  </div>
                  {frame.earnedBy && (
                    <div className="text-xs font-mono mt-0.5" style={{ color: "#475569" }}>
                      🔒 {frame.earnedBy}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                  {!frame.owned ? (
                    frame.earnedBy ? (
                      <span className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>Locked</span>
                    ) : (
                      <button
                        onClick={() => purchase(frame.frameId, frame.price, frame.currency)}
                        disabled={acting === frame.frameId}
                        className="px-3 py-1.5 rounded font-mono text-xs font-bold"
                        style={{ background: color + "18", color, border: `1px solid ${color}40` }}
                      >
                        {acting === frame.frameId ? "..." : frame.isFree ? "Claim" : `${frame.price.toLocaleString()} ${frame.currency.toUpperCase()}`}
                      </button>
                    )
                  ) : !frame.equipped ? (
                    <button
                      onClick={() => equip(frame.frameId)}
                      disabled={acting === frame.frameId}
                      className="px-3 py-1.5 rounded font-mono text-xs font-bold"
                      style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}
                    >
                      {acting === frame.frameId ? "..." : "Equip"}
                    </button>
                  ) : (
                    <span className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#39d353", border: "1px solid #39d35330" }}>
                      Active
                    </span>
                  )}
                  {!frame.isFree && !frame.earnedBy && (
                    <div className="font-mono text-xs" style={{ color: "#334155" }}>
                      {frame.currency === "nc" ? "NC" : "DC"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

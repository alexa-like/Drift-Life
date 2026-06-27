type Cb = (t: number) => void;

const cbs = new Map<number, Cb>();
let nextId = 0;
let rafId: number | null = null;
let globalT = 0;
let lastTs = 0;

function tick(ts: number) {
  rafId = requestAnimationFrame(tick);
  if (ts - lastTs < 33) return; // ~30 fps cap
  lastTs = ts;
  globalT++;
  cbs.forEach(cb => { try { cb(globalT); } catch (_) {} });
}

export function registerAnim(cb: Cb): number {
  const id = nextId++;
  cbs.set(id, cb);
  if (rafId === null) rafId = requestAnimationFrame(tick);
  return id;
}

export function unregisterAnim(id: number): void {
  cbs.delete(id);
  if (cbs.size === 0 && rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

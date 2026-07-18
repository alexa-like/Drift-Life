import { useEffect, useRef, useState } from "react";

type ConnectivityState = "online" | "offline" | "checking";

const CHECK_INTERVAL_MS = 15000;
const PING_TIMEOUT_MS = 5000;

/**
 * Tracks whether the browser has a real network connection.
 * Uses navigator.onLine plus a periodic lightweight ping to the root page,
 * so we can distinguish "wifi on but server unreachable" from true online.
 */
export function useConnectivity(): {
  state: ConnectivityState;
  isOnline: boolean;
  lastOnlineAt: Date | null;
  checkNow: () => void;
} {
  const [state, setState] = useState<ConnectivityState>(() =>
    navigator.onLine ? "online" : "offline"
  );
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(() =>
    navigator.onLine ? new Date() : null
  );
  const abortRef = useRef<AbortController | null>(null);

  const runCheck = async () => {
    if (!navigator.onLine) {
      setState("offline");
      return;
    }

    setState((prev) => (prev === "offline" ? "checking" : prev));

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    try {
      // Ping the root page with no cache; a 2xx/3xx/404 means the server is reachable.
      await fetch("/", { method: "HEAD", cache: "no-store", signal: controller.signal });
      setState("online");
      setLastOnlineAt(new Date());
    } catch {
      if (navigator.onLine) {
        setState("checking");
      } else {
        setState("offline");
      }
    } finally {
      clearTimeout(timer);
    }
  };

  useEffect(() => {
    const onOnline = () => {
      setState("checking");
      runCheck();
    };
    const onOffline = () => setState("offline");

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Initial check and recurring heartbeat
    runCheck();
    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, []);

  return {
    state,
    isOnline: state === "online",
    lastOnlineAt,
    checkNow: runCheck,
  };
}

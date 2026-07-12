/**
 * useUpdateCheck — polls the root HTML page for ETag/Last-Modified changes.
 * When the server returns a different fingerprint than the one at load time
 * (i.e. a new deployment happened), `updateAvailable` flips to true.
 * The check is done with cache: 'no-store' so we always hit the server.
 */
import { useEffect, useState } from "react";

export function useUpdateCheck(intervalMs = 5 * 60 * 1000) {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let baseline: string | null = null;

    async function check() {
      try {
        const res = await fetch("/", { method: "HEAD", cache: "no-store" });
        // Use ETag or Last-Modified as the version fingerprint
        const fingerprint =
          res.headers.get("etag") ||
          res.headers.get("last-modified") ||
          null;
        if (!fingerprint) return;
        if (baseline === null) {
          baseline = fingerprint;
        } else if (fingerprint !== baseline) {
          setUpdateAvailable(true);
        }
      } catch {
        // Network error — silently skip, try again next interval
      }
    }

    check();
    const timer = setInterval(check, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return updateAvailable;
}

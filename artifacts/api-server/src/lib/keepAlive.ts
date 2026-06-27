import { logger } from "./logger";

const INTERVAL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 10_000;

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startKeepAlive(): void {
  const base =
    process.env["RENDER_EXTERNAL_URL"] ?? process.env["SERVER_URL"];

  if (!base) {
    logger.warn("Keep-alive disabled — set SERVER_URL or RENDER_EXTERNAL_URL to enable");
    return;
  }

  const url = `${base.replace(/\/$/, "")}/api/healthz`;
  logger.info({ url }, "Keep-alive started (5 min interval)");

  intervalId = setInterval(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      logger.info({ status: res.status }, "Keep-alive ping OK");
    } catch (err: any) {
      logger.warn({ err: err?.message ?? String(err) }, "Keep-alive ping failed");
    } finally {
      clearTimeout(timeout);
    }
  }, INTERVAL_MS);

  intervalId.unref();
}

export function stopKeepAlive(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("Keep-alive stopped");
  }
}

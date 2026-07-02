/**
 * Shared CORS origin list used by both Express (cors middleware) and Socket.io.
 *
 * Production origins are driven by:
 *   ALLOWED_ORIGIN  — comma-separated list of extra allowed origins (manual override)
 *   RENDER_EXTERNAL_URL — automatically injected by Render; allows the deployed domain
 *
 * Dev origins cover the Vite defaults and this project's actual dev port.
 */
const envOrigin = process.env["ALLOWED_ORIGIN"];
const renderUrl = process.env["RENDER_EXTERNAL_URL"];

const extraOrigins = envOrigin
  ? envOrigin.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

export const allowedOrigins: string[] = [
  ...extraOrigins,
  // Render injects RENDER_EXTERNAL_URL automatically — covers the deployed domain
  ...(renderUrl ? [renderUrl.replace(/\/$/, "")] : []),
  "http://localhost:5173",
  "http://localhost:24576",
];

/**
 * Shared CORS origin list used by both Express (cors middleware) and Socket.io.
 *
 * Production origin is driven by the ALLOWED_ORIGIN environment variable.
 * Dev origins cover the Vite defaults and this project's actual dev port.
 */
const envOrigin = process.env["ALLOWED_ORIGIN"];

export const allowedOrigins: string[] = [
  ...(envOrigin ? [envOrigin] : []),
  "http://localhost:5173",
  "http://localhost:24576",
];

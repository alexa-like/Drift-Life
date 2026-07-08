import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { allowedOrigins } from "./lib/cors";

const app: Express = express();

// Trust the reverse proxy (Render, Replit) so rate-limiting uses real client IP
// rather than collapsing all users behind the proxy IP
app.set("trust proxy", 1);

// Security headers — first middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://image.pollinations.ai", "https://i.imgur.com"],
        connectSrc: ["'self'", "wss:", "ws:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// Global rate limit — 300 req/min per IP
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests — slow down" },
  }),
);

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts — try again in 15 minutes" },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Game action limiter — 60 req/min per IP
const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: "Action rate limit — slow down" },
});
app.use("/api/jobs", actionLimiter);
app.use("/api/crimes", actionLimiter);
app.use("/api/combat", actionLimiter);

// Economy limiter — 15 req/min per IP for currency-moving endpoints
// (bank transfer, market/auction/dark-market purchases). Tighter than the
// generic action limiter since these directly move DC/SIM between players.
const economyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { message: "Too many transactions — slow down" },
});
app.use("/api/bank/transfer", economyLimiter);
app.use("/api/market/shop/buy", economyLimiter);
app.use("/api/market/listings/:id/buy", economyLimiter);
app.use("/api/auction/:id/bid", economyLimiter);
app.use("/api/net/dark-market/buy/:listingId", economyLimiter);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin requests (no Origin header) and approved origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' is not allowed`));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({
  // Capture raw body string — needed by the Discord interactions endpoint
  // for Ed25519 signature verification (Discord signs the raw bytes, not parsed JSON).
  verify(req: any, _res, buf) {
    req.rawBody = buf.toString("utf8");
  },
}));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env["NODE_ENV"] === "production") {
  const clientBuild = path.resolve(process.cwd(), "artifacts/driftlife/dist/public");
  // Static assets — long cache (they are content-hashed by Vite)
  app.use(express.static(clientBuild, { maxAge: "1y", immutable: true }));
  // SPA fallback — never cache index.html so browsers always get fresh asset URLs
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(clientBuild, "index.html"));
  });
}

// 404 for unmatched API routes
app.use("/api/{*splat}", (req, res) => {
  res.status(404).json({ message: "Not found", code: "NOT_FOUND" });
});

// Global error-handling middleware — must be registered last.
// Catches any error passed to next(err) or thrown in a sync handler so the
// process never crashes from an unhandled route-level exception.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const log = (req as any).log ?? logger;
  log.error({ err }, "Unhandled error in request pipeline");
  if (res.headersSent) return;
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ message: "Malformed JSON body", code: "BAD_JSON" });
    return;
  }
  if (typeof err?.message === "string" && err.message.startsWith("CORS:")) {
    res.status(403).json({ message: "Origin not allowed", code: "CORS_REJECTED" });
    return;
  }
  res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
});

export default app;

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env["NODE_ENV"] === "production") {
  const clientBuild = path.resolve(process.cwd(), "artifacts/driftlife/dist/public");
  app.use(express.static(clientBuild));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientBuild, "index.html"));
  });
}

export default app;

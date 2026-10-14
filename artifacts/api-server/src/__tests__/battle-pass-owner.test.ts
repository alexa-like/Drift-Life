import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { ownerBattlePassRouter } from "../routes/battle-pass";

// Mock BattlePass model
vi.mock("../models/BattlePass", () => ({
  BattlePass: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

// Mock User model for requireAuth
vi.mock("../models/User", () => ({
  default: {
    findById: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        then: vi.fn().mockImplementation((cb: Function) => {
          return Promise.resolve(
            cb({
              banned: false,
              lastActiveAt: new Date(),
              status: "normal",
              save: vi.fn().mockResolvedValue(true),
            })
          );
        }),
      }),
    }),
    updateOne: vi.fn().mockResolvedValue({}),
  },
}));

// Mock verifyAccess jwt function
vi.mock("../lib/jwt", () => ({
  verifyAccess: vi.fn().mockImplementation((token: string) => {
    if (token === "owner-token") {
      return { userId: "valid-user", username: "owneruser", role: "owner" };
    }
    if (token === "admin-token") {
      return { userId: "valid-user", username: "adminuser", role: "admin" };
    }
    if (token === "user-token") {
      return { userId: "valid-user", username: "normaluser", role: "user" };
    }
    throw new Error("Invalid token");
  }),
}));

describe("ownerBattlePassRouter authorization check", () => {
  const app = express();
  app.use(express.json());
  app.use("/owner/battle-pass", ownerBattlePassRouter);

  it("denies access when token is missing", async () => {
    const res = await request(app).get("/owner/battle-pass");
    expect(res.status).toBe(401);
  });

  it("denies access when role is regular user", async () => {
    const res = await request(app)
      .get("/owner/battle-pass")
      .set("Authorization", "Bearer user-token");
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("allows access when role is owner", async () => {
    const res = await request(app)
      .get("/owner/battle-pass")
      .set("Authorization", "Bearer owner-token");
    expect(res.status).toBe(200);
  });

  it("allows access when role is admin", async () => {
    const res = await request(app)
      .get("/owner/battle-pass")
      .set("Authorization", "Bearer admin-token");
    expect(res.status).toBe(200);
  });
});

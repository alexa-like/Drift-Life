/**
 * Match History — Tier 8
 * GET /api/match-history — player's last 20 combat matches + last 20 race matches
 */
import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import CombatMatch from "../models/CombatMatch";
import RaceMatch from "../models/RaceMatch";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const [combatMatches, raceMatches] = await Promise.all([
      CombatMatch.find({
        $or: [{ player1Id: userId }, { player2Id: userId }],
        status: "complete",
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),

      RaceMatch.find({
        "players.userId": userId,
        status: "complete",
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const combat = combatMatches.map(m => {
      const isP1 = m.player1Id?.toString() === userId;
      const opponentId   = isP1 ? m.player2Id?.toString()   : m.player1Id?.toString();
      const opponentName = m.isPlayer2AI
        ? (m.aiName ?? "AI Opponent")
        : (isP1 ? "Opponent" : "Opponent");
      const winnerId = m.winnerId?.toString();
      const result = !winnerId ? "draw" : winnerId === userId ? "win" : "loss";
      return {
        type:         "combat" as const,
        matchId:      m.matchId,
        isAI:         m.isPlayer2AI && !isP1 ? false : (m.isPlayer2AI && isP1),
        opponentName,
        opponentId,
        result,
        turns:        m.currentTurn,
        energyCost:   m.energyCost,
        createdAt:    m.createdAt,
      };
    });

    const races = raceMatches.map(m => {
      const me = m.players.find((p: any) => p.userId?.toString() === userId);
      const placement = me?.placement ?? null;
      const totalPlayers = m.players.length;
      const hasAI = m.players.some((p: any) => p.isAI);
      const result = placement === 1 ? "win" : placement && placement <= 2 ? "top" : "loss";
      return {
        type:        "race" as const,
        matchId:     m.matchId,
        mode:        m.mode,
        placement,
        totalPlayers,
        hasAI,
        result,
        finishTime:  me?.finishTime ?? null,
        energyCost:  m.energyCost,
        createdAt:   m.createdAt,
      };
    });

    res.json({ combat, races });
  } catch (err) {
    req.log.error({ err }, "match-history error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

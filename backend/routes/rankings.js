/**
 * GET /api/rankings
 *
 * Returns the worst-performing routers sorted by health score (ascending).
 * Query params:
 *   ?limit=10  (default 10, max 60)
 */

import { Router } from "express";
import { getAllRouterHealth } from "../healthScore.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 60);
    const all = await getAllRouterHealth();

    const rankings = all.slice(0, limit).map((r, index) => ({
      rank: index + 1,
      router_id: r.router_id,
      health_score: r.health_score,
      top_issue: r.top_issue,
      sub_scores: r.sub_scores,
      averages: r.averages,
    }));

    res.json({
      count: rankings.length,
      total_routers: all.length,
      rankings,
    });
  } catch (err) {
    console.error("Rankings error:", err);
    res.status(500).json({ error: "Failed to compute rankings" });
  }
});

export default router;

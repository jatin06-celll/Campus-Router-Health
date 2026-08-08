/**
 * GET /api/routers/:id
 *
 * Returns full detail for a single router:
 *   - Router info (model, building, room, etc.)
 *   - Health score + sub-scores
 *   - Metrics time series (last 24h, hourly)
 *   - Complaints linked to this router
 */

import { Router } from "express";
import pool from "../db.js";
import { getRouterHealth } from "../healthScore.js";

const router = Router();

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Router info
    const { rows: routerRows } = await pool.query(
      "SELECT * FROM routers WHERE router_id = $1",
      [id]
    );

    if (routerRows.length === 0) {
      return res.status(404).json({ error: `Router ${id} not found` });
    }

    const routerInfo = routerRows[0];

    // 2. Health score
    const health = await getRouterHealth(id);

    // 3. Metrics time series (last 24h, ordered by hour)
    const { rows: metrics } = await pool.query(
      `SELECT hour, avg_speed_mbps, latency_ms, packet_loss_pct,
              disconnects, connected_devices, signal_dbm
       FROM metrics
       WHERE router_id = $1
         AND hour >= (SELECT MAX(hour) FROM metrics) - INTERVAL '24 hours'
       ORDER BY hour ASC`,
      [id]
    );

    // 4. Complaints
    const { rows: complaints } = await pool.query(
      `SELECT ticket_id, date, complaint_text
       FROM complaints
       WHERE router_id = $1
       ORDER BY date DESC`,
      [id]
    );

    res.json({
      router: {
        router_id: routerInfo.router_id,
        model: routerInfo.model,
        firmware_version: routerInfo.firmware_version,
        building: routerInfo.building,
        room: routerInfo.room,
        user_type: routerInfo.user_type,
        issue_date: routerInfo.issue_date,
      },
      health: health
        ? {
            score: health.health_score,
            top_issue: health.top_issue,
            sub_scores: health.sub_scores,
            averages: health.averages,
            sample_count: health.sample_count,
          }
        : null,
      metrics: {
        count: metrics.length,
        time_series: metrics,
      },
      complaints: {
        count: complaints.length,
        tickets: complaints,
      },
    });
  } catch (err) {
    console.error(`Router detail error (${id}):`, err);
    res.status(500).json({ error: "Failed to fetch router details" });
  }
});

export default router;

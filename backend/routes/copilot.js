/**
 * POST /api/copilot/ask
 *
 * AI-powered network diagnostics using Google Gemini with enforced JSON schema.
 * Uses REAL router data from the database — not a mock.
 *
 * Body:  { "router_id": "R-1002" }
 * Returns: { cause, evidence[], recommendedFix }
 */

import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import pool from "../db.js";
import { getRouterHealth } from "../healthScore.js";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// ─── Response Schema (enforced by Gemini) ──────────────────
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    cause: {
      type: "STRING",
      description: "Brief explanation of the root cause of the router's issues.",
    },
    evidence: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Specific metric values and complaints that support the diagnosis.",
    },
    recommendedFix: {
      type: "STRING",
      enum: ["firmware update", "relocate", "replace", "user education"],
      description: "The single best remediation action.",
    },
  },
  required: ["cause", "evidence", "recommendedFix"],
};

// ─── Build real context from DB ─────────────────────────────
async function getRouterContext(routerId) {
  // Router info
  const { rows: routerRows } = await pool.query(
    "SELECT * FROM routers WHERE router_id = $1",
    [routerId]
  );
  if (routerRows.length === 0) return null;
  const info = routerRows[0];

  // Health score + averages
  const health = await getRouterHealth(routerId);

  // Complaints
  const { rows: complaints } = await pool.query(
    `SELECT ticket_id, date, complaint_text FROM complaints
     WHERE router_id = $1 ORDER BY date DESC`,
    [routerId]
  );

  // Format context string for the AI
  const complaintsText =
    complaints.length > 0
      ? complaints.map((c) => `- [${c.date.toISOString().slice(0, 10)}] ${c.complaint_text}`).join("\n")
      : "No complaints logged.";

  const avgText = health
    ? `- Average Speed: ${health.averages.speed_mbps} Mbps
- Average Latency: ${health.averages.latency_ms} ms
- Packet Loss: ${health.averages.packet_loss_pct}%
- Disconnects: ${health.averages.disconnects_per_hr}/hr
- Signal Strength: ${health.averages.signal_dbm} dBm
- Health Score: ${health.health_score}/100
- Top Issue: ${health.top_issue}`
    : "No metrics available.";

  return `Router ID: ${routerId}
Model: ${info.model} | Firmware: ${info.firmware_version}
Location: ${info.building}, Room ${info.room} | User Type: ${info.user_type}

Aggregated Metrics (24h rolling average):
${avgText}

Summarized Complaints (${complaints.length} total):
${complaintsText}`;
}

// ─── Route ─────────────────────────────────────────────────
router.post("/ask", async (req, res) => {
  const { router_id } = req.body;

  if (!router_id || typeof router_id !== "string") {
    return res.status(400).json({ error: "A 'router_id' field is required in the request body" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return res.status(503).json({ error: "GEMINI_API_KEY is not configured in .env" });
  }

  try {
    // Build context from real DB
    const context = await getRouterContext(router_id.trim().toUpperCase());
    if (!context) {
      return res.status(404).json({ error: `Router ${router_id} not found` });
    }

    // Call Gemini with enforced JSON schema
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: context,
      config: {
        systemInstruction:
          "You are a network diagnostic AI for a campus Wi-Fi system. " +
          "Use ONLY the data provided. Cite specific metric numbers as evidence. " +
          "Pick exactly one fix from: firmware update, relocate, replace, user education. " +
          "Never invent evidence not present in the data.",
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text);
    res.json(parsed);
  } catch (err) {
    console.error("Copilot error:", err.message);

    // If quota exceeded, return a structured fallback based on DB data
    if (err.message && err.message.includes("RESOURCE_EXHAUSTED")) {
      try {
        const health = await getRouterHealth(router_id.trim().toUpperCase());
        if (health) {
          const isHealthy = health.health_score >= 75;
          let fix = "user education";
          let causeText = `Router is operating normally with a score of ${health.health_score}/100. Users may need guidance on connecting properly.`;
          let specificEvidence = `No major hardware faults. Top issue was minor ${health.top_issue}.`;

          if (!isHealthy) {
            if (health.top_issue === "Weak Signal Strength") {
              fix = "relocate";
              causeText = `Physical obstructions or poor placement is causing weak signal (${health.averages.signal_dbm} dBm).`;
              specificEvidence = `Signal strength is dangerously low at ${health.averages.signal_dbm} dBm.`;
            } else if (health.top_issue === "Low Download Speed") {
              fix = "firmware update";
              causeText = `Outdated routing tables or firmware bugs are artificially capping throughput at ${health.averages.speed_mbps} Mbps.`;
              specificEvidence = `Speed is severely degraded at ${health.averages.speed_mbps} Mbps despite connection.`;
            } else {
              fix = "replace";
              causeText = `Hardware degradation detected causing ${health.top_issue} (Score: ${health.health_score}/100).`;
              specificEvidence = `Critical failure metric: ${health.top_issue}.`;
            }
          }

          return res.json({
            cause: `[Fallback Mode] ${causeText}`,
            evidence: [
              specificEvidence,
              `Average Latency: ${health.averages.latency_ms} ms`,
              `Packet Loss: ${health.averages.packet_loss_pct}%`,
              `Hourly Disconnects: ${health.averages.disconnects_per_hr}`
            ],
            recommendedFix: fix,
            _fallback: true,
          });
        }
      } catch (_) { /* ignore */ }
      return res.status(429).json({ error: "Gemini API quota exceeded. Please check your billing at ai.dev/rate-limit" });
    }

    res.status(500).json({ error: "AI processing failed", details: err.message });
  }
});

export default router;

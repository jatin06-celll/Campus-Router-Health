/**
 * DigiPlus — Router Health Score Engine
 *
 * Computes a 0–100 health score per router using a rolling 24h window.
 * Each metric is normalized to 0–1 (1 = healthy) then combined with weights.
 * The "top contributing factor" is whichever sub-score is worst relative
 * to its weight — i.e. the metric dragging the overall score down the most.
 *
 * Formula:
 *   health = 25·S_speed + 25·S_latency + 20·S_packetloss + 15·S_disconnects + 15·S_signal
 *
 * Sub-scores (all clamped to [0, 1]):
 *   S_speed       = min(avg_speed / 80, 1)                   — 80 Mbps = ideal
 *   S_latency     = max(1 − avg_latency / 200, 0)            — 200ms = floor
 *   S_packetloss  = max(1 − avg_packet_loss / 5, 0)          — 5% = floor
 *   S_disconnects = max(1 − avg_disconnects / 5, 0)           — 5 per hour = floor
 *   S_signal      = clamp((avg_signal + 85) / 45, 0, 1)      — −40 dBm = 1.0, −85 dBm = 0.0
 */

import pool from "./db.js";

// ─── Thresholds & Weights ──────────────────────────────────
const WEIGHTS = {
  speed:       25,
  latency:     25,
  packetLoss:  20,
  disconnects: 15,
  signal:      15,
};

const THRESHOLDS = {
  speed:       { ideal: 80 },        // Mbps
  latency:     { floor: 200 },       // ms
  packetLoss:  { floor: 5 },         // percent
  disconnects: { floor: 5 },         // per hour avg
  signal:      { good: -40, bad: -85 }, // dBm
};

// Human-readable labels for each factor
const FACTOR_LABELS = {
  speed:       "Low Download Speed",
  latency:     "High Latency",
  packetLoss:  "Packet Loss",
  disconnects: "Frequent Disconnects",
  signal:      "Weak Signal Strength",
};

// ─── Sub-score functions ───────────────────────────────────
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function scoreSpeed(avgSpeed) {
  return clamp(avgSpeed / THRESHOLDS.speed.ideal, 0, 1);
}

function scoreLatency(avgLatency) {
  return clamp(1 - avgLatency / THRESHOLDS.latency.floor, 0, 1);
}

function scorePacketLoss(avgPktLoss) {
  return clamp(1 - avgPktLoss / THRESHOLDS.packetLoss.floor, 0, 1);
}

function scoreDisconnects(avgDc) {
  return clamp(1 - avgDc / THRESHOLDS.disconnects.floor, 0, 1);
}

function scoreSignal(avgSignal) {
  // -40 dBm → 1.0, -85 dBm → 0.0
  const range = THRESHOLDS.signal.good - THRESHOLDS.signal.bad; // 45
  return clamp((avgSignal - THRESHOLDS.signal.bad) / range, 0, 1);
}

// ─── Core: compute health for pre-aggregated averages ──────
export function computeHealth(averages) {
  const subScores = {
    speed:       scoreSpeed(averages.avg_speed),
    latency:     scoreLatency(averages.avg_latency),
    packetLoss:  scorePacketLoss(averages.avg_packet_loss),
    disconnects: scoreDisconnects(averages.avg_disconnects),
    signal:      scoreSignal(averages.avg_signal),
  };

  // Weighted sum → 0–100
  let health = 0;
  for (const [key, score] of Object.entries(subScores)) {
    health += WEIGHTS[key] * score;
  }
  health = Math.round(health * 10) / 10; // one decimal

  // Top contributing factor = the sub-score with the lowest value
  // (the one pulling the overall health down the most)
  let worstKey = null;
  let worstScore = Infinity;
  for (const [key, score] of Object.entries(subScores)) {
    if (score < worstScore) {
      worstScore = score;
      worstKey = key;
    }
  }

  return {
    health_score: health,
    sub_scores: subScores,
    top_issue: worstKey ? FACTOR_LABELS[worstKey] : "None",
    top_issue_key: worstKey,
    top_issue_score: worstScore,
  };
}

// ─── SQL query: aggregate last 24h of metrics ──────────────
const AGGREGATE_SQL = `
  SELECT
    router_id,
    AVG(avg_speed_mbps)::real       AS avg_speed,
    AVG(latency_ms)::real           AS avg_latency,
    AVG(packet_loss_pct)::real      AS avg_packet_loss,
    AVG(disconnects)::real          AS avg_disconnects,
    AVG(signal_dbm)::real           AS avg_signal,
    COUNT(*)::int                   AS sample_count
  FROM metrics
  WHERE hour >= (SELECT MAX(hour) FROM metrics) - INTERVAL '24 hours'
  GROUP BY router_id
`;

const AGGREGATE_SINGLE_SQL = `
  SELECT
    router_id,
    AVG(avg_speed_mbps)::real       AS avg_speed,
    AVG(latency_ms)::real           AS avg_latency,
    AVG(packet_loss_pct)::real      AS avg_packet_loss,
    AVG(disconnects)::real          AS avg_disconnects,
    AVG(signal_dbm)::real           AS avg_signal,
    COUNT(*)::int                   AS sample_count
  FROM metrics
  WHERE router_id = $1
    AND hour >= (SELECT MAX(hour) FROM metrics) - INTERVAL '24 hours'
  GROUP BY router_id
`;

// ─── Public API ────────────────────────────────────────────

/**
 * Compute health score for a single router.
 * Returns null if no data found.
 */
export async function getRouterHealth(routerId) {
  const { rows } = await pool.query(AGGREGATE_SINGLE_SQL, [routerId]);
  if (rows.length === 0) return null;

  const avg = rows[0];
  const result = computeHealth(avg);

  return {
    router_id: routerId,
    ...result,
    averages: {
      speed_mbps: Math.round(avg.avg_speed * 10) / 10,
      latency_ms: Math.round(avg.avg_latency * 10) / 10,
      packet_loss_pct: Math.round(avg.avg_packet_loss * 100) / 100,
      disconnects_per_hr: Math.round(avg.avg_disconnects * 10) / 10,
      signal_dbm: Math.round(avg.avg_signal * 10) / 10,
    },
    sample_count: avg.sample_count,
  };
}

/**
 * Compute health scores for ALL routers. Returns sorted by score (worst first).
 */
export async function getAllRouterHealth() {
  const { rows } = await pool.query(AGGREGATE_SQL);

  const results = rows.map((avg) => {
    const result = computeHealth(avg);
    return {
      router_id: avg.router_id,
      ...result,
      averages: {
        speed_mbps: Math.round(avg.avg_speed * 10) / 10,
        latency_ms: Math.round(avg.avg_latency * 10) / 10,
        packet_loss_pct: Math.round(avg.avg_packet_loss * 100) / 100,
        disconnects_per_hr: Math.round(avg.avg_disconnects * 10) / 10,
        signal_dbm: Math.round(avg.avg_signal * 10) / 10,
      },
      sample_count: avg.sample_count,
    };
  });

  results.sort((a, b) => a.health_score - b.health_score);
  return results;
}

/**
 * Manual test — run with: node testHealth.js
 *
 * Tests the health score formula against routers we can eyeball:
 *   R-1002  → BAD  (speed ~12, latency ~128, pkt_loss ~3.4, disconnects ~4.1)
 *   R-1010  → BAD  (speed ~12, latency ~135, pkt_loss ~3.6, disconnects ~4.2)
 *   R-1000  → OK   (speed ~56, latency ~27, pkt_loss ~0.5, disconnects ~0.5)
 *   R-1005  → GOOD (speed ~58, latency ~28, pkt_loss ~0.5, disconnects ~0.4)
 *   R-1052  → BEST (speed ~60, latency ~25, pkt_loss ~0.5, disconnects ~0.6)
 */

import { getRouterHealth, getAllRouterHealth } from "./healthScore.js";
import pool from "./db.js";

const TEST_ROUTERS = ["R-1002", "R-1010", "R-1000", "R-1005", "R-1052"];

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DigiPlus Health Score — Manual Validation");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Test individual routers
  for (const id of TEST_ROUTERS) {
    const result = await getRouterHealth(id);
    if (!result) {
      console.log(`  ${id}: NO DATA\n`);
      continue;
    }

    const grade =
      result.health_score >= 88 ? "🟢 HEALTHY" :
      result.health_score >= 50 ? "🟡 WARNING" :
                                  "🔴 CRITICAL";

    console.log(`  ${id}  →  ${result.health_score}/100  ${grade}`);
    console.log(`    Top Issue:   ${result.top_issue}`);
    console.log(`    Sub-scores:  speed=${(result.sub_scores.speed * 100).toFixed(0)}%  latency=${(result.sub_scores.latency * 100).toFixed(0)}%  pkt_loss=${(result.sub_scores.packetLoss * 100).toFixed(0)}%  disconnects=${(result.sub_scores.disconnects * 100).toFixed(0)}%  signal=${(result.sub_scores.signal * 100).toFixed(0)}%`);
    console.log(`    Averages:    ${result.averages.speed_mbps} Mbps  ${result.averages.latency_ms} ms  ${result.averages.packet_loss_pct}% loss  ${result.averages.disconnects_per_hr} dc/hr  ${result.averages.signal_dbm} dBm`);
    console.log(`    Samples:     ${result.sample_count} hourly readings`);
    console.log();
  }

  // Show full ranking (top 5 worst, top 5 best)
  const all = await getAllRouterHealth();

  console.log("───────────────────────────────────────────────────────────────");
  console.log("  Bottom 5 (worst health):");
  console.log("───────────────────────────────────────────────────────────────");
  for (const r of all.slice(0, 5)) {
    console.log(`    ${r.router_id}  ${String(r.health_score).padStart(5)}/100  → ${r.top_issue}`);
  }

  console.log();
  console.log("───────────────────────────────────────────────────────────────");
  console.log("  Top 5 (best health):");
  console.log("───────────────────────────────────────────────────────────────");
  for (const r of all.slice(-5).reverse()) {
    console.log(`    ${r.router_id}  ${String(r.health_score).padStart(5)}/100  → ${r.top_issue}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════\n");

  await pool.end();
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

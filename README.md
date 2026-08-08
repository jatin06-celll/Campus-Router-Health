# DigiPlus — Campus Wi-Fi Health Monitor

Real-time health scoring and AI-powered diagnostics for campus router infrastructure.

## Project Structure

```
Digiplus/
├── backend/            Express API server
│   ├── server.js       Main server + /health endpoint
│   ├── db.js           PostgreSQL connection pool
│   ├── healthScore.js  Health score computation engine
│   ├── seed.js         CSV → database seeder
│   ├── testHealth.js   Manual health score validation
│   └── .env            Environment variables
├── frontend/           React + Vite + Tailwind v3
│   └── src/
│       ├── App.jsx     Main app component
│       └── index.css   Tailwind directives
├── routers.csv         60 campus routers
├── metrics.csv         1440 hourly metric readings (24h × 60 routers)
└── COMPLA_1.CSV        30 user complaint tickets
```

## Database Schema

| Table | Rows | Description |
|-------|------|-------------|
| `routers` | 60 | Router inventory: model, firmware, building, room, user type |
| `metrics` | 1440 | Hourly telemetry: speed, latency, packet loss, disconnects, signal |
| `complaints` | 30 | User-filed tickets linked to routers |

## Health Score Formula

### Overview

Each router receives a **0–100 health score** computed from a **rolling 24-hour window** of hourly telemetry data. The score is a weighted sum of 5 normalized sub-scores, where each sub-score maps a raw metric to a 0–1 scale (1 = healthy, 0 = critical).

### Sub-Scores

| Metric | Weight | Sub-Score Formula | Ideal → Score | Floor → Score |
|--------|--------|-------------------|---------------|---------------|
| **Download Speed** | 25% | `min(avg_speed / 80, 1)` | 80+ Mbps → 1.0 | 0 Mbps → 0.0 |
| **Latency** | 25% | `max(1 − avg_latency / 200, 0)` | 0 ms → 1.0 | 200+ ms → 0.0 |
| **Packet Loss** | 20% | `max(1 − avg_pkt_loss / 5, 0)` | 0% → 1.0 | 5%+ → 0.0 |
| **Disconnects** | 15% | `max(1 − avg_disconnects / 5, 0)` | 0/hr → 1.0 | 5+/hr → 0.0 |
| **Signal Strength** | 15% | `clamp((avg_signal + 85) / 45, 0, 1)` | −40 dBm → 1.0 | −85 dBm → 0.0 |

### Final Formula

```
health_score = 25·S_speed + 25·S_latency + 20·S_packetloss + 15·S_disconnects + 15·S_signal
```

All sub-scores are clamped to `[0, 1]`. The final score ranges from **0** (all metrics at floor) to **100** (all metrics ideal).

### Top Contributing Factor

The **top issue** is the sub-score with the **lowest value** — the metric dragging health down the most. For example, if a router has speed=15%, latency=36%, packet_loss=32%, disconnects=18%, signal=28%, the top issue is "Low Download Speed" (15%).

### Grade Thresholds

| Score Range | Grade | Meaning |
|-------------|-------|---------|
| 75–100 | 🟢 HEALTHY | Normal operation |
| 50–74 | 🟡 DEGRADED | Noticeable issues |
| 25–49 | 🟠 POOR | Significant problems |
| 0–24 | 🔴 CRITICAL | Requires immediate attention |

### Design Rationale

- **24h rolling window**: Smooths out transient spikes; a single bad hour doesn't dominate. Uses `WHERE hour >= MAX(hour) - INTERVAL '24 hours'` so it adapts as new data arrives.
- **Speed & Latency weighted equally at 25%**: These are the two metrics users feel most directly (buffering, slow page loads).
- **Packet loss at 20%**: Causes retransmissions; very disruptive to video calls and real-time apps.
- **Disconnects & Signal at 15% each**: Important but somewhat correlated with each other and the above metrics.
- **Linear normalization**: Simple, predictable, and easy to debug. No log-scaling or complex curves needed given the data distribution.

### Validation (from actual data)

| Router | Avg Speed | Avg Latency | Pkt Loss | Disconnects | Signal | Score | Grade |
|--------|-----------|-------------|----------|-------------|--------|-------|-------|
| R-1010 | 12.3 Mbps | 135 ms | 3.56% | 4.2/hr | −74 dBm | **23.9** | 🔴 CRITICAL |
| R-1002 | 11.7 Mbps | 128 ms | 3.39% | 4.1/hr | −73 dBm | **25.9** | 🟠 POOR |
| R-1000 | 56.1 Mbps | 27 ms | 0.53% | 0.3/hr | −51 dBm | **82.5** | 🟢 HEALTHY |
| R-1005 | 58.1 Mbps | 28 ms | 0.50% | 0.4/hr | −50 dBm | **83.1** | 🟢 HEALTHY |

The 8 routers with multiple complaints all score < 26 (POOR/CRITICAL). The 52 healthy routers all score > 78. No false positives or false negatives.

## Quick Start

```bash
# Backend
cd backend
cp .env.example .env   # edit DATABASE_URL
npm install
npm run seed           # creates tables + imports CSVs
npm run dev            # starts Express on :5000

# Frontend
cd frontend
npm install
npm run dev            # starts Vite on :5173
```



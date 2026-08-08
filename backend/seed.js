import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// ─── Helpers ───────────────────────────────────────────────
function readCSV(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

// ─── DDL ───────────────────────────────────────────────────
const CREATE_TABLES = `
  DROP TABLE IF EXISTS complaints CASCADE;
  DROP TABLE IF EXISTS metrics    CASCADE;
  DROP TABLE IF EXISTS routers    CASCADE;

  CREATE TABLE routers (
    router_id         TEXT PRIMARY KEY,
    model             TEXT NOT NULL,
    firmware_version  TEXT NOT NULL,
    building          TEXT NOT NULL,
    room              TEXT NOT NULL,
    user_type         TEXT NOT NULL,
    issue_date        DATE NOT NULL
  );

  CREATE TABLE metrics (
    id                 SERIAL PRIMARY KEY,
    router_id          TEXT NOT NULL REFERENCES routers(router_id),
    hour               TIMESTAMP NOT NULL,
    avg_speed_mbps     REAL NOT NULL,
    latency_ms         INTEGER NOT NULL,
    packet_loss_pct    REAL NOT NULL,
    disconnects        INTEGER NOT NULL,
    connected_devices  INTEGER NOT NULL,
    signal_dbm         INTEGER NOT NULL
  );

  CREATE TABLE complaints (
    ticket_id       TEXT PRIMARY KEY,
    router_id       TEXT NOT NULL REFERENCES routers(router_id),
    date            DATE NOT NULL,
    complaint_text  TEXT NOT NULL
  );
`;

// ─── Seed functions ────────────────────────────────────────
async function seedRouters(rows) {
  const values = [];
  const params = [];
  rows.forEach((r, i) => {
    const off = i * 7;
    values.push(
      `($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5}, $${off + 6}, $${off + 7})`
    );
    params.push(
      r.router_id,
      r.model,
      r.firmware_version,
      r.building,
      r.room,
      r.user_type,
      r.issue_date
    );
  });
  const sql = `INSERT INTO routers (router_id, model, firmware_version, building, room, user_type, issue_date)
               VALUES ${values.join(",\n       ")}`;
  await pool.query(sql, params);
  console.log(`  ✅ routers: inserted ${rows.length} rows`);
}

async function seedMetrics(rows) {
  // Insert in batches of 200 to stay within Postgres param limits
  const BATCH = 200;
  let inserted = 0;
  for (let b = 0; b < rows.length; b += BATCH) {
    const batch = rows.slice(b, b + BATCH);
    const values = [];
    const params = [];
    batch.forEach((r, i) => {
      const off = i * 8;
      values.push(
        `($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5}, $${off + 6}, $${off + 7}, $${off + 8})`
      );
      params.push(
        r.router_id,
        r.hour,
        parseFloat(r.avg_speed_mbps),
        parseInt(r.latency_ms),
        parseFloat(r.packet_loss_pct),
        parseInt(r.disconnects),
        parseInt(r.connected_devices),
        parseInt(r.signal_dbm)
      );
    });
    const sql = `INSERT INTO metrics (router_id, hour, avg_speed_mbps, latency_ms, packet_loss_pct, disconnects, connected_devices, signal_dbm)
                 VALUES ${values.join(",\n       ")}`;
    await pool.query(sql, params);
    inserted += batch.length;
  }
  console.log(`  ✅ metrics: inserted ${inserted} rows`);
}

async function seedComplaints(rows) {
  const values = [];
  const params = [];
  rows.forEach((r, i) => {
    const off = i * 4;
    values.push(`($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4})`);
    params.push(r.ticket_id, r.router_id, r.date, r.complaint_text);
  });
  const sql = `INSERT INTO complaints (ticket_id, router_id, date, complaint_text)
               VALUES ${values.join(",\n       ")}`;
  await pool.query(sql, params);
  console.log(`  ✅ complaints: inserted ${rows.length} rows`);
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding database...\n");

  // 1. Read CSVs
  const csvDir = process.env.CSV_DIR || path.resolve(__dirname, "..");
  const routersData    = readCSV(path.join(csvDir, "routers.csv"));
  const metricsData    = readCSV(path.join(csvDir, "metrics.csv"));
  const complaintsData = readCSV(path.join(csvDir, "COMPLA_1.CSV"));

  console.log(`📄 CSV row counts:`);
  console.log(`   routers:    ${routersData.length}`);
  console.log(`   metrics:    ${metricsData.length}`);
  console.log(`   complaints: ${complaintsData.length}\n`);

  // 2. Create tables (drops existing)
  console.log("🗃️  Creating tables...");
  await pool.query(CREATE_TABLES);
  console.log("  ✅ Tables created\n");

  // 3. Insert data (routers first — metrics/complaints FK to it)
  console.log("📥 Inserting data...");
  await seedRouters(routersData);
  await seedMetrics(metricsData);
  await seedComplaints(complaintsData);

  // 4. Verify counts
  console.log("\n🔍 Verifying row counts...");
  const { rows: [rc] } = await pool.query("SELECT COUNT(*)::int AS count FROM routers");
  const { rows: [mc] } = await pool.query("SELECT COUNT(*)::int AS count FROM metrics");
  const { rows: [cc] } = await pool.query("SELECT COUNT(*)::int AS count FROM complaints");

  const results = [
    { table: "routers",    csv: routersData.length,    db: rc.count },
    { table: "metrics",    csv: metricsData.length,    db: mc.count },
    { table: "complaints", csv: complaintsData.length, db: cc.count },
  ];

  console.log("\n┌────────────┬──────┬──────┬────────┐");
  console.log("│ Table      │  CSV │   DB │ Match? │");
  console.log("├────────────┼──────┼──────┼────────┤");
  for (const r of results) {
    const match = r.csv === r.db ? "  ✅  " : "  ❌  ";
    console.log(
      `│ ${r.table.padEnd(10)} │ ${String(r.csv).padStart(4)} │ ${String(r.db).padStart(4)} │${match}│`
    );
  }
  console.log("└────────────┴──────┴──────┴────────┘");

  const allMatch = results.every((r) => r.csv === r.db);
  if (allMatch) {
    console.log("\n🎉 All row counts match! Seed complete.\n");
  } else {
    console.error("\n❌ Row count mismatch detected!\n");
    process.exit(1);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});

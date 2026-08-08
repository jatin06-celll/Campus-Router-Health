import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";
import rankingsRouter from "./routes/rankings.js";
import routersRouter from "./routes/routers.js";
import copilotRouter from "./routes/copilot.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const dbResult = await pool.query("SELECT NOW()");
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      dbTime: dbResult.rows[0].now,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: err.message,
    });
  }
});

// API routes
app.use("/api/rankings", rankingsRouter);
app.use("/api/routers", routersRouter);
app.use("/api/copilot", copilotRouter);

// Catch-all to serve React frontend for any unknown route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Rankings:     http://localhost:${PORT}/api/rankings`);
  console.log(`🔍 Router:       http://localhost:${PORT}/api/routers/:id`);
  console.log(`🤖 Copilot:      POST http://localhost:${PORT}/api/copilot/ask`);
});

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection
pool.query("SELECT NOW()")
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ PostgreSQL connection error:", err.message));

export default pool;

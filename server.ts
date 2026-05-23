import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const DB_FILE = "/tmp/biz_suite_db.json";

// In-memory cache of the database state
let databaseState: Record<string, any> = {};

// Load database from file if it exists
try {
  if (fs.existsSync(DB_FILE)) {
    const fileContent = fs.readFileSync(DB_FILE, "utf-8");
    databaseState = JSON.parse(fileContent);
    console.log("Database loaded successfully from:", DB_FILE);
  } else {
    console.log("No existing database file found at", DB_FILE, ". Starting fresh.");
  }
} catch (error) {
  console.error("Error loading database file:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API endpoints FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", persistenceFile: DB_FILE });
  });

  // Fetch complete database state
  app.get("/api/db", (req, res) => {
    res.json(databaseState);
  });

  // Save/Sync database state
  app.post("/api/db", (req, res) => {
    try {
      databaseState = req.body || {};
      
      // Persist to file
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(databaseState, null, 2), "utf-8");
      
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error("Failed to save database state:", error);
      res.status(500).json({ error: error.message || "Persistence failure" });
    }
  });

  // Vite middleware for assets serving in development and production routing
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

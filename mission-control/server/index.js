// ════════════════════════════════════════════════════════════════
// index.js — the entry point. `npm start` runs THIS file.
//
// It does four things:
//   1. Load secrets from .env into process.env
//   2. Create the Express app
//   3. Wire up middleware (CORS, JSON parsing) and our /api routes
//   4. Start listening on the port
// ════════════════════════════════════════════════════════════════

// dotenv must run BEFORE we import anything that reads process.env,
// so the integration modules see the values. Importing it at the top
// and calling config() first guarantees that order.
import "dotenv/config";

import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api.js";

const app = express();
const PORT = process.env.PORT || 3001;

// CORS lets the React dev server (port 3000) call this API (port 3001)
// during development without the browser blocking it.
app.use(cors());

// Parse incoming JSON bodies automatically (we'll need this once we
// add command buttons that POST data).
app.use(express.json());

// Everything under /api is handled by routes/api.js
app.use("/api", apiRoutes);

// A plain health check so you can confirm the server is up by
// visiting http://localhost:3001/  in a browser.
app.get("/", (req, res) => {
  res.send("Mission Control backend is running. Try /api/status");
});

app.listen(PORT, () => {
  console.log(`✅ Mission Control backend listening on http://localhost:${PORT}`);
  console.log(`   Try: http://localhost:${PORT}/api/status`);
});

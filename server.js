
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DEMO_MODE = process.env.DEMO_MODE !== "false";
const STEP = 0.25;
const MIN_CRASH = 1.25;
const MAX_CRASH = 10;
const HISTORY_LIMIT = 50;

app.use(express.json());

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(x => x.trim())
    : true
}));

let round = null;
let nextId = 1;
const history = [];

function generateCrashPoint() {
  const count = Math.floor(
    (MAX_CRASH - MIN_CRASH) / STEP
  ) + 1;

  return Number((
    MIN_CRASH + crypto.randomInt(0, count) * STEP
  ).toFixed(2));
}

function publicRound(r) {
  if (!r) return null;

  const result = {
    id: r.id,
    status: r.status,
    multiplier: r.multiplier,
    startedAt: r.startedAt,
    demoMode: DEMO_MODE
  };

  if (r.status === "crashed") {
    result.crashPoint = r.crashPoint;
    result.crashedAt = r.crashedAt;
  }

  return result;
}

app.get("/", (req, res) => {
  res.send("Chicken Road demo server is running.");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    demoMode: DEMO_MODE,
    realMoneyEnabled: false
  });
});

app.get("/api/round/current", (req, res) => {
  res.json({ round: publicRound(round) });
});

app.post("/api/round/start", (req, res) => {
  if (!DEMO_MODE) {
    return res.status(403).json({
      error: "Demo mode is disabled."
    });
  }

  if (round && round.status === "running") {
    return res.status(409).json({
      error: "A round is already running.",
      round: publicRound(round)
    });
  }

  round = {
    id: nextId++,
    status: "running",
    multiplier: 1,
    crashPoint: generateCrashPoint(),
    startedAt: new Date().toISOString()
  };

  res.status(201).json({
    round: publicRound(round)
  });
});

app.post("/api/round/advance", (req, res) => {
  if (!DEMO_MODE) {
    return res.status(403).json({
      error: "Demo mode is disabled."
    });
  }

  if (!round || round.status !== "running") {
    return res.status(409).json({
      error: "No active round."
    });
  }

  const next = Number(
    (round.multiplier + STEP).toFixed(2)
  );

  if (next >= round.crashPoint) {
    round.status = "crashed";
    round.multiplier = round.crashPoint;
    round.crashedAt = new Date().toISOString();

    history.unshift({
      id: round.id,
      crashPoint: round.crashPoint,
      startedAt: round.startedAt,
      crashedAt: round.crashedAt
    });

    if (history.length > HISTORY_LIMIT) {
      history.pop();
    }

    return res.json({
      round: publicRound(round),
      crashed: true
    });
  }

  round.multiplier = next;

  res.json({
    round: publicRound(round),
    crashed: false
  });
});

app.get("/api/history", (req, res) => {
  res.json({
    history,
    demoMode: DEMO_MODE
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Chicken Road server running on port ${PORT}`
  );
});

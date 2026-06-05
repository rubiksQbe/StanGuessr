import express from "express";
import cors from "cors";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  addUser,
  addGameScore,
  getGlobalTopScores,
  getScoreRank,
  getUserTopScores,
  getUserByName,
  createUser,
} from "./db.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const MAPS_CONFIG_URL = "http://localhost:3001/api/config/maps";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnvFile(path.join(__dirname, ".env"));

// -- Install middleware --
// CORS middleware
app.use(cors());
// JSON body parser
app.use(express.json());
// URL-encoded body parser (for Form Data)
app.use(express.urlencoded({ extended: true }));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

const stanfordLocations = [
  {
    lat: 37.4272713,
    lng: -122.1840778,
    name: "O'Donohue Family Stanford Educational Farm",
  },
  { lat: 37.4205135, lng: -122.1737358, name: "Kappa Alpha" },
  { lat: 37.4198322, lng: -122.1745579, name: "In between EBF and Narnia" },
  { lat: 37.4196663, lng: -122.1672592, name: "In between Phi Psi and TouLou" },
  { lat: 37.4240794, lng: -122.1713111, name: "Treehouse entrance" },
  { lat: 37.4234477, lng: -122.1817297, name: "Driving range" },
  { lat: 37.4248346, lng: -122.1687196, name: "Bookstore" },
  { lat: 37.4244411, lng: -122.1670459, name: "Ceras" },
  { lat: 37.4260864, lng: -122.1637039, name: "Toyon Courtyard" },
  { lat: 37.4264779, lng: -122.1672021, name: "Green entrance" },
  { lat: 37.4270717, lng: -122.170385, name: "Memorial Church" },
  { lat: 37.4276321, lng: -122.1669879, name: "Hoover Tower" },
  { lat: 37.4287364, lng: -122.1632509, name: "Graduate School of Business" },
  { lat: 37.4252152, lng: -122.1743048, name: "Windhover" },
  { lat: 37.4214093, lng: -122.1780163, name: "Lake Lagunita" },
  { lat: 37.4053681, lng: -122.1749427, name: "Dish" },
  { lat: 37.4219057, lng: -122.162767, name: "Pi Phi" },
  { lat: 37.425097, lng: -122.170026, name: "Old Union" },
  { lat: 37.4290153, lng: -122.1558078, name: "Stanford Federal Credit Union" },
  { lat: 37.4268217, lng: -122.1773863, name: "AOERC" },
  {
    lat: 37.4257376,
    lng: -122.1806768,
    name: "In between Ricker and Robinson",
  },
  {
    lat: 37.4333776,
    lng: -122.1758075,
    name: "Front of Stanford Medical Center",
  },
  { lat: 37.4328688, lng: -122.1711744, name: "Cantor" },
  { lat: 37.4345298, lng: -122.1611227, name: "Stanford Stadium" },
  { lat: 37.4283586, lng: -122.1748137, name: "Engineering Quad" },
  { lat: 37.4348035, lng: -122.1680317, name: "Stanford Griffins" },
  { lat: 37.4314613, lng: -122.1745986, name: "James H. Clark Center" },
  {
    lat: 37.433134,
    lng: -122.1765402,
    name: "Stanford Medical Center fountains",
  },
  {
    lat: 37.4299936,
    lng: -122.1572537,
    name: "Stanford Beach Volleyball Stadium",
  },
  { lat: 37.4224638, lng: -122.1566591, name: "EVGR A" },
].map((location, index) => ({ id: index + 1, ...location }));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "StanGuessr API is running" });
});

app.get("/api/location/random", (req, res) => {
  const excludedIds = new Set(
    String(req.query.exclude || "")
      .split(",")
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id)),
  );
  const availableLocations = stanfordLocations.filter(
    (location) => !excludedIds.has(location.id),
  );

  if (availableLocations.length === 0) {
    return res.status(409).json({ error: "No unused locations available" });
  }

  const randomIndex = Math.floor(Math.random() * availableLocations.length);
  const location = availableLocations[randomIndex];
  res.json(location);
});

app.get("/api/config/maps", (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: "GOOGLE_MAPS_API_KEY is not configured" });
    return;
  }

  res.json({ apiKey });
});

// ==========================================
// DB CALLS
// ==========================================

// Retrieving global stats
app.get("/api/leaderboard/:limit", (req, res) => {
  const limit = Number(req.params.limit);
  const leaders = getGlobalTopScores(limit);

  if (!leaders) {
    return res.status(404).json({ error: `Limit with ${limit} caused error` });
  }

  res.json(leaders);
});

app.get("/api/leaderboard/rank/:score", (req, res) => {
  const score = Number(req.params.score);

  if (!Number.isFinite(score)) {
    return res.status(400).json({ error: "Score must be a number" });
  }

  res.json({ rank: getScoreRank(score) });
});

// Retrieving personal stats
app.get("/api/users/:userid/scores/:limit", (req, res) => {
  const userid = Number(req.params.userid);
  const limit = Number(req.params.limit);
  const topScores = getUserTopScores(userid, limit);

  if (!topScores) {
    return res
      .status(404)
      .json({ error: `User with id ${userid} and limit ${limit} not found` });
  }

  res.json(topScores);
});

// Adding game data
app.post("/api/end-game", (req, res) => {
  const { score, userid } = req.body;

  if (score === undefined || userid === undefined) {
    return res
      .status(400)
      .json({ error: "Missing required fields: score, userid" });
  }

  const newGame = addGameScore(score, userid);
  res.status(201).json(newGame);
});

// Adding user data
app.post("/api/users", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Missing required fields: name" });
  }

  const newUser = addUser(name);
  res.status(201).json(newUser);
});

// Creating a user's account
app.post("/api/signup", (req, res) => {
  const name = req.body.name?.trim();

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const newUser = createUser(name);

  if (!newUser) {
    return res.status(409).json({ error: "Name already taken" });
  }

  res.status(201).json(newUser);
});

// Logging into a user's account
app.post("/api/login", (req, res) => {
  const name = req.body.name?.trim();

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const user = getUserByName(name);

  if (!user) {
    return res.status(404).json({ error: "No user with that name" });
  }

  res.json(user);
});

app.listen(PORT, () => {
  console.log(`StanGuessr backend running on http://localhost:${PORT}`);
});

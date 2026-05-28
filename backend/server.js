import express from "express";
import cors from "cors";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { addUser, addGameScore, getGlobalTopScores, getUserTopScores, getUserByName, createUser } from "./db.js";


const app = express();
const PORT = 3001;

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
  { lat: 37.4268, lng: -122.1692, name: "Main Quad" },
  { lat: 37.4267, lng: -122.1672, name: "Hoover Tower" },
  { lat: 37.43, lng: -122.17, name: "The Oval" },
  { lat: 37.432, lng: -122.175, name: "Palm Drive" },
  { lat: 37.4244, lng: -122.1708, name: "White Plaza" }, 
  { lat: 37.4245, lng: -122.1657, name: "Engineering Quad" },
  { lat: 37.4265, lng: -122.1675, name: "Green Library" }, 
  { lat: 37.4322, lng: -122.1711, name: "Cantor Arts Center" },
];

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "StanGuessr API is running" });
});

app.get("/api/location/random", (req, res) => {
  // next step: make sure there aren't repeat locations in same game
  const randomIndex = Math.floor(Math.random() * stanfordLocations.length);
  const location = stanfordLocations[randomIndex];
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
    return res.status(404).json({ error: `Limit with ${limit} caused error`})
  }

  res.json(leaders);
});

// Retrieving personal stats
app.get("/api/users/:userid/scores/:limit", (req, res) => {
  const userid = Number(req.params.userid);
  const limit = Number(req.params.limit);
  const topScores = getUserTopScores(userid, limit);

  if (!topScores) {
    return res.status(404).json({ error: `User with id ${userid} and limit ${limit} not found` });
  }

  res.json(topScores);
});

// Adding game data
app.post("/api/end-game", (req,res) => {
  const { score, userid } = req.body;

  if (!score || !userid) {
    return res.status(400).json({ error: "Missing required fields: score, userid" });
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

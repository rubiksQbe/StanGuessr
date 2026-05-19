const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

loadEnvFile(path.join(__dirname, '.env'));

app.use(cors());

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

const stanfordLocations = [
  { lat: 37.4268, lng: -122.1692 }, // Main Quad
  { lat: 37.4267, lng: -122.1672 }, // Hoover Tower
  { lat: 37.4300, lng: -122.1700 }, // The Oval
  { lat: 37.4320, lng: -122.1750 }, // Palm Drive
  { lat: 37.4244, lng: -122.1708 }, // White Plaza
  { lat: 37.4245, lng: -122.1657 }, // Engineering Quad
  { lat: 37.4265, lng: -122.1675 }, // Green Library
  { lat: 37.4322, lng: -122.1711 }, // Cantor Arts Center
];

app.get('/api/location/random', (req, res) => {
  const randomIndex = Math.floor(Math.random() * stanfordLocations.length);
  const location = stanfordLocations[randomIndex];
  res.json(location);
});

app.get('/api/config/maps', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY is not configured' });
    return;
  }

  res.json({ apiKey });
});

app.listen(PORT, () => {
  console.log(`StanGuessr backend running on http://localhost:${PORT}`);
});

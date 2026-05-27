const BASE_API_URL = "http://localhost:3001/api";

const homeScreen = document.querySelector("main");
const endScreen = document.querySelector("#end-screen");
const loadingScreen = document.getElementById("loading-screen");
const gameView = document.getElementById("game-view");
const resultsView = document.getElementById("results-view");
const guessMapPanel = document.getElementById("guess-map-panel");
const guessButton = document.getElementById("guess-button");

const tracker = document.getElementById("round-tracker");

const STANFORD_CENTER = { lat: 37.4275, lng: -122.1697 };
const MAX_POINTS = 5000;
const DECAY_CONSTANT = 300;

let guessMap;
let guessMarker;
let currentLocation;
let googleMapsPromise;
let resultsMap;
let userId = 1;
let userName = "Alice";  // TODO: signin updates

/* Round tracking. */
const TOTAL_ROUNDS = 5;
let currentRound = 1;
let roundScores = [null, null, null, null, null]; // 5 rounds
let roundDistances = [null, null, null, null, null]

// ==========================================
// GAME FUNCTIONS
// ==========================================

function startGame() {
  resetGame();
  startRound();
}

function showGame() {
  loadingScreen.classList.add("hidden");
  gameView.classList.remove("hidden");
}

async function startRound() {
  showLoading();

  try {
    const response = await fetch(BASE_API_URL + "/location/random");
    const location = await response.json();
    currentLocation = location;

    showGame();
    showRoundTracker();
    updateRoundTracker();
    await loadGoogleMaps();
    initStreetView(location.lat, location.lng);
    initGuessMap();
    resetGuess();
  } catch (error) {
    console.error("Failed to start round:", error);
    alert("Failed to load location. Please try again.");
    location.reload();
  }
}

function endGame() {
  const totalScore = roundScores.reduce((sum, score) => sum + (score || 0), 0,);
  // Write score to db
  // addGame(totalScore, userId);

  // update page
  document.querySelector("#final-score").textContent = "Score: " + totalScore;
  const sum_list = document.querySelector("#round-summary")
  sum_list.textContent = "";
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    let li = document.createElement("li");
    // Round 1: 4000 pts (500 ft)
    li.textContent = `Round ${i + 1}: ${roundScores[i]} pts (${roundDistances[i]} ft)`;
    sum_list.appendChild(li);
  }
  
  // Display end card
  hideRoundTracker();
  endScreen.classList.remove("hidden");
}

// Play again button in end screen card
document.querySelector("#play-again-btn").addEventListener("click", ()=> {
  hideResults();
  endScreen.classList.add("hidden");
  startGame();
})

/* Add game to database. */
function addGame(finalScore, user) {
  
  fetch(BASE_API_URL + "/end-game", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ userid: user, score: finalScore })
  })
  .then(response => response.json())
  .then(data => {
    console.log("Successfully added game:", data);
  })
  .catch(error => console.log(error));
}

/* Add user to database. */
function addUser(userName) {
  let newUser = fetch(BASE_API_URL + "/users", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name: userName }) 
  })
    .then(response => response.json())
    .then(data => {
      user = data.userid;
      userName = data.name;
      console.log("Successfully added user:", data);
    })
    .catch(error => console.log(error));
}

function showLoading() {
  homeScreen.classList.add("hidden");
  document.querySelector("header").classList.add("hidden");
  document.querySelector("footer").classList.add("hidden");
  document.getElementById("leaderboard").classList.add("hidden");
  loadingScreen.classList.remove("hidden");
}

function resetGame() {
  currentRound = 1;
  roundScores = [null, null, null, null, null];
  updateRoundTracker();
}

// ==========================================
// IN GAME ROUND TRACKER
// ==========================================

function updateRoundTracker() {
  const roundItems = tracker.querySelectorAll(".round-item[data-round]");

  roundItems.forEach((item, index) => {
    const roundNum = index + 1;
    const scoreEl = item.querySelector(".round-score");

    // Remove all state classes
    item.classList.remove("current", "completed");

    if (roundScores[index] !== null) {
      // Round completed
      item.classList.add("completed");
      scoreEl.textContent = roundScores[index].toLocaleString();
    } else if (roundNum === currentRound) {
      // Current round
      item.classList.add("current");
      scoreEl.textContent = "-";
    } else {
      scoreEl.textContent = "-";
    }
  });

  // Update total
  const totalScore = roundScores.reduce((sum, score) => sum + (score || 0), 0);
  tracker.querySelector(".round-item.total .round-score").textContent =
    totalScore.toLocaleString();
}

function showRoundTracker() {
  document.getElementById("round-tracker").classList.remove("hidden");
}

function hideRoundTracker() {
  document.getElementById("round-tracker").classList.add("hidden");
}

// ==========================================
// GUESS RESULTS
// ==========================================

function showResults(guessPosition, actualPosition, score, distanceMeters) {
  const distanceElement = resultsView.querySelector(".results-distance-value");
  const scoreElement = resultsView.querySelector(".results-score-value");

  // Record score for current round
  roundScores[currentRound - 1] = score;
  updateRoundTracker();

  // Update footer values
  distanceElement.textContent = formatDistance(distanceMeters);
  scoreElement.textContent = score.toLocaleString();

  // Hide game view, show results view
  gameView.classList.add("hidden");
  resultsView.classList.remove("hidden");

  // Initialize results map
  // I used AI to help me figure out how to use the google maps API
  resultsMap = new google.maps.Map(document.getElementById("results-map"), {
    center: STANFORD_CENTER,
    zoom: 16,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
    clickableIcons: false,
  });

  // Add guess marker (cardinal red pin)
  new google.maps.Marker({
    position: guessPosition,
    map: resultsMap,
    title: "Your guess",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#8C1515",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 3,
    },
  });

  // Add actual location marker (green pin)
  new google.maps.Marker({
    position: actualPosition,
    map: resultsMap,
    title: "Actual location",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#51cf66",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 3,
    },
  });

  // Draw dotted line between guess and actual location
  new google.maps.Polyline({
    path: [guessPosition, actualPosition],
    map: resultsMap,
    strokeColor: "#333333",
    strokeOpacity: 0,
    icons: [
      {
        icon: {
          path: "M 0,-1 0,1",
          strokeOpacity: 0.8,
          strokeWeight: 3,
          scale: 3,
        },
        offset: "0",
        repeat: "15px",
      },
    ],
  });

  // Fit map to show both markers
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(guessPosition);
  bounds.extend(actualPosition);
  resultsMap.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
}

function hideResults() {
  document.getElementById("results-view").classList.add("hidden");
}

// ==========================================
// GUESSING MAP DISPLAY
// ==========================================

function initStreetView(lat, lng) {
  new google.maps.StreetViewPanorama(document.getElementById("street-view"), {
    position: { lat, lng },
    pov: { heading: 0, pitch: 0 },
    zoom: 1,
    addressControl: false,
    showRoadLabels: false,
    clickToGo: false,
    linksControl: false,
    panControl: true,
    zoomControl: true,
    fullscreenControl: false,
  });
}

async function loadGoogleMaps() {
  if (window.google?.maps) {
    return;
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = fetch(BASE_API_URL + "/config/maps")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Google Maps API key is not configured.");
      }

      return response.json();
    })
    .then(
      ({ apiKey }) =>
        new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
          script.async = true;
          script.defer = true;
          script.onload = resolve;
          script.onerror = () =>
            reject(new Error("Failed to load Google Maps."));
          document.head.appendChild(script);
        }),
    );

  return googleMapsPromise;
}

function initGuessMap() {
  if (guessMap) {
    google.maps.event.trigger(guessMap, "resize");
    guessMap.setCenter(STANFORD_CENTER);
    return;
  }

  guessMap = new google.maps.Map(document.getElementById("guess-map"), {
    center: STANFORD_CENTER,
    zoom: 16,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
    clickableIcons: false,
    gestureHandling: "greedy",
  });

  guessMap.addListener("click", (event) => {
    placeGuess(event.latLng);
  });
}

function placeGuess(position) {
  if (!guessMarker) {
    guessMarker = new google.maps.Marker({
      map: guessMap,
      draggable: true,
      title: "Your guess",
    });
  }

  guessMarker.setPosition(position);
  guessMapPanel.classList.remove("is-open");
  guessMapPanel.classList.add("has-pin");
  guessButton.textContent = "Guess";
}

function resetGuess() {
  if (guessMarker) {
    guessMarker.setMap(null);
    guessMarker = null;
  }

  guessMapPanel.classList.remove("is-open");
  guessMapPanel.classList.remove("has-pin");
  guessButton.textContent = "Place your pin on the map";
}

function resizeGuessMap() {
  if (!guessMap) {
    return;
  }

  window.setTimeout(() => {
    google.maps.event.trigger(guessMap, "resize");
  }, 220);
}

function collapseGuessMap() {
  guessMapPanel.classList.remove("is-open");
}

// ==========================================
// SCORING
// ==========================================

/* Calculate distance between two points using Haversine formula
   (I Used AI for this function apparently its a good one for this kinda thing) */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => deg * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate score based on distance from target
 */
function calculateScore(distanceMeters) {
  const score = MAX_POINTS * Math.exp(-distanceMeters / DECAY_CONSTANT);
  return Math.round(score);
}

function formatDistance(meters) {
  const feet = meters * 3.28084;
  const miles = meters / 1609.344;

  // Record distance for current round
  roundDistances[currentRound - 1] = Math.round(feet);

  if (miles < 0.1) {
    return `${Math.round(feet)} ft`;
  } else {
    return `${miles.toFixed(2)} mi`;
  }
}

// ==========================================
// MAIN PAGE
// ==========================================

const leadboardBtn = document.querySelector(".leaderboard-bar");
const leaderboard = document.querySelector("#leaderboard");
const globalStats = document.querySelector("#global-stats");
const personalStats = document.querySelector("#personal-stats");
const signMsg = document.querySelector("#signin-msg");
const limit = 5;
let isAtTop = true;

leadboardBtn.addEventListener("click", toggleLeadboard);

/* Raise and lower leaderboard on main page. */ 
function toggleLeadboard() {
  if (isAtTop) {
    leaderboard.scrollIntoView({behavior: 'smooth'});
    leadboardBtn.textContent = "Leaderboard ↓";
    isAtTop = false;
  } else {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    leadboardBtn.textContent = "Leaderboard ↑";
    isAtTop = true;
  }
}

/* Populate leaderboard stats. */ 
function pullGlobalStats() {
  fetch(BASE_API_URL + `/leaderboard/${limit}`)
    .then(response => response.json())
    .then(data => {
      globalStats.replaceChildren();
      data.forEach((entry, i) => {
        let li = document.createElement("li");
        li.textContent = `${data[i].name} - ${data[i].score} pts`
        globalStats.appendChild(li);
      });
    })
    .catch(error => console.log(error));
}

/* Populate personal stats. */ 
function pullPersonalStats() {
  personalStats.replaceChildren();
  // not signed in.
  if (userId < 1) {
    return;
  }

  fetch(BASE_API_URL + `/users/${userId}/scores/${limit}`)
    .then(response => response.json())
    .then(data => {
      data.forEach((entry, i) => {
        let li = document.createElement("li");
        li.textContent = `${userName} - ${data[i].score} pts`
        personalStats.appendChild(li);
      });
      signMsg.remove();
    })
    .catch(error => console.log(error));
}

/* Game logic. */
document.addEventListener("DOMContentLoaded", () => {
  const playButton = document.querySelector(".play-button");
  pullPersonalStats();  // for leaderboard
  pullGlobalStats();
  playButton.addEventListener("click", startGame);
  guessMapPanel.addEventListener("mouseenter", resizeGuessMap);
  guessMapPanel.addEventListener("focusin", resizeGuessMap);
  guessButton.addEventListener("click", () => {
    if (!guessMarker) {
      guessMapPanel.classList.add("is-open");
      resizeGuessMap();
      return;
    }

    const guessPosition = guessMarker.getPosition();
    const actualPosition = {
      lat: currentLocation.lat,
      lng: currentLocation.lng,
    };

    const distance = calculateDistance(
      guessPosition.lat(),
      guessPosition.lng(),
      currentLocation.lat,
      currentLocation.lng,
    );
    const score = calculateScore(distance);

    console.log("Guess submitted:", {
      guess: { lat: guessPosition.lat(), lng: guessPosition.lng() },
      answer: currentLocation,
      distance: distance,
      score: score,
    });

    showResults(guessPosition, actualPosition, score, distance);
  });

  /* Results page next button */
  document
    .querySelector(".results-next-button")
    .addEventListener("click", () => {

      if (currentRound < TOTAL_ROUNDS) {
        // Advance to next round
        hideResults();
        currentRound++;
        startRound();
      } else {
        // Game over - start new game
        // TODO: display end game summary
        endGame();
        //alert("Total Score: " + totalScore + "\nPlay Again?");
        //startGame();
      }
    });

  document.addEventListener("click", (event) => {
    if (!guessMapPanel.contains(event.target)) {
      collapseGuessMap();
    }
  });
});

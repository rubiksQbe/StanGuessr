const API_URL = 'http://localhost:3001/api/location/random';
const MAPS_CONFIG_URL = 'http://localhost:3001/api/config/maps';

const homeScreen = document.querySelector('main');
const loadingScreen = document.getElementById('loading-screen');
const gameView = document.getElementById('game-view');
const guessMapPanel = document.getElementById('guess-map-panel');
const guessButton = document.getElementById('guess-button');

const STANFORD_CENTER = { lat: 37.4275, lng: -122.1697 };
let guessMap;
let guessMarker;
let currentLocation;
let googleMapsPromise;

function showLoading() {
  homeScreen.classList.add('hidden');
  document.querySelector('header').classList.add('hidden');
  document.querySelector('footer').classList.add('hidden');
  document.getElementById('leaderboard').classList.add('hidden');
  loadingScreen.classList.remove('hidden');
}

function showGame() {
  loadingScreen.classList.add('hidden');
  gameView.classList.remove('hidden');
}

function initStreetView(lat, lng) {
  new google.maps.StreetViewPanorama(
    document.getElementById('street-view'),
    {
      position: { lat, lng },
      pov: { heading: 0, pitch: 0 },
      zoom: 1,
      addressControl: false,
      showRoadLabels: false,
      clickToGo: false,
      linksControl: false,
      panControl: true,
      zoomControl: true,
      fullscreenControl: false
    }
  );
}

async function loadGoogleMaps() {
  if (window.google?.maps) {
    return;
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = fetch(MAPS_CONFIG_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Google Maps API key is not configured.');
      }

      return response.json();
    })
    .then(({ apiKey }) => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Google Maps.'));
      document.head.appendChild(script);
    }));

  return googleMapsPromise;
}

function initGuessMap() {
  if (guessMap) {
    google.maps.event.trigger(guessMap, 'resize');
    guessMap.setCenter(STANFORD_CENTER);
    return;
  }

  guessMap = new google.maps.Map(document.getElementById('guess-map'), {
    center: STANFORD_CENTER,
    zoom: 16,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
    clickableIcons: false,
    gestureHandling: 'greedy'
  });

  guessMap.addListener('click', (event) => {
    placeGuess(event.latLng);
  });
}

function placeGuess(position) {
  if (!guessMarker) {
    guessMarker = new google.maps.Marker({
      map: guessMap,
      draggable: true,
      title: 'Your guess'
    });
  }

  guessMarker.setPosition(position);
  guessMapPanel.classList.remove('is-open');
  guessMapPanel.classList.add('has-pin');
  guessButton.textContent = 'Guess';
}

function resetGuess() {
  if (guessMarker) {
    guessMarker.setMap(null);
    guessMarker = null;
  }

  guessMapPanel.classList.remove('is-open');
  guessMapPanel.classList.remove('has-pin');
  guessButton.textContent = 'Place your pin on the map';
}

function resizeGuessMap() {
  if (!guessMap) {
    return;
  }

  window.setTimeout(() => {
    google.maps.event.trigger(guessMap, 'resize');
  }, 220);
}

function collapseGuessMap() {
  guessMapPanel.classList.remove('is-open');
}

async function startGame() {
  showLoading();

  try {
    const response = await fetch(API_URL);
    const location = await response.json();
    currentLocation = location;

    showGame();
    await loadGoogleMaps();
    initStreetView(location.lat, location.lng);
    initGuessMap();
    resetGuess();
  } catch (error) {
    console.error('Failed to start game:', error);
    alert('Failed to load location. Please try again.');
    location.reload();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const playButton = document.querySelector('.play-button');
  playButton.addEventListener('click', startGame);
  guessMapPanel.addEventListener('mouseenter', resizeGuessMap);
  guessMapPanel.addEventListener('focusin', resizeGuessMap);
  guessButton.addEventListener('click', () => {
    if (!guessMarker) {
      guessMapPanel.classList.add('is-open');
      resizeGuessMap();
      return;
    }

    const guess = guessMarker.getPosition();
    console.log('Guess submitted:', {
      guess: { lat: guess.lat(), lng: guess.lng() },
      answer: currentLocation
    });
  });
  document.addEventListener('click', (event) => {
    if (!guessMapPanel.contains(event.target)) {
      collapseGuessMap();
    }
  });
});

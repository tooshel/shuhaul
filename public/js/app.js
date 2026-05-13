/**
 * SHU-HAUL — Frontend Application
 *
 * Screens:
 *   screen-map        → Map with "Where to?" input
 *   sheet-overlay     → Bottom sheet: tier + name selection
 *   screen-connecting → Orange loading state
 *   screen-ride       → Active ride with the ETA gag
 */

'use strict';

const App = {
  /* ---- State -------------------------------------------- */
  map:            null,
  userMarker:     null,
  fakeDrivers:    [],
  driverInterval: null,

  selectedTier:    null,
  userLocation:    null,   // { lat, lng, address? }
  destinationText: '',

  etaInterval: null,
  etaElapsed:  0,

  /* ---- Fallback location: Shoreline Amphitheatre, Mountain View, CA ---- */
  DEFAULT_LAT: 37.42750,
  DEFAULT_LNG: -122.08050,

  /* ===========================================================
     INIT
     =========================================================== */
  init() {
    this.initMap();
    this.bindEvents();
    this.requestGeolocation();
  },

  /* ===========================================================
     MAP
     =========================================================== */
  initMap() {
    this.map = L.map('map', {
      zoomControl:       false,
      attributionControl: false,
      dragging:          true,
      scrollWheelZoom:   true,
      doubleClickZoom:   true,
      touchZoom:         true,
    }).setView([this.DEFAULT_LAT, this.DEFAULT_LNG], 13);

    // CartoDB Voyager: clean, colourful, no API key needed
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
      }
    ).addTo(this.map);

    // Spawn fake drivers around the default location while we wait for geoloc
    this.spawnFakeDrivers([this.DEFAULT_LAT, this.DEFAULT_LNG]);
  },

  requestGeolocation() {
    if (!('geolocation' in navigator)) {
      this.userLocation = { lat: this.DEFAULT_LAT, lng: this.DEFAULT_LNG };
      this.addUserMarker([this.DEFAULT_LAT, this.DEFAULT_LNG]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.userLocation = { lat, lng };
        this.map.flyTo([lat, lng], 13, { duration: 1.5 });
        this.addUserMarker([lat, lng]);
        this.repositionFakeDrivers([lat, lng]);

        // Optionally reverse-geocode to get a human-readable address
        this.reverseGeocode(lat, lng);
      },
      (_err) => {
        // Geolocation denied or unavailable — silently fall back
        console.info('Geolocation unavailable, using default location.');
        this.userLocation = { lat: this.DEFAULT_LAT, lng: this.DEFAULT_LNG };
        this.addUserMarker([this.DEFAULT_LAT, this.DEFAULT_LNG]);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  },

  /**
   * Reverse-geocode via Nominatim (free, no API key).
   * Only used to improve the SMS pickup string.
   */
  async reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.display_name) {
        this.userLocation.address = data.display_name;
      }
    } catch {
      // Non-critical — just skip
    }
  },

  /* ---- User location marker (pulsing orange dot) --------- */
  addUserMarker(latlng) {
    const icon = L.divIcon({
      className:  '',
      html:       '<div class="user-marker"><div class="user-marker-pulse"></div><div class="user-marker-dot"></div></div>',
      iconSize:   [40, 40],
      iconAnchor: [20, 20],
    });

    if (this.userMarker) {
      this.userMarker.setLatLng(latlng);
    } else {
      this.userMarker = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(this.map);
    }
  },

  /* ---- Fake driver markers that roam around the area ------ */
  spawnFakeDrivers(center) {
    const icon = L.divIcon({
      className:  '',
      html:       '<span class="truck-marker">🛻</span>',
      iconSize:   [40, 40],
      iconAnchor: [20, 20],
    });

    // Each fake driver gets a home position, orbital speed, and radius
    const configs = [
      { offsetLat:  0.008, offsetLng:  0.012, speed: 0.018, radius: 0.006 },
      { offsetLat: -0.010, offsetLng:  0.005, speed: 0.025, radius: 0.008 },
      { offsetLat:  0.003, offsetLng: -0.014, speed: 0.015, radius: 0.010 },
      { offsetLat: -0.006, offsetLng: -0.009, speed: 0.022, radius: 0.007 },
    ];

    configs.forEach((cfg, i) => {
      const homeLat = center[0] + cfg.offsetLat;
      const homeLng = center[1] + cfg.offsetLng;
      const marker  = L.marker([homeLat, homeLng], { icon, zIndexOffset: 500 }).addTo(this.map);

      this.fakeDrivers.push({
        marker,
        homeLat,
        homeLng,
        speed:  cfg.speed,
        radius: cfg.radius,
        phase:  (i / configs.length) * Math.PI * 2,  // stagger phase so they don't clump
      });
    });

    this.startDriverAnimation();
  },

  repositionFakeDrivers(center) {
    const offsets = [
      [  0.008,  0.012 ],
      [ -0.010,  0.005 ],
      [  0.003, -0.014 ],
      [ -0.006, -0.009 ],
    ];

    this.fakeDrivers.forEach((driver, i) => {
      driver.homeLat = center[0] + offsets[i][0];
      driver.homeLng = center[1] + offsets[i][1];
    });
  },

  /**
   * Drivers orbit their home positions — looks like they're driving around
   * the neighbourhood rather than randomly jittering.
   */
  startDriverAnimation() {
    let tick = 0;

    this.driverInterval = setInterval(() => {
      tick++;
      this.fakeDrivers.forEach((driver) => {
        const angle = tick * driver.speed + driver.phase;
        const lat   = driver.homeLat + Math.sin(angle)       * driver.radius;
        // Slightly wider E/W to mimic road grid geometry
        const lng   = driver.homeLng + Math.cos(angle * 0.8) * driver.radius * 1.4;
        driver.marker.setLatLng([lat, lng]);
      });
    }, 1600);
  },

  /* ===========================================================
     UI EVENT BINDING
     =========================================================== */
  bindEvents() {
    /* ---- Where-to input ----------------------------------- */
    const destInput = document.getElementById('destination-input');
    const searchBtn = document.getElementById('btn-where-to');

    const submitDestination = () => {
      const val = destInput.value.trim();
      if (val) this.showTierSheet(val);
    };

    destInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitDestination();
    });

    searchBtn.addEventListener('click', submitDestination);

    /* ---- Quick-select recent destinations ----------------- */
    document.querySelectorAll('.recent-item').forEach((item) => {
      item.addEventListener('click', () => {
        const dest = item.dataset.dest;
        destInput.value = dest;
        this.showTierSheet(dest);
      });
    });

    /* ---- Tier card selection ------------------------------ */
    document.querySelectorAll('.tier-card').forEach((card) => {
      // Both click and keyboard (Enter/Space) for accessibility
      const selectCard = () => {
        document.querySelectorAll('.tier-card').forEach((c) => {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
        this.selectedTier = card.dataset.tier;
        this.updateConfirmButton();
      };

      card.addEventListener('click', selectCard);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCard();
        }
      });
    });

    /* ---- Rider name input --------------------------------- */
    document.getElementById('rider-name').addEventListener('input', () => {
      this.updateConfirmButton();
    });

    /* ---- Confirm ride button ------------------------------ */
    document.getElementById('btn-confirm-ride').addEventListener('click', () => {
      this.confirmRide();
    });

    /* ---- Close sheet (X button or backdrop tap) ----------- */
    document.getElementById('btn-sheet-close').addEventListener('click', () => {
      this.hideTierSheet();
    });

    document.getElementById('sheet-overlay').addEventListener('click', (e) => {
      // Only dismiss if tapping the dark backdrop, not the sheet itself
      if (e.target === document.getElementById('sheet-overlay')) {
        this.hideTierSheet();
      }
    });
  },

  /* ---- Keep confirm button state in sync with selections -- */
  updateConfirmButton() {
    const btn  = document.getElementById('btn-confirm-ride');
    const name = document.getElementById('rider-name').value.trim();

    if (this.selectedTier && name) {
      btn.disabled    = false;
      btn.textContent = `Request ${this.selectedTier}`;
    } else if (this.selectedTier && !name) {
      btn.disabled    = true;
      btn.textContent = 'Enter your name above';
    } else {
      btn.disabled    = true;
      btn.textContent = 'Select a Shu-Haul';
    }
  },

  /* ===========================================================
     TIER SHEET SHOW / HIDE
     =========================================================== */
  showTierSheet(destination) {
    this.destinationText = destination;
    document.getElementById('sheet-dest-label').textContent = `→ ${destination}`;

    const overlay = document.getElementById('sheet-overlay');
    overlay.classList.add('active');
  },

  hideTierSheet() {
    const overlay = document.getElementById('sheet-overlay');
    overlay.classList.remove('active');
    // Sheet slides back down — no need to wait for it to finish before hiding
  },

  /* ===========================================================
     CONFIRM RIDE → API CALL → SCREENS
     =========================================================== */
  async confirmRide() {
    const name        = document.getElementById('rider-name').value.trim();
    const tier        = this.selectedTier;
    const destination = this.destinationText;
    const pickup      = this.userLocation || { lat: this.DEFAULT_LAT, lng: this.DEFAULT_LNG };

    if (!name || !tier || !destination) return;

    // 1. Transition to connecting screen immediately so the user feels progress
    this.hideTierSheet();
    this.showScreen('screen-connecting');

    // 2. Fire the API call in the background — never block the UX on it
    this.fireRideRequest({ name, pickup, destination, tier });

    // 3. After 2.8s of fake "connecting" drama, show the ride screen
    setTimeout(() => {
      this.showRideScreen({ name, destination, tier, pickup });
    }, 2800);
  },

  /** POST to /api/request-ride — errors are swallowed to protect the gag */
  async fireRideRequest({ name, pickup, destination, tier }) {
    try {
      const res = await fetch('/api/request-ride', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          pickup: {
            lat:     pickup.lat,
            lng:     pickup.lng,
            address: pickup.address || null,
          },
          dropoff: destination,
          tier,
        }),
      });

      if (!res.ok) {
        console.warn('Server responded with', res.status);
      }
    } catch (err) {
      // Network error etc. — gag must go on
      console.error('Ride request failed (silently):', err.message);
    }
  },

  /* ===========================================================
     RIDE SCREEN SETUP
     =========================================================== */
  showRideScreen({ name: _name, destination, tier, pickup }) {
    // Populate trip details
    const pickupStr = pickup.address
      ? pickup.address.split(',').slice(0, 2).join(',')   // trim long Nominatim strings
      : `${pickup.lat.toFixed(4)}° N, ${Math.abs(pickup.lng).toFixed(4)}° W`;

    const tierPoints = { 'Shu-Haul X': 5, 'Shu-Haul Black': 10, 'Shu-Haul Pool': 3 };
    const fp = tierPoints[tier] ?? 5;

    document.getElementById('trip-pickup').textContent        = pickupStr;
    document.getElementById('trip-dropoff').textContent       = destination;
    document.getElementById('tier-badge-display').textContent = tier;
    document.getElementById('fp-badge').textContent           = `${fp} FP`;

    this.showScreen('screen-ride');
    this.startEtaTimer();

    // Stop driver animation once we're in ride screen (cleaner UX)
    if (this.driverInterval) {
      clearInterval(this.driverInterval);
      this.driverInterval = null;
    }
  },

  /* ===========================================================
     THE ETA GAG
     Updates the ETA message at key elapsed-second milestones.
     =========================================================== */
  startEtaTimer() {
    // Clear any previous timer (e.g. if user somehow requests again)
    if (this.etaInterval) clearInterval(this.etaInterval);

    const messages = [
      { at:  0, text: "Sheldon is completing a trip nearby. Arriving in 5 minutes." },
      { at: 15, text: "Traffic is heavy. Arriving in 10 minutes." },
      { at: 30, text: "Sheldon missed a turn. Arriving in 30 minutes." },
      { at: 45, text: "Sheldon is stopping for coffee. Arriving in 45 minutes." },
      { at: 60, text: "Arriving... eventually. Just keep waiting." },
    ];

    this.etaElapsed = 0;
    let msgIndex    = 0;
    const etaEl     = document.getElementById('eta-message');

    // Set the initial message
    etaEl.textContent = messages[0].text;

    this.etaInterval = setInterval(() => {
      this.etaElapsed++;

      const next = messages[msgIndex + 1];

      // Check if it's time to advance to the next message
      if (next && this.etaElapsed >= next.at) {
        msgIndex++;

        // Fade out → update text → fade in
        etaEl.classList.add('updating');

        setTimeout(() => {
          etaEl.textContent = messages[msgIndex].text;
          etaEl.classList.remove('updating');
        }, 380);  // matches CSS opacity transition duration
      }
    }, 1000);
  },

  /* ===========================================================
     SCREEN TRANSITIONS
     =========================================================== */
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((s) => {
      s.classList.remove('active');
      s.classList.add('hidden');
    });

    const target = document.getElementById(screenId);
    if (!target) return;

    // Remove hidden first, then let the browser paint, then add active
    // This ensures the CSS transition fires properly.
    target.classList.remove('hidden');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.classList.add('active');
      });
    });
  },
};

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => App.init());

/* Bassline Bay. Festival site on a real map of the Montego Bay waterfront. */
(function () {
  "use strict";

  var el = document.getElementById("venue-map");
  if (!el) return;
  var fig = el.closest(".map");
  var status = document.getElementById("map-status");
  function say(t) { if (status) status.textContent = t; }

  function fail() { fig.classList.remove("has-map"); fig.classList.add("no-map"); }

  function start() {
    if (!window.L || !L.map) { fail(); return; }
    try { build(); } catch (err) { fail(); if (window.console) console.error(err); }
  }

  function build() {
    fig.classList.add("has-map");

    /* positions are approximate, along the shore between Walter Fletcher Beach and Pier 1 */
    var GATE = [18.4741, -77.9213];
    var POINTS = [
      { k: "A", name: "Main gate", note: "Wristband exchange, lockers and the shuttle drop on Gloucester Avenue.", at: GATE },
      { k: "B", name: "Sunset Stage", note: "The main stage, right on the sand and facing the sunset.", at: [18.4737, -77.9229] },
      { k: "C", name: "Reef Stage", note: "Closest to the water. Lifeguards in front until 8 PM.", at: [18.4752, -77.9231] },
      { k: "D", name: "Yard Stage", note: "Sound system culture under the almond trees.", at: [18.4726, -77.9219] },
      { k: "E", name: "Food village", note: "Jerk, fish, ital and a proper coffee bar.", at: [18.4732, -77.9213] },
      { k: "F", name: "Cabana row", note: "Waterline cabanas and the VIP deck.", at: [18.4761, -77.9235] },
      { k: "G", name: "Water taxi drop off", note: "Boats from the hotels along the bay land at the Pier 1 jetty.", at: [18.4718, -77.9231] },
      { k: "H", name: "First aid", note: "Medics on site from gates until close. Ask any steward.", at: [18.4746, -77.9217] }
    ];

    var map = L.map(el, {
      center: [18.4738, -77.9224], zoom: 17, minZoom: 13, maxZoom: 19,
      scrollWheelZoom: false, zoomControl: false, attributionControl: false
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);

    var street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: "bb-tiles", attribution: "OpenStreetMap"
    }).addTo(map);
    var sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, className: "bb-sat", attribution: "Esri"
    });

    var viewBtn = fig.querySelector('[data-map="view"]');
    if (viewBtn) viewBtn.addEventListener("click", function () {
      var toSat = map.hasLayer(street);
      if (toSat) { map.removeLayer(street); sat.addTo(map); } else { map.removeLayer(sat); street.addTo(map); }
      viewBtn.textContent = toSat ? "Street view" : "Satellite view";
      viewBtn.setAttribute("aria-pressed", String(toSat));
      fig.classList.toggle("is-sat", toSat);
    });

    /* rough festival footprint */
    L.polygon([[18.4766, -77.9240], [18.4766, -77.9228], [18.4748, -77.9211], [18.4722, -77.9208], [18.4713, -77.9236], [18.4740, -77.9238]], {
      color: "#FF5A1F", weight: 1.5, dashArray: "2 6", fill: true, fillColor: "#FF5A1F", fillOpacity: 0.06, interactive: false
    }).addTo(map);

    function icon(k) {
      return L.divIcon({ className: "bb-pin", html: "<span>" + k + "</span>", iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18] });
    }
    function walk(a, b) { return Math.max(1, Math.round(map.distance(a, b) / 75)); }
    function popup(p) {
      var html = '<div class="bb-pop"><h3>' + p.k + ". " + p.name + "</h3><p>" + p.note + "</p>";
      if (p.k === "A") html += '<p><a href="https://www.google.com/maps/dir/?api=1&amp;destination=' + GATE.join(",") + '&amp;travelmode=driving" target="_blank" rel="noopener">Directions in Google Maps</a></p>';
      else html += '<p class="bb-walk">About ' + walk(GATE, p.at) + " min walk from the main gate</p>";
      return html + "</div>";
    }

    var markers = {};
    var rows = Array.prototype.slice.call(document.querySelectorAll(".legend .pt"));
    function setActive(k) {
      rows.forEach(function (r) {
        var on = r.dataset.pt === k;
        r.classList.toggle("on", on);
        r.setAttribute("aria-pressed", String(on));
      });
      Object.keys(markers).forEach(function (key) {
        var n = markers[key].getElement(); if (n) n.classList.toggle("on", key === k);
      });
    }
    POINTS.forEach(function (p) {
      var m = L.marker(p.at, { icon: icon(p.k), title: p.name, alt: p.name, keyboard: true, riseOnHover: true })
        .bindPopup(popup(p), { className: "bb-popup", maxWidth: 260, closeButton: true })
        .addTo(map);
      m.on("click", function () { setActive(p.k); });
      m.on("popupclose", function () { setActive(null); });
      markers[p.k] = m;
    });

    rows.forEach(function (r) {
      r.addEventListener("click", function () {
        var m = markers[r.dataset.pt]; if (!m) return;
        setActive(r.dataset.pt);
        map.flyTo(m.getLatLng(), 18, { duration: 0.6 });
        setTimeout(function () { m.openPopup(); }, 650);
        if (window.innerWidth < 900) el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    var grounds = L.latLngBounds(POINTS.map(function (p) { return p.at; })).pad(0.2);
    map.fitBounds(grounds);

    var allBtn = fig.querySelector('[data-map="all"]');
    if (allBtn) allBtn.addEventListener("click", function () {
      map.closePopup(); setActive(null);
      map.flyToBounds(grounds, { duration: 0.6 });
    });

    /* zoom with the wheel only after the map is clicked, so the page still scrolls */
    var hinted = false;
    el.addEventListener("wheel", function () {
      if (!map.scrollWheelZoom.enabled() && !hinted) { hinted = true; say("Click the map to zoom with your scroll wheel."); }
    }, { passive: true });
    map.on("click focus", function () { map.scrollWheelZoom.enable(); say(""); });
    el.addEventListener("mouseleave", function () { map.scrollWheelZoom.disable(); hinted = false; });

    /* the map sits in a lazy area of the page, so recheck its size once it is in view */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en, obs) {
        if (en[0].isIntersecting) { map.invalidateSize(); map.fitBounds(grounds); obs.disconnect(); }
      }).observe(el);
    }
  }

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();

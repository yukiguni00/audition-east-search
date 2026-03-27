let favoritesOnlyMode = false;
const FAVORITE_KEY = "favoritePerformers";
let events = [];

function formatDisplayDate(ev) {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const dateObj = new Date(ev.date);
  const weekday = weekdays[dateObj.getDay()];
  return `${ev.month}月${ev.day}日(${weekday}) 開演${ev.time}`;
}

function normalizeText(text) {
  return (text || "").trim().replace(/\s+/g, " ").normalize("NFKC").toLowerCase();
}

function getFavorites() {
  return JSON.parse(localStorage.getItem(favoritePerformers) || "[]");
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITE_KEY, JSON.stringify(favorites));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function toggleFavorite(name) {
  const favorites = getFavorites();
  const key = normalizeText(name);
  const idx = favorites.indexOf(key);
  if (idx >= 0) {
    favorites.splice(idx, 1);
  } else {
    favorites.push(key);
  }
  saveFavorites(favorites);
  runSearch();
}

function populateSelects() {
  const monthSelect = document.getElementById("month");
  const daySelect = document.getElementById("day");
  const hourSelect = document.getElementById("hour");

  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement("option");
    opt.value = String(m);
    opt.textContent = `${m}月`;
    monthSelect.appendChild(opt);
  }
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = String(d);
    opt.textContent = `${d}日`;
    daySelect.appendChild(opt);
  }
  for (let h = 10; h <= 20; h++) {
    const opt = document.createElement("option");
    opt.value = String(h);
    opt.textContent = `${h}時以降`;
    hourSelect.appendChild(opt);
  }
}

function getCurrentFilters() {
  return {
    nameQuery: normalizeText(document.getElementById("nameQuery").value),
    eventType: document.getElementById("eventType").value,
    month: document.getElementById("month").value,
    day: document.getElementById("day").value,
    hour: document.getElementById("hour").value,
  };
}

function getFavoritePerformersSet() {
  try {
    const raw = localStorage.getItem("FAVORITE_KEY");
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch (e) {
    return new Set();
  }
}

function eventHasFavorite(ev) {
  const favorites = getFavoritePerformersSet();
  if (!favorites.size || !Array.isArray(ev.performers)) return false;
  return ev.performers.some(name => favorites.has(normalizeText(name)));
}

function updateFavoritesOnlyButton() {
  const btn = document.getElementById("favoritesOnlyBtn");
  if (!btn) return;
  btn.setAttribute("aria-pressed", favoritesOnlyMode ? "true" : "false");
  btn.classList.toggle("is-active", favoritesOnlyMode);
}

function clearFilters() {
  document.getElementById("nameQuery").value = "";
  document.getElementById("eventType").value = "all";
  document.getElementById("month").value = "all";
  document.getElementById("day").value = "all";
  document.getElementById("hour").value = "all";
  favoritesOnlyMode = false;
  updateFavoritesOnlyButton();
  runSearch();
}

function filterEvents(list, includePast = false) {
  const { nameQuery, eventType, month, day, hour } = getCurrentFilters();
  const today = todayString();

  return list.filter((ev) => {
    if (!includePast && ev.date < today) return false;
    if (includePast && ev.date >= today) return false;
    if (eventType !== "all" && ev.eventType !== eventType) return false;
    if (month !== "all" && ev.month !== Number(month)) return false;
    if (day !== "all" && ev.day !== Number(day)) return false;
    if (hour !== "all" && ev.timeMinutes < Number(hour) * 60) return false;
    if (nameQuery) {
      const hit = ev.performers.some((name) => normalizeText(name).includes(nameQuery));
      if (!hit) return false;
    }
    if (favoritesOnlyMode && !eventHasFavorite(ev)) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.timeMinutes - b.timeMinutes);
}

function renderEvents(targetId, list) {
  const target = document.getElementById(targetId);
  const favorites = getFavorites();

  if (!list.length) {
    target.innerHTML = '<p class="empty">表示可能な情報はありません</p>';
    return;
  }

  target.innerHTML = list.map((ev) => {
    const performers = ev.performers.map((name) => {
      const isFavorite = favorites.includes(normalizeText(name));
      return `<span class="performer ${isFavorite ? "favorite" : ""}"><button class="star" data-name="${name}" type="button">${isFavorite ? "★" : "☆"}</button>${name}</span>`;
    }).join("");

    return `
      <article class="result-card">
        <div class="datetime-venue">${formatDisplayDate(ev)} / ${ev.venue}</div>
        <h3>${ev.title}</h3>
        <div class="performers">${performers}</div>
      </article>
    `;
  }).join("");

  target.querySelectorAll(".star").forEach((btn) => {
    btn.addEventListener("click", () => toggleFavorite(btn.dataset.name));
  });
}

function runSearch() {
  renderEvents("results", filterEvents(events, false));
  renderEvents("archiveResults", filterEvents(events, true));
}

function bindAutoSearch() {
  ["nameQuery", "eventType", "month", "day", "hour"].forEach((id) => {
    const el = document.getElementById(id);
    const eventName = id === "nameQuery" ? "input" : "change";
    el.addEventListener(eventName, runSearch);
  });

  document.getElementById("clearBtn").addEventListener("click", clearFilters);
  document.getElementById("favoritesOnlyBtn").addEventListener("click", () => {
    favoritesOnlyMode = !favoritesOnlyMode;
    updateFavoritesOnlyButton();
    runSearch();
  });
  updateFavoritesOnlyButton();
}

function bindFloatingTop() {
  const floatingTopBtn = document.getElementById("floatingTopBtn");
  floatingTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", () => {
    if (window.scrollY > 280) {
      floatingTopBtn.classList.add("show");
    } else {
      floatingTopBtn.classList.remove("show");
    }
  });
}

async function init() {
  populateSelects();
  bindAutoSearch();
  bindFloatingTop();

  const res = await fetch("data/events.json", { cache: "no-store" });
  events = await res.json();
  runSearch();
}

init();

let favoritesOnlyMode = false;
const FAVORITE_KEY = "favoritePerformers";
let events = [];
let archiveOpen = false;

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
  return JSON.parse(localStorage.getItem(FAVORITE_KEY) || "[]");
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

  let isFavorite;

  if (idx >= 0) {
    favorites.splice(idx, 1);
    isFavorite = false;
  } else {
    favorites.push(key);
    isFavorite = true;
  }

  saveFavorites(favorites);

  if (favoritesOnlyMode) {
    runSearch();
  } else {
    updateFavoriteUI(key, isFavorite);
  }
}

function updateFavoriteUI(key, isFavorite) {
  document.querySelectorAll(`.star[data-key="${CSS.escape(key)}"]`).forEach((btn) => {
    btn.textContent = isFavorite ? "★" : "☆";
    const performer = btn.closest(".performer");
    if (performer) {
      performer.classList.toggle("favorite", isFavorite);
    }
  });
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
    const raw = localStorage.getItem(FAVORITE_KEY);
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


function setArchiveOpen(isOpen) {
  archiveOpen = isOpen;

  const btn = document.getElementById("archiveToggleBtn");
  const body = document.getElementById("archiveBody");

  if (btn) {
    btn.setAttribute("aria-expanded", archiveOpen ? "true" : "false");
    const icon = btn.querySelector(".archive-toggle-icon");
    if (icon) icon.textContent = archiveOpen ? "−" : "＋";
  }

  if (body) {
    body.hidden = !archiveOpen;
  }
}

function hasActiveFilters(filters) {
  return Boolean(
    filters.nameQuery ||
    filters.eventType !== "all" ||
    filters.month !== "all" ||
    filters.day !== "all" ||
    filters.hour !== "all" ||
    favoritesOnlyMode
  );
}

function updateArchiveMessage(message) {
  const target = document.getElementById("archiveMessage");
  if (!target) return;
  target.textContent = message || "";
}

function eventMatchesFilters(ev, filters, includePast = false, options = {}) {
  const { ignoreNameQuery = false, ignoreFavoritesOnly = false } = options;
  const today = todayString();

  if (!includePast && ev.date < today) return false;
  if (includePast && ev.date >= today) return false;
  if (filters.eventType !== "all" && ev.eventType !== filters.eventType) return false;
  if (filters.month !== "all" && ev.month !== Number(filters.month)) return false;
  if (filters.day !== "all" && ev.day !== Number(filters.day)) return false;
  if (filters.hour !== "all" && ev.timeMinutes < Number(filters.hour) * 60) return false;
  if (!ignoreNameQuery && filters.nameQuery) {
    const hit = ev.performers.some((name) => normalizeText(name).includes(filters.nameQuery));
    if (!hit) return false;
  }
  if (!ignoreFavoritesOnly && favoritesOnlyMode && !eventHasFavorite(ev)) return false;
  return true;
}

function pickRandomPerformer() {
  const filters = getCurrentFilters();
  const favorites = new Set(getFavorites());

  const getUniqueNames = (eventList) => [...new Set(
    eventList.flatMap((ev) => Array.isArray(ev.performers) ? ev.performers : [])
  )];

  const futureEvents = events.filter((ev) =>
    eventMatchesFilters(ev, filters, false, { ignoreNameQuery: true })
  );
  const futureNames = getUniqueNames(futureEvents);

  let poolSource = "future";
  let allNames = futureNames;

  if (!allNames.length) {
    const pastEvents = events.filter((ev) =>
      eventMatchesFilters(ev, filters, true, { ignoreNameQuery: true })
    );
    allNames = getUniqueNames(pastEvents);
    poolSource = "past";
  }

  if (!allNames.length) {
    alert("この条件で選べる出演者が見つかりませんでした");
    return;
  }

  const nonFavoriteNames = allNames.filter((name) => !favorites.has(normalizeText(name)));
  const pool = nonFavoriteNames.length ? nonFavoriteNames : allNames;
  const selected = pool[Math.floor(Math.random() * pool.length)];

  document.getElementById("nameQuery").value = selected;

  if (poolSource === "past") {
    setArchiveOpen(true);
  }

  runSearch();
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
  const filters = getCurrentFilters();

  return list
    .filter((ev) => eventMatchesFilters(ev, filters, includePast))
    .sort((a, b) => a.date.localeCompare(b.date) || a.timeMinutes - b.timeMinutes);
}

function buildEventCardHTML(ev, targetId, favorites) {
  const performers = ev.performers.map((name) => {
    const normalizedName = normalizeText(name);
    const isFavorite = favorites.includes(normalizedName);
    return `<span class="performer ${isFavorite ? "favorite" : ""}"><button class="star" data-name="${name}" data-key="${normalizedName}" type="button">${isFavorite ? "★" : "☆"}</button>${name}</span>`;
  }).join("");

  const ticketLink = (targetId === "results" && ev.ticketUrl)
    ? `<p class="ticket-note">
         チケットは取り置き、もしくは
         <a href="${ev.ticketUrl}" target="_blank" rel="noopener noreferrer">FANYチケット</a>から
       </p>`
    : "";

  return `
    <article class="result-card">
      <div class="datetime-venue">${formatDisplayDate(ev)} / ${ev.venue}</div>
      <h3>${ev.title}</h3>
      <div class="performers">${performers}</div>
      ${ticketLink}
    </article>
  `;
}

function bindStarButtons(target) {
  target.querySelectorAll(".star").forEach((btn) => {
    btn.addEventListener("click", () => toggleFavorite(btn.dataset.name));
  });
}

function renderEvents(targetId, list) {
  const target = document.getElementById(targetId);
  const favorites = getFavorites();

  if (!list.length) {
    target.innerHTML = targetId === "results"
      ? '<p class="empty">該当する今後の開催はありません</p>'
      : '<p class="empty"></p>';
    return;
  }

  target.innerHTML = list.map((ev) => buildEventCardHTML(ev, targetId, favorites)).join("");
  bindStarButtons(target);
}

function renderArchiveEvents(targetId, list, openMonths = false) {
  const target = document.getElementById(targetId);
  const favorites = getFavorites();

  if (!list.length) {
    target.innerHTML = '<p class="empty">該当する過去の開催はありません</p>';
    return;
  }

  const groups = new Map();
  list.forEach((ev) => {
    const label = `${ev.date.slice(0, 4)}年${ev.month}月`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(ev);
  });

  target.innerHTML = [...groups.entries()].map(([label, items]) => {
    const cards = items.map((ev) => buildEventCardHTML(ev, "archiveResults", favorites)).join("");
    return `
      <details class="archive-month" ${openMonths ? "open" : ""}>
        <summary>${label}</summary>
        <div class="archive-month-content">
          ${cards}
        </div>
      </details>
    `;
  }).join("");

  bindStarButtons(target);
}

function runSearch() {
  const filters = getCurrentFilters();
  const futureResults = filterEvents(events, false);
  const pastResults = filterEvents(events, true);
  const activeFilters = hasActiveFilters(filters);
  const pastOnlyHit = activeFilters && futureResults.length === 0 && pastResults.length > 0;

  renderEvents("results", futureResults);

  if (pastOnlyHit) {
    setArchiveOpen(true);
    updateArchiveMessage("今後の開催には該当がありません。過去の開催に該当があります。");
  } else if (activeFilters && futureResults.length > 0 && pastResults.length > 0) {
    updateArchiveMessage("過去の開催にも該当があります。");
  } else {
    updateArchiveMessage("");
  }

  if (archiveOpen) {
    renderArchiveEvents("archiveResults", pastResults, activeFilters || pastOnlyHit);
  } else {
    const archiveResults = document.getElementById("archiveResults");
    if (archiveResults) archiveResults.innerHTML = "";
  }
}


function bindAutoSearch() {
  let debounceTimer;

  ["nameQuery", "eventType", "month", "day", "hour"].forEach((id) => {
    const el = document.getElementById(id);

    if (id === "nameQuery") {
      el.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runSearch, 300);
      });
    } else {
      el.addEventListener("change", runSearch);
    }
  });

  document.getElementById("clearBtn").addEventListener("click", clearFilters);
  document.getElementById("favoritesOnlyBtn").addEventListener("click", () => {
    favoritesOnlyMode = !favoritesOnlyMode;
    updateFavoritesOnlyButton();
    runSearch();
  });
  document.getElementById("randomPerformerBtn").addEventListener("click", pickRandomPerformer);
  document.getElementById("archiveToggleBtn").addEventListener("click", () => {
    setArchiveOpen(!archiveOpen);
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
  setArchiveOpen(false);

  const res = await fetch("data/events.json", { cache: "no-store" });
  events = await res.json();
  runSearch();
}

init();

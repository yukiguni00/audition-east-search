const FAVORITE_KEY = "oshikatsu-favorites";
let events = [];

function normalizeText(text) {
  return (text || "").trim().replace(/\s+/g, " ").normalize("NFKC").toLowerCase();
}

function getFavorites() {
  return JSON.parse(localStorage.getItem(FAVORITE_KEY) || "[]");
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITE_KEY, JSON.stringify(favorites));
}

function toggleFavorite(name) {
  const favorites = getFavorites();
  const key = normalizeText(name);
  const idx = favorites.indexOf(key);
  if (idx >= 0) favorites.splice(idx, 1); else favorites.push(key);
  saveFavorites(favorites);
  runSearch();
}

function populateSelects() {
  const monthSelect = document.getElementById("month");
  const daySelect = document.getElementById("day");
  const hourSelect = document.getElementById("hour");

  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement("option");
    opt.value = String(m); opt.textContent = `${m}月`; monthSelect.appendChild(opt);
  }
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = String(d); opt.textContent = `${d}日`; daySelect.appendChild(opt);
  }
  for (let h = 10; h <= 20; h++) {
    const opt = document.createElement("option");
    opt.value = String(h); opt.textContent = `${h}時以降`; hourSelect.appendChild(opt);
  }
}

function filterEvents(list, includePast = false) {
  const nameQuery = normalizeText(document.getElementById("nameQuery").value);
  const eventType = document.getElementById("eventType").value;
  const month = document.getElementById("month").value;
  const day = document.getElementById("day").value;
  const hour = document.getElementById("hour").value;
  const today = new Date().toISOString().slice(0,10);

  return list.filter(ev => {
    if (!includePast && ev.date < today) return false;
    if (eventType !== "all" && ev.eventType !== eventType) return false;
    if (month !== "all" && ev.month !== Number(month)) return false;
    if (day !== "all" && ev.day !== Number(day)) return false;
    if (hour !== "all" && ev.timeMinutes < Number(hour) * 60) return false;
    if (nameQuery) {
      const hit = ev.performers.some(name => normalizeText(name).includes(nameQuery));
      if (!hit) return false;
    }
    return true;
  }).sort((a,b) => a.date.localeCompare(b.date) || a.timeMinutes - b.timeMinutes);
}

function renderEvents(targetId, list) {
  const target = document.getElementById(targetId);
  const favorites = getFavorites();
  if (!list.length) {
    target.innerHTML = '<p class="empty">該当する公演はありません。</p>';
    return;
  }
  target.innerHTML = list.map(ev => {
    const performers = ev.performers.map(name => {
      const isFavorite = favorites.includes(normalizeText(name));
      return `<span class="performer ${isFavorite ? 'favorite' : ''}"><button class="star" data-name="${name}">${isFavorite ? '★' : '☆'}</button>${name}</span>`;
    }).join('');
    return `<article class="result-card"><h3>${ev.title}</h3><div class="meta">${ev.date} ${ev.time} / 会場: ${ev.venue}</div><div class="performers">${performers}</div></article>`;
  }).join('');

  target.querySelectorAll('.star').forEach(btn => {
    btn.addEventListener('click', () => toggleFavorite(btn.dataset.name));
  });
}

function runSearch() {
  const upcoming = filterEvents(events, false);
  const archive = filterEvents(events, true).filter(ev => ev.date < new Date().toISOString().slice(0,10));
  renderEvents('results', upcoming);
  renderEvents('archiveResults', archive);
}

async function init() {
  populateSelects();
  const res = await fetch('data/events.json');
  events = await res.json();
  document.getElementById('searchBtn').addEventListener('click', runSearch);
  document.getElementById('scrollTopBtn').addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
  runSearch();
}

init();
/* =========================
   API ENDPOINTS
========================= */

const JIKAN_API   = "https://api.jikan.moe/v4";
const KITSU_API   = "https://kitsu.io/api/edge/anime";
const ANILIST_API = "https://graphql.anilist.co";

const API_TIMEOUT  = 10000; // 10 seconds
const CACHE_TTL    = 10 * 60 * 1000; // 10 minutes
const animeCache   = new Map();


/* =========================
   CACHE HELPERS
========================= */

function getCachedSearch(key) {
  const entry = animeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    animeCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedSearch(key, data) {
  animeCache.set(key, { data, ts: Date.now() });
}


/* =========================
   FETCH WITH TIMEOUT
========================= */

async function fetchWithTimeout(url, options = {}, timeout = API_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}


/* =========================
   NORMALIZE ANIME DATA
   Unified format for all providers
========================= */

function normalizeAniListAnime(media) {
  const score = media.averageScore
    ? (media.averageScore / 10).toFixed(1)
    : null;
  return {
    id:           "al:" + media.id,
    _anilistId:   media.id,
    title:        media.title?.romaji   || media.title?.english || "Unknown Anime",
    englishTitle: media.title?.english  || "",
    japaneseTitle:media.title?.native   || "",
    image:        media.coverImage?.large      || media.coverImage?.medium || "",
    largeImage:   media.coverImage?.extraLarge || media.coverImage?.large  || "",
    description:  media.description || "",
    episodes:     media.episodes    || null,
    score:        score,
    status:       media.status      || "",
    type:         media.format      || "ANIME",
    year:         media.seasonYear  || null,
    genres:       media.genres      || [],
    studios:      media.studios?.nodes?.map(s => s.name) || [],
    duration:     media.duration ? media.duration + " min" : "",
    source:       "AniList",
    url:          media.siteUrl || ""
  };
}

function normalizeJikanAnime(anime) {
  return {
    id:           "jk:" + anime.mal_id,
    _malId:       anime.mal_id,
    title:        anime.title_english || anime.title || "Unknown Anime",
    englishTitle: anime.title_english || "",
    japaneseTitle:anime.title_japanese || "",
    image:        anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "",
    largeImage:   anime.images?.jpg?.large_image_url || "",
    description:  anime.synopsis || "",
    episodes:     anime.episodes || null,
    score:        anime.score    || null,
    status:       anime.status   || "",
    type:         anime.type     || "Anime",
    year:         anime.year     || anime.aired?.prop?.from?.year || null,
    genres:       anime.genres?.map(g => g.name) || [],
    studios:      anime.studios?.map(s => s.name) || [],
    duration:     anime.duration || "",
    source:       "Jikan",
    url:          anime.url || ""
  };
}

function normalizeKitsuAnime(anime) {
  const attr  = anime.attributes || {};
  const score = attr.averageRating
    ? (Number(attr.averageRating) / 10).toFixed(1)
    : null;
  return {
    id:           "kt:" + anime.id,
    _kitsuId:     anime.id,
    _kitsuSlug:   attr.slug || "",
    title:        attr.canonicalTitle || "Unknown Anime",
    englishTitle: attr.titles?.en || attr.titles?.en_us || "",
    japaneseTitle:attr.titles?.ja_jp || "",
    image:        attr.posterImage?.large  || attr.posterImage?.medium || attr.posterImage?.small || "",
    largeImage:   attr.posterImage?.large  || "",
    description:  attr.synopsis || "",
    episodes:     attr.episodeCount || null,
    score:        score,
    status:       attr.status || "",
    type:         attr.subtype || "TV",
    year:         attr.startDate ? new Date(attr.startDate).getFullYear() : null,
    genres:       [],
    studios:      [],
    duration:     attr.episodeLength ? attr.episodeLength + " min" : "",
    source:       "Kitsu",
    url:          attr.slug ? `https://kitsu.io/anime/${attr.slug}` : ""
  };
}


/* =========================
   OPEN ANIME DETAILS
========================= */

function openAnimeDetails(id) {
  if (!id) {
    console.error("Anime ID missing");
    return;
  }
  console.log("Opening anime with ID:", id);
  window.location.href = "./anime.html?id=" + encodeURIComponent(id);
}


/* =========================
   CREATE ANIME CARD
   Accepts normalized anime object
========================= */

function createAnimeCard(anime) {
  let image, title, score, id;

  // Normalized object has a string id like "al:123", "jk:456", "kt:789"
  // Raw Jikan objects have mal_id (number) and images nested under images.jpg
  if (anime.mal_id !== undefined) {
    // Raw Jikan object
    image = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "";
    title = anime.title_english || anime.title || "Unknown Anime";
    score = anime.score ?? "N/A";
    id    = "jk:" + anime.mal_id;
  } else {
    // Normalized object
    image = anime.image || "";
    title = anime.title || "Unknown Anime";
    score = anime.score ?? "N/A";
    id    = anime.id || "";
  }

  const safeId = encodeURIComponent(id);

  return `
    <article
      class="anime-card"
      data-anime-id="${safeId}"
      style="cursor:pointer"
    >
      <img
        class="anime-image"
        src="${image}"
        alt="${title}"
        loading="lazy"
      >
      <div class="anime-info">
        <h3 class="anime-title">${title}</h3>
        <p class="anime-score">⭐ ${score}</p>
      </div>
    </article>
  `;
}

// Keep createKitsuCard as alias for backward compatibility
function createKitsuCard(anime) {
  return createAnimeCard(normalizeKitsuAnime(anime));
}


/* =========================
   SEARCH — ANILIST
========================= */

async function searchAniList(query) {
  const gql = `
    query ($search: String) {
      Page(perPage: 12) {
        media(search: $search, type: ANIME) {
          id
          title { romaji english native }
          coverImage { large extraLarge }
          description(asHtml: false)
          episodes averageScore status format duration
          seasonYear genres
          studios { nodes { name } }
          siteUrl
        }
      }
    }
  `;

  console.log("Searching AniList:", query);

  const response = await fetchWithTimeout(ANILIST_API, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body:    JSON.stringify({ query: gql, variables: { search: query } })
  });

  if (!response.ok) {
    throw new Error("AniList error: " + response.status);
  }

  const json = await response.json();
  const items = json?.data?.Page?.media || [];

  if (items.length === 0) throw new Error("AniList returned no results");

  console.log("AniList returned", items.length, "results");
  return items.map(normalizeAniListAnime);
}


/* =========================
   SEARCH — JIKAN
========================= */

async function searchJikan(query) {
  const url =
    JIKAN_API +
    "/anime?q=" +
    encodeURIComponent(query) +
    "&limit=12&sfw=true";

  console.log("Searching Jikan:", query);

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error("Jikan error: " + response.status);
  }

  const data = await response.json();
  const items = data.data || [];

  if (items.length === 0) throw new Error("Jikan returned no results");

  console.log("Jikan returned", items.length, "results");
  return items.map(normalizeJikanAnime);
}


/* =========================
   SEARCH — KITSU
========================= */

async function searchKitsu(query) {
  const url =
    KITSU_API +
    "?filter[text]=" +
    encodeURIComponent(query) +
    "&page[limit]=12";

  console.log("Searching Kitsu:", query);

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error("Kitsu error: " + response.status);
  }

  const data = await response.json();
  const items = data.data || [];

  if (items.length === 0) throw new Error("Kitsu returned no results");

  console.log("Kitsu returned", items.length, "results");
  return items.map(normalizeKitsuAnime);
}


/* =========================
   MULTI-PROVIDER SEARCH
   AniList → Jikan → Kitsu
========================= */

async function searchAnimeProviders(query) {
  const cacheKey = query.trim().toLowerCase();
  const cached   = getCachedSearch(cacheKey);
  if (cached) {
    console.log("Cache hit for:", cacheKey);
    return cached;
  }

  const providers = [
    { name: "AniList", fn: () => searchAniList(query) },
    { name: "Jikan",   fn: () => searchJikan(query)   },
    { name: "Kitsu",   fn: () => searchKitsu(query)   }
  ];

  for (let i = 0; i < providers.length; i++) {
    const { name, fn } = providers[i];
    try {
      const results = await fn();
      setCachedSearch(cacheKey, results);
      return results;
    } catch (error) {
      const isLast = i === providers.length - 1;
      if (!isLast) {
        console.warn(`${name} unavailable. Trying ${providers[i + 1].name}...`, error.message);
      } else {
        console.error("All anime APIs unavailable.", error.message);
      }
    }
  }

  return null;
}


/* =========================
   OPEN ANIME FROM SEARCH
   Uses provider ID directly
========================= */

async function searchAndOpenAnime(title) {
  console.log("Finding anime details for:", title);
  try {
    const results = await searchAnimeProviders(title);
    if (results && results.length > 0) {
      openAnimeDetails(results[0].id);
      return;
    }
    alert("Anime details not found.");
  } catch (error) {
    console.error("SEARCH/OPEN ERROR:", error);
    alert("Unable to open anime details. Please try again.");
  }
}


/* =========================
   MAIN SEARCH (UI)
========================= */

async function searchAnime() {
  const input   = document.getElementById("search-input");
  const results = document.getElementById("search-results");

  if (!input || !results) return;

  const query = input.value.trim();

  if (!query) {
    results.innerHTML = `<p style="color:#9b9bab;">Type an anime name to search.</p>`;
    return;
  }

  results.innerHTML = `<p style="color:#a78bfa;">🔍 Searching anime...</p>`;

  const anime = await searchAnimeProviders(query);

  if (!anime) {
    results.innerHTML = `
      <p style="color:#ff8abf;">
        Unable to load anime right now. Please try again.
      </p>
    `;
    return;
  }

  if (anime.length === 0) {
    results.innerHTML = `<p style="color:#9b9bab;">No anime found.</p>`;
    return;
  }

  results.innerHTML = anime.map(createAnimeCard).join("");
}


/* =========================
   FETCH JIKAN (legacy helper used by getAnime)
========================= */

async function fetchJikan(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error("Jikan API Error: " + response.status);
  return await response.json();
}


/* =========================
   DYNAMIC HERO
========================= */

function loadHero(anime) {
  if (!anime) return;

  const heroBackground = document.getElementById("hero-background");
  const heroLabel      = document.getElementById("hero-label");
  const heroTitle      = document.getElementById("hero-title");
  const heroText       = document.getElementById("hero-text");
  const heroScore      = document.getElementById("hero-score");
  const heroType       = document.getElementById("hero-type");
  const heroYear       = document.getElementById("hero-year");
  const heroWatch      = document.getElementById("hero-watch-btn");
  const heroInfo       = document.getElementById("hero-info-btn");

  // Accept both normalized and raw Jikan objects
  const title    = anime.title    || anime.title_english || "Featured Anime";
  const image    = anime.image    || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "";
  const score    = anime.score    ?? anime.score ?? "N/A";
  const type     = anime.type     || "Anime";
  const year     = anime.year     || anime.aired?.prop?.from?.year || "Unknown";
  const synopsis = anime.description || anime.synopsis || "Discover this amazing anime on ITSUKI ANIMES.";
  const id       = anime.id       || ("jk:" + anime.mal_id);

  if (heroBackground && image) {
    heroBackground.style.backgroundImage = `
      linear-gradient(
        90deg,
        rgba(7,7,13,0.98) 0%,
        rgba(7,7,13,0.82) 38%,
        rgba(7,7,13,0.35) 72%,
        rgba(7,7,13,0.15) 100%
      ),
      url("${image}")
    `;
    heroBackground.style.backgroundSize     = "cover";
    heroBackground.style.backgroundPosition = "center";
  }

  if (heroLabel) heroLabel.textContent = "✦ FEATURED TODAY";
  if (heroTitle) heroTitle.innerHTML   = `${title}<span>FEATURED</span>`;
  if (heroText)  heroText.textContent  = synopsis.length > 180 ? synopsis.substring(0, 180) + "..." : synopsis;
  if (heroScore) heroScore.textContent = `⭐ ${score}`;
  if (heroType)  heroType.textContent  = type;
  if (heroYear)  heroYear.textContent  = year;

  if (heroWatch && id) heroWatch.onclick = () => openAnimeDetails(id);
  if (heroInfo  && id) heroInfo.onclick  = () => openAnimeDetails(id);
}


/* =========================
   LOAD HOMEPAGE ANIME
========================= */

async function getAnime(endpoint, elementId) {
  const grid = document.getElementById(elementId);
  if (!grid) return;

  grid.innerHTML = "<p>Loading anime...</p>";

  try {
    const data = await fetchJikan(JIKAN_API + endpoint);

    if (!data.data || data.data.length === 0) {
      grid.innerHTML = "<p>No anime found.</p>";
      return;
    }

    if (elementId === "trending-grid") {
      loadHero(data.data[0]);
    }

    grid.innerHTML = data.data.map(createAnimeCard).join("");

  } catch (error) {
    console.error("HOME ERROR:", error);
    grid.innerHTML = `<p style="color:#ff8abf;">Unable to load anime right now. Please try again.</p>`;
  }
}


/* =========================
   MOBILE MENU
========================= */

function setupMobileMenu() {
  const menuButton  = document.querySelector(".menu-btn");
  const menu        = document.getElementById("mobile-menu");
  const overlay     = document.getElementById("mobile-menu-overlay");
  const closeButton = document.getElementById("mobile-menu-close");
  const mobileSearch= document.getElementById("mobile-search-btn");
  const links       = document.querySelectorAll(".mobile-nav-link");

  if (!menu || !overlay) return;

  function openMenu() {
    menu.classList.add("active");
    overlay.classList.add("active");
    document.body.classList.add("menu-open");
  }

  function closeMenu() {
    menu.classList.remove("active");
    overlay.classList.remove("active");
    document.body.classList.remove("menu-open");
  }

  if (menuButton)  menuButton.addEventListener("click", openMenu);
  if (closeButton) closeButton.addEventListener("click", closeMenu);

  overlay.addEventListener("click", closeMenu);

  links.forEach(link => {
    link.addEventListener("click", () => {
      links.forEach(item => item.classList.remove("active"));
      link.classList.add("active");
      closeMenu();
    });
  });

  if (mobileSearch) {
    mobileSearch.addEventListener("click", () => {
      closeMenu();
      const searchOverlay = document.getElementById("search-overlay");
      const searchInput   = document.getElementById("search-input");
      if (searchOverlay) searchOverlay.classList.add("active");
      setTimeout(() => { if (searchInput) searchInput.focus(); }, 150);
    });
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });
}


/* =========================
   INITIALIZE WEBSITE
========================= */

document.addEventListener("DOMContentLoaded", () => {

  getAnime("/top/anime?limit=10",                    "trending-grid");
  getAnime("/top/anime?limit=10&filter=bypopularity","popular-grid");
  getAnime("/seasons/now?limit=10",                  "new-grid");

  const openSearch  = document.getElementById("open-search");
  const closeSearch = document.getElementById("close-search");
  const overlay     = document.getElementById("search-overlay");
  const searchButton= document.getElementById("search-btn");
  const searchInput = document.getElementById("search-input");

  if (openSearch && overlay) {
    openSearch.addEventListener("click", () => {
      overlay.classList.add("active");
      setTimeout(() => { if (searchInput) searchInput.focus(); }, 100);
    });
  }

  if (closeSearch && overlay) {
    closeSearch.addEventListener("click", () => {
      overlay.classList.remove("active");
    });
  }

  if (searchButton) searchButton.addEventListener("click", searchAnime);

  if (searchInput) {
    searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") searchAnime();
    });
  }

  setupMobileMenu();

  // Delegated click handler for all anime cards (avoids inline onclick issues)
  document.addEventListener("click", event => {
    const card = event.target.closest(".anime-card[data-anime-id]");
    if (card) {
      const id = decodeURIComponent(card.dataset.animeId);
      if (id) openAnimeDetails(id);
    }
  });
});

/* =========================
   API ENDPOINTS
========================= */

const JIKAN_API   = "https://api.jikan.moe/v4";
const ANILIST_API = "https://graphql.anilist.co";
const KITSU_API   = "https://kitsu.io/api/edge/anime";

const API_TIMEOUT = 10000;
const MAX_RETRIES = 2;

/* =========================
   GET ANIME ID FROM URL
========================= */

const params  = new URLSearchParams(window.location.search);
const animeId = params.get("id"); // may be "al:123", "jk:456", "kt:789", or legacy plain number

/* =========================
   HELPERS
========================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
      signal: controller.signal,
      headers: { "Accept": "application/json", ...(options.headers || {}) }
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/* =========================
   NORMALIZE TO DETAIL FORMAT
========================= */

function normalizeJikanDetail(anime) {
  return {
    id:         "jk:" + anime.mal_id,
    title:      anime.title_english || anime.title || "Unknown Anime",
    image:      anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "",
    score:      anime.score ?? "N/A",
    episodes:   anime.episodes ?? "Unknown",
    year:       anime.year ?? anime.aired?.prop?.from?.year ?? "Unknown",
    synopsis:   anime.synopsis || "No description available.",
    genres:     anime.genres?.map(g => g.name).join(" • ") || "Unknown",
    trailerUrl: anime.trailer?.embed_url || "",
    source:     "Jikan"
  };
}

function normalizeAniListDetail(media) {
  const score = media.averageScore
    ? (media.averageScore / 10).toFixed(1)
    : "N/A";
  const genres = media.genres?.join(" • ") || "Unknown";
  return {
    id:         "al:" + media.id,
    title:      media.title?.english || media.title?.romaji || "Unknown Anime",
    image:      media.coverImage?.extraLarge || media.coverImage?.large || "",
    score,
    episodes:   media.episodes ?? "Unknown",
    year:       media.seasonYear ?? "Unknown",
    synopsis:   media.description?.replace(/<[^>]*>/g, "") || "No description available.",
    genres,
    trailerUrl: media.trailer?.site === "youtube"
      ? `https://www.youtube.com/embed/${media.trailer.id}`
      : "",
    source:     "AniList"
  };
}

function normalizeKitsuDetail(anime) {
  const attr  = anime.attributes || {};
  const score = attr.averageRating
    ? (Number(attr.averageRating) / 10).toFixed(1)
    : "N/A";
  const year = attr.startDate ? new Date(attr.startDate).getFullYear() : "Unknown";
  return {
    id:         "kt:" + anime.id,
    title:      attr.canonicalTitle || "Unknown Anime",
    image:      attr.posterImage?.large || attr.posterImage?.medium || "",
    score,
    episodes:   attr.episodeCount ?? "Unknown",
    year,
    synopsis:   attr.synopsis || "No description available.",
    genres:     "Unknown",
    trailerUrl: "",
    source:     "Kitsu"
  };
}

/* =========================
   FETCH DETAIL — JIKAN
========================= */

async function getJikanDetail(malId) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${JIKAN_API}/anime/${encodeURIComponent(malId)}/full`
      );

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error("API is busy. Please try again in a moment.");
      }

      if (!response.ok) throw new Error(`Jikan error: ${response.status}`);

      const data = await response.json();
      if (!data?.data) throw new Error("Jikan data not found.");

      return normalizeJikanDetail(data.data);
    } catch (error) {
      lastError = error.name === "AbortError"
        ? new Error("Request timed out.")
        : error;
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error("Unable to load anime.");
}

/* =========================
   FETCH DETAIL — ANILIST
========================= */

async function getAniListDetail(anilistId) {
  const gql = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        coverImage { large extraLarge }
        description(asHtml: false)
        episodes averageScore status format
        seasonYear genres
        trailer { id site }
        studios { nodes { name } }
        siteUrl
      }
    }
  `;

  const response = await fetchWithTimeout(ANILIST_API, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query: gql, variables: { id: Number(anilistId) } })
  });

  if (!response.ok) throw new Error("AniList error: " + response.status);

  const json = await response.json();
  const media = json?.data?.Media;
  if (!media) throw new Error("AniList data not found.");

  return normalizeAniListDetail(media);
}

/* =========================
   FETCH DETAIL — KITSU
========================= */

async function getKitsuDetail(kitsuId) {
  const response = await fetchWithTimeout(`${KITSU_API}/${encodeURIComponent(kitsuId)}`);
  if (!response.ok) throw new Error("Kitsu error: " + response.status);
  const json = await response.json();
  if (!json?.data) throw new Error("Kitsu data not found.");
  return normalizeKitsuDetail(json.data);
}

/* =========================
   SEARCH ANILIST BY TITLE
   (fallback when only a title is known)
========================= */

async function searchAniListByTitle(title) {
  const gql = `
    query ($search: String) {
      Page(perPage: 1) {
        media(search: $search, type: ANIME) {
          id
          title { romaji english native }
          coverImage { large extraLarge }
          description(asHtml: false)
          episodes averageScore status format
          seasonYear genres
          trailer { id site }
          studios { nodes { name } }
          siteUrl
        }
      }
    }
  `;

  const response = await fetchWithTimeout(ANILIST_API, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query: gql, variables: { search: title } })
  });

  if (!response.ok) throw new Error("AniList error: " + response.status);

  const json  = await response.json();
  const items = json?.data?.Page?.media || [];
  if (items.length === 0) throw new Error("AniList: no results for title");

  return normalizeAniListDetail(items[0]);
}

/* =========================
   SEARCH JIKAN BY TITLE
========================= */

async function searchJikanByTitle(title) {
  const response = await fetchWithTimeout(
    `${JIKAN_API}/anime?q=${encodeURIComponent(title)}&limit=1&sfw=true`
  );
  if (!response.ok) throw new Error("Jikan search error: " + response.status);
  const data = await response.json();
  if (!data?.data?.length) throw new Error("Jikan: no results for title");
  return normalizeJikanDetail(data.data[0]);
}

/* =========================
   GET ANIME DATA
   Resolves by provider prefix or falls back by title search
========================= */

async function getAnimeData(rawId) {
  // Compound ID: "al:123", "jk:456", "kt:789"
  if (typeof rawId === "string" && rawId.includes(":")) {
    const [prefix, id] = rawId.split(":");

    if (prefix === "al") {
      console.log("Loading from AniList ID:", id);
      try { return await getAniListDetail(id); } catch (e) {
        console.warn("AniList detail failed, trying Jikan by title search...", e.message);
      }
    }

    if (prefix === "jk") {
      console.log("Loading from Jikan MAL ID:", id);
      try { return await getJikanDetail(id); } catch (e) {
        console.warn("Jikan detail failed, trying AniList...", e.message);
        try { return await getAniListDetail(id); } catch (e2) {
          console.warn("AniList also failed.", e2.message);
        }
      }
    }

    if (prefix === "kt") {
      console.log("Loading from Kitsu ID:", id);
      try { return await getKitsuDetail(id); } catch (e) {
        console.warn("Kitsu detail failed.", e.message);
      }
    }

    throw new Error("Unable to load anime details.");
  }

  // Legacy plain numeric MAL ID (bookmarks saved before this update)
  console.log("Legacy MAL ID detected:", rawId);
  try { return await getJikanDetail(rawId); } catch (e) {
    console.warn("Jikan failed for legacy ID, trying AniList...", e.message);
    try { return await getAniListDetail(rawId); } catch (e2) {
      throw new Error("Unable to load anime details.");
    }
  }
}

/* =========================
   FAVORITES
========================= */

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("itsukiFavorites")) || [];
  } catch { return []; }
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem("itsukiFavorites", JSON.stringify(favorites));
  } catch (error) {
    console.error("Unable to save favorites:", error);
  }
}

function isFavorite(id) {
  return getFavorites().some(anime => String(anime.id) === String(id));
}

function toggleFavorite(animeData) {
  let favorites = getFavorites();
  const existingIndex = favorites.findIndex(
    anime => String(anime.id) === String(animeData.id)
  );
  if (existingIndex !== -1) {
    favorites.splice(existingIndex, 1);
  } else {
    favorites.push(animeData);
  }
  saveFavorites(favorites);
  updateFavoriteButton(animeData.id);
}

function updateFavoriteButton(id) {
  const button = document.getElementById("favorite-btn");
  if (!button) return;
  if (isFavorite(id)) {
    button.innerHTML = "❤️ Added to My List";
    button.classList.add("favorited");
  } else {
    button.innerHTML = "🤍 Add to My List";
    button.classList.remove("favorited");
  }
}

/* =========================
   TOGGLE TRAILER
========================= */

function toggleTrailer() {
  const trailer = document.getElementById("trailer-container");
  if (!trailer) return;
  trailer.classList.toggle("trailer-active");
  if (trailer.classList.contains("trailer-active")) {
    trailer.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* =========================
   LOAD ANIME DETAILS
========================= */

async function loadAnimeDetails() {
  const container = document.getElementById("anime-details");
  if (!container) { console.error("#anime-details not found"); return; }

  if (!animeId) {
    container.innerHTML = `
      <div class="details-error">
        <h2>Anime not found</h2>
        <p>No anime ID was provided.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="details-loading">Loading anime details...</div>`;

  try {
    const anime = await getAnimeData(animeId);

    const favoriteAnime = {
      id:    anime.id,
      title: anime.title,
      image: anime.image,
      score: anime.score
    };

    const favoriteText  = isFavorite(anime.id) ? "❤️ Added to My List" : "🤍 Add to My List";
    const favoriteClass = isFavorite(anime.id) ? "favorited" : "";

    container.innerHTML = `
      <section class="anime-details-card">
        <div class="details-poster">
          ${anime.image
            ? `<img src="${escapeHTML(anime.image)}" alt="${escapeHTML(anime.title)}" loading="eager" decoding="async">`
            : `<div class="poster-placeholder">No Image</div>`
          }
        </div>

        <div class="details-content">
          <p class="section-tag">ANIME DETAILS</p>
          <h1>${escapeHTML(anime.title)}</h1>

          <div class="details-meta">
            <span>⭐ ${escapeHTML(String(anime.score))}</span>
            <span>📺 ${escapeHTML(String(anime.episodes))} Episodes</span>
            <span>📅 ${escapeHTML(String(anime.year))}</span>
          </div>

          <div class="details-genres">${escapeHTML(anime.genres)}</div>

          <p class="details-synopsis">${escapeHTML(anime.synopsis)}</p>

          <div class="details-actions">
            ${anime.trailerUrl
              ? `<button id="trailer-btn" class="watch-btn" type="button">▶ Watch Trailer</button>`
              : `<button class="info-btn" type="button" disabled>Trailer Not Available</button>`
            }
            <button id="favorite-btn" class="favorite-btn ${favoriteClass}" type="button">
              ${favoriteText}
            </button>
          </div>
        </div>
      </section>

      ${anime.trailerUrl ? `
        <section id="trailer-container" class="trailer-container">
          <div class="trailer-header">
            <p class="section-tag">OFFICIAL TRAILER</p>
            <h2>Watch <span>Trailer</span></h2>
          </div>
          <div class="trailer-frame">
            <iframe
              src="${escapeHTML(anime.trailerUrl)}"
              title="${escapeHTML(anime.title)} trailer"
              loading="lazy"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          </div>
        </section>
      ` : ""}
    `;

    const favoriteButton = document.getElementById("favorite-btn");
    if (favoriteButton) {
      favoriteButton.addEventListener("click", () => toggleFavorite(favoriteAnime));
    }

    const trailerButton = document.getElementById("trailer-btn");
    if (trailerButton) {
      trailerButton.addEventListener("click", toggleTrailer);
    }

  } catch (error) {
    console.error("Anime loading error:", error);

    let message = "Unable to load anime details. Please try again.";
    if (error.message === "Request timed out.") {
      message = "The anime server is taking too long to respond.";
    } else if (error.message?.includes("busy")) {
      message = "The anime server is busy right now.";
    }

    container.innerHTML = `
      <div class="details-error">
        <h2>😕 Something went wrong</h2>
        <p>${escapeHTML(message)}</p>
        <button id="retry-anime-btn" class="watch-btn" type="button">🔄 Try Again</button>
      </div>
    `;

    const retryButton = document.getElementById("retry-anime-btn");
    if (retryButton) retryButton.addEventListener("click", loadAnimeDetails);
  }
}

/* =========================
   START
========================= */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadAnimeDetails);
} else {
  loadAnimeDetails();
}

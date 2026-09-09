const JIKAN_API = "https://api.jikan.moe/v4";
const API_TIMEOUT = 10000;
const MAX_RETRIES = 2;

/* =========================
   GET ANIME ID
========================= */

const params = new URLSearchParams(
  window.location.search
);

const animeId = params.get("id");

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
   API REQUEST WITH TIMEOUT
========================= */

async function fetchWithTimeout(
  url,
  timeout = API_TIMEOUT
) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json"
      }
    });

    return response;
  } finally {
    clearTimeout(timer);
  }
}

/* =========================
   GET ANIME DATA
========================= */

async function getAnimeData(id) {
  let lastError;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const response =
        await fetchWithTimeout(
          `${JIKAN_API}/anime/${encodeURIComponent(id)}/full`
        );

      /* RATE LIMIT */
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                1500 * (attempt + 1)
              )
          );
          continue;
        }

        throw new Error(
          "API is busy. Please try again in a moment."
        );
      }

      if (!response.ok) {
        throw new Error(
          `Unable to load anime (${response.status})`
        );
      }

      const data = await response.json();

      if (!data || !data.data) {
        throw new Error(
          "Anime data not found."
        );
      }

      return data.data;
    } catch (error) {
      lastError = error;

      if (error.name === "AbortError") {
        lastError = new Error(
          "Request timed out."
        );
      }

      if (attempt < MAX_RETRIES) {
        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              800 * (attempt + 1)
            )
        );
      }
    }
  }

  throw lastError ||
    new Error(
      "Unable to load anime."
    );
}

/* =========================
   FAVORITES
========================= */

function getFavorites() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "itsukiFavorites"
      )
    ) || [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem(
      "itsukiFavorites",
      JSON.stringify(favorites)
    );
  } catch (error) {
    console.error(
      "Unable to save favorites:",
      error
    );
  }
}

function isFavorite(id) {
  return getFavorites().some(
    anime =>
      String(anime.id) === String(id)
  );
}

function toggleFavorite(animeData) {
  let favorites =
    getFavorites();

  const existingIndex =
    favorites.findIndex(
      anime =>
        String(anime.id) ===
        String(animeData.id)
    );

  if (existingIndex !== -1) {
    favorites.splice(
      existingIndex,
      1
    );
  } else {
    favorites.push(
      animeData
    );
  }

  saveFavorites(
    favorites
  );

  updateFavoriteButton(
    animeData.id
  );
}

function updateFavoriteButton(id) {
  const button =
    document.getElementById(
      "favorite-btn"
    );

  if (!button) return;

  if (isFavorite(id)) {
    button.innerHTML =
      "❤️ Added to My List";

    button.classList.add(
      "favorited"
    );
  } else {
    button.innerHTML =
      "🤍 Add to My List";

    button.classList.remove(
      "favorited"
    );
  }
}

/* =========================
   TOGGLE TRAILER
========================= */

function toggleTrailer() {
  const trailer =
    document.getElementById(
      "trailer-container"
    );

  if (!trailer) return;

  trailer.classList.toggle(
    "trailer-active"
  );

  if (
    trailer.classList.contains(
      "trailer-active"
    )
  ) {
    trailer.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
}

/* =========================
   LOAD ANIME DETAILS
========================= */

async function loadAnimeDetails() {
  const container =
    document.getElementById(
      "anime-details"
    );

  if (!container) {
    console.error(
      "#anime-details not found"
    );
    return;
  }

  /* NO ID */
  if (!animeId) {
    container.innerHTML = `
      <div class="details-error">
        <h2>Anime not found</h2>
        <p>No anime ID was provided.</p>
      </div>
    `;
    return;
  }

  /* LOADING */
  container.innerHTML = `
    <div class="details-loading">
      Loading anime details...
    </div>
  `;

  try {
    const anime =
      await getAnimeData(
        animeId
      );

    /* BASIC DATA */
    const title =
      anime.title_english ||
      anime.title ||
      "Unknown Anime";

    const image =
      anime.images?.jpg?.large_image_url ||
      anime.images?.jpg?.image_url ||
      "";

    const score =
      anime.score ?? "N/A";

    const episodes =
      anime.episodes ?? "Unknown";

    const year =
      anime.year ??
      anime.aired?.prop?.from?.year ??
      "Unknown";

    const synopsis =
      anime.synopsis ||
      "No description available.";

    const genres =
      anime.genres
        ?.map(
          genre =>
            genre.name
        )
        .join(" • ") ||
      "Unknown";

    const trailerUrl =
      anime.trailer?.embed_url ||
      "";

    /* FAVORITE DATA */
    const favoriteAnime = {
      id: anime.mal_id,
      title: title,
      image: image,
      score: score
    };

    const favoriteText =
      isFavorite(
        anime.mal_id
      )
        ? "❤️ Added to My List"
        : "🤍 Add to My List";

    const favoriteClass =
      isFavorite(
        anime.mal_id
      )
        ? "favorited"
        : "";

    /* PAGE HTML */
    container.innerHTML = `
      <section
        class="anime-details-card"
      >
        <div
          class="details-poster"
        >
          ${
            image
              ? `
                <img
                  src="${escapeHTML(image)}"
                  alt="${escapeHTML(title)}"
                  loading="eager"
                  decoding="async"
                >
              `
              : `
                <div class="poster-placeholder">
                  No Image
                </div>
              `
          }
        </div>

        <div
          class="details-content"
        >
          <p class="section-tag">
            ANIME DETAILS
          </p>

          <h1>
            ${escapeHTML(title)}
          </h1>

          <div
            class="details-meta"
          >
            <span>
              ⭐ ${escapeHTML(score)}
            </span>
            <span>
              📺 ${escapeHTML(episodes)}
              Episodes
            </span>
            <span>
              📅 ${escapeHTML(year)}
            </span>
          </div>

          <div
            class="details-genres"
          >
            ${escapeHTML(genres)}
          </div>

          <p
            class="details-synopsis"
          >
            ${escapeHTML(
              synopsis
            )}
          </p>

          <div
            class="details-actions"
          >
            ${
              trailerUrl
                ? `
                  <button
                    id="trailer-btn"
                    class="watch-btn"
                    type="button"
                  >
                    ▶ Watch Trailer
                  </button>
                `
                : `
                  <button
                    class="info-btn"
                    type="button"
                    disabled
                  >
                    Trailer Not Available
                  </button>
                `
            }

            <button
              id="favorite-btn"
              class="favorite-btn ${favoriteClass}"
              type="button"
            >
              ${favoriteText}
            </button>
          </div>
        </div>
      </section>

      ${
        trailerUrl
          ? `
            <section
              id="trailer-container"
              class="trailer-container"
            >
              <div
                class="trailer-header"
              >
                <p class="section-tag">
                  OFFICIAL TRAILER
                </p>
                <h2>
                  Watch <span>Trailer</span>
                </h2>
              </div>

              <div
                class="trailer-frame"
              >
                <iframe
                  src="${escapeHTML(trailerUrl)}"
                  title="${escapeHTML(title)} trailer"
                  loading="lazy"
                  allowfullscreen
                  referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
              </div>
            </section>
          `
          : ""
      }
    `;

    /* FAVORITE BUTTON */
    const favoriteButton =
      document.getElementById(
        "favorite-btn"
      );

    if (favoriteButton) {
      favoriteButton.addEventListener(
        "click",
        () =>
          toggleFavorite(
            favoriteAnime
          )
      );
    }

    /* TRAILER BUTTON */
    const trailerButton =
      document.getElementById(
        "trailer-btn"
      );

    if (trailerButton) {
      trailerButton.addEventListener(
        "click",
        toggleTrailer
      );
    }
  } catch (error) {
    console.error(
      "Anime loading error:",
      error
    );

    let message =
      "Unable to load anime details.";

    if (
      error.message ===
      "Request timed out."
    ) {
      message =
        "The anime server is taking too long to respond.";
    } else if (
      error.message
        ?.includes("busy")
    ) {
      message =
        "The anime server is busy right now.";
    }

    container.innerHTML = `
      <div
        class="details-error"
      >
        <h2>
          😕 Something went wrong
        </h2>

        <p>
          ${escapeHTML(message)}
        </p>

        <button
          id="retry-anime-btn"
          class="watch-btn"
          type="button"
        >
          🔄 Try Again
        </button>
      </div>
    `;

    const retryButton =
      document.getElementById(
        "retry-anime-btn"
      );

    if (retryButton) {
      retryButton.addEventListener(
        "click",
        loadAnimeDetails
      );
    }
  }
}

/* =========================
   START
========================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    loadAnimeDetails
  );
} else {
  loadAnimeDetails();
}
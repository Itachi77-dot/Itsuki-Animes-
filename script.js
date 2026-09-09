const JIKAN_API = "https://api.jikan.moe/v4";
const KITSU_API = "https://kitsu.io/api/edge/anime";


/* =========================
   OPEN ANIME DETAILS
========================= */

function openAnimeDetails(id) {

  if (!id) {
    console.error("Anime ID missing");
    return;
  }

  console.log("Opening anime with MAL ID:", id);

  window.location.href =
    "./anime.html?id=" + encodeURIComponent(id);
}


/* =========================
   CREATE JIKAN ANIME CARD
========================= */

function createAnimeCard(anime) {

  const image =
    anime.images?.jpg?.large_image_url ||
    anime.images?.jpg?.image_url ||
    "";

  const title =
    anime.title_english ||
    anime.title ||
    "Unknown Anime";

  const score =
    anime.score ?? "N/A";

  const id =
    Number(anime.mal_id);

  return `
    <article
      class="anime-card"
      onclick="openAnimeDetails(${id})"
    >

      <img
        class="anime-image"
        src="${image}"
        alt="${title}"
        loading="lazy"
      >

      <div class="anime-info">

        <h3 class="anime-title">
          ${title}
        </h3>

        <p class="anime-score">
          ⭐ ${score}
        </p>

      </div>

    </article>
  `;
}


/* =========================
   CREATE KITSU ANIME CARD
========================= */

function createKitsuCard(anime) {

  const attributes =
    anime.attributes || {};

  const image =
    attributes.posterImage?.large ||
    attributes.posterImage?.medium ||
    attributes.posterImage?.small ||
    "";

  const title =
    attributes.canonicalTitle ||
    "Unknown Anime";

  const score =
    attributes.averageRating
      ? (Number(attributes.averageRating) / 10).toFixed(1)
      : "N/A";

  const safeTitle =
    JSON.stringify(title);

  return `
    <article
      class="anime-card"
      onclick='searchAndOpenAnime(${safeTitle})'
    >

      <img
        class="anime-image"
        src="${image}"
        alt="${title}"
        loading="lazy"
      >

      <div class="anime-info">

        <h3 class="anime-title">
          ${title}
        </h3>

        <p class="anime-score">
          ⭐ ${score}
        </p>

      </div>

    </article>
  `;
}


/* =========================
   OPEN KITSU RESULT
   → FIND JIKAN ID
========================= */

async function searchAndOpenAnime(title) {

  console.log(
    "Finding anime details for:",
    title
  );

  try {

    const anime =
      await searchJikan(title);

    console.log(
      "Jikan result:",
      anime
    );

    if (
      anime &&
      anime.length > 0
    ) {

      const malId =
        anime[0].mal_id;

      console.log(
        "Found MAL ID:",
        malId
      );

      if (!malId) {
        throw new Error(
          "MAL ID was not found."
        );
      }

      openAnimeDetails(
        malId
      );

      return;
    }

    alert(
      "Anime details not found."
    );

  } catch (error) {

    console.error(
      "SEARCH/OPEN ERROR:",
      error
    );

    alert(
      "Unable to open anime details. Please try again."
    );
  }
}


/* =========================
   FETCH JIKAN API
========================= */

async function fetchJikan(url) {

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      "Jikan API Error: " +
      response.status
    );
  }

  return await response.json();
}


/* =========================
   DYNAMIC HERO 2.0
========================= */

function loadHero(anime) {

  if (!anime) return;

  const heroBackground =
    document.getElementById(
      "hero-background"
    );

  const heroLabel =
    document.getElementById(
      "hero-label"
    );

  const heroTitle =
    document.getElementById(
      "hero-title"
    );

  const heroText =
    document.getElementById(
      "hero-text"
    );

  const heroScore =
    document.getElementById(
      "hero-score"
    );

  const heroType =
    document.getElementById(
      "hero-type"
    );

  const heroYear =
    document.getElementById(
      "hero-year"
    );

  const heroWatch =
    document.getElementById(
      "hero-watch-btn"
    );

  const heroInfo =
    document.getElementById(
      "hero-info-btn"
    );


  const title =
    anime.title_english ||
    anime.title ||
    "Featured Anime";

  const image =
    anime.images?.jpg?.large_image_url ||
    anime.images?.jpg?.image_url ||
    "";

  const score =
    anime.score ?? "N/A";

  const type =
    anime.type ||
    "Anime";

  const year =
    anime.year ||
    anime.aired?.prop?.from?.year ||
    "Unknown";

  const synopsis =
    anime.synopsis ||
    "Discover this amazing anime on ITSUKI ANIMES.";

  const id =
    Number(anime.mal_id);


  /* BACKGROUND IMAGE */

  if (
    heroBackground &&
    image
  ) {

    heroBackground.style.backgroundImage =
      `
        linear-gradient(
          90deg,
          rgba(7,7,13,0.98) 0%,
          rgba(7,7,13,0.82) 38%,
          rgba(7,7,13,0.35) 72%,
          rgba(7,7,13,0.15) 100%
        ),
        url("${image}")
      `;

    heroBackground.style.backgroundSize =
      "cover";

    heroBackground.style.backgroundPosition =
      "center";
  }


  /* LABEL */

  if (heroLabel) {

    heroLabel.textContent =
      "✦ FEATURED TODAY";
  }


  /* TITLE */

  if (heroTitle) {

    heroTitle.innerHTML =
      `${title}<span>FEATURED</span>`;
  }


  /* DESCRIPTION */

  if (heroText) {

    heroText.textContent =
      synopsis.length > 180
        ? synopsis.substring(0, 180) + "..."
        : synopsis;
  }


  /* SCORE */

  if (heroScore) {

    heroScore.textContent =
      `⭐ ${score}`;
  }


  /* TYPE */

  if (heroType) {

    heroType.textContent =
      type;
  }


  /* YEAR */

  if (heroYear) {

    heroYear.textContent =
      year;
  }


  /* EXPLORE BUTTON */

  if (
    heroWatch &&
    id
  ) {

    heroWatch.onclick =
      () => openAnimeDetails(id);
  }


  /* DETAILS BUTTON */

  if (
    heroInfo &&
    id
  ) {

    heroInfo.onclick =
      () => openAnimeDetails(id);
  }
}


/* =========================
   LOAD HOMEPAGE ANIME
========================= */

async function getAnime(
  endpoint,
  elementId
) {

  const grid =
    document.getElementById(
      elementId
    );

  if (!grid) return;

  grid.innerHTML =
    "<p>Loading anime...</p>";

  try {

    const data =
      await fetchJikan(
        JIKAN_API + endpoint
      );

    if (
      !data.data ||
      data.data.length === 0
    ) {

      grid.innerHTML =
        "<p>No anime found.</p>";

      return;
    }


    /* =====================
       SET HERO FROM TRENDING
    ===================== */

    if (
      elementId ===
      "trending-grid"
    ) {

      loadHero(
        data.data[0]
      );
    }


    grid.innerHTML =
      data.data
        .map(createAnimeCard)
        .join("");

  } catch (error) {

    console.error(
      "HOME ERROR:",
      error
    );

    grid.innerHTML = `
      <p style="color:#ff8abf;">
        Unable to load anime.
      </p>
    `;
  }
}


/* =========================
   SEARCH WITH JIKAN
========================= */

async function searchJikan(
  query
) {

  const url =
    JIKAN_API +
    "/anime?q=" +
    encodeURIComponent(query) +
    "&limit=12&sfw=true";

  console.log(
    "Searching Jikan:",
    query
  );

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      "Jikan search failed: " +
      response.status
    );
  }

  const data =
    await response.json();

  return data.data || [];
}


/* =========================
   SEARCH WITH KITSU
========================= */

async function searchKitsu(
  query
) {

  const url =
    KITSU_API +
    "?filter[text]=" +
    encodeURIComponent(query) +
    "&page[limit]=12";

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      "Kitsu search failed: " +
      response.status
    );
  }

  const data =
    await response.json();

  return data.data || [];
}


/* =========================
   MAIN SEARCH
========================= */

async function searchAnime() {

  const input =
    document.getElementById(
      "search-input"
    );

  const results =
    document.getElementById(
      "search-results"
    );

  if (
    !input ||
    !results
  ) return;

  const query =
    input.value.trim();

  if (!query) {

    results.innerHTML = `
      <p style="color:#9b9bab;">
        Type an anime name to search.
      </p>
    `;

    return;
  }

  results.innerHTML = `
    <p style="color:#a78bfa;">
      🔍 Searching anime...
    </p>
  `;


  /* =====================
     TRY JIKAN FIRST
  ===================== */

  try {

    const anime =
      await searchJikan(
        query
      );

    if (
      anime &&
      anime.length > 0
    ) {

      results.innerHTML =
        anime
          .map(createAnimeCard)
          .join("");

      return;
    }

  } catch (error) {

    console.warn(
      "Jikan unavailable. Trying Kitsu...",
      error
    );
  }


  /* =====================
     KITSU FALLBACK
  ===================== */

  try {

    results.innerHTML = `
      <p style="color:#a78bfa;">
        🔍 Finding anime...
      </p>
    `;

    const anime =
      await searchKitsu(
        query
      );

    if (
      !anime ||
      anime.length === 0
    ) {

      results.innerHTML = `
        <p style="color:#9b9bab;">
          No anime found.
        </p>
      `;

      return;
    }

    results.innerHTML =
      anime
        .map(createKitsuCard)
        .join("");

  } catch (error) {

    console.error(
      "SEARCH ERROR:",
      error
    );

    results.innerHTML = `
      <p style="color:#ff8abf;">
        Search is currently unavailable.
        Please try again later.
      </p>
    `;
  }
}


/* =========================
   MOBILE MENU
========================= */

function setupMobileMenu() {

  const menuButton =
    document.querySelector(
      ".menu-btn"
    );

  const menu =
    document.getElementById(
      "mobile-menu"
    );

  const overlay =
    document.getElementById(
      "mobile-menu-overlay"
    );

  const closeButton =
    document.getElementById(
      "mobile-menu-close"
    );

  const mobileSearch =
    document.getElementById(
      "mobile-search-btn"
    );

  const links =
    document.querySelectorAll(
      ".mobile-nav-link"
    );

  if (
    !menu ||
    !overlay
  ) return;


  function openMenu() {

    menu.classList.add(
      "active"
    );

    overlay.classList.add(
      "active"
    );

    document.body.classList.add(
      "menu-open"
    );
  }


  function closeMenu() {

    menu.classList.remove(
      "active"
    );

    overlay.classList.remove(
      "active"
    );

    document.body.classList.remove(
      "menu-open"
    );
  }


  if (menuButton) {

    menuButton.addEventListener(
      "click",
      openMenu
    );
  }


  if (closeButton) {

    closeButton.addEventListener(
      "click",
      closeMenu
    );
  }


  overlay.addEventListener(
    "click",
    closeMenu
  );


  links.forEach(
    link => {

      link.addEventListener(
        "click",
        () => {

          links.forEach(
            item =>
              item.classList.remove(
                "active"
              )
          );

          link.classList.add(
            "active"
          );

          closeMenu();
        }
      );
    }
  );


  if (mobileSearch) {

    mobileSearch.addEventListener(
      "click",
      () => {

        closeMenu();

        const searchOverlay =
          document.getElementById(
            "search-overlay"
          );

        const searchInput =
          document.getElementById(
            "search-input"
          );

        if (searchOverlay) {

          searchOverlay.classList.add(
            "active"
          );
        }

        setTimeout(
          () => {

            if (searchInput) {

              searchInput.focus();
            }

          },
          150
        );
      }
    );
  }


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeMenu();
      }
    }
  );
}


/* =========================
   INITIALIZE WEBSITE
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /* =====================
       LOAD HOMEPAGE
    ===================== */

    getAnime(
      "/top/anime?limit=10",
      "trending-grid"
    );

    getAnime(
      "/top/anime?limit=10&filter=bypopularity",
      "popular-grid"
    );

    getAnime(
      "/seasons/now?limit=10",
      "new-grid"
    );


    /* =====================
       SEARCH ELEMENTS
    ===================== */

    const openSearch =
      document.getElementById(
        "open-search"
      );

    const closeSearch =
      document.getElementById(
        "close-search"
      );

    const overlay =
      document.getElementById(
        "search-overlay"
      );

    const searchButton =
      document.getElementById(
        "search-btn"
      );

    const searchInput =
      document.getElementById(
        "search-input"
      );


    /* OPEN SEARCH */

    if (
      openSearch &&
      overlay
    ) {

      openSearch.addEventListener(
        "click",
        () => {

          overlay.classList.add(
            "active"
          );

          setTimeout(
            () => {

              if (searchInput) {

                searchInput.focus();
              }

            },
            100
          );
        }
      );
    }


    /* CLOSE SEARCH */

    if (
      closeSearch &&
      overlay
    ) {

      closeSearch.addEventListener(
        "click",
        () => {

          overlay.classList.remove(
            "active"
          );
        }
      );
    }


    /* SEARCH BUTTON */

    if (searchButton) {

      searchButton.addEventListener(
        "click",
        searchAnime
      );
    }


    /* ENTER KEY */

    if (searchInput) {

      searchInput.addEventListener(
        "keydown",
        event => {

          if (
            event.key === "Enter"
          ) {

            searchAnime();
          }
        }
      );
    }


    /* MOBILE MENU */

    setupMobileMenu();

  }
);
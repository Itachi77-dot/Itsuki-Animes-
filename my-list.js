/* =========================
   GET FAVORITES
========================= */

function getFavorites() {

  return JSON.parse(
    localStorage.getItem(
      "itsukiFavorites"
    )
  ) || [];

}


/* =========================
   SAVE FAVORITES
========================= */

function saveFavorites(favorites) {

  localStorage.setItem(
    "itsukiFavorites",
    JSON.stringify(favorites)
  );

}


/* =========================
   REMOVE FAVORITE
========================= */

function removeFavorite(id) {

  let favorites =
    getFavorites();


  favorites =
    favorites.filter(
      anime => anime.id != id
    );


  saveFavorites(favorites);


  loadMyList();

}


/* =========================
   CREATE ANIME CARD
========================= */

function createMyListCard(anime) {

  return `

    <article class="anime-card">

      <img
        class="anime-image"
        src="${anime.image}"
        alt="${anime.title}"
        loading="lazy"
      >


      <div class="anime-info">

        <h3 class="anime-title">

          ${anime.title}

        </h3>


        <p class="anime-score">

          ⭐ ${anime.score}

        </p>


        <div class="mylist-actions">

          <button
            class="open-details-btn"
            onclick="openAnimeDetails(${anime.id})"
          >

            View Details

          </button>


          <button
            class="remove-btn"
            onclick="removeFavorite(${anime.id})"
          >

            Remove ❤️

          </button>

        </div>

      </div>

    </article>

  `;

}


/* =========================
   OPEN DETAILS
========================= */

function openAnimeDetails(id) {

  window.location.href =
    "anime.html?id=" + id;

}


/* =========================
   LOAD MY LIST
========================= */

function loadMyList() {

  const grid =
    document.getElementById(
      "mylist-grid"
    );


  const favorites =
    getFavorites();


  if (
    favorites.length === 0
  ) {

    grid.innerHTML = `

      <div class="empty-list">

        <div class="empty-icon">
          🤍
        </div>

        <h2>
          Your list is empty
        </h2>

        <p>
          Explore anime and add
          your favorites to My List.
        </p>

        <a
          href="index.html"
          class="watch-btn"
        >
          Explore Anime
        </a>

      </div>

    `;

    return;

  }


  grid.innerHTML =
    favorites
      .map(createMyListCard)
      .join("");

}


/* =========================
   START
========================= */

document.addEventListener(
  "DOMContentLoaded",
  loadMyList
);
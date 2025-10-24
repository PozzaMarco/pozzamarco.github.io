/*
  AI Portfolio Script
  -------------------
  - Loads publications from data/publications.json
  - Builds bookshelf dynamically
  - Handles modal open/close
  - Supports filters and keyboard navigation
*/

const state = { publications: [], filtered: [], swiper: null };
const el = (sel) => document.querySelector(sel);

// ========== INIT ==========
window.addEventListener("DOMContentLoaded", async () => {
  // Update footer year
  const yearEl = el("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Load publications
  try {
    const res = await fetch("data/publications.json", { cache: "no-store" });
    state.publications = await res.json();
  } catch (err) {
    console.error("❌ Failed to load publications.json", err);
    state.publications = [];
  }

  // Sort newest first
  state.publications.sort((a, b) => (b.year - a.year) || a.title.localeCompare(b.title));
  state.filtered = [...state.publications];

  populateYearFilter(state.publications);
  renderShelf(state.filtered);
  initFilters();
});

// ========== FILTERS ==========
function populateYearFilter(items) {
  const select = el("#filter-year");
  if (!select) return;
  const years = [...new Set(items.map(p => p.year))].sort((a, b) => b - a);
  select.innerHTML = `<option value="">All</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
}

function initFilters() {
  const yearSel = el("#filter-year");
  const queryInput = el("#filter-query");
  if (yearSel) yearSel.addEventListener("change", applyFilters);
  if (queryInput) queryInput.addEventListener("input", applyFilters);
}

function applyFilters() {
  const yearVal = el("#filter-year")?.value || "";
  const query = el("#filter-query")?.value.trim().toLowerCase() || "";
  state.filtered = state.publications.filter(p => {
    const matchYear = !yearVal || String(p.year) === yearVal;
    const text = `${p.title} ${p.authors ?? ""} ${p.abstract ?? ""} ${p.venue ?? ""}`.toLowerCase();
    const matchQuery = !query || text.includes(query);
    return matchYear && matchQuery;
  });
  renderShelf(state.filtered);
}

// ========== BOOKSHELF RENDERING ==========
function renderShelf(items) {
  const wrapper = el("#shelf-wrapper");
  if (!wrapper) return;
  wrapper.innerHTML = "";

  items.forEach((p) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide";

    const card = document.createElement("article");
    card.className = "book";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open: ${p.title}`);
    card.innerHTML = `
      <div class="book__spine"></div>
      <div class="book__title">${escapeHTML(p.title)}</div>
      <div class="book__meta">${escapeHTML(p.authors || "")}</div>
      <div class="book__abstract">${escapeHTML(p.abstract || "")}</div>
      <div class="book__actions">
        <span class="book__year">${p.year || ""}</span>
        <button class="book__btn">Details</button>
      </div>
    `;

    // Entire card clickable
    card.addEventListener("click", () => openModal(p));

    // Keyboard accessibility (Enter key)
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openModal(p);
    });

    // Prevent double opening when clicking "Details"
    card.querySelector(".book__btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(p);
    });

    slide.appendChild(card);
    wrapper.appendChild(slide);
  });

  // Initialize or refresh Swiper
  if (state.swiper) state.swiper.destroy(true, true);
  if (window.Swiper) {
    state.swiper = new Swiper(".swiper", {
      slidesPerView: 1.15,
      spaceBetween: 16,
      breakpoints: { 600: { slidesPerView: 2.2 }, 900: { slidesPerView: 3.3 }, 1100: { slidesPerView: 4.2 } },
      keyboard: { enabled: true },
      mousewheel: { forceToAxis: true },
      pagination: { el: ".swiper-pagination", clickable: true },
      navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
    });
  }
}

// ========== MODAL ==========
function openModal(paper) {
  const modal = el("#paper-modal");
  if (!modal) return;

  el("#paper-title").textContent = paper.title || "";
  el("#paper-authors").textContent = paper.authors || "";
  el("#paper-venue").textContent = [paper.venue, paper.year].filter(Boolean).join(" · ");
  el("#paper-abstract").textContent = paper.abstract || "";

  const doiEl = el("#paper-doi");
  if (doiEl) {
    if (paper.doi) {
      doiEl.href = paper.doi.startsWith("http") ? paper.doi : `https://doi.org/${paper.doi}`;
      doiEl.style.display = "inline-block";
    } else doiEl.style.display = "none";
  }

  const linkEl = el("#paper-link");
  if (linkEl) {
    if (paper.link) {
      linkEl.href = paper.link;
      linkEl.style.display = "inline-block";
    } else linkEl.style.display = "none";
  }

  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  modal.querySelectorAll("[data-close-modal]").forEach((btn) => (btn.onclick = closeModal));
  document.addEventListener("keydown", escToClose);

  // Copy BibTeX
  const bibBtn = el("#copy-bibtex");
  if (bibBtn) {
    bibBtn.onclick = () => {
      let bibtex = paper.bibtex;
      if (!bibtex) {
        bibtex = `@article{${(paper.authors?.split(" ")[0] || "ref")}${paper.year || ""},
  title={${paper.title}},
  author={${paper.authors}},
  year={${paper.year}},
  journal={${paper.venue || ""}}
}`;
      }
      navigator.clipboard.writeText(bibtex).then(() => {
        bibBtn.textContent = "Copied ✅";
        setTimeout(() => (bibBtn.textContent = "Copy BibTeX"), 2000);
      });
    };
  }
}

function closeModal() {
  const modal = el("#paper-modal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", escToClose);
}

function escToClose(e) {
  if (e.key === "Escape") closeModal();
}

function escapeHTML(str) {
  return String(str).replace(/[&<>\"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}
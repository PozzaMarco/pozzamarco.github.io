/*
  Portfolio script
  ----------------
  - Publications: data/publications.json → filterable list + detail dialog
    (optional field per paper: "selected": true → shows a "Selected" badge)
  - Timeline: data/timeline.json → single-column timeline
*/

const $ = (sel, root = document) => root.querySelector(sel);
const state = { publications: [], filtered: [], current: null, lastTrigger: null };

const ORCID_URL = "https://orcid.org/0009-0004-5798-0297";

// ========== UTILS ==========
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// Bold my name in author lists (input is already escaped)
function highlightMe(escapedAuthors) {
  return escapedAuthors.replace(/(Marco Pozza|M\. Pozza|Pozza, M(?:arco|\.)?)/g, "<strong>$1</strong>");
}

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initModal();
  initPublications();
  initTimeline();
});

// ========== PUBLICATIONS ==========
async function initPublications() {
  const list = $("#pub-list");
  if (!list) return;

  list.innerHTML = '<li class="state">Loading publications…</li>';

  try {
    state.publications = await loadJSON("data/publications.json");
  } catch (err) {
    console.error("Failed to load publications", err);
    list.innerHTML = `<li class="state state--error">Publications could not be loaded.
      The full list is on <a href="${ORCID_URL}" target="_blank" rel="noopener">ORCID</a>.</li>`;
    return;
  }

  state.publications.sort(
    (a, b) => (Number(b.year) - Number(a.year)) || String(a.title).localeCompare(String(b.title))
  );

  populateYearFilter();
  $("#filter-year")?.addEventListener("change", applyFilters);
  $("#filter-query")?.addEventListener("input", debounce(applyFilters, 250));

  // One delegated listener; titles are real <button>s, so Enter/Space work natively
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-index]");
    if (btn) openPaper(state.filtered[Number(btn.dataset.index)], btn);
  });

  applyFilters();
}

function populateYearFilter() {
  const select = $("#filter-year");
  if (!select) return;
  const years = [...new Set(state.publications.map((p) => p.year))].sort((a, b) => b - a);
  select.innerHTML = '<option value="">All</option>' +
    years.map((y) => `<option value="${escapeHTML(y)}">${escapeHTML(y)}</option>`).join("");
}

function applyFilters() {
  const yearVal = $("#filter-year")?.value || "";
  const query = $("#filter-query")?.value.trim().toLowerCase() || "";

  state.filtered = state.publications.filter((p) => {
    const matchYear = !yearVal || String(p.year) === yearVal;
    const text = `${p.title} ${p.authors ?? ""} ${p.abstract ?? ""} ${p.venue ?? ""}`.toLowerCase();
    return matchYear && (!query || text.includes(query));
  });

  renderList();
}

function renderList() {
  const list = $("#pub-list");
  const count = $("#pub-count");

  if (!state.filtered.length) {
    list.innerHTML = '<li class="state">No publications match your filters.</li>';
  } else {
    list.innerHTML = state.filtered.map((p, i) => `
      <li class="pub${p.selected ? " pub--selected" : ""}">
        <span class="pub__year">${escapeHTML(p.year)}</span>
        <div class="pub__body">
          <button type="button" class="pub__title" data-index="${i}">${escapeHTML(p.title)}</button>
          <p class="pub__meta">${highlightMe(escapeHTML(p.authors))}</p>
          <p class="pub__venue">${escapeHTML(p.venue)}${p.selected ? ' <span class="badge">Selected</span>' : ""}</p>
        </div>
      </li>`).join("");
  }

  if (count) count.textContent = `${state.filtered.length} of ${state.publications.length} publications`;
}

// ========== DIALOG ==========
// Native <dialog>: focus trap, Esc to close and the inert background come for free.
function initModal() {
  const dlg = $("#paper-modal");
  if (!dlg) return;

  dlg.addEventListener("click", (e) => {
    // Click on the backdrop (the dialog element itself) or on the close button
    if (e.target === dlg || e.target.closest("[data-close-modal]")) dlg.close();
  });

  // Give focus back to the title that opened the dialog
  dlg.addEventListener("close", () => state.lastTrigger?.focus());

  $("#copy-bibtex")?.addEventListener("click", copyBibtex);
}

function openPaper(paper, trigger) {
  const dlg = $("#paper-modal");
  if (!dlg || !paper) return;

  state.current = paper;
  state.lastTrigger = trigger;

  $("#paper-title").textContent = paper.title || "";
  $("#paper-authors").textContent = paper.authors || "";
  $("#paper-venue").textContent = [paper.venue, paper.year].filter(Boolean).join(" · ");
  $("#paper-abstract").textContent = paper.abstract || "";

  const link = $("#paper-link");
  link.hidden = !paper.link;
  if (paper.link) link.href = paper.link;

  $("#copy-bibtex").textContent = "Copy BibTeX";
  dlg.showModal();
}

async function copyBibtex() {
  const p = state.current;
  if (!p) return;
  const btn = $("#copy-bibtex");

  const key = (String(p.authors || "ref").split(/[\s,]+/)[0] || "ref") + (p.year || "");
  const bibtex = p.bibtex || `@article{${key},
  title={${p.title || ""}},
  author={${p.authors || ""}},
  year={${p.year || ""}},
  journal={${p.venue || ""}}
}`;

  try {
    await navigator.clipboard.writeText(bibtex);
    btn.textContent = "Copied ✓";
  } catch {
    btn.textContent = "Copy failed";
  }
  setTimeout(() => (btn.textContent = "Copy BibTeX"), 2000);
}

// ========== TIMELINE ==========
async function initTimeline() {
  const container = $("#timeline-container");
  if (!container) return;

  try {
    renderTimeline(await loadJSON("data/timeline.json"));
  } catch (err) {
    console.error("Failed to load timeline", err);
    container.innerHTML = '<li class="state state--error">Timeline could not be loaded.</li>';
  }
}

function renderTimeline(items) {
  const container = $("#timeline-container");

  container.innerHTML = items.map((item) => {
    const type = String(item.type || "").toLowerCase().replace(/[^a-z-]/g, "");
    return `
      <li class="tl-item">
        <span class="tl-year">${escapeHTML(item.year)}</span>
        <div class="tl-card">
          <h3 class="tl-title">${escapeHTML(item.title)}</h3>
          ${item.subtitle ? `<p class="tl-subtitle">${escapeHTML(item.subtitle)}</p>` : ""}
          ${item.description ? `<p class="tl-desc">${escapeHTML(item.description)}</p>` : ""}
          ${type ? `<span class="tl-type tl-type--${type}">${escapeHTML(type)}</span>` : ""}
        </div>
      </li>`;
  }).join("");

  revealOnScroll(container.querySelectorAll(".tl-item"));
}

// Items are visible by default; the fade-in is only added when motion is allowed.
function revealOnScroll(nodes) {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  nodes.forEach((n) => {
    n.classList.add("reveal");
    io.observe(n);
  });
}

/*
  Portfolio logic
  - Loads publications from data/publications.json
  - Renders Swiper slides (Bookshelf)
  - Handles modal open/close
  - Simple filters (year dropdown + query search)
*/

const state = { publications: [], filtered: [], swiper: null };

const el = (sel) => document.querySelector(sel);
const els = (sel) => document.querySelectorAll(sel);

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  // Footer year
  el('#year').textContent = new Date().getFullYear();

  // Load publications
  try {
    const res = await fetch('data/publications.json', { cache: 'no-store' });
    state.publications = await res.json();
  } catch (e) {
    console.error('Failed to load publications.json', e);
    state.publications = [];
  }

  // Sort by year desc (then title)
  state.publications.sort((a, b) => (b.year - a.year) || a.title.localeCompare(b.title));
  state.filtered = [...state.publications];

  populateYearFilter(state.publications);
  renderShelf(state.filtered);
  initFilters();
});

function populateYearFilter(items) {
  const years = Array.from(new Set(items.map(p => p.year))).sort((a,b) => b - a);
  const select = el('#filter-year');
  const anyOpt = document.createElement('option'); anyOpt.value = ''; anyOpt.textContent = 'All';
  select.appendChild(anyOpt);
  years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; select.appendChild(o); });
}

function initFilters() {
  el('#filter-year').addEventListener('change', applyFilters);
  el('#filter-query').addEventListener('input', applyFilters);
}

function applyFilters() {
  const byYear = el('#filter-year').value;
  const q = el('#filter-query').value.trim().toLowerCase();

  state.filtered = state.publications.filter(p => {
    const yearOk = !byYear || String(p.year) === byYear;
    const hay = `${p.title} ${p.authors ?? ''} ${p.abstract ?? ''} ${p.venue ?? ''}`.toLowerCase();
    const qOk = !q || hay.includes(q);
    return yearOk && qOk;
  });

  renderShelf(state.filtered);
}

function renderShelf(items) {
  const wrapper = el('#shelf-wrapper');
  wrapper.innerHTML = '';

  items.forEach((p, idx) => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';

    const card = document.createElement('article');
    card.className = 'book';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open: ${p.title}`);

    card.innerHTML = `
      <div class="book__spine" aria-hidden="true"></div>
      <div class="book__title">${escapeHTML(p.title)}</div>
      <div class="book__meta">${escapeHTML(p.authors || '')}</div>
      <div class="book__abstract">${escapeHTML(p.abstract || '')}</div>
      <div class="book__actions">
        <span class="book__year">${p.year || ''}</span>
        <button class="book__btn" data-index="${idx}">Details</button>
      </div>
    `;

    // Open modal on click/keyboard
    card.addEventListener('click', () => openModal(p));
    card.addEventListener('keypress', (e) => { if (e.key === 'Enter') openModal(p); });

    slide.appendChild(card);
    wrapper.appendChild(slide);
  });

  // (Re)initialize Swiper
  if (state.swiper) state.swiper.destroy(true, true);
  state.swiper = new Swiper('.swiper', {
    slidesPerView: 1.15,
    spaceBetween: 16,
    centeredSlides: false,
    breakpoints: {
      600: { slidesPerView: 2.2 },
      900: { slidesPerView: 3.3 },
      1100:{ slidesPerView: 4.2 }
    },
    keyboard: { enabled: true },
    mousewheel: { forceToAxis: true },
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }
  });
}

function openModal(p) {
  el('#paper-title').textContent = p.title || '';
  el('#paper-authors').textContent = p.authors || '';
  el('#paper-venue').textContent = [p.venue, p.year].filter(Boolean).join(' · ');
  el('#paper-abstract').textContent = p.abstract || '';

  const doiBtn = el('#paper-doi');
  if (p.doi) {
    const doiUrl = p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`;
    doiBtn.href = doiUrl;
    doiBtn.style.display = 'inline-block';
  } else {
    doiBtn.removeAttribute('href');
    doiBtn.style.display = 'none';
  }

  const linkBtn = el('#paper-link');
  if (p.link) {
    linkBtn.href = p.link;
    linkBtn.style.display = 'inline-block';
  } else {
    linkBtn.removeAttribute('href');
    linkBtn.style.display = 'none';
  }

  const modal = el('#paper-modal');
  modal.setAttribute('aria-hidden', 'false');

  // Close handlers
  els('[data-close-modal]').forEach(btn => btn.onclick = closeModal);
  document.addEventListener('keydown', escToClose);
}

function closeModal() {
  const modal = el('#paper-modal');
  modal.setAttribute('aria-hidden', 'true');
  document.removeEventListener('keydown', escToClose);
}

function escToClose(e) { if (e.key === 'Escape') closeModal(); }

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
}
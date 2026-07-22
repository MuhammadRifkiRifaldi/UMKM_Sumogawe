// ====================================================
// CONFIGURATION: GOOGLE SPREADSHEET ID
// ====================================================
// Masukkan ID Google Spreadsheet Anda di sini. Contoh: '1A2b3C4d5E6f7G8h9I0j...'
// Jika dikosongkan, website akan menggunakan database default/lokal.
const SPREADSHEET_ID = '1DPdPvEh81dw-L2jGQRnUuXbEv2MCRWU9';

// ====================================================
// DATA MASTER UMKM DESA SUMOGAWE (FALLBACK / DATA LOKAL)
// ====================================================
const DEFAULT_UMKM_DATA = [];

let umkmData = [];

// PAGINATION CONFIGURATION
const ITEMS_PER_PAGE = 6;
let currentPage = 1;
let currentFilteredData = [];

// Fungsi pembantu untuk mengubah link berbagi Google Drive menjadi link gambar langsung (Direct Download)
function cleanDriveUrl(url) {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    let fileId = '';
    if (url.includes('/file/d/')) {
      const parts = url.split('/file/d/');
      if (parts[1]) {
        fileId = parts[1].split('/')[0].split('?')[0];
      }
    } else if (url.includes('id=')) {
      const match = url.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        fileId = match[1].split('&')[0];
      }
    }
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  return url;
}

// Fungsi untuk menarik data dari Google Sheets secara asinkron
async function fetchGoogleSheetData(spreadsheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const text = await response.text();

  // Parse output JSON dari Google Visualization API
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Format respon tidak valid");
  }
  const jsonStr = text.substring(startIdx, endIdx + 1);
  const data = JSON.parse(jsonStr);

  if (!data.table || !data.table.rows) {
    throw new Error("Data tabel tidak ditemukan");
  }

  const categoryLabelMap = {
    susu: "Susu & Ternak",
    tani: "Pertanian",
    kuliner: "Kuliner",
    kerajinan: "Kerajinan & Jasa"
  };

  const parsed = [];
  let idCounter = 1;

  data.table.rows.forEach(row => {
    const cells = row.c;
    if (!cells || cells.length === 0) return;

    // Kolom A: Nama
    const name = cells[0] ? String(cells[0].v || '').trim() : '';
    if (!name || name.toLowerCase() === 'nama' || name.toLowerCase() === 'nama umkm') return; // Lewati header

    // Kolom B: Gambar
    let image = cells[1] ? String(cells[1].v || '').trim() : '';
    image = cleanDriveUrl(image) || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=600';

    // Kolom C: Kategori
    const category = cells[2] ? String(cells[2].v || '').trim().toLowerCase() : 'susu';

    // Kolom D: Alamat
    const address = cells[3] ? String(cells[3].v || '').trim() : 'Desa Sumogawe';

    // Kolom E: Jam
    const hours = cells[4] ? String(cells[4].v || '').trim() : '08:00 - 17:00 WIB';

    // Kolom F: MapsLink
    const mapsLink = cells[5] ? String(cells[5].v || '').trim() : '';

    parsed.push({
      id: idCounter++,
      name: name,
      category: category,
      categoryLabel: categoryLabelMap[category] || 'Lainnya',
      image: image,
      address: address,
      hours: hours,
      mapsLink: mapsLink,
      shortDesc: address, // Tampilkan alamat sebagai deskripsi singkat di kartu
      owner: '-',
      phone: '',
      products: '',
      desc: ''
    });
  });

  return parsed;
}

// Inisialisasi Aplikasi Utama
async function initApp() {
  const isConfigured = SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '' && SPREADSHEET_ID !== 'MASUKKAN_ID_SPREADSHEET_ANDA';

  if (isConfigured) {
    try {
      console.log('Menghubungkan ke Google Sheets dengan ID:', SPREADSHEET_ID);
      const data = await fetchGoogleSheetData(SPREADSHEET_ID);
      umkmData = data;
      // Sinkronkan ke localStorage untuk backup offline
      localStorage.setItem('umkm_database', JSON.stringify(data));
      console.log('Database berhasil dimuat dari Google Sheets!');
    } catch (err) {
      console.warn('Gagal memuat data dari Google Sheets. Menggunakan database lokal/cache.', err);
      loadLocalDatabase();
    }
  } else {
    console.log('Google Sheets tidak dikonfigurasi. Menggunakan database lokal/cache.');
    loadLocalDatabase();
  }

  renderCards(umkmData);
}

function loadLocalDatabase() {
  const localDb = localStorage.getItem('umkm_database');
  if (localDb) {
    umkmData = JSON.parse(localDb);
  } else {
    umkmData = DEFAULT_UMKM_DATA;
    localStorage.setItem('umkm_database', JSON.stringify(DEFAULT_UMKM_DATA));
  }
}

// ====================================================
// MAPS INITIALIZATION (MENGGUNAKAN GMAPS EMBED)
// ====================================================
// Inisialisasi peta dihilangkan dari JS karena kita menggunakan Google Maps Embed Iframe langsung di HTML.


// ====================================================
// DIRECTORY CARDS RENDERING
// ====================================================
const cardsGrid = document.getElementById('cards-grid');

function renderCards(data) {
  currentFilteredData = data;
  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedData = data.slice(startIndex, endIndex);

  cardsGrid.innerHTML = '';

  if (paginatedData.length === 0) {
    cardsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px 16px; color: var(--text-muted);">
        <i class="bx bx-search-alt" style="font-size: 48px; margin-bottom: 8px;"></i>
        <p>Tidak ada UMKM yang cocok dengan pencarian Anda.</p>
      </div>
    `;
    renderPagination(0);
    return;
  }

  paginatedData.forEach(item => {
    const card = document.createElement('div');
    card.className = 'umkm-card';
    card.setAttribute('onclick', `openModal(${item.id})`);

    card.innerHTML = `
      <div class="card-img-container">
        <img src="${item.image}" alt="${item.name}" loading="lazy" />
        <span class="card-category-badge badge-${item.category}">${item.categoryLabel}</span>
      </div>
      <div class="card-info">
        <h4>${item.name}</h4>
        <p class="short-desc">${item.shortDesc}</p>
        <div class="card-footer">
          <div class="location-info">
            <i class="bx bx-time-five"></i>
            <span>${item.hours}</span>
          </div>
          <div class="action-text">
            <span>Detail</span>
            <i class="bx bx-right-arrow-alt"></i>
          </div>
        </div>
      </div>
    `;

    cardsGrid.appendChild(card);
  });

  renderPagination(totalPages);
}

const paginationContainer = document.getElementById('pagination-container');

function renderPagination(totalPages) {
  if (!paginationContainer) return;

  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  let html = '';

  // Tombol Sebelumnya
  html += `
    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})" aria-label="Halaman Sebelumnya">
      <i class="bx bx-chevron-left"></i> <span>Sebelumnya</span>
    </button>
  `;

  // Nomor Halaman
  for (let i = 1; i <= totalPages; i++) {
    html += `
      <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
        ${i}
      </button>
    `;
  }

  // Tombol Selanjutnya
  html += `
    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})" aria-label="Halaman Selanjutnya">
      <span>Selanjutnya</span> <i class="bx bx-chevron-right"></i>
    </button>
  `;

  paginationContainer.innerHTML = html;
}

function changePage(page) {
  currentPage = page;
  renderCards(currentFilteredData);
  // Scroll smooth ke bagian header directory agar tidak diam di bawah
  const sectionHeader = document.querySelector('.directory-section .section-header');
  if (sectionHeader) {
    sectionHeader.scrollIntoView({ behavior: 'smooth' });
  }
}

// ====================================================
// SEARCH & FILTER LOGIC
// ====================================================
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.filter-btn');

let activeCategory = 'all';
let searchQuery = '';

function filterData() {
  currentPage = 1; // Reset ke halaman pertama saat mencari atau memfilter
  const filtered = umkmData.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery) ||
      (item.products && item.products.toLowerCase().includes(searchQuery)) ||
      (item.shortDesc && item.shortDesc.toLowerCase().includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  renderCards(filtered);
}

// Input pencarian listener
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  filterData();
});

// Tombol filter kategori listener
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Hapus kelas aktif dari tombol lama
    filterBtns.forEach(b => b.classList.remove('active'));
    // Tambah kelas aktif ke tombol yang diklik
    btn.classList.add('active');

    activeCategory = btn.getAttribute('data-category');
    filterData();
  });
});

// ====================================================
// DETAIL MODAL LOGIC
// ====================================================
const detailModal = document.getElementById('detail-modal');
const modalClose = document.getElementById('modal-close');

const modalCategory = document.getElementById('modal-category');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.getElementById('modal-image');
const modalHours = document.getElementById('modal-hours');
const modalAddress = document.getElementById('modal-address');
const modalMapsLink = document.getElementById('modal-maps-link');

// Membuka modal detail UMKM
function openModal(id) {
  const item = umkmData.find(u => u.id === id);
  if (!item) return;

  // Isi data ke elemen modal
  modalCategory.textContent = item.categoryLabel;
  modalCategory.className = `modal-category-badge badge-${item.category}`;

  modalTitle.textContent = item.name;
  modalImage.src = item.image;
  modalImage.alt = item.name;
  modalHours.textContent = item.hours;
  modalAddress.textContent = item.address;

  // Dinamisasi Tautan Google Maps (Redirect)
  modalMapsLink.href = item.mapsLink || '';

  // Tampilkan modal
  detailModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Kunci scroll halaman belakang
}

// Menutup modal
function closeModal() {
  detailModal.classList.add('hidden');
  document.body.style.overflow = ''; // Aktifkan kembali scroll halaman
}

// Close listeners
modalClose.addEventListener('click', closeModal);
detailModal.addEventListener('click', (e) => {
  // Tutup modal jika mengklik backdrop di luar kartu modal
  if (e.target === detailModal) {
    closeModal();
  }
});

// Dukungan tombol Esc untuk menutup modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !detailModal.classList.contains('hidden')) {
    closeModal();
  }
});

// ====================================================
// DARK / LIGHT THEME TOGGLE
// ====================================================
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('.theme-icon');

// Cek preferensi user yang tersimpan sebelumnya
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark') {
  document.body.classList.add('dark-theme');
  themeIcon.className = 'bx bx-sun theme-icon';
} else {
  themeIcon.className = 'bx bx-moon theme-icon';
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');

  let theme = 'light';
  if (document.body.classList.contains('dark-theme')) {
    theme = 'dark';
    themeIcon.className = 'bx bx-sun theme-icon';
  } else {
    themeIcon.className = 'bx bx-moon theme-icon';
  }

  localStorage.setItem('theme', theme);
});

// ====================================================
// INITIALIZATION ON LOAD
// ====================================================
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

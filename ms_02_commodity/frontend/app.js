// =====================================================================
// app.js - Logika halaman utama (Dashboard, Data Barang, Kategori)
// Sesuai SRS ms_02 Commodity: CRUD barang & kategori, pencarian,
// paginasi, riwayat harga, dan pembatasan akses berdasarkan peran OWNER.
// =====================================================================

// ===== KONFIGURASI =====
// Ubah API_BASE jika memakai gateway, mis. "http://localhost:3000/api/commodity"
const API_BASE = "http://localhost:3001";
const COMMODITY_API = `${API_BASE}/commodities`;  // endpoint barang
const CATEGORY_API = `${API_BASE}/categories`;    // endpoint kategori
const PAYMENT_API = "http://localhost:3002/payments"; // endpoit payment
const SALES_API = "http://localhost:3003/sales"; /// endpoint sales
const PAGE_SIZE = 10;                             // jumlah barang per halaman

// ===== AUTENTIKASI =====
// Kumpulan fungsi bantu untuk membaca data login yang disimpan di localStorage
const Auth = {
    // Mengambil token login (null jika belum login)
    token: () => localStorage.getItem("token"),

    // Mengambil data pengguna (nama & peran); null jika tidak ada atau rusak
    user() {
        try { return JSON.parse(localStorage.getItem("user") || "null"); }
        catch { return null; }
    },

    // Cek apakah pengguna berperan OWNER (satu-satunya peran yang boleh mengubah data)
    isOwner() {
        return String(Auth.user()?.role || "").toUpperCase() === "OWNER";
    },

    // Keluar: hapus data login lalu arahkan ke halaman login
    logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        location.replace("login.html");
    }
};

// Halaman ini wajib login; jika belum, langsung arahkan ke halaman login
if (!Auth.token()) {
    location.replace("login.html");
}

// Pembungkus fetch: otomatis menyertakan token dan menangani galat umum.
// - Status 401 (token tidak valid/kedaluwarsa) -> otomatis keluar
// - Status lain yang gagal -> melempar Error berisi pesan yang mudah dibaca

async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Auth.token()}`,
            ...(options.headers || {})
        }
    });

    // Baca respons server
    const result = await response.json().catch(() => ({}));

    // Jangan langsung menghapus token jika API mengembalikan 401.
    // Tampilkan informasi agar sumber masalah bisa diketahui.
    if (!response.ok) {
        console.error("API ERROR:", {
            url: url,
            status: response.status,
            response: result
        });

        if (response.status === 401) {
            throw new Error(
                `Token ditolak oleh layanan: ${url}. Periksa JWT_SECRET dan middleware autentikasi.`
            );
        }

       const msg = result.error || result.message ||
            (response.status === 403
                ? "Akun tidak memiliki izin."
                : response.status === 404
                    ? "Endpoint API tidak ditemukan."
                    : "Permintaan gagal.");

        throw new Error(msg);
    }

    return result;
}

// ===== UTILITAS =====
// Mengamankan teks sebelum disisipkan ke HTML (mencegah injeksi script / XSS)
function esc(value) {
    return String(value ?? "-")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Mengubah angka menjadi format Rupiah, mis. 15000 -> "Rp 15.000"
function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency", currency: "IDR", maximumFractionDigits: 0
    }).format(Number(value));
}

// Mengubah tanggal/waktu ISO menjadi format lokal Indonesia
function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("id-ID");
}

// Menampilkan pesan pada elemen; `type` bisa "error", "success", atau "warning"
function setMessage(el, text, type = "") {
    el.textContent = text;
    el.className = `message ${type}`.trim();
}

// Aturan bisnis SRS: harga jual di bawah HPP hanya memberi PERINGATAN,
// bukan penolakan, sehingga data tetap boleh disimpan.
function priceWarningText(cost, selling) {
    if (cost !== "" && selling !== "" && Number(selling) < Number(cost)) {
        return "Peringatan: harga jual lebih rendah dari harga pokok (HPP). Data tetap dapat disimpan.";
    }
    return "";
}

// ===== NAVIGASI =====
// Berpindah antarhalaman (dipanggil dari menu samping lewat atribut onclick)
function showPage(pageId, element) {
    const allowedPages = Auth.isOwner()
        ? [
            "dashboard",
            "barang",
            "tambahBarang",
            "kategori",
            "pembayaran",
            "riwayatTransaksi",
            "laporan"
        ]
        : [
            "barang",
            "pembayaran"
        ];

    // Batasi halaman berdasarkan role
    if (!allowedPages.includes(pageId)) {
        return;
    }

    document.querySelectorAll(".page").forEach(p => {
        p.classList.remove("active-page");
    });

    document.getElementById(pageId).classList.add("active-page");

    document.querySelectorAll(".sidebar nav a").forEach(link => {
        link.classList.remove("active");
    });

    element.classList.add("active");

    document.getElementById("pageTitle").textContent =
        element.textContent.trim();

    if (pageId === "dashboard") loadDashboard();

    if (pageId === "barang") {
        loadCategoryFilter();
        loadCommodities();
    }

    if (pageId === "tambahBarang") loadCategories();

    if (pageId === "kategori") loadCategoryTable();

        if (pageId === "pembayaran") {
            renderCart();
        }

        if (pageId === "riwayatTransaksi") {
            loadTransactionHistory();
        }

        if (pageId === "laporan") {
            loadSalesReport();
        }
}

// ===== DATA BARANG =====
// Status halaman Data Barang:
// - page    : nomor halaman yang sedang dilihat
// - hasNext : apakah masih ada halaman berikutnya
// - items   : cache barang pada halaman ini (kunci = id) untuk form ubah
const state = { page: 1, hasNext: false, items: {} };

// Menyusun query string untuk API: paginasi + pencarian (q) + filter kategori
function buildQuery() {
    const params = new URLSearchParams({ page: state.page, limit: PAGE_SIZE });
    const q = document.getElementById("searchInput").value.trim();
    const cat = document.getElementById("categoryFilter").value;
    if (q) params.set("q", q);
    if (cat) params.set("category_id", cat);
    return params.toString();
}

// Mengambil daftar barang dari API lalu menampilkannya dalam tabel
async function loadCommodities() {
    const table = document.getElementById("commodityTable");
    const message = document.getElementById("commodityMessage");
    // Kolom "Aksi" hanya ada untuk OWNER, sehingga jumlah kolom berbeda
    const colspan = 9;

    setMessage(message, "Sedang mengambil data barang...");

    try {
        const result = await apiFetch(`${COMMODITY_API}?${buildQuery()}`);
        const commodities = result.data || [];

        // Total data bisa berada di result.total / result.meta / result.pagination
        const total = result.total ?? result.meta?.total ?? result.pagination?.total;
        const totalPages = result.total_pages ?? result.meta?.total_pages ??
            result.pagination?.total_pages ??
            (total != null ? Math.ceil(total / PAGE_SIZE) : null);

        // Jika server tidak mengirim total, anggap masih ada halaman berikutnya
        // selama halaman ini terisi penuh
        state.hasNext = totalPages != null
            ? state.page < totalPages
            : commodities.length === PAGE_SIZE;

        // Simpan barang di cache agar bisa dipakai oleh form ubah
        state.items = {};
        commodities.forEach(item => { state.items[item.id] = item; });

        if (commodities.length === 0) {
            table.innerHTML = `<tr><td colspan="${colspan}">Tidak ada data barang.</td></tr>`;
            setMessage(message, "Tidak ada data barang.");
        } else {
            table.innerHTML = commodities.map(item => {
                // Label status aktif / tidak aktif (soft delete)
                const status = item.is_active
                    ? '<span class="status-active">Aktif</span>'
                    : '<span class="status-inactive">Tidak Aktif</span>';

                // Tombol aksi hanya untuk OWNER; tombol "Nonaktifkan"
                // hanya muncul pada barang yang masih aktif
                const actions = Auth.isOwner() ? `
                    <td class="actions">
                        <button class="btn-sm" data-act="edit" data-id="${esc(item.id)}">Ubah</button>
                        <button class="btn-sm btn-reset" data-act="history" data-id="${esc(item.id)}">Riwayat Harga</button>
                        ${item.is_active
                            ? `<button class="btn-sm btn-danger" data-act="deactivate" data-id="${esc(item.id)}">Nonaktifkan</button>`
                            : ""}
                    </td>` : "";

                return `
                    <tr>
                        <td>${productImage(item, "thumb")}</td>
                        <td>${esc(item.sku)}</td>
                        <td>${esc(item.name)}</td>
                        <td>${esc(item.category_name ?? item.category?.name)}</td>
                        <td>${esc(item.unit)}</td>
                        <td>${formatRupiah(item.cost_price)}</td>
                        <td>${formatRupiah(item.selling_price)}</td>
                        <td>${status}</td>

                        ${!Auth.isOwner() ? `
                            <td>
                                <button class="btn-sm"
                                    data-act="add-cart"
                                    data-id="${esc(item.id)}"
                                    ${!item.is_active ? "disabled" : ""}>
                                    + Beli
                                </button>
                            </td>
                        ` : ""}

                        ${actions}
                    </tr>`;
            }).join("");

            setMessage(message, total != null
                ? `Menampilkan ${commodities.length} dari ${total} barang.`
                : `Menampilkan ${commodities.length} barang.`);
        }

        // Perbarui informasi halaman dan status tombol sebelumnya/berikutnya
        document.getElementById("pageInfo").textContent =
            totalPages != null ? `Halaman ${state.page} / ${totalPages}` : `Halaman ${state.page}`;
        document.getElementById("prevPage").disabled = state.page <= 1;
        document.getElementById("nextPage").disabled = !state.hasNext;

    } catch (error) {
        console.error("Kesalahan:", error);
        table.innerHTML = `<tr><td colspan="${colspan}">Data barang gagal dimuat.</td></tr>`;
        setMessage(message, error.message || "Tidak dapat terhubung ke Commodity Microservice.", "error");
    }
}

// Hanya menerima link gambar yang diawali http:// atau https:// (keamanan)
function safeUrl(url) {
    return /^https?:\/\//i.test(String(url || "").trim()) ? String(url).trim() : "";
}

// Membuat HTML gambar barang. `cls` adalah kelas pembungkus ("thumb" atau "product-img").
// Jika barang tidak punya gambar, atau gambarnya gagal dimuat,
// otomatis tampil ikon kotak sebagai pengganti.
function productImage(item, cls) {
    const url = safeUrl(item.image_url);
    const pengganti = `<div class="img-placeholder"${url ? ' style="display:none"' : ""}>📦</div>`;

    if (!url) return `<div class="${cls}">${pengganti}</div>`;

    return `<div class="${cls}">
        <img src="${esc(url)}" alt="${esc(item.name)}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        ${pengganti}
    </div>`;
}

// Mengisi dashboard: kartu "Total Barang" dan katalog 8 barang terbaru


async function loadDashboard() {
    const grid = document.getElementById("productGrid");
    const message = document.getElementById("dashboardMessage");

    try {
        setMessage(message, "Memuat dashboard...");

        // =========================
        // 1. AMBIL DATA BARANG
        // =========================
        const resultBarang = await apiFetch(
            `${COMMODITY_API}?page=1&limit=8`
        );

        const items = resultBarang.data || [];

        document.getElementById("totalBarang").textContent =
            items.length;

        if (items.length === 0) {
            grid.innerHTML = "";
            setMessage(message, "Belum ada barang.");
        } else {
            grid.innerHTML = items.map(item => {
                const aktif = item.is_active
                    ? '<span class="status-active">Aktif</span>'
                    : '<span class="status-inactive">Tidak Aktif</span>';

                const hpp = Auth.isOwner()
                    ? `<div class="product-hpp">HPP: ${formatRupiah(item.cost_price)}</div>`
                    : "";

                return `
                    <article class="product-card">
                        ${productImage(item, "product-img")}
                        <div class="product-body">
                            <span class="badge-cat">
                                ${esc(item.category_name ?? item.category?.name)}
                            </span>
                            <h3>${esc(item.name)}</h3>
                            <div class="product-sku">
                                SKU: ${esc(item.sku)} &middot; ${esc(item.unit)}
                            </div>
                            <div class="product-price">
                                ${formatRupiah(item.selling_price)}
                            </div>
                            ${hpp}
                            <div class="product-status">${aktif}</div>
                        </div>
                    </article>
                `;
            }).join("");

            setMessage(message, "");
        }

    } catch (error) {
        console.error("Gagal mengambil barang:", error);
        document.getElementById("totalBarang").textContent = "Error";
        setMessage(message, "Gagal mengambil data barang.", "error");
    }

    try {
        // =========================
        // 2. AMBIL DATA PEMBAYARAN
        // =========================
        const resultPayment = await apiFetch(PAYMENT_API);

        const payments = resultPayment.data || [];

        // Hanya pembayaran PAID
        const paidPayments = payments.filter(
            p => String(p.status).toUpperCase() === "PAID"
        );

        // Hitung transaksi berdasarkan sale_id unik
        const totalTransaksi = new Set(
            paidPayments.map(p => p.sale_id).filter(Boolean)
        ).size;

        // Hitung pendapatan
        const totalPendapatan = paidPayments.reduce(
            (total, p) => total + Number(p.amount || 0),
            0
        );

        // Tampilkan hasil
        document.getElementById("totalTransaksi").textContent =
            totalTransaksi;

        document.getElementById("totalPendapatan").textContent =
            formatRupiah(totalPendapatan);

        document.getElementById("pembayaranBerhasil").textContent =
            paidPayments.length;

    } catch (error) {
        console.error("Gagal mengambil pembayaran:", error);

        document.getElementById("totalTransaksi").textContent = "Error";
        document.getElementById("totalPendapatan").textContent = "Error";
        document.getElementById("pembayaranBerhasil").textContent = "Error";
    }
}

// Pencarian dengan jeda 350 ms agar tidak memanggil API pada setiap ketikan
let searchTimer;
document.getElementById("searchInput").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.page = 1; loadCommodities(); }, 350);
});

// Mengganti filter kategori -> kembali ke halaman 1
document.getElementById("categoryFilter").addEventListener("change", () => {
    state.page = 1; loadCommodities();
});

// Tombol paginasi
document.getElementById("prevPage").addEventListener("click", () => {
    if (state.page > 1) { state.page--; loadCommodities(); }
});
document.getElementById("nextPage").addEventListener("click", () => {
    if (state.hasNext) { state.page++; loadCommodities(); }
});

// Menangani klik tombol aksi pada baris tabel (ubah / riwayat harga / nonaktifkan).
// Satu pendengar pada tabel dipakai untuk semua tombol (delegasi event).
document.getElementById("commodityTable").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.act === "edit") openEditModal(id);
    if (btn.dataset.act === "history") openHistoryModal(id);
    if (btn.dataset.act === "deactivate") deactivateCommodity(id);
});

// Menonaktifkan barang (soft delete: data tidak dihapus dari database)
async function deactivateCommodity(id) {
    const item = state.items[id];
    if (!confirm(`Nonaktifkan barang "${item?.name}"? Data tidak dihapus, hanya dinonaktifkan.`)) return;

    try {
        await apiFetch(`${COMMODITY_API}/${id}`, { method: "DELETE" });
        loadCommodities();
    } catch (error) {
        setMessage(document.getElementById("commodityMessage"), error.message, "error");
    }
}

// ===== JENDELA POP-UP (MODAL) =====
// Membuka jendela pop-up dengan judul dan isi HTML tertentu
function openModal(title, html) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = html;
    document.getElementById("modal").hidden = false;
}

// Menutup jendela pop-up
function closeModal() {
    document.getElementById("modal").hidden = true;
}

// Klik pada area gelap di luar kotak pop-up juga menutupnya
document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
});

// Membuka form ubah barang (PUT). Perubahan harga akan dicatat server
// ke tabel price_histories dalam satu transaksi.
async function openEditModal(id) {
    const item = state.items[id];
    if (!item) return;

    // Ambil daftar kategori untuk pilihan kategori pada form
    let categories = [];
    try { categories = (await apiFetch(CATEGORY_API)).data || []; } catch { /* diabaikan; pilihan kosong */ }

    const options = categories.map(c =>
        `<option value="${esc(c.id)}" ${c.id === item.category_id ? "selected" : ""}>${esc(c.name)}</option>`
    ).join("");

    openModal(`Ubah Barang - ${item.sku}`, `
        <form id="editForm">
            <div class="form-group"><label>SKU</label>
                <input id="e_sku" value="${esc(item.sku)}" required></div>
            <div class="form-group"><label>Nama Barang</label>
                <input id="e_name" value="${esc(item.name)}" required></div>
            <div class="form-group"><label>Kategori</label>
                <select id="e_category" required>${options}</select></div>
            <div class="form-group"><label>Satuan</label>
                <input id="e_unit" value="${esc(item.unit)}" required></div>
            <div class="form-group"><label>Harga Pokok (HPP)</label>
                <input id="e_cost" type="number" min="0" step="0.01" value="${esc(item.cost_price)}" required></div>
            <div class="form-group"><label>Harga Jual</label>
                <input id="e_sell" type="number" min="0" step="0.01" value="${esc(item.selling_price)}" required></div>
            <div class="form-group"><label>Link Gambar (opsional)</label>
                <input id="e_image" type="url" value="${esc(item.image_url ?? "")}" placeholder="https://contoh.com/gambar.jpg"></div>
            <p id="e_warn" class="message warning"></p>
            <div class="form-actions">
                <button type="submit">Simpan Perubahan</button>
                <button type="button" class="btn-reset" onclick="closeModal()">Batal</button>
            </div>
            <p id="e_msg" class="message"></p>
        </form>`);

    // Tampilkan peringatan harga secara langsung saat nilai diubah
    const warn = () => {
        document.getElementById("e_warn").textContent =
            priceWarningText(document.getElementById("e_cost").value, document.getElementById("e_sell").value);
    };
    document.getElementById("e_cost").addEventListener("input", warn);
    document.getElementById("e_sell").addEventListener("input", warn);
    warn();

    // Kirim perubahan ke server
    document.getElementById("editForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("e_msg");
        try {
            await apiFetch(`${COMMODITY_API}/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    sku: document.getElementById("e_sku").value.trim(),
                    name: document.getElementById("e_name").value.trim(),
                    category_id: document.getElementById("e_category").value,
                    unit: document.getElementById("e_unit").value.trim(),
                    cost_price: Number(document.getElementById("e_cost").value),
                    selling_price: Number(document.getElementById("e_sell").value),
                    image_url: document.getElementById("e_image").value.trim() || null
                })
            });
            closeModal();
            loadCommodities();
        } catch (error) {
            setMessage(msg, error.message, "error");
        }
    });
}

// Menampilkan riwayat perubahan harga sebuah barang (khusus OWNER)
async function openHistoryModal(id) {
    const item = state.items[id];
    openModal(`Riwayat Harga - ${item?.name ?? ""}`, "<p class='message'>Memuat riwayat...</p>");

    try {
        const result = await apiFetch(`${COMMODITY_API}/${id}/pricehistories`);
        const rows = result.data || [];

        document.getElementById("modalBody").innerHTML = rows.length === 0
            ? "<p class='message'>Belum ada riwayat perubahan harga.</p>"
            : `<div class="table-container"><table style="min-width:480px">
                <thead><tr><th>Berlaku Sejak</th><th>HPP</th><th>Harga Jual</th><th>Diubah Oleh</th></tr></thead>
                <tbody>${rows.map(r => `
                    <tr>
                        <td>${esc(formatDate(r.effective_at))}</td>
                        <td>${formatRupiah(r.cost_price)}</td>
                        <td>${formatRupiah(r.selling_price)}</td>
                        <td>${esc(r.changed_by)}</td>
                    </tr>`).join("")}
                </tbody></table></div>`;
    } catch (error) {
        document.getElementById("modalBody").innerHTML =
            `<p class="message error">${esc(error.message)}</p>`;
    }
}

// ===== KATEGORI =====
// Mengambil seluruh kategori dari API
async function fetchCategories() {
    const result = await apiFetch(CATEGORY_API);
    return result.data || [];
}

// Mengisi daftar pilihan kategori pada form Tambah Barang
async function loadCategories() {
    const select = document.getElementById("category_id");
    select.innerHTML = `<option value="">Memuat kategori...</option>`;

    try {
        const categories = await fetchCategories();
        select.innerHTML = `<option value="">Pilih kategori</option>` +
            categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    } catch (error) {
        console.error("Kesalahan kategori:", error);
        select.innerHTML = `<option value="">Gagal memuat kategori</option>`;
    }
}

// Mengisi daftar pilihan filter kategori pada halaman Data Barang
// (pilihan yang sedang aktif dipertahankan)
async function loadCategoryFilter() {
    const select = document.getElementById("categoryFilter");
    const current = select.value;
    try {
        const categories = await fetchCategories();
        select.innerHTML = `<option value="">Semua kategori</option>` +
            categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
        select.value = current;
    } catch { /* jika gagal, filter tetap memakai pilihan bawaan */ }
}

// Cache kategori (kunci = id) untuk mengisi form saat mengubah kategori
let categoryCache = {};

// Menampilkan tabel kategori pada halaman Kategori (CRUD, khusus OWNER)
async function loadCategoryTable() {
    const table = document.getElementById("categoryTable");
    try {
        const categories = await fetchCategories();
        categoryCache = {};
        categories.forEach(c => { categoryCache[c.id] = c; });

        table.innerHTML = categories.length === 0
            ? `<tr><td colspan="3">Belum ada kategori.</td></tr>`
            : categories.map(c => `
                <tr>
                    <td>${esc(c.name)}</td>
                    <td>${esc(c.description)}</td>
                    <td class="actions">
                        <button class="btn-sm" data-act="edit" data-id="${esc(c.id)}">Ubah</button>
                        <button class="btn-sm btn-danger" data-act="delete" data-id="${esc(c.id)}">Hapus</button>
                    </td>
                </tr>`).join("");
    } catch (error) {
        table.innerHTML = `<tr><td colspan="3">Gagal memuat kategori.</td></tr>`;
        setMessage(document.getElementById("categoryMessage"), error.message, "error");
    }
}

// Mengosongkan form kategori dan mengembalikannya ke mode "tambah"
function resetCategoryForm() {
    document.getElementById("categoryForm").reset();
    document.getElementById("categoryId").value = "";
    document.getElementById("categorySubmit").textContent = "Simpan";
    document.getElementById("categoryCancel").hidden = true;
}

document.getElementById("categoryCancel").addEventListener("click", resetCategoryForm);

// Menangani tombol Ubah / Hapus pada tabel kategori (delegasi event)
document.getElementById("categoryTable").addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    const message = document.getElementById("categoryMessage");

    // Ubah: isi form dengan data kategori dan ganti ke mode "perbarui"
    if (btn.dataset.act === "edit") {
        const c = categoryCache[id];
        document.getElementById("categoryId").value = id;
        document.getElementById("categoryName").value = c.name ?? "";
        document.getElementById("categoryDesc").value = c.description ?? "";
        document.getElementById("categorySubmit").textContent = "Perbarui";
        document.getElementById("categoryCancel").hidden = false;
    }

    // Hapus: minta konfirmasi dulu; server dapat menolak jika kategori masih dipakai
    if (btn.dataset.act === "delete") {
        if (!confirm(`Hapus kategori "${categoryCache[id]?.name}"?`)) return;
        try {
            await apiFetch(`${CATEGORY_API}/${id}`, { method: "DELETE" });
            setMessage(message, "Kategori dihapus.", "success");
            loadCategoryTable();
        } catch (error) {
            setMessage(message, error.message, "error");
        }
    }
});

// Simpan kategori: POST jika baru, PUT jika sedang mengubah
document.getElementById("categoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("categoryMessage");
    const id = document.getElementById("categoryId").value;

    try {
        await apiFetch(id ? `${CATEGORY_API}/${id}` : CATEGORY_API, {
            method: id ? "PUT" : "POST",
            body: JSON.stringify({
                name: document.getElementById("categoryName").value.trim(),
                description: document.getElementById("categoryDesc").value.trim()
            })
        });
        setMessage(message, id ? "Kategori diperbarui." : "Kategori ditambahkan.", "success");
        resetCategoryForm();
        loadCategoryTable();
    } catch (error) {
        setMessage(message, error.message, "error");
    }
});

// ===== TAMBAH BARANG =====
// Memperbarui teks peringatan harga pada form tambah barang
function updateAddWarning() {
    document.getElementById("priceWarning").textContent = priceWarningText(
        document.getElementById("cost_price").value,
        document.getElementById("selling_price").value
    );
}
document.getElementById("cost_price").addEventListener("input", updateAddWarning);
document.getElementById("selling_price").addEventListener("input", updateAddWarning);

// Setelah form direset, nilai input baru kosong pada siklus berikutnya,
// sehingga peringatan diperbarui dengan jeda 0 ms
document.getElementById("commodityForm").addEventListener("reset", () => {
    setTimeout(updateAddWarning, 0);
});

// Simpan barang baru (POST). SKU yang sama akan ditolak server (409).
document.getElementById("commodityForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("formMessage");

    try {
        await apiFetch(COMMODITY_API, {
            method: "POST",
            body: JSON.stringify({
                sku: document.getElementById("sku").value.trim(),
                name: document.getElementById("name").value.trim(),
                category_id: document.getElementById("category_id").value,
                unit: document.getElementById("unit").value.trim(),
                cost_price: Number(document.getElementById("cost_price").value),
                selling_price: Number(document.getElementById("selling_price").value),
                image_url: document.getElementById("image_url").value.trim() || null
            })
        });
        setMessage(message, "Barang berhasil disimpan.", "success");
        event.target.reset();
        updateAddWarning();
    } catch (error) {
        setMessage(message, error.message, "error");
    }
});
// ======================================================
// RIWAYAT TRANSAKSI DAN PEMBAYARAN
// ======================================================

async function loadTransactionHistory() {
    const table = document.getElementById("transactionHistoryTable");
    const message = document.getElementById("transactionHistoryMessage");

    table.innerHTML = `
        <tr>
            <td colspan="7">Memuat riwayat transaksi...</td>
        </tr>
    `;

    try {
        // Mengambil seluruh data pembayaran
        const result = await apiFetch(PAYMENT_API);

        const payments = result.data || [];

        // Mengurutkan berdasarkan tanggal terbaru
        payments.sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

        // Menghitung pembayaran berhasil
        const paidPayments = payments.filter(
            item => String(item.status).toUpperCase() === "PAID"
        );

        // Menghitung total uang dari pembayaran berhasil
        const totalPaid = paidPayments.reduce(
            (total, item) => total + Number(item.amount || 0),
            0
        );

        // Menampilkan ringkasan
        document.getElementById("historyTransactionTotal").textContent =
            payments.length;

        document.getElementById("historyPaid").textContent =
            paidPayments.length;

        document.getElementById("historyTotal").textContent =
            formatRupiah(totalPaid);

        if (payments.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="7">Belum ada transaksi.</td>
                </tr>
            `;

            setMessage(message, "Belum ada riwayat transaksi.");
            return;
        }

        // Menampilkan daftar transaksi dan pembayaran
        table.innerHTML = payments.map((payment, index) => `
            <tr>
                <td>${index + 1}</td>

                <td>${esc(payment.sale_id)}</td>

                <td>${esc(payment.id)}</td>

                <td>
                    ${formatDate(payment.paid_at || payment.created_at)}
                </td>

                <td>${esc(payment.method)}</td>

                <td>${formatRupiah(payment.amount)}</td>

                <td>
                    ${esc(payment.status)}
                </td>
            </tr>
        `).join("");

        setMessage(message, `Berhasil menampilkan ${payments.length} data transaksi.`);

    } catch (error) {
        console.error("Gagal mengambil riwayat:", error);

        table.innerHTML = `
            <tr>
                <td colspan="7">Gagal mengambil data transaksi.</td>
            </tr>
        `;

        setMessage(message, error.message, "error");
    }
}


// ======================================================
// LAPORAN PENJUALAN DAN PEMBAYARAN
// ======================================================

function getReportDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

async function loadSalesReport() {
    const table = document.getElementById("reportTable");
    const message = document.getElementById("reportMessage");

    if (!table) return;

    table.innerHTML = `
        <tr>
            <td colspan="7">Memuat laporan...</td>
        </tr>
    `;

    try {
        // Mengambil data pembayaran dari Payment Microservice
        const result = await apiFetch(PAYMENT_API);

        const payments = result.data || [];

        // Mengambil tanggal filter
        const startDate =
            document.getElementById("reportStartDate").value;

        const endDate =
            document.getElementById("reportEndDate").value;

        if (startDate && endDate && startDate > endDate) {
            throw new Error("Tanggal awal tidak boleh melebihi tanggal akhir.");
        }

        // Filter berdasarkan tanggal pembayaran dibuat
        const filteredPayments = payments.filter(payment => {
            const date = getReportDate(
                payment.created_at || payment.paid_at
            );

            if (!date) return false;

            if (startDate && date < startDate) return false;
            if (endDate && date > endDate) return false;

            return true;
        });

        // Pembayaran berhasil
        const paid = filteredPayments.filter(payment =>
            String(payment.status).toUpperCase() === "PAID"
        );

        // Pembayaran pending
        const pending = filteredPayments.filter(payment =>
            String(payment.status).toUpperCase() === "PENDING"
        );

        // Total pendapatan hanya dari pembayaran PAID
        const income = paid.reduce(
            (total, payment) =>
                total + Number(payment.amount || 0),
            0
        );

        // Hitung transaksi unik
        const transactionCount = new Set(
            paid.map(payment => payment.sale_id).filter(Boolean)
        ).size;

        // Pembayaran CASH
        const cashPayments = paid.filter(payment =>
            String(payment.method).toUpperCase() === "CASH"
        );

        const cashIncome = cashPayments.reduce(
            (total, payment) =>
                total + Number(payment.amount || 0),
            0
        );

        // Pembayaran QRIS
        const qrisPayments = paid.filter(payment =>
            String(payment.method).toUpperCase() === "QRIS"
        );

        const qrisIncome = qrisPayments.reduce(
            (total, payment) =>
                total + Number(payment.amount || 0),
            0
        );

        // Tampilkan ringkasan
        document.getElementById("reportIncome").textContent =
            formatRupiah(income);

        document.getElementById("reportTransactions").textContent =
            transactionCount;

        document.getElementById("reportPaid").textContent =
            paid.length;

        document.getElementById("reportPending").textContent =
            pending.length;

        document.getElementById("reportCashIncome").textContent =
            formatRupiah(cashIncome);

        document.getElementById("reportCashCount").textContent =
            `${cashPayments.length} transaksi`;

        document.getElementById("reportQrisIncome").textContent =
            formatRupiah(qrisIncome);

        document.getElementById("reportQrisCount").textContent =
            `${qrisPayments.length} transaksi`;

        // Urutkan dari transaksi terbaru
        filteredPayments.sort((a, b) =>
            new Date(b.created_at || b.paid_at) -
            new Date(a.created_at || a.paid_at)
        );

        // Tampilkan tabel
        if (filteredPayments.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="7">Tidak ada transaksi pada periode ini.</td>
                </tr>
            `;
        } else {
            table.innerHTML = filteredPayments.map((payment, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${esc(payment.sale_id)}</td>
                    <td>${esc(payment.id)}</td>
                    <td>${formatDate(
                        payment.paid_at || payment.created_at
                    )}</td>
                    <td>${esc(payment.method)}</td>
                    <td>${formatRupiah(payment.amount)}</td>
                    <td>${esc(payment.status)}</td>
                </tr>
            `).join("");
        }

        setMessage(
            message,
            `Laporan berhasil dimuat. ${filteredPayments.length} pembayaran ditemukan.`,
            "success"
        );

    } catch (error) {
        console.error("Gagal memuat laporan:", error);

        table.innerHTML = `
            <tr>
                <td colspan="7">Gagal mengambil laporan.</td>
            </tr>
        `;

        setMessage(message, error.message, "error");
    }
}

// Reset filter tanggal
function resetSalesReport() {
    document.getElementById("reportStartDate").value = "";
    document.getElementById("reportEndDate").value = "";

    loadSalesReport();
}


// ===== INISIALISASI =====
// Dijalankan satu kali saat halaman selesai dimuat
(function init() {
    const user = Auth.user();

    document.getElementById("userName").textContent =
        user?.name || user?.username || "Pengguna";

    document.getElementById("userRole").textContent =
        user?.role || "-";

    if (!Auth.isOwner()) {
        document.querySelectorAll("[data-owner-only], .owner-only")
            .forEach(el => {
                el.hidden = true;
            });

        // Sembunyikan halaman yang bukan untuk pelanggan
        document.querySelectorAll(".page").forEach(page => {
            if (!["barang", "pembayaran"].includes(page.id)) {
                page.hidden = true;
            }
        });

        // Pelanggan langsung masuk ke halaman barang
        const menuBarang = document.querySelector(
            '.sidebar nav a[onclick*="barang"]'
        );

        showPage("barang", menuBarang);

    } else {
    // Sembunyikan kolom Beli khusus OWNER
                document.querySelectorAll("[data-customer-only]")
                    .forEach(el => {
                        el.hidden = true;
                    });

                loadDashboard();
            }
})();





// ======================================================
// FITUR KERANJANG DAN CHECKOUT BELIBELI
// ======================================================

let shoppingCart = [];
let activePaymentId = null;
let activeSaleId = null;
let activeSale = null;
let qrisCountdownInterval = null;
let activePaymentMethod = null;
let activeCashReceived = 0;

// Format rupiah menggunakan fungsi formatRupiah yang sudah ada
function getCartTotal() {
    return shoppingCart.reduce(
        (total, item) =>
            total + Number(item.selling_price) * item.quantity,
        0
    );
}

// Menambahkan barang ke keranjang
function addToCart(id) {
    const item = state.items[id];

    if (!item || !item.is_active) {
        alert("Barang tidak tersedia.");
        return;
    }

    const existing = shoppingCart.find(
        p => p.id === item.id
    );

    if (existing) {
        existing.quantity++;
    } else {
        shoppingCart.push({
            id: item.id,
            sku: item.sku,
            name: item.name,
            selling_price: Number(item.selling_price),
            quantity: 1
        });
    }

    renderCart();

    alert(`${item.name} berhasil ditambahkan ke keranjang.`);
}

// Menampilkan keranjang
function renderCart() {
    const table = document.getElementById("cartTable");

    if (!table) return;

    if (shoppingCart.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="5">Keranjang masih kosong.</td>
            </tr>
        `;
    } else {
        table.innerHTML = shoppingCart.map(item => `
            <tr>
                <td>
                    ${esc(item.name)}
                    <br>
                    <small>${esc(item.sku)}</small>
                </td>

                <td>${formatRupiah(item.selling_price)}</td>

                <td>
                    <button class="btn-sm"
                        onclick="changeCartQty('${esc(item.id)}', -1)">
                        -
                    </button>

                    ${item.quantity}

                    <button class="btn-sm"
                        onclick="changeCartQty('${esc(item.id)}', 1)">
                        +
                    </button>
                </td>

                <td>
                    ${formatRupiah(
                        item.selling_price * item.quantity
                    )}
                </td>

                <td>
                    <button class="btn-sm btn-danger"
                        onclick="removeCartItem('${esc(item.id)}')">
                        Hapus
                    </button>
                </td>
            </tr>
        `).join("");
    }

    document.getElementById("cartTotal").textContent =
        formatRupiah(getCartTotal());
}

// Mengubah jumlah barang
function changeCartQty(id, amount) {
    const item = shoppingCart.find(p => p.id === id);

    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
        removeCartItem(id);
        return;
    }

    renderCart();
}

// Menghapus barang
function removeCartItem(id) {
    shoppingCart = shoppingCart.filter(
        item => item.id !== id
    );

    renderCart();
}

// Mengosongkan keranjang
function clearCart() {
    if (shoppingCart.length === 0) return;

    if (!confirm("Kosongkan semua keranjang?")) return;

    shoppingCart = [];
    renderCart();
}

// ======================================================
// PROSES CHECKOUT
// ======================================================


async function processCheckout() {
    const message = document.getElementById("paymentMessage");
    const button = document.getElementById("checkoutButton");

    if (shoppingCart.length === 0) {
        setMessage(message, "Keranjang belanja masih kosong.", "error");
        return;
    }

    const method = document.getElementById("paymentMethod").value;
    const total = getCartTotal();

    if (method === "CASH") {
        const received = Number(
            document.getElementById("cashReceived").value
        );

        if (!Number.isFinite(received) || received < total) {
            setMessage(
                message,
                "Uang yang diterima tidak mencukupi.",
                "error"
            );
            return;
        }

        activeCashReceived = received;
    }

    button.disabled = true;
    button.textContent = "Memproses...";

    document.getElementById("qrisResult").hidden = true;
    document.getElementById("cashActions").hidden = true;
    document.getElementById("receiptPanel").hidden = true;

    try {
        // 1. Membuat transaksi penjualan
        const saleResult = await apiFetch(SALES_API, {
            method: "POST",
            body: JSON.stringify({
                items: shoppingCart.map(item => ({
                    commodity_id: item.id,
                    quantity: item.quantity
                }))
            })
        });

        const sale = saleResult.data;

        activeSale = sale;
        activeSaleId = sale.id;

        // 2. Membuat transaksi pembayaran
        const paymentResult = await apiFetch(PAYMENT_API, {
            method: "POST",
            headers: {
                "Idempotency-Key": `SALE-${sale.id}`
            },
            body: JSON.stringify({
                sale_id: sale.id,
                retail_id: sale.retail_id,
                method: method,
                amount: Number(sale.total_amount)
            })
        });

        const payment = paymentResult.data;

        activePaymentId = payment.id;
        activePaymentMethod = method;

        // Sembunyikan tombol checkout selama pembayaran menunggu
        button.hidden = true;

        document.getElementById("paymentMethod").disabled = true;

        // 3. Pembayaran CASH
        if (method === "CASH") {
            document.getElementById("cashActions").hidden = false;

            setMessage(
                message,
                "Transaksi tunai dibuat. Silakan konfirmasi pembayaran.",
                "success"
            );

            return;
        }

        // 4. Pembayaran QRIS
        const qrisResult = await apiFetch(
            `${PAYMENT_API}/${payment.id}/qris`,
            { method: "POST" }
        );

        const expiredAt = qrisResult.data?.expired_at;

        if (!expiredAt) {
            throw new Error(
                "Waktu kedaluwarsa QRIS tidak ditemukan dari server."
            );
        }

        document.getElementById("qrisImage").src =
            qrisResult.qr_image;

        document.getElementById("qrisInfo").textContent =
            `Total pembayaran: ${formatRupiah(sale.total_amount)}.`;

        document.getElementById("qrisResult").hidden = false;

        startQrisCountdown(expiredAt);

        setMessage(
            message,
            "QRIS berhasil dibuat. Silakan lakukan pemindaian.",
            "success"
        );

    } catch (error) {
        console.error(error);

        setMessage(message, error.message, "error");

        // Jika transaksi sudah dibuat tetapi proses berikutnya gagal,
        // pembayaran masih dapat dibatalkan melalui endpoint gagal.
        if (activePaymentId) {
            document.getElementById("cashActions").hidden = false;
            document.getElementById("checkoutButton").hidden = true;
        } else {
            button.hidden = false;
        }

    } finally {
        button.disabled = false;
        button.textContent = "Proses Pembayaran";
    }
}



async function confirmCashPayment() {
    if (!activePaymentId || !activeSaleId) {
        alert("Transaksi pembayaran tidak ditemukan.");
        return;
    }

    const buttons = document.querySelectorAll("#cashActions button");

    buttons.forEach(button => button.disabled = true);

    try {
        const cashResult = await apiFetch(
            `${PAYMENT_API}/${activePaymentId}/cash`,
            {
                method: "POST",
                body: JSON.stringify({
                    received_amount: activeCashReceived
                })
            }
        );

        // Menandai transaksi penjualan selesai
        await apiFetch(
            `${SALES_API}/${activeSaleId}/paid`,
            { method: "PATCH" }
        );

        showReceipt(
            activeSale,
            cashResult.data.payment,
            cashResult.data.change_amount,
            activeCashReceived
        );

    } catch (error) {
        setMessage(
            document.getElementById("paymentMessage"),
            error.message,
            "error"
        );

    } finally {
        buttons.forEach(button => button.disabled = false);
    }
}



async function failCurrentPayment() {
    if (!activePaymentId) {
        alert("Pembayaran tidak ditemukan.");
        return;
    }

    const confirmation = confirm(
        "Apakah kamu yakin ingin menandai pembayaran ini sebagai gagal?"
    );

    if (!confirmation) return;

    try {
        await apiFetch(
            `${PAYMENT_API}/${activePaymentId}/fail`,
            { method: "POST" }
        );

        stopQrisCountdown();

        document.getElementById("qrisResult").hidden = true;
        document.getElementById("cashActions").hidden = true;

        document.getElementById("qrisImage").src = "";

        document.getElementById("checkoutButton").hidden = false;
        document.getElementById("paymentMethod").disabled = false;

        setMessage(
            document.getElementById("paymentMessage"),
            "Pembayaran gagal. Silakan lakukan transaksi baru.",
            "error"
        );

        activePaymentId = null;
        activeSaleId = null;
        activeSale = null;
        activePaymentMethod = null;

    } catch (error) {
        setMessage(
            document.getElementById("paymentMessage"),
            error.message,
            "error"
        );
    }
}




function stopQrisCountdown() {
    if (qrisCountdownInterval) {
        clearInterval(qrisCountdownInterval);
        qrisCountdownInterval = null;
    }
}


function startQrisCountdown(expiredAt) {
    stopQrisCountdown();

    const countdown = document.getElementById("qrisCountdown");
    const simulateButton = document.getElementById("simulateQrisButton");

    simulateButton.disabled = false;

    async function updateCountdown() {
        const remaining = new Date(expiredAt).getTime() - Date.now();

        if (remaining <= 0) {
            stopQrisCountdown();

            countdown.textContent = "Waktu pembayaran habis.";

            await checkQrisExpiration();
            return;
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        countdown.textContent =
            `Sisa waktu: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    updateCountdown();

    qrisCountdownInterval = setInterval(
        updateCountdown,
        1000
    );
}


async function checkQrisExpiration() {
    if (!activePaymentId) return;

    try {
        const result = await apiFetch(
            `${PAYMENT_API}/${activePaymentId}/qris/expire`,
            { method: "POST" }
        );

        if (result.status === "EXPIRED" || result.expired === true) {
            finishExpiredQris();
            return;
        }

        if (result.status === "PAID") {
            document.getElementById("qrisCountdown").textContent =
                "Pembayaran sudah berhasil.";
            return;
        }

        if (result.status === "FAILED") {
            finishFailedQris();
            return;
        }

        // Jika server masih menyatakan PENDING, periksa lagi.
        qrisCountdownInterval = setInterval(
            checkQrisExpiration,
            1000
        );

    } catch (error) {
        console.error("Pemeriksaan QRIS gagal:", error);

        document.getElementById("qrisCountdown").textContent =
            "Gagal memeriksa masa berlaku. Periksa koneksi server.";
    }
}


function finishExpiredQris() {
    stopQrisCountdown();

    document.getElementById("qrisImage").src = "";
    document.getElementById("qrisResult").hidden = true;

    document.getElementById("checkoutButton").hidden = false;
    document.getElementById("paymentMethod").disabled = false;

    setMessage(
        document.getElementById("paymentMessage"),
        "QRIS EXPIRED. Kode pembayaran sudah tidak berlaku.",
        "error"
    );

    activePaymentId = null;
    activeSaleId = null;
    activeSale = null;
    activePaymentMethod = null;
}


function finishFailedQris() {
    stopQrisCountdown();

    document.getElementById("qrisImage").src = "";
    document.getElementById("qrisResult").hidden = true;

    document.getElementById("checkoutButton").hidden = false;
    document.getElementById("paymentMethod").disabled = false;

    setMessage(
        document.getElementById("paymentMessage"),
        "Pembayaran QRIS berstatus FAILED.",
        "error"
    );

    activePaymentId = null;
    activeSaleId = null;
    activeSale = null;
    activePaymentMethod = null;
}


// ======================================================
// SIMULASI PEMBAYARAN QRIS
// ======================================================


async function simulatePayment() {
    if (!activePaymentId || !activeSaleId) {
        alert("Transaksi pembayaran tidak ditemukan.");
        return;
    }

    const button = document.getElementById("simulateQrisButton");

    button.disabled = true;
    button.textContent = "Memverifikasi...";

    try {
        const result = await apiFetch(
            `${PAYMENT_API}/${activePaymentId}/qris/simulate`,
            { method: "POST" }
        );

        if (result.status === "EXPIRED") {
            finishExpiredQris();
            return;
        }

        if (!result.payment ||
            result.payment.status !== "PAID") {
            throw new Error("Pembayaran belum berhasil.");
        }

        stopQrisCountdown();

        await apiFetch(
            `${SALES_API}/${activeSaleId}/paid`,
            { method: "PATCH" }
        );

        showReceipt(
            activeSale,
            result.payment,
            0,
            0
        );

    } catch (error) {
        setMessage(
            document.getElementById("paymentMessage"),
            error.message,
            "error"
        );

    } finally {
        // Jangan mengaktifkan kembali tombol jika QRIS sudah tidak berlaku.
        if (activePaymentId) {
            button.disabled = false;
            button.textContent = "Simulasikan Pembayaran Berhasil";
        }
    }
}


// ======================================================
// BUKTI PEMBAYARAN
// ======================================================

function showReceipt(sale, payment, change, received) {
    stopQrisCountdown();

    document.getElementById("cashActions").hidden = true;
    document.getElementById("checkoutButton").hidden = false;
    document.getElementById("paymentMethod").disabled = false;
    const panel = document.getElementById("receiptPanel");
    const content = document.getElementById("receiptContent");

    const itemRows = sale.items.map(item => `
        <tr>
            <td>${esc(item.name)}</td>
            <td>${item.quantity}</td>
            <td>${formatRupiah(item.subtotal)}</td>
        </tr>
    `).join("");

    content.innerHTML = `
        <p><strong>Nomor transaksi:</strong> ${esc(sale.id)}</p>
        <p><strong>Nomor pembayaran:</strong> ${esc(payment.id)}</p>
        <p><strong>Tanggal:</strong> ${formatDate(payment.paid_at)}</p>
        <p><strong>Metode:</strong> ${esc(payment.method)}</p>
        <p><strong>Status:</strong> PAID</p>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Barang</th>
                        <th>Jumlah</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>${itemRows}</tbody>
            </table>
        </div>

        <h3>Total: ${formatRupiah(sale.total_amount)}</h3>

        ${payment.method === "CASH" ? `
            <p>Uang diterima: ${formatRupiah(received)}</p>
            <p>Kembalian: ${formatRupiah(change)}</p>
        ` : ""}
    `;

    panel.hidden = false;

    document.getElementById("qrisResult").hidden = true;

    setMessage(
        document.getElementById("paymentMessage"),
        "Pembayaran berhasil!",
        "success"
    );

    shoppingCart = [];
    renderCart();

    document.getElementById("cashReceived").value = "";

    document.getElementById("simulateQrisButton").disabled = true;

    if (Auth.isOwner()) {
        loadDashboard();
    }
}

// Mencetak bukti transaksi
function printReceipt() {
    const content =
        document.getElementById("receiptContent").innerHTML;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
        alert("Izinkan pop-up untuk mencetak struk.");
        return;
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>Struk BeliBeli</title>
            <style>
                body { font-family: Arial; padding: 25px; }
                table { width: 100%; border-collapse: collapse; }
                td, th { border: 1px solid #ddd; padding: 8px; }
            </style>
        </head>
        <body>
            <h2>BELIBELI - STRUK PEMBAYARAN</h2>
            ${content}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.print();
}

// Memulai pembelian baru
function newPurchase() {
    stopQrisCountdown();

    document.getElementById("cashActions").hidden = true;
    document.getElementById("qrisResult").hidden = true;

    document.getElementById("checkoutButton").hidden = false;
    document.getElementById("paymentMethod").disabled = false;

    document.getElementById("qrisImage").src = "";
    document.getElementById("qrisCountdown").textContent =
        "Sisa waktu: 05:00";

    activePaymentMethod = null;
    activeCashReceived = 0;
    document.getElementById("receiptPanel").hidden = true;
    document.getElementById("paymentMessage").textContent = "";

    document.getElementById("simulateQrisButton").disabled = false;

    activePaymentId = null;
    activeSaleId = null;
    activeSale = null;

    document.getElementById("cashReceived").value = "";

    shoppingCart = [];
    renderCart();

    const menuBarang = document.querySelector(
        '.sidebar nav a[onclick*="barang"]'
    );

    showPage("barang", menuBarang);
}

// Tombol tambah barang pada tabel Data Barang
document.getElementById("commodityTable").addEventListener(
    "click",
    event => {
        const button = event.target.closest(
            'button[data-act="add-cart"]'
        );

        if (button) {
            addToCart(button.dataset.id);
        }
    }
);

// Sembunyikan QRIS jika metode CASH dipilih
document.getElementById("paymentMethod").addEventListener(
    "change",
    event => {
        document.getElementById("cashGroup").hidden =
            event.target.value !== "CASH";

        document.getElementById("cashActions").hidden = true;
        document.getElementById("qrisResult").hidden = true;
    }
);

// Saat pertama kali membuka halaman
renderCart();

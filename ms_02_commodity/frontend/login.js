// ===== KONFIGURASI =====
// Alamat layanan login (ms_01_auth, port 3000). Sesuaikan jika berbeda.
const AUTH_API = "http://localhost:3000/auth/login";

// Jika sudah login, langsung arahkan ke dashboard
if (localStorage.getItem("token")) {
    location.replace("index.html");
}

// Membaca isi (payload) token JWT untuk mengambil peran pengguna
// jika server tidak mengirim objek user secara terpisah.
function decodeJwt(token) {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(decodeURIComponent(escape(atob(payload))));
    } catch {
        return {};
    }
}

// Menangani pengiriman form login
document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = document.getElementById("loginBtn");
    const message = document.getElementById("loginMessage");
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    // Nonaktifkan tombol selama proses agar tidak terkirim dua kali
    message.textContent = "";
    button.disabled = true;
    button.textContent = "Memproses...";

    try {
        const response = await fetch(AUTH_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        // Jika respons bukan JSON, anggap isinya objek kosong
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || result.error || "Username atau password salah.");
        }

        // Token dapat berada di beberapa lokasi, tergantung format respons server
        const data = result.data || result;
        const token = data.token || data.access_token || result.token;

        if (!token) {
            throw new Error("Server tidak mengirim token.");
        }

        // Ambil data pengguna dari respons; jika tidak ada, baca dari isi token
        const claims = decodeJwt(token);
        const user = data.user || {
            name: claims.name || claims.username || username,
            role: claims.role || "USER"
        };

        // Simpan data login lalu masuk ke dashboard
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        location.replace("index.html");

    } catch (error) {
        // Galat jaringan dari fetch ditampilkan dengan pesan yang lebih jelas
        message.textContent = error.message.includes("fetch")
            ? "Tidak dapat terhubung ke server."
            : error.message;
        button.disabled = false;
        button.textContent = "Masuk";
    }
});
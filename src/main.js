import "./style.css";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "./config.js";

const app = document.querySelector("#app");
let scanner = null;

function esc(v="") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function setApp(html) {
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/">🎟️ Sistem Kupon</a>
      <nav>
        <a href="/">Penerima</a>
        <a href="/admin">Admin</a>
        <a href="/scanner">Scanner</a>
      </nav>
    </header>
    <main class="container">${html}</main>
    <footer>Kupon QR • Supabase + Vercel</footer>
  `;
}

async function session() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

function requireLogin() {
  return session().then(s => {
    if (!s) {
      setApp(`
        <section class="card auth">
          <h1>Login Operator</h1>
          <p>Halaman Admin dan Scanner hanya dapat digunakan oleh akun yang login.</p>
          <form id="loginForm">
            <label>Email<input type="email" id="email" required></label>
            <label>Password<input type="password" id="password" required></label>
            <button class="primary">Login</button>
          </form>
          <div id="msg"></div>
        </section>
      `);
      document.querySelector("#loginForm").addEventListener("submit", async e => {
        e.preventDefault();
        const msg = document.querySelector("#msg");
        const { error } = await supabase.auth.signInWithPassword({
          email: document.querySelector("#email").value,
          password: document.querySelector("#password").value
        });
        if (error) {
          msg.innerHTML = `<div class="error">${esc(error.message)}</div>`;
        } else {
          location.reload();
        }
      });
      return false;
    }
    return true;
  });
}

async function renderHome() {
  setApp(`
    <section class="hero">
      <h1>🎟️ Kupon Acara</h1>
      <p>Masukkan token kupon untuk menampilkan QR.</p>
    </section>
    <section class="card narrow">
      <form id="lookup">
        <label>Token Kupon
          <input id="token" placeholder="Contoh: 8f1a..." required autocomplete="off">
        </label>
        <button class="primary">Tampilkan QR</button>
      </form>
      <div id="result"></div>
    </section>
  `);

  document.querySelector("#lookup").addEventListener("submit", async e => {
    e.preventDefault();
    const token = document.querySelector("#token").value.trim();
    const result = document.querySelector("#result");
    result.innerHTML = `<div class="info">Mencari kupon...</div>`;

    const { data, error } = await supabase.rpc("get_public_coupon", { p_token: token });
    if (error || !data?.length) {
      result.innerHTML = `<div class="error">Kupon tidak ditemukan.</div>`;
      return;
    }

    const c = data[0];
    const canvas = document.createElement("canvas");
    await QRCode.toCanvas(canvas, c.token, { width: 240, margin: 2 });

    result.innerHTML = `
      <div class="qr-card">
        <h2>${esc(c.name)}</h2>
        <p><b>Alamat: ${esc(c.code_address)}</b></p>
        <div id="qr"></div>
        <span class="badge ${c.used ? "used" : "ready"}">
          ${c.used ? "Sudah digunakan" : "Siap digunakan"}
        </span>
        <p class="muted">Tunjukkan QR ini kepada panitia.</p>
      </div>
    `;
    document.querySelector("#qr").appendChild(canvas);
  });
}

async function renderAdmin() {
  if (!(await requireLogin())) return;

  const { data: blocks } = await supabase.from("allowed_blocks").select("*").order("block");
  const { data: coupons } = await supabase.from("coupons").select("*").order("created_at", { ascending:false });

  setApp(`
    <section class="hero">
      <div class="row">
        <div><h1>Admin / Pembuat Kupon</h1><p>Buat satu kupon untuk setiap alamat rumah.</p></div>
        <button id="logout" class="secondary">Logout</button>
      </div>
    </section>

    <div class="grid">
      <section class="card">
        <h2>Buat Kupon</h2>
        <form id="createCoupon">
          <label>Nama Penerima<input id="name" required></label>
          <label>Blok Rumah<select id="block" required>
            ${(blocks||[]).map(b=>`<option value="${esc(b.block)}">${esc(b.block)}</option>`).join("")}
          </select></label>
          <label>Nomor Rumah<input id="house" required maxlength="20"></label>
          <button class="primary">Buat Kupon</button>
        </form>
        <div id="createMsg"></div>
      </section>

      <section class="card">
        <h2>Blok yang Diizinkan</h2>
        <div id="blocks" class="chips">
          ${(blocks||[]).map(b=>`
            <span class="chip">${esc(b.block)}
              <button data-del-block="${esc(b.block)}" title="Hapus">×</button>
            </span>`).join("")}
        </div>
        <form id="addBlock" class="inline">
          <input id="newBlock" placeholder="Contoh B8" maxlength="10" required>
          <button class="secondary">Tambah</button>
        </form>
      </section>
    </div>

    <section class="card">
      <div class="row"><h2>Data Kupon</h2><span class="muted">${coupons?.length||0} kupon</span></div>
      <div class="tablewrap">
      <table><thead><tr><th>Nama</th><th>Alamat</th><th>Status</th><th>Link</th></tr></thead>
      <tbody>
      ${(coupons||[]).map(c=>`
        <tr>
          <td>${esc(c.name)}</td>
          <td>${esc(c.code_address)}</td>
          <td><span class="badge ${c.used?"used":"ready"}">${c.used?"Sudah diambil":"Belum diambil"}</span></td>
          <td><button class="small secondary" data-copy="${esc(c.token)}">Salin Link</button></td>
        </tr>`).join("") || `<tr><td colspan="4" class="empty">Belum ada kupon.</td></tr>`}
      </tbody></table></div>
    </section>
  `);

  document.querySelector("#logout").onclick = async () => {
    await supabase.auth.signOut();
    location.href="/";
  };

  document.querySelector("#createCoupon").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = document.querySelector("#createMsg");
    const name = document.querySelector("#name").value.trim();
    const block = document.querySelector("#block").value.trim().toUpperCase();
    const house = document.querySelector("#house").value.trim().toUpperCase();

    const { data: allowed } = await supabase.from("allowed_blocks").select("id").eq("block", block).maybeSingle();
    if (!allowed) {
      msg.innerHTML = `<div class="error">Blok ${esc(block)} tidak diizinkan.</div>`;
      return;
    }

    const { data, error } = await supabase.from("coupons")
      .insert({ name, block, house_no: house })
      .select("*")
      .single();

    if (error) {
      const duplicate = error.code === "23505";
      msg.innerHTML = `<div class="error">${duplicate ? "Alamat tersebut sudah memiliki kupon." : esc(error.message)}</div>`;
      return;
    }

    const link = `${location.origin}/k/${data.token}`;
    msg.innerHTML = `
      <div class="success">
        Kupon <b>${esc(data.code_address)}</b> berhasil dibuat.<br>
        <div class="copyline"><code>${esc(link)}</code><button id="copyNew" class="small secondary">Salin</button></div>
      </div>`;
    document.querySelector("#copyNew").onclick = () => navigator.clipboard.writeText(link);
    e.target.reset();
    setTimeout(renderAdmin, 600);
  });

  document.querySelector("#addBlock").addEventListener("submit", async e => {
    e.preventDefault();
    const block = document.querySelector("#newBlock").value.trim().toUpperCase();
    const { error } = await supabase.from("allowed_blocks").insert({ block });
    if (error) alert(error.message);
    else renderAdmin();
  });

  document.querySelectorAll("[data-del-block]").forEach(btn => btn.addEventListener("click", async () => {
    const b = btn.dataset.delBlock;
    if (!confirm(`Hapus ${b} dari blok yang diizinkan?`)) return;
    await supabase.from("allowed_blocks").delete().eq("block", b);
    renderAdmin();
  }));

  document.querySelectorAll("[data-copy]").forEach(btn => btn.addEventListener("click", async () => {
    const link = `${location.origin}/k/${btn.dataset.copy}`;
    await navigator.clipboard.writeText(link);
    btn.textContent="Tersalin!";
    setTimeout(()=>btn.textContent="Salin Link",1200);
  }));
}

async function renderRecipient(token) {
  // Token berasal langsung dari /k/<token>. Normalisasi supaya spasi/encoding
  // tidak membuat token valid terbaca sebagai token berbeda.
  const cleanToken = decodeURIComponent(String(token || "")).trim();

  if (!cleanToken) {
    setApp(`<section class="card narrow"><h1>❌ Kupon tidak ditemukan</h1><p>Token kupon kosong atau tidak valid.</p><a class="button primary" href="/">Kembali</a></section>`);
    return;
  }

  const { data, error } = await supabase.rpc("get_public_coupon", {
    p_token: cleanToken
  });

  if (error) {
    console.error("get_public_coupon error:", error);
    setApp(`<section class="card narrow"><h1>⚠️ Kupon tidak dapat dibuka</h1><p>Terjadi masalah saat menghubungkan ke database. Coba buka kembali link kupon.</p><a class="button primary" href="/">Kembali</a></section>`);
    return;
  }

  if (!data?.length) {
    setApp(`<section class="card narrow"><h1>❌ Kupon tidak ditemukan</h1><p>Token kupon tidak terdaftar.</p><a class="button primary" href="/">Kembali</a></section>`);
    return;
  }

  const c = data[0];

  setApp(`
    <section class="card narrow center">
      <h1>🎟️ Kupon</h1>
      <h2>${esc(c.name)}</h2>
      <p><b>${esc(c.code_address)}</b></p>
      <canvas id="qr" width="260" height="260"></canvas>
      <span class="badge ${c.used ? "used" : "ready"}">${c.used ? "Sudah digunakan" : "Siap digunakan"}</span>
      <p class="muted">${c.used ? "Kupon ini sudah pernah dipakai." : "Tunjukkan QR ini kepada panitia."}</p>
    </section>
  `);

  await QRCode.toCanvas(document.querySelector("#qr"), c.token, {
    width: 260,
    margin: 2
  });
}

async function renderScanner() {
  if (!(await requireLogin())) return;

  setApp(`
    <section class="hero">
      <div class="row"><div><h1>📷 Scanner Panitia</h1><p>Satu scan langsung mencatat kupon sebagai sudah diambil.</p></div><button id="logout" class="secondary">Logout</button></div>
    </section>
    <div class="grid">
      <section class="card">
        <div id="reader"></div>
        <div class="actions"><button id="start" class="primary">Mulai Kamera</button><button id="stop" class="secondary" disabled>Stop</button></div>
        <div id="scanResult"></div>
      </section>
      <section class="card">
        <h2>Petunjuk</h2>
        <ol>
          <li>Izinkan akses kamera.</li>
          <li>Arahkan kamera ke QR penerima.</li>
          <li>Sistem otomatis memvalidasi kupon.</li>
          <li>QR yang sama tidak dapat digunakan dua kali.</li>
        </ol>
      </section>
    </div>
  `);

  document.querySelector("#logout").onclick = async () => {
    await supabase.auth.signOut();
    location.href="/";
  };

  const result = document.querySelector("#scanResult");
  let processing = false;

  async function processScan(decodedText) {
    if (processing) return;
    processing = true;
    const { data, error } = await supabase.rpc("redeem_coupon", { p_token: decodedText.trim() });

    if (error) {
      result.innerHTML = `<div class="error">Gagal memproses scan: ${esc(error.message)}</div>`;
    } else {
      const r = data?.[0];
      if (r?.ok) {
        result.innerHTML = `<div class="success">✅ <b>KUPON BERHASIL DIBERIKAN</b><br>${esc(r.coupon_name)}<br>${esc(r.code_address)}</div>`;
      } else if (r?.reason === "ALREADY_USED") {
        result.innerHTML = `<div class="error">⚠️ <b>KUPON SUDAH DIGUNAKAN</b><br>${esc(r.coupon_name)}<br>${esc(r.code_address)}</div>`;
      } else {
        result.innerHTML = `<div class="error">❌ QR tidak terdaftar.</div>`;
      }
    }

    setTimeout(() => { processing=false; }, 1200);
  }

  document.querySelector("#start").onclick = async () => {
    if (scanner) return;
    scanner = new Html5Qrcode("reader");
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        processScan
      );
      document.querySelector("#start").disabled=true;
      document.querySelector("#stop").disabled=false;
    } catch (e) {
      result.innerHTML = `<div class="error">Kamera gagal dibuka. Pastikan izin kamera diberikan dan website memakai HTTPS.</div>`;
      scanner=null;
    }
  };

  document.querySelector("#stop").onclick = async () => {
    if (scanner) {
      try { await scanner.stop(); } catch {}
      scanner=null;
    }
    document.querySelector("#start").disabled=false;
    document.querySelector("#stop").disabled=true;
  };
}

function route() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return renderHome();
  if (path === "/admin") return renderAdmin();
  if (path === "/scanner") return renderScanner();
  const m = path.match(/^\/k\/([^/]+)$/);
  if (m) return renderRecipient(decodeURIComponent(m[1]));
  setApp(`<section class="card narrow"><h1>404</h1><p>Halaman tidak ditemukan.</p></section>`);
}

route();

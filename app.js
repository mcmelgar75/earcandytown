"use strict";
/* ===== CONFIGURACIÓN ===== */
const CFG = {
  sheetId: "18tYLjsL-47vhCHZI41f_msb-amh3OvMYBkLD7H3iL88",
  formEndpoint: "", // Ej: "https://formspree.io/f/xxxxxxx". Si está vacío se abre el correo del usuario.
  email: "",        // Correo que recibe las solicitudes (solo si formEndpoint está vacío).
  cacheMin: 5
};

/* ===== UTILIDADES ===== */
const $ = (s, r = document) => r.querySelector(s);
const key = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const slug = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safe = u => /^https?:\/\//i.test((u || "").trim());
const split = (s, re) => (s || "").split(re).map(x => x.trim()).filter(Boolean);

function parseCSV(t) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

/* ===== DATOS (Google Sheets, primera pestaña) ===== */
const FIELDS = ["artista", "instagram", "fotodeperfil", "genero", "ciudad", "formato", "bio", "spotify", "youtube", "tiktok", "video", "galeria", "destacados"];
const BLANK = Object.fromEntries(FIELDS.map(k => [k, ""]));
async function artists() {
  const ck = "ec_artists_v2", now = Date.now();
  try {
    const c = JSON.parse(sessionStorage.getItem(ck));
    if (c && now - c.t < CFG.cacheMin * 6e4) return c.d;
  } catch {}
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${CFG.sheetId}/gviz/tq?tqx=out:csv`);
  if (!res.ok) throw new Error(res.status);
  const [head, ...rows] = parseCSV(await res.text());
  const keys = head.map(key);
  const data = rows
    .map(r => ({ ...BLANK, ...Object.fromEntries(keys.map((k, i) => [k, (r[i] || "").trim()])) }))
    .filter(a => a.artista)
    .map(a => ({ ...a, slug: slug(a.artista) }))
    .sort((a, b) => a.artista.localeCompare(b.artista, "es"));
  try { sessionStorage.setItem(ck, JSON.stringify({ t: now, d: data })); } catch {}
  return data;
}

/* ===== HOME ===== */
const card = a => `<a class="card" href="artista.html?a=${a.slug}">
  <div class="ph">${safe(a.fotodeperfil) ? `<img src="${esc(a.fotodeperfil)}" alt="" loading="lazy" width="400" height="400">` : ""}</div>
  <h3>${esc(a.artista)}</h3>${a.genero ? `<p>${esc(a.genero)}</p>` : ""}</a>`;

async function home() {
  const grid = $("#grid"), count = $("#count");
  let list;
  try { list = await artists(); }
  catch { grid.innerHTML = '<p class="note">No pudimos cargar el roster. Recarga la página en unos segundos.</p>'; return; }
  const draw = t => {
    const n = key(t), f = list.filter(a => key(`${a.artista}${a.genero}${a.ciudad}`).includes(n));
    grid.innerHTML = f.length ? f.map(card).join("") : '<p class="note">No hay artistas que coincidan con tu búsqueda.</p>';
    count.textContent = `${f.length} artistas`;
  };
  draw("");
  $("#q").addEventListener("input", e => draw(e.target.value));
}

/* ===== FICHA DE ARTISTA ===== */
async function detail() {
  const el = $("#artist"), s = new URLSearchParams(location.search).get("a");
  const list = await artists().catch(() => null);
  const a = list?.find(x => x.slug === s);
  if (!a) {
    el.outerHTML = `<p class="note wrap">${list ? "No encontramos a este artista." : "No pudimos cargar la información."} <a href="index.html#artistas">Volver al roster</a></p>`;
    return;
  }
  document.title = `${a.artista} | EarCandy`;
  $('meta[name="description"]').content = `Contrata a ${a.artista}. ${a.genero} ${a.bio.slice(0, 120)}`.trim();

  const meta = [a.genero, a.formato, a.ciudad].filter(Boolean);
  const links = [["Instagram", a.instagram], ["Spotify", a.spotify], ["YouTube", a.youtube], ["TikTok", a.tiktok]].filter(([, u]) => safe(u));
  const yt = (a.video.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
  const gal = split(a.galeria, /[\s,|]+/).filter(safe);
  const hits = split(a.destacados, /[;\n]/);

  try { el.innerHTML = `
    <div class="ph">${safe(a.fotodeperfil) ? `<img src="${esc(a.fotodeperfil)}" alt="${esc(a.artista)}" width="600" height="600">` : ""}</div>
    <div>
      <h1>${esc(a.artista)}</h1>
      ${meta.length ? `<ul class="chips">${meta.map(m => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
      ${a.bio ? `<div class="bio">${split(a.bio, /\n+/).map(p => `<p>${esc(p)}</p>`).join("")}</div>` : ""}
      <div class="links">
        <a class="btn" href="index.html?artista=${encodeURIComponent(a.artista)}#contacto">Contratar a ${esc(a.artista)}</a>
        ${links.map(([n, u]) => `<a class="btn ghost" href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join("")}
      </div>
      ${hits.length ? `<h2>Shows y logros</h2><ul class="list">${hits.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
      ${yt ? `<h2>Video</h2><div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="Video de ${esc(a.artista)}" loading="lazy" allowfullscreen></iframe></div>` : ""}
      ${gal.length ? `<h2>Galería</h2><div class="gal">${gal.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div>` : ""}
      <a class="back" href="index.html#artistas">Volver al roster</a>
    </div>`; }
  catch (err) { console.error(err); el.innerHTML = '<p class="note">No pudimos mostrar esta ficha. <a href="index.html#artistas">Volver al roster</a></p>'; }
}

/* ===== FORMULARIO ===== */
function form() {
  const f = $("#booking"), st = $("#status");
  const pre = new URLSearchParams(location.search).get("artista");
  if (pre) $("#msg").value = `Artista de interés: ${pre}\n`;
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const d = new FormData(f);
    if (d.get("_gotcha")) return;
    if (!CFG.formEndpoint) {
      const body = `Nombre / Empresa: ${d.get("name")}\nCorreo: ${d.get("email")}\nTipo: ${d.get("type")}\n\n${d.get("message")}`;
      location.href = `mailto:${CFG.email}?subject=${encodeURIComponent("Solicitud de booking")}&body=${encodeURIComponent(body)}`;
      return;
    }
    st.textContent = "Enviando…";
    try {
      const r = await fetch(CFG.formEndpoint, { method: "POST", body: d, headers: { Accept: "application/json" } });
      if (!r.ok) throw 0;
      f.reset(); st.textContent = "Solicitud enviada. Te contactaremos pronto.";
    } catch { st.textContent = "No se pudo enviar. Inténtalo de nuevo o escríbenos por correo."; }
  });
}

/* ===== INICIO ===== */
document.addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
$("#grid") && home();
$("#artist") && detail();
$("#booking") && form();

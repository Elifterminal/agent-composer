// ui.js — human-facing views: the instrument palette (browse + audition the
// whole catalog) and the track-lane visualizer (see what a score actually does).
// Pure view code: data + callbacks come from app.js.
import { CATEGORIES } from "./instruments.js";
import { isDrumKit } from "./audio.js";

const CAT_COLOR = {
  Bass: "#ff6b6b", Lead: "#37e6c8", Keys: "#9b7cff", Pad: "#5a8dee", Pluck: "#f7b731",
  Mallet: "#e056fd", Brass: "#ffa502", Strings: "#26de81", Guitar: "#fd9644",
  Woodwind: "#45aaf2", Organ: "#a55eea", Synth: "#00d2d3", Chip: "#2ed573",
  FX: "#9aa6b2", Drums: "#ff9ff3",
};
export function catColor(c) { return CAT_COLOR[c] || "#8aa"; }

// ---------------- instrument palette ----------------
export function renderPalette(el, instruments, onPreview) {
  el.innerHTML = "";
  const byCat = {};
  for (const it of instruments) (byCat[it.cat] ||= []).push(it);

  const bar = document.createElement("div"); bar.className = "pal-bar";
  const search = document.createElement("input");
  search.placeholder = `search ${instruments.length} instruments…`;
  search.className = "pal-search"; search.spellcheck = false;
  const hint = document.createElement("span"); hint.className = "muted"; hint.textContent = "click to audition · id copied";
  bar.append(search, hint); el.appendChild(bar);

  const grid = document.createElement("div"); grid.className = "pal-grid"; el.appendChild(grid);

  function draw(filter = "") {
    grid.innerHTML = "";
    for (const cat of CATEGORIES) {
      const items = (byCat[cat] || []).filter((it) =>
        !filter || it.label.toLowerCase().includes(filter) || it.id.toLowerCase().includes(filter));
      if (!items.length) continue;
      const wrap = document.createElement("div"); wrap.className = "pal-cat-wrap";
      const h = document.createElement("div"); h.className = "pal-cat";
      h.innerHTML = `<span class="dot" style="background:${catColor(cat)}"></span>${cat}`;
      wrap.appendChild(h);
      const row = document.createElement("div"); row.className = "pal-row";
      for (const it of items) {
        const b = document.createElement("button");
        b.className = "pal-chip"; b.textContent = it.label;
        b.title = `id: "${it.id}" — click to audition`;
        b.style.setProperty("--c", catColor(cat));
        b.addEventListener("click", async () => {
          b.classList.add("playing");
          try { navigator.clipboard?.writeText(it.id); } catch (e) {}
          try { await onPreview(it.id); } catch (e) {}
          setTimeout(() => b.classList.remove("playing"), 700);
        });
        row.appendChild(b);
      }
      wrap.appendChild(row); grid.appendChild(wrap);
    }
    if (!grid.children.length) grid.innerHTML = '<p class="muted">no matches</p>';
  }
  draw();
  search.addEventListener("input", () => draw(search.value.toLowerCase().trim()));
}

// ---------------- track-lane visualizer ----------------
const BEATS = { "1n": 4, "2n": 2, "4n": 1, "8n": .5, "16n": .25, "32n": .125 };
function beatsOf(d) {
  const m = /^(\d+)n(\.?)(t?)$/.exec(String(d)); if (!m) return 1;
  let b = BEATS[m[1] + "n"] ?? 1; if (m[2] === ".") b *= 1.5; if (m[3] === "t") b *= 2 / 3; return b;
}
function midi(n) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(n); if (!m) return 60;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
  return (parseInt(m[3]) + 1) * 12 + base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

export function renderLanes(canvas, song, instCat) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const labelW = 150, laneH = 48, pad = 7, gap = 4;
  const tracks = song.tracks || [];
  const W = Math.max(canvas.clientWidth || 800, 360);
  const H = Math.max(tracks.length * (laneH + gap) + 24, 60);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.height = H + "px";
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  ctx.font = "11px ui-monospace, monospace";

  // total length in beats
  let total = 0;
  const laid = tracks.map((t) => {
    let b = 0; const evs = [];
    for (const n of t.notes || []) {
      const dur = n.rest != null ? n.rest : n.dur;
      const beats = beatsOf(dur);
      if (n.rest == null) evs.push({ start: b, beats, note: n.note, vel: n.vel ?? .85 });
      b += beats;
    }
    total = Math.max(total, b);
    return { track: t, evs };
  });
  total = total || 1;

  // bar gridlines (every 4 beats)
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let beat = 0; beat <= total; beat += 4) {
    const x = labelW + (beat / total) * (W - labelW - 6);
    ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, H - 4); ctx.stroke();
  }

  laid.forEach(({ track, evs }, i) => {
    const y0 = 12 + i * (laneH + gap);
    const cat = instCat(track.instrument);
    const col = catColor(cat);
    // lane bg + label
    ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fillRect(0, y0, W, laneH);
    ctx.fillStyle = "#cfe"; ctx.fillText(track.name || `Track ${i + 1}`, 8, y0 + 16);
    ctx.fillStyle = "#7d93ab"; ctx.fillText(track.instrument, 8, y0 + 32);
    if (track.mute) { ctx.fillStyle = "#ff6b6b"; ctx.fillText("muted", 8, y0 + 45); }
    // notes
    const isDrum = isDrumKit(track.instrument);
    for (const e of evs) {
      const x = labelW + (e.start / total) * (W - labelW - 6);
      const w = Math.max(2, (e.beats / total) * (W - labelW - 6) - 1);
      let y, h = 6;
      if (isDrum) { y = y0 + laneH - pad - 8; h = 8; }
      else {
        const ns = Array.isArray(e.note) ? e.note : [e.note];
        const m = ns.map(midi).reduce((a, b) => a + b, 0) / ns.length;
        const frac = Math.min(1, Math.max(0, (m - 28) / (96 - 28)));     // ~E1..C7
        y = y0 + (laneH - pad - h) - frac * (laneH - 2 * pad - h);
      }
      ctx.globalAlpha = 0.35 + 0.6 * e.vel;
      ctx.fillStyle = col;
      roundRect(ctx, x, y, w, h, 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

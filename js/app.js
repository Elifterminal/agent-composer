// app.js — wires the editors, transport, sheet engraver and exporters together.
import { jsonToSong, songToJson, mdToSong, songToMd, normalizeSong } from "./format.js";
import { buildEngine, renderWav } from "./audio.js";
import { renderSheet } from "./sheet.js";
import { EXAMPLES } from "./examples.js";

const $ = (id) => document.getElementById(id);
const els = {
  ex: $("ex"), play: $("play"), stop: $("stop"), loop: $("loop"),
  sheetBtn: $("sheetBtn"), wavBtn: $("wavBtn"), jsonBtn: $("jsonBtn"), mdBtn: $("mdBtn"),
  tabJson: $("tabJson"), tabMd: $("tabMd"), convert: $("convert"),
  json: $("json"), md: $("md"), error: $("error"), readout: $("readout"),
  viz: $("viz"), sheet: $("sheet"),
};

let fmt = "json";          // active editor
let engine = null;         // live playback engine
let rafId = 0;

// ---------- preset menu ----------
EXAMPLES.forEach((e, i) => {
  const o = document.createElement("option");
  o.value = String(i); o.textContent = e.name; els.ex.appendChild(o);
});
els.ex.addEventListener("change", () => loadSong(normalizeSong(EXAMPLES[+els.ex.value].song)));

// ---------- error / status ----------
function showError(msg) { els.error.textContent = msg; els.error.classList.remove("hidden"); }
function clearError() { els.error.classList.add("hidden"); }
function setReadout(song) {
  const notes = song.tracks.reduce((a, t) => a + t.notes.length, 0);
  els.readout.textContent = `${song.tempo} BPM · ${song.timeSignature} · ${song.tracks.length} track${song.tracks.length !== 1 ? "s" : ""} · ${notes} notes`;
}

// ---------- load / parse ----------
function loadSong(song) {
  els.json.value = songToJson(song);
  els.md.value = songToMd(song);
  clearError(); setReadout(song);
  try { renderSheet(els.sheet, song, song.timeSignature); } catch (e) { /* non-fatal */ }
}
// parse whichever editor is active -> normalized song (or null + error)
function getSong() {
  try {
    const song = fmt === "json" ? jsonToSong(els.json.value) : mdToSong(els.md.value);
    clearError(); setReadout(song); return song;
  } catch (e) {
    showError((fmt === "json" ? "JSON error: " : "Markdown error: ") + e.message);
    return null;
  }
}

// ---------- tabs / convert ----------
function setFmt(next) {
  if (next === fmt) return;
  // convert current editor into the other format before switching
  const song = getSong();
  if (song) { els.json.value = songToJson(song); els.md.value = songToMd(song); }
  fmt = next;
  els.tabJson.classList.toggle("active", fmt === "json");
  els.tabMd.classList.toggle("active", fmt === "md");
  els.json.hidden = fmt !== "json";
  els.md.hidden = fmt !== "md";
}
els.tabJson.addEventListener("click", () => setFmt("json"));
els.tabMd.addEventListener("click", () => setFmt("md"));
els.convert.addEventListener("click", () => { const s = getSong(); if (s) { els.json.value = songToJson(s); els.md.value = songToMd(s); } });

// ---------- transport ----------
async function play() {
  const song = getSong(); if (!song) return;
  stop();
  await Tone.start();                          // unlock audio (user gesture)
  engine = buildEngine(song);
  engine.start(els.loop.checked);
  els.play.classList.add("on");
  visualize();
}
function stop() {
  if (engine) { engine.stop(); engine.dispose(); engine = null; }
  els.play.classList.remove("on");
  cancelAnimationFrame(rafId);
  clearViz();
}
els.play.addEventListener("click", play);
els.stop.addEventListener("click", stop);

// ---------- visualizer ----------
const vctx = els.viz.getContext("2d");
function clearViz() { vctx.clearRect(0, 0, els.viz.width, els.viz.height); }
function visualize() {
  if (!engine) return;
  const buf = engine.analyser.getValue();
  const w = els.viz.width, h = els.viz.height;
  vctx.clearRect(0, 0, w, h);
  vctx.lineWidth = 2; vctx.strokeStyle = "#37e6c8"; vctx.shadowColor = "#37e6c8"; vctx.shadowBlur = 8;
  vctx.beginPath();
  for (let i = 0; i < buf.length; i++) {
    const x = (i / buf.length) * w, y = (0.5 - buf[i] * 0.45) * h;
    i ? vctx.lineTo(x, y) : vctx.moveTo(x, y);
  }
  vctx.stroke(); vctx.shadowBlur = 0;
  rafId = requestAnimationFrame(visualize);
}

// ---------- engrave / export ----------
els.sheetBtn.addEventListener("click", () => { const s = getSong(); if (s) renderSheet(els.sheet, s, s.timeSignature); });

els.wavBtn.addEventListener("click", async () => {
  const song = getSong(); if (!song) return;
  els.wavBtn.disabled = true; els.wavBtn.textContent = "💾 rendering…";
  try {
    await Tone.start();
    const blob = await renderWav(song);
    download(blob, `${slug(song.title)}.wav`);
  } catch (e) { showError("WAV render failed: " + e.message); }
  els.wavBtn.disabled = false; els.wavBtn.textContent = "💾 Export WAV";
});
els.jsonBtn.addEventListener("click", () => { const s = getSong(); if (s) download(new Blob([songToJson(s)], { type: "application/json" }), `${slug(s.title)}.json`); });
els.mdBtn.addEventListener("click", () => { const s = getSong(); if (s) download(new Blob([songToMd(s)], { type: "text/markdown" }), `${slug(s.title)}.md`); });

function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function slug(s) { return (s || "song").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "song"; }

window.addEventListener("resize", () => { const s = safeSong(); if (s) renderSheet(els.sheet, s, s.timeSignature); });
function safeSong() { try { return fmt === "json" ? jsonToSong(els.json.value) : mdToSong(els.md.value); } catch { return null; } }

// boot
loadSong(normalizeSong(EXAMPLES[0].song));

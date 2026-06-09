// app.js — wires the editors, transport, sheet engraver, exporters, file I/O,
// mixer and piano roll together. The score TEXT (JSON/MD editors) is the single
// source of truth: every visual editor compiles its edits back into it.
import { jsonToSong, songToJson, mdToSong, songToMd, normalizeSong } from "./format.js";
import { buildEngine, renderWav, renderMp3, renderStems, renderStemWav, audioBufferToWavBlob, INSTRUMENTS, probeInstruments, ensureSamplesLoaded, previewInstrument } from "./audio.js";
import { renderSheet } from "./sheet.js";
import { renderPalette, renderLanes } from "./ui.js";
import { songToMidiBlob } from "./midi.js";
import { lintSong } from "./lint.js";
import { createSequencer } from "./sequencer.js";
import { createMixer } from "./mixer.js";
import { createPianoRoll } from "./pianoroll.js";
import { abcToSong } from "./abc.js";
import { zipBlob } from "./zip.js";
import { openFile, saveFile, saveFileAs, adoptDropped, currentFileName, fmtOfName, sniffFmt } from "./files.js";
import { EXAMPLES } from "./examples.js";

const INST_CAT = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i.cat]));
const instCat = (id) => INST_CAT[id] || "Synth";

const $ = (id) => document.getElementById(id);
const els = {
  ex: $("ex"), play: $("play"), stop: $("stop"), loop: $("loop"),
  openBtn: $("openBtn"), saveBtn: $("saveBtn"), saveAsBtn: $("saveAsBtn"),
  sheetBtn: $("sheetBtn"), checkBtn: $("checkBtn"), wavBtn: $("wavBtn"), mp3Btn: $("mp3Btn"),
  stemsBtn: $("stemsBtn"), midiBtn: $("midiBtn"), jsonBtn: $("jsonBtn"), mdBtn: $("mdBtn"),
  tabJson: $("tabJson"), tabMd: $("tabMd"), tabAbc: $("tabAbc"), convert: $("convert"),
  json: $("json"), md: $("md"), abc: $("abc"), error: $("error"), readout: $("readout"), fileLabel: $("fileLabel"),
  transBar: $("transBar"), transFill: $("transFill"), transTime: $("transTime"),
  viz: $("viz"), sheet: $("sheet"), lanes: $("lanes"), palette: $("palette"),
  seqMount: $("seqMount"), seqLoad: $("seqLoad"),
  mixMount: $("mixMount"), rollMount: $("rollMount"),
};

let fmt = "json";          // active editor
let engine = null;         // live playback engine
let rafId = 0;
let dirty = false;         // unsaved edits since last open/save
let seekFrac = 0;          // pending transport position (fraction) while stopped

// ---------- preset menu ----------
EXAMPLES.forEach((e, i) => {
  const o = document.createElement("option");
  o.value = String(i); o.textContent = e.name; els.ex.appendChild(o);
});
els.ex.addEventListener("change", () => { loadSong(normalizeSong(EXAMPLES[+els.ex.value].song)); markDirty(true); });

// ---------- error / status ----------
function showError(msg) { els.error.textContent = msg; els.error.classList.remove("hidden"); }
function clearError() { els.error.classList.add("hidden"); }
function setReadout(song) {
  const notes = song.tracks.reduce((a, t) => a + t.notes.length, 0);
  els.readout.textContent = `${song.tempo} BPM · ${song.timeSignature} · ${song.tracks.length} track${song.tracks.length !== 1 ? "s" : ""} · ${notes} notes`;
  try { renderLanes(els.lanes, song, instCat); } catch (e) { /* non-fatal */ }
}
function markDirty(d) {
  dirty = d;
  const name = currentFileName();
  els.fileLabel.textContent = name ? name + (d ? " •" : "") : (d ? "unsaved •" : "");
}

// keep the mixer + piano roll in step with the score
function refreshViews(song) {
  setReadout(song);
  try { mixer.refresh(song); } catch (e) { /* non-fatal */ }
  try { roll.refresh(song); } catch (e) { /* non-fatal */ }
}

// ---------- load / parse ----------
function loadSong(song) {
  els.json.value = songToJson(song);
  els.md.value = songToMd(song);
  clearError(); refreshViews(song);
  try { renderSheet(els.sheet, song, song.timeSignature); } catch (e) { /* non-fatal */ }
}
// parse whichever editor is active -> normalized song (or null + error)
function getSong() {
  try {
    const song = fmt === "json" ? jsonToSong(els.json.value)
      : fmt === "md" ? mdToSong(els.md.value)
      : normalizeSong(abcToSong(els.abc.value));        // ABC is import-only
    clearError(); setReadout(song); return song;
  } catch (e) {
    showError((fmt === "json" ? "JSON error: " : fmt === "md" ? "Markdown error: " : "ABC error: ") + e.message);
    return null;
  }
}
function safeSong() { try { return fmt === "json" ? jsonToSong(els.json.value) : fmt === "md" ? mdToSong(els.md.value) : normalizeSong(abcToSong(els.abc.value)); } catch { return null; } }

// central model edit used by the mixer + piano roll: parse, mutate, write back.
// Always parses the JSON editor — it's canonical and kept in sync by every
// other surface. silent edits (mid-fader-drag) skip the heavier view refreshes.
function applyEdit(mutate, silent = false) {
  let song;
  try { song = jsonToSong(els.json.value); } catch (e) { return; }
  try { mutate(song); } catch (e) { return; }
  const norm = normalizeSong(song);
  els.json.value = songToJson(norm);
  els.md.value = songToMd(norm);
  markDirty(true);
  if (!silent) refreshViews(norm);
}

// typing in the editors: mark dirty + (debounced) sync the other editor and
// refresh the visual editors once the text parses
let typeTimer = 0;
for (const ta of [els.json, els.md, els.abc]) {
  ta.addEventListener("input", () => {
    markDirty(true);
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => {
      const s = safeSong(); if (!s) return;
      if (fmt !== "json") els.json.value = songToJson(s);
      if (fmt !== "md") els.md.value = songToMd(s);
      refreshViews(s);
    }, 500);
  });
}

// ---------- tabs / convert ----------
function setFmt(next) {
  if (next === fmt) return;
  // convert current editor into the JSON/MD editors before switching (ABC is
  // import-only, so we never generate ABC — switching to it just shows its box)
  const song = getSong();
  if (song) { els.json.value = songToJson(song); els.md.value = songToMd(song); }
  fmt = next;
  els.tabJson.classList.toggle("active", fmt === "json");
  els.tabMd.classList.toggle("active", fmt === "md");
  els.tabAbc.classList.toggle("active", fmt === "abc");
  els.json.hidden = fmt !== "json";
  els.md.hidden = fmt !== "md";
  els.abc.hidden = fmt !== "abc";
}
els.tabJson.addEventListener("click", () => setFmt("json"));
els.tabMd.addEventListener("click", () => setFmt("md"));
els.tabAbc.addEventListener("click", () => setFmt("abc"));
els.convert.addEventListener("click", () => {
  const s = getSong(); if (!s) return;
  els.json.value = songToJson(s); els.md.value = songToMd(s);
  if (fmt === "abc") setFmt("json");          // show the imported result
  refreshViews(s);
  try { renderSheet(els.sheet, s, s.timeSignature); } catch (e) {}
});

// ---------- file open / save ----------
function loadText(name, text) {
  const f = /\.(json|md|markdown|abc)$/i.test(name) ? fmtOfName(name) : sniffFmt(text);
  try {
    if (f === "abc") {
      els.abc.value = text;
      loadSong(normalizeSong(abcToSong(text)));   // import: fills JSON/MD
      setFmt("json");
    } else if (f === "md") {
      loadSong(mdToSong(text));
      setFmt("md");
      els.md.value = text;                        // keep the author's exact text
    } else {
      loadSong(jsonToSong(text));
      setFmt("json");
      els.json.value = text;
    }
    markDirty(false);
  } catch (e) { showError(`couldn't open ${name}: ` + e.message); }
}
els.openBtn.addEventListener("click", async () => {
  try { const { name, text } = await openFile(); loadText(name, text); }
  catch (e) { if (e && e.name !== "AbortError") showError("open failed: " + e.message); }
});
async function doSave(as = false) {
  const song = getSong(); if (!song) return;       // refuse to save a broken score
  const saveFmt = fmtOfName(currentFileName());    // .abc opens become .json saves
  const name = currentFileName() && saveFmt !== "abc" ? currentFileName() : `${slug(song.title)}.${saveFmt === "md" ? "md" : "json"}`;
  const text = saveFmt === "md" ? els.md.value : els.json.value;
  try {
    const saved = as ? await saveFileAs(text, name) : await saveFile(text, name);
    markDirty(false);
    els.fileLabel.textContent = saved;
  } catch (e) { if (e && e.name !== "AbortError") showError("save failed: " + e.message); }
}
els.saveBtn.addEventListener("click", () => doSave(false));
els.saveAsBtn.addEventListener("click", () => doSave(true));
window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === "s") { e.preventDefault(); doSave(e.shiftKey); }
  if (e.key === "o") { e.preventDefault(); els.openBtn.click(); }
});
// drag a score file anywhere onto the page
window.addEventListener("dragover", (e) => { e.preventDefault(); });
window.addEventListener("drop", async (e) => {
  e.preventDefault();
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f) return;
  adoptDropped(f);
  loadText(f.name, await f.text());
});

// ---------- transport ----------
async function play() {
  const song = getSong(); if (!song) return;
  stop(false);
  await Tone.start();                          // unlock audio (user gesture)
  await ensureSamplesLoaded(song);             // pre-decode any sampled instruments
  engine = buildEngine(song);
  if (!engine) return;
  engine.start(els.loop.checked, seekFrac * engine.length);
  els.play.classList.add("on");
  visualize();
}
function stop(resetSeek = true) {
  if (engine) { engine.stop(); engine.dispose(); engine = null; }
  els.play.classList.remove("on");
  cancelAnimationFrame(rafId);
  clearViz();
  if (seq) seq.setPlayhead(-1);
  if (roll) roll.setPlayhead(-1);
  if (resetSeek) { seekFrac = 0; updateTransBar(0, 0); }
}
els.play.addEventListener("click", play);
els.stop.addEventListener("click", () => stop(true));

// position bar: click to seek (live if playing, pending otherwise)
els.transBar.addEventListener("click", (e) => {
  const rect = els.transBar.getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  if (engine) { Tone.Transport.seconds = frac * engine.length; }
  else { seekFrac = frac; updateTransBar(0, 0); }
});
function fmtTime(s) {
  s = Math.max(0, s);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
function updateTransBar(pos, total) {
  const frac = engine && total > 0 ? Math.min(1, pos / total) : seekFrac;
  els.transFill.style.width = (frac * 100).toFixed(2) + "%";
  els.transTime.textContent = engine ? `${fmtTime(pos)} / ${fmtTime(total)}` : (seekFrac > 0 ? `▸ ${(seekFrac * 100) | 0}%` : "—");
}

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
  const pos = Tone.Transport.seconds;
  updateTransBar(pos, engine.length);
  seqPlayhead();
  if (roll) roll.setPlayhead(pos);
  rafId = requestAnimationFrame(visualize);
}

// ---------- engrave / export ----------
els.sheetBtn.addEventListener("click", () => { const s = getSong(); if (s) renderSheet(els.sheet, s, s.timeSignature); });

// ---------- validate (agent feedback, surfaced for humans too) ----------
els.checkBtn.addEventListener("click", () => {
  const s = getSong(); if (!s) return;
  const r = lintSong(s);
  if (r.ok && !r.warnings.length) { clearError(); els.readout.textContent = `✓ clean · ${r.info.tracks} tracks · ${r.info.notes} notes · ${r.info.lengthBeats} beats`; return; }
  const msgs = [...r.errors.map((m) => "✗ " + m), ...r.warnings.map((m) => "⚠ " + m)];
  showError(msgs.join("\n"));
});

async function exportAudio(btn, label, ext, renderFn) {
  const song = getSong(); if (!song) return;
  const tail = els.loop.checked ? 0 : 2.5;   // "loop" checked => seamless export (no reverb tail)
  btn.disabled = true; const orig = btn.textContent; btn.textContent = "⏳ rendering…";
  try {
    await Tone.start();
    download(await renderFn(song, tail), `${slug(song.title)}${tail === 0 ? "-loop" : ""}.${ext}`);
  } catch (e) { showError(`${label} render failed: ` + e.message); }
  btn.disabled = false; btn.textContent = orig;
}
els.wavBtn.addEventListener("click", () => exportAudio(els.wavBtn, "WAV", "wav", (s, t) => renderWav(s, t)));
els.mp3Btn.addEventListener("click", () => exportAudio(els.mp3Btn, "MP3", "mp3", (s, t) => renderMp3(s, 192, t)));
els.midiBtn.addEventListener("click", () => { const s = getSong(); if (s) download(songToMidiBlob(s), `${slug(s.title)}.mid`); });
els.jsonBtn.addEventListener("click", () => { const s = getSong(); if (s) download(new Blob([songToJson(s)], { type: "application/json" }), `${slug(s.title)}.json`); });
els.mdBtn.addEventListener("click", () => { const s = getSong(); if (s) download(new Blob([songToMd(s)], { type: "text/markdown" }), `${slug(s.title)}.md`); });

// stems: every audible track rendered solo at full mix length, zipped
els.stemsBtn.addEventListener("click", async () => {
  const song = getSong(); if (!song) return;
  const tail = els.loop.checked ? 0 : 2.5;
  const btn = els.stemsBtn;
  btn.disabled = true; const orig = btn.textContent;
  try {
    await Tone.start();
    const stems = await renderStems(song, tail, (done, total) => { btn.textContent = `⏳ stem ${done}/${total}`; });
    if (!stems.length) throw new Error("no audible tracks to export");
    const entries = [];
    for (const s of stems) {
      entries.push({
        name: `${String(s.index + 1).padStart(2, "0")}-${slug(s.name)}.wav`,
        data: new Uint8Array(await audioBufferToWavBlob(s.buffer).arrayBuffer()),
      });
    }
    download(zipBlob(entries), `${slug(song.title)}-stems.zip`);
  } catch (e) { showError("stems render failed: " + e.message); }
  btn.disabled = false; btn.textContent = orig;
});

function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function slug(s) { return (s || "song").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "song"; }

window.addEventListener("resize", () => { const s = safeSong(); if (s) renderSheet(els.sheet, s, s.timeSignature); });

// ---------- programmatic API ----------
// Lets an agent / automation render headlessly and capture the bytes directly
// (e.g. `await AgentScore.renderMp3Blob(jsonText)`), with no servers or CORS.
// Pure rendering helpers; safe to call from the console.
window.AgentScore = {
  jsonToSong, mdToSong, songToJson, songToMd, normalizeSong,
  instruments: INSTRUMENTS, probeInstruments,
  async renderWavBlob(text, isMd = false, tailSec = 2.5) { await Tone.start(); return renderWav(parseText(text, isMd), tailSec); },
  async renderMp3Blob(text, isMd = false, kbps = 192, tailSec = 2.5) { await Tone.start(); return renderMp3(parseText(text, isMd), kbps, tailSec); },
  renderMidiBlob(text, isMd = false) { return songToMidiBlob(parseText(text, isMd)); },
  lint(text, isMd = false) { return lintSong(parseText(text, isMd)); },
  abcToSong(abcText) { return normalizeSong(abcToSong(abcText)); },   // ABC notation -> Song
  // stems: all audible tracks as aligned WAVs in one zip, or a single track
  async renderStemsZipBlob(text, isMd = false, tailSec = 2.5) {
    await Tone.start();
    const song = parseText(text, isMd);
    const stems = await renderStems(song, tailSec);
    const entries = [];
    for (const s of stems) entries.push({
      name: `${String(s.index + 1).padStart(2, "0")}-${slug(s.name)}.wav`,
      data: new Uint8Array(await audioBufferToWavBlob(s.buffer).arrayBuffer()),
    });
    return zipBlob(entries);
  },
  async renderStemWavBlob(text, trackIndex, isMd = false, tailSec = 2.5) {
    await Tone.start();
    return renderStemWav(parseText(text, isMd), trackIndex, tailSec);
  },
};
function parseText(text, isMd) { return isMd ? mdToSong(text) : jsonToSong(text); }

// ---------- step sequencer ----------
// The grid is an alternative authoring surface: editing a cell compiles the grid
// into the active score (so Play / MIDI / WAV / engrave all use it). "↻ from
// score" pulls the current editor back onto the grid (best-effort, grid-uniform
// songs only).
let seq = null;
function syncFromSequencer() {
  if (!seq) return;
  const song = normalizeSong(seq.compile());
  els.json.value = songToJson(song);
  els.md.value = songToMd(song);
  clearError(); markDirty(true); refreshViews(song);
}
function seqPlayhead() {
  if (!seq || !engine) return;
  const { stepSec, total } = seq.playInfo();
  if (stepSec > 0 && total > 0) seq.setPlayhead(Math.floor(Tone.Transport.seconds / stepSec) % total);
}

// boot
renderPalette(els.palette, INSTRUMENTS, previewInstrument);
const mixer = createMixer({ mount: els.mixMount, catalog: INSTRUMENTS, onEdit: applyEdit });
const roll = createPianoRoll({ mount: els.rollMount, onEdit: applyEdit });
seq = createSequencer({ mount: els.seqMount, catalog: INSTRUMENTS, onChange: syncFromSequencer });
els.seqLoad.addEventListener("click", () => { const s = getSong(); if (s && !seq.loadSong(s)) showError("can't load this score onto the grid (needs a uniform step pattern)"); });
loadSong(normalizeSong(EXAMPLES[0].song));
markDirty(false);

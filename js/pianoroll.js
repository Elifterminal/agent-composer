// pianoroll.js — a real piano-roll note editor (canvas), one track at a time.
// Drag on empty space to create a note, drag a note to move it, drag its right
// edge to resize, double-click or right-click to delete, Delete key removes the
// selection, alt+wheel adjusts velocity. Drum tracks get one row per drum voice.
//
// Edits compile back into the score's sequential note list (same-start notes
// become chords, gaps become rests), so the JSON/MD text agents edit stays the
// single source of truth. Overlaps the format can't express auto-trim the
// earlier note — classic mono-stream behavior, shown honestly in the roll.
import { DRUMS } from "./audio.js";

const EPS = 1e-4;
// representable single-token durations, in beats, descending (incl. dotted + triplet)
const TOK = [
  [6, "1n."], [4, "1n"], [3, "2n."], [8 / 3, "1t"], [2, "2n"], [1.5, "4n."], [4 / 3, "2t"],
  [1, "4n"], [0.75, "8n."], [2 / 3, "4t"], [0.5, "8n"], [0.375, "16n."], [1 / 3, "8t"],
  [0.25, "16n"], [0.1875, "32n."], [1 / 6, "16t"], [0.125, "32n"],
];
const SNAPS = [["4n", "1/4"], ["8n", "1/8"], ["8t", "1/8T"], ["16n", "1/16"], ["32n", "1/32"]];

export function beatsOfTok(d) {
  const m = /^(\d+)(t|n\.?)$/.exec(String(d).trim());
  if (!m) return 1;
  let b = 4 / +m[1];
  if (m[2] === "t") b *= 2 / 3;
  else if (m[2] === "n.") b *= 1.5;
  return b;
}
function tokAtMost(beats) {            // largest representable token <= beats
  for (const [v, t] of TOK) if (v <= beats + EPS) return t;
  return null;
}
function tokNearest(beats) {           // closest representable token
  let best = TOK[TOK.length - 1];
  for (const t of TOK) if (Math.abs(t[0] - beats) < Math.abs(best[0] - beats)) best = t;
  return best[1];
}
function restToks(gap) {               // greedy gap -> rest tokens (sub-32n dropped)
  const out = [];
  let g = gap, guard = 0;
  while (g > EPS && guard++ < 128) {
    const t = tokAtMost(g);
    if (!t) break;
    out.push(t); g -= beatsOfTok(t);
  }
  return out;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function nameToMidi(n) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(n));
  if (!m) return null;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
  return (parseInt(m[3]) + 1) * 12 + base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
function midiToName(m) { return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
const isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

// track notes (sequential) -> absolute roll notes
export function parseTrack(track) {
  const notes = [];
  let t = 0;
  for (const n of track.notes) {
    const b = beatsOfTok(n.rest != null ? n.rest : n.dur);
    if (n.rest == null) {
      for (const p of (Array.isArray(n.note) ? n.note : [n.note]))
        notes.push({ start: t, beats: b, pitch: String(p), vel: n.vel ?? 0.85 });
    }
    t += b;
  }
  return { notes, length: t };
}

// absolute roll notes -> sequential score notes (chords + rests; overlaps trim)
export function compileNotes(rollNotes) {
  const sorted = [...rollNotes].sort((a, b) => a.start - b.start);
  const out = [];
  let t = 0, i = 0;
  while (i < sorted.length) {
    const start = sorted[i].start;
    const group = [];
    while (i < sorted.length && Math.abs(sorted[i].start - start) < EPS) group.push(sorted[i++]);
    if (start - t > EPS) for (const tok of restToks(start - t)) { out.push({ rest: tok }); t += beatsOfTok(tok); }
    let beats = Math.max(...group.map((g) => g.beats));
    const nextStart = i < sorted.length ? sorted[i].start : Infinity;
    if (start + beats > nextStart + EPS) beats = nextStart - start;   // trim into the next event
    const tok = tokAtMost(beats);
    if (!tok) continue;                                                // too short to express
    const pitches = [...new Set(group.map((g) => g.pitch))];
    out.push({ note: pitches.length > 1 ? pitches : pitches[0], dur: tok, vel: Math.max(...group.map((g) => g.vel ?? 0.85)) });
    t = start + beatsOfTok(tok);
  }
  return out;
}

export function createPianoRoll({ mount, onEdit }) {
  const state = {
    song: null, trackIdx: 0,
    snap: "16n", zoom: 36,            // px per beat
    rowH: 14, gutter: 56, ruler: 22,
    notes: [], length: 0,
    rows: [],                          // [{pitch,label,black}] top -> bottom
    isDrum: false,
    sel: null, hover: null,
    drag: null,                        // {mode, note, x0, y0, orig}
    lastDurTok: "16n",
    playBeat: -1, tempo: 120,
  };

  // ---- DOM ------------------------------------------------------------------
  const bar = document.createElement("div"); bar.className = "roll-bar";
  const trackSel = document.createElement("select"); trackSel.className = "roll-track"; trackSel.title = "track to edit";
  const snapSel = document.createElement("select"); snapSel.title = "grid snap";
  for (const [v, l] of SNAPS) { const o = document.createElement("option"); o.value = v; o.textContent = "snap " + l; if (v === state.snap) o.selected = true; snapSel.appendChild(o); }
  const zoomOut = mkBtn("−"), zoomIn = mkBtn("+");
  const hint = document.createElement("span"); hint.className = "muted roll-hint";
  hint.textContent = "drag empty = draw · drag note = move · drag right edge = resize · dbl/right-click = delete · alt+wheel = velocity";
  bar.append(trackSel, snapSel, zoomOut, zoomIn, hint);

  const scroller = document.createElement("div"); scroller.className = "roll-scroll";
  const canvas = document.createElement("canvas"); canvas.tabIndex = 0;
  scroller.appendChild(canvas);
  mount.append(bar, scroller);

  function mkBtn(t) { const b = document.createElement("button"); b.className = "roll-zoom"; b.textContent = t; return b; }

  trackSel.addEventListener("change", () => { state.trackIdx = +trackSel.value; loadTrack(); });
  snapSel.addEventListener("change", () => { state.snap = snapSel.value; draw(); });
  zoomIn.addEventListener("click", () => { state.zoom = Math.min(160, state.zoom * 1.4); draw(); });
  zoomOut.addEventListener("click", () => { state.zoom = Math.max(10, state.zoom / 1.4); draw(); });

  // ---- model sync ------------------------------------------------------------
  function refresh(song) {
    if (!song || state.drag) return;
    state.song = song; state.tempo = song.tempo;
    if (state.trackIdx >= song.tracks.length) state.trackIdx = Math.max(0, song.tracks.length - 1);
    // rebuild track menu
    trackSel.innerHTML = "";
    song.tracks.forEach((t, i) => {
      const o = document.createElement("option");
      o.value = i; o.textContent = `${i + 1}: ${t.name} (${t.instrument})`;
      if (i === state.trackIdx) o.selected = true;
      trackSel.appendChild(o);
    });
    loadTrack();
  }

  function loadTrack() {
    const track = state.song && state.song.tracks[state.trackIdx];
    if (!track) { state.notes = []; state.rows = []; draw(); return; }
    const { notes, length } = parseTrack(track);
    state.notes = notes; state.length = length; state.sel = null;
    state.isDrum = track.instrument === "drumkit";
    state.rows = buildRows(track, notes);
    draw();
  }

  function buildRows(track, notes) {
    if (track.instrument === "drumkit") {
      return [...DRUMS].reverse().map((d) => ({ pitch: d, label: d, black: false }));
    }
    // melodic: span the content with padding, min two octaves
    let lo = 57, hi = 81;                                       // default A3..A5
    const ms = notes.map((n) => nameToMidi(n.pitch)).filter((m) => m != null);
    if (ms.length) { lo = Math.min(...ms) - 5; hi = Math.max(...ms) + 5; }
    while (hi - lo < 24) { lo--; hi++; }
    lo = Math.max(12, lo); hi = Math.min(115, hi);
    const rows = [];
    for (let m = hi; m >= lo; m--) rows.push({ pitch: midiToName(m), label: m % 12 === 0 ? midiToName(m) : "", black: isBlack(m), midi: m });
    return rows;
  }

  function commit() {
    const idx = state.trackIdx;
    const notes = compileNotes(state.notes);
    onEdit((song) => { if (song.tracks[idx]) song.tracks[idx].notes = notes; });
  }

  // ---- geometry ---------------------------------------------------------------
  const snapBeats = () => beatsOfTok(state.snap);
  const contentBeats = () => Math.max(state.length + 8, 16);
  function xOfBeat(b) { return state.gutter + b * state.zoom; }
  function beatOfX(x) { return (x - state.gutter) / state.zoom; }
  function rowOfPitch(p) { return state.rows.findIndex((r) => r.pitch === p || (r.midi != null && r.midi === nameToMidi(p))); }
  function yOfRow(r) { return state.ruler + r * state.rowH; }
  function rowOfY(y) { return Math.floor((y - state.ruler) / state.rowH); }
  function beatsPerBar() {
    const [num, den] = (state.song?.timeSignature || "4/4").split("/").map(Number);
    return (num || 4) * (4 / (den || 4));
  }

  function noteAt(x, y) {
    for (let k = state.notes.length - 1; k >= 0; k--) {
      const n = state.notes[k];
      const r = rowOfPitch(n.pitch);
      if (r < 0) continue;
      const nx = xOfBeat(n.start), nw = Math.max(4, n.beats * state.zoom);
      const ny = yOfRow(r);
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + state.rowH) {
        return { note: n, edge: x > nx + nw - Math.min(8, nw * 0.35) };
      }
    }
    return null;
  }

  // ---- drawing ----------------------------------------------------------------
  function draw() {
    const rows = state.rows.length || 1;
    const wCss = Math.max(scroller.clientWidth || 800, state.gutter + contentBeats() * state.zoom + 20);
    const hCss = state.ruler + rows * state.rowH + 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = wCss * dpr; canvas.height = hCss * dpr;
    canvas.style.width = wCss + "px"; canvas.style.height = hCss + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, wCss, hCss);
    ctx.font = "10px ui-monospace, monospace";

    // row backgrounds
    state.rows.forEach((r, i) => {
      const y = yOfRow(i);
      ctx.fillStyle = r.black ? "rgba(255,255,255,0.022)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(state.gutter, y, wCss - state.gutter, state.rowH - 1);
      if (r.midi != null && r.midi % 12 === 0) {                  // octave line above each C
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fillRect(state.gutter, y + state.rowH - 1, wCss - state.gutter, 1);
      }
    });
    // grid lines: snap (faint), beat, bar
    const bpb = beatsPerBar(), sb = snapBeats(), total = contentBeats();
    for (let b = 0; b <= total + EPS; b += sb) {
      const x = xOfBeat(b);
      const isBar = Math.abs(b / bpb - Math.round(b / bpb)) < EPS;
      const isBeat = Math.abs(b - Math.round(b)) < EPS;
      ctx.fillStyle = isBar ? "rgba(124,92,255,0.5)" : isBeat ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(x, state.ruler, 1, hCss - state.ruler);
      if (isBar) { ctx.fillStyle = "#7d93ab"; ctx.fillText(String(Math.round(b / bpb) + 1), x + 3, 14); }
    }
    // gutter labels
    ctx.fillStyle = "#0a1018"; ctx.fillRect(0, 0, state.gutter, hCss);
    state.rows.forEach((r, i) => {
      if (!r.label) return;
      ctx.fillStyle = "#7d93ab";
      ctx.fillText(r.label, 6, yOfRow(i) + state.rowH - 3);
    });

    // notes
    for (const n of state.notes) {
      const r = rowOfPitch(n.pitch);
      if (r < 0) continue;
      const x = xOfBeat(n.start), w = Math.max(4, n.beats * state.zoom - 1), y = yOfRow(r);
      ctx.globalAlpha = 0.45 + 0.55 * (n.vel ?? 0.85);
      ctx.fillStyle = n === state.sel ? "#7c5cff" : "#37e6c8";
      rr(ctx, x, y + 1, w, state.rowH - 3, 3); ctx.fill();
      ctx.globalAlpha = 1;
      if (n === state.sel) { ctx.strokeStyle = "#fff"; rr(ctx, x, y + 1, w, state.rowH - 3, 3); ctx.stroke(); }
    }
    // playhead
    if (state.playBeat >= 0) {
      ctx.fillStyle = "#7c5cff";
      ctx.fillRect(xOfBeat(state.playBeat), state.ruler, 2, hCss - state.ruler);
    }
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---- interaction --------------------------------------------------------------
  function evtPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  const snapTo = (b) => Math.max(0, Math.round(b / snapBeats()) * snapBeats());

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 2) return;                      // handled by contextmenu
    canvas.focus();
    const { x, y } = evtPos(e);
    if (y < state.ruler) return;
    const hit = noteAt(x, y);
    if (hit) {
      state.sel = hit.note;
      state.drag = { mode: hit.edge ? "resize" : "move", note: hit.note, x0: x, y0: y, orig: { ...hit.note } };
    } else {
      const row = rowOfY(y);
      if (row < 0 || row >= state.rows.length) return;
      const n = { start: snapTo(beatOfX(x)), beats: beatsOfTok(state.lastDurTok), pitch: state.rows[row].pitch, vel: 0.85 };
      state.notes.push(n);
      state.sel = n;
      state.drag = { mode: "create", note: n, x0: x, y0: y, orig: { ...n } };
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    draw();
  });

  canvas.addEventListener("pointermove", (e) => {
    const { x, y } = evtPos(e);
    if (!state.drag) {
      const hit = noteAt(x, y);
      canvas.style.cursor = hit ? (hit.edge ? "ew-resize" : "grab") : "crosshair";
      return;
    }
    const d = state.drag, n = d.note;
    if (d.mode === "move") {
      n.start = snapTo(d.orig.start + beatOfX(x) - beatOfX(d.x0));
      const row = Math.min(state.rows.length - 1, Math.max(0, rowOfY(y)));
      n.pitch = state.rows[row].pitch;
    } else {                                          // resize / create both stretch the tail
      const beats = beatOfX(x) - n.start;
      n.beats = beatsOfTok(tokNearest(Math.max(snapBeats(), beats)));
    }
    draw();
  });

  function endDrag(e) {
    if (!state.drag) return;
    const d = state.drag;
    if (d.mode !== "move") state.lastDurTok = tokNearest(d.note.beats);
    state.drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    commit();
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("dblclick", (e) => {
    const { x, y } = evtPos(e);
    const hit = noteAt(x, y);
    if (hit) { state.notes = state.notes.filter((n) => n !== hit.note); state.sel = null; commit(); }
  });
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const { x, y } = evtPos(e);
    const hit = noteAt(x, y);
    if (hit) { state.notes = state.notes.filter((n) => n !== hit.note); state.sel = null; commit(); }
  });
  canvas.addEventListener("keydown", (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && state.sel) {
      e.preventDefault();
      state.notes = state.notes.filter((n) => n !== state.sel);
      state.sel = null; commit();
    }
  });
  canvas.addEventListener("wheel", (e) => {
    if (!e.altKey) return;                           // plain wheel scrolls the panel
    e.preventDefault();
    const { x, y } = evtPos(e);
    const hit = noteAt(x, y);
    const n = (hit && hit.note) || state.sel;
    if (!n) return;
    n.vel = Math.min(1, Math.max(0.05, +(n.vel ?? 0.85) + (e.deltaY < 0 ? 0.05 : -0.05)));
    hint.textContent = `velocity ${(n.vel).toFixed(2)} — ${n.pitch}`;
    draw(); commit();
  }, { passive: false });

  // playhead from the transport (seconds -> beats at the song tempo)
  function setPlayhead(seconds) {
    state.playBeat = seconds >= 0 ? seconds * (state.tempo / 60) : -1;
    draw();
  }

  window.__rollDebug = state;          // introspection for headless tests
  return { refresh, setPlayhead, get trackIdx() { return state.trackIdx; } };
}

// sequencer.js — an advanced matrix step sequencer. Each track is a grid of
// rows × steps: drum tracks put one drum voice per row, melodic tracks put scale
// pitches per row (a quantized piano-roll). Clicking a cell cycles its velocity.
// The whole thing compiles to a standard AgentScore song, so Play / MIDI / WAV /
// engrave all keep working unchanged. No dependencies beyond Tone (for note math).
import { isDrumKit } from "./audio.js";
const Tone = window.Tone;

// scale semitone offsets (root = 0)
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  "penta-minor": [0, 3, 5, 7, 10],
  "penta-major": [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
// drum voices offered as rows for a drumkit track (top → bottom)
const DRUM_ROWS = ["crash", "ride", "openhat", "hat", "clap", "rim", "snare", "hitom", "tom", "lowtom", "cowbell", "shaker", "conga", "clave", "kick808", "kick"];
// step duration per (denominator, subdivision-per-beat)
const STEP_DUR = {
  "2:2": "4n", "2:4": "8n",
  "4:2": "8n", "4:3": "8t", "4:4": "16n", "4:6": "16t",
  "8:2": "16n", "8:3": "16t", "8:4": "32n",
};
// velocity for each on-level (cycled by clicking); index 0 = off
const LEVEL_VEL = [0, 1.0, 0.66, 0.4];

let _uid = 0;
function newTrack(instrument = "drumkit") {
  return {
    id: ++_uid, name: isDrumKit(instrument) ? "Drums" : "Synth",
    instrument, volume: -8, pan: 0, mute: false,
    scale: "penta-minor", root: "C", baseOct: 3, octaves: 2,
    cells: {},                 // key `${rowNote}@${step}` -> level 1..3
  };
}

export function createSequencer({ mount, catalog, onChange }) {
  const state = {
    tempo: 120, num: 4, den: 4, sub: 4, bars: 1, swing: 0,
    tracks: [newTrack("drumkit"), (() => { const t = newTrack("supersaw"); t.name = "Bass"; t.baseOct = 2; return t; })()],
    playStep: -1,
  };
  const fire = () => { try { onChange && onChange(); } catch (e) {} };

  const stepsPerBar = () => state.num * state.sub;
  const totalSteps = () => stepsPerBar() * state.bars;
  const stepDur = () => STEP_DUR[`${state.den}:${state.sub}`] || "16n";
  const stepSec = () => { try { Tone.Transport.bpm.value = state.tempo; return Tone.Time(stepDur()).toSeconds(); } catch (e) { return 0.125; } };

  // rows for a track, top (high) → bottom (low)
  function rowsFor(t) {
    if (isDrumKit(t.instrument)) return DRUM_ROWS.map((d) => ({ note: d, label: d }));
    const offs = SCALES[t.scale] || SCALES["penta-minor"];
    let base;
    try { base = Tone.Frequency(`${t.root}${t.baseOct}`).toMidi(); } catch (e) { base = 48; }
    const rows = [];
    for (let o = 0; o < t.octaves; o++) for (const off of offs) {
      const midi = base + o * 12 + off;
      if (midi < 0 || midi > 127) continue;
      const note = Tone.Frequency(midi, "midi").toNote();
      rows.push({ note, label: note });
    }
    return rows.reverse();
  }

  // ---- compile grid -> AgentScore song -------------------------------------
  function compile() {
    const total = totalSteps(), dur = stepDur();
    const tracks = state.tracks.map((t) => {
      const notes = [];
      for (let s = 0; s < total; s++) {
        const on = [];
        let vel = 0;
        for (const r of rowsFor(t)) {
          const v = t.cells[`${r.note}@${s}`] | 0;
          if (v > 0) { on.push(r.note); vel = Math.max(vel, LEVEL_VEL[v] || 0.85); }   // loudest hit wins
        }
        if (on.length) notes.push({ note: on.length > 1 ? on : on[0], dur, vel });
        else notes.push({ rest: dur });
      }
      return { name: t.name, instrument: t.instrument, volume: t.volume, pan: t.pan, mute: t.mute, notes };
    });
    return {
      title: "Sequence", tempo: state.tempo, timeSignature: `${state.num}/${state.den}`,
      swing: state.swing, master: { volume: -6, reverb: 0.15 }, tracks,
    };
  }

  // best-effort import of a song that was authored on the grid (uniform steps)
  function loadSong(song) {
    if (!song || !Array.isArray(song.tracks) || !song.tracks.length) return false;
    const [num, den] = (song.timeSignature || "4/4").split("/").map(Number);
    state.tempo = song.tempo; state.num = num || 4; state.den = den || 4; state.swing = song.swing || 0;
    // infer subdivision + bars from the first track's step grid
    state.tracks = song.tracks.map((tr) => {
      const t = newTrack(tr.instrument);
      t.name = tr.name; t.volume = tr.volume; t.pan = tr.pan; t.mute = tr.mute;
      tr.notes.forEach((n, s) => {
        if (n.rest != null) return;
        const lvl = n.vel >= 0.85 ? 1 : n.vel >= 0.55 ? 2 : 3;
        for (const note of (Array.isArray(n.note) ? n.note : [n.note])) t.cells[`${note}@${s}`] = lvl;
      });
      return t;
    });
    // pick sub so steps-per-bar matches the longest track
    const maxLen = Math.max(...song.tracks.map((t) => t.notes.length), 1);
    state.bars = 1; state.sub = Math.max(1, Math.round(maxLen / (state.num || 4)));
    render(); fire(); return true;
  }

  // ---- rendering -----------------------------------------------------------
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function opt(sel, val, label, cur) { const o = el("option", null, label || val); o.value = val; if (String(val) === String(cur)) o.selected = true; sel.appendChild(o); return o; }

  function render() {
    mount.innerHTML = "";
    mount.appendChild(globalBar());
    const wrap = el("div", "seq-tracks");
    state.tracks.forEach((t, i) => wrap.appendChild(trackBlock(t, i)));
    mount.appendChild(wrap);
    const add = el("button", "seq-add", "+ add track");
    add.addEventListener("click", () => { state.tracks.push(newTrack("supersaw")); render(); fire(); });
    mount.appendChild(add);
    highlight(state.playStep);
  }

  function globalBar() {
    const bar = el("div", "seq-global");
    const numField = (label, val, min, max, on) => {
      const w = el("label", "seq-field"); w.appendChild(el("span", null, label));
      const inp = el("input"); inp.type = "number"; inp.value = val; inp.min = min; inp.max = max;
      inp.addEventListener("change", () => { on(inp.value); render(); fire(); });
      w.appendChild(inp); return w;
    };
    const selField = (label, vals, cur, on) => {
      const w = el("label", "seq-field"); w.appendChild(el("span", null, label));
      const s = el("select"); vals.forEach(([v, l]) => opt(s, v, l, cur));
      s.addEventListener("change", () => { on(s.value); render(); fire(); });
      w.appendChild(s); return w;
    };
    bar.appendChild(numField("tempo", state.tempo, 20, 400, (v) => state.tempo = +v));
    bar.appendChild(selField("beats", [2, 3, 4, 5, 6, 7, 9, 12].map((n) => [n, String(n)]), state.num, (v) => state.num = +v));
    bar.appendChild(selField("/", [[2, "2"], [4, "4"], [8, "8"]], state.den, (v) => { state.den = +v; if (!STEP_DUR[`${state.den}:${state.sub}`]) state.sub = state.den === 8 ? 4 : 4; }));
    bar.appendChild(selField("steps/beat", [[2, "2 (8th)"], [3, "3 (trip)"], [4, "4 (16th)"], [6, "6"]].filter(([v]) => STEP_DUR[`${state.den}:${v}`]), state.sub, (v) => state.sub = +v));
    bar.appendChild(selField("bars", [[1, "1"], [2, "2"], [4, "4"]], state.bars, (v) => state.bars = +v));
    const sw = el("label", "seq-field"); sw.appendChild(el("span", null, "swing"));
    const sr = el("input"); sr.type = "range"; sr.min = 0; sr.max = 0.6; sr.step = 0.05; sr.value = state.swing;
    sr.addEventListener("input", () => { state.swing = +sr.value; fire(); });
    sw.appendChild(sr); bar.appendChild(sw);
    return bar;
  }

  function trackBlock(t, idx) {
    const block = el("div", "seq-track");
    // header controls
    const head = el("div", "seq-thead");
    const name = el("input", "seq-name"); name.value = t.name;
    name.addEventListener("change", () => { t.name = name.value || "Track"; fire(); });
    head.appendChild(name);

    const inst = el("select", "seq-inst");
    for (const it of catalog) opt(inst, it.id, `${it.label} (${it.cat})`, t.instrument);
    inst.addEventListener("change", () => { t.instrument = inst.value; t.cells = {}; render(); fire(); });
    head.appendChild(inst);

    if (!isDrumKit(t.instrument)) {
      const sc = el("select", "seq-scale"); Object.keys(SCALES).forEach((s) => opt(sc, s, s, t.scale));
      sc.addEventListener("change", () => { t.scale = sc.value; render(); fire(); });
      head.appendChild(sc);
      const root = el("select", "seq-root"); ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].forEach((r) => opt(root, r, r, t.root));
      root.addEventListener("change", () => { t.root = root.value; render(); fire(); });
      head.appendChild(root);
      const oct = el("select", "seq-oct"); [1, 2, 3, 4, 5].forEach((o) => opt(oct, o, "oct " + o, t.baseOct));
      oct.addEventListener("change", () => { t.baseOct = +oct.value; render(); fire(); });
      head.appendChild(oct);
      const rng = el("select", "seq-range"); [1, 2, 3].forEach((o) => opt(rng, o, o + "×", t.octaves));
      rng.addEventListener("change", () => { t.octaves = +rng.value; render(); fire(); });
      head.appendChild(rng);
    }

    const vol = el("input", "seq-vol"); vol.type = "range"; vol.min = -40; vol.max = 0; vol.value = t.volume; vol.title = "volume dB";
    vol.addEventListener("input", () => { t.volume = +vol.value; fire(); });
    head.appendChild(vol);
    const pan = el("input", "seq-pan"); pan.type = "range"; pan.min = -1; pan.max = 1; pan.step = 0.1; pan.value = t.pan; pan.title = "pan";
    pan.addEventListener("input", () => { t.pan = +pan.value; fire(); });
    head.appendChild(pan);

    const mute = el("button", "seq-mute" + (t.mute ? " on" : ""), "M");
    mute.addEventListener("click", () => { t.mute = !t.mute; mute.classList.toggle("on", t.mute); fire(); });
    head.appendChild(mute);
    const clr = el("button", "seq-clr", "clear");
    clr.addEventListener("click", () => { t.cells = {}; render(); fire(); });
    head.appendChild(clr);
    if (state.tracks.length > 1) {
      const del = el("button", "seq-del", "✕");
      del.addEventListener("click", () => { state.tracks.splice(idx, 1); render(); fire(); });
      head.appendChild(del);
    }
    block.appendChild(head);

    block.appendChild(grid(t));
    return block;
  }

  function grid(t) {
    const total = totalSteps();
    const g = el("div", "seq-grid");
    g.style.setProperty("--steps", total);
    for (const r of rowsFor(t)) {
      const row = el("div", "seq-row");
      row.appendChild(el("div", "seq-rlabel", r.label));
      for (let s = 0; s < total; s++) {
        const key = `${r.note}@${s}`;
        const c = el("div", "seq-cell");
        c.dataset.step = s;
        if (s % state.sub === 0) c.classList.add("beat");
        if (s % stepsPerBar() === 0) c.classList.add("bar");
        applyCell(c, t.cells[key] | 0);
        c.addEventListener("click", () => {
          const next = ((t.cells[key] | 0) + 1) % LEVEL_VEL.length;
          if (next) t.cells[key] = next; else delete t.cells[key];
          applyCell(c, next); fire();
        });
        row.appendChild(c);
      }
      g.appendChild(row);
    }
    return g;
  }
  function applyCell(c, lvl) {
    c.classList.toggle("on", lvl > 0);
    c.dataset.lvl = lvl;
  }

  // playhead column highlight (idx < 0 clears)
  function highlight(idx) {
    state.playStep = idx;
    mount.querySelectorAll(".seq-cell.play").forEach((c) => c.classList.remove("play"));
    if (idx >= 0) mount.querySelectorAll(`.seq-cell[data-step="${idx}"]`).forEach((c) => c.classList.add("play"));
  }

  render();
  return {
    state, compile, loadSong, render,
    playInfo: () => ({ stepSec: stepSec(), total: totalSteps() }),
    setPlayhead: highlight,
  };
}

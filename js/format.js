// format.js — the two text formats AgentScore speaks: JSON (canonical) and a
// compact Markdown notation. Both are first-class: an agent can author in
// either, and we convert losslessly between them. No dependencies.
//
// SONG SHAPE (JSON):
// {
//   "title": "Untitled", "tempo": 120, "timeSignature": "4/4", "swing": 0,
//   "master": { "volume": -6, "reverb": 0.18 },
//   "tracks": [
//     { "name":"Lead", "instrument":"FMSynth", "volume":-8, "pan":0, "mute":false,
//       "notes":[ {"note":"A4","dur":"4n","vel":0.8}, {"note":["C4","E4","G4"],"dur":"2n"}, {"rest":"8n"} ] }
//   ]
// }
//
// MARKDOWN NOTATION:
//   # Title
//   tempo: 120
//   time: 4/4
//   swing: 0
//
//   ## Lead | FMSynth | vol -8 pan 0
//   A4:4 C5:8 E5:8 D5:4 C5:4 | B4:4 D5:8 F5:8 E5:2
//
//   ## Drums | drumkit
//   kick:4 hat:8 hat:8 snare:4
//
//   Token = PITCH:DUR.  Duration: 1=whole 2=half 4=quarter 8=eighth 16 32,
//   dotted "4." , triplet "8t".  Chord: C4+E4+G4:4 .  Rest: r:4 or -:4 .
//   "|" bar separators are optional (visual only).

export const DUR_NUM_TO_TONE = { 1: "1n", 2: "2n", 4: "4n", 8: "8n", 16: "16n", 32: "32n" };
export const DUR_TONE_TO_NUM = { "1n": "1", "2n": "2", "4n": "4", "8n": "8", "16n": "16", "32n": "32" };

// "4" -> "4n", "4." -> "4n.", "8t" -> "8t"
export function mdDurToTone(d) {
  const m = /^(\d+)(\.?)(t?)$/.exec(d.trim());
  if (!m) throw new Error(`bad duration "${d}"`);
  const base = DUR_NUM_TO_TONE[+m[1]];
  if (!base) throw new Error(`unsupported note value "${m[1]}" (use 1/2/4/8/16/32)`);
  if (m[3] === "t") return m[1] + "t";          // Tone triplet form: "8t"
  return base + (m[2] === "." ? "." : "");        // dotted: "4n."
}
export function toneDurToMd(d) {
  const m = /^(\d+)(n?)(\.?)(t?)$/.exec(String(d).trim());
  if (!m) return "4";
  return m[1] + (m[3] || "") + (m[4] || "");
}

export const DEFAULT_SONG = {
  title: "Untitled",
  tempo: 120,
  timeSignature: "4/4",
  swing: 0,
  master: { volume: -6, reverb: 0.18 },
  instruments: {},
  tracks: [],
};

// ---------- validation / normalisation ----------
export function normalizeSong(raw) {
  const s = { ...DEFAULT_SONG, ...(raw || {}) };
  s.tempo = clampNum(s.tempo, 20, 400, 120);
  s.swing = clampNum(s.swing, 0, 1, 0);
  s.timeSignature = /^\d+\/\d+$/.test(s.timeSignature) ? s.timeSignature : "4/4";
  s.master = { volume: clampNum(s.master?.volume, -60, 6, -6), reverb: clampNum(s.master?.reverb, 0, 1, 0.18) };
  s.instruments = normalizeInstruments(s.instruments);
  s.tracks = (Array.isArray(s.tracks) ? s.tracks : []).map(normalizeTrack);
  return s;
}

// Custom, agent-defined instruments. Two types:
//   sampler — pitched multisample: { type:"sampler", baseUrl?, urls:{ "C4":"a.wav", ... }, gain?, release? }
//   slicer  — chop one sample into slices triggered by name/index:
//             { type:"slicer", url:"break.wav", slices: 16 | { "k":[start,dur], ... }, gain? }
function normalizeInstruments(obj) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [id, raw] of Object.entries(obj)) {
    if (!raw || typeof raw !== "object") continue;
    const type = raw.type === "slicer" ? "slicer" : "sampler";
    if (type === "slicer") {
      if (typeof raw.url !== "string") continue;
      out[id] = {
        type, url: raw.url, baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : "",
        slices: normalizeSlices(raw.slices),
        gain: clampNum(raw.gain, -60, 12, 0),
      };
    } else {
      const urls = raw.urls && typeof raw.urls === "object" ? raw.urls : null;
      if (!urls) continue;
      const clean = {};
      for (const [n, f] of Object.entries(urls)) if (typeof f === "string") clean[String(n)] = f;
      out[id] = {
        type, baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : "",
        urls: clean, gain: clampNum(raw.gain, -60, 12, 0), release: clampNum(raw.release, 0, 8, 0.6),
      };
    }
  }
  return out;
}
function normalizeSlices(s) {
  if (typeof s === "number" && s > 0 && s <= 64) return Math.floor(s);
  if (s && typeof s === "object") {
    const out = {};
    for (const [name, range] of Object.entries(s)) {
      if (Array.isArray(range) && range.length >= 1) out[name] = [Number(range[0]) || 0, range[1] != null ? Number(range[1]) : null];
    }
    return out;
  }
  return 8; // default: 8 equal slices
}
function normalizeTrack(t, i) {
  return {
    name: typeof t.name === "string" ? t.name : `Track ${i + 1}`,
    instrument: typeof t.instrument === "string" ? t.instrument : "Synth",
    volume: clampNum(t.volume, -60, 6, -8),
    pan: clampNum(t.pan, -1, 1, 0),
    mute: !!t.mute,
    fx: normalizeFx(t.fx),
    notes: (Array.isArray(t.notes) ? t.notes : []).map(normalizeNote).filter(Boolean),
  };
}

// Per-track effects chain. Each entry is { type, ...params }; types are
// whitelisted and the audio engine clamps params to safe ranges at build time
// (e.g. delay feedback < 1, so a bad value can't blow up the render). Chain is
// applied in order between the instrument and the track's pan/volume.
const FX_TYPES = new Set(["filter", "delay", "pingpong", "distortion", "bitcrush", "chorus", "phaser", "tremolo", "reverb", "eq"]);
function normalizeFx(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const fx of arr) {
    if (!fx || typeof fx !== "object") continue;
    const type = String(fx.type || "").toLowerCase();
    if (!FX_TYPES.has(type)) continue;
    const o = { type };
    for (const [k, v] of Object.entries(fx)) {
      if (k === "type") continue;
      if (typeof v === "number" && Number.isFinite(v)) o[k] = v;
      else if (typeof v === "string" && v.length <= 24) o[k] = v;       // e.g. filter "mode", delay "time"
    }
    out.push(o);
    if (out.length >= 8) break;                                          // cap chain length
  }
  return out;
}
function normalizeNote(n) {
  if (n == null) return null;
  if (n.rest != null) return { rest: String(n.rest) };
  const note = n.note;
  if (note == null) return null;
  return {
    note: Array.isArray(note) ? note.map(String) : String(note),
    dur: String(n.dur || n.duration || "4n"),
    vel: clampNum(n.vel ?? n.velocity, 0, 1, 0.85),
  };
}
function clampNum(v, lo, hi, dflt) {
  v = Number(v);
  if (!Number.isFinite(v)) return dflt;
  return Math.min(hi, Math.max(lo, v));
}

// ---------- JSON ----------
export function songToJson(song) { return JSON.stringify(normalizeSong(song), null, 2); }
export function jsonToSong(text) { return normalizeSong(JSON.parse(text)); }

// ---------- Markdown <-> Song ----------
export function songToMd(song) {
  const s = normalizeSong(song);
  const lines = [`# ${s.title}`, `tempo: ${s.tempo}`, `time: ${s.timeSignature}`, `swing: ${s.swing}`,
    `master: vol ${s.master.volume} reverb ${s.master.reverb}`];
  if (s.instruments && Object.keys(s.instruments).length) lines.push(`> instruments: ${JSON.stringify(s.instruments)}`);
  lines.push("");
  for (const t of s.tracks) {
    const head = `## ${t.name} | ${t.instrument} | vol ${t.volume} pan ${t.pan}${t.mute ? " mute" : ""}`;
    lines.push(head);
    if (t.fx && t.fx.length) lines.push(`> fx: ${JSON.stringify(t.fx)}`);
    const toks = t.notes.map((n) => {
      if (n.rest != null) return `r:${toneDurToMd(n.rest)}`;
      const pitch = Array.isArray(n.note) ? n.note.join("+") : n.note;
      return `${pitch}:${toneDurToMd(n.dur)}`;
    });
    lines.push(toks.join(" "));
    lines.push("");
  }
  return lines.join("\n");
}

export function mdToSong(text) {
  const song = { ...DEFAULT_SONG, master: { ...DEFAULT_SONG.master }, tracks: [] };
  let cur = null;
  const lines = text.split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    if (line.startsWith("# ")) { song.title = line.slice(2).trim(); continue; }
    if (line.startsWith("## ")) { cur = parseTrackHeader(line.slice(3)); song.tracks.push(cur); continue; }
    let m;
    if ((m = /^tempo:\s*(\d+)/i.exec(line))) { song.tempo = +m[1]; continue; }
    if ((m = /^time:\s*(\d+\/\d+)/i.exec(line))) { song.timeSignature = m[1]; continue; }
    if ((m = /^swing:\s*([\d.]+)/i.exec(line))) { song.swing = +m[1]; continue; }
    if ((m = /^master:\s*(.+)/i.exec(line))) {
      const v = /vol\s*(-?[\d.]+)/i.exec(m[1]); const r = /reverb\s*([\d.]+)/i.exec(m[1]);
      if (v) song.master.volume = +v[1]; if (r) song.master.reverb = +r[1]; continue;
    }
    if ((m = /^>\s*instruments:\s*(\{.*\})\s*$/i.exec(line))) {
      try { song.instruments = JSON.parse(m[1]); } catch (e) { /* ignore bad block */ }
      continue;
    }
    if (cur && (m = /^>\s*fx:\s*(\[.*\])\s*$/i.exec(line))) {
      try { cur.fx = JSON.parse(m[1]); } catch (e) { /* ignore bad block */ }
      continue;
    }
    if (cur) parseNoteLine(line, cur);          // a pattern line belongs to current track
  }
  return normalizeSong(song);
}

function parseTrackHeader(s) {
  const parts = s.split("|").map((x) => x.trim());
  const t = { name: parts[0] || "Track", instrument: parts[1] || "Synth", volume: -8, pan: 0, mute: false, fx: [], notes: [] };
  const opts = (parts[2] || "");
  const v = /vol\s*(-?[\d.]+)/i.exec(opts); if (v) t.volume = +v[1];
  const p = /pan\s*(-?[\d.]+)/i.exec(opts); if (p) t.pan = +p[1];
  if (/\bmute\b/i.test(opts)) t.mute = true;
  return t;
}
function parseNoteLine(line, track) {
  for (const tok of line.split(/\s+/)) {
    if (tok === "|" || tok === "") continue;             // bar separators / blanks
    const i = tok.lastIndexOf(":");
    if (i < 0) continue;
    const pitch = tok.slice(0, i), durTok = tok.slice(i + 1);
    let dur;
    try { dur = mdDurToTone(durTok); } catch { continue; }
    if (pitch === "r" || pitch === "-" || pitch === "_") { track.notes.push({ rest: dur }); continue; }
    const chord = pitch.split("+").filter(Boolean);
    track.notes.push({ note: chord.length > 1 ? chord : chord[0], dur, vel: 0.85 });
  }
}

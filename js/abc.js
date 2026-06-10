// abc.js — import a useful subset of ABC notation into an AgentScore song.
// ABC is what LLMs already "speak" (it's all over their training data) and it's
// dense, so an agent can sketch notation in ABC and we enrich it with the JSON
// production layer (instruments, fx, mixing). One-way: ABC -> Song.
//
// Supported: header fields (T,M,L,Q,K,V), key signatures + modes, accidentals
// (with per-bar memory), octave marks, note lengths (incl. /, fractions),
// dotted/broken rhythm (> <), tuplets ((3 etc.), chords [CEG], rests (z x Z),
// barlines, repeats |: :| and 1st/2nd endings, multiple voices -> tracks.
// Ignored: slurs, ties, grace notes, decorations, chord-symbol annotations,
// lyrics. Durations are snapped to AgentScore's note-value vocabulary.
//
// PRODUCTION DIRECTIVES — ABC is notation-only, so AgentScore reads three ways
// to carry production inside an ABC file:
//   %%MIDI program 81        -> maps the GM program to an AgentScore instrument
//   %%MIDI channel 10        -> drum kit
//   V:2 name="supersaw"      -> a voice name that matches an instrument id
//   %%agentscore {"fx":[{"type":"wah"}],"volume":-10}   -> any track fields
//   %%agentscore {"master":{"reverb":0.3},"swing":0.1}  -> any song fields
// Directives apply to the current voice (or the song for song-level keys).
import { SYNTHS, SAMPLED } from "./instruments.js";

const LETTER_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// sharps (+) / flats (-) for each MAJOR tonic
const MAJOR_SHARPS = { C:0, G:1, D:2, A:3, E:4, B:5, "F#":6, "C#":7, F:-1, Bb:-2, Eb:-3, Ab:-4, Db:-5, Gb:-6, Cb:-7 };
const MODE_ADJ = { maj:0, ion:0, ionian:0, dor:-2, dorian:-2, phr:-4, phrygian:-4, lyd:1, lydian:1, mix:-1, mixolydian:-1, aeo:-3, aeolian:-3, min:-3, m:-3, minor:-3, loc:-5, locrian:-5 };
const SHARP_ORDER = ["F","C","G","D","A","E","B"];
const FLAT_ORDER  = ["B","E","A","D","G","C","F"];

// AgentScore duration tokens by whole-note fraction (for snapping)
const DUR_TABLE = [
  ["1n",1],["2n.",0.75],["2t",1/3],["2n",0.5],["4n.",0.375],["4n",0.25],["4t",1/6],
  ["8n.",0.1875],["8n",0.125],["8t",1/12],["16n.",0.09375],["16n",0.0625],["16t",1/24],["32n",0.03125],
];
function snapDur(frac) {
  let best = "4n", err = Infinity;
  for (const [tok, f] of DUR_TABLE) {
    const e = Math.abs(Math.log(frac / f));
    if (e < err) { err = e; best = tok; }
  }
  return best;
}
// a note longer than a whole note -> a few notes (no ties in the format)
function durTokens(frac) {
  const out = [];
  while (frac > 1.0001) { out.push("1n"); frac -= 1; }
  if (frac > 0.0005) out.push(snapDur(frac));
  return out.length ? out : ["32n"];
}

function keyAccidentals(keyField) {
  // e.g. "Dmaj", "Am", "Gmix", "C#", "" -> map letter -> +1/-1
  const m = /^([A-Ga-g])([#b]?)\s*([A-Za-z]*)/.exec((keyField || "").trim());
  const acc = {};
  if (!keyField || /^(none|hp)$/i.test(keyField.trim())) return acc;
  if (!m) return acc;
  const tonic = m[1].toUpperCase() + (m[2] || "");
  const mode = (m[3] || "").toLowerCase().slice(0, 3);
  let sharps = (MAJOR_SHARPS[tonic] != null ? MAJOR_SHARPS[tonic] : 0) + (MODE_ADJ[mode] != null ? MODE_ADJ[mode] : 0);
  if (sharps > 0) for (let i = 0; i < sharps && i < 7; i++) acc[SHARP_ORDER[i]] = 1;
  else if (sharps < 0) for (let i = 0; i < -sharps && i < 7; i++) acc[FLAT_ORDER[i]] = -1;
  return acc;
}

function parseTempo(q) {
  if (!q) return null;
  let m = /(\d+)\s*\/\s*(\d+)\s*=\s*(\d+(?:\.\d+)?)/.exec(q);          // a/b=N
  if (m) return Math.round(+m[3] * 4 * (+m[1] / +m[2]));
  m = /=\s*(\d+(?:\.\d+)?)/.exec(q) || /(\d+(?:\.\d+)?)\s*$/.exec(q);   // =N or bare N
  if (m) return Math.round(+m[1]);
  return null;
}
function meterValue(m) {
  if (!m) return [1, 1];
  if (/^C\|/.test(m)) return [2, 2];
  if (/^C/.test(m)) return [4, 4];
  const mm = /(\d+)\s*\/\s*(\d+)/.exec(m);
  return mm ? [+mm[1], +mm[2]] : [4, 4];
}

// ---- tokenize one music line into events (notes/rests/chords/bars) ----
function parseMusic(line, st, voice) {
  let i = 0; const n = line.length;
  const acc = st.barAcc;                         // per-bar accidental memory {LETTER: +/-1}
  let tuplet = null;                              // { left, factor }
  let broken = 1;                                 // pending duration factor for next note

  const pushNote = (notes, frac) => {
    let f = frac * broken; broken = 1;
    if (tuplet) { f *= tuplet.factor; if (--tuplet.left <= 0) tuplet = null; }
    const ev = { _frac: f };
    if (notes == null) ev.rest = true; else if (notes.length > 1) ev.chord = notes; else ev.note = notes[0];
    voice.events.push(ev);
    return ev;
  };
  const applyBroken = (dir) => {
    // dir '>' : prev dotted, next halved ; '<' : prev halved, next dotted
    const prev = lastTimed();
    if (prev) { prev._frac *= dir === ">" ? 1.5 : 0.5; }
    broken = dir === ">" ? 0.5 : 1.5;
  };
  const lastTimed = () => { for (let k = voice.events.length - 1; k >= 0; k--) if (!voice.events[k].bar) return voice.events[k]; return null; };

  // read a length spec starting at i -> multiplier in unit-note-lengths
  const readLen = () => {
    let num = "", den = "";
    while (i < n && /\d/.test(line[i])) num += line[i++];
    let slashes = 0;
    while (i < n && line[i] === "/") { slashes++; i++; }
    while (i < n && /\d/.test(line[i])) den += line[i++];
    let mult = num ? +num : 1;
    if (slashes) mult /= den ? +den : Math.pow(2, slashes);
    return mult;
  };
  // read one pitch (accidental, letter, octave) at i -> scientific name
  const readPitch = () => {
    let a = 0, sawAcc = false;
    while (i < n && "^_=".includes(line[i])) { sawAcc = true; a += line[i] === "^" ? 1 : line[i] === "_" ? -1 : 0; if (line[i] === "=") a = 0; i++; }
    if (i >= n || !/[A-Ga-g]/.test(line[i])) return null;
    const ch = line[i++];
    const letter = ch.toUpperCase();
    let octv = ch === ch.toLowerCase() ? 5 : 4;
    while (i < n && (line[i] === "," || line[i] === "'")) { octv += line[i] === "'" ? 1 : -1; i++; }
    let semis;
    if (sawAcc) { acc[letter] = a; semis = a; }
    else if (acc[letter] != null) semis = acc[letter];
    else semis = st.key[letter] || 0;
    const midi = (octv + 1) * 12 + LETTER_SEMI[letter] + semis;
    return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  };

  while (i < n) {
    const c = line[i];
    if (c === "%") break;
    if (c === " " || c === "\t" || c === "\\") { i++; continue; }
    if (c === '"') { i++; while (i < n && line[i] !== '"') i++; i++; continue; }       // chord symbol
    if (c === "!") { i++; while (i < n && line[i] !== "!") i++; i++; continue; }        // decoration
    if (c === "+") { i++; while (i < n && line[i] !== "+") i++; i++; continue; }        // legacy decoration
    if (c === "{") { i++; while (i < n && line[i] !== "}") i++; i++; continue; }        // grace notes
    if (c === ")") { i++; continue; }                                                  // slur end
    if (c === "-") { i++; continue; }                                                  // tie (ignored)
    if (c === ">" || c === "<") { applyBroken(c); i++; continue; }
    if (c === "(") {                                                                   // tuplet or slur
      if (/\d/.test(line[i + 1])) {
        i++; let p = ""; while (i < n && /\d/.test(line[i])) p += line[i++];
        let q = null;
        if (line[i] === ":") { i++; let qq = ""; while (i < n && /\d/.test(line[i])) qq += line[i++]; q = qq ? +qq : null; if (line[i] === ":") { i++; while (i < n && /\d/.test(line[i])) i++; } }
        p = +p; if (!q) q = ({ 2:3, 3:2, 4:3, 6:2, 8:3 })[p] || 2;
        tuplet = { left: p, factor: q / p };
      } else i++;                                                                       // slur start
      continue;
    }
    // inline field [K:..] [M:..] [L:..] [Q:..] [V:..]
    if (c === "[" && /[A-Za-z]:/.test(line.slice(i + 1, i + 3))) {
      const end = line.indexOf("]", i); const body = line.slice(i + 1, end < 0 ? n : end);
      applyField(body[0], body.slice(2), st); i = end < 0 ? n : end + 1;
      if (body[0] === "V") return;                                                      // voice switch handled by caller line-level; bail
      continue;
    }
    if (c === "[" && /\d/.test(line[i + 1])) {                                          // [1 / [2 ending
      i++; const ending = +line[i]; i++;
      for (const k in acc) delete acc[k];
      voice.events.push({ bar: true, repStart: false, repEnd: false, ending });
      continue;
    }
    if (c === "[") {                                                                    // chord [CEG]
      i++; const ns = [];
      while (i < n && line[i] !== "]") { const p = readPitch(); if (p) ns.push(p); else i++; }
      if (line[i] === "]") i++;
      const mult = readLen();
      if (ns.length) pushNote(ns, mult * st.unit);
      continue;
    }
    if (c === "|" || c === ":") {                                                       // barline / repeat cluster
      const seg = /^[:|\]]+/.exec(line.slice(i))[0];                                    // note: excludes '[' so chords survive
      i += seg.length;
      let ending = 0;
      if (/\d/.test(line[i])) { ending = +line[i]; i++; }                               // |1 / |2
      const repStart = seg.includes("|:") || seg.includes("::");
      const repEnd = seg.includes(":|") || seg.includes("::");
      for (const k in acc) delete acc[k];
      voice.events.push({ bar: true, repStart, repEnd, ending });
      continue;
    }
    if (c === "z" || c === "x" || c === "y") { i++; const mult = readLen(); if (c !== "y") pushNote(null, mult * st.unit); continue; }
    if (c === "Z" || c === "X") { i++; let num = ""; while (i < n && /\d/.test(line[i])) num += line[i++]; const bars = num ? +num : 1; pushNote(null, bars * (st.meter[0] / st.meter[1])); continue; }
    if ("^_=ABCDEFGabcdefg".includes(c)) { const p = readPitch(); if (p == null) { i++; continue; } const mult = readLen(); pushNote([p], mult * st.unit); continue; }
    i++;                                                                                // skip anything else
  }
}

// ---- production directives ----
const DRUM_KIT_IDS = ["drumkit", "kit808", "kit909"];
const GM_TO_ID = [
  [0, 7, "piano"], [8, 8, "celesta"], [9, 9, "glocken"], [10, 10, "music-box"], [11, 11, "vibraphone"],
  [12, 12, "marimba"], [13, 13, "xylophone"], [14, 15, "tubular-bell"],
  [16, 18, "drawbar"], [19, 20, "organ"], [21, 23, "harmonium"],
  [24, 24, "guitar-nylon"], [25, 25, "guitar-acoustic"], [26, 31, "guitar-electric"], [32, 39, "bass-electric"],
  [40, 41, "violin"], [42, 42, "cello"], [43, 43, "contrabass"], [44, 44, "tremolo-strings"], [45, 45, "pizzicato"],
  [46, 46, "harp"], [47, 47, "impact"], [48, 51, "synth-strings"], [52, 54, "choir-pad"], [55, 55, "brass-stab"],
  [56, 56, "trumpet"], [57, 57, "trombone"], [58, 58, "tuba"], [59, 59, "trumpet-ish"], [60, 60, "french-horn"], [61, 63, "synth-brass"],
  [64, 67, "saxophone"], [68, 69, "breathy"], [70, 70, "bassoon"], [71, 71, "clarinet"],
  [72, 72, "ocarina"], [73, 73, "flute"], [74, 75, "pan-flute"], [76, 79, "ocarina"],
  [80, 80, "square-lead"], [81, 81, "saw-lead"], [82, 83, "pwm-lead"], [84, 84, "soft-lead"], [85, 85, "whistle"],
  [86, 86, "uni-lead"], [87, 87, "fm-bass"], [88, 95, "warm-pad"], [96, 103, "shimmer-pad"],
  [104, 104, "sitar"], [105, 105, "banjo"], [106, 107, "koto"], [108, 108, "kalimba"], [109, 111, "solo-violin"],
  [112, 118, "steel-drum"], [119, 127, "noise-sweep"],
];
function gmToInstrument(n) { for (const [a, b, id] of GM_TO_ID) if (n >= a && n <= b) return id; return "piano"; }
function knownInstrument(id) { return id in SYNTHS || id in SAMPLED || DRUM_KIT_IDS.includes(id); }

const TRACK_KEYS = new Set(["instrument", "volume", "pan", "mute", "solo", "fx", "repeat", "transpose", "offsetBeats", "humanize", "name"]);
const SONG_KEYS = new Set(["master", "swing", "tempo", "title", "instruments"]);
function applyDirective(name, arg, st, voice) {
  if (name === "midi") {
    let m = /^program\s+(?:\d+\s+)?(\d+)/i.exec(arg);
    if (m) { voice.prod.instrument = gmToInstrument(+m[1]); return; }
    m = /^channel\s+(\d+)/i.exec(arg);
    if (m && +m[1] === 10) voice.prod.instrument = "drumkit";
    return;
  }
  if (name === "agentscore") {
    try {
      const obj = JSON.parse(arg);
      if (!obj || typeof obj !== "object") return;
      for (const [k, v] of Object.entries(obj)) {
        if (SONG_KEYS.has(k)) st.songProd[k] = v;
        else if (TRACK_KEYS.has(k)) voice.prod[k] = v;
      }
    } catch (e) { /* malformed directive json — ignored */ }
  }
}

function applyField(letter, value, st) {
  value = (value || "").trim();
  if (letter === "M") { st.meter = meterValue(value); }
  else if (letter === "L") { const m = /(\d+)\s*\/\s*(\d+)/.exec(value); if (m) st.unit = +m[1] / +m[2]; }
  else if (letter === "Q") { const t = parseTempo(value); if (t) st.tempo = t; }
  else if (letter === "K") { st.key = keyAccidentals(value); }
}

// ---- expand repeats (bar-level) into a flat note list ----
function expand(events) {
  // split events into bars carrying repeat flags
  const bars = []; let cur = { notes: [], repStart: false, ending: 0 };
  for (const ev of events) {
    if (ev.bar) {
      cur.repEnd = ev.repEnd;
      if (cur.notes.length || cur.repStart) bars.push(cur);
      cur = { notes: [], repStart: ev.repStart, ending: ev.ending };
    } else cur.notes.push(ev);
  }
  if (cur.notes.length) bars.push(cur);

  const out = []; let i = 0, segStart = 0; const n = bars.length;
  while (i < n) {
    const b = bars[i];
    if (b.repStart) segStart = i;
    if (b.ending === 2) { i++; continue; }           // 2nd endings only played on replay
    out.push(...b.notes);
    if (b.repEnd) {
      let k = i + 1; const second = [];
      while (k < n && bars[k].ending === 2) { second.push(...bars[k].notes); k++; }
      let fe = -1; for (let t = segStart; t <= i; t++) if (bars[t].ending === 1) { fe = t; break; }
      const commonEnd = fe >= 0 ? fe : i + 1;
      for (let t = segStart; t < commonEnd; t++) out.push(...bars[t].notes);
      out.push(...second);
      i = k; segStart = k; continue;        // next implicit ':|' repeats from here, not the first '|:'
    }
    i++;
  }
  return out;
}

export function abcToSong(text) {
  const lines = String(text).replace(/\r/g, "").split("\n");
  const st = { meter: [4, 4], unit: null, tempo: 120, key: {}, barAcc: {}, songProd: {} };
  const voices = {}; let curV = "1"; let title = "Untitled"; let inBody = false;
  const getVoice = (id) => (voices[id] || (voices[id] = { id, events: [], prod: {}, order: Object.keys(voices).length }));
  getVoice("1");

  for (let raw of lines) {
    const line = raw.replace(/^\s+/, "");
    if (!line) continue;
    if (line.startsWith("%%")) {                                  // production directive
      const d = /^%%(\S+)\s*(.*)$/.exec(line);
      if (d) applyDirective(d[1].toLowerCase(), d[2], st, getVoice(curV));
      continue;
    }
    if (line.startsWith("%")) continue;
    const fm = /^([A-Za-z]):(.*)$/.exec(line);
    if (fm && (!inBody || "XTMLKQVCORPZNGHBDFSWwA".includes(fm[1]))) {
      const L = fm[1], val = fm[2].trim();
      if (L === "T" && title === "Untitled") title = val || title;
      else if (L === "V") {
        const id = (val.split(/\s+/)[0] || "1"); curV = id; getVoice(id); st.barAcc = {};
        const nm = /(?:name|nm)="([^"]+)"/.exec(val);             // V:2 name="supersaw"
        if (nm) {
          if (knownInstrument(nm[1])) getVoice(id).prod.instrument = nm[1];
          else getVoice(id).prod.name = nm[1];
        }
      }
      else if (L === "K") { applyField("K", val, st); inBody = true; if (st.unit == null) st.unit = (st.meter[0] / st.meter[1] < 0.75 ? 1 / 16 : 1 / 8); }
      else applyField(L, val, st);
      if (L === "W" || L === "w") continue;
      continue;
    }
    if (!inBody) continue;                                  // music before first K: is ignored
    if (st.unit == null) st.unit = 1 / 8;
    // a music line may switch voice via inline [V:n]; handle splits
    st.barAcc = st.barAcc || {};
    parseMusicLine(line, st, getVoice, () => curV, (v) => { curV = v; });
  }

  const list = Object.values(voices).filter((v) => v.events.some((e) => !e.bar)).sort((a, b) => a.order - b.order);
  const tracks = (list.length ? list : [voices["1"]]).map((v, idx) => {
    const flat = expand(v.events);
    const notes = [];
    for (const ev of flat) {
      const toks = durTokens(ev._frac || 0.125);
      toks.forEach((dur, k) => {
        if (ev.rest) notes.push({ rest: dur });
        else if (ev.chord) notes.push({ note: ev.chord, dur, vel: 0.8 });
        else notes.push({ note: ev.note, dur, vel: 0.8 });
      });
    }
    const base = { name: list.length > 1 ? `Voice ${v.id}` : "ABC", instrument: "piano", volume: -8, pan: 0, notes };
    return { ...base, ...v.prod };                  // %%agentscore / %%MIDI / V:name production wins
  });

  const sp = st.songProd;
  return {
    title: typeof sp.title === "string" ? sp.title : title,
    tempo: Number.isFinite(+sp.tempo) && +sp.tempo > 0 ? +sp.tempo : (st.tempo || 120),
    timeSignature: `${st.meter[0]}/${st.meter[1]}`,
    swing: Number.isFinite(+sp.swing) ? +sp.swing : 0,
    master: (sp.master && typeof sp.master === "object") ? { volume: -6, reverb: 0.2, ...sp.master } : { volume: -6, reverb: 0.2 },
    instruments: (sp.instruments && typeof sp.instruments === "object") ? sp.instruments : {},
    tracks,
  };
}

// handle inline [V:x] voice switches mid music line by splitting on them
function parseMusicLine(line, st, getVoice, getV, setV) {
  const re = /\[V:\s*([^\]\s]+)[^\]]*\]/g;
  let last = 0, m;
  while ((m = re.exec(line))) {
    const seg = line.slice(last, m.index);
    if (seg.trim()) parseMusic(seg, st, getVoice(getV()));
    setV(m[1]); getVoice(m[1]); st.barAcc = {};
    last = re.lastIndex;
  }
  const tail = line.slice(last);
  if (tail.trim()) parseMusic(tail, st, getVoice(getV()));
}

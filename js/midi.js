// midi.js — export an AgentScore song as a Standard MIDI File (format 1).
// No dependencies beyond Tone (already loaded) for note<->MIDI + duration<->ticks.
// One MIDI track per song track, each on its own channel with a General MIDI
// program so it opens with a sensible sound in a DAW; `drumkit` tracks go to
// channel 10 (GM drums).
import { SYNTHS, SAMPLED } from "./instruments.js";
import { isDrumKit } from "./audio.js";
const Tone = window.Tone;

// instrument id -> General MIDI program (0-indexed). Specific ids first, then a
// per-category fallback so any instrument maps to *something* reasonable.
const GM_BY_ID = {
  piano: 0, "synth-piano": 0, "e-piano": 4, rhodes: 4, clav: 7,
  "saw-lead": 81, supersaw: 81, "sync-lead": 81, "fm-lead": 81, "square-lead": 80, "pwm-lead": 80,
  "warm-pad": 89, "glass-pad": 88, "choir-pad": 91, "strings-pad": 50, "dark-pad": 90,
  harp: 46, koto: 107, pluck: 45,
  marimba: 12, kalimba: 108, bell: 14, "music-box": 10, glocken: 9, xylophone: 13,
  "synth-brass": 62, "trumpet-ish": 56, trumpet: 56, trombone: 57, tuba: 58, "french-horn": 60,
  "synth-strings": 50, pizzicato: 45, violin: 40, cello: 42, contrabass: 43,
  "guitar-acoustic": 25, "guitar-electric": 27, "guitar-nylon": 24,
  flute: 73, clarinet: 71, bassoon: 70, saxophone: 66,
  organ: 19, "rock-organ": 18, harmonium: 20,
  "bass-electric": 33,
  MonoSynth: 38, DuoSynth: 90, AMSynth: 89, FMSynth: 81, synth: 80, Synth: 80,
  "chip-tri": 80, "noise-sweep": 122, zap: 121,
};
const GM_BY_CAT = { Bass: 38, Lead: 81, Keys: 4, Pad: 89, Pluck: 46, Mallet: 12, Brass: 61, Strings: 48, Guitar: 25, Woodwind: 73, Organ: 19, Synth: 80, Chip: 80, FX: 96 };
const CAT_OF = {};
for (const [id, d] of Object.entries(SYNTHS)) CAT_OF[id] = d.cat;
for (const [id, d] of Object.entries(SAMPLED)) CAT_OF[id] = d.cat;   // sampled wins on id collisions, matching the engine
function programFor(id) {
  if (id in GM_BY_ID) return GM_BY_ID[id];
  return GM_BY_CAT[CAT_OF[id]] ?? 0;
}

// General MIDI drum note numbers for our kit names (channel 10).
const GM_DRUM = {
  kick: 36, kick808: 35, sub: 35, snare: 38, rim: 37, clap: 39,
  hat: 42, openhat: 46, tom: 47, lowtom: 43, hitom: 50,
  ride: 51, crash: 49, cowbell: 56, shaker: 70, tamb: 54,
  conga: 63, clave: 75, perc: 76,
};

// variable-length quantity (MIDI delta-time encoding)
function vlq(n) {
  n = Math.max(0, Math.round(n));
  const out = [n & 0x7f];
  n = Math.floor(n / 128);
  while (n > 0) { out.unshift((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
  return out;
}
function durToTicks(dur) {
  try { return Math.max(1, Math.round(Tone.Time(dur).toTicks())); } catch (e) { return Tone.Transport.PPQ; }
}
function noteToMidi(n) {
  try { const m = Tone.Frequency(n).toMidi(); return (m >= 0 && m <= 127) ? m : null; } catch (e) { return null; }
}

// Build one MThd-less track chunk body (the event stream) for a song track.
// Honors the track tools: repeat (pattern x N), transpose (pitched only) and
// offsetBeats; humanize is an audio-render concern and is not baked into MIDI.
function trackEvents(track, ch, isDrum) {
  // collect absolute-tick on/off events, then serialize as deltas
  const evs = [];
  const ppq = Tone.Transport.PPQ;
  const repeat = Math.max(1, Math.min(64, Math.round(track.repeat || 1)));
  const semis = isDrum ? 0 : Math.round(track.transpose || 0);
  let tick = Math.round(Math.max(0, +track.offsetBeats || 0) * ppq);
  for (let r = 0; r < repeat; r++) for (const n of track.notes) {
    if (n.rest != null) { tick += durToTicks(n.rest); continue; }
    const d = durToTicks(n.dur);
    const vel = Math.max(1, Math.min(127, Math.round((n.vel ?? 0.85) * 127)));
    const pitches = (Array.isArray(n.note) ? n.note : [n.note])
      .map((p) => isDrum ? (GM_DRUM[String(p).toLowerCase()] ?? null) : noteToMidi(p))
      .filter((m) => m != null)
      .map((m) => Math.max(0, Math.min(127, m + semis)));
    for (const m of pitches) {
      evs.push({ t: tick, on: true, m, vel });
      evs.push({ t: tick + d, on: false, m, vel: 0 });
    }
    tick += d;
  }
  // stable sort: at equal ticks, note-offs before note-ons (clean retriggers)
  evs.sort((a, b) => a.t - b.t || (a.on === b.on ? 0 : a.on ? 1 : -1));
  const bytes = [];
  let prev = 0;
  for (const e of evs) {
    bytes.push(...vlq(e.t - prev));
    bytes.push((e.on ? 0x90 : 0x80) | ch, e.m, e.vel);
    prev = e.t;
  }
  return bytes;
}

function metaTrack(song) {
  // conductor track: tempo + time signature + track name
  const usPerQuarter = Math.round(60000000 / song.tempo);
  const [num, den] = (song.timeSignature || "4/4").split("/").map(Number);
  const denPow = Math.round(Math.log2(den || 4));
  const bytes = [];
  bytes.push(0x00, 0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff);
  bytes.push(0x00, 0xff, 0x58, 0x04, num || 4, denPow, 24, 8);
  const name = textBytes(song.title || "AgentScore");
  bytes.push(0x00, 0xff, 0x03, ...vlq(name.length), ...name);
  return bytes;
}
function textBytes(s) { return Array.from(String(s)).map((c) => c.charCodeAt(0) & 0x7f); }

function chunk(id, dataBytes) {
  const len = dataBytes.length;
  return [...textBytes(id), (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff, ...dataBytes];
}
const EOT = [0x00, 0xff, 0x2f, 0x00];

export function songToMidiBlob(song) {
  const ppq = Tone.Transport.PPQ;
  Tone.Transport.bpm.value = song.tempo;             // so durToTicks resolves correctly
  const trackChunks = [];
  trackChunks.push(chunk("MTrk", [...metaTrack(song), ...EOT]));
  let nextCh = 0;                                    // melodic tracks get their own channel (skip 9 = drums)
  for (const t of song.tracks) {
    const isDrum = isDrumKit(t.instrument);
    let ch;
    if (isDrum) ch = 9;
    else { if (nextCh === 9) nextCh = 10; ch = Math.min(15, nextCh); nextCh++; }
    const name = textBytes(t.name || "Track");
    const body = [0x00, 0xff, 0x03, ...vlq(name.length), ...name];
    if (!isDrum) body.push(0x00, 0xc0 | ch, programFor(t.instrument) & 0x7f);   // program change
    body.push(...trackEvents(t, ch, isDrum), ...EOT);
    trackChunks.push(chunk("MTrk", body));
  }
  const ntrks = trackChunks.length;
  const header = chunk("MThd", [0x00, 0x01, (ntrks >> 8) & 0xff, ntrks & 0xff, (ppq >> 8) & 0xff, ppq & 0xff]);
  const all = [...header, ...trackChunks.flat()];
  return new Blob([new Uint8Array(all)], { type: "audio/midi" });
}

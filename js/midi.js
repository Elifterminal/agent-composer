// midi.js — export an AgentScore song as a Standard MIDI File (format 1).
// No dependencies beyond Tone (already loaded) for note<->MIDI + duration<->ticks.
// One MIDI track per song track; `drumkit` tracks go to channel 10 (GM drums).
const Tone = window.Tone;

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
function trackEvents(track, isDrum) {
  // collect absolute-tick on/off events, then serialize as deltas
  const ch = isDrum ? 9 : 0;
  const evs = [];
  let tick = 0;
  for (const n of track.notes) {
    if (n.rest != null) { tick += durToTicks(n.rest); continue; }
    const d = durToTicks(n.dur);
    const vel = Math.max(1, Math.min(127, Math.round((n.vel ?? 0.85) * 127)));
    const pitches = (Array.isArray(n.note) ? n.note : [n.note])
      .map((p) => isDrum ? (GM_DRUM[String(p).toLowerCase()] ?? null) : noteToMidi(p))
      .filter((m) => m != null);
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
  for (const t of song.tracks) {
    const isDrum = t.instrument === "drumkit";
    const name = textBytes(t.name || "Track");
    const body = [0x00, 0xff, 0x03, ...vlq(name.length), ...name, ...trackEvents(t, isDrum), ...EOT];
    trackChunks.push(chunk("MTrk", body));
  }
  const ntrks = trackChunks.length;
  const header = chunk("MThd", [0x00, 0x01, (ntrks >> 8) & 0xff, ntrks & 0xff, (ppq >> 8) & 0xff, ppq & 0xff]);
  const all = [...header, ...trackChunks.flat()];
  return new Blob([new Uint8Array(all)], { type: "audio/midi" });
}

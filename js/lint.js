// lint.js — structured feedback on a song so an agent (which can't hear the
// render) can self-correct before exporting. Returns errors (will sound wrong /
// silent) and warnings (probably not intended), plus a small info block. Pure,
// no side effects.
import { INSTRUMENTS, isDrumName, isDrumKit } from "./audio.js";
const Tone = window.Tone;

const KNOWN_IDS = new Set(INSTRUMENTS.map((i) => i.id));
// back-compat ids accepted by the engine (Tone ctor names)
const LEGACY = new Set(["Synth", "FMSynth", "AMSynth", "MonoSynth", "DuoSynth", "PluckSynth"]);

function beatsOf(track) {
  let b = 0;
  for (const n of track.notes) {
    try { b += Tone.Time(n.rest != null ? n.rest : n.dur).toSeconds() * 2; } catch (e) {}  // seconds@120 == beats
  }
  b = b * Math.max(1, Math.round(track.repeat || 1)) + Math.max(0, +track.offsetBeats || 0);
  return Math.round(b * 1000) / 1000;
}
function noteOk(p) { try { const m = Tone.Frequency(p).toMidi(); return m >= 0 && m <= 127; } catch (e) { return false; } }

export function lintSong(song) {
  const errors = [], warnings = [];
  const custom = song.instruments || {};
  const usedCustom = new Set();

  if (!song.tracks.length) errors.push("song has no tracks");

  const lengths = [];
  song.tracks.forEach((t, i) => {
    const where = `track ${i + 1} "${t.name}"`;
    const id = t.instrument;
    const known = KNOWN_IDS.has(id) || LEGACY.has(id) || id in custom;
    if (id in custom) usedCustom.add(id);
    if (!known) warnings.push(`${where}: unknown instrument "${id}" — will fall back to a basic synth`);

    if (!t.notes.length) { warnings.push(`${where}: no notes (silent)`); }

    const isDrum = isDrumKit(id);
    const isSlicer = custom[id]?.type === "slicer";   // notes are slice keys, not pitches
    let badNotes = 0;
    if (!isSlicer) for (const n of t.notes) {
      if (n.rest != null) continue;
      const ps = Array.isArray(n.note) ? n.note : [n.note];
      for (const p of ps) {
        if (isDrum) { if (!isDrumName(p)) badNotes++; }
        else if (!noteOk(p)) badNotes++;
      }
    }
    if (badNotes) warnings.push(`${where}: ${badNotes} ${isDrum ? "unknown drum name(s)" : "unparseable pitch(es)"} (skipped)`);

    if (!t.mute) lengths.push({ name: t.name, beats: beatsOf(t) });

    // fx sanity (types already whitelisted; flag empties)
    if (Array.isArray(t.fx)) for (const fx of t.fx) if (!fx || !fx.type) warnings.push(`${where}: an fx entry has no "type"`);
  });

  // loop alignment: unmuted tracks of differing length won't loop cleanly
  const uniq = [...new Set(lengths.map((l) => l.beats))];
  if (uniq.length > 1) {
    warnings.push("tracks have different lengths — a loop won't line up: " +
      lengths.map((l) => `${l.name}=${l.beats}b`).join(", "));
  }

  // unused custom instruments
  for (const id of Object.keys(custom)) if (!usedCustom.has(id)) warnings.push(`custom instrument "${id}" is defined but no track uses it`);

  // rough clipping estimate: simultaneous full-scale tracks summed in dB
  const activeVols = song.tracks.filter((t) => !t.mute).map((t) => t.volume);
  if (activeVols.length) {
    const lin = activeVols.reduce((a, v) => a + Math.pow(10, v / 20), 0);
    const headroomDb = 20 * Math.log10(lin) + song.master.volume;
    if (headroomDb > 0) warnings.push(`possible clipping: summed track + master level is ~${headroomDb.toFixed(1)} dB over 0 — lower some volumes`);
  }

  return {
    ok: errors.length === 0,
    errors, warnings,
    info: {
      tracks: song.tracks.length,
      notes: song.tracks.reduce((a, t) => a + t.notes.length, 0),
      lengthBeats: Math.max(0, ...lengths.map((l) => l.beats)),
      tempo: song.tempo,
    },
  };
}

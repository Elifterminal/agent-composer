// audio.js — Tone.js playback + offline WAV render for an AgentScore song.
// Tone is loaded globally from the CDN.
import { SYNTHS, SAMPLED, instrumentList, sampledList } from "./instruments.js";
const Tone = window.Tone;

const DRUMS = ["kick", "snare", "hat", "openhat", "clap", "tom", "ride", "crash"];
export function isDrumName(n) { return DRUMS.includes(String(n).toLowerCase()); }

// Catalog for the UI: every synth preset (grouped) + the drum kit.
export const INSTRUMENTS = [
  ...sampledList(),
  ...instrumentList(),
  { id: "drumkit", label: "Drum Kit", cat: "Drums", family: "drums" },
];
export function instrumentLabel(id) {
  if (id === "drumkit") return "Drum Kit";
  return SAMPLED[id]?.label || SYNTHS[id]?.label || id;
}

// Build an instrument. Returns { output, trigger(note,durSec,time,vel), dispose }.
function makeInstrument(name) {
  if (name === "drumkit") return makeDrumKit();
  if (SAMPLED[name]) {
    const d = SAMPLED[name];
    const s = new Tone.Sampler({ urls: d.urls, baseUrl: d.baseUrl, release: d.release ?? 1 });
    if (typeof d.gain === "number") s.volume.value = d.gain;
    return {
      output: s,
      trigger: (note, durSec, time, vel) => { try { s.triggerAttackRelease(note, durSec, time, vel); } catch (e) {} },
      dispose: () => s.dispose(),
    };
  }
  const def = SYNTHS[name] || SYNTHS["synth"];
  const Ctor = Tone[def.ctor] || Tone.Synth;
  let node, kind = "default";
  if (def.ctor === "PluckSynth") { node = new Ctor(def.opts || {}); kind = "pluck"; }
  else if (def.isNoise) { node = new Ctor(def.opts || {}); kind = "noise"; }
  else if (def.mono) { node = new Ctor(def.opts || {}); kind = "default"; }
  else { node = new Tone.PolySynth(Ctor, def.opts || {}); }
  if (typeof def.gain === "number" && node.volume) node.volume.value = def.gain;
  return {
    output: node,
    trigger: (note, durSec, time, vel) => {
      try {
        if (kind === "noise") node.triggerAttackRelease(durSec, time, vel);
        else if (kind === "pluck") {
          (Array.isArray(note) ? note : [note]).forEach((n) => node.triggerAttack(n, time, vel));
        } else node.triggerAttackRelease(note, durSec, time, vel);
      } catch (e) { /* bad note / unsupported */ }
    },
    dispose: () => node.dispose(),
  };
}

function makeDrumKit() {
  const out = new Tone.Gain(1);
  const kick = new Tone.MembraneSynth({ octaves: 6, pitchDecay: 0.05 }).connect(out);
  const tom = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.08 }).connect(out);
  const snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } }).connect(out);
  const clap = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0 } }).connect(out);
  const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }).connect(out);
  const openhat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).connect(out);
  const metal = new Tone.MetalSynth({ harmonicity: 5.1, resonance: 4000, octaves: 1.5 }).connect(out);
  const map = {
    kick: (t, v) => kick.triggerAttackRelease("C1", "8n", t, v),
    tom: (t, v) => tom.triggerAttackRelease("G2", "8n", t, v),
    snare: (t, v) => snare.triggerAttackRelease("16n", t, v),
    clap: (t, v) => clap.triggerAttackRelease("16n", t, v),
    hat: (t, v) => hat.triggerAttackRelease("32n", t, v * 0.7),
    openhat: (t, v) => openhat.triggerAttackRelease("8n", t, v * 0.6),
    ride: (t, v) => metal.triggerAttackRelease("32n", t, v * 0.4),
    crash: (t, v) => metal.triggerAttackRelease("4n", t, v * 0.5),
  };
  return {
    output: out,
    trigger: (note, _dur, time, vel) => {
      const fn = map[String(note).toLowerCase()];
      if (fn) try { fn(time, vel ?? 0.85); } catch (e) {}
    },
    dispose: () => { [kick, tom, snare, clap, hat, openhat, metal, out].forEach((n) => n.dispose()); },
  };
}

// Diagnostic: construct + trigger every instrument once, report failures.
export function probeInstruments() {
  const res = [];
  for (const it of INSTRUMENTS) {
    try {
      const inst = makeInstrument(it.id);
      inst.trigger(it.id === "drumkit" ? "kick" : "C4", 0.2, Tone.now() + 0.02, 0.4);
      setTimeout(() => { try { inst.dispose(); } catch (e) {} }, 500);
      res.push({ id: it.id, ok: true });
    } catch (e) { res.push({ id: it.id, ok: false, err: String(e && e.message || e) }); }
  }
  return res;
}

// Convert a track's notes (sequential) into timed events in seconds (bpm-aware).
function eventsForTrack(track) {
  const evs = [];
  let t = 0;
  for (const n of track.notes) {
    const durTok = n.rest != null ? n.rest : n.dur;
    const sec = Tone.Time(durTok).toSeconds();
    if (n.rest == null) evs.push({ time: t, note: n.note, dur: sec, vel: n.vel ?? 0.85 });
    t += sec;
  }
  return { events: evs, length: t };
}

// Build the live graph: master (reverb + volume + analyser) and per-track parts.
export function buildEngine(song) {
  Tone.Transport.bpm.value = song.tempo;
  Tone.Transport.swing = song.swing || 0;
  Tone.Transport.swingSubdivision = "8n";

  const masterVol = new Tone.Volume(song.master.volume).toDestination();
  const analyser = new Tone.Analyser("waveform", 1024);
  masterVol.connect(analyser);
  const reverb = new Tone.Reverb({ decay: 2.4, wet: song.master.reverb }).connect(masterVol);

  const parts = [], insts = [];
  let length = 0;
  for (const track of song.tracks) {
    const inst = makeInstrument(track.instrument);
    const panvol = new Tone.PanVol(track.pan, track.mute ? -Infinity : track.volume);
    inst.output.connect(panvol);
    panvol.connect(reverb);
    insts.push(inst); insts.push({ dispose: () => panvol.dispose() });
    const { events, length: tl } = eventsForTrack(track);
    length = Math.max(length, tl);
    const part = new Tone.Part((time, ev) => inst.trigger(ev.note, ev.dur, time, ev.vel), events);
    parts.push(part);
  }
  length = Math.max(length, 0.5);

  return {
    analyser, length,
    start(loop) {
      Tone.Transport.loop = !!loop;
      Tone.Transport.loopStart = 0;
      Tone.Transport.loopEnd = length;
      parts.forEach((p) => { p.loop = !!loop; p.loopEnd = length; p.start(0); });
      Tone.Transport.start();
    },
    stop() { Tone.Transport.stop(); Tone.Transport.cancel(); },
    dispose() {
      parts.forEach((p) => p.dispose());
      insts.forEach((i) => i.dispose && i.dispose());
      reverb.dispose(); masterVol.dispose(); analyser.dispose();
    },
  };
}

// Offline-render the whole song to a native AudioBuffer (stereo, 44.1 kHz).
// tailSec adds time past the last note for reverb/releases to ring out; pass 0
// for a seamless loop (render is then exactly the musical length).
export async function renderBuffer(song, tailSec = 2.5) {
  let length = 0.5;
  for (const t of song.tracks) length = Math.max(length, eventsForTrack(t).length);
  const tail = Math.max(0, tailSec);

  const buffer = await Tone.Offline(async () => {
    Tone.Transport.bpm.value = song.tempo;
    const masterVol = new Tone.Volume(song.master.volume).toDestination();
    const reverb = new Tone.Reverb({ decay: 2.4, wet: song.master.reverb }).connect(masterVol);
    await reverb.ready;
    // create all instruments first (samplers begin loading), then wait for all
    // sample buffers before scheduling so nothing renders silent.
    const built = song.tracks.map((track) => {
      const inst = makeInstrument(track.instrument);
      const panvol = new Tone.PanVol(track.pan, track.mute ? -Infinity : track.volume).connect(reverb);
      inst.output.connect(panvol);
      return { inst, track };
    });
    await Tone.loaded();
    for (const { inst, track } of built) {
      for (const ev of eventsForTrack(track).events) inst.trigger(ev.note, ev.dur, ev.time, ev.vel);
    }
    Tone.Transport.start();
  }, length + tail, 2, 44100);

  return buffer.get(); // native AudioBuffer
}

export async function renderWav(song, tailSec = 2.5) { return audioBufferToWavBlob(await renderBuffer(song, tailSec)); }
export async function renderMp3(song, kbps = 192, tailSec = 2.5) { return audioBufferToMp3Blob(await renderBuffer(song, tailSec), kbps); }

// float channel -> Int16Array
function floatToInt16(data) {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// MP3 encode via lamejs (loaded globally). Stereo, CBR.
function audioBufferToMp3Blob(ab, kbps) {
  if (!window.lamejs) throw new Error("MP3 encoder (lamejs) not loaded");
  const ch = Math.min(2, ab.numberOfChannels), sr = ab.sampleRate;
  const enc = new window.lamejs.Mp3Encoder(ch, sr, kbps);
  const left = floatToInt16(ab.getChannelData(0));
  const right = ch > 1 ? floatToInt16(ab.getChannelData(1)) : left;
  const block = 1152, parts = [];
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const r = right.subarray(i, i + block);
    const buf = ch > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (buf.length) parts.push(new Int8Array(buf));
  }
  const end = enc.flush();
  if (end.length) parts.push(new Int8Array(end));
  return new Blob(parts, { type: "audio/mpeg" });
}

// Minimal 16-bit PCM WAV encoder (no deps).
function audioBufferToWavBlob(ab) {
  const numCh = ab.numberOfChannels, len = ab.length, sr = ab.sampleRate;
  const bytes = 44 + len * numCh * 2;
  const buf = new ArrayBuffer(bytes), view = new DataView(buf);
  const wStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  wStr(0, "RIFF"); view.setUint32(4, bytes - 8, true); wStr(8, "WAVE");
  wStr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * 2, true); view.setUint16(32, numCh * 2, true); view.setUint16(34, 16, true);
  wStr(36, "data"); view.setUint32(40, len * numCh * 2, true);
  const chans = [];
  for (let c = 0; c < numCh; c++) chans.push(ab.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}

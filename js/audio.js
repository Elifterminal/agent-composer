// audio.js — Tone.js playback + offline WAV render for an AgentScore song.
// Tone is loaded globally from the CDN.
import { SYNTHS, SAMPLED, instrumentList, sampledList } from "./instruments.js";
const Tone = window.Tone;

// ---- sample loading ---------------------------------------------------------
// Tone's own buffer loader is unreliable for some CDN-hosted mp3s, so we fetch
// + decode samples natively (which works everywhere), cache the AudioBuffers,
// and hand them to Tone.Sampler as ready buffers. Context-independent buffers
// also let the offline render reuse what was decoded in the live context.
const SAMPLE_CACHE = new Map();          // url -> AudioBuffer
const SAMPLER_MAPS = {};                  // instrument id -> { note: AudioBuffer }

async function decodeUrl(url) {
  if (SAMPLE_CACHE.has(url)) return SAMPLE_CACHE.get(url);
  const resp = await fetch(url, { mode: "cors" });
  if (!resp.ok) throw new Error(`sample HTTP ${resp.status}: ${url}`);
  const ab = await resp.arrayBuffer();
  const buf = await Tone.getContext().rawContext.decodeAudioData(ab);
  SAMPLE_CACHE.set(url, buf);
  return buf;
}
async function loadSampledDef(id) {
  if (SAMPLER_MAPS[id]) return SAMPLER_MAPS[id];
  const def = SAMPLED[id];
  if (!def) return null;
  const pairs = await Promise.all(
    Object.entries(def.urls).map(async ([note, file]) => [note, await decodeUrl(def.baseUrl + file)]),
  );
  const map = {};
  for (const [note, buf] of pairs) map[note] = buf;
  SAMPLER_MAPS[id] = map;
  return map;
}
// Preload every sampled instrument a song uses. Resilient: a failed instrument
// is skipped (its track falls back to silence) rather than killing the render.
export async function ensureSamplesLoaded(song) {
  const warn = (lbl) => (e) => console.warn("[AgentScore] sample load failed:", lbl, e.message);
  const ids = [...new Set(song.tracks.map((t) => t.instrument))];
  const custom = song.instruments || {};
  const tasks = [];
  for (const id of ids) {
    if (SAMPLED[id] && !SAMPLER_MAPS[id]) tasks.push(loadSampledDef(id).catch(warn(id)));
    const def = custom[id];
    if (!def) continue;
    if (def.type === "slicer") tasks.push(decodeUrl((def.baseUrl || "") + def.url).catch(warn(id)));
    else if (def.urls) for (const f of Object.values(def.urls)) tasks.push(decodeUrl((def.baseUrl || "") + f).catch(warn(id)));
  }
  await Promise.all(tasks);
}

const DRUMS = ["kick", "kick808", "sub", "snare", "rim", "clap", "hat", "openhat",
  "tom", "lowtom", "hitom", "ride", "crash", "cowbell", "shaker", "tamb", "conga", "clave", "perc"];
export function isDrumName(n) { return DRUMS.includes(String(n).toLowerCase()); }

// ---- per-track effects ------------------------------------------------------
// A track may declare `fx: [{type, ...params}]`. We build a chain of Tone
// effect nodes (validated upstream in format.js) and clamp params HERE so a bad
// value can't blow up the render — e.g. feedback is capped below 1 so a delay
// can't run away. Each builder returns a Tone node; reverb exposes a `.ready`
// promise the offline render awaits.
const cl = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const FX_BUILDERS = {
  filter: (o) => new Tone.Filter({ type: ["lowpass", "highpass", "bandpass", "notch"].includes(o.mode || o.filterType) ? (o.mode || o.filterType) : "lowpass", frequency: cl(o.freq ?? o.frequency, 20, 18000, 800), Q: cl(o.q ?? o.Q, 0, 20, 1) }),
  delay: (o) => new Tone.FeedbackDelay({ delayTime: o.time || "8n", feedback: cl(o.feedback, 0, 0.92, 0.3), wet: cl(o.wet, 0, 1, 0.3) }),
  pingpong: (o) => new Tone.PingPongDelay({ delayTime: o.time || "8n", feedback: cl(o.feedback, 0, 0.92, 0.3), wet: cl(o.wet, 0, 1, 0.3) }),
  distortion: (o) => new Tone.Distortion({ distortion: cl(o.amount ?? o.distortion, 0, 1, 0.4), wet: cl(o.wet, 0, 1, 1) }),
  bitcrush: (o) => new Tone.BitCrusher({ bits: Math.round(cl(o.bits, 1, 16, 4)) }),
  chorus: (o) => new Tone.Chorus({ frequency: cl(o.frequency, 0.05, 20, 1.5), delayTime: cl(o.delayTime, 1, 20, 3.5), depth: cl(o.depth, 0, 1, 0.7), wet: cl(o.wet, 0, 1, 0.5) }).start(),
  phaser: (o) => new Tone.Phaser({ frequency: cl(o.frequency, 0.05, 20, 0.5), octaves: cl(o.octaves, 1, 6, 3), baseFrequency: cl(o.baseFrequency, 50, 2000, 350), wet: cl(o.wet, 0, 1, 0.5) }),
  tremolo: (o) => new Tone.Tremolo({ frequency: cl(o.frequency, 0.1, 30, 9), depth: cl(o.depth, 0, 1, 0.7), wet: cl(o.wet, 0, 1, 0.8) }).start(),
  reverb: (o) => new Tone.Reverb({ decay: cl(o.decay, 0.1, 10, 1.8), wet: cl(o.wet, 0, 1, 0.3) }),
  eq: (o) => new Tone.EQ3({ low: cl(o.low, -24, 12, 0), mid: cl(o.mid, -24, 12, 0), high: cl(o.high, -24, 12, 0) }),
};
// Returns { input, output, ready(), dispose() } or null for an empty/invalid chain.
function buildFxChain(fxList) {
  if (!Array.isArray(fxList) || !fxList.length) return null;
  const nodes = [];
  for (const fx of fxList) {
    const b = FX_BUILDERS[String(fx && fx.type).toLowerCase()];
    if (b) { try { nodes.push(b(fx || {})); } catch (e) { /* skip bad fx */ } }
  }
  if (!nodes.length) return null;
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  const readies = nodes.map((n) => n.ready).filter((p) => p && typeof p.then === "function");
  return {
    input: nodes[0], output: nodes[nodes.length - 1],
    ready: () => Promise.all(readies),
    dispose: () => nodes.forEach((n) => { try { n.dispose(); } catch (e) {} }),
  };
}

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
function makeInstrument(name, custom = {}) {
  if (name === "drumkit") return makeDrumKit();
  if (custom[name]) return makeCustomInstrument(name, custom[name]);
  if (SAMPLED[name]) {
    const d = SAMPLED[name];
    const map = SAMPLER_MAPS[name];
    // wrap each cached AudioBuffer for Tone; requires ensureSamplesLoaded() first
    const urls = {};
    if (map) for (const [note, buf] of Object.entries(map)) urls[note] = new Tone.ToneAudioBuffer(buf);
    const s = new Tone.Sampler({ urls, release: d.release ?? 1 });
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

// Agent-defined instrument (declared in song.instruments). Requires its samples
// to be preloaded via ensureSamplesLoaded().
function makeCustomInstrument(id, def) {
  if (def.type === "slicer") {
    const ab = SAMPLE_CACHE.get((def.baseUrl || "") + def.url);
    const out = new Tone.Volume(typeof def.gain === "number" ? def.gain : 0);
    const dur = ab ? ab.duration : 1;
    const slices = {};
    if (typeof def.slices === "number") {
      const w = dur / def.slices;
      for (let i = 0; i < def.slices; i++) slices[String(i)] = [i * w, w];
    } else if (def.slices) {
      for (const [n, r] of Object.entries(def.slices)) slices[n] = [r[0] || 0, r[1] != null ? r[1] : Math.max(0.02, dur - (r[0] || 0))];
    }
    return {
      output: out,
      trigger: (note, _durSec, time, vel) => {
        if (!ab) return;
        const key = String(Array.isArray(note) ? note[0] : note);
        const sl = slices[key];
        if (!sl) return;
        // fresh source + buffer per hit (sharing/disposing one buffer corrupts the render)
        try { new Tone.ToneBufferSource(new Tone.ToneAudioBuffer(ab)).connect(out).start(time, sl[0], sl[1]); } catch (e) {}
      },
      dispose: () => out.dispose(),
    };
  }
  // sampler (pitched multisample / one-shot) from preloaded buffers
  const urls = {};
  for (const [note, file] of Object.entries(def.urls || {})) {
    const ab = SAMPLE_CACHE.get((def.baseUrl || "") + file);
    if (ab) urls[note] = new Tone.ToneAudioBuffer(ab);
  }
  const s = new Tone.Sampler({ urls, release: def.release ?? 0.6 });
  if (typeof def.gain === "number") s.volume.value = def.gain;
  return {
    output: s,
    trigger: (note, durSec, time, vel) => { try { s.triggerAttackRelease(note, durSec, time, vel); } catch (e) {} },
    dispose: () => s.dispose(),
  };
}

// A fuller synthesized kit: punchy + 808-style kicks, layered snare (body +
// noise), rim, clap, three toms, hats, ride/crash, and hand percussion
// (cowbell, shaker, tambourine, conga, clave, generic perc). All synthesized —
// no samples, so it renders offline instantly and ships nothing copyrighted.
function makeDrumKit() {
  const out = new Tone.Gain(1);
  const noise = (decay, type = "white") => new Tone.NoiseSynth({ noise: { type }, envelope: { attack: 0.001, decay, sustain: 0 } }).connect(out);

  const kick = new Tone.MembraneSynth({ octaves: 6, pitchDecay: 0.045 }).connect(out);
  const kick808 = new Tone.MembraneSynth({ octaves: 8, pitchDecay: 0.12, envelope: { attack: 0.001, decay: 0.6, sustain: 0.02, release: 0.6 } }).connect(out);
  const tom = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.08 }).connect(out);
  // snare = tonal body + noise crack
  const snareBody = new Tone.MembraneSynth({ octaves: 3, pitchDecay: 0.02, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).connect(out);
  const snareNoise = noise(0.18);
  const rim = noise(0.03, "white");
  const clap = noise(0.12, "pink");
  const hat = noise(0.035);
  const openhat = noise(0.32);
  const metal = new Tone.MetalSynth({ harmonicity: 5.1, resonance: 4000, octaves: 1.5 }).connect(out);
  const cowbell = new Tone.MetalSynth({ harmonicity: 8, resonance: 800, octaves: 0.5, envelope: { attack: 0.001, decay: 0.15, release: 0.05 } }).connect(out);
  const shaker = noise(0.04);
  const tamb = new Tone.MetalSynth({ harmonicity: 12, resonance: 6000, octaves: 1, envelope: { attack: 0.001, decay: 0.08, release: 0.02 } }).connect(out);
  const conga = new Tone.MembraneSynth({ octaves: 2, pitchDecay: 0.03, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).connect(out);
  const clave = new Tone.MembraneSynth({ octaves: 1, pitchDecay: 0.005, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(out);

  const map = {
    kick: (t, v) => kick.triggerAttackRelease("C1", "8n", t, v),
    kick808: (t, v) => kick808.triggerAttackRelease("A0", "2n", t, v),
    sub: (t, v) => kick808.triggerAttackRelease("F0", "2n", t, v),       // alias
    tom: (t, v) => tom.triggerAttackRelease("G2", "8n", t, v),
    lowtom: (t, v) => tom.triggerAttackRelease("D2", "8n", t, v),
    hitom: (t, v) => tom.triggerAttackRelease("C3", "8n", t, v),
    snare: (t, v) => { snareBody.triggerAttackRelease("G2", "16n", t, v * 0.8); snareNoise.triggerAttackRelease("16n", t, v); },
    rim: (t, v) => rim.triggerAttackRelease("32n", t, v * 0.8),
    clap: (t, v) => clap.triggerAttackRelease("16n", t, v),
    hat: (t, v) => hat.triggerAttackRelease("32n", t, v * 0.7),
    openhat: (t, v) => openhat.triggerAttackRelease("8n", t, v * 0.6),
    ride: (t, v) => metal.triggerAttackRelease("C6", "32n", t, v * 0.4),
    crash: (t, v) => metal.triggerAttackRelease("C5", "4n", t, v * 0.5),
    cowbell: (t, v) => cowbell.triggerAttackRelease("G#4", "16n", t, v * 0.5),
    shaker: (t, v) => shaker.triggerAttackRelease("32n", t, v * 0.5),
    tamb: (t, v) => tamb.triggerAttackRelease("C7", "32n", t, v * 0.5),
    conga: (t, v) => conga.triggerAttackRelease("A2", "16n", t, v * 0.8),
    clave: (t, v) => clave.triggerAttackRelease("C5", "32n", t, v * 0.7),
    perc: (t, v) => clave.triggerAttackRelease("A4", "32n", t, v * 0.7),
  };
  const all = [kick, kick808, tom, snareBody, snareNoise, rim, clap, hat, openhat, metal, cowbell, shaker, tamb, conga, clave, out];
  return {
    output: out,
    trigger: (note, _dur, time, vel) => {
      const fn = map[String(note).toLowerCase()];
      if (fn) try { fn(time, vel ?? 0.85); } catch (e) {}
    },
    dispose: () => all.forEach((n) => { try { n.dispose(); } catch (e) {} }),
  };
}

// Audition a single instrument (used by the palette). Loads samples if needed.
export async function previewInstrument(id, note = "C4") {
  await Tone.start();
  if (SAMPLED[id]) await ensureSamplesLoaded({ tracks: [{ instrument: id }] });
  const out = new Tone.Volume(-3).toDestination();
  const inst = makeInstrument(id);
  inst.output.connect(out);
  const t = Tone.now() + 0.03;
  if (id === "drumkit") {
    ["kick", "hat", "snare", "hat", "openhat"].forEach((d, i) => inst.trigger(d, 0.2, t + i * 0.16, 0.85));
  } else {
    inst.trigger(["E3", "G#3", "B3"], 0.9, t, 0.7);        // a little chord so pads/keys read
  }
  setTimeout(() => { try { inst.dispose(); out.dispose(); } catch (e) {} }, 1800);
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
    const inst = makeInstrument(track.instrument, song.instruments);
    const panvol = new Tone.PanVol(track.pan, track.mute ? -Infinity : track.volume);
    const fx = buildFxChain(track.fx);
    if (fx) { inst.output.connect(fx.input); fx.output.connect(panvol); insts.push(fx); }
    else inst.output.connect(panvol);
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
  await ensureSamplesLoaded(song);            // decode samples in the live context first

  const buffer = await Tone.Offline(async () => {
    Tone.Transport.bpm.value = song.tempo;
    const masterVol = new Tone.Volume(song.master.volume).toDestination();
    const reverb = new Tone.Reverb({ decay: 2.4, wet: song.master.reverb }).connect(masterVol);
    await reverb.ready;
    // create all instruments first (samplers begin loading), then wait for all
    // sample buffers before scheduling so nothing renders silent.
    const fxChains = [];
    const built = song.tracks.map((track) => {
      const inst = makeInstrument(track.instrument, song.instruments);
      const panvol = new Tone.PanVol(track.pan, track.mute ? -Infinity : track.volume).connect(reverb);
      const fx = buildFxChain(track.fx);
      if (fx) { inst.output.connect(fx.input); fx.output.connect(panvol); fxChains.push(fx); }
      else inst.output.connect(panvol);
      return { inst, track };
    });
    await Promise.all(fxChains.map((f) => f.ready()));    // reverb IRs etc.
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

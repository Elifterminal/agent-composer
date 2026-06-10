// audio.js — Tone.js playback + offline WAV render for an AgentScore song.
// Tone is loaded globally from the CDN.
import { SYNTHS, SAMPLED, instrumentList, sampledList, TRIM } from "./instruments.js";
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

export const DRUMS = ["kick", "kick808", "sub", "snare", "rim", "clap", "hat", "openhat",
  "tom", "lowtom", "hitom", "ride", "crash", "cowbell", "shaker", "tamb", "conga", "clave", "perc"];
export function isDrumName(n) { return DRUMS.includes(String(n).toLowerCase()); }
// All kits answer to the same 19 drum names, so a score can swap its whole kit
// flavor by changing one instrument id.
export const DRUM_KITS = ["drumkit", "kit808", "kit909"];
export function isDrumKit(id) { return DRUM_KITS.includes(String(id)); }

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
  wah: (o) => new Tone.AutoWah({ baseFrequency: cl(o.baseFrequency ?? o.freq, 30, 1000, 100), octaves: cl(o.octaves, 1, 8, 6), sensitivity: cl(o.sensitivity, -40, 0, 0), Q: cl(o.q ?? o.Q, 0, 20, 2), wet: cl(o.wet, 0, 1, 1) }),
  autopan: (o) => new Tone.AutoPanner({ frequency: cl(o.frequency, 0.05, 20, 1), depth: cl(o.depth, 0, 1, 1), wet: cl(o.wet, 0, 1, 1) }).start(),
  autofilter: (o) => new Tone.AutoFilter({ frequency: cl(o.frequency, 0.05, 20, 1), baseFrequency: cl(o.baseFrequency, 20, 5000, 200), octaves: cl(o.octaves, 0, 8, 2.6), depth: cl(o.depth, 0, 1, 1), wet: cl(o.wet, 0, 1, 1) }).start(),
  vibrato: (o) => new Tone.Vibrato({ frequency: cl(o.frequency, 0.1, 20, 5), depth: cl(o.depth, 0, 1, 0.1), wet: cl(o.wet, 0, 1, 1) }),
  pitchshift: (o) => new Tone.PitchShift({ pitch: cl(o.pitch ?? o.semitones, -24, 24, 0), windowSize: cl(o.windowSize, 0.03, 0.1, 0.1), wet: cl(o.wet, 0, 1, 1) }),
  freqshift: (o) => new Tone.FrequencyShifter({ frequency: cl(o.frequency, -2000, 2000, 42), wet: cl(o.wet, 0, 1, 1) }),
  chebyshev: (o) => new Tone.Chebyshev({ order: Math.round(cl(o.order, 1, 100, 50)), wet: cl(o.wet, 0, 1, 0.5) }),
  widener: (o) => new Tone.StereoWidener({ width: cl(o.width, 0, 1, 0.7) }),
  compressor: (o) => new Tone.Compressor({ threshold: cl(o.threshold, -60, 0, -24), ratio: cl(o.ratio, 1, 20, 4), attack: cl(o.attack, 0.001, 1, 0.003), release: cl(o.release, 0.01, 1, 0.25), knee: cl(o.knee, 0, 40, 30) }),
  limiter: (o) => new Tone.Limiter(cl(o.threshold, -24, 0, -6)),
};
// Returns { input, output, pairs, ready(), dispose() } or null for an empty/
// invalid chain. `pairs` keeps each built node next to its fx entry so ramp
// automation can find its target.
function buildFxChain(fxList) {
  if (!Array.isArray(fxList) || !fxList.length) return null;
  const nodes = [], pairs = [];
  for (const fx of fxList) {
    const b = FX_BUILDERS[String(fx && fx.type).toLowerCase()];
    if (b) { try { const n = b(fx || {}); nodes.push(n); pairs.push({ node: n, fx }); } catch (e) { /* skip bad fx */ } }
  }
  if (!nodes.length) return null;
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  const readies = nodes.map((n) => n.ready).filter((p) => p && typeof p.then === "function");
  return {
    input: nodes[0], output: nodes[nodes.length - 1], pairs,
    ready: () => Promise.all(readies),
    dispose: () => nodes.forEach((n) => { try { n.dispose(); } catch (e) {} }),
  };
}

// ---- fx automation ramps ------------------------------------------------------
// An fx entry may carry `ramp` (one object or an array): linear sweeps written
// directly into the score, e.g. a 16-beat filter opening:
//   { "type":"filter", "freq":200, "ramp":{"param":"frequency","to":4000,"at":0,"len":16} }
// `at`/`len` are in BEATS; `from` defaults to the param's current value.
// Scheduled directly on each param's automation timeline — Transport.schedule
// callbacks never fire inside Tone.Offline, so transport events can't be used.
// baseTime = context time where musical position `offsetSec` plays. In looped
// live playback the sweep runs on the first pass only; exports bake it in.
const RAMP_CLAMP = { feedback: [0, 0.92], wet: [0, 1], depth: [0, 1], width: [0, 1] };
function scheduleFxRamps(pairs, baseTime = 0, offsetSec = 0) {
  if (!pairs) return;
  const secPerBeat = 60 / Tone.Transport.bpm.value;
  for (const { node, fx } of pairs) {
    const ramps = Array.isArray(fx.ramp) ? fx.ramp : fx.ramp ? [fx.ramp] : [];
    for (const r of ramps) {
      const p = node[String(r.param)];
      if (!p || typeof p.setValueAtTime !== "function" || !Number.isFinite(+r.to)) continue;
      const lim = RAMP_CLAMP[String(r.param)];
      const clampV = (v) => (lim ? Math.min(lim[1], Math.max(lim[0], v)) : v);
      const len = Math.max(0.01, (+r.len > 0 ? +r.len : 4) * secPerBeat);
      const t0 = baseTime + Math.max(0, +r.at || 0) * secPerBeat - offsetSec;
      const t1 = t0 + len;
      try {
        const from = Number.isFinite(+r.from) ? clampV(+r.from) : p.value;
        const to = clampV(+r.to);
        if (t1 <= baseTime) { p.setValueAtTime(to, baseTime); continue; }   // ramp fully before the seek point
        if (t0 < baseTime) {                                                 // seeked into the middle of the ramp
          p.setValueAtTime(from + (to - from) * ((baseTime - t0) / len), baseTime);
          p.linearRampToValueAtTime(to, t1);
        } else {
          p.setValueAtTime(from, t0);
          p.linearRampToValueAtTime(to, t1);
        }
      } catch (e) { /* unrampable param */ }
    }
  }
}

// Catalog for the UI: every synth preset (grouped) + the drum kits.
export const INSTRUMENTS = [
  ...sampledList(),
  ...instrumentList(),
  { id: "drumkit", label: "Drum Kit", cat: "Drums", family: "drums" },
  { id: "kit808", label: "808 Kit", cat: "Drums", family: "drums" },
  { id: "kit909", label: "909 Kit", cat: "Drums", family: "drums" },
];
export function instrumentLabel(id) {
  if (id === "drumkit") return "Drum Kit";
  if (id === "kit808") return "808 Kit";
  if (id === "kit909") return "909 Kit";
  return SAMPLED[id]?.label || SYNTHS[id]?.label || id;
}

// Build an instrument. Returns { output, trigger(note,durSec,time,vel), dispose }.
function makeInstrument(name, custom = {}) {
  if (isDrumKit(name)) return makeDrumKit(name);
  if (custom[name]) return makeCustomInstrument(name, custom[name]);
  if (SAMPLED[name]) {
    const d = SAMPLED[name];
    const map = SAMPLER_MAPS[name];
    // wrap each cached AudioBuffer for Tone; requires ensureSamplesLoaded() first
    const urls = {};
    if (map) for (const [note, buf] of Object.entries(map)) urls[note] = new Tone.ToneAudioBuffer(buf);
    const s = new Tone.Sampler({ urls, release: d.release ?? 1 });
    s.volume.value = (d.gain || 0) + (TRIM[name] || 0);
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
  if (node.volume) node.volume.value = (def.gain || 0) + (TRIM[name] || 0);
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
// Three flavors answer to the same drum names: "drumkit" (neutral), "kit808"
// (boomy kick, ticky hats, long clap), "kit909" (punchy clicky kick, bright
// snare, sizzly open hat).
const KIT_STYLES = {
  drumkit: { kick: { octaves: 6, pitchDecay: 0.045, decay: 0.4 }, snareBody: 0.12, snareNoise: 0.18, hat: 0.035, openhat: 0.32, clap: 0.12, clapType: "pink" },
  kit808:  { kick: { octaves: 8, pitchDecay: 0.09, decay: 0.7 },  snareBody: 0.10, snareNoise: 0.14, hat: 0.02,  openhat: 0.24, clap: 0.20, clapType: "pink" },
  kit909:  { kick: { octaves: 6, pitchDecay: 0.025, decay: 0.28 }, snareBody: 0.08, snareNoise: 0.24, hat: 0.03,  openhat: 0.45, clap: 0.10, clapType: "white" },
};
function makeDrumKit(style = "drumkit") {
  const st = KIT_STYLES[style] || KIT_STYLES.drumkit;
  const out = new Tone.Gain(Math.pow(10, (TRIM[style] ?? TRIM["drumkit"] ?? 0) / 20));
  const noise = (decay, type = "white") => new Tone.NoiseSynth({ noise: { type }, envelope: { attack: 0.001, decay, sustain: 0 } }).connect(out);

  const kick = new Tone.MembraneSynth({ octaves: st.kick.octaves, pitchDecay: st.kick.pitchDecay, envelope: { attack: 0.001, decay: st.kick.decay, sustain: 0 } }).connect(out);
  const kick808 = new Tone.MembraneSynth({ octaves: 8, pitchDecay: 0.12, envelope: { attack: 0.001, decay: 0.6, sustain: 0.02, release: 0.6 } }).connect(out);
  const tom = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.08 }).connect(out);
  // snare = tonal body + noise crack
  const snareBody = new Tone.MembraneSynth({ octaves: 3, pitchDecay: 0.02, envelope: { attack: 0.001, decay: st.snareBody, sustain: 0 } }).connect(out);
  const snareNoise = noise(st.snareNoise);
  const rim = noise(0.03, "white");
  const clap = noise(st.clap, st.clapType);
  const hat = noise(st.hat);
  const openhat = noise(st.openhat);
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
      // accept a single drum name or an array (simultaneous hits, e.g. kick+hat)
      for (const nm of (Array.isArray(note) ? note : [note])) {
        const fn = map[String(nm).toLowerCase()];
        if (fn) try { fn(time, vel ?? 0.85); } catch (e) {}
      }
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
  if (isDrumKit(id)) {
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
      inst.trigger(isDrumKit(it.id) ? "kick" : "C4", 0.2, Tone.now() + 0.02, 0.4);
      setTimeout(() => { try { inst.dispose(); } catch (e) {} }, 500);
      res.push({ id: it.id, ok: true });
    } catch (e) { res.push({ id: it.id, ok: false, err: String(e && e.message || e) }); }
  }
  return res;
}

// Mixer audibility: a muted track is silent; if ANY track is soloed, only the
// soloed tracks sound (standard DAW semantics).
export function trackAudible(song, track) {
  if (track.mute) return false;
  return !song.tracks.some((t) => t.solo) || !!track.solo;
}

// Track-level tools, all plain score fields:
//   repeat (1-64)      — loop the note list N times (pattern compression)
//   transpose (semis)  — shift pitched notes; drum names pass through untouched
//   offsetBeats        — push the whole track later (pickups, humanized layering)
//   humanize (0-1)     — deterministic timing/velocity jitter (seeded, so the
//                        same score always renders the same bytes)
function transposeNote(note, semis) {
  if (!semis) return note;
  const tp = (n) => { try { return Tone.Frequency(n).transpose(semis).toNote(); } catch (e) { return n; } };
  return Array.isArray(note) ? note.map(tp) : tp(note);
}
function jitter(seed) { const s = (seed * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - 0.5; }

// Convert a track's notes (sequential) into timed events in seconds (bpm-aware).
function eventsForTrack(track) {
  const evs = [];
  const repeat = Math.max(1, Math.min(64, Math.round(track.repeat || 1)));
  const hum = Math.max(0, Math.min(1, +track.humanize || 0));
  let t = Math.max(0, +track.offsetBeats || 0) * (60 / Tone.Transport.bpm.value);
  let k = 0;
  for (let r = 0; r < repeat; r++) {
    for (const n of track.notes) {
      const durTok = n.rest != null ? n.rest : n.dur;
      const sec = Tone.Time(durTok).toSeconds();
      if (n.rest == null) {
        const tj = hum ? Math.max(0, t + jitter(k * 2 + 1) * hum * 0.05) : t;
        const vj = hum ? Math.max(0.05, Math.min(1, (n.vel ?? 0.85) * (1 + jitter(k * 2 + 2) * hum * 0.3))) : (n.vel ?? 0.85);
        evs.push({ time: tj, note: transposeNote(n.note, track.transpose), dur: sec, vel: vj });
      }
      t += sec; k++;
    }
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

  const parts = [], insts = [], fxPairs = [];
  let length = 0;
  for (const track of song.tracks) {
    const inst = makeInstrument(track.instrument, song.instruments);
    const panvol = new Tone.PanVol(track.pan, trackAudible(song, track) ? track.volume : -Infinity);
    const fx = buildFxChain(track.fx);
    if (fx) { inst.output.connect(fx.input); fx.output.connect(panvol); insts.push(fx); fxPairs.push(...fx.pairs); }
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
    start(loop, offsetSec = 0) {
      Tone.Transport.loop = !!loop;
      Tone.Transport.loopStart = 0;
      Tone.Transport.loopEnd = length;
      parts.forEach((p) => { p.loop = !!loop; p.loopEnd = length; p.start(0); });
      const offset = Math.min(Math.max(0, offsetSec), Math.max(0, length - 0.05));
      const startTime = Tone.now() + 0.05;
      scheduleFxRamps(fxPairs, startTime, offset);
      Tone.Transport.start(startTime, offset);
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
// minLengthSec forces a floor on the musical length — stem renders use it so
// every stem comes out the same length as the full mix.
export async function renderBuffer(song, tailSec = 2.5, minLengthSec = 0) {
  // eventsForTrack resolves durations via Tone.Time(...).toSeconds(), which reads
  // the transport BPM — set it to the song tempo FIRST, or the buffer gets sized
  // at the default 120 BPM and a slower song is truncated (its tail cut off).
  Tone.Transport.bpm.value = song.tempo;
  let length = Math.max(0.5, minLengthSec);
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
      const panvol = new Tone.PanVol(track.pan, trackAudible(song, track) ? track.volume : -Infinity).connect(reverb);
      const fx = buildFxChain(track.fx);
      if (fx) { inst.output.connect(fx.input); fx.output.connect(panvol); fxChains.push(fx); scheduleFxRamps(fx.pairs); }
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

// ---- stems ------------------------------------------------------------------
// Render each audible track on its own, through the SAME master chain (volume +
// reverb) and forced to the full mix length — so the stems line up sample-for-
// sample and sum back to the mix. Muted tracks are skipped; if any track is
// soloed, only the soloed tracks are exported (DAW semantics).
export async function renderStems(song, tailSec = 2.5, onProgress = null) {
  Tone.Transport.bpm.value = song.tempo;
  let full = 0.5;
  for (const t of song.tracks) full = Math.max(full, eventsForTrack(t).length);
  const picked = song.tracks.map((t, i) => ({ t, i })).filter(({ t }) => trackAudible(song, t));
  const stems = [];
  let done = 0;
  for (const { t, i } of picked) {
    const solo = { ...song, tracks: [{ ...t, mute: false, solo: false }] };
    const buffer = await renderBuffer(solo, tailSec, full);
    stems.push({ index: i, name: t.name || `Track ${i + 1}`, buffer });
    done++;
    if (onProgress) try { onProgress(done, picked.length, t.name); } catch (e) {}
  }
  return stems;
}
// One track only (by index), full mix length. For agents that want a single stem.
export async function renderStemWav(song, trackIndex, tailSec = 2.5) {
  Tone.Transport.bpm.value = song.tempo;
  let full = 0.5;
  for (const t of song.tracks) full = Math.max(full, eventsForTrack(t).length);
  const track = song.tracks[trackIndex];
  if (!track) throw new Error(`no track at index ${trackIndex}`);
  const solo = { ...song, tracks: [{ ...track, mute: false, solo: false }] };
  return audioBufferToWavBlob(await renderBuffer(solo, tailSec, full));
}

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
export function audioBufferToMp3Blob(ab, kbps) {
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
export function audioBufferToWavBlob(ab) {
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

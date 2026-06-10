// instruments.js — the AgentScore instrument registry.
//
// Two families:
//  1) SYNTH presets — built from Tone.js synth engines (no assets, instant,
//     offline-renderable). Defined declaratively as { ctor, opts, mono?, gain? }.
//  2) Sampled instruments + the sampler are registered in audio.js (they load
//     audio on demand) — this file is the pure, dependency-free catalog.
//
// A score references an instrument by `id`. Unknown ids fall back to "synth".

// category order for grouped UI
export const CATEGORIES = [
  "Bass", "Lead", "Keys", "Pad", "Pluck", "Mallet", "Brass", "Strings", "Guitar",
  "Woodwind", "Organ", "Synth", "Chip", "FX", "Drums",
];

// helper to keep the table terse
const env = (a, d, s, r) => ({ attack: a, decay: d, sustain: s, release: r });

export const SYNTHS = {
  // ---------------- Bass ----------------
  "sub-bass":    { label: "Sub Bass",     cat: "Bass", ctor: "MonoSynth", gain: -4, opts: { oscillator: { type: "sine" }, envelope: env(.01, .2, .9, .3), filterEnvelope: { baseFrequency: 120, octaves: 2, attack: .01, decay: .2, sustain: .4, release: .2 } } },
  "saw-bass":    { label: "Saw Bass",     cat: "Bass", ctor: "MonoSynth", gain: -6, opts: { oscillator: { type: "sawtooth" }, envelope: env(.01, .15, .7, .2), filter: { Q: 2 }, filterEnvelope: { baseFrequency: 200, octaves: 2.5, attack: .02, decay: .2, sustain: .3, release: .2 } } },
  "reese-bass":  { label: "Reese Bass",   cat: "Bass", ctor: "DuoSynth", gain: -8, opts: { harmonicity: 1.005, vibratoAmount: .1, voice0: { oscillator: { type: "sawtooth" }, envelope: env(.02, .2, .9, .3) }, voice1: { oscillator: { type: "sawtooth" }, detune: 8, envelope: env(.02, .2, .9, .3) } } },
  "acid-bass":   { label: "Acid Bass",    cat: "Bass", ctor: "MonoSynth", gain: -6, opts: { oscillator: { type: "sawtooth" }, envelope: env(.005, .1, .2, .1), filter: { Q: 6, type: "lowpass" }, filterEnvelope: { baseFrequency: 120, octaves: 4, attack: .005, decay: .25, sustain: .1, release: .2, exponent: 2 } } },
  "fm-bass":     { label: "FM Bass",      cat: "Bass", ctor: "FMSynth", gain: -6, opts: { harmonicity: 1, modulationIndex: 6, oscillator: { type: "sine" }, envelope: env(.005, .2, .6, .2), modulation: { type: "square" }, modulationEnvelope: env(.005, .2, .2, .1) } },
  "square-bass": { label: "Square Bass",  cat: "Bass", ctor: "MonoSynth", gain: -7, opts: { oscillator: { type: "square" }, envelope: env(.005, .12, .5, .15), filterEnvelope: { baseFrequency: 180, octaves: 2 } } },
  "wobble-bass": { label: "Wobble Bass",  cat: "Bass", ctor: "FMSynth", gain: -7, opts: { harmonicity: .5, modulationIndex: 10, oscillator: { type: "sawtooth" }, envelope: env(.01, .2, .8, .2), modulation: { type: "sine" }, modulationEnvelope: env(.2, .2, .8, .4) } },
  "moog-bass":   { label: "Moog Bass",    cat: "Bass", ctor: "MonoSynth", gain: -5, opts: { oscillator: { type: "fattriangle", count: 2, spread: 12 }, envelope: env(.005, .25, .6, .25), filter: { Q: 3 }, filterEnvelope: { baseFrequency: 150, octaves: 3, attack: .01, decay: .35, sustain: .25, release: .3 } } },
  "rubber-bass": { label: "Rubber Bass",  cat: "Bass", ctor: "FMSynth", gain: -6, opts: { harmonicity: 2, modulationIndex: 4, oscillator: { type: "sine" }, envelope: env(.004, .25, .3, .2), modulation: { type: "sine" }, modulationEnvelope: env(.004, .15, 0, .1) } },
  "pick-bass":   { label: "Pick Bass",    cat: "Bass", ctor: "MonoSynth", gain: -6, opts: { oscillator: { type: "sawtooth" }, envelope: env(.002, .18, .25, .12), filter: { Q: 1.5 }, filterEnvelope: { baseFrequency: 350, octaves: 2, decay: .12, sustain: .2 } } },
  "organ-bass":  { label: "Organ Bass",   cat: "Bass", ctor: "Synth", gain: -6, opts: { oscillator: { type: "fatsine", count: 2, spread: 6 }, envelope: env(.01, .05, .95, .12) } },
  "growl-bass":  { label: "Growl Bass",   cat: "Bass", ctor: "AMSynth", gain: -6, opts: { harmonicity: 2.5, oscillator: { type: "sawtooth" }, envelope: env(.01, .2, .7, .2), modulation: { type: "square" } } },

  // ---------------- Lead ----------------
  "saw-lead":    { label: "Saw Lead",     cat: "Lead", ctor: "Synth", gain: -8, opts: { oscillator: { type: "sawtooth" }, envelope: env(.01, .1, .6, .3) } },
  "square-lead": { label: "Square Lead",  cat: "Lead", ctor: "Synth", gain: -9, opts: { oscillator: { type: "square" }, envelope: env(.008, .1, .5, .25) } },
  "supersaw":    { label: "Supersaw",     cat: "Lead", ctor: "Synth", gain: -10, opts: { oscillator: { type: "fatsawtooth", count: 5, spread: 30 }, envelope: env(.02, .15, .7, .35) } },
  "fm-lead":     { label: "FM Lead",      cat: "Lead", ctor: "FMSynth", gain: -9, opts: { harmonicity: 2, modulationIndex: 4, oscillator: { type: "sine" }, envelope: env(.01, .15, .6, .3), modulation: { type: "triangle" } } },
  "sync-lead":   { label: "Sync Lead",    cat: "Lead", ctor: "Synth", gain: -9, opts: { oscillator: { type: "fatsquare", count: 3, spread: 20 }, envelope: env(.005, .1, .5, .2) } },
  "pwm-lead":    { label: "PWM Lead",     cat: "Lead", ctor: "Synth", gain: -9, opts: { oscillator: { type: "pwm", modulationFrequency: 0.4 }, envelope: env(.01, .1, .7, .3) } },
  "uni-lead":    { label: "Unison Lead",  cat: "Lead", ctor: "Synth", gain: -11, opts: { oscillator: { type: "fatsawtooth", count: 7, spread: 50 }, envelope: env(.03, .2, .75, .4) } },
  "whistle":     { label: "Whistle",      cat: "Lead", ctor: "Synth", gain: -8, opts: { oscillator: { type: "sine" }, envelope: env(.05, .1, .8, .2) } },
  "theremin":    { label: "Theremin",     cat: "Lead", ctor: "MonoSynth", gain: -8, opts: { portamento: .08, oscillator: { type: "sine" }, envelope: env(.1, .1, .9, .3), filterEnvelope: { baseFrequency: 2000, octaves: 0 } } },
  "dist-lead":   { label: "Distorted Lead", cat: "Lead", ctor: "Synth", gain: -10, opts: { oscillator: { type: "fatsquare", count: 4, spread: 35 }, envelope: env(.005, .12, .65, .25) } },
  "soft-lead":   { label: "Soft Lead",    cat: "Lead", ctor: "AMSynth", gain: -8, opts: { harmonicity: 1.01, oscillator: { type: "triangle" }, envelope: env(.04, .15, .7, .35), modulation: { type: "sine" } } },

  // ---------------- Keys ----------------
  "e-piano":     { label: "Electric Piano", cat: "Keys", ctor: "FMSynth", gain: -7, opts: { harmonicity: 3, modulationIndex: 8, oscillator: { type: "sine" }, envelope: env(.002, .6, .1, .8), modulation: { type: "sine" }, modulationEnvelope: env(.002, .4, 0, .3) } },
  "rhodes":      { label: "Rhodes",       cat: "Keys", ctor: "FMSynth", gain: -7, opts: { harmonicity: 5, modulationIndex: 6, oscillator: { type: "sine" }, envelope: env(.002, .8, .2, 1), modulation: { type: "sine" }, modulationEnvelope: env(.002, .5, 0, .4) } },
  "clav":        { label: "Clavinet",     cat: "Keys", ctor: "Synth", gain: -8, opts: { oscillator: { type: "square" }, envelope: env(.002, .12, .15, .15) } },
  "synth-piano": { label: "Synth Piano",  cat: "Keys", ctor: "Synth", gain: -7, opts: { oscillator: { type: "triangle" }, envelope: env(.002, .5, .15, .8) } },
  "harpsichord": { label: "Harpsichord",  cat: "Keys", ctor: "Synth", gain: -8, opts: { oscillator: { type: "square" }, envelope: env(.001, .4, .05, .25) } },
  "celesta":     { label: "Celesta",      cat: "Keys", ctor: "FMSynth", gain: -8, opts: { harmonicity: 4.99, modulationIndex: 6, oscillator: { type: "sine" }, envelope: env(.001, .7, 0, .6), modulation: { type: "sine" }, modulationEnvelope: env(.001, .3, 0, .2) } },
  "toy-piano":   { label: "Toy Piano",    cat: "Keys", ctor: "FMSynth", gain: -8, opts: { harmonicity: 7.99, modulationIndex: 9, oscillator: { type: "sine" }, envelope: env(.001, .35, 0, .3), modulation: { type: "sine" }, modulationEnvelope: env(.001, .15, 0, .1) } },
  "wurli":       { label: "Wurlitzer",    cat: "Keys", ctor: "AMSynth", gain: -7, opts: { harmonicity: 2, oscillator: { type: "sine" }, envelope: env(.003, .5, .15, .6), modulation: { type: "sine" } } },

  // ---------------- Pad ----------------
  "warm-pad":    { label: "Warm Pad",     cat: "Pad", ctor: "AMSynth", gain: -13, opts: { harmonicity: 2, oscillator: { type: "fatsine", count: 3, spread: 20 }, envelope: env(.6, .4, .9, 1.2), modulation: { type: "sine" } } },
  "strings-pad": { label: "Strings Pad",  cat: "Pad", ctor: "Synth", gain: -14, opts: { oscillator: { type: "fatsawtooth", count: 4, spread: 25 }, envelope: env(.5, .3, .9, 1.4) } },
  "glass-pad":   { label: "Glass Pad",    cat: "Pad", ctor: "FMSynth", gain: -14, opts: { harmonicity: 3.01, modulationIndex: 2, oscillator: { type: "sine" }, envelope: env(.8, .5, .8, 1.5), modulation: { type: "sine" } } },
  "choir-pad":   { label: "Choir Pad",    cat: "Pad", ctor: "AMSynth", gain: -13, opts: { harmonicity: 1.5, oscillator: { type: "fattriangle", count: 3, spread: 30 }, envelope: env(.7, .4, .9, 1.6), modulation: { type: "triangle" } } },
  "dark-pad":    { label: "Dark Pad",     cat: "Pad", ctor: "DuoSynth", gain: -14, opts: { harmonicity: 1.5, voice0: { oscillator: { type: "sawtooth" }, envelope: env(.8, .4, .8, 1.4) }, voice1: { oscillator: { type: "sine" }, detune: -1200, envelope: env(.8, .4, .8, 1.4) } } },
  "shimmer-pad": { label: "Shimmer Pad",  cat: "Pad", ctor: "FMSynth", gain: -14, opts: { harmonicity: 2.001, modulationIndex: 1.5, oscillator: { type: "fatsine", count: 4, spread: 40 }, envelope: env(1, .5, .85, 2), modulation: { type: "sine" } } },
  "sweep-pad":   { label: "Sweep Pad",    cat: "Pad", ctor: "Synth", gain: -14, opts: { oscillator: { type: "pwm", modulationFrequency: .15 }, envelope: env(.9, .4, .85, 1.6) } },
  "vocal-pad":   { label: "Vocal Pad",    cat: "Pad", ctor: "AMSynth", gain: -13, opts: { harmonicity: 1.25, oscillator: { type: "fattriangle", count: 3, spread: 22 }, envelope: env(.6, .3, .9, 1.3), modulation: { type: "sine" } } },
  "space-pad":   { label: "Space Pad",    cat: "Pad", ctor: "DuoSynth", gain: -15, opts: { harmonicity: 2.01, vibratoAmount: .2, vibratoRate: .4, voice0: { oscillator: { type: "sine" }, envelope: env(1.2, .5, .85, 2.2) }, voice1: { oscillator: { type: "triangle" }, detune: 7, envelope: env(1.2, .5, .85, 2.2) } } },
  "drone":       { label: "Drone",        cat: "Pad", ctor: "Synth", gain: -14, opts: { oscillator: { type: "fatsawtooth", count: 6, spread: 16 }, envelope: env(1.5, .2, 1, 2.5) } },

  // ---------------- Pluck ----------------
  "pluck":       { label: "Pluck",        cat: "Pluck", ctor: "PluckSynth", mono: true, gain: -5, opts: { attackNoise: 1, dampening: 4000, resonance: .9 } },
  "harp":        { label: "Harp",         cat: "Pluck", ctor: "PluckSynth", mono: true, gain: -5, opts: { attackNoise: .5, dampening: 6000, resonance: .95 } },
  "koto":        { label: "Koto",         cat: "Pluck", ctor: "PluckSynth", mono: true, gain: -5, opts: { attackNoise: 2, dampening: 3000, resonance: .85 } },
  "banjo":       { label: "Banjo",        cat: "Pluck", ctor: "PluckSynth", mono: true, gain: -5, opts: { attackNoise: 3, dampening: 2600, resonance: .8 } },
  "sitar":       { label: "Sitar (synth)", cat: "Pluck", ctor: "PluckSynth", mono: true, gain: -5, opts: { attackNoise: 1.5, dampening: 5200, resonance: .98 } },
  "dulcimer":    { label: "Dulcimer",     cat: "Pluck", ctor: "FMSynth", gain: -7, opts: { harmonicity: 2, modulationIndex: 5, oscillator: { type: "triangle" }, envelope: env(.002, .9, 0, .7), modulation: { type: "sine" }, modulationEnvelope: env(.002, .4, 0, .3) } },

  // ---------------- Mallet ----------------
  "marimba":     { label: "Marimba",      cat: "Mallet", ctor: "FMSynth", gain: -6, opts: { harmonicity: 4, modulationIndex: 2, oscillator: { type: "sine" }, envelope: env(.002, .3, 0, .3), modulation: { type: "sine" }, modulationEnvelope: env(.002, .2, 0, .2) } },
  "kalimba":     { label: "Kalimba",      cat: "Mallet", ctor: "FMSynth", gain: -7, opts: { harmonicity: 7, modulationIndex: 3, oscillator: { type: "sine" }, envelope: env(.002, .4, 0, .3), modulation: { type: "sine" }, modulationEnvelope: env(.002, .2, 0, .2) } },
  "bell":        { label: "Bell",         cat: "Mallet", ctor: "FMSynth", gain: -8, opts: { harmonicity: 3.01, modulationIndex: 14, oscillator: { type: "sine" }, envelope: env(.001, 1.2, 0, 1.2), modulation: { type: "sine" }, modulationEnvelope: env(.001, .7, 0, .5) } },
  "music-box":   { label: "Music Box",    cat: "Mallet", ctor: "FMSynth", gain: -8, opts: { harmonicity: 6, modulationIndex: 10, oscillator: { type: "sine" }, envelope: env(.001, .8, 0, .8), modulation: { type: "sine" }, modulationEnvelope: env(.001, .4, 0, .3) } },
  "glocken":     { label: "Glockenspiel", cat: "Mallet", ctor: "FMSynth", gain: -10, opts: { harmonicity: 8.5, modulationIndex: 18, oscillator: { type: "sine" }, envelope: env(.001, .6, 0, .5), modulation: { type: "sine" }, modulationEnvelope: env(.001, .3, 0, .2) } },
  "vibraphone":  { label: "Vibraphone",   cat: "Mallet", ctor: "FMSynth", gain: -8, opts: { harmonicity: 4, modulationIndex: 3, oscillator: { type: "sine" }, envelope: env(.002, 1.6, .05, 1.4), modulation: { type: "sine" }, modulationEnvelope: env(.002, .8, 0, .6) } },
  "steel-drum":  { label: "Steel Drum",   cat: "Mallet", ctor: "FMSynth", gain: -7, opts: { harmonicity: 3.8, modulationIndex: 7, oscillator: { type: "sine" }, envelope: env(.001, .45, 0, .35), modulation: { type: "sine" }, modulationEnvelope: env(.001, .2, 0, .15) } },
  "tubular-bell":{ label: "Tubular Bell", cat: "Mallet", ctor: "FMSynth", gain: -10, opts: { harmonicity: 3.5, modulationIndex: 20, oscillator: { type: "sine" }, envelope: env(.001, 2.5, 0, 2.5), modulation: { type: "sine" }, modulationEnvelope: env(.001, 1.2, 0, .8) } },
  "gamelan":     { label: "Gamelan",      cat: "Mallet", ctor: "FMSynth", gain: -9, opts: { harmonicity: 5.04, modulationIndex: 12, oscillator: { type: "sine" }, envelope: env(.001, 1, 0, .9), modulation: { type: "sine" }, modulationEnvelope: env(.001, .5, 0, .4) } },

  // ---------------- Brass ----------------
  "synth-brass": { label: "Synth Brass",  cat: "Brass", ctor: "Synth", gain: -10, opts: { oscillator: { type: "fatsawtooth", count: 3, spread: 18 }, envelope: env(.06, .2, .8, .3) } },
  "trumpet-ish": { label: "Trumpet (synth)", cat: "Brass", ctor: "FMSynth", gain: -9, opts: { harmonicity: 1, modulationIndex: 5, oscillator: { type: "sawtooth" }, envelope: env(.04, .2, .8, .2), modulation: { type: "square" } } },
  "horn-synth":  { label: "Horn (synth)", cat: "Brass", ctor: "AMSynth", gain: -9, opts: { harmonicity: 1, oscillator: { type: "sawtooth" }, envelope: env(.09, .25, .8, .35), modulation: { type: "sine" } } },
  "brass-stab":  { label: "Brass Stab",   cat: "Brass", ctor: "Synth", gain: -9, opts: { oscillator: { type: "fatsawtooth", count: 4, spread: 24 }, envelope: env(.01, .25, .3, .15) } },

  // ---------------- Strings ----------------
  "synth-strings": { label: "Synth Strings", cat: "Strings", ctor: "Synth", gain: -12, opts: { oscillator: { type: "fatsawtooth", count: 5, spread: 35 }, envelope: env(.25, .3, .9, .8) } },
  "pizzicato":   { label: "Pizzicato",    cat: "Strings", ctor: "Synth", gain: -8, opts: { oscillator: { type: "sawtooth" }, envelope: env(.002, .15, 0, .15) } },
  "tremolo-strings": { label: "Tremolo Strings", cat: "Strings", ctor: "AMSynth", gain: -12, opts: { harmonicity: .25, oscillator: { type: "fatsawtooth", count: 4, spread: 30 }, envelope: env(.2, .3, .9, .7), modulation: { type: "square" } } },
  "solo-violin": { label: "Violin (synth)", cat: "Strings", ctor: "FMSynth", gain: -10, opts: { harmonicity: 1, modulationIndex: 1.6, oscillator: { type: "sawtooth" }, envelope: env(.12, .2, .85, .4), modulation: { type: "sine" } } },

  // ---------------- Organ ----------------
  "organ":       { label: "Organ",        cat: "Organ", ctor: "Synth", gain: -10, opts: { oscillator: { type: "fatsine", count: 4, spread: 8 }, envelope: env(.01, .05, 1, .1) } },
  "rock-organ":  { label: "Rock Organ",   cat: "Organ", ctor: "Synth", gain: -10, opts: { oscillator: { type: "fatsquare", count: 3, spread: 12 }, envelope: env(.01, .05, 1, .1) } },
  "cathedral":   { label: "Cathedral Organ", cat: "Organ", ctor: "Synth", gain: -11, opts: { oscillator: { type: "fatsine", count: 6, spread: 10 }, envelope: env(.06, .1, 1, .9) } },
  "drawbar":     { label: "Drawbar Organ", cat: "Organ", ctor: "AMSynth", gain: -10, opts: { harmonicity: 3, oscillator: { type: "sine" }, envelope: env(.005, .02, 1, .08), modulation: { type: "sine" } } },

  // ---------------- Wind (synth) ----------------
  "pan-flute":   { label: "Pan Flute",    cat: "Woodwind", ctor: "AMSynth", gain: -8, opts: { harmonicity: 2, oscillator: { type: "sine" }, envelope: env(.07, .15, .75, .25), modulation: { type: "triangle" } } },
  "ocarina":     { label: "Ocarina",      cat: "Woodwind", ctor: "Synth", gain: -8, opts: { oscillator: { type: "sine" }, envelope: env(.04, .1, .85, .15) } },
  "breathy":     { label: "Breathy Flute", cat: "Woodwind", ctor: "AMSynth", gain: -9, opts: { harmonicity: 3.5, oscillator: { type: "triangle" }, envelope: env(.09, .2, .7, .3), modulation: { type: "sine" } } },

  // ---------------- generic / back-compat ----------------
  "synth":       { label: "Synth (clean)", cat: "Synth", ctor: "Synth", gain: -6, opts: { oscillator: { type: "triangle" }, envelope: env(.005, .1, .3, .4) } },
  "Synth":       { label: "Synth", cat: "Synth", ctor: "Synth", gain: -6, alias: "synth", opts: { oscillator: { type: "triangle" }, envelope: env(.005, .1, .3, .4) } },
  "FMSynth":     { label: "FM", cat: "Synth", ctor: "FMSynth", gain: -6, opts: { harmonicity: 3, modulationIndex: 10 } },
  "AMSynth":     { label: "AM", cat: "Synth", ctor: "AMSynth", gain: -6, opts: { harmonicity: 2 } },
  "MonoSynth":   { label: "Mono", cat: "Synth", ctor: "MonoSynth", gain: -6, opts: { oscillator: { type: "sawtooth" } } },
  "DuoSynth":    { label: "Duo", cat: "Synth", ctor: "DuoSynth", gain: -8, opts: {} },

  // ---------------- Chip ----------------
  "chip-pulse":  { label: "Chip Pulse",   cat: "Chip", ctor: "Synth", gain: -10, opts: { oscillator: { type: "pulse", width: .3 }, envelope: env(.001, .05, .4, .08) } },
  "chip-square": { label: "Chip Square",  cat: "Chip", ctor: "Synth", gain: -10, opts: { oscillator: { type: "square" }, envelope: env(.001, .04, .5, .06) } },
  "chip-tri":    { label: "Chip Triangle", cat: "Chip", ctor: "Synth", gain: -9, opts: { oscillator: { type: "triangle" }, envelope: env(.001, .05, .6, .06) } },
  "chip-saw":    { label: "Chip Saw",     cat: "Chip", ctor: "Synth", gain: -10, opts: { oscillator: { type: "sawtooth" }, envelope: env(.001, .04, .45, .06) } },
  "chip-arp":    { label: "Chip Arp",     cat: "Chip", ctor: "Synth", gain: -10, opts: { oscillator: { type: "pulse", width: .18 }, envelope: env(.001, .03, .25, .04) } },

  // ---------------- FX ----------------
  "noise-sweep": { label: "Noise Sweep",  cat: "FX", ctor: "NoiseSynth", mono: true, gain: -16, isNoise: true, opts: { noise: { type: "white" }, envelope: env(.3, .1, .3, .6) } },
  "zap":         { label: "Zap",          cat: "FX", ctor: "MembraneSynth", mono: true, gain: -8, opts: { octaves: 8, pitchDecay: .2, envelope: env(.001, .3, 0, .1) } },
  "riser":       { label: "Riser",        cat: "FX", ctor: "NoiseSynth", mono: true, gain: -16, isNoise: true, opts: { noise: { type: "pink" }, envelope: env(1.2, .1, .8, .4) } },
  "impact":      { label: "Impact",       cat: "FX", ctor: "MembraneSynth", mono: true, gain: -6, opts: { octaves: 5, pitchDecay: .9, envelope: env(.001, 1.1, 0, .6) } },
  "wind":        { label: "Wind",         cat: "FX", ctor: "NoiseSynth", mono: true, gain: -18, isNoise: true, opts: { noise: { type: "pink" }, envelope: env(.8, .3, .7, 1.2) } },
  "static":      { label: "Static",       cat: "FX", ctor: "NoiseSynth", mono: true, gain: -18, isNoise: true, opts: { noise: { type: "white" }, envelope: env(.005, .08, .2, .1) } },
};

// ---------------------------------------------------------------------------
// SAMPLED instruments — realistic, loaded on demand into Tone.Sampler. Each is
// a multisample map (sampled note -> file); Tone pitch-shifts between them.
// Hosted on trusted, pinned CDNs (see CSP). No samples are bundled in the repo.
// ---------------------------------------------------------------------------
const SAL = "https://tonejs.github.io/audio/salamander/";
const SAMP = "https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@622c2f1c32c8cfce4158ddc3eb26e518ddef37e5/samples/";
export const SAMPLED = {
  "piano": {
    label: "Grand Piano", cat: "Keys", gain: -8, release: 1, baseUrl: SAL,
    urls: {
      A0:"A0.mp3", C1:"C1.mp3", "D#1":"Ds1.mp3", "F#1":"Fs1.mp3",
      A1:"A1.mp3", C2:"C2.mp3", "D#2":"Ds2.mp3", "F#2":"Fs2.mp3",
      A2:"A2.mp3", C3:"C3.mp3", "D#3":"Ds3.mp3", "F#3":"Fs3.mp3",
      A3:"A3.mp3", C4:"C4.mp3", "D#4":"Ds4.mp3", "F#4":"Fs4.mp3",
      A4:"A4.mp3", C5:"C5.mp3", "D#5":"Ds5.mp3", "F#5":"Fs5.mp3",
      A5:"A5.mp3", C6:"C6.mp3", "D#6":"Ds6.mp3", "F#6":"Fs6.mp3",
      A6:"A6.mp3", C7:"C7.mp3", "D#7":"Ds7.mp3", "F#7":"Fs7.mp3",
      A7:"A7.mp3", C8:"C8.mp3",
    },
  },
  "bass-electric": { label:"Bass Guitar", cat:"Bass", gain:-6, release:0.6, baseUrl:SAMP + "bass-electric/", urls:{ "A#1":"As1.mp3", "A#2":"As2.mp3", "A#3":"As3.mp3", "A#4":"As4.mp3", "C#1":"Cs1.mp3", "C#2":"Cs2.mp3", "C#3":"Cs3.mp3", "C#4":"Cs4.mp3", "C#5":"Cs5.mp3", "E1":"E1.mp3", "E2":"E2.mp3", "E3":"E3.mp3", "E4":"E4.mp3", "G1":"G1.mp3", "G2":"G2.mp3", "G3":"G3.mp3", "G4":"G4.mp3" } },
  "guitar-acoustic": { label:"Acoustic Guitar", cat:"Guitar", gain:-6, release:0.6, baseUrl:SAMP + "guitar-acoustic/", urls:{ "A#2":"As2.mp3", "A#3":"As3.mp3", "A#4":"As4.mp3", "A2":"A2.mp3", "A3":"A3.mp3", "A4":"A4.mp3", "B2":"B2.mp3", "B3":"B3.mp3", "B4":"B4.mp3", "C#3":"Cs3.mp3", "C#4":"Cs4.mp3", "C#5":"Cs5.mp3", "C3":"C3.mp3", "C4":"C4.mp3", "C5":"C5.mp3", "D#2":"Ds2.mp3", "D#3":"Ds3.mp3", "D#4":"Ds4.mp3", "D2":"D2.mp3", "D3":"D3.mp3", "D4":"D4.mp3", "D5":"D5.mp3", "E2":"E2.mp3", "E3":"E3.mp3", "E4":"E4.mp3", "F#2":"Fs2.mp3", "F#3":"Fs3.mp3", "F#4":"Fs4.mp3", "F2":"F2.mp3", "F3":"F3.mp3", "F4":"F4.mp3", "G#2":"Gs2.mp3", "G#3":"Gs3.mp3", "G#4":"Gs4.mp3", "G2":"G2.mp3", "G3":"G3.mp3", "G4":"G4.mp3" } },
  "guitar-electric": { label:"Electric Guitar", cat:"Guitar", gain:-6, release:0.6, baseUrl:SAMP + "guitar-electric/", urls:{ "A2":"A2.mp3", "A3":"A3.mp3", "A4":"A4.mp3", "A5":"A5.mp3", "C#2":"Cs2.mp3", "C3":"C3.mp3", "C4":"C4.mp3", "C5":"C5.mp3", "C6":"C6.mp3", "D#3":"Ds3.mp3", "D#4":"Ds4.mp3", "D#5":"Ds5.mp3", "E2":"E2.mp3", "F#2":"Fs2.mp3", "F#3":"Fs3.mp3", "F#4":"Fs4.mp3", "F#5":"Fs5.mp3" } },
  "guitar-nylon": { label:"Nylon Guitar", cat:"Guitar", gain:-6, release:0.6, baseUrl:SAMP + "guitar-nylon/", urls:{ "A#5":"As5.mp3", "A2":"A2.mp3", "A3":"A3.mp3", "A4":"A4.mp3", "A5":"A5.mp3", "B1":"B1.mp3", "B2":"B2.mp3", "B3":"B3.mp3", "B4":"B4.mp3", "C#3":"Cs3.mp3", "C#4":"Cs4.mp3", "C#5":"Cs5.mp3", "D#4":"Ds4.mp3", "D2":"D2.mp3", "D3":"D3.mp3", "D5":"D5.mp3", "E2":"E2.mp3", "E3":"E3.mp3", "E4":"E4.mp3", "E5":"E5.mp3", "F#2":"Fs2.mp3", "F#3":"Fs3.mp3", "F#4":"Fs4.mp3", "F#5":"Fs5.mp3", "G#2":"Gs2.mp3", "G#4":"Gs4.mp3", "G#5":"Gs5.mp3", "G3":"G3.mp3", "G5":"G5.mp3" } },
  "harp": { label:"Harp (sampled)", cat:"Pluck", gain:-6, release:0.6, baseUrl:SAMP + "harp/", urls:{ "A2":"A2.mp3", "A4":"A4.mp3", "A6":"A6.mp3", "B1":"B1.mp3", "B3":"B3.mp3", "B5":"B5.mp3", "B6":"B6.mp3", "C3":"C3.mp3", "C5":"C5.mp3", "D2":"D2.mp3", "D4":"D4.mp3", "D6":"D6.mp3", "D7":"D7.mp3", "E1":"E1.mp3", "E3":"E3.mp3", "E5":"E5.mp3", "F2":"F2.mp3", "F4":"F4.mp3", "F6":"F6.mp3", "F7":"F7.mp3", "G1":"G1.mp3", "G3":"G3.mp3", "G5":"G5.mp3" } },
  "violin": { label:"Violin", cat:"Strings", gain:-6, release:0.6, baseUrl:SAMP + "violin/", urls:{ "A3":"A3.mp3", "A4":"A4.mp3", "A5":"A5.mp3", "A6":"A6.mp3", "C4":"C4.mp3", "C5":"C5.mp3", "C6":"C6.mp3", "C7":"C7.mp3", "E4":"E4.mp3", "E5":"E5.mp3", "E6":"E6.mp3", "G3":"G3.mp3", "G4":"G4.mp3", "G5":"G5.mp3", "G6":"G6.mp3" } },
  "cello": { label:"Cello", cat:"Strings", gain:-6, release:0.6, baseUrl:SAMP + "cello/", urls:{ "A#2":"As2.mp3", "A#3":"As3.mp3", "A2":"A2.mp3", "A3":"A3.mp3", "A4":"A4.mp3", "B2":"B2.mp3", "B3":"B3.mp3", "B4":"B4.mp3", "C#3":"Cs3.mp3", "C#4":"Cs4.mp3", "C2":"C2.mp3", "C3":"C3.mp3", "C4":"C4.mp3", "C5":"C5.mp3", "D#2":"Ds2.mp3", "D#3":"Ds3.mp3", "D#4":"Ds4.mp3", "D2":"D2.mp3", "D3":"D3.mp3", "D4":"D4.mp3", "E2":"E2.mp3", "E3":"E3.mp3", "E4":"E4.mp3", "F#3":"Fs3.mp3", "F#4":"Fs4.mp3", "F2":"F2.mp3", "F3":"F3.mp3", "F4":"F4.mp3", "G#2":"Gs2.mp3", "G#3":"Gs3.mp3", "G#4":"Gs4.mp3", "G2":"G2.mp3", "G3":"G3.mp3", "G4":"G4.mp3" } },
  "contrabass": { label:"Contrabass", cat:"Strings", gain:-6, release:0.6, baseUrl:SAMP + "contrabass/", urls:{ "A#1":"As1.mp3", "A2":"A2.mp3", "B3":"B3.mp3", "C#3":"Cs3.mp3", "C2":"C2.mp3", "D2":"D2.mp3", "E2":"E2.mp3", "E3":"E3.mp3", "F#1":"Fs1.mp3", "F#2":"Fs2.mp3", "G#2":"Gs2.mp3", "G#3":"Gs3.mp3", "G1":"G1.mp3" } },
  "flute": { label:"Flute", cat:"Woodwind", gain:-6, release:0.6, baseUrl:SAMP + "flute/", urls:{ "A4":"A4.mp3", "A5":"A5.mp3", "A6":"A6.mp3", "C4":"C4.mp3", "C5":"C5.mp3", "C6":"C6.mp3", "C7":"C7.mp3", "E4":"E4.mp3", "E5":"E5.mp3", "E6":"E6.mp3" } },
  "clarinet": { label:"Clarinet", cat:"Woodwind", gain:-6, release:0.6, baseUrl:SAMP + "clarinet/", urls:{ "A#3":"As3.mp3", "A#4":"As4.mp3", "A#5":"As5.mp3", "D3":"D3.mp3", "D4":"D4.mp3", "D5":"D5.mp3", "D6":"D6.mp3", "F#6":"Fs6.mp3", "F3":"F3.mp3", "F4":"F4.mp3", "F5":"F5.mp3" } },
  "bassoon": { label:"Bassoon", cat:"Woodwind", gain:-6, release:0.6, baseUrl:SAMP + "bassoon/", urls:{ "A2":"A2.mp3", "A3":"A3.mp3", "A4":"A4.mp3", "C3":"C3.mp3", "C4":"C4.mp3", "C5":"C5.mp3", "E4":"E4.mp3", "G2":"G2.mp3", "G3":"G3.mp3", "G4":"G4.mp3" } },
  "saxophone": { label:"Saxophone", cat:"Woodwind", gain:-6, release:0.6, baseUrl:SAMP + "saxophone/", urls:{ "A#3":"As3.mp3", "A#4":"As4.mp3", "A4":"A4.mp3", "A5":"A5.mp3", "B3":"B3.mp3", "B4":"B4.mp3", "C#3":"Cs3.mp3", "C#4":"Cs4.mp3", "C#5":"Cs5.mp3", "C4":"C4.mp3", "C5":"C5.mp3", "D#3":"Ds3.mp3", "D#4":"Ds4.mp3", "D#5":"Ds5.mp3", "D3":"D3.mp3", "D4":"D4.mp3", "D5":"D5.mp3", "E3":"E3.mp3", "E4":"E4.mp3", "E5":"E5.mp3", "F#3":"Fs3.mp3", "F#4":"Fs4.mp3", "F#5":"Fs5.mp3", "F3":"F3.mp3", "F4":"F4.mp3", "F5":"F5.mp3", "G#3":"Gs3.mp3", "G#4":"Gs4.mp3", "G#5":"Gs5.mp3", "G3":"G3.mp3", "G4":"G4.mp3", "G5":"G5.mp3" } },
  "trumpet": { label:"Trumpet", cat:"Brass", gain:-6, release:0.6, baseUrl:SAMP + "trumpet/", urls:{ "A#4":"As4.mp3", "A3":"A3.mp3", "A5":"A5.mp3", "C4":"C4.mp3", "C6":"C6.mp3", "D#4":"Ds4.mp3", "D5":"D5.mp3", "F3":"F3.mp3", "F4":"F4.mp3", "F5":"F5.mp3", "G4":"G4.mp3" } },
  "trombone": { label:"Trombone", cat:"Brass", gain:-6, release:0.6, baseUrl:SAMP + "trombone/", urls:{ "A#1":"As1.mp3", "A#2":"As2.mp3", "A#3":"As3.mp3", "C#2":"Cs2.mp3", "C#4":"Cs4.mp3", "C3":"C3.mp3", "C4":"C4.mp3", "D#2":"Ds2.mp3", "D#3":"Ds3.mp3", "D#4":"Ds4.mp3", "D3":"D3.mp3", "D4":"D4.mp3", "F2":"F2.mp3", "F3":"F3.mp3", "F4":"F4.mp3", "G#2":"Gs2.mp3", "G#3":"Gs3.mp3" } },
  "french-horn": { label:"French Horn", cat:"Brass", gain:-6, release:0.6, baseUrl:SAMP + "french-horn/", urls:{ "A1":"A1.mp3", "A3":"A3.mp3", "C2":"C2.mp3", "C4":"C4.mp3", "D#2":"Ds2.mp3", "D3":"D3.mp3", "D5":"D5.mp3", "F3":"F3.mp3", "F5":"F5.mp3", "G2":"G2.mp3" } },
  "tuba": { label:"Tuba", cat:"Brass", gain:-6, release:0.6, baseUrl:SAMP + "tuba/", urls:{ "A#1":"As1.mp3", "A#2":"As2.mp3", "A#3":"As3.mp3", "D#2":"Ds2.mp3", "D3":"D3.mp3", "D4":"D4.mp3", "F1":"F1.mp3", "F2":"F2.mp3", "F3":"F3.mp3" } },
  "organ": { label:"Pipe Organ", cat:"Organ", gain:-6, release:0.6, baseUrl:SAMP + "organ/", urls:{ "A1":"A1.mp3", "A2":"A2.mp3", "A3":"A3.mp3", "A4":"A4.mp3", "A5":"A5.mp3", "C1":"C1.mp3", "C2":"C2.mp3", "C3":"C3.mp3", "C4":"C4.mp3", "C5":"C5.mp3", "C6":"C6.mp3", "D#1":"Ds1.mp3", "D#2":"Ds2.mp3", "D#3":"Ds3.mp3", "D#4":"Ds4.mp3", "D#5":"Ds5.mp3", "F#1":"Fs1.mp3", "F#2":"Fs2.mp3", "F#3":"Fs3.mp3", "F#4":"Fs4.mp3", "F#5":"Fs5.mp3" } },
  "harmonium": { label:"Harmonium", cat:"Organ", gain:-6, release:0.6, baseUrl:SAMP + "harmonium/", urls:{ "A#2":"As2.mp3", "A#3":"As3.mp3", "A#4":"As4.mp3", "A2":"A2.mp3", "A3":"A3.mp3", "A4":"A4.mp3", "B2":"B2.mp3", "B3":"B3.mp3", "B4":"B4.mp3", "C#2":"Cs2.mp3", "C#3":"Cs3.mp3", "C#4":"Cs4.mp3", "C#5":"Cs5.mp3", "C2":"C2.mp3", "C3":"C3.mp3", "C4":"C4.mp3", "C5":"C5.mp3", "D#2":"Ds2.mp3", "D#3":"Ds3.mp3", "D#4":"Ds4.mp3", "D2":"D2.mp3", "D3":"D3.mp3", "D4":"D4.mp3", "D5":"D5.mp3", "E2":"E2.mp3", "E3":"E3.mp3", "E4":"E4.mp3", "F#2":"Fs2.mp3", "F#3":"Fs3.mp3", "F2":"F2.mp3", "F3":"F3.mp3", "F4":"F4.mp3", "G#2":"Gs2.mp3", "G#3":"Gs3.mp3", "G#4":"Gs4.mp3", "G2":"G2.mp3", "G3":"G3.mp3", "G4":"G4.mp3" } },
  "xylophone": { label:"Xylophone", cat:"Mallet", gain:-6, release:0.6, baseUrl:SAMP + "xylophone/", urls:{ "C5":"C5.mp3", "C6":"C6.mp3", "C7":"C7.mp3", "C8":"C8.mp3", "G4":"G4.mp3", "G5":"G5.mp3", "G6":"G6.mp3", "G7":"G7.mp3" } },
};

// Per-instrument loudness trim (dB), applied on top of each instrument's `gain`
// by the engine. Calibrated by measuring each instrument's active-region RMS on
// a reference note and nudging toward a common target, so swapping instruments
// doesn't jump in level. Generated by tools/calibrate (see commit); hand-edits ok.
// Target −24 dBFS active-RMS on a reference note; boosts capped at +9 dB (avoid
// hot transients), cuts at −12. Entries within ±1 dB of target are omitted (= 0).
export const TRIM = {
  // bass
  "sub-bass": -12, "saw-bass": -5, "reese-bass": -8.5, "acid-bass": 3, "fm-bass": 3.5,
  "square-bass": -5.5, "wobble-bass": 4.5, "bass-electric": 2.5,
  // lead
  "square-lead": -3.5, "supersaw": 3.5, "fm-lead": 7, "pwm-lead": -7.5,
  // keys
  "e-piano": 9, "rhodes": 9, "clav": 4, "synth-piano": 4, "piano": 9,
  // pad
  "warm-pad": 9, "strings-pad": 7.5, "glass-pad": 9, "choir-pad": 9,
  // pluck / mallet
  "pluck": 9, "harp": 1, "marimba": 8, "kalimba": 9, "bell": 9, "music-box": 9, "glocken": 9, "xylophone": 9,
  // brass / strings / woodwind (synth + sampled)
  "synth-brass": 2, "trumpet-ish": 8, "synth-strings": 4, "pizzicato": 3,
  "guitar-acoustic": 8, "guitar-electric": 7, "guitar-nylon": 3,
  "violin": 1, "cello": -1.5, "flute": 2, "clarinet": -2.5, "bassoon": 4.5,
  "saxophone": 1.5, "trumpet": 2, "trombone": -3, "french-horn": -1.5,
  // organ
  "organ": 3, "rock-organ": -4.5,
  // generic / back-compat
  "synth": 1, "Synth": 1, "AMSynth": 5.5, "MonoSynth": -6, "DuoSynth": -8,
  // chip / fx
  "chip-pulse": -2, "chip-square": -2.5, "chip-tri": -2, "noise-sweep": 9,
  // 2026-06-10 expansion (same harness: active-RMS on C4/C2 toward −24 dBFS)
  "rubber-bass": 9, "pick-bass": 4, "organ-bass": -4.5, "growl-bass": 9,
  "uni-lead": 5, "whistle": -6, "theremin": -7, "soft-lead": 9,
  "harpsichord": 7.5, "celesta": 9, "toy-piano": 9, "wurli": 9,
  "shimmer-pad": 9, "sweep-pad": -1.5, "vocal-pad": 9, "drone": 9,
  "banjo": 9, "sitar": 9, "dulcimer": 9,
  "vibraphone": 9, "steel-drum": 9, "tubular-bell": 9, "gamelan": 9,
  "horn-synth": 9, "brass-stab": 9, "tremolo-strings": 9, "solo-violin": 9,
  "cathedral": -1.5, "drawbar": 9, "pan-flute": 9, "ocarina": -7, "breathy": 9,
  "chip-saw": 3.5, "chip-arp": 2.5, "riser": 9, "wind": 9, "static": 9,
  "kit808": -4.5, "kit909": -3,
};

export function sampledList() {
  return Object.entries(SAMPLED).map(([id, d]) => ({ id, label: d.label, cat: d.cat, family: "sampled" }));
}

// stable id list + grouping for the UI
export function instrumentList() {
  const seen = new Set();
  const items = [];
  for (const [id, d] of Object.entries(SYNTHS)) {
    if (d.alias || /^[A-Z]/.test(id) && SYNTHS[id.toLowerCase()]) continue; // hide raw back-compat dupes from menus
    if (seen.has(d.label)) continue;
    seen.add(d.label);
    items.push({ id, label: d.label, cat: d.cat, family: "synth" });
  }
  return items;
}

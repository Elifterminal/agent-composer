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

  // ---------------- Lead ----------------
  "saw-lead":    { label: "Saw Lead",     cat: "Lead", ctor: "Synth", gain: -8, opts: { oscillator: { type: "sawtooth" }, envelope: env(.01, .1, .6, .3) } },
  "square-lead": { label: "Square Lead",  cat: "Lead", ctor: "Synth", gain: -9, opts: { oscillator: { type: "square" }, envelope: env(.008, .1, .5, .25) } },
  "supersaw":    { label: "Supersaw",     cat: "Lead", ctor: "Synth", gain: -10, opts: { oscillator: { type: "fatsawtooth", count: 5, spread: 30 }, envelope: env(.02, .15, .7, .35) } },
  "fm-lead":     { label: "FM Lead",      cat: "Lead", ctor: "FMSynth", gain: -9, opts: { harmonicity: 2, modulationIndex: 4, oscillator: { type: "sine" }, envelope: env(.01, .15, .6, .3), modulation: { type: "triangle" } } },
  "sync-lead":   { label: "Sync Lead",    cat: "Lead", ctor: "Synth", gain: -9, opts: { oscillator: { type: "fatsquare", count: 3, spread: 20 }, envelope: env(.005, .1, .5, .2) } },
  "pwm-lead":    { label: "PWM Lead",     cat: "Lead", ctor: "Synth", gain: -9, opts: { oscillator: { type: "pwm", modulationFrequency: 0.4 }, envelope: env(.01, .1, .7, .3) } },

  // ---------------- Keys ----------------
  "e-piano":     { label: "Electric Piano", cat: "Keys", ctor: "FMSynth", gain: -7, opts: { harmonicity: 3, modulationIndex: 8, oscillator: { type: "sine" }, envelope: env(.002, .6, .1, .8), modulation: { type: "sine" }, modulationEnvelope: env(.002, .4, 0, .3) } },
  "rhodes":      { label: "Rhodes",       cat: "Keys", ctor: "FMSynth", gain: -7, opts: { harmonicity: 5, modulationIndex: 6, oscillator: { type: "sine" }, envelope: env(.002, .8, .2, 1), modulation: { type: "sine" }, modulationEnvelope: env(.002, .5, 0, .4) } },
  "clav":        { label: "Clavinet",     cat: "Keys", ctor: "Synth", gain: -8, opts: { oscillator: { type: "square" }, envelope: env(.002, .12, .15, .15) } },
  "synth-piano": { label: "Synth Piano",  cat: "Keys", ctor: "Synth", gain: -7, opts: { oscillator: { type: "triangle" }, envelope: env(.002, .5, .15, .8) } },

  // ---------------- Pad ----------------
  "warm-pad":    { label: "Warm Pad",     cat: "Pad", ctor: "AMSynth", gain: -13, opts: { harmonicity: 2, oscillator: { type: "fatsine", count: 3, spread: 20 }, envelope: env(.6, .4, .9, 1.2), modulation: { type: "sine" } } },
  "strings-pad": { label: "Strings Pad",  cat: "Pad", ctor: "Synth", gain: -14, opts: { oscillator: { type: "fatsawtooth", count: 4, spread: 25 }, envelope: env(.5, .3, .9, 1.4) } },
  "glass-pad":   { label: "Glass Pad",    cat: "Pad", ctor: "FMSynth", gain: -14, opts: { harmonicity: 3.01, modulationIndex: 2, oscillator: { type: "sine" }, envelope: env(.8, .5, .8, 1.5), modulation: { type: "sine" } } },
  "choir-pad":   { label: "Choir Pad",    cat: "Pad", ctor: "AMSynth", gain: -13, opts: { harmonicity: 1.5, oscillator: { type: "fattriangle", count: 3, spread: 30 }, envelope: env(.7, .4, .9, 1.6), modulation: { type: "triangle" } } },
  "dark-pad":    { label: "Dark Pad",     cat: "Pad", ctor: "DuoSynth", gain: -14, opts: { harmonicity: 1.5, voice0: { oscillator: { type: "sawtooth" }, envelope: env(.8, .4, .8, 1.4) }, voice1: { oscillator: { type: "sine" }, detune: -1200, envelope: env(.8, .4, .8, 1.4) } } },

  // ---------------- Pluck ----------------
  "pluck":       { label: "Pluck",        cat: "Pluck", ctor: "PluckSynth", mono: true, gain: -5, opts: { attackNoise: 1, dampening: 4000, resonance: .9 } },
  "harp":        { label: "Harp",         cat: "Pluck", ctor: "PluckSynth", mono: true, gain: -5, opts: { attackNoise: .5, dampening: 6000, resonance: .95 } },
  "koto":        { label: "Koto",         cat: "Pluck", ctor: "PluckSynth", mono: true, gain: -5, opts: { attackNoise: 2, dampening: 3000, resonance: .85 } },

  // ---------------- Mallet ----------------
  "marimba":     { label: "Marimba",      cat: "Mallet", ctor: "FMSynth", gain: -6, opts: { harmonicity: 4, modulationIndex: 2, oscillator: { type: "sine" }, envelope: env(.002, .3, 0, .3), modulation: { type: "sine" }, modulationEnvelope: env(.002, .2, 0, .2) } },
  "kalimba":     { label: "Kalimba",      cat: "Mallet", ctor: "FMSynth", gain: -7, opts: { harmonicity: 7, modulationIndex: 3, oscillator: { type: "sine" }, envelope: env(.002, .4, 0, .3), modulation: { type: "sine" }, modulationEnvelope: env(.002, .2, 0, .2) } },
  "bell":        { label: "Bell",         cat: "Mallet", ctor: "FMSynth", gain: -8, opts: { harmonicity: 3.01, modulationIndex: 14, oscillator: { type: "sine" }, envelope: env(.001, 1.2, 0, 1.2), modulation: { type: "sine" }, modulationEnvelope: env(.001, .7, 0, .5) } },
  "music-box":   { label: "Music Box",    cat: "Mallet", ctor: "FMSynth", gain: -8, opts: { harmonicity: 6, modulationIndex: 10, oscillator: { type: "sine" }, envelope: env(.001, .8, 0, .8), modulation: { type: "sine" }, modulationEnvelope: env(.001, .4, 0, .3) } },
  "glocken":     { label: "Glockenspiel", cat: "Mallet", ctor: "FMSynth", gain: -10, opts: { harmonicity: 8.5, modulationIndex: 18, oscillator: { type: "sine" }, envelope: env(.001, .6, 0, .5), modulation: { type: "sine" }, modulationEnvelope: env(.001, .3, 0, .2) } },

  // ---------------- Brass ----------------
  "synth-brass": { label: "Synth Brass",  cat: "Brass", ctor: "Synth", gain: -10, opts: { oscillator: { type: "fatsawtooth", count: 3, spread: 18 }, envelope: env(.06, .2, .8, .3) } },
  "trumpet-ish": { label: "Trumpet (synth)", cat: "Brass", ctor: "FMSynth", gain: -9, opts: { harmonicity: 1, modulationIndex: 5, oscillator: { type: "sawtooth" }, envelope: env(.04, .2, .8, .2), modulation: { type: "square" } } },

  // ---------------- Strings ----------------
  "synth-strings": { label: "Synth Strings", cat: "Strings", ctor: "Synth", gain: -12, opts: { oscillator: { type: "fatsawtooth", count: 5, spread: 35 }, envelope: env(.25, .3, .9, .8) } },
  "pizzicato":   { label: "Pizzicato",    cat: "Strings", ctor: "Synth", gain: -8, opts: { oscillator: { type: "sawtooth" }, envelope: env(.002, .15, 0, .15) } },

  // ---------------- Organ ----------------
  "organ":       { label: "Organ",        cat: "Organ", ctor: "Synth", gain: -10, opts: { oscillator: { type: "fatsine", count: 4, spread: 8 }, envelope: env(.01, .05, 1, .1) } },
  "rock-organ":  { label: "Rock Organ",   cat: "Organ", ctor: "Synth", gain: -10, opts: { oscillator: { type: "fatsquare", count: 3, spread: 12 }, envelope: env(.01, .05, 1, .1) } },

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

  // ---------------- FX ----------------
  "noise-sweep": { label: "Noise Sweep",  cat: "FX", ctor: "NoiseSynth", mono: true, gain: -16, isNoise: true, opts: { noise: { type: "white" }, envelope: env(.3, .1, .3, .6) } },
  "zap":         { label: "Zap",          cat: "FX", ctor: "MembraneSynth", mono: true, gain: -8, opts: { octaves: 8, pitchDecay: .2, envelope: env(.001, .3, 0, .1) } },
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

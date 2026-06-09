// audio.js — Tone.js playback + offline WAV render for an AgentScore song.
// Tone is loaded globally from the CDN.
const Tone = window.Tone;

// melodic instruments are PolySynth-wrapped so chords work; "drumkit" is special.
export const INSTRUMENTS = [
  { id: "Synth", label: "Synth — clean" },
  { id: "FMSynth", label: "FM — bell / metallic" },
  { id: "AMSynth", label: "AM — tremolo" },
  { id: "MonoSynth", label: "Mono — fat bass / lead" },
  { id: "DuoSynth", label: "Duo — detuned pad" },
  { id: "drumkit", label: "Drum Kit" },
];
const DRUMS = ["kick", "snare", "hat", "openhat", "clap", "tom", "ride", "crash"];
export function isDrumName(n) { return DRUMS.includes(String(n).toLowerCase()); }

// Build an instrument. Returns { output, trigger(note,durSec,time,vel), dispose }.
function makeInstrument(name) {
  if (name === "drumkit") return makeDrumKit();
  const Ctor = Tone[name] || Tone.Synth;
  const poly = new Tone.PolySynth(Ctor);
  poly.volume.value = -2;
  return {
    output: poly,
    trigger: (note, durSec, time, vel) => {
      try { poly.triggerAttackRelease(note, durSec, time, vel); } catch (e) { /* bad note name */ }
    },
    dispose: () => poly.dispose(),
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

// Offline render the whole song to a WAV Blob.
export async function renderWav(song) {
  let length = 0.5;
  for (const t of song.tracks) length = Math.max(length, eventsForTrack(t).length);
  const tail = 2.5; // let reverb / releases ring out

  const buffer = await Tone.Offline(async () => {
    Tone.Transport.bpm.value = song.tempo;
    const masterVol = new Tone.Volume(song.master.volume).toDestination();
    const reverb = new Tone.Reverb({ decay: 2.4, wet: song.master.reverb }).connect(masterVol);
    await reverb.ready;
    for (const track of song.tracks) {
      const inst = makeInstrument(track.instrument);
      const panvol = new Tone.PanVol(track.pan, track.mute ? -Infinity : track.volume).connect(reverb);
      inst.output.connect(panvol);
      for (const ev of eventsForTrack(track).events) inst.trigger(ev.note, ev.dur, ev.time, ev.vel);
    }
    Tone.Transport.start();
  }, length + tail, 2, 44100);

  return audioBufferToWavBlob(buffer.get());
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

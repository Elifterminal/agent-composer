// examples.js — starter songs. Plain JSON objects in the AgentScore shape.
export const EXAMPLES = [
  {
    name: "Wistful (A minor)",
    song: {
      title: "Wistful", tempo: 120, timeSignature: "4/4", swing: 0,
      master: { volume: -6, reverb: 0.25 },
      tracks: [
        { name: "Lead", instrument: "FMSynth", volume: -8, pan: 0, notes: [
          {note:"A4",dur:"4n"},{note:"C5",dur:"8n"},{note:"E5",dur:"8n"},{note:"D5",dur:"4n"},{note:"C5",dur:"4n"},
          {note:"B4",dur:"4n"},{note:"D5",dur:"8n"},{note:"F5",dur:"8n"},{note:"E5",dur:"2n"},
          {note:"A4",dur:"4n"},{note:"C5",dur:"8n"},{note:"E5",dur:"8n"},{note:"G5",dur:"4n"},{note:"F5",dur:"4n"},
          {note:"E5",dur:"2n"},{note:"D5",dur:"4n"},{note:"C5",dur:"4n"},
          {note:"G4",dur:"4n"},{note:"B4",dur:"8n"},{note:"D5",dur:"8n"},{note:"C5",dur:"4n"},{note:"B4",dur:"4n"},
          {note:"A4",dur:"2n"},{note:"A4",dur:"2n"} ] },
        { name: "Bass", instrument: "MonoSynth", volume: -6, pan: 0, notes: [
          {note:"A2",dur:"1n"},{note:"F2",dur:"1n"},{note:"C3",dur:"1n"},{note:"G2",dur:"1n"},
          {note:"A2",dur:"1n"},{note:"F2",dur:"1n"},{note:"G2",dur:"1n"},{note:"A2",dur:"1n"} ] },
      ],
    },
  },
  {
    name: "Cyberpunk Pulse",
    song: {
      title: "Cyberpunk Pulse", tempo: 132, timeSignature: "4/4", swing: 0.08,
      master: { volume: -5, reverb: 0.2 },
      tracks: [
        { name: "Pad", instrument: "DuoSynth", volume: -14, pan: -0.2, notes: [
          {note:["E3","G3","B3"],dur:"1n"},{note:["C3","E3","G3"],dur:"1n"},
          {note:["A2","C3","E3"],dur:"1n"},{note:["D3","F3","A3"],dur:"1n"} ] },
        { name: "Arp", instrument: "Synth", volume: -12, pan: 0.25, notes: [
          {note:"E4",dur:"8n"},{note:"B4",dur:"8n"},{note:"G4",dur:"8n"},{note:"B4",dur:"8n"},
          {note:"C4",dur:"8n"},{note:"G4",dur:"8n"},{note:"E4",dur:"8n"},{note:"G4",dur:"8n"},
          {note:"A3",dur:"8n"},{note:"E4",dur:"8n"},{note:"C4",dur:"8n"},{note:"E4",dur:"8n"},
          {note:"D4",dur:"8n"},{note:"A4",dur:"8n"},{note:"F4",dur:"8n"},{note:"A4",dur:"8n"} ] },
        { name: "Bass", instrument: "MonoSynth", volume: -6, pan: 0, notes: [
          {note:"E2",dur:"4n"},{note:"E2",dur:"8n"},{note:"E2",dur:"8n"},{note:"C2",dur:"4n"},{note:"G2",dur:"4n"},
          {note:"A1",dur:"4n"},{note:"A1",dur:"8n"},{note:"A1",dur:"8n"},{note:"D2",dur:"4n"},{note:"F2",dur:"4n"} ] },
        { name: "Drums", instrument: "drumkit", volume: -4, pan: 0, notes: [
          {note:"kick",dur:"4n"},{note:"hat",dur:"8n"},{note:"hat",dur:"8n"},{note:"snare",dur:"4n"},{note:"hat",dur:"8n"},{note:"hat",dur:"8n"},
          {note:"kick",dur:"8n"},{note:"kick",dur:"8n"},{note:"hat",dur:"8n"},{note:"hat",dur:"8n"},{note:"snare",dur:"4n"},{note:"openhat",dur:"4n"} ] },
      ],
    },
  },
  {
    name: "Chiptune March",
    song: {
      title: "Chiptune March", tempo: 150, timeSignature: "4/4", swing: 0,
      master: { volume: -5, reverb: 0.1 },
      tracks: [
        { name: "Melody", instrument: "Synth", volume: -8, pan: 0, notes: [
          {note:"C5",dur:"8n"},{note:"E5",dur:"8n"},{note:"G5",dur:"8n"},{note:"C6",dur:"8n"},
          {note:"G5",dur:"8n"},{note:"E5",dur:"8n"},{note:"C5",dur:"4n"},
          {note:"D5",dur:"8n"},{note:"F5",dur:"8n"},{note:"A5",dur:"8n"},{note:"D6",dur:"8n"},
          {note:"A5",dur:"8n"},{note:"F5",dur:"8n"},{note:"D5",dur:"4n"} ] },
        { name: "Bass", instrument: "AMSynth", volume: -7, pan: 0, notes: [
          {note:"C3",dur:"4n"},{note:"G2",dur:"4n"},{note:"C3",dur:"4n"},{note:"G2",dur:"4n"},
          {note:"D3",dur:"4n"},{note:"A2",dur:"4n"},{note:"D3",dur:"4n"},{note:"A2",dur:"4n"} ] },
        { name: "Drums", instrument: "drumkit", volume: -5, pan: 0, notes: [
          {note:"kick",dur:"4n"},{note:"snare",dur:"4n"},{note:"kick",dur:"4n"},{note:"snare",dur:"4n"} ] },
      ],
    },
  },
  {
    name: "Chopped Break (slicer)",
    song: {
      title: "Chopped", tempo: 170, timeSignature: "4/4", swing: 0,
      master: { volume: -5, reverb: 0.08 },
      // agent-defined instrument: chop a bundled break into 16 equal slices,
      // then re-sequence the slices (note = slice index) into a jungle pattern.
      instruments: {
        chopbreak: { type: "slicer", url: "/samples/breaks/break.wav", slices: 16, gain: 2 },
      },
      tracks: [
        { name: "Break", instrument: "chopbreak", volume: -3, notes: [
          {note:"0",dur:"16n"},{note:"4",dur:"16n"},{note:"7",dur:"16n"},{note:"4",dur:"16n"},
          {note:"8",dur:"16n"},{note:"11",dur:"16n"},{note:"2",dur:"16n"},{note:"12",dur:"16n"},
          {note:"0",dur:"16n"},{note:"4",dur:"16n"},{note:"7",dur:"16n"},{note:"4",dur:"16n"},
          {note:"8",dur:"16n"},{note:"3",dur:"16n"},{note:"11",dur:"16n"},{note:"15",dur:"16n"} ] },
        { name: "Sub", instrument: "sub-bass", volume: -4, notes: [
          {note:"E1",dur:"4n"},{note:"E1",dur:"8n"},{note:"E1",dur:"8n"},{note:"G1",dur:"4n"},{note:"E1",dur:"4n"} ] },
      ],
    },
  },
];

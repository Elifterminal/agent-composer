// sheet.js — transcribe an AgentScore song into engraved sheet music with
// VexFlow (loaded globally). Best-effort: notes are packed into measures by the
// time signature, rendered with SOFT voices and per-measure try/catch so an odd
// bar degrades gracefully instead of crashing the whole score.
const VF = window.Vex.Flow;

const QUARTER = { "1n": 4, "2n": 2, "4n": 1, "8n": 0.5, "16n": 0.25, "32n": 0.125 };
function durToQuarters(d) {
  const m = /^(\d+)(n?)(\.?)(t?)$/.exec(String(d));
  if (!m) return 1;
  let q = { "1": 4, "2": 2, "4": 1, "8": 0.5, "16": 0.25, "32": 0.125 }[m[1]] ?? 1;
  if (m[3] === ".") q *= 1.5;
  if (m[4] === "t") q *= 2 / 3;
  return q;
}
// quarter-length -> vexflow duration token (no triplet beaming, kept simple)
function quartersToVf(q) {
  const table = [[4, "w"], [3, "hd"], [2, "h"], [1.5, "qd"], [1, "q"], [0.75, "8d"], [0.5, "8"], [0.25, "16"], [0.125, "32"]];
  let best = table[0];
  for (const t of table) if (Math.abs(t[0] - q) < Math.abs(best[0] - q)) best = t;
  return best[1];
}
// "C#5" -> { key:"c#/5", acc:"#" } ; drum names -> a fixed percussion pitch
function pitchToVf(p) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(p));
  if (!m) return { key: "b/4", acc: null };           // drum / unknown -> middle line
  return { key: `${m[1].toLowerCase()}${m[2]}/${m[3]}`, acc: m[2] || null };
}

function measureBeats(timeSig) {
  const [n, d] = timeSig.split("/").map(Number);
  return (n || 4) * 4 / (d || 4); // in quarter-note units
}

// group a track's notes into measures (arrays of {keys[], acc[], vf, isRest})
function toMeasures(track, beatsPer) {
  const measures = []; let cur = [], acc = 0;
  for (const n of track.notes) {
    const durTok = n.rest != null ? n.rest : n.dur;
    const q = durToQuarters(durTok);
    const vf = quartersToVf(q);
    if (n.rest != null) {
      cur.push({ keys: ["b/4"], accs: [null], vf: vf + "r", rest: true });
    } else {
      const arr = Array.isArray(n.note) ? n.note : [n.note];
      const parsed = arr.map(pitchToVf);
      cur.push({ keys: parsed.map((x) => x.key), accs: parsed.map((x) => x.acc), vf });
    }
    acc += q;
    if (acc >= beatsPer - 1e-6) { measures.push(cur); cur = []; acc = 0; }
  }
  if (cur.length) measures.push(cur);
  return measures.length ? measures : [[{ keys: ["b/4"], accs: [null], vf: "wr", rest: true }]];
}

const MW = 240, SH = 120, PADTOP = 16;

export function renderSheet(container, song, timeSig = "4/4") {
  container.innerHTML = "";
  if (!song.tracks.length) { container.innerHTML = '<p class="muted">No tracks to engrave.</p>'; return; }
  const beatsPer = measureBeats(timeSig);
  const cw = Math.max(container.clientWidth || 900, 320);
  const perRow = Math.max(1, Math.floor((cw - 20) / MW));

  for (const track of song.tracks) {
    const block = document.createElement("div");
    block.className = "sheet-track";
    const label = document.createElement("div");
    label.className = "sheet-label";
    label.textContent = `${track.name} · ${track.instrument}`;
    block.appendChild(label);

    const measures = toMeasures(track, beatsPer);
    const rows = Math.ceil(measures.length / perRow);
    const host = document.createElement("div");
    block.appendChild(host);
    container.appendChild(block);

    const renderer = new VF.Renderer(host, VF.Renderer.Backends.SVG);
    renderer.resize(perRow * MW + 20, rows * SH + PADTOP);
    const ctx = renderer.getContext();
    ctx.setFillStyle("#cfe"); ctx.setStrokeStyle("#9ad");

    measures.forEach((mNotes, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const x = 10 + col * MW, y = PADTOP + row * SH;
      try {
        const stave = new VF.Stave(x, y, MW);
        if (col === 0) { stave.addClef("treble"); if (i === 0) stave.addTimeSignature(timeSig); }
        stave.setContext(ctx).draw();

        const notes = mNotes.map((nd) => {
          const sn = new VF.StaveNote({ keys: nd.keys, duration: nd.vf });
          nd.accs.forEach((a, idx) => { if (a) sn.addModifier(new VF.Accidental(a), idx); });
          return sn;
        });
        const voice = new VF.Voice({ num_beats: beatsPer, beat_value: 4 });
        voice.setMode(VF.Voice.Mode.SOFT);
        voice.addTickables(notes);
        new VF.Formatter().joinVoices([voice]).format([voice], MW - 30);
        voice.draw(ctx, stave);
        try { VF.Beam.generateBeams(notes.filter((n) => !n.isRest())).forEach((b) => b.setContext(ctx).draw()); } catch (e) {}
      } catch (e) { /* skip a bad measure */ }
    });
  }
}

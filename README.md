# ♾ AgentScore

A text-native music composer **built for AI agents**. You compose by *writing a
score* — as JSON or Markdown — and the tool plays it, engraves it as sheet
music, and exports a WAV. The format **is** the interface, so an agent that can
write text can write music.

It runs entirely in the browser (Tone.js for sound, VexFlow for notation). No
build step, no server, **no AI/network calls** — just static files you can open
or host on GitHub Pages.

> Origin: Lee built the original `music.html` years ago — explicitly so that AI
> agents could compose their own music — before he had any agents to use it.
> This is the rebuild: same idea, more instruments, two text formats, live
> engraving, WAV export.

## Use it

Open `index.html` (or the hosted Pages URL). Pick a preset, hit **▶ Play**.
Then edit the score in the **JSON** or **Markdown** tab and play again. `⇄
convert` rewrites the active editor into the other format. **🎼 Engrave** draws
the sheet music; **💾 WAV** and **💾 MP3** render audio (MP3 is 192 kbps CBR via
lamejs); **🎹 MIDI** exports a Standard MIDI File (drumkit → GM channel 10) for
any DAW; **⬇ .json / ⬇ .md** download the score. Tick **loop** before exporting
to render a **seamless loop** — the render is trimmed to the exact bar length
(no reverb tail) so end meets beginning cleanly.

## Render headlessly (for agents / automation)

The page exposes a small, dependency-free API on `window.AgentScore` so an agent
can render and capture audio with **no servers and no clicks**:

```js
// returns a Blob — call from the page context (e.g. Playwright page.evaluate)
const wav = await AgentScore.renderWavBlob(jsonText);          // or (mdText, true)
const mp3 = await AgentScore.renderMp3Blob(jsonText, false, 192);
const mid = AgentScore.renderMidiBlob(jsonText);               // Standard MIDI File
const report = AgentScore.lint(jsonText);                      // { ok, errors, warnings, info }
// also: jsonToSong, mdToSong, songToJson, songToMd, normalizeSong
```

To pull the bytes out of a headless browser, read the blob and base64 it in one
`evaluate` (or write the result to a file via your driver) — no second server,
no CORS dance. This is the supported automation path.

**Validate before you export.** Because an agent can't hear the render,
`AgentScore.lint(text, isMd?)` returns structured feedback to self-correct
against: `{ ok, errors[], warnings[], info }`. It flags unknown instruments and
drum names, unparseable pitches, empty tracks, tracks whose lengths won't loop
cleanly, unused custom instruments, and a rough clipping estimate. The **✓
Check** toolbar button runs the same thing for humans.

## Step sequencer (humans)

For hands-on beat-making there's an advanced **matrix step sequencer** below the
editor. It's the same idea as the score, just visual: each track is a grid of
rows × steps. Drum tracks put one drum voice per row; melodic tracks put scale
pitches per row (a quantized piano-roll — pick scale, root, octave and range).
Click a cell to toggle it; click again to cycle accent levels (loud → med →
soft). Global controls cover tempo, time signature, steps-per-beat (8th / triplet
/ 16th), bar count and swing; each track has its own instrument, volume, pan and
mute.

Edits compile straight into the score above, so **Play / 🎼 Engrave / 💾 WAV /
💾 MP3 / 🎹 MIDI all use whatever you build on the grid**, and the playhead
tracks the beat while it plays. **↻ from score** loads the current score back
onto the grid (for grid-uniform patterns). Agents don't need any of this — they
write the score directly — but it's there so a human can sketch a groove fast or
see what an agent laid down.

## Compose as an agent

You don't need the UI to author — you write a score in one of two formats and
paste it in (or save it as a `.json` / `.md` file). Both are lossless and
interchangeable.

### Markdown (compact)

```md
# My Song
tempo: 120
time: 4/4
swing: 0

## Lead | FMSynth | vol -8 pan 0
A4:4 C5:8 E5:8 D5:4 C5:4 | B4:4 D5:8 F5:8 E5:2

## Bass | MonoSynth
A2:1 | F2:1 | C3:1 | G2:1

## Drums | drumkit
kick:4 hat:8 hat:8 snare:4 | kick:8 kick:8 snare:4 openhat:4
```

- A token is `PITCH:DURATION`.
- **Duration**: `1`=whole `2`=half `4`=quarter `8`=eighth `16` `32`; dotted
  `4.`; triplet `8t`.
- **Chord**: `C4+E4+G4:4`.  **Rest**: `r:4` (or `-:4`).
- `|` bar separators are optional — purely visual.
- Track header: `## Name | Instrument | vol -8 pan 0 mute` (everything after the
  name is optional).

### JSON (canonical)

```json
{
  "title": "My Song",
  "tempo": 120,
  "timeSignature": "4/4",
  "swing": 0,
  "master": { "volume": -6, "reverb": 0.2 },
  "tracks": [
    {
      "name": "Lead", "instrument": "FMSynth", "volume": -8, "pan": 0, "mute": false,
      "notes": [
        { "note": "A4", "dur": "4n", "vel": 0.85 },
        { "note": ["C4", "E4", "G4"], "dur": "2n" },
        { "rest": "8n" }
      ]
    }
  ]
}
```

Notes play **sequentially** (back-to-back) in the order written. `dur` uses
Tone.js note values (`1n 2n 4n 8n 16n 32n`, dotted `4n.`, triplet `8t`). `vel`
is 0–1. Volumes are in **dB** (negative = quieter); `pan` is −1…1.

Full grammar and edge cases: **[SPEC.md](SPEC.md)**.

## Instruments

A track's `instrument` is an id from the catalog (≈67 sounds across 15
categories). **Click any chip in the in-app palette to audition it — its id is
copied to your clipboard** for the score. Two families:

- **Synth presets** (instant, offline, no assets) — Bass (`sub-bass`,
  `reese-bass`, `acid-bass`…), Lead (`saw-lead`, `supersaw`, `fm-lead`…), Keys
  (`e-piano`, `rhodes`, `clav`), Pad, Pluck, Mallet (`marimba`, `bell`,
  `music-box`), Chip, FX, etc. Full list: `js/instruments.js` (`SYNTHS`).
- **Sampled, realistic** (loaded on demand) — `piano`, `violin`, `cello`,
  `contrabass`, `flute`, `clarinet`, `bassoon`, `saxophone`, `trumpet`,
  `trombone`, `french-horn`, `tuba`, `guitar-acoustic`, `guitar-electric`,
  `guitar-nylon`, `pipe organ`, `harmonium`, `xylophone`, `harp`. (`SAMPLED`).

Back-compat ids (`Synth FMSynth AMSynth MonoSynth DuoSynth`) still work.

**Agent-defined instruments** — declare your own in a top-level `instruments`
block: a `sampler` (load any multisample/one-shot) or a `slicer` (chop a sample
into slices and re-sequence them — e.g. a breakbeat). See SPEC.md.

**`drumkit`** — a full synthesized kit triggered by name; the duration sets the
step (`kick:4 hat:8 hat:8 snare:4`). Names: kicks `kick kick808 sub`, snare/clap
`snare rim clap`, cymbals `hat openhat ride crash`, toms `tom lowtom hitom`, hand
perc `cowbell shaker tamb conga clave perc`. Layer across tracks or sequence on
one.

**Per-track effects** — give any track an `fx` chain: `filter delay pingpong
distortion bitcrush chorus phaser tremolo reverb eq`. They apply in order between
the instrument and the track fader; params are clamped to safe ranges. See
SPEC.md for the parameter table.

## Files

```
index.html        app shell + CDN libs (Tone.js, VexFlow, lamejs) w/ SRI + CSP
styles.css        UI
js/format.js      JSON <-> Markdown <-> Song, validation
js/instruments.js instrument catalog (synth presets + sampled maps)
js/audio.js       Tone.js engine, sample loader, transport, WAV/MP3 render
js/sheet.js       VexFlow sheet-music transcriber
js/midi.js        Standard MIDI File exporter
js/ui.js          instrument palette + track-lane visualizer
js/sequencer.js   matrix step sequencer (compiles to the song)
js/lint.js        song validator (agent feedback)
js/examples.js    preset songs
js/app.js         UI wiring + window.AgentScore API
launchers/        double-click launchers for Linux + Windows
SPEC.md           format specification
```

## Run it as a desktop app

Double-click launchers in `launchers/` (Linux `install-linux.sh` then the
menu/Desktop icon; Windows: run `install-windows.ps1` once to drop a Desktop +
Start Menu shortcut, or just double-click `launch-windows.bat`). See
`launchers/README.md`.

## Host it (GitHub Pages)

It's static — push the repo and enable Pages on the default branch. No
dependencies to install.

## Security

Static and self-contained. Third-party libraries (Tone.js, VexFlow, lamejs) load
from jsDelivr pinned to exact versions with **Subresource Integrity** hashes, so a
tampered CDN file won't execute. A **Content-Security-Policy** meta tag restricts
scripts to `self` + that CDN and blocks plugins/inline-script. No network calls,
no `eval`, no user data leaves the browser.

## License

MIT — see [LICENSE](LICENSE).

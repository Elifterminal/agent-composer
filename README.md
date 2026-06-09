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
the sheet music; **💾 Export WAV** renders an audio file; **⬇ .json / ⬇ .md**
download the score.

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

| id | character |
|----|-----------|
| `Synth` | clean default |
| `FMSynth` | bell / metallic |
| `AMSynth` | tremolo |
| `MonoSynth` | fat bass / lead |
| `DuoSynth` | detuned pad |
| `drumkit` | percussion — see below |

**Drum names** (for `drumkit` tracks): `kick snare hat openhat clap tom ride
crash`. Duration still required (controls spacing): `kick:4 hat:8 hat:8
snare:4`.

## Files

```
index.html      app shell + CDN libs
styles.css      UI
js/format.js    JSON <-> Markdown <-> Song, validation
js/audio.js     Tone.js instruments, transport, offline WAV render
js/sheet.js     VexFlow sheet-music transcriber
js/examples.js  preset songs
js/app.js       UI wiring
SPEC.md         format specification
```

## Host it (GitHub Pages)

It's static — push the repo and enable Pages on the default branch. No
dependencies to install.

## License

MIT — see [LICENSE](LICENSE).

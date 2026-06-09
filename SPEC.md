# AgentScore format specification

Two interchangeable representations of the same **Song**: canonical **JSON** and
compact **Markdown**. The app normalizes/validates on load, so out-of-range
values are clamped rather than rejected.

## Song (JSON)

| field | type | default | notes |
|-------|------|---------|-------|
| `title` | string | `"Untitled"` | |
| `tempo` | number | `120` | BPM, clamped 20–400 |
| `timeSignature` | string | `"4/4"` | `n/d`; affects engraving only |
| `swing` | number | `0` | 0–1, applied at the 8th-note grid |
| `master.volume` | number | `-6` | dB, clamped −60…6 |
| `master.reverb` | number | `0.18` | wet 0–1 |
| `tracks` | Track[] | `[]` | |

### Track

| field | type | default | notes |
|-------|------|---------|-------|
| `name` | string | `"Track N"` | |
| `instrument` | string | `"Synth"` | `Synth FMSynth AMSynth MonoSynth DuoSynth drumkit` |
| `volume` | number | `-8` | dB |
| `pan` | number | `0` | −1 (L) … 1 (R) |
| `mute` | boolean | `false` | |
| `notes` | Note[] | `[]` | played sequentially |

### Note

A pitched note, a chord, or a rest:

```json
{ "note": "C4", "dur": "4n", "vel": 0.85 }      // single
{ "note": ["C4","E4","G4"], "dur": "2n" }        // chord
{ "rest": "8n" }                                  // rest (advances time, silent)
```

- `note` — scientific pitch (`C4`, `F#5`, `Bb2`) or an array for chords. For a
  `drumkit` track, use a drum name: `kick snare hat openhat clap tom ride crash`.
- `dur` — Tone.js note value: `1n 2n 4n 8n 16n 32n`, dotted `4n.`, triplet
  `8t`. (`duration` is accepted as an alias.)
- `vel` — velocity 0–1 (default `0.85`; `velocity` accepted as alias).

Timing is **sequential**: each note/rest starts when the previous one ends.
Track length = sum of its note+rest durations; the song loops at the longest
track.

## Markdown

```
# <title>
tempo: <bpm>
time: <n/d>
swing: <0..1>
master: vol <dB> reverb <0..1>

## <name> | <instrument> | vol <dB> pan <-1..1> [mute]
<token> <token> | <token> ...
```

- **Header lines** (`tempo:`, `time:`, `swing:`, `master:`) may appear in any
  order before/after tracks; the `# ` line is the title.
- **Track header**: `## ` then `Name | Instrument | options`. Instrument and
  options are optional. Options: `vol <dB>`, `pan <n>`, `mute`.
- **Pattern lines** under a track are a whitespace-separated list of tokens.
  Multiple pattern lines under one header are concatenated.

### Token grammar

```
token   := pitch ":" duration
pitch   := NOTE ( "+" NOTE )*        // "+" joins a chord
         | "r" | "-"                  // rest
NOTE    := [A-Ga-g][#b]?[0-9]         // C4, F#5, Bb2   (or a drum name)
duration:= [1|2|4|8|16|32] ["."] ["t"]   // 4  4.  8t
```

`|` tokens (bar separators) are ignored for timing — visual only. A token whose
duration can't be parsed is skipped.

## Mapping (MD ⇄ JSON)

| MD | JSON |
|----|------|
| `A4:4` | `{"note":"A4","dur":"4n"}` |
| `C4+E4+G4:2` | `{"note":["C4","E4","G4"],"dur":"2n"}` |
| `r:8` / `-:8` | `{"rest":"8n"}` |
| `8.` | `8n.` |
| `8t` | `8t` |

## Export

- **WAV** — offline render of the whole song (44.1 kHz, 16-bit stereo) including
  master reverb tail.
- **MP3** — same render, encoded to 192 kbps CBR (lamejs).
- **.json / .md** — the score itself, in either format.
- **Programmatic**: `window.AgentScore.renderWavBlob(text, isMd?)` and
  `renderMp3Blob(text, isMd?, kbps?)` return a `Blob` for headless capture.

## Notes / limits

- Sheet-music transcription is best-effort: notes are packed into measures by the
  time signature and drawn with tolerant (soft) voices. Drum tracks are drawn on
  the middle line as a rhythm guide.
- No tempo automation, ties across barlines, or per-note articulation yet.

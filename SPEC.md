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
| `fx` | Fx[] | `[]` | per-track effect chain (see below) |
| `notes` | Note[] | `[]` | played sequentially |

### Note

A pitched note, a chord, or a rest:

```json
{ "note": "C4", "dur": "4n", "vel": 0.85 }      // single
{ "note": ["C4","E4","G4"], "dur": "2n" }        // chord
{ "rest": "8n" }                                  // rest (advances time, silent)
```

- `note` — scientific pitch (`C4`, `F#5`, `Bb2`) or an array for chords. For a
  `drumkit` track, use a drum name (see the kit below).
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

## Drum kit (`drumkit` instrument)

A `drumkit` track triggers synthesized percussion by name (the `dur` sets the
step length, not the sound). All sounds are synthesized — nothing sampled, so
the kit renders offline instantly and ships nothing copyrighted.

| group | names |
|-------|-------|
| kicks | `kick` (punchy), `kick808` / `sub` (long 808) |
| snare/clap | `snare` (body+noise), `rim`, `clap` |
| hats/cymbals | `hat`, `openhat`, `ride`, `crash` |
| toms | `tom`, `lowtom`, `hitom` |
| hand perc | `cowbell`, `shaker`, `tamb`, `conga`, `clave`, `perc` |

Layer drums across separate tracks (one per voice) or sequence them on one
track — e.g. `kick808:4 hat:8 shaker:8 snare:4 cowbell:8 hat:8`.

## Per-track effects (`fx`)

A track may carry an `fx` array — an ordered chain of effect nodes inserted
between the instrument and the track's pan/volume. Each entry is
`{ "type": "...", ...params }`. Unknown types are dropped; params are clamped to
safe ranges at build time (e.g. delay `feedback` is capped below 1 so it can't
run away), and the chain is capped at 8 nodes.

| type | params (defaults) |
|------|-------------------|
| `filter` | `mode` `lowpass`\|`highpass`\|`bandpass`\|`notch` (`lowpass`), `freq` (800), `q` (1) |
| `delay` | `time` (`8n`), `feedback` (0.3, max 0.92), `wet` (0.3) |
| `pingpong` | `time` (`8n`), `feedback` (0.3, max 0.92), `wet` (0.3) |
| `distortion` | `amount` 0–1 (0.4), `wet` (1) |
| `bitcrush` | `bits` 1–16 (4) |
| `chorus` | `frequency` (1.5), `delayTime` (3.5), `depth` (0.7), `wet` (0.5) |
| `phaser` | `frequency` (0.5), `octaves` (3), `baseFrequency` (350), `wet` (0.5) |
| `tremolo` | `frequency` (9), `depth` (0.7), `wet` (0.8) |
| `reverb` | `decay` (1.8), `wet` (0.3) |
| `eq` | `low` `mid` `high` dB (0) |

```json
"tracks": [
  { "name": "Stab", "instrument": "supersaw",
    "fx": [ { "type": "filter", "mode": "lowpass", "freq": 1200, "q": 4 },
            { "type": "pingpong", "time": "8n.", "feedback": 0.55, "wet": 0.4 } ],
    "notes": [ { "note": ["A3","C4","E4"], "dur": "8n" } ] }
]
```

In Markdown, an `fx` chain rides on a `> fx: [...]` line directly under the
track header:

```md
## Stab | supersaw | vol -12
> fx: [{"type":"filter","mode":"lowpass","freq":1200,"q":4},{"type":"pingpong","time":"8n.","feedback":0.55}]
A3+C4+E4:8 r:8
```

## Custom instruments (agent-defined)

A song may declare its own instruments in a top-level `instruments` map; tracks
reference them by id. Two types:

```json
"instruments": {
  "mypiano": { "type": "sampler", "baseUrl": "https://…/", "urls": { "C4": "c4.mp3", "A4": "a4.mp3" }, "gain": -3, "release": 0.6 },
  "chop":    { "type": "slicer",  "url": "/samples/breaks/break.wav", "slices": 16, "gain": 2 }
}
```

- **`sampler`** — a pitched multisample (or one-shot). `urls` maps notes to
  files; Tone pitch-shifts between them. Use one entry for a simple one-shot.
- **`slicer`** — chop a single sample and trigger slices. `slices` is either a
  number N (N equal slices, addressed by index `"0"`…`"N-1"` in note) or a map
  `{ "kick": [startSec, durSec], … }` (addressed by name). Each note triggers a
  slice — perfect for breakbeats / jungle (re-sequence the amen).

**Security:** sample URLs must be on a CSP-allowlisted origin (the app itself,
`tonejs.github.io`, or `cdn.jsdelivr.net`) — arbitrary hosts are blocked by the
Content-Security-Policy. Bundle your own samples in the app folder for `self`.

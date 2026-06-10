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
| `solo` | boolean | `false` | if ANY track is soloed, only soloed tracks sound (DAW semantics) |
| `repeat` | number | `1` | loop the note list N times (1–64) — pattern compression for agents |
| `transpose` | number | `0` | shift pitched notes by semitones (−36…36); drum names pass through |
| `offsetBeats` | number | `0` | delay the whole track by N beats (pickups, layered grooves) |
| `humanize` | number | `0` | 0–1 deterministic timing/velocity jitter (seeded — same score, same bytes) |
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

## <name> | <instrument> | vol <dB> pan <-1..1> [mute] [solo] [xN] [tr <semis>] [off <beats>] [hum <0..1>]
<token> <token> | <token> ...
```

- **Header lines** (`tempo:`, `time:`, `swing:`, `master:`) may appear in any
  order before/after tracks; the `# ` line is the title.
- **Track header**: `## ` then `Name | Instrument | options`. Instrument and
  options are optional. Options: `vol <dB>`, `pan <n>`, `mute`, `solo`,
  `x<N>` (repeat), `tr <semis>` (transpose), `off <beats>`, `hum <0..1>`.
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
- **MIDI** — Standard MIDI File (format 1, 192 PPQ): one MIDI track per song
  track, each on its own channel with a **General MIDI program** chosen from the
  instrument (so it opens with a sensible sound in a DAW); `drumkit` tracks
  mapped to GM drums on channel 10; tempo + time signature in a conductor track.
  Notes/chords/rests and velocities are preserved; per-track `fx` and the exact
  synth voicing are not (MIDI carries no audio).
- **Stems** — every audible track rendered **solo through the identical master
  chain**, forced to the full mix length, packaged as one ZIP of WAVs
  (`NN-trackname.wav`). Stems are sample-aligned and **sum back to the mix**
  (verified to within 16-bit quantization noise). Muted tracks are skipped; if
  any track is soloed, only soloed tracks are exported.
- **.json / .md** — the score itself, in either format.
- **Programmatic**: `window.AgentScore.renderWavBlob(text, isMd?)`,
  `renderMp3Blob(text, isMd?, kbps?)`, and `renderMidiBlob(text, isMd?)` each
  return a `Blob` for headless capture. Stems:
  `renderStemsZipBlob(text, isMd?, tailSec?)` → ZIP blob, and
  `renderStemWavBlob(text, trackIndex, isMd?, tailSec?)` → single WAV blob.

## Notes / limits

- Sheet-music transcription is best-effort: notes are packed into measures by the
  time signature and drawn with tolerant (soft) voices. Drum tracks are drawn on
  the middle line as a rhythm guide.
- No tempo automation, ties across barlines, or per-note articulation yet.

## Drum kits (`drumkit`, `kit808`, `kit909`)

A drum-kit track triggers synthesized percussion by name (the `dur` sets the
step length, not the sound). All sounds are synthesized — nothing sampled, so
the kits render offline instantly and ship nothing copyrighted. **All three
kits answer to the same 19 names**, so swapping the whole kit flavor is a
one-word change to `instrument`: `drumkit` (neutral), `kit808` (boomy kick,
ticky hats, long clap), `kit909` (punchy clicky kick, bright snare, sizzly
open hat).

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
| `wah` | `baseFrequency` (100), `octaves` (6), `sensitivity` dB (0), `q` (2), `wet` (1) |
| `autopan` | `frequency` (1), `depth` (1), `wet` (1) |
| `autofilter` | `frequency` (1), `baseFrequency` (200), `octaves` (2.6), `depth` (1), `wet` (1) |
| `vibrato` | `frequency` (5), `depth` (0.1), `wet` (1) |
| `pitchshift` | `pitch` semitones −24…24 (0), `windowSize` (0.1), `wet` (1) |
| `freqshift` | `frequency` Hz −2000…2000 (42), `wet` (1) |
| `chebyshev` | `order` 1–100 (50), `wet` (0.5) — waveshaping distortion |
| `widener` | `width` 0–1 (0.7) |
| `compressor` | `threshold` (−24), `ratio` (4), `attack` (0.003), `release` (0.25), `knee` (30) |
| `limiter` | `threshold` (−6) |

### Ramp automation (sweeps written into the score)

Any fx entry may carry a `ramp` — one object or an array — that sweeps one of
its params linearly over time. `at`/`len` are in **beats**; `from` defaults to
the param's current value. Works live and in WAV/MP3/stem exports; in looped
live playback the sweep runs on the first pass (exports bake it in).

```json
{ "type": "filter", "mode": "lowpass", "freq": 200, "q": 6,
  "ramp": { "param": "frequency", "from": 200, "to": 6000, "at": 0, "len": 16 } }
{ "type": "wah", "ramp": [ { "param": "Q", "to": 12, "at": 8, "len": 8 } ] }
```

Rampable params are the Tone signal params of each effect (`frequency`, `wet`,
`depth`, `feedback`, …); safety-critical ones stay clamped (`feedback` ≤ 0.92,
`wet`/`depth`/`width` 0–1). Unknown params are ignored.

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

## ABC notation import

AgentScore can read [ABC notation](https://abcnotation.com/) and convert it to a
Song (one-way: ABC → JSON). ABC is the terse, established text notation that
LLMs already know, so it's a fast way for an agent to enter *notation*, which the
JSON layer then turns into *production*.

`AgentScore.abcToSong(abcText)` → a normalized Song. In the UI, the **ABC** tab +
**⇄ convert** does the same. Each ABC voice becomes a track (default instrument
`piano`); tempo, meter, and title carry over.

Supported subset:

| ABC | handled |
|-----|---------|
| header fields | `T` title, `M` meter (incl. `C`, `C\|`), `L` unit length, `Q` tempo (`1/4=120` or bare), `K` key, `V` voices |
| key signatures | majors + modes (`Dor Mix Min Lyd Phr Aeo Loc`), e.g. `K:Ador`, `K:Bb` |
| accidentals | `^ ^^ _ __ =` with per-bar memory; key signature otherwise |
| octaves | `C, , ` (down) and `c '` (up) |
| lengths | `A2`, `A/2`, `A/`, `A3/2`, `A//` |
| rhythm | dotted/broken `>` `<`; tuplets `(3` `(5` … (with standard `q` defaults) |
| grouping | chords `[CEG]`, rests `z x Z X` |
| structure | barlines, `\|: :\|` repeats, `\|1`/`\|2` (and `[1`/`[2`) endings, multiple voices |

Ignored (no audio effect): slurs `( )`, ties `-`, grace notes `{}`, decorations
`! !` / `+ +`, chord-symbol annotations `"…"`, lyrics `w:`. Durations are snapped
to the note-value vocabulary; notes longer than a whole note become repeated
whole notes (no ties). ABC export is **not** provided — ABC can't represent the
production layer (fx, sampler/slicer, mixing), so round-tripping would lose it.

### Production directives in ABC

ABC is notation-only, so AgentScore reads three directive forms that let an
agent score the *production* inside the same ABC file:

```abc
X:1
T:Wah Groove
M:4/4
L:1/8
K:Am
%%agentscore {"master":{"reverb":0.35},"swing":0.15}
V:1 name="supersaw"
%%agentscore {"volume":-12,"fx":[{"type":"wah"},{"type":"delay","time":"8n."}],"transpose":-12}
ABcd efga | ...
V:2
%%MIDI program 33
A,2 C2 E2 A,2 | ...
```

- `%%agentscore {json}` — any Track fields (`instrument volume pan mute solo
  fx repeat transpose offsetBeats humanize name`) apply to the **current
  voice**; any Song fields (`master swing tempo title instruments`) apply to
  the song. Including `instruments` means even custom samplers/slicers can be
  declared from ABC.
- `%%MIDI program N` — the standard ABC MIDI directive; the GM program is
  mapped to the closest AgentScore instrument. `%%MIDI channel 10` → drum kit.
- `V:n name="<instrument-id>"` — a voice name that matches a catalog id sets
  that voice's instrument directly.

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

**Bundled breaks (CC0).** The repo ships fully-synthesized, license-clean
breakbeats under `samples/breaks/` for the slicer to chop — `break.wav`,
`jungle.wav`, `funk.wav`, `fourfloor.wav`, each a one-bar loop on a 16-step grid
(so the default 16 equal slices line up with the steps). They're generated by
`tools/make_breaks.py` (sine/noise synthesis, nothing sampled). Reference one
with `{ "type": "slicer", "url": "/samples/breaks/jungle.wav", "slices": 16 }`.

// render.js — headless render runner, driven by a host app's compose API
// (VocalEyes: /api/compose/*). Open /agentscore/render.html#job=<32-hex>:
// fetches the job's score (same origin only), lints it, renders offline, and
// POSTs the audio back. No UI — body text is status for debugging. Standalone
// (e.g. GitHub Pages) there is no API, so it reports "no job/api" and stops.
import { jsonToSong, mdToSong, normalizeSong } from "./format.js";
import { renderBuffer, audioBufferToWavBlob, audioBufferToMp3Blob } from "./audio.js";
import { lintSong } from "./lint.js";
import { abcToSong } from "./abc.js";

const out = (msg) => { document.body.textContent = "AgentScore render runner — " + msg; };

async function main() {
  const m = /[#&]job=([0-9a-f]{32})(?:&|$)/.exec(location.hash);
  if (!m) { out("no job id"); return; }
  const base = `/api/compose/job/${m[1]}`;

  const fail = async (message) => {
    out("failed: " + message);
    try {
      await fetch(`${base}/error`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: String(message).slice(0, 2000) }),
      });
    } catch (e) { /* host gone — nothing else to do */ }
  };

  try {
    const r = await fetch(`${base}/score`);
    if (!r.ok) { out("no job / no api (HTTP " + r.status + ")"); return; }
    const job = await r.json();
    const fmt = job.format === "md" || job.format === "abc" ? job.format : "json";
    const song = fmt === "md" ? mdToSong(job.score)
      : fmt === "abc" ? normalizeSong(abcToSong(job.score))
      : jsonToSong(job.score);
    const lint = lintSong(song);
    if (!lint.ok) return fail("lint errors: " + lint.errors.join("; "));

    out("rendering…");
    await Tone.start();
    const tail = Number.isFinite(+job.tail_sec) ? Math.min(10, Math.max(0, +job.tail_sec)) : 2.5;
    const mp3 = job.output === "mp3";
    const buffer = await renderBuffer(song, tail);
    // An all-silent render is almost certainly a broken score (unknown
    // instruments / drum names render as nothing) — fail with the lint
    // warnings so the agent can self-correct instead of getting silence.
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i += 8) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
    }
    if (peak < 1e-5) {
      return fail("render is silent — check instruments and note names" +
        (lint.warnings.length ? " · lint warnings: " + lint.warnings.join("; ") : ""));
    }
    const blob = mp3 ? audioBufferToMp3Blob(buffer, job.kbps || 192) : audioBufferToWavBlob(buffer);

    out("uploading…");
    const res = await fetch(`${base}/result`, {
      method: "POST",
      headers: { "Content-Type": mp3 ? "audio/mpeg" : "audio/wav" },
      body: blob,
    });
    if (!res.ok) return fail("result upload rejected: HTTP " + res.status);
    out("done");
  } catch (e) {
    await fail((e && e.message) || String(e));
  }
}
main();

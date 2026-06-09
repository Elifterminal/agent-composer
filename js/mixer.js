// mixer.js — DAW-style channel strips for the score's tracks plus a master
// strip. Pure view: app.js owns the model (the score text); every edit here
// goes through onEdit(mutate) which parses the current song, applies the
// mutation, and writes it back to the JSON/MD editors.

export function createMixer({ mount, catalog, onEdit }) {
  let editing = false;                 // guard: don't rebuild mid-gesture

  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  // continuous controls fire onEdit silently on input (no rebuild) and a full
  // refresh on change, so dragging a fader doesn't destroy the slider mid-drag
  function liveSlider(input, apply) {
    input.addEventListener("pointerdown", () => { editing = true; });
    input.addEventListener("input", () => apply(+input.value, true));
    input.addEventListener("change", () => { editing = false; apply(+input.value, false); });
  }

  function strip(track, i, trackCount) {
    const s = el("div", "mix-strip");

    const name = el("input", "mix-name");
    name.value = track.name; name.spellcheck = false; name.title = "track name";
    name.addEventListener("change", () => onEdit((song) => { song.tracks[i].name = name.value || `Track ${i + 1}`; }));
    s.appendChild(name);

    const inst = el("select", "mix-inst");
    inst.title = "instrument";
    for (const it of catalog) {
      const o = el("option", null, it.label); o.value = it.id;
      if (it.id === track.instrument) o.selected = true;
      inst.appendChild(o);
    }
    // custom (agent-defined) instruments won't be in the catalog — keep them
    if (![...inst.options].some((o) => o.value === track.instrument)) {
      const o = el("option", null, track.instrument + " (custom)"); o.value = track.instrument; o.selected = true;
      inst.appendChild(o);
    }
    inst.addEventListener("change", () => onEdit((song) => { song.tracks[i].instrument = inst.value; }));
    s.appendChild(inst);

    if (track.fx && track.fx.length) s.appendChild(el("div", "mix-fx", `fx ×${track.fx.length}`));

    const panWrap = el("div", "mix-panwrap");
    const pan = el("input"); pan.type = "range"; pan.min = -1; pan.max = 1; pan.step = 0.05; pan.value = track.pan;
    pan.className = "mix-pan"; pan.title = "pan (double-click to center)";
    pan.addEventListener("dblclick", () => { pan.value = 0; onEdit((song) => { song.tracks[i].pan = 0; }); });
    liveSlider(pan, (v, silent) => onEdit((song) => { song.tracks[i].pan = v; }, silent));
    panWrap.append(el("span", "mix-lab", "L"), pan, el("span", "mix-lab", "R"));
    s.appendChild(panWrap);

    const faderWrap = el("div", "mix-faderwrap");
    const fader = el("input", "mix-fader"); fader.type = "range";
    fader.min = -60; fader.max = 6; fader.step = 0.5; fader.value = track.volume; fader.title = "volume (dB)";
    const db = el("div", "mix-db", fmtDb(track.volume));
    liveSlider(fader, (v, silent) => { db.textContent = fmtDb(v); onEdit((song) => { song.tracks[i].volume = v; }, silent); });
    faderWrap.append(fader, db);
    s.appendChild(faderWrap);

    const btns = el("div", "mix-btns");
    const mute = el("button", "mix-m" + (track.mute ? " on" : ""), "M"); mute.title = "mute";
    mute.addEventListener("click", () => onEdit((song) => { song.tracks[i].mute = !song.tracks[i].mute; }));
    const soloB = el("button", "mix-s" + (track.solo ? " on" : ""), "S"); soloB.title = "solo";
    soloB.addEventListener("click", () => onEdit((song) => { song.tracks[i].solo = !song.tracks[i].solo; }));
    btns.append(mute, soloB);
    if (trackCount > 1) {
      const del = el("button", "mix-x", "✕"); del.title = "remove track";
      del.addEventListener("click", () => onEdit((song) => { song.tracks.splice(i, 1); }));
      btns.appendChild(del);
    }
    s.appendChild(btns);
    return s;
  }

  function masterStrip(song) {
    const s = el("div", "mix-strip master");
    s.appendChild(el("div", "mix-name static", "MASTER"));

    const rvWrap = el("div", "mix-panwrap");
    const rv = el("input"); rv.type = "range"; rv.min = 0; rv.max = 1; rv.step = 0.02; rv.value = song.master.reverb;
    rv.className = "mix-pan"; rv.title = "master reverb amount";
    liveSlider(rv, (v, silent) => onEdit((sg) => { sg.master.reverb = v; }, silent));
    rvWrap.append(el("span", "mix-lab", "rev"), rv);
    s.appendChild(rvWrap);

    const faderWrap = el("div", "mix-faderwrap");
    const fader = el("input", "mix-fader master"); fader.type = "range";
    fader.min = -60; fader.max = 6; fader.step = 0.5; fader.value = song.master.volume; fader.title = "master volume (dB)";
    const db = el("div", "mix-db", fmtDb(song.master.volume));
    liveSlider(fader, (v, silent) => { db.textContent = fmtDb(v); onEdit((sg) => { sg.master.volume = v; }, silent); });
    faderWrap.append(fader, db);
    s.appendChild(faderWrap);
    return s;
  }

  function fmtDb(v) { return (v > 0 ? "+" : "") + (+v).toFixed(1) + " dB"; }

  function refresh(song) {
    if (editing || !song) return;
    mount.innerHTML = "";
    const row = el("div", "mix-row");
    song.tracks.forEach((t, i) => row.appendChild(strip(t, i, song.tracks.length)));
    const add = el("button", "mix-add", "+ track");
    add.addEventListener("click", () => onEdit((sg) => {
      sg.tracks.push({ name: `Track ${sg.tracks.length + 1}`, instrument: "synth", volume: -8, pan: 0, mute: false, solo: false, fx: [], notes: [] });
    }));
    row.appendChild(add);
    row.appendChild(masterStrip(song));
    mount.appendChild(row);
  }

  return { refresh };
}

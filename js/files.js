// files.js — open / save scores on disk. Uses the File System Access API where
// available (Chromium — incl. the launchers' Chrome app windows) so Save writes
// back to the same file; falls back to <input type=file> + download elsewhere.

const PICKER_TYPES = [{
  description: "AgentScore score",
  accept: { "application/json": [".json"], "text/markdown": [".md"], "text/plain": [".abc"] },
}];

let handle = null;       // FileSystemFileHandle for the open file (when API available)
let fileName = "";       // display name; "" = nothing opened yet

export function currentFileName() { return fileName; }
export function clearHandle() { handle = null; fileName = ""; }

// which editor format a file name maps to
export function fmtOfName(name) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".md") || n.endsWith(".markdown")) return "md";
  if (n.endsWith(".abc")) return "abc";
  return "json";
}
// content sniff for files with no useful extension
export function sniffFmt(text) {
  const t = String(text).trimStart();
  if (t.startsWith("{")) return "json";
  if (/^X:\s*\d+/m.test(t) || /^K:[A-Ga-g]/m.test(t)) return "abc";
  return "md";
}

export async function openFile() {
  if (window.showOpenFilePicker) {
    const [h] = await window.showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
    const file = await h.getFile();
    handle = h; fileName = file.name;
    return { name: file.name, text: await file.text() };
  }
  return new Promise((resolve, reject) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,.md,.markdown,.abc";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return reject(new DOMException("no file chosen", "AbortError"));
      handle = null; fileName = f.name;
      resolve({ name: f.name, text: await f.text() });
    };
    inp.click();
  });
}

// a file arrived by drag-and-drop: remember its name (no writable handle)
export function adoptDropped(file) { handle = null; fileName = file.name; }

// Save to the open handle; falls back to Save As when nothing is open.
export async function saveFile(text, suggestedName) {
  if (handle) {
    const w = await handle.createWritable();
    await w.write(text); await w.close();
    return fileName;
  }
  return saveFileAs(text, suggestedName);
}

export async function saveFileAs(text, suggestedName = "song.json") {
  if (window.showSaveFilePicker) {
    const h = await window.showSaveFilePicker({ suggestedName, types: PICKER_TYPES });
    const w = await h.createWritable();
    await w.write(text); await w.close();
    handle = h; fileName = h.name || suggestedName;
    return fileName;
  }
  // no picker API: plain download (we can't write back later)
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url; a.download = suggestedName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  fileName = suggestedName;
  return fileName;
}

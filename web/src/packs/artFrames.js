/** Select a pack frame without changing the original clip's timing or source frame index. */
export function packFrame(base, clip, prefab, frames, still, exists) {
  if (!base?.startsWith(prefab + '_')) return null;
  const m = /^(.+?)_?(\d+)$/.exec(base.slice(prefab.length + 1));
  if (!m) return null;
  // Some original skills reuse Attack or another skill's sprites. The active clip wins.
  const state = clip?.startsWith(prefab + '_') ? clip.slice(prefab.length + 1) : null;
  const list = frames[state] || frames[m[1]];
  const frame = list?.[Number(m[2]) - 1];
  if (frame && exists(frame)) return frame;
  // Never filter missing files: that shifts all subsequent impact frame numbers.
  const idle = frames.Idle?.[0];
  if (idle && exists(idle)) return idle;
  return still && exists(still) ? still : null;
}

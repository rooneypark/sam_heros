// Pack-owned choreography; original animation assets and tables remain untouched.
export function makePackClip(prefab, state, spec) {
  const sequence = spec.sequence || spec.ms.map((_, i) => i + 1);
  if (sequence.length !== spec.ms.length || spec.ms.some(ms => !(ms > 0))) throw new Error('Invalid motion timing');
  let t = 0;
  const frames = sequence.map((n, i) => { const f = [t / 1000, `${prefab}_${state}_${n}`]; t += spec.ms[i]; return f; });
  const events = (spec.hits || []).map(ms => ({ t: ms / 1000, fn: 'OnAttackEvent' }));
  // pack effects (spec.fx[i].at ms): played by WorldFX PackFx when the clip reaches them
  (spec.fx || []).forEach((f, i) => events.push({ t: (f.at || 0) / 1000, fn: 'OnPackFx', s: state, i }));
  events.sort((a, b) => a.t - b.t);
  if (!spec.loop) events.push({ t: (t - 1) / 1000, fn: 'OnAttackEnd' });
  return { length: t / 1000, loop: !!spec.loop, sprites: [{ pathHash: 0, frames }], bound: [], events };
}

export function registerCustomMotion(def, base, row, assets, tables) {
  if (!def.motion && !def.skills) return;
  row.motionClips = {};
  row.continuousGather = !!def.motion?.Gather?.continuous;
  for (const [state, spec] of Object.entries(def.motion || {})) {
    const key = `${base.prefab}_${def.id}_${state}`;
    assets.anims[key] = makePackClip(base.prefab, state, spec);
    row.motionClips[state] = key;
  }
  for (const [slot, s] of Object.entries(def.skills || {})) {
    const source = tables.skill(s.base);
    if (!source) throw new Error(`Missing skill template ${s.base}`);
    const key = `${def.id}_${slot}`;
    const actions = s.actions.map((a, i) => {
      const original = tables.skillAction(a.base);
      if (!original) throw new Error(`Missing action template ${a.base}`);
      const ak = `${key}_${i}`;
      tables.t.TableSkillAction[ak] = { ...original, ...(a.patch || {}), key: ak };
      if (a.range) {
        const rk = `${ak}_range`;
        tables.t.TableRangeData[rk] = { ...tables.range(original.skillRangeKey), ...a.range, key: rk };
        tables.t.TableSkillAction[ak].skillRangeKey = rk;
      }
      return ak;
    });
    // own drawings not registered yet: the base prefab's clip of that state plays (art pending)
    const fallback = assets.anims[`${base.prefab}_${s.state}`] ? `${base.prefab}_${s.state}` : source.animationKey;
    tables.t.TableSkill[key] = { ...source, ...(s.patch || {}), key,
      animationKey: row.motionClips[s.state] || fallback, skillActions: actions };
  }
}

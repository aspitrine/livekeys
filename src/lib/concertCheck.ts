import { type Concert, MASTER_ID, type MidiMapping } from '../model/types';

export type CheckIssue = {
  level: 'error' | 'warning';
  message: string;
  /** Patch to open to fix the issue. */
  patchId?: string;
};

export type CheckEnvironment = {
  /** Installed Audio Unit ids; `null` when the scan failed, so plugins are not reported missing. */
  installedPlugins: ReadonlySet<string> | null;
  isBankInstalled: (bank: string) => boolean;
  /** Last native load error by layer id. */
  layerErrors: Readonly<Record<string, string>>;
};

/**
 * Static review of a concert before going on stage: missing banks or Audio Units, layers that failed to load,
 * silent patches and conflicting MIDI controls. It cannot predict audio stability.
 */
export function checkConcert(concert: Concert, env: CheckEnvironment): CheckIssue[] {
  const issues: CheckIssue[] = [];
  if (!concert.sets.some((s) => s.patches.length)) issues.push({ level: 'error', message: 'Le concert est vide.' });
  for (const set of concert.sets) {
    if (!set.patches.length) issues.push({ level: 'warning', message: `Le set « ${set.name} » est vide.` });
    for (const patch of set.patches) {
      const where = `${set.name} › ${patch.name}`;
      const add = (level: CheckIssue['level'], message: string) =>
        issues.push({ level, message: `${where} : ${message}`, patchId: patch.id });
      if (!patch.layers.length) add('warning', 'aucun layer, le patch est muet.');
      else if (patch.layers.every((l) => l.mute)) add('warning', 'tous les layers sont coupés.');
      for (const layer of patch.layers) {
        const missing = (id: string) => env.installedPlugins !== null && !env.installedPlugins.has(id);
        const before = issues.length;
        if (layer.plugin) {
          if (missing(layer.plugin.componentId))
            add('error', `instrument « ${layer.plugin.name} » (${layer.plugin.manufacturer}) non installé.`);
        } else if (!env.isBankInstalled(layer.sound.bank))
          add('error', `banque de sons « ${layer.sound.bank} » absente pour « ${layer.name} ».`);
        for (const effect of layer.effects)
          if (missing(effect.plugin.componentId))
            add('error', `effet « ${effect.plugin.name} » de « ${layer.name} » non installé.`);
        // A missing resource already explains the load failure.
        const error = env.layerErrors[layer.id];
        if (error && issues.length === before) add('error', `« ${layer.name} » n’a pas pu être chargé (${error}).`);
      }
    }
  }
  for (const effect of concert.masterEffects ?? [])
    if (env.installedPlugins !== null && !env.installedPlugins.has(effect.plugin.componentId))
      issues.push({ level: 'error', message: `Master : effet « ${effect.plugin.name} » non installé.` });
  if (env.layerErrors[MASTER_ID])
    issues.push({ level: 'error', message: `Master : effets non chargés (${env.layerErrors[MASTER_ID]}).` });
  issues.push(...mappingConflicts(concert.mappings));
  return issues;
}

const channelsOverlap = (a: MidiMapping, b: MidiMapping) => a.channel < 0 || b.channel < 0 || a.channel === b.channel;

/** Two controls on the same CC fire together: usually a MIDI Learn done twice by mistake. */
function mappingConflicts(mappings: MidiMapping[]): CheckIssue[] {
  const shared = new Set<number>();
  mappings.forEach((a, i) => {
    if (mappings.slice(i + 1).some((b) => a.cc === b.cc && channelsOverlap(a, b))) shared.add(a.cc);
  });
  return [...shared].map((cc): CheckIssue => ({
    level: 'warning',
    message: `Contrôle MIDI CC ${cc} affecté à plusieurs actions : un mouvement les déclenche toutes.`,
  }));
}

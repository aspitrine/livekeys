/** Output trim only: retain headroom and the balance of every layer, including pads. */
export const clampPatchLevel = (db: number) => (Number.isFinite(db) ? Math.min(0, Math.max(-24, db)) : 0);
export const patchLevelGain = (db = 0) => 10 ** (clampPatchLevel(db) / 20);

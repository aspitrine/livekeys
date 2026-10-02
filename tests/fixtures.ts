import { defaultConcert } from '../src/model/defaults';
import { useConcert, selectCurrentPatch } from '../src/store/concert';

/** Reset data through the public store API while retaining its action functions. */
export function resetConcert() {
  useConcert.getState().loadConcert(defaultConcert());
  useConcert.getState().setMasterVolume(0.9);
  const patch = selectCurrentPatch(useConcert.getState());
  if (!patch) throw new Error('Test concert has no current patch');
  return patch;
}

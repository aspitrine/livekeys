/** Vertical extent of a list item, in the coordinates of the list being dragged over. */
export type Span = { id: string; top: number; height: number };

const center = (s: Span) => s.top + s.height / 2;

/** Where a dragged item lands: number of the other items whose middle lies above the dragged middle. */
export function insertionIndex(items: readonly Span[], y: number, draggedId: string): number {
  return items.filter((s) => s.id !== draggedId && center(s) < y).length;
}

/** The span containing `y`, else the nearest one (dropping above the first or below the last). */
export function spanAt(spans: readonly Span[], y: number): Span | undefined {
  let best: Span | undefined;
  let distance = Infinity;
  for (const s of spans) {
    const d = y < s.top ? s.top - y : y > s.top + s.height ? y - s.top - s.height : 0;
    if (d < distance) [best, distance] = [s, d];
  }
  return best;
}

/** Moves the item to `index` of the list without it (the index a drop indicator shows). */
export function placeAt<T extends { id: string }>(items: readonly T[], id: string, index: number): T[] {
  const item = items.find((i) => i.id === id);
  if (!item) return [...items];
  const rest = items.filter((i) => i.id !== id);
  rest.splice(Math.min(Math.max(index, 0), rest.length), 0, item);
  return rest;
}

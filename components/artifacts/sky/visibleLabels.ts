import { Point, conceptLabelLines } from '../../../utils/conceptSky';
import { estimateTextWidth } from '../../../utils/conceptGraph';
import { SkyScene, conceptLabel } from './scene';
import { starRadius } from './tokens';

/**
 * Which concepts keep their label in Orbit. The rings are fixed in size, so a hub with twenty
 * neighbours puts twenty labels on a ring a few hundred units round and they print over one
 * another. Greedy by degree, so the best-connected stars win: a label stays only if its box
 * clears every label already kept and every star. A thinned star stays focusable and gets its
 * label back when hovered, focused or selected. The Sky view does not need this: its layout
 * spaces labels apart.
 */
export function visibleLabels(scene: SkyScene, positions: Map<string, Point>): Set<string> {
  const { model } = scene;
  type Box = { x: number; y: number; w: number; h: number };
  const hit = (a: Box, b: Box) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
  const stars: Box[] = [...positions].map(([id, p]) => {
    const d = 2 * starRadius(model.degree.get(id) ?? 0) + 2;
    return { x: p.x, y: p.y, w: d, h: d };
  });
  const kept: Box[] = [];
  const out = new Set<string>();
  const order = [...positions.keys()].sort((a, b) => (model.degree.get(b) ?? 0) - (model.degree.get(a) ?? 0));
  for (const id of order) {
    const p = positions.get(id)!;
    const lines = conceptLabelLines(conceptLabel(scene, id));
    const w = Math.max(...lines.map((l) => estimateTextWidth(l, 12))) + 4;
    const h = lines.length * 15;
    const box = { x: p.x, y: p.y + starRadius(model.degree.get(id) ?? 0) + 4 + h / 2, w, h };
    if (kept.some((k) => hit(k, box)) || stars.some((s) => !(s.x === p.x && s.y === p.y) && hit(s, box))) continue;
    kept.push(box);
    out.add(id);
  }
  return out;
}

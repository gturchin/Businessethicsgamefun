import type { Choice, PersonalResult, Priorities, Strategy } from '../../shared/model';
// Every round contributes equally. These weights are an interpretive teaching
// model, not an empirical measurement, and are never sent during voting.
type Vector = [number, number, number, number, number];
const plan: Record<string, Vector> = { public: [100, 35, 60, 80, 65], private: [10, 60, 20, 35, 100], shared: [60, 65, 55, 65, 85] };
const agreement: Record<string, Vector> = {
  pollution: [50, 100, 40, 100, 55], renewables: [40, 95, 35, 95, 60], hiring: [40, 80, 85, 35, 95],
  training: [55, 75, 75, 35, 95], parks: [60, 75, 80, 75, 55], monitoring: [65, 90, 100, 90, 45]
};
const expansion: Record<string, Vector> = { approve: [15, 20, 15, 20, 100], conditions: [70, 100, 50, 100, 85], negotiate: [60, 80, 100, 80, 80], reject: [90, 65, 80, 100, 15] };
const keys = ['government', 'business', 'community', 'environment', 'economy'] as const;
export function score(answers: Record<number, Choice>): PersonalResult | undefined {
  if (![1, 2, 3, 4, 5].every(r => answers[r] !== undefined)) return undefined;
  const city = Number(answers[2]) / 8_000_000;
  const power = Number(answers[4]);
  const selected = answers[3] as string[];
  const vectors: Vector[] = [plan[String(answers[1])], [city * 100, (1 - city) * 100, 50, 65, 70],
    keys.map((_, i) => (agreement[selected[0]][i] + agreement[selected[1]][i]) / 2) as Vector,
    [70 - power * .25, 55 + power * .35, power, 35 + power * .65, 90 - power * .3], expansion[String(answers[5])]];
  const priorities = Object.fromEntries(keys.map((key, i) => [key, Math.round(vectors.reduce((sum, v) => sum + v[i], 0) / 5)])) as Priorities;
  const p = priorities;
  // Match the complete priority pattern to explanatory prototypes. Shared is a
  // neutral midpoint; no single answer determines the classification.
  const prototypes: Record<Strategy, Vector> = {
    public: [86, 58, 65, 85, 58], corporate: [37, 88, 48, 82, 74],
    community: [59, 70, 87, 78, 64], growth: [22, 39, 26, 35, 92], shared: [57, 64, 57, 65, 78]
  };
  const strategy = (Object.keys(prototypes) as Strategy[]).reduce((best, candidate) => {
    const distance = (s: Strategy) => keys.reduce((sum, k, i) => sum + (p[k] - prototypes[s][i]) ** 2, 0);
    return distance(candidate) < distance(best) ? candidate : best;
  }, 'shared');
  return { strategy, priorities };
}

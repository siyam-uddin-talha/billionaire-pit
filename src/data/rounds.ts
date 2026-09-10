import type { FighterId } from './fighters';
export const rounds: {
  theme: string;
  label: string;
  pair: [FighterId, FighterId];
  canonical: FighterId;
  accent: string;
}[] = [
  {
    theme: 'MONEY',
    label: 'THE MONEY ROUND',
    pair: ['elon_musk', 'mark_zuckerberg'],
    canonical: 'elon_musk',
    accent: '#d2ff43',
  },
  {
    theme: 'AI',
    label: 'THE AI ROUND',
    pair: ['dario_amodei', 'sam_altman'],
    canonical: 'dario_amodei',
    accent: '#ef73f5',
  },
  {
    theme: 'FINAL',
    label: 'FINAL CONVERGENCE',
    pair: ['dario_amodei', 'elon_musk'],
    canonical: 'dario_amodei',
    accent: '#e4bd63',
  },
];
export const gameRules = {
  outcomePolicy: 'playable' as 'playable' | 'canonical',
  roundSeconds: 60,
  startingHealth: 100,
  startingStamina: 100,
  checkpointTiming: 'between-rounds',
};
export function roundPair(
  round: number,
  winners: FighterId[] = [],
): [FighterId, FighterId] {
  if (round === 2)
    return [winners[1] ?? 'dario_amodei', winners[0] ?? 'elon_musk'];
  return rounds[round].pair;
}
export function opponentFor(
  round: number,
  player: FighterId,
  winners: FighterId[] = [],
) {
  const pair =
    round >= 0 && round < rounds.length ? roundPair(round, winners) : undefined;
  if (!pair?.includes(player))
    throw new Error('Fighter is not eligible for this round');
  return pair.find((id) => id !== player)!;
}

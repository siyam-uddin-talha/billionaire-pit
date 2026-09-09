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
export function opponentFor(round: number, player: FighterId) {
  const pair = rounds[round]?.pair;
  if (!pair?.includes(player))
    throw new Error('Fighter is not eligible for this round');
  return pair.find((id) => id !== player)!;
}

export type FighterId =
  | 'elon_musk'
  | 'mark_zuckerberg'
  | 'dario_amodei'
  | 'sam_altman';
export interface FighterDefinition {
  id: FighterId;
  name: string;
  first: string;
  last: string;
  money: number;
  ai: number;
  accent: string;
  archetype: string;
  quote: string;
  number: string;
}
export const fighters: FighterDefinition[] = [
  {
    id: 'elon_musk',
    name: 'Elon Musk',
    first: 'ELON',
    last: 'MUSK',
    money: 4,
    ai: 1,
    accent: '#d2ff43',
    archetype: 'WEALTH BRUISER',
    quote: 'Heavy hands. Heavier pockets.',
    number: '01',
  },
  {
    id: 'mark_zuckerberg',
    name: 'Mark Zuckerberg',
    first: 'MARK',
    last: 'ZUCKERBERG',
    money: 3,
    ai: 2,
    accent: '#6e9cff',
    archetype: 'BALANCED COUNTER-FIGHTER',
    quote: 'Always watching. Always countering.',
    number: '02',
  },
  {
    id: 'dario_amodei',
    name: 'Dario Amodei',
    first: 'DARIO',
    last: 'AMODEI',
    money: 2,
    ai: 4,
    accent: '#d98dff',
    archetype: 'PREDICTIVE TACTICIAN',
    quote: 'Your next move is already history.',
    number: '03',
  },
  {
    id: 'sam_altman',
    name: 'Sam Altman',
    first: 'SAM',
    last: 'ALTMAN',
    money: 1,
    ai: 3,
    accent: '#58e7ee',
    archetype: 'FAST ADAPTER',
    quote: 'Built to learn. Trained to win.',
    number: '04',
  },
];
export const fighterById = (id: FighterId) =>
  fighters.find((f) => f.id === id)!;

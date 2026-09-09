export type Screen =
  | 'loading'
  | 'menu'
  | 'select'
  | 'intro'
  | 'fight'
  | 'paused'
  | 'result'
  | 'trophy'
  | 'error';
const allowed: Record<Screen, Screen[]> = {
  loading: ['menu', 'error'],
  menu: ['select', 'error'],
  select: ['intro', 'menu'],
  intro: ['fight', 'menu'],
  fight: ['paused', 'result', 'error'],
  paused: ['fight', 'menu'],
  result: ['select', 'intro', 'trophy', 'menu'],
  trophy: ['select', 'menu'],
  error: ['loading', 'menu'],
};
export function screenReducer(current: Screen, next: Screen): Screen {
  return allowed[current].includes(next) ? next : current;
}

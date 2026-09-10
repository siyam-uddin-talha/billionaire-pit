import { rounds, roundPair } from '../data/rounds';
import type { FighterId } from '../data/fighters';
export const SAVE_KEY = 'billionaire-pit-save';
export const SETTINGS_KEY = 'billionaire-pit-settings';
export interface Checkpoint {
  version: 1;
  round: number;
  fighter: FighterId;
  savedAt: string;
  winners?: FighterId[];
}
export function validateSave(value: unknown): Checkpoint | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as Partial<Checkpoint>;
  if (
    s.winners !== undefined &&
    (!Array.isArray(s.winners) ||
      s.winners.length !== s.round ||
      s.winners.some((id, i) => !rounds[i]?.pair.includes(id)))
  )
    return null;
  if (
    s.version !== 1 ||
    !Number.isInteger(s.round) ||
    s.round! < 0 ||
    s.round! > 2 ||
    !roundPair(s.round!, s.winners).includes(s.fighter!) ||
    typeof s.savedAt !== 'string' ||
    !Number.isFinite(Date.parse(s.savedAt))
  )
    return null;
  return s as Checkpoint;
}
export function loadSave(): Checkpoint | null {
  try {
    return validateSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'));
  } catch {
    return null;
  }
}
export function saveCheckpoint(
  round: number,
  fighter: FighterId,
  winners: FighterId[] = (['elon_musk', 'dario_amodei'] as FighterId[]).slice(
    0,
    round,
  ),
): boolean {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        round,
        fighter,
        savedAt: new Date().toISOString(),
        winners,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* Storage may be disabled. */
  }
}
export function loadSound(): boolean {
  try {
    return (
      JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').sound !== false
    );
  } catch {
    return true;
  }
}
export function saveSound(sound: boolean) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, sound }));
  } catch {
    /* The current session remains usable. */
  }
}

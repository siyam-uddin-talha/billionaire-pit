export interface CombatCommand {
  moveX: number;
  moveZ: number;
  punchPressed: boolean;
  kickPressed: boolean;
  blockHeld: boolean;
  dodgePressed: boolean;
  heavy: boolean;
}
export const emptyCommand = (): CombatCommand => ({
  moveX: 0,
  moveZ: 0,
  punchPressed: false,
  kickPressed: false,
  blockHeld: false,
  dodgePressed: false,
  heavy: false,
});
export class InputManager {
  held = new Set<string>();
  pressed = new Set<string>();
  private onDown = (e: KeyboardEvent) => {
    if (
      ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
        e.code,
      )
    )
      e.preventDefault();
    this.down(e.code);
  };
  private onUp = (e: KeyboardEvent) => this.up(e.code);
  private onBlur = () => this.clear();
  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }
  down(code: string) {
    if (!this.held.has(code)) this.pressed.add(code);
    this.held.add(code);
  }
  up(code: string) {
    this.held.delete(code);
  }
  clear() {
    this.held.clear();
    this.pressed.clear();
  }
  read(): CombatCommand {
    const has = (...codes: string[]) => codes.some((c) => this.held.has(c));
    const c = {
      moveX:
        Number(has('KeyD', 'ArrowRight')) - Number(has('KeyA', 'ArrowLeft')),
      moveZ: Number(has('KeyS', 'ArrowDown')) - Number(has('KeyW', 'ArrowUp')),
      punchPressed: this.pressed.has('KeyJ'),
      kickPressed: this.pressed.has('KeyK'),
      blockHeld: has('KeyL'),
      dodgePressed: this.pressed.has('Space'),
      heavy: has('ShiftLeft', 'ShiftRight'),
    };
    this.pressed.clear();
    return c;
  }
  dispose() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
    this.clear();
  }
}

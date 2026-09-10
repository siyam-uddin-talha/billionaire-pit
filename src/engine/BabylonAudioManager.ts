import { Sound } from '@babylonjs/core/Audio/sound';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Audio/audioSceneComponent';
export type SoundName =
  | 'ui'
  | 'beep'
  | 'impact'
  | 'heavy'
  | 'block'
  | 'whoosh'
  | 'ko'
  | 'cheer'
  | 'trophy';
export class BabylonAudioManager {
  readonly ready: Promise<void>;
  private sounds = new Map<SoundName, Sound>();
  private enabled = true;
  private unlocked = false;
  private suspended = false;
  private disposed = false;
  private abort = new AbortController();
  constructor(scene: Scene, enabled: boolean, failed: () => void) {
    this.enabled = enabled;
    this.ready = Promise.all(
      (
        [
          'ui',
          'beep',
          'impact',
          'heavy',
          'block',
          'whoosh',
          'ko',
          'cheer',
          'trophy',
        ] as SoundName[]
      ).map(async (n) => {
        if (!Engine.audioEngine?.canUseWebAudio) {
          this.enabled = false;
          failed();
          return;
        }
        try {
          const response = await fetch('/audio/' + n + '.wav', {
            signal: this.abort.signal,
          });
          if (!response.ok) throw new Error('Audio unavailable');
          const buffer = await response.arrayBuffer();
          if (this.disposed) return;
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error('Audio decoding timed out')),
              10000,
            );
            const sound = new Sound(
              n,
              buffer,
              scene,
              () => {
                clearTimeout(timeout);
                resolve();
              },
              {
                loop: false,
                autoplay: false,
                volume: n === 'whoosh' ? 0.35 : n === 'cheer' ? 0.25 : 0.55,
              },
            );
            this.sounds.set(n, sound);
          });
        } catch {
          if (!this.disposed) {
            this.enabled = false;
            this.sounds.forEach((s) => s.stop());
            failed();
          }
        }
      }),
    ).then(() => {});
  }
  unlock() {
    if (!this.unlocked) {
      Engine.audioEngine?.unlock();
      this.unlocked = true;
    }
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.unlock();
    else this.sounds.forEach((s) => s.stop());
  }
  setSuspended(suspended: boolean) {
    this.suspended = suspended;
    if (suspended) this.sounds.forEach((s) => s.pause());
  }
  play(n: SoundName) {
    if (this.enabled && this.unlocked && !this.suspended) {
      if (['impact', 'heavy', 'block', 'whoosh'].includes(n))
        this.sounds.get(n)?.setPlaybackRate(0.95 + Math.random() * 0.1);
      this.sounds.get(n)?.play();
    }
  }
  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.sounds.forEach((s) => s.dispose());
    this.sounds.clear();
  }
}

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
  | 'trophy'
  | 'cyber-city-dark-atmo-background'
  | 'bg';

const SOUND_FILES = [
  'ui',
  'beep',
  'impact',
  'heavy',
  'block',
  'whoosh',
  'ko',
  'cheer',
  'trophy',
  'cyber-city-dark-atmo-background',
] as const;

export class BabylonAudioManager {
  readonly ready: Promise<void>;
  private sounds = new Map<string, Sound>();
  private enabled = true;
  private unlocked = false;
  private suspended = false;
  private disposed = false;
  private bgActive = false;
  private abort = new AbortController();
  constructor(scene: Scene, enabled: boolean, failed: () => void) {
    this.enabled = enabled;
    this.ready = Promise.all(
      SOUND_FILES.map(async (n) => {
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
              20000,
            );
            const isBg = n === 'cyber-city-dark-atmo-background';
            const sound = new Sound(
              n,
              buffer,
              scene,
              () => {
                clearTimeout(timeout);
                resolve();
              },
              {
                loop: isBg,
                autoplay: false,
                volume:
                  isBg
                    ? 0.15
                    : n === 'whoosh'
                      ? 0.35
                      : n === 'cheer'
                        ? 0.25
                        : 0.55,
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
    ).then(() => {
      if (this.enabled && this.unlocked && !this.suspended && this.bgActive) {
        this.playBg();
      }
    });
  }
  unlock() {
    if (!this.unlocked) {
      Engine.audioEngine?.unlock();
      this.unlocked = true;
      if (this.bgActive) this.playBg();
    }
  }
  playBg() {
    this.bgActive = true;
    if (this.enabled && this.unlocked && !this.suspended) {
      const bg = this.sounds.get('cyber-city-dark-atmo-background');
      if (bg && !bg.isPlaying) {
        bg.play();
      }
    }
  }
  stopBg() {
    this.bgActive = false;
    this.sounds.get('cyber-city-dark-atmo-background')?.stop();
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.unlock();
      if (this.bgActive) this.playBg();
    } else {
      this.sounds.forEach((s) => s.stop());
    }
  }
  setSuspended(suspended: boolean) {
    this.suspended = suspended;
    if (suspended) {
      this.sounds.forEach((s) => s.pause());
    } else {
      if (this.enabled && this.unlocked && this.bgActive) {
        const bg = this.sounds.get('cyber-city-dark-atmo-background');
        if (bg && (bg.isPaused || !bg.isPlaying)) {
          bg.play();
        }
      }
    }
  }
  play(n: SoundName) {
    const key = n === 'bg' ? 'cyber-city-dark-atmo-background' : n;
    if (key === 'cyber-city-dark-atmo-background') {
      this.playBg();
      return;
    }
    if (this.enabled && this.unlocked && !this.suspended) {
      if (['impact', 'heavy', 'block', 'whoosh'].includes(key))
        this.sounds.get(key)?.setPlaybackRate(0.95 + Math.random() * 0.1);
      this.sounds.get(key)?.play();
    }
  }
  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.sounds.forEach((s) => s.dispose());
    this.sounds.clear();
  }
}

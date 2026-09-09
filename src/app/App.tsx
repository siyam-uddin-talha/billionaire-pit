import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize,
  Settings2,
  Play,
  RotateCcw,
  Pause,
  X,
  Trophy,
  Zap,
  Cpu,
  Shield,
  CircleHelp,
  Monitor,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Switch } from '../../components/ui/switch';
import {
  fighters,
  fighterById,
  type FighterId,
  type FighterDefinition,
} from '../data/fighters';
import { opponentFor, rounds } from '../data/rounds';
import {
  loadSave,
  saveCheckpoint,
  clearSave,
  loadSound,
  saveSound,
} from '../services/SaveService';
import { screenReducer } from '../game/ScreenMachine';
import type { FightSnapshot } from '../game/CombatEngine';
import { BabylonGame } from '../engine/BabylonGame';

const controls = [
  ['A D', 'MOVE'],
  ['W S', 'STEP'],
  ['J', 'PUNCH'],
  ['K', 'KICK'],
  ['L', 'BLOCK'],
  ['SPACE', 'DODGE'],
  ['ESC', 'PAUSE'],
];
function Skill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="skill">
      <span>{label}</span>
      <div className="skill-bars" aria-label={`${label}: ${value} out of 4`}>
        {[1, 2, 3, 4].map((v) => (
          <i
            key={v}
            className={v <= value ? 'filled' : ''}
            style={v <= value ? { background: color } : undefined}
          />
        ))}
      </div>
      <span className="skill-plus">
        {'+'.repeat(value)}
        <span className="empty-plus">{'+'.repeat(4 - value)}</span>
      </span>
    </div>
  );
}
function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? 'small' : ''}`}>
      <span className="brand-symbol">
        B<span>\</span>P
      </span>
      <span>
        BILLIONAIRE
        <span>
          PIT<span className="brand-dot">®</span>
        </span>
      </span>
    </div>
  );
}
function Portrait({
  fighter,
  className = '',
}: {
  fighter: FighterDefinition;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={`/models/${fighter.id}.png`}
      alt=""
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}
function TouchControls({ game }: { game: BabylonGame | null }) {
  const bind = (code: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      game?.input.down(code);
    },
    onPointerUp: () => game?.input.up(code),
    onPointerCancel: () => game?.input.up(code),
    onLostPointerCapture: () => game?.input.up(code),
  });
  return (
    <div className="touch-controls">
      <div className="dpad">
        <button aria-label="Step forward" {...bind('KeyW')}>
          ↑
        </button>
        <button aria-label="Move left" {...bind('KeyA')}>
          ←
        </button>
        <button aria-label="Step backward" {...bind('KeyS')}>
          ↓
        </button>
        <button aria-label="Move right" {...bind('KeyD')}>
          →
        </button>
      </div>
      <div className="touch-actions">
        {[
          ['J', 'PUNCH'],
          ['K', 'KICK'],
          ['L', 'BLOCK'],
          ['Space', 'DODGE'],
        ].map(([key, label]) => (
          <button key={key} {...bind(key === 'Space' ? key : 'Key' + key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
export default function App() {
  const [screen, send] = useReducer(screenReducer, 'loading');
  const [selected, setSelected] = useState<FighterId>('elon_musk');
  const [round, setRound] = useState(0);
  const [progress, setProgress] = useState(0);
  const [settings, setSettings] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const [sound, setSound] = useState(loadSound);
  const [checkpoint, setCheckpoint] = useState(loadSave);
  const [snapshot, setSnapshot] = useState<FightSnapshot | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [storageNotice, setStorageNotice] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<BabylonGame | null>(null);
  const screenRef = useRef(screen);
  const pendingSave = useRef(false);
  const swipe = useRef<number | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  screenRef.current = screen;
  const fighter = fighterById(selected);
  const eligible =
    screen === 'select'
      ? fighters.filter((f) => rounds[round].pair.includes(f.id))
      : fighters;
  const isArena = ['intro', 'fight', 'paused', 'result'].includes(screen);
  const isShowcase = screen === 'menu' || screen === 'select';
  useEffect(() => {
    let disposed = false;
    let instance: BabylonGame;
    try {
      instance = new BabylonGame(canvasRef.current!);
      game.current = instance;
      if (import.meta.env.DEV)
        (window as Window & { __pitTest?: BabylonGame }).__pitTest = instance;
      instance.onSnapshot = (s) => {
        if (!disposed) setSnapshot(s);
      };
      instance.onResult = () => {
        if (!disposed) send('result');
      };
      instance.onEvent = (e) => {
        if (['block', 'counter', 'hit', 'sudden-death'].includes(e.type)) {
          setFeedback(
            e.type === 'sudden-death'
              ? 'SUDDEN DEATH'
              : e.type === 'hit'
                ? e.heavy
                  ? 'HEAVY HIT'
                  : ''
                : e.type.toUpperCase(),
          );
          clearTimeout(feedbackTimer.current);
          feedbackTimer.current = setTimeout(() => setFeedback(''), 850);
        }
      };
      instance
        .initialize(
          (p) => {
            if (!disposed) setProgress(p);
          },
          loadSound(),
          () => {
            if (!disposed) {
              setSound(false);
              saveSound(false);
            }
          },
        )
        .then(() => {
          if (!disposed) send('menu');
        })
        .catch((e) => {
          if (!disposed) {
            console.error(e);
            setError(
              e instanceof Error ? e.message : 'Unable to initialize the arena',
            );
            send('error');
          }
        });
    } catch (e) {
      setError(
        'WebGL could not start. Enable hardware acceleration and try again.',
      );
      send('error');
    }
    return () => {
      disposed = true;
      clearTimeout(feedbackTimer.current);
      instance?.dispose();
      game.current = null;
    };
  }, []);
  useEffect(() => {
    if (screen !== 'loading' && screen !== 'error')
      game.current?.setMode(screen);
    if (screen === 'menu' || screen === 'select')
      game.current?.showFighter(selected);
  }, [screen, selected]);
  useEffect(() => {
    if (screen !== 'intro') return;
    setCountdown(3);
    game.current?.audio?.play('beep');
    const t = setInterval(
      () =>
        setCountdown((v) => {
          if (v <= 1) {
            clearInterval(t);
            send('fight');
            return 0;
          }
          game.current?.audio?.play('beep');
          return v - 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [screen]);
  useEffect(() => {
    if (screen === 'result' && snapshot?.winner === 0 && round < 2) {
      const next = round + 1;
      setStorageNotice(!saveCheckpoint(next, rounds[next].pair[0]));
      setCheckpoint(loadSave());
    }
    if (screen === 'trophy') {
      clearSave();
      setCheckpoint(null);
    }
  }, [screen, snapshot?.winner, round]);
  const changeFighter = useCallback(
    (direction: number) => {
      if (!isShowcase) return;
      const list =
        screen === 'select'
          ? fighters.filter((f) => rounds[round].pair.includes(f.id))
          : fighters;
      setSelected(
        list[
          (list.findIndex((f) => f.id === selected) + direction + list.length) %
            list.length
        ].id,
      );
      game.current?.audio?.play('ui');
    },
    [isShowcase, screen, round, selected],
  );
  const confirm = useCallback(() => {
    game.current?.audio?.unlock();
    game.current?.audio?.play('ui');
    if (pendingSave.current) {
      setStorageNotice(!saveCheckpoint(round, selected));
      setCheckpoint(loadSave());
      pendingSave.current = false;
    }
    game.current?.startRound(round, selected);
    send('intro');
  }, [round, selected]);
  const start = useCallback(() => {
    setRound(0);
    setSelected('elon_musk');
    pendingSave.current = true;
    game.current?.audio?.unlock();
    send('select');
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (settings || howTo) return;
      if (e.code === 'Escape') {
        if (screenRef.current === 'fight') send('paused');
        else if (screenRef.current === 'paused') send('fight');
        else if (screenRef.current === 'select') send('menu');
        return;
      }
      if ((e.target as HTMLElement)?.closest('[role="dialog"],input,textarea'))
        return;
      if (e.code === 'ArrowLeft') {
        changeFighter(-1);
        return;
      }
      if (e.code === 'ArrowRight') {
        changeFighter(1);
        return;
      }
      if ((e.target as HTMLElement)?.closest('button')) return;
      if (e.code === 'Enter') {
        if (screenRef.current === 'menu') start();
        else if (screenRef.current === 'select') confirm();
      }
    };
    const blur = () => {
      if (screenRef.current === 'fight') send('paused');
    };
    const visible = () => {
      if (document.hidden) {
        blur();
        game.current?.audio?.setSuspended(true);
      } else if (screenRef.current !== 'paused')
        game.current?.audio?.setSuspended(false);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [changeFighter, confirm, start, settings, howTo]);
  function setAudio(value: boolean) {
    setSound(value);
    saveSound(value);
    game.current?.audio?.setEnabled(value);
  }
  function load() {
    const save = loadSave();
    setCheckpoint(save);
    if (!save) return;
    setRound(save.round);
    setSelected(save.fighter);
    pendingSave.current = false;
    game.current?.audio?.unlock();
    send('select');
  }
  function next() {
    if (round === 2) {
      send('trophy');
      return;
    }
    const n = round + 1;
    setRound(n);
    setSelected(rounds[n].pair[0]);
    send('select');
  }
  function rematch() {
    game.current?.startRound(round, selected);
    send('intro');
  }
  const opp = isArena ? fighterById(opponentFor(round, selected)) : null;
  return (
    <main
      className={`game-shell screen-${screen}`}
      style={{ '--fighter-accent': fighter.accent } as CSSProperties}
    >
      <div className="small-screen">
        <Monitor size={42} />
        <Brand />
        <h1>A bigger stage is required.</h1>
        <p>
          The pit is built for desktop and tablet. Open on a screen at least 768
          pixels wide.
        </p>
      </div>
      <div className="desktop-game">
        <header className="topbar">
          <Brand small />
          <div className="broadcast-label">
            <i /> UNDERGROUND FIGHT NETWORK <span> / </span> SEASON 01
          </div>
          <div className="header-actions">
            <button
              className="sound-button"
              onClick={() => setAudio(!sound)}
              aria-label={`Sound ${sound ? 'On' : 'Off'}`}
            >
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>SOUND {sound ? 'ON' : 'OFF'}</span>
            </button>
            <span className="vertical-rule" />
            <button
              className="icon-button"
              aria-label="Toggle fullscreen"
              onClick={async () => {
                try {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else await document.documentElement.requestFullscreen();
                } catch {
                  setFullscreenError(true);
                  setTimeout(() => setFullscreenError(false), 3000);
                }
              }}
            >
              <Maximize size={17} />
            </button>
          </div>
        </header>
        <div
          className={`stage ${isArena ? 'arena-stage' : ''} ${screen === 'trophy' ? 'trophy-stage' : ''}`}
        >
          <div className="ambient-grid" />
          <div className="scene-wrap">
            <canvas
              ref={canvasRef}
              aria-label="3D fighter showcase and fighting arena"
            />
          </div>
          {screen === 'loading' && (
            <div className="loading-screen">
              <span className="eyebrow">UNDERGROUND FIGHT NETWORK</span>
              <h1>
                BILLIONAIRE
                <br />
                <em>PIT.</em>
              </h1>
              <div className="loading-track">
                <i style={{ width: `${progress}%` }} />
              </div>
              <div className="loading-meta">
                <span>
                  {progress < 20
                    ? 'INITIALIZING HAVOK'
                    : progress < 80
                      ? 'LOADING COMBAT RIGS'
                      : 'CALIBRATING THE PIT'}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          )}
          {screen === 'error' && (
            <div className="center-overlay">
              <div className="overlay-card">
                <Zap size={32} />
                <span className="eyebrow">CONNECTION INTERRUPTED</span>
                <h2>THE PIT IS OFFLINE</h2>
                <p>{error}</p>
                <button
                  className="primary-button"
                  onClick={() => window.location.reload()}
                >
                  RETRY <RotateCcw size={18} />
                </button>
              </div>
            </div>
          )}
          {isShowcase && (
            <>
              <div className="stage-topline">
                <div className="live-label">
                  <i />{' '}
                  {screen === 'menu'
                    ? 'THE ARENA IS LIVE'
                    : 'FIGHTER SELECTION'}
                </div>
                <div className="tournament-route">
                  {rounds.map((r, i) => (
                    <div
                      key={r.theme}
                      className={
                        screen === 'select' && round === i ? 'active' : ''
                      }
                    >
                      <span>0{i + 1}</span>
                      {r.theme}
                      {screen === 'select' && round > i ? (
                        <Check size={12} />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <section className="menu-panel">
                {screen === 'menu' ? (
                  <>
                    <div className="edition">
                      <span>NO BOARDROOMS.</span>
                      <span>NO BAILOUTS.</span>
                    </div>
                    <h1 className="game-title">
                      BILLIONAIRE
                      <br />
                      <span>
                        PIT<span className="title-period">.</span>
                      </span>
                    </h1>
                    <p className="menu-tagline">
                      FOUR TITANS. THREE ROUNDS. ONE CHAMPION.
                    </p>
                    <div className="menu-actions">
                      <button className="primary-button" onClick={start}>
                        <span className="button-number">01</span>START GAME
                        <ArrowUpRight size={24} />
                      </button>
                      <button
                        className="menu-secondary"
                        disabled={!checkpoint}
                        onClick={load}
                      >
                        <span className="button-number">02</span>LOAD GAME
                        <span className="button-meta">
                          {checkpoint
                            ? `ROUND 0${checkpoint.round + 1}`
                            : 'NO SAVED RUN'}
                          <ArrowUpRight size={17} />
                        </span>
                      </button>
                      <button
                        className="menu-secondary"
                        onClick={() => setSettings(true)}
                      >
                        <span className="button-number">03</span>SETTINGS
                        <Settings2 size={18} />
                      </button>
                    </div>
                    <div className="menu-bottom">
                      <div className="mode-label">
                        <span className="mode-icon">
                          <Shield size={15} />
                        </span>
                        SINGLE PLAYER<span>PLAYER VS CPU</span>
                      </div>
                      <p className="parody-note">
                        A fictional, satirical showdown. Not affiliated with or
                        <br className="wide-only" /> endorsed by the people
                        depicted.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      className="back-button"
                      onClick={() => send('menu')}
                    >
                      <ChevronLeft size={14} /> BACK TO MENU
                    </button>
                    <span className="round-kicker">
                      ROUND 0{round + 1} / 03
                    </span>
                    <h1 className="select-title">
                      CHOOSE YOUR
                      <br />
                      <span>FIGHTER.</span>
                    </h1>
                    <p className="selection-description">
                      {rounds[round].label}
                      <span>Two contenders. Your call.</span>
                    </p>
                    <div className="matchup-card">
                      <span>TONIGHT’S MATCHUP</span>
                      <p>
                        {fighterById(rounds[round].pair[0]).name}
                        <b>VS</b>
                        {fighterById(rounds[round].pair[1]).name}
                      </p>
                    </div>
                    <button className="primary-button" onClick={confirm}>
                      CONFIRM FIGHTER
                      <ArrowUpRight size={24} />
                    </button>
                    <div className="selection-controls">
                      <Zap size={16} />
                      <span>
                        Money brings power.
                        <br />
                        AI brings faster reactions.
                      </span>
                    </div>
                  </>
                )}
              </section>
              <section
                className="showcase-panel"
                aria-label="Fighter carousel"
                onPointerDown={(e) => {
                  if (!(e.target as HTMLElement).closest('button'))
                    swipe.current = e.clientX;
                }}
                onPointerUp={(e) => {
                  if (
                    swipe.current !== null &&
                    Math.abs(e.clientX - swipe.current) > 45
                  )
                    changeFighter(e.clientX < swipe.current ? 1 : -1);
                  swipe.current = null;
                }}
              >
                <div className="showcase-watermark" aria-hidden="true">
                  {fighter.number}
                </div>
                <div className="fighter-status">
                  <span className="status-line" />
                  FIGHTER PROFILE
                  <span>
                    0{eligible.findIndex((f) => f.id === selected) + 1} / 0
                    {eligible.length}
                  </span>
                </div>
                <div className="fighter-callout">
                  <span className="tiny-cross">+</span>
                  <span>
                    COMBAT RIG
                    <br />
                    <b>READY TO FIGHT</b>
                  </span>
                </div>
                <div className="carousel-navigation">
                  <button
                    aria-label="Previous fighter"
                    onClick={() => changeFighter(-1)}
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    aria-label="Next fighter"
                    onClick={() => changeFighter(1)}
                  >
                    <ChevronRight size={22} />
                  </button>
                </div>
                <div className="fighter-info">
                  <div className="fighter-name">
                    <span className="eyebrow">
                      <i /> {fighter.archetype}
                    </span>
                    <h2>
                      {fighter.first} <span>{fighter.last}</span>
                    </h2>
                    <p>{fighter.quote}</p>
                  </div>
                  <div className="fighter-skills">
                    <Skill
                      label="MONEY"
                      value={fighter.money}
                      color={fighter.accent}
                    />
                    <Skill
                      label="AI"
                      value={fighter.ai}
                      color={fighter.accent}
                    />
                  </div>
                </div>
              </section>
              <div className="roster-bar">
                <div className="roster-intro">
                  <span className="eyebrow">
                    {screen === 'menu' ? 'THE CONTENDERS' : 'ELIGIBLE FIGHTERS'}
                  </span>
                  <p>
                    SELECT YOUR EDGE<span>↗</span>
                  </p>
                </div>
                <div className="roster-cards">
                  {eligible.map((f) => (
                    <button
                      className={`roster-card ${f.id === selected ? 'selected' : ''}`}
                      key={f.id}
                      onClick={() => {
                        setSelected(f.id);
                        game.current?.audio?.play('ui');
                      }}
                      aria-label={`Select ${f.name}`}
                      aria-pressed={selected === f.id}
                      style={{ '--card-accent': f.accent } as CSSProperties}
                    >
                      <span className="roster-number">{f.number}</span>
                      <Portrait fighter={f} />
                      <span className="roster-name">
                        {f.first}
                        <strong>{f.last}</strong>
                      </span>
                      <span className="roster-indicator">
                        {f.id === selected ? (
                          <Check size={13} />
                        ) : (
                          <ArrowUpRight size={12} />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {isArena && snapshot && opp && (
            <>
              <div className="fight-hud">
                <div className="fighter-hud player-hud">
                  <Portrait fighter={fighter} />
                  <div>
                    <div className="hud-name">
                      <span>YOU</span>
                      <strong>{fighter.name}</strong>
                      <b>{Math.ceil(snapshot.health[0])}</b>
                    </div>
                    <div className="health-track">
                      <i
                        style={{
                          width: `${snapshot.health[0]}%`,
                          background: fighter.accent,
                        }}
                      />
                    </div>
                    <div className="stamina-track">
                      <i style={{ width: `${snapshot.stamina[0]}%` }} />
                    </div>
                    <div className="hud-caption">
                      {fighter.archetype}
                      <span>STAMINA</span>
                    </div>
                  </div>
                </div>
                <div className="timer">
                  <span>
                    ROUND 0{round + 1} · {rounds[round].theme}
                  </span>
                  <strong className={snapshot.timer <= 10 ? 'urgent' : ''}>
                    {String(snapshot.timer).padStart(2, '0')}
                  </strong>
                  <span>
                    {snapshot.suddenDeath ? 'SUDDEN DEATH' : 'MAIN EVENT'}
                  </span>
                </div>
                <div className="fighter-hud cpu-hud">
                  <Portrait fighter={opp} />
                  <div>
                    <div className="hud-name">
                      <span>CPU</span>
                      <strong>{opp.name}</strong>
                      <b>{Math.ceil(snapshot.health[1])}</b>
                    </div>
                    <div className="health-track">
                      <i
                        style={{
                          width: `${snapshot.health[1]}%`,
                          background: opp.accent,
                        }}
                      />
                    </div>
                    <div className="stamina-track">
                      <i style={{ width: `${snapshot.stamina[1]}%` }} />
                    </div>
                    <div className="hud-caption">
                      {opp.archetype}
                      <span>STAMINA</span>
                    </div>
                  </div>
                </div>
              </div>
              {screen === 'fight' && (
                <>
                  <div className="arena-live">
                    <i /> LIVE FROM THE PIT
                  </div>
                  <button
                    className="pause-button"
                    aria-label="Pause fight"
                    onClick={() => send('paused')}
                  >
                    <Pause size={16} /> PAUSE
                  </button>
                  <div className="combat-feedback" role="status">
                    {feedback}
                  </div>
                  <TouchControls game={game.current} />
                </>
              )}
              {screen === 'intro' && (
                <div className="intro-overlay">
                  <span className="eyebrow">{rounds[round].label}</span>
                  <div className="versus">
                    <span>{fighter.last}</span>
                    <b>VS</b>
                    <span>{opp.last}</span>
                  </div>
                  <span className="countdown" key={countdown}>
                    {countdown}
                  </span>
                  <p>GET READY TO FIGHT</p>
                </div>
              )}
              {screen === 'paused' && (
                <div className="center-overlay">
                  <div className="overlay-card pause-card">
                    <span className="eyebrow">TAKE A BREATHER</span>
                    <h2>
                      FIGHT PAUSED<span>.</span>
                    </h2>
                    <p>Your corner is waiting.</p>
                    <button
                      className="primary-button"
                      onClick={() => send('fight')}
                    >
                      RESUME FIGHT
                      <Play size={20} />
                    </button>
                    <button
                      className="outline-button"
                      onClick={() => send('menu')}
                    >
                      MAIN MENU
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </div>
              )}
              {screen === 'result' && (
                <div className="result-overlay">
                  <div className="result-rule" />
                  <span className="eyebrow">ROUND 0{round + 1} COMPLETE</span>
                  <h2>{snapshot.method}</h2>
                  <div className="result-winner">
                    {snapshot.winner === 0 ? 'YOU WIN' : 'YOU LOSE'}
                    <span>
                      {snapshot.winner === 0 ? fighter.name : opp.name}
                    </span>
                  </div>
                  <p>
                    {snapshot.winner === 0
                      ? round === 2
                        ? 'The pit has a new champion.'
                        : 'One step closer to the crown.'
                      : 'Every empire takes a hit. Go again.'}
                  </p>
                  <div className="result-actions">
                    <button
                      className="primary-button"
                      onClick={snapshot.winner === 0 ? next : rematch}
                    >
                      {snapshot.winner === 0
                        ? round === 2
                          ? 'CLAIM THE TROPHY'
                          : 'NEXT ROUND'
                        : 'REMATCH'}
                      {snapshot.winner === 0 ? (
                        <ArrowRight size={20} />
                      ) : (
                        <RotateCcw size={20} />
                      )}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => send('menu')}
                    >
                      MAIN MENU
                    </button>
                  </div>
                  {storageNotice && (
                    <p className="save-notice">
                      Storage is unavailable. Keep this tab open to continue
                      your run.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {screen === 'trophy' && (
            <div className="champion-content">
              <span className="eyebrow">
                <Trophy size={16} /> THE LAST TITAN STANDING
              </span>
              <h1>
                BILLIONAIRE PIT
                <br />
                <span>CHAMPION.</span>
              </h1>
              <h2>{fighter.name}</h2>
              <p>Three rounds. One undisputed winner.</p>
              <div className="trophy-rounds">
                {rounds.map((r, i) => (
                  <span key={r.theme}>
                    <Check size={13} />0{i + 1} {r.theme}
                  </span>
                ))}
              </div>
              <button className="primary-button" onClick={start}>
                PLAY AGAIN
                <RotateCcw size={19} />
              </button>
              <button className="text-button" onClick={() => send('menu')}>
                MAIN MENU
              </button>
            </div>
          )}
        </div>
        <footer className="footer">
          <div className="footer-status">
            <i />{' '}
            {screen === 'error'
              ? 'SYSTEM OFFLINE'
              : screen === 'loading'
                ? 'SYSTEMS INITIALIZING'
                : 'ALL SYSTEMS ONLINE'}
            <span>V.1.0</span>
          </div>
          {screen === 'fight' || screen === 'paused' || screen === 'intro' ? (
            <div className="control-strip">
              {controls.map(([key, label]) => (
                <span key={key}>
                  <kbd>{key}</kbd>
                  {label}
                </span>
              ))}
              <span className="heavy-hint">SHIFT + J/K: HEAVY</span>
            </div>
          ) : (
            <div className="footer-hint">
              <kbd>←</kbd>
              <kbd>→</kbd> CHANGE FIGHTER<span>·</span>
              <kbd>ENTER</kbd> {screen === 'select' ? 'CONFIRM' : 'SELECT'}
            </div>
          )}
          <button
            className="help-button"
            onClick={() => {
              if (screen === 'fight') send('paused');
              setHowTo(true);
            }}
          >
            <CircleHelp size={15} /> HOW TO PLAY
          </button>
        </footer>
      </div>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="settings-dialog" showCloseButton={false}>
          <button
            className="dialog-close"
            aria-label="Close settings"
            onClick={() => setSettings(false)}
          >
            <X size={20} />
          </button>
          <span className="eyebrow">YOUR CORNER</span>
          <DialogTitle>
            SETTINGS<span>.</span>
          </DialogTitle>
          <DialogDescription>
            Make yourself at home in the pit.
          </DialogDescription>
          <div className="sound-setting">
            <div>
              <Volume2 size={20} />
              <label htmlFor="sound-switch">
                Sound<span>Music, arena atmosphere and combat effects</span>
              </label>
            </div>
            <Switch
              id="sound-switch"
              className="sound-switch"
              checked={sound}
              onCheckedChange={setAudio}
            />
            <b>{sound ? 'ON' : 'OFF'}</b>
          </div>
          <button className="primary-button" onClick={() => setSettings(false)}>
            BACK TO THE PIT
            <ArrowRight size={20} />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={howTo} onOpenChange={setHowTo}>
        <DialogContent
          className="settings-dialog controls-dialog"
          showCloseButton={false}
        >
          <button
            className="dialog-close"
            aria-label="Close how to play"
            onClick={() => setHowTo(false)}
          >
            <X size={20} />
          </button>
          <span className="eyebrow">KNOW YOUR MOVES</span>
          <DialogTitle>
            FIGHT SMART<span>.</span>
          </DialogTitle>
          <DialogDescription>
            Win by knockout or finish the 60-second round with more health. A
            tie starts sudden death.
          </DialogDescription>
          <div className="control-guide">
            {controls.map(([key, label]) => (
              <div key={key}>
                <kbd>{key}</kbd>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="howto-tip">
            <Zap size={18} />
            Hold SHIFT with J or K for a heavy strike. Watch your stamina. Dodge
            an attack, then strike quickly for a counter bonus.
          </p>
          <div className="stat-guide">
            <span>
              <Shield size={16} /> MONEY = POWER & GUARD
            </span>
            <span>
              <Cpu size={16} /> AI = REACTIONS & COUNTERS
            </span>
          </div>
          <button className="primary-button" onClick={() => setHowTo(false)}>
            GOT IT
            <Check size={20} />
          </button>
        </DialogContent>
      </Dialog>
      {fullscreenError && (
        <div className="toast" role="status">
          Fullscreen is unavailable in this browser view.
        </div>
      )}
    </main>
  );
}

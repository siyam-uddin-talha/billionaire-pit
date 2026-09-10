# Billionaire Pit

A desktop/tablet cyberpunk MMA parody game built from the supplied architecture blueprint. React + TypeScript + Vite own the interface; Babylon.js renders the arena and Blender GLBs; Havok Physics V2 reports attack contacts; Babylon Sound owns audio playback.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Minimum supported viewport: 768 × 600. No accounts, purchases, or server storage. Sound settings and tournament checkpoints stay in this browser.

## Play

- A/D or left/right arrows: move. W/S: step in depth.
- J: light punch. K: front kick. Shift+J / Shift+K: heavy attacks.
- Hold L: block. Space: dodge. Escape: pause.
- Touch-capable tablets have a movement pad and simultaneous action buttons.

Win by knockout or more health after 60 seconds. Equal health starts a 15-second sudden-death period. Win Money (Elon Musk vs Mark Zuckerberg), AI (Dario Amodei vs Sam Altman), then Final Convergence between the actual winners of those rounds. Win each opening round to advance; losses offer a rematch, and checkpoints retain both finalists. Choose either eligible fighter in each round. Normal results depend on play; canonical outcomes are optional narrative configuration in `src/data/rounds.ts`.

## Structure

- `src/app/App.tsx`: React screens, selection, HUD, settings, touch controls, and tournament progression.
- `src/game`: explicit screen transitions, common input commands, shared Fighter class, fixed-step combat, seeded variation, CPU perception and decisions.
- `src/engine`: Babylon scene/lifecycle, GLB instancing and animation blending, Havok capsules and attack triggers, pooled particles, audio loading.
- `src/services/SaveService.ts`: versioned and validated local checkpoints and settings; safely handles blocked storage.
- `scripts/build_assets.py`: reproducible original Blender models, shared 16-joint rig, 12 animation clips, arena, trophy, and portraits. `scripts/fighter-source.blend` is the editable base.
- `scripts/build_head.py`: per-person head contours, facial landmarks, closed scalp/jaw geometry, shaped ears, and texture/skin alignment. `scripts/render_head_qa.py` checks closed geometry, weights and UVs, then renders three angles of every head.
- `scripts/build_upper_body.py`: welded chest, neck, shoulder and arm geometry with anatomical relief and blended joint weights.
- `scripts/build_lower_body.py`: continuous tapered legs, blended knee/ankle weights, and fitted shorts. Mesh, skeleton and attack targets share an adult-proportion mapping with longer legs and reduced head/hand/shoulder bulk.
- `scripts/build_audio.py`: original synthetic sound design: short arcade-style impact, guard, movement and round cues; no looping background audio. No third-party voice recordings are used.

React sends commands to the engine. Combat runs at 60 Hz with bounded catch-up. Havok steps exactly once per simulation step; trigger membership controls hit detection. A pure rules fallback supports simulation tests. CPU decisions use delayed visible-world snapshots, never input events. All four fighters use the same rig and runtime class. Loaded asset containers, instances, sounds and bodies are disposed on teardown; particle allocation is bounded.

## Validate

```sh
npm test
npm run test:e2e  # start npm run dev first
npm run build
```

Playwright defaults to the installed macOS Chrome application; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for another Chromium install. Unit tests cover attack phases, single hits, misses, guard, stamina, counters, KO/decision, seeded outcomes, eligibility, save validation, screen guards, and real Havok contacts. Browser tests cover input, pause, settings persistence, checkpoints, full tournament progression, trophy flow, and responsive boundaries. The win-boundary fixture exists only in Vite development builds and is removed from production.

## Asset provenance and limits

Fighters are original, stylized caricatures authored programmatically in Blender, approximately 55k triangles each. Each closed head is fitted to its own generated likeness, with facial relief aligned to the nose and eyes, a connected scalp and jaw, and shaped ears. The unchanged atlas supplies the facial detail, scalp colors and matching body skin tone. These fictional likenesses use approximate side geometry derived from frontal references. Punches and kicks use Blender joint targets, torso rotation, strike extension, and recovery. The arena and trophy are Blender GLBs. Included audio is synthesized, using short effects rather than continuous background loops or spoken announcer lines. Fonts use Google Fonts with system fallbacks.

The implementation is playable and tested locally. A broad cross-browser/device performance certification, final character art/animation polish, recorded voice/crowd production, and the blueprint's commercial-release legal review remain separate release work. Fictional and satirical; no affiliation or endorsement is implied.

Arm contours run continuously from chest to wrist. Waistbands share each fighter’s abdominal profile; the neck is slightly shortened with matching skeleton and target adjustments.

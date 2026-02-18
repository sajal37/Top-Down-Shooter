# Survivor Shooter - Detailed Project Information

## 1) Document Purpose
This file is a full technical reference for the project so it can be repurposed into different resume narratives without re-reading the whole codebase each time. It is intentionally detailed and factual. It is not written as final resume bullet points.

Primary use:
- Extract role-specific resume content (frontend-heavy, gameplay-heavy, performance-heavy, architecture-heavy, product-focused, etc.).
- Provide direct evidence (files, systems, behaviors, constants, formulas) behind each claim.

## 2) Project Identity
Project name: `survivor-shooter`  
Repository: `https://github.com/sajal37/Top-Down-Shooter.git`  
Author field: `sajal37`  
Type: Browser game, top-down arena survivor shooter  
Language: TypeScript (strict mode)  
Rendering: HTML5 Canvas 2D  
Audio: Web Audio API (procedural tones)  
Persistence: `localStorage`  
Runtime dependencies: none  
Dev dependencies: `typescript` only

## 3) Problem and Product Goal
The project implements an endless survival loop where pressure rises over time through spawn scaling, enemy variety, and boss milestones. The player must stay alive by moving, aiming, shooting, dashing, collecting XP and health drops, and choosing upgrades at level-ups.

Core loop outcome:
- Create short, replayable sessions with increasing intensity.
- Reward aggressive and skillful play via combo-based XP bonuses.
- Support both desktop and mobile input paths.

## 4) Runtime and Build Setup
### Entry and startup
- `index.html` mounts `<canvas id="gameCanvas"></canvas>` and loads `dist/main.js` as an ES module.
- `src/main.ts` listens for `DOMContentLoaded`, creates `Game`, and starts the loop.

### TypeScript config
`tsconfig.json`:
- `target`: `ES2020`
- `module`: `ES2020`
- `moduleResolution`: `node`
- `rootDir`: `./src`
- `outDir`: `./dist`
- `strict`: `true`
- `sourceMap`: `true`
- `skipLibCheck`: `true`

### Scripts
`package.json` scripts:
- `npm run build` -> `tsc`
- `npm run watch` -> `tsc --watch`

### Styling
`style.css` is minimal:
- Fullscreen canvas layout (`html/body` 100% width/height).
- Hidden overflow.
- Black page background.
- Crosshair cursor on canvas.

## 5) Source Layout and Responsibilities
### Engine layer
- `src/engine/Game.ts`: orchestration, state machine, update/render loop, system wiring.
- `src/engine/Input.ts`: keyboard/mouse input tracking + focus-loss behavior.
- `src/engine/Audio.ts`: procedural SFX + sound toggle.
- `src/engine/Camera.ts`: smooth follow + shake + arena clamping.
- `src/engine/ParticleSystem.ts`: particles and death rings.
- `src/engine/ObjectPool.ts`: generic pool utility (currently not actively wired in game flow).
- `src/engine/Utils.ts`: constants, enums, difficulty config, helper math.

### Entity layer
- `src/entities/Player.ts`: movement, shooting, dash, i-frames, upgrades, combo.
- `src/entities/Enemy.ts`: enemy AI variants and rendering.
- `src/entities/Bullet.ts`: projectile movement, trail rendering, ownership flag.
- `src/entities/Pickup.ts`: XP and health drops with magnet-style attraction.

### Systems layer
- `src/systems/Spawner.ts`: spawn pacing, enemy mix, boss milestones, density-aware placement.
- `src/systems/Collision.ts`: collision checks, spatial broad-phase, gameplay hit outcomes.

### UI layer
- `src/ui/HUD.ts`: in-game stats overlay + clickable sound/fullscreen buttons.
- `src/ui/Menu.ts`: start/pause/level-up/game-over/how-to-play screens.
- `src/ui/TouchControls.ts`: virtual joystick/shoot/dash controls for touch devices.
- `src/ui/DamageNumbers.ts`: floating damage text.
- `src/ui/ScreenEffects.ts`: red damage vignette + white muzzle flash.

## 6) High-Level Game Loop and State Machine
The loop in `Game.ts`:
1. Compute `dt` from `requestAnimationFrame` timestamp delta.
2. Clamp `dt` to `MAX_DT` (`0.05`) to prevent extreme simulation jumps.
3. `update(dt)`.
4. `render()`.
5. Clear per-frame input via `input.endFrame()`.
6. Request next animation frame.

State enum (`GameState`):
- `StartMenu`
- `Playing`
- `Paused`
- `LevelUp`
- `GameOver`
- `HowToPlay`

Key transitions:
- Start menu -> playing via "START GAME".
- Start menu -> how-to-play.
- Playing <-> paused via `Escape`.
- Playing -> level-up when XP threshold hit.
- Playing -> game-over when player dies.
- Pause/game-over -> restart or menu paths.

Focus safety:
- On `document.hidden` or window blur, input sets `focusLost=true`.
- `Game.update` auto-pauses if focus is lost during `Playing`.

## 7) World Model and Coordinate Systems
World arena dimensions:
- Width: `3000`
- Height: `2000`

Camera model:
- Camera tracks player with lerp-like follow (`CAMERA_FOLLOW_SPEED = 8`).
- Screen-to-world conversion is done for mouse aiming.
- Rendering uses camera translation:
  - `offsetX = canvasWidth/2 - camera.x + shakeOffsetX`
  - `offsetY = canvasHeight/2 - camera.y + shakeOffsetY`

World boundary enforcement:
- Player and enemies are clamped inside arena.
- Bullets are invalidated outside arena with buffer.

## 8) Input System Details
`Input.ts` tracks:
- Held keys (`keysDown`).
- Per-frame key press events (`keysJustPressed`).
- Mouse position in internal canvas pixels.
- Mouse held state and per-frame click flags.
- Right mouse held and per-frame press.

Controls are normalized to lowercase key strings.

Default-prevented keys:
- Space, escape, and arrow keys.

End-of-frame cleanup:
- `keysJustPressed.clear()`
- `mouseJustPressed = false`
- `rightMouseJustPressed = false`
- `focusLost = false`

## 9) Audio System Details
`Audio.ts` behavior:
- Lazily initializes `AudioContext` on first sound call to satisfy browser interaction policies.
- Global enable flag with master gain muting (`0.3` when enabled, `0` when disabled).
- Sound generation uses oscillators (`square`, `sawtooth`, `sine`, `triangle`) and exponential gain ramps.

Implemented SFX methods:
- Player actions: shoot, dash, level-up, death.
- Combat events: hit, pickup, explosion, combo.
- Additional methods exist for boss roar and enemy shoot.

Note:
- `playBossRoar()` and `playEnemyShoot()` are defined but not currently invoked in `Game.ts`/`Enemy.ts`.

## 10) Player System (Gameplay Core)
`Player.ts` responsibilities:
- Movement using keyboard or touch joystick.
- Aim direction from mouse/world coordinates.
- Auto-fire while shoot input is held.
- Dash with cooldown and temporary invulnerability.
- XP/level progression and upgrade application.
- Combo tracking and XP multiplier return.

Baseline stats are difficulty-driven (`BalanceConfig`):
- Max health
- Move speed
- Fire rate
- Damage
- Bullet speed
- Dash cooldown
- Pickup attraction radius

Dash behavior:
- Trigger: Space, right-click, or touch dash button.
- Dash duration: `0.15s`
- Dash speed: `800 px/s`
- Invulnerability during dash plus short extension.
- Cannot shoot while actively dashing.

Shooting behavior:
- Fire cadence controlled by `shootTimer`.
- Bullets per shot: `1 + 2*spreadLevel` (1, 3, 5, 7).
- Spread angle step: `0.15 rad`.
- Pierce property inherited from player `pierceLevel`.
- Muzzle position recorded for particle and screen flash triggers.

Leveling formula:
- `xpToNextLevel = level * xpPerLevelMult + xpPerLevelBase`
- On level-up: XP reduced by required amount, `level++`, level-up sound plays.

Combo model:
- Each kill increments combo count and resets combo timer.
- XP multiplier:
  - `1 + (comboCount - 1) * comboXpBonus`
- Combo resets to base when timer expires.

## 11) Enemy System Details
`Enemy.ts` supports 6 types:
- `Basic`
- `Fast`
- `Tank`
- `Boss`
- `Ranged`
- `Exploder`

Per-type base definitions include radius, speed, HP, damage, color, XP value, and polygon side count.

Type behavior:
- Basic/Fast/Tank/Boss: straightforward pursuit.
- Ranged:
  - Prefers distance around `250 px`.
  - Backs away if too close, advances if too far.
  - Fires projectile when timer is ready and player within `500 px`.
- Exploder:
  - Pursues player.
  - Gains speed multiplier near player.
  - On death, used by collision system to apply area damage checks.

Difficulty scaling is applied at spawn:
- Speed scaling: base * per-type multiplier * `(1 + difficultyScale * enemySpeedScale)`
- HP scaling: base * per-type multiplier * `(1 + difficultyScale * enemyHpScale)` then ceiling
- Damage scaling: base * per-type damage multiplier then ceiling

Damage response:
- White flash timer (`0.1s`) for hit feedback.
- HP bars render when damaged.

## 12) Bullet System Details
`Bullet.ts` features:
- Straight-line motion with velocity.
- Ownership flag (`isEnemyBullet`) to distinguish source.
- Pierce counter (`pierceLeft`) for player bullet pass-through behavior.
- Trail rendering using recent positions.

Trail implementation:
- Stores up to 6 previous points.
- Draws fading line segments with alpha/width gradient.

Out-of-bounds policy:
- Bullet marked dead if outside arena with `50px` buffer.

Visual differentiation:
- Player bullets: white/yellow styling.
- Enemy bullets: red/orange styling.

## 13) Pickup System Details
`Pickup.ts` supports:
- XP pickups.
- Health pickups.

Rules:
- Lifetime: `30s` then despawn.
- Bob animation around base Y position.
- Attraction toward player when within player pickup radius.
- Attraction speed: `300 px/s`.

Rendering:
- XP: glowing rotated diamond.
- Health: red circle with white cross.

## 14) Spawner System Details
`Spawner.ts` tracks elapsed run time and controls spawn pressure.

Key mechanics:
- Spawn interval shrinks over time:
  - `max(minSpawnInterval, baseSpawnInterval - elapsedTime * spawnIntervalDecay)`
- Spawn count per tick grows over time:
  - `1 + floor(elapsedTime / spawnCountDivisor)` clamped by `maxSpawnPerTick`.
- Danger level:
  - `min(10, floor(elapsedTime / dangerPeriod) + 1)`

Boss milestones:
- Boss spawns when danger level hits multiples of `bossInterval`.
- Uses `lastBossDangerLevel` guard to avoid duplicates.

Enemy type mix:
- Early phase: mostly Basic/Fast.
- Mid phase: introduces Tank/Ranged/Exploder.
- Late phase: heavier dangerous mix.

Spawn positions:
- Spawned just outside camera view from random edge.
- Clamped into arena bounds.

Density-aware spawning:
- Up to 3 candidate points evaluated.
- Chooses candidate with fewest nearby existing enemies.
- Nearby test radius: `150px` (squared distance threshold).

Entity cap policy:
- Uses `bal.maxEnemies` headroom check before regular spawning.

## 15) Collision System Details
`Collision.ts` centralizes per-frame collision resolution and returns a reusable result object.

Checks performed:
1. Player bullet vs enemy.
2. Enemy bullet vs player.
3. Enemy contact vs player.
4. Exploder death area damage vs player.
5. Pickup collection vs player.

Spatial broad phase:
- Uses a grid (`SpatialGrid`) for enemies only.
- Cell size from `SPATIAL_CELL_SIZE` (`120`).
- Grid built each frame from alive enemies.
- Bullet and player checks query nearby enemy cells before exact overlap tests.

Memory-conscious behavior:
- `CollisionResult` object and arrays are reused each frame (length reset).

Hit side effects communicated back to `Game`:
- Whether player was hit.
- Killed enemies list.
- XP/health gains.
- Exploder deaths.
- Enemy hit positions for damage numbers.
- Hit positions/colors for particle effects.

Combat details:
- Bullet pierce decremented on each enemy hit.
- If no pierce left, bullet dies.
- Enemy contact damage respects enemy-specific contact cooldown.
- Player invulnerability state gates enemy-bullet damage path.

## 16) Visual Effects Systems
### Particle system (`ParticleSystem.ts`)
- Manages generic particles and death rings.
- Uses swap-and-pop removal for O(1) delete cost.
- Provides specialized spawners:
  - hit sparks
  - death bursts
  - death ring
  - muzzle flash

### Damage numbers (`DamageNumbers.ts`)
- Floating text rises and fades over `0.8s`.
- Font size scales by damage amount.
- Rendered in world space.

### Screen effects (`ScreenEffects.ts`)
- Red vignette triggered on player damage.
- White flash triggered on muzzle events.
- Rendered in screen space after world rendering.

## 17) HUD and Menu UX Details
### HUD (`HUD.ts`)
Displays:
- HP bar and XP bar.
- Level and kill count.
- Combo state (when active).
- Survival timer.
- Danger level and bar.
- FPS counter (updated every 0.5s window).
- Sound and fullscreen UI buttons.
- Weapon/stat info panel.
- Dash readiness/cooldown.

### Menu (`Menu.ts`)
Screens:
- Start menu with difficulty cards.
- How-to-play reference screen.
- Pause overlay with resume/restart/quit.
- Level-up cards with hover and keyboard hints.
- Game-over with run stats and highscores.

UI interaction model:
- Menus register rectangular click regions each frame.
- `handleClick` maps click coordinates to action strings.

Difficulty selector UX:
- 4 cards (Easy/Normal/Hard/Nightmare).
- Selected card highlighted.
- Descriptions and theme colors rendered from shared constants.

## 18) Touch Controls (Mobile Support)
`TouchControls.ts` activates on touch-capable devices.

Input zones:
- Left side (40% width): movement joystick.
- Bottom-right area: dash button.
- Remaining right area: shoot + aim control.

Joystick behavior:
- Knob constrained within joystick radius (`60`).
- Outputs normalized axis values in range `[-1, 1]`.

Per-frame flag:
- `dashJustPressed` reset by `endFrame()`.

Overlay rendering:
- Joystick base/knob when active.
- Dash hint button in bottom-right.

## 19) Game Rendering Pipeline Order
Within `Game.render()`:
1. Clear canvas background.
2. If start/how-to-play: render only menu UI and return.
3. Apply camera transform.
4. Render world background grid.
5. Render decorative debris.
6. Render arena border.
7. Render pickups.
8. Render enemies.
9. Render enemy bullets.
10. Render player bullets.
11. Render particles and death rings.
12. Render floating damage numbers.
13. Render player.
14. Restore transform.
15. Render screen-space effects.
16. Render state-specific HUD/menu overlays.
17. Render touch controls when in playing state.

This ordering ensures readable depth layering and clear combat feedback.

## 20) Persistence and Data Lifecycles
Save key:
- `survivor_shooter_save`

Persisted fields:
- Best survival time
- Best kills
- Best level

Persistence flow:
- Save data loaded on game construction.
- On game over, if any run metric beats stored best, write to `localStorage`.
- Parsing/writing wrapped in `try/catch` with silent fallback.

## 21) Difficulty System and Balance Configuration
The project uses one `BalanceConfig` per difficulty preset (`Easy`, `Normal`, `Hard`, `Nightmare`). Config drives player stats, upgrade multipliers, leveling rate, combo tuning, spawn pacing, enemy scaling, and enemy subtype parameters.

### Player baselines by difficulty
Easy:
- HP 8, speed 230, fire rate 4, damage 1.5, bullet speed 550, dash CD 2, invuln 1.5, pickup radius 160

Normal:
- HP 5, speed 200, fire rate 3, damage 1, bullet speed 500, dash CD 3, invuln 1.0, pickup radius 100

Hard:
- HP 4, speed 190, fire rate 2.5, damage 1, bullet speed 480, dash CD 3.5, invuln 0.7, pickup radius 80

Nightmare:
- HP 3, speed 175, fire rate 2, damage 1, bullet speed 450, dash CD 4.5, invuln 0.4, pickup radius 60

### Spawn pacing by difficulty
Easy:
- Base interval 3.0, min 0.6, decay 0.008, max per tick 3, max enemies 120, danger period 40, boss every 8 levels

Normal:
- Base interval 2.0, min 0.3, decay 0.015, max per tick 5, max enemies 200, danger period 30, boss every 5 levels

Hard:
- Base interval 1.5, min 0.2, decay 0.02, max per tick 6, max enemies 250, danger period 25, boss every 4 levels

Nightmare:
- Base interval 1.0, min 0.12, decay 0.03, max per tick 8, max enemies 350, danger period 20, boss every 3 levels

### Enemy scaling pressure by difficulty
Easy:
- Speed scale 0.08, HP scale 0.15, contact cooldown 0.8

Normal:
- Speed scale 0.15, HP scale 0.3, contact cooldown 0.5

Hard:
- Speed scale 0.2, HP scale 0.4, contact cooldown 0.35

Nightmare:
- Speed scale 0.25, HP scale 0.5, contact cooldown 0.2

### Ranged/Exploder tuning by difficulty
Easy:
- Ranged fire 0.8, ranged bullet speed 140, explode radius 60, explode speed boost 1.2

Normal:
- Ranged fire 1.5, ranged bullet speed 200, explode radius 80, explode speed boost 1.5

Hard:
- Ranged fire 2.2, ranged bullet speed 260, explode radius 100, explode speed boost 1.8

Nightmare:
- Ranged fire 3.0, ranged bullet speed 320, explode radius 120, explode speed boost 2.0

### Phase boundaries by difficulty
Easy:
- Early ends at 50s, mid ends at 120s

Normal:
- Early ends at 30s, mid ends at 90s

Hard:
- Early ends at 20s, mid ends at 60s

Nightmare:
- Early ends at 12s, mid ends at 40s

## 22) Upgrade Catalog
Upgrade definitions are in `UPGRADES` (`Utils.ts`), with `UpgradeId` used in player logic.

Available upgrades:
- Damage Up (max 5)
- Fire Rate Up (max 5)
- Speed Up (max 5)
- Max Health Up (max 5)
- Bullet Speed Up (max 5)
- Spread Shot (max 3)
- Pierce (max 3)
- Dash CDR (max 3)

Selection process:
- On level-up, game samples up to 3 random non-maxed upgrades.
- If all upgrades maxed, level-up screen is skipped.

## 23) Performance-Oriented Techniques Present
Implemented techniques:
- Delta-time clamping (`MAX_DT`) to stabilize simulation spikes.
- Spatial broad-phase grid for enemy collision pruning.
- Reused collision result object and arrays across frames.
- Swap-and-pop removals for dead entities and expired visual objects.
- Hard caps on bullets, enemy bullets, pickups, and enemy counts.
- Density-aware spawn point choice to avoid pathological clustering.

Potentially intended but not currently integrated:
- Generic `ObjectPool<T>` exists and `Bullet`/`Pickup` have `init(...)` methods, but regular game flow currently uses `new` allocations for bullets and pickups.

## 24) Engineering and Code-Quality Characteristics
Strengths:
- Strict TypeScript with clear module boundaries.
- Heavy use of named constants over inline magic numbers.
- Helpful file headers and inline comments for intent.
- Well-scoped classes with explicit responsibilities.
- Clear update/render separation and deterministic state transitions.
- Difficulty tuning centralized in one config model.

Structural quality signals:
- Reusable utility math functions.
- Typed enums for game states and entity categories.
- UI/event logic mostly isolated from simulation.

## 25) Resume-Relevant Evidence Areas (Raw Facts)
This section is intentionally not bullet-style resume writing. It is a fact index that can be transformed into bullets per role.

### Frontend/UI engineering evidence
- Entire UI rendered manually on Canvas with layout math.
- Multiple overlay screens with hover states and click hitboxes.
- Responsive fullscreen canvas resize handling.
- Separate screen-space and world-space render phases.
- Touch/mobile adaptation with multitouch partitioning.

### Real-time systems/gameplay engineering evidence
- Continuous fixed-style simulation with variable `dt` clamp.
- Explicit finite state machine and transition logic.
- Separate entities, systems, and engine services.
- Enemy AI variants and runtime behavior switching.
- Progression loop with XP economy and upgrade randomization.

### Performance engineering evidence
- Spatial partitioning for collision broad-phase.
- Allocation-aware collision result reuse.
- O(1)-style deletion via swap-and-pop.
- Entity caps and spawn density checks for scalability control.

### Product/game design evidence
- Four difficulty presets with broad tuning coverage.
- Combo mechanic designed for risk-reward pacing.
- Distinct enemy archetypes with escalating threat profiles.
- How-to-play surface includes strategy guidance and build ideas.

### Platform and accessibility evidence
- Desktop + touch controls.
- Audio toggle and fullscreen toggle.
- Pause on focus loss to prevent unfair deaths.

## 26) Known Gaps, Mismatches, and Risks
These are factual observations useful for interview discussion or future polishing.

1. HUD action string mismatch:
- `HUD.handleClick()` returns `toggleSound` / `toggleFullscreen`.
- `Game.updateMenuInput()` checks for `sound` / `fullscreen`.
- Result: HUD buttons may not trigger intended actions.

2. Object pooling status:
- `ObjectPool.ts` and `init(...)` reset methods exist.
- Current entity creation paths still allocate with `new`.
- README claims object pooling as active optimization; code appears partial/incomplete on this point.

3. Unused audio methods:
- `playBossRoar()` and `playEnemyShoot()` are implemented but not called.

4. Potential ranged edge case:
- Ranged shot velocity divides by distance (`len`) during firing.
- If `len` is extremely close to zero, this can be unstable.

5. No automated tests/CI in repository:
- No unit/integration tests.
- No lint/test scripts in package.json.

## 27) Suggested Positioning Strategy (Information-Level, Not Bullets)
For role-specific adaptation later:
- Frontend/UI role: emphasize Canvas UI architecture, input handling, rendering layers, responsive behavior, touch support.
- Game/real-time role: emphasize state machine, AI behaviors, progression, spawn algorithms, collision design.
- Systems/performance role: emphasize spatial partitioning, memory reuse patterns, entity caps, complexity control.
- Product-focused role: emphasize difficulty balancing framework, onboarding screen design, session persistence, feedback systems.

## 28) Fast Reference Map
Core orchestration:
- `src/engine/Game.ts`

Balancing and constants:
- `src/engine/Utils.ts`

Input and controls:
- `src/engine/Input.ts`
- `src/ui/TouchControls.ts`

Combat and entities:
- `src/entities/Player.ts`
- `src/entities/Enemy.ts`
- `src/entities/Bullet.ts`
- `src/entities/Pickup.ts`

Systems:
- `src/systems/Collision.ts`
- `src/systems/Spawner.ts`

UI and feedback:
- `src/ui/HUD.ts`
- `src/ui/Menu.ts`
- `src/ui/ScreenEffects.ts`
- `src/ui/DamageNumbers.ts`

Rendering boot and page setup:
- `src/main.ts`
- `index.html`
- `style.css`

## 29) One-Paragraph Technical Summary
This project is a strict-TypeScript, no-framework browser shooter that implements a complete game loop with state management, Canvas rendering, configurable difficulty balancing, multi-type enemy AI, progression and upgrade systems, touch and desktop controls, and performance-minded collision/spawn strategies. The codebase is organized into engine/entity/system/UI layers, with most gameplay tunables centralized in a single balance model for maintainability and rapid iteration.

## 30) Proven Metrics (Code-Verified)
All numbers below are directly verifiable from the current repository code/config. These are not estimated.

### Codebase size and structure
- TypeScript source files: `19`
- Total TypeScript lines: `4590`
- Largest TypeScript files by line count:
  - `src/engine/Game.ts`: `796`
  - `src/ui/Menu.ts`: `622`
  - `src/engine/Utils.ts`: `536`
  - `src/entities/Player.ts`: `418`
  - `src/entities/Enemy.ts`: `361`

### Core gameplay scope
- Enemy types implemented: `6` (`Basic`, `Fast`, `Tank`, `Boss`, `Ranged`, `Exploder`)
- Upgrade types implemented: `8`
- Difficulty presets implemented: `4`
- Game states implemented: `6`

### World and spatial partitioning
- Arena dimensions: `3000 x 2000`
- Arena area: `6,000,000` square world units
- Spatial collision cell size: `120`
- Spatial grid dimensions:
  - Columns: `26`
  - Rows: `18`
  - Total preallocated cells: `468`

### Runtime caps and worst-case object counts
- Max player bullets: `500`
- Max enemy bullets: `200`
- Max pickups: `300`
- Max enemies by difficulty:
  - Easy: `120`
  - Normal: `200`
  - Hard: `250`
  - Nightmare: `350`
- Worst-case dynamic entity cap across difficulties (player + bullets + enemy bullets + pickups + max enemies): `1351`

### Combat and progression quantification
- Maximum bullets fired per single shot at max spread: `7` (1 + 2*3)
- Combo timeout range across difficulties: `1.0s` to `3.0s`
- Combo XP bonus per chain step range: `+10%` to `+35%`
- XP requirement formula: `xpToNextLevel = level * xpPerLevelMult + xpPerLevelBase`

### Spawn pacing quantification
- Danger level cap: `10`
- Danger period range by difficulty: `20s` to `40s` per level
- Boss cadence by difficulty (dangerPeriod * bossInterval):
  - Easy: `320s`
  - Normal: `150s`
  - Hard: `100s`
  - Nightmare: `60s`
- Spawn interval bounds by difficulty:
  - Easy: `3.0s` down to `0.6s`
  - Normal: `2.0s` down to `0.3s`
  - Hard: `1.5s` down to `0.2s`
  - Nightmare: `1.0s` down to `0.12s`

### Input, rendering, and persistence
- Touch input zones used: `3` (movement, dash, aim/shoot)
- Save fields persisted to localStorage: `3` (`bestTime`, `bestKills`, `bestLevel`)
- FPS display update window: `0.5s`

### Important metric caveat
- The repository does not currently include benchmark logs (for frame time, memory, or throughput), so performance claims here are code-architecture metrics and hard limits, not measured runtime benchmarks.

// =============================================
// Game.ts — Core game loop, state machine, entity management
//
// Integrates all 25 improvements:
//   #1  Object pooling (bullet/pickup reuse)
//   #2  Spatial grid collision (via Collision.ts)
//   #3  Reusable CollisionResult (via Collision.ts)
//   #4  ParticleSystem class
//   #6  Extracted Camera, ParticleSystem, DamageNumbers, ScreenEffects
//   #7  Named constants throughout
//   #8  Boss enemies at danger milestones
//   #9  Ranged + Exploder enemies, enemy bullets
//   #10 Kill combo / XP multiplier
//   #11 Floating damage numbers
//   #12 Red vignette screen effect on hit
//   #13 Muzzle flash particles
//   #14 Bullet trails (via Bullet.ts)
//   #15 Enemy death ring animation (via ParticleSystem)
//   #16 Polygon enemy shapes (via Enemy.ts)
//   #17 Dynamic background debris
//   #19 Sound toggle (M key + HUD button)
//   #20 Fullscreen toggle (F key + HUD button)
//   #21 Mobile/touch support
//   #22 FPS counter (via HUD.ts)
//   #23 Pause on focus loss
//   #24 Max entity caps
//   #25 Spawner density check (via Spawner.ts)
//
// The loop strictly separates update(dt) and render() phases.
// =============================================

import { Input } from "./Input.js";
import { Audio } from "./Audio.js";
import { CameraController } from "./Camera.js";
import { ParticleSystem } from "./ParticleSystem.js";
import {
  GameState,
  SaveData,
  UpgradeOption,
  Debris,
  UPGRADES,
  clamp,
  randFloat,
  randInt,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  MAX_DT,
  TWO_PI,
  GRID_SIZE,
  DEBRIS_COUNT,
  MAX_BULLETS,
  MAX_PICKUPS,
  MAX_ENEMY_BULLETS,
  EnemyType,
  Difficulty,
  BalanceConfig,
  getBalanceConfig,
  DIFFICULTY_NAMES,
} from "./Utils.js";
import { Player } from "../entities/Player.js";
import { Enemy } from "../entities/Enemy.js";
import { Bullet } from "../entities/Bullet.js";
import { Pickup, PickupType } from "../entities/Pickup.js";
import { Spawner } from "../systems/Spawner.js";
import { Collision } from "../systems/Collision.js";
import { HUD } from "../ui/HUD.js";
import { Menu } from "../ui/Menu.js";
import { DamageNumberSystem } from "../ui/DamageNumbers.js";
import { ScreenEffects } from "../ui/ScreenEffects.js";
import { TouchControls } from "../ui/TouchControls.js";

// --- Constants (#7) ---
const SAVE_KEY = "survivor_shooter_save";

export class Game {
  // ---- Canvas / rendering ----
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // ---- Core engine ----
  private input: Input;
  private audio: Audio;

  // ---- State machine ----
  private state: GameState = GameState.StartMenu;
  private lastTime: number = 0;

  // ---- Camera (#6 — extracted) ----
  private camera: CameraController;

  // ---- Entities ----
  private player: Player;
  private bullets: Bullet[] = []; // player bullets
  private enemyBullets: Bullet[] = []; // enemy projectiles (#9)
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];

  // ---- Visual systems (#4, #11, #12, #13) ----
  private particleSystem: ParticleSystem;
  private damageNumbers: DamageNumberSystem;
  private screenEffects: ScreenEffects;

  // ---- Systems ----
  private spawner: Spawner;
  private collision: Collision;

  // ---- UI ----
  private hud: HUD;
  private menu: Menu;
  private touchControls: TouchControls;

  // ---- Difficulty / balance ----
  private difficulty: Difficulty = Difficulty.Normal;
  private bal: BalanceConfig = getBalanceConfig(Difficulty.Normal);

  // ---- Level-up state ----
  private upgradeChoices: UpgradeOption[] = [];

  // ---- Persistence ----
  private saveData: SaveData = { bestTime: 0, bestKills: 0, bestLevel: 0 };

  // ---- Background debris (#17) ----
  private debris: Debris[] = [];

  // =============================================
  // Construction
  // =============================================

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get 2D rendering context");
    this.ctx = ctx;

    this.input = new Input(canvas);
    this.audio = new Audio();
    this.touchControls = new TouchControls(canvas);
    this.player = new Player(
      ARENA_WIDTH / 2,
      ARENA_HEIGHT / 2,
      this.input,
      this.audio,
      this.touchControls,
    );

    this.camera = new CameraController(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    this.particleSystem = new ParticleSystem();
    this.damageNumbers = new DamageNumberSystem();
    this.screenEffects = new ScreenEffects();

    this.spawner = new Spawner();
    this.collision = new Collision();

    this.hud = new HUD();
    this.menu = new Menu();

    // Apply default balance to all systems
    this.player.applyBalance(this.bal);
    this.spawner.applyBalance(this.bal);

    this.loadSave();
    this.generateDebris();

    // Initial canvas sizing + resize handler
    this.handleResize();
    window.addEventListener("resize", () => this.handleResize());
  }

  // =============================================
  // Public — kick off the loop
  // =============================================

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // =============================================
  // Main loop (requestAnimationFrame)
  // =============================================

  private loop(timestamp: number): void {
    // Delta time in seconds, clamped to avoid spiral of death
    let dt = (timestamp - this.lastTime) / 1000;
    if (dt > MAX_DT) {
      dt = MAX_DT;
    }
    if (dt < 0) {
      dt = 0;
    }
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    // Clear per-frame input flags AFTER both update and render
    this.input.endFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  // =============================================
  // UPDATE
  // =============================================

  private update(dt: number): void {
    // #22 — Track FPS every frame
    this.hud.updateFPS(dt);

    // #23 — Auto-pause when window loses focus
    if (this.input.focusLost && this.state === GameState.Playing) {
      this.state = GameState.Paused;
    }

    // --- Global key toggles ---
    // #19 — Sound toggle (M key)
    if (this.input.wasKeyPressed("m")) {
      this.audio.toggle();
    }
    // #20 — Fullscreen toggle (F key — only outside text-input states)
    if (this.input.wasKeyPressed("f")) {
      if (!document.fullscreenElement) {
        this.canvas.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }

    // --- Global ESC handling ---
    if (this.input.wasKeyPressed("escape")) {
      if (this.state === GameState.Playing) {
        this.state = GameState.Paused;
        return;
      } else if (this.state === GameState.Paused) {
        this.state = GameState.Playing;
        return;
      } else if (this.state === GameState.HowToPlay) {
        this.state = GameState.StartMenu;
        return;
      }
    }

    // --- Per-state update ---
    if (this.state === GameState.Playing) {
      this.updatePlaying(dt);
    } else if (this.state === GameState.StartMenu) {
      this.updateMenuInput();
    } else if (this.state === GameState.Paused) {
      this.updateMenuInput();
    } else if (this.state === GameState.LevelUp) {
      this.updateLevelUpInput();
    } else if (this.state === GameState.GameOver) {
      this.updateMenuInput();
    } else if (this.state === GameState.HowToPlay) {
      this.updateMenuInput();
    }

    // #21 — Clear per-frame touch flags
    this.touchControls.endFrame();
  }

  // --------------------------------------------------
  // Playing state
  // --------------------------------------------------

  private updatePlaying(dt: number): void {
    // Convert screen-space mouse → world-space mouse
    const camX = this.camera.x;
    const camY = this.camera.y;
    const worldMouseX = this.input.mouseX + camX - this.canvas.width / 2;
    const worldMouseY = this.input.mouseY + camY - this.canvas.height / 2;

    // ---- Player ----
    const newBullets = this.player.update(dt, worldMouseX, worldMouseY);
    if (newBullets) {
      // #24 — Cap player bullets
      for (let i = 0; i < newBullets.length; i++) {
        if (this.bullets.length < MAX_BULLETS) {
          this.bullets.push(newBullets[i]);
        }
      }
    }

    // #13 — Muzzle flash particles
    if (this.player.justFired) {
      this.particleSystem.spawnMuzzleFlash(
        this.player.muzzleX,
        this.player.muzzleY,
      );
      this.screenEffects.triggerMuzzleFlash();
    }

    // ---- Enemies ----
    for (let i = 0; i < this.enemies.length; i++) {
      const enemyBullets = this.enemies[i].update(
        dt,
        this.player.x,
        this.player.y,
      );
      // #9 — Ranged enemies fire bullets
      if (enemyBullets) {
        for (let b = 0; b < enemyBullets.length; b++) {
          if (this.enemyBullets.length < MAX_ENEMY_BULLETS) {
            this.enemyBullets.push(enemyBullets[b]);
          }
        }
      }
    }

    // ---- Bullets ----
    for (let i = 0; i < this.bullets.length; i++) {
      this.bullets[i].update(dt);
    }
    for (let i = 0; i < this.enemyBullets.length; i++) {
      this.enemyBullets[i].update(dt);
    }

    // ---- Pickups ----
    for (let i = 0; i < this.pickups.length; i++) {
      this.pickups[i].update(
        dt,
        this.player.x,
        this.player.y,
        this.player.pickupRadius,
      );
    }

    // ---- Particle system (#4) ----
    this.particleSystem.update(dt);

    // ---- Spawner (#8, #9, #24, #25) ----
    const spawned = this.spawner.update(
      dt,
      camX,
      camY,
      this.canvas.width,
      this.canvas.height,
      this.enemies.length,
      this.enemies,
    );
    for (let i = 0; i < spawned.length; i++) {
      this.enemies.push(spawned[i]);
    }

    // ---- Collision detection (#2, #3, #9) ----
    const col = this.collision.checkAll(
      this.player,
      this.enemies,
      this.bullets,
      this.enemyBullets,
      this.pickups,
      this.audio,
    );

    // Camera shake + damage vignette on player hit (#12)
    if (col.playerHit) {
      this.camera.shake(5, 0.2);
      this.screenEffects.triggerDamageVignette();
    }

    // #11 — Damage numbers for hit enemies
    for (let i = 0; i < col.enemyHitPositions.length; i++) {
      const hp = col.enemyHitPositions[i];
      this.damageNumbers.spawn(hp.x, hp.y, hp.damage);
    }

    // #4 — Hit particles
    for (let i = 0; i < col.hitPositions.length; i++) {
      const hp = col.hitPositions[i];
      this.particleSystem.spawnHitParticles(hp.x, hp.y, hp.color);
    }

    // Spawn pickups for killed enemies + #10 combo + #15 death effects
    for (let i = 0; i < col.enemiesKilled.length; i++) {
      const dead = col.enemiesKilled[i];
      this.spawnPickupsFromEnemy(dead);

      // #10 — Kill combo
      const xpMult = this.player.registerKill();
      if (this.player.combo.count >= 3) {
        this.audio.playCombo();
      }

      // If the enemy gave xp-value based bonus with combo, add extra XP
      if (xpMult > 1) {
        this.player.xp += Math.floor(dead.xpValue * (xpMult - 1));
      }
    }

    // #9 — Handle exploder deaths (area damage to player)
    if (col.exploderDeaths) {
      for (let i = 0; i < col.exploderDeaths.length; i++) {
        const exp = col.exploderDeaths[i];
        this.particleSystem.spawnBurst(
          exp.x,
          exp.y,
          "#ff6600",
          20,
          80,
          250,
          0.3,
          0.7,
          3,
          7,
        );
        this.camera.shake(8, 0.3);
        this.audio.playExplosion();
      }
    }

    // Apply collected XP and health
    if (col.xpGained > 0) {
      this.player.xp += col.xpGained;
    }
    if (col.healthGained > 0) {
      this.player.heal(col.healthGained);
    }

    // ---- Damage numbers update (#11) ----
    this.damageNumbers.update(dt);

    // ---- Screen effects update (#12, #13) ----
    this.screenEffects.update(dt);

    // ---- Level up check ----
    if (this.player.checkLevelUp()) {
      this.enterLevelUp();
    }

    // ---- Death check ----
    if (!this.player.alive) {
      this.enterGameOver();
    }

    // ---- Remove dead entities (swap-and-pop) ----
    this.removeDeadEntities(this.bullets);
    this.removeDeadEntities(this.enemyBullets);
    this.removeDeadEntities(this.enemies);
    this.removeDeadEntities(this.pickups);

    // ---- Camera (#6) ----
    this.camera.update(
      dt,
      this.player.x,
      this.player.y,
      this.canvas.width,
      this.canvas.height,
    );
  }

  // --------------------------------------------------
  // Menu click handling (Start / Pause / GameOver)
  // --------------------------------------------------

  private updateMenuInput(): void {
    if (!this.input.mouseJustPressed) return;

    // #19, #20 — Check HUD toggle buttons first
    const hudAction = this.hud.handleClick(
      this.input.mouseX,
      this.input.mouseY,
    );
    if (hudAction === "sound") {
      this.audio.toggle();
      return;
    }
    if (hudAction === "fullscreen") {
      if (!document.fullscreenElement) {
        this.canvas.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
      return;
    }

    const action = this.menu.handleClick(this.input.mouseX, this.input.mouseY);

    if (action !== null && action.indexOf("diff_") === 0) {
      // Difficulty card clicked — update selection
      const idx = parseInt(action.substring(5), 10);
      if (idx >= 0 && idx <= 3) {
        this.menu.selectedDifficulty = idx as Difficulty;
      }
      return;
    }

    if (action === "start") {
      // Read selected difficulty from menu before starting
      this.difficulty = this.menu.selectedDifficulty;
      this.bal = getBalanceConfig(this.difficulty);
      this.startNewGame();
    } else if (action === "howtoplay") {
      this.state = GameState.HowToPlay;
    } else if (action === "back") {
      this.state = GameState.StartMenu;
    } else if (action === "resume") {
      this.state = GameState.Playing;
    } else if (action === "restart") {
      this.startNewGame();
    } else if (action === "quit") {
      this.state = GameState.StartMenu;
    }
  }

  // --------------------------------------------------
  // Level-up input (keyboard 1/2/3 or mouse click)
  // --------------------------------------------------

  private updateLevelUpInput(): void {
    // Keyboard shortcuts
    for (let i = 0; i < this.upgradeChoices.length; i++) {
      if (this.input.wasKeyPressed(String(i + 1))) {
        this.selectUpgrade(i);
        return;
      }
    }

    // Mouse click on upgrade card
    if (this.input.mouseJustPressed) {
      const action = this.menu.handleClick(
        this.input.mouseX,
        this.input.mouseY,
      );
      if (action !== null && action.indexOf("upgrade_") === 0) {
        const idx = parseInt(action.substring(8), 10);
        if (idx >= 0 && idx < this.upgradeChoices.length) {
          this.selectUpgrade(idx);
        }
      }
    }
  }

  private selectUpgrade(index: number): void {
    const choice = this.upgradeChoices[index];
    this.player.applyUpgrade(choice.id);
    this.state = GameState.Playing;
  }

  // =============================================
  // State transitions
  // =============================================

  private startNewGame(): void {
    // Apply balance to all systems with current difficulty
    this.player.applyBalance(this.bal);
    this.spawner.applyBalance(this.bal);

    this.player.reset(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.pickups = [];
    this.spawner.reset();

    // Reset new systems
    this.particleSystem.clear();
    this.damageNumbers.clear();
    this.camera.reset(this.player.x, this.player.y);

    this.state = GameState.Playing;
  }

  private enterLevelUp(): void {
    this.upgradeChoices = this.getRandomUpgrades(3);
    // If every upgrade is maxed, skip the selection screen
    if (this.upgradeChoices.length === 0) return;
    this.state = GameState.LevelUp;
  }

  private enterGameOver(): void {
    this.state = GameState.GameOver;

    const elapsed = this.spawner.elapsedTime;
    let changed = false;

    if (elapsed > this.saveData.bestTime) {
      this.saveData.bestTime = elapsed;
      changed = true;
    }
    if (this.player.killCount > this.saveData.bestKills) {
      this.saveData.bestKills = this.player.killCount;
      changed = true;
    }
    if (this.player.level > this.saveData.bestLevel) {
      this.saveData.bestLevel = this.player.level;
      changed = true;
    }

    if (changed) {
      this.persistSave();
    }
  }

  // =============================================
  // Upgrade selection helpers
  // =============================================

  /** Pick up to `count` random upgrades that are not yet maxed. */
  private getRandomUpgrades(count: number): UpgradeOption[] {
    // Build list of available (non-maxed) upgrades
    const available: UpgradeOption[] = [];
    for (let i = 0; i < UPGRADES.length; i++) {
      if (this.player.upgradeLevels[UPGRADES[i].id] < UPGRADES[i].maxLevel) {
        available.push(UPGRADES[i]);
      }
    }

    // Fisher–Yates shuffle
    for (let i = available.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const tmp = available[i];
      available[i] = available[j];
      available[j] = tmp;
    }

    // Take the first N
    const n = Math.min(count, available.length);
    const result: UpgradeOption[] = [];
    for (let i = 0; i < n; i++) {
      result.push(available[i]);
    }
    return result;
  }

  // =============================================
  // Entity helpers
  // =============================================

  /** Spawn XP (and maybe health) pickups where an enemy died. */
  private spawnPickupsFromEnemy(enemy: Enemy): void {
    // #24 — Cap pickups
    if (this.pickups.length < MAX_PICKUPS) {
      this.pickups.push(
        new Pickup(enemy.x, enemy.y, PickupType.XP, enemy.xpValue),
      );
    }

    // Health drop chance driven by difficulty balance
    if (Math.random() < this.bal.healthDropChance) {
      if (this.pickups.length < MAX_PICKUPS) {
        this.pickups.push(
          new Pickup(
            enemy.x + randFloat(-15, 15),
            enemy.y + randFloat(-15, 15),
            PickupType.Health,
            1,
          ),
        );
      }
    }

    // #4, #15 — Death particles + death ring via ParticleSystem
    this.particleSystem.spawnDeathParticles(enemy.x, enemy.y, enemy.color);
    this.particleSystem.spawnDeathRing(enemy.x, enemy.y, enemy.color);

    // #8 — Boss death gets extra camera shake + explosion sound
    if (enemy.isBoss) {
      this.camera.shake(12, 0.5);
      this.audio.playExplosion();
      this.particleSystem.spawnBurst(
        enemy.x,
        enemy.y,
        enemy.color,
        30,
        100,
        300,
        0.4,
        0.8,
        4,
        8,
      );
    }
  }

  /**
   * Remove all dead entities from an array using swap-and-pop.
   * O(n) single pass, no allocation.
   */
  private removeDeadEntities<T extends { alive: boolean }>(arr: T[]): void {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!arr[i].alive) {
        arr[i] = arr[arr.length - 1];
        arr.pop();
      }
    }
  }

  // =============================================
  // RENDER
  // =============================================

  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear the entire canvas
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w, h);

    // Start menu / How To Play draw ONLY the menu (no world behind)
    if (
      this.state === GameState.StartMenu ||
      this.state === GameState.HowToPlay
    ) {
      this.menu.render(ctx, this.state, w, h, {
        mouseX: this.input.mouseX,
        mouseY: this.input.mouseY,
      });
      return;
    }

    // --- World rendering (camera-transformed) ---
    ctx.save();
    const offsetX = w / 2 - this.camera.x + this.camera.shakeOffsetX;
    const offsetY = h / 2 - this.camera.y + this.camera.shakeOffsetY;
    ctx.translate(offsetX, offsetY);

    this.renderGrid(ctx);
    this.renderDebris(ctx); // #17 — Dynamic background
    this.renderArenaBorder(ctx);

    // Pickups (below everything else)
    for (let i = 0; i < this.pickups.length; i++) {
      this.pickups[i].render(ctx);
    }

    // Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].render(ctx);
    }

    // Enemy bullets (#9)
    for (let i = 0; i < this.enemyBullets.length; i++) {
      this.enemyBullets[i].render(ctx);
    }

    // Player bullets
    for (let i = 0; i < this.bullets.length; i++) {
      this.bullets[i].render(ctx);
    }

    // #4 — Particle system (particles + death rings)
    this.particleSystem.render(ctx);

    // #11 — Floating damage numbers (world space)
    this.damageNumbers.render(ctx);

    // Player (on top)
    this.player.render(ctx);

    ctx.restore();
    // --- End world rendering ---

    // --- Screen-space UI overlays ---

    // #12, #13 — Screen effects (damage vignette, muzzle flash)
    this.screenEffects.render(ctx, w, h);

    if (this.state === GameState.Playing) {
      this.hud.render(
        ctx,
        this.player,
        w,
        h,
        this.spawner.elapsedTime,
        this.spawner.getDangerLevel(),
        this.audio.enabled,
      );
      // #21 — Touch controls overlay
      this.touchControls.render(ctx, w, h);
    } else if (this.state === GameState.Paused) {
      this.hud.render(
        ctx,
        this.player,
        w,
        h,
        this.spawner.elapsedTime,
        this.spawner.getDangerLevel(),
        this.audio.enabled,
      );
      this.menu.render(ctx, this.state, w, h, {
        mouseX: this.input.mouseX,
        mouseY: this.input.mouseY,
      });
    } else if (this.state === GameState.LevelUp) {
      this.hud.render(
        ctx,
        this.player,
        w,
        h,
        this.spawner.elapsedTime,
        this.spawner.getDangerLevel(),
        this.audio.enabled,
      );
      this.menu.render(ctx, this.state, w, h, {
        upgradeChoices: this.upgradeChoices,
        upgradeLevels: this.player.upgradeLevels,
        mouseX: this.input.mouseX,
        mouseY: this.input.mouseY,
      });
    } else if (this.state === GameState.GameOver) {
      this.menu.render(ctx, this.state, w, h, {
        elapsedTime: this.spawner.elapsedTime,
        killCount: this.player.killCount,
        level: this.player.level,
        saveData: this.saveData,
        mouseX: this.input.mouseX,
        mouseY: this.input.mouseY,
      });
    }
  }

  // --------------------------------------------------
  // Background debris (#17 — Dynamic background)
  // --------------------------------------------------

  private generateDebris(): void {
    this.debris = [];
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      this.debris.push({
        x: randFloat(0, ARENA_WIDTH),
        y: randFloat(0, ARENA_HEIGHT),
        radius: randFloat(1, 3),
        alpha: randFloat(0.03, 0.12),
      });
    }
  }

  private renderDebris(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // --------------------------------------------------
  // Background grid (world space)
  // --------------------------------------------------

  private renderGrid(ctx: CanvasRenderingContext2D): void {
    const camL = this.camera.x - this.canvas.width / 2;
    const camT = this.camera.y - this.canvas.height / 2;

    const startX = Math.max(0, Math.floor(camL / GRID_SIZE) * GRID_SIZE);
    const endX = Math.min(ARENA_WIDTH, camL + this.canvas.width + GRID_SIZE);
    const startY = Math.max(0, Math.floor(camT / GRID_SIZE) * GRID_SIZE);
    const endY = Math.min(ARENA_HEIGHT, camT + this.canvas.height + GRID_SIZE);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = startX; x <= endX; x += GRID_SIZE) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }

    ctx.stroke();
  }

  // --------------------------------------------------
  // Arena border (world space)
  // --------------------------------------------------

  private renderArenaBorder(ctx: CanvasRenderingContext2D): void {
    // Outer glow
    ctx.strokeStyle = "rgba(255, 50, 50, 0.2)";
    ctx.lineWidth = 12;
    ctx.strokeRect(-4, -4, ARENA_WIDTH + 8, ARENA_HEIGHT + 8);

    // Solid border
    ctx.strokeStyle = "#ff4444";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  // =============================================
  // Resize
  // =============================================

  private handleResize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // =============================================
  // Save / Load (localStorage)
  // =============================================

  private loadSave(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.saveData.bestTime = d.bestTime || 0;
        this.saveData.bestKills = d.bestKills || 0;
        this.saveData.bestLevel = d.bestLevel || 0;
      }
    } catch {
      // Silently ignore corrupt data
    }
  }

  private persistSave(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData));
    } catch {
      // Silently ignore storage errors
    }
  }
}

// =============================================
// Spawner.ts — Enemy spawning with difficulty scaling
//
// Improvements:
//   #8  — Boss spawns at danger level milestones
//   #9  — Ranged and Exploder enemy types in mix
//   #24 — Max enemy cap with oldest-entity eviction
//   #25 — Density check: prefer less crowded spawn areas
//
// Tracks elapsed game time and uses it to:
//   - Decrease spawn interval (more enemies over time)
//   - Scale enemy stats via a difficulty multiplier
//   - Shift enemy type weights (more varied late-game)
//   - Spawn multiple enemies per tick as difficulty rises
//
// The "danger level" (1–10) is exposed for the HUD.
// =============================================

import { Enemy } from "../entities/Enemy.js";
import {
  EnemyType,
  BalanceConfig,
  randFloat,
  randInt,
  clamp,
  distSq,
  ARENA_WIDTH,
  ARENA_HEIGHT,
} from "../engine/Utils.js";

// --- Constants (#7) ---
const SPAWN_BUFFER = 80; // px outside camera view
const DENSITY_CHECK_RADIUS_SQ = 150 * 150; // (#25) radius² for density check
const MAX_DENSITY_NEARBY = 5; // (#25) max enemies near a spawn point before it's rejected

export class Spawner {
  private spawnTimer: number = 0;
  /** Total seconds the current run has been playing */
  public elapsedTime: number = 0;

  /** Tracks the last danger level a boss was spawned for (#8) */
  private lastBossDangerLevel: number = 0;

  /** Active balance config — set via applyBalance() */
  private bal!: BalanceConfig;

  constructor() {
    // bal is set via applyBalance() before first update
  }

  /** Apply a balance config (called when difficulty is selected). */
  applyBalance(bal: BalanceConfig): void {
    this.bal = bal;
  }

  // -----------------------------------------------
  // Public queries
  // -----------------------------------------------

  /** Danger level 1–10 shown on the HUD */
  getDangerLevel(): number {
    return Math.min(
      10,
      Math.floor(this.elapsedTime / this.bal.dangerPeriod) + 1,
    );
  }

  // -----------------------------------------------
  // Internal difficulty calculations
  // -----------------------------------------------

  /** Seconds between spawn ticks (decreases over time) */
  private getSpawnInterval(): number {
    return Math.max(
      this.bal.minSpawnInterval,
      this.bal.baseSpawnInterval -
        this.elapsedTime * this.bal.spawnIntervalDecay,
    );
  }

  /** Difficulty scale factor passed to Enemy constructor */
  private getDifficultyScale(): number {
    return this.elapsedTime / 60;
  }

  /** Weighted random enemy type (#9 — includes Ranged and Exploder) */
  private chooseEnemyType(): EnemyType {
    const roll = Math.random();
    const t = this.elapsedTime;

    // Early game — mostly basics
    if (t < this.bal.earlyPhaseEnd) {
      if (roll < 0.7) return EnemyType.Basic;
      return EnemyType.Fast;
    }

    // Mid game — mix of everything including new types
    if (t < this.bal.midPhaseEnd) {
      if (roll < 0.3) return EnemyType.Basic;
      if (roll < 0.5) return EnemyType.Fast;
      if (roll < 0.65) return EnemyType.Tank;
      if (roll < 0.8) return EnemyType.Ranged;
      return EnemyType.Exploder;
    }

    // Late game — dangerous mix
    if (roll < 0.2) return EnemyType.Basic;
    if (roll < 0.35) return EnemyType.Fast;
    if (roll < 0.5) return EnemyType.Tank;
    if (roll < 0.7) return EnemyType.Ranged;
    return EnemyType.Exploder;
  }

  // -----------------------------------------------
  // Core update
  // -----------------------------------------------

  /**
   * Advance spawn timer and return newly created enemies.
   *
   * @param camX         camera centre X (world coords)
   * @param camY         camera centre Y (world coords)
   * @param viewWidth    viewport width in pixels
   * @param viewHeight   viewport height in pixels
   * @param currentCount current number of alive enemies (#24)
   */
  update(
    dt: number,
    camX: number,
    camY: number,
    viewWidth: number,
    viewHeight: number,
    currentCount: number,
    existingEnemies: Enemy[],
  ): Enemy[] {
    this.elapsedTime += dt;
    this.spawnTimer -= dt;

    const spawned: Enemy[] = [];

    // --- Boss spawn at danger milestones (#8) ---
    const dangerLevel = this.getDangerLevel();
    if (
      dangerLevel >= this.bal.bossInterval &&
      dangerLevel % this.bal.bossInterval === 0 &&
      this.lastBossDangerLevel < dangerLevel
    ) {
      this.lastBossDangerLevel = dangerLevel;
      const pos = this.getSpawnPosition(camX, camY, viewWidth, viewHeight);
      const boss = new Enemy(
        pos.x,
        pos.y,
        EnemyType.Boss,
        this.getDifficultyScale(),
        this.bal,
      );
      spawned.push(boss);
    }

    // --- Regular spawns ---
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.getSpawnInterval();

      // Entity cap check (#24)
      const headroom = this.bal.maxEnemies - currentCount - spawned.length;
      if (headroom <= 0) return spawned;

      // Spawn more enemies per tick as difficulty rises (cap at maxSpawnPerTick)
      const count = Math.min(
        headroom,
        Math.min(
          this.bal.maxSpawnPerTick,
          1 + Math.floor(this.elapsedTime / this.bal.spawnCountDivisor),
        ),
      );

      for (let i = 0; i < count; i++) {
        const type = this.chooseEnemyType();
        const pos = this.getSpawnPositionWithDensityCheck(
          camX,
          camY,
          viewWidth,
          viewHeight,
          existingEnemies,
        );
        const enemy = new Enemy(
          pos.x,
          pos.y,
          type,
          this.getDifficultyScale(),
          this.bal,
        );
        spawned.push(enemy);
      }
    }

    return spawned;
  }

  // -----------------------------------------------
  // Spawn position (just off-screen)
  // -----------------------------------------------

  private getSpawnPosition(
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
  ): { x: number; y: number } {
    const halfW = viewW / 2;
    const halfH = viewH / 2;

    // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
    const edge = randInt(0, 3);

    let sx: number;
    let sy: number;

    if (edge === 0) {
      sx = camX + randFloat(-halfW, halfW);
      sy = camY - halfH - SPAWN_BUFFER;
    } else if (edge === 1) {
      sx = camX + halfW + SPAWN_BUFFER;
      sy = camY + randFloat(-halfH, halfH);
    } else if (edge === 2) {
      sx = camX + randFloat(-halfW, halfW);
      sy = camY + halfH + SPAWN_BUFFER;
    } else {
      sx = camX - halfW - SPAWN_BUFFER;
      sy = camY + randFloat(-halfH, halfH);
    }

    // Keep within the arena
    sx = clamp(sx, 10, ARENA_WIDTH - 10);
    sy = clamp(sy, 10, ARENA_HEIGHT - 10);

    return { x: sx, y: sy };
  }

  /**
   * Pick a spawn position, preferring less crowded areas (#25).
   * Tries up to 3 candidates and picks the one with fewest nearby enemies.
   */
  private getSpawnPositionWithDensityCheck(
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
    existingEnemies: Enemy[],
  ): { x: number; y: number } {
    let bestPos = this.getSpawnPosition(camX, camY, viewW, viewH);
    let bestCount = this.countNearby(bestPos.x, bestPos.y, existingEnemies);

    // If the first spot is already sparse, use it
    if (bestCount <= 1) return bestPos;

    // Try 2 more candidates
    for (let attempt = 0; attempt < 2; attempt++) {
      const candidate = this.getSpawnPosition(camX, camY, viewW, viewH);
      const count = this.countNearby(candidate.x, candidate.y, existingEnemies);
      if (count < bestCount) {
        bestPos = candidate;
        bestCount = count;
        if (bestCount <= 1) break;
      }
    }

    return bestPos;
  }

  /** Count how many enemies are within the density check radius (#25) */
  private countNearby(x: number, y: number, enemies: Enemy[]): number {
    let count = 0;
    for (let i = 0; i < enemies.length; i++) {
      if (!enemies[i].alive) continue;
      if (distSq(x, y, enemies[i].x, enemies[i].y) < DENSITY_CHECK_RADIUS_SQ) {
        count++;
        if (count >= MAX_DENSITY_NEARBY) return count; // early exit
      }
    }
    return count;
  }

  // -----------------------------------------------
  // Reset for new game
  // -----------------------------------------------

  reset(): void {
    this.spawnTimer = this.bal.initialSpawnDelay;
    this.elapsedTime = 0;
    this.lastBossDangerLevel = 0;
  }
}

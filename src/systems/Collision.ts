// =============================================
// Collision.ts — Spatial-grid-accelerated collision detection
//
// Improvements:
//   #2 — Spatial hash grid for O(n) broad phase instead of O(n×m)
//   #3 — Persistent CollisionResult object (no per-frame allocation)
//   #9 — Enemy bullet vs player collision
//   #9 — Exploder area damage on death
//
// Checks:
//   1. Player Bullet ↔ Enemy   (damage + pierce + kill)
//   2. Enemy Bullet ↔ Player   (ranged enemy projectiles)
//   3. Enemy  ↔ Player          (contact damage with cooldown)
//   4. Pickup ↔ Player          (collect XP / health)
//
// Returns a CollisionResult so the Game can react.
// =============================================

import { Player } from "../entities/Player.js";
import { Enemy } from "../entities/Enemy.js";
import { Bullet } from "../entities/Bullet.js";
import { Pickup, PickupType } from "../entities/Pickup.js";
import { Audio } from "../engine/Audio.js";
import {
  circlesOverlap,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  SPATIAL_CELL_SIZE,
  EnemyType,
} from "../engine/Utils.js";

// =============================================
// Spatial Grid (#2)
// =============================================

class SpatialGrid<T extends { x: number; y: number; radius: number }> {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private cells: T[][] = [];
  private cellCount: number;

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize) + 1;
    this.rows = Math.ceil(height / cellSize) + 1;
    this.cellCount = this.cols * this.rows;
    // Pre-allocate cell arrays
    for (let i = 0; i < this.cellCount; i++) {
      this.cells.push([]);
    }
  }

  clear(): void {
    for (let i = 0; i < this.cellCount; i++) {
      this.cells[i].length = 0;
    }
  }

  private getKey(col: number, row: number): number {
    return row * this.cols + col;
  }

  insert(entity: T): void {
    const col = Math.max(
      0,
      Math.min(this.cols - 1, Math.floor(entity.x / this.cellSize)),
    );
    const row = Math.max(
      0,
      Math.min(this.rows - 1, Math.floor(entity.y / this.cellSize)),
    );
    this.cells[this.getKey(col, row)].push(entity);
  }

  /** Get all entities in cells that overlap with the given circle */
  queryCircle(x: number, y: number, radius: number): T[] {
    const results: T[] = [];
    const minCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((x + radius) / this.cellSize),
    );
    const minRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((y + radius) / this.cellSize),
    );

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = this.cells[this.getKey(c, r)];
        for (let i = 0; i < cell.length; i++) {
          results.push(cell[i]);
        }
      }
    }
    return results;
  }
}

// =============================================
// Collision Result (#3 — persistent, reusable)
// =============================================

export interface CollisionResult {
  playerHit: boolean;
  enemiesKilled: Enemy[];
  xpGained: number;
  healthGained: number;
  exploderDeaths: Enemy[]; // enemies that died and are exploders (#9)
  enemyHitPositions: { x: number; y: number; damage: number }[]; // #11 — damage numbers
  hitPositions: { x: number; y: number; color: string }[]; // #4 — hit particles
}

export class Collision {
  // Persistent result object (#3 — no allocation per frame)
  private result: CollisionResult = {
    playerHit: false,
    enemiesKilled: [],
    xpGained: 0,
    healthGained: 0,
    exploderDeaths: [],
    enemyHitPositions: [],
    hitPositions: [],
  };

  // Spatial grids (#2)
  private enemyGrid: SpatialGrid<Enemy>;

  constructor() {
    this.enemyGrid = new SpatialGrid<Enemy>(
      ARENA_WIDTH,
      ARENA_HEIGHT,
      SPATIAL_CELL_SIZE,
    );
  }

  /** Reset the result object without allocating new arrays */
  private resetResult(): void {
    this.result.playerHit = false;
    this.result.enemiesKilled.length = 0;
    this.result.xpGained = 0;
    this.result.healthGained = 0;
    this.result.exploderDeaths.length = 0;
    this.result.enemyHitPositions.length = 0;
    this.result.hitPositions.length = 0;
  }

  /**
   * Run every collision check for one frame.
   * Entities are modified in-place (hp, alive flags, cooldowns).
   */
  checkAll(
    player: Player,
    enemies: Enemy[],
    playerBullets: Bullet[],
    enemyBullets: Bullet[],
    pickups: Pickup[],
    audio: Audio,
  ): CollisionResult {
    this.resetResult();
    const result = this.result;

    // --- Build spatial grid for enemies (#2) ---
    this.enemyGrid.clear();
    for (let e = 0; e < enemies.length; e++) {
      if (enemies[e].alive) {
        this.enemyGrid.insert(enemies[e]);
      }
    }

    // --------------------------------------------------
    // 1. Player Bullet vs Enemy (using spatial grid #2)
    // --------------------------------------------------
    for (let b = 0; b < playerBullets.length; b++) {
      const bullet = playerBullets[b];
      if (!bullet.alive) continue;

      // Query nearby enemies from spatial grid
      const maxCheckRadius = bullet.radius + 50; // largest enemy radius + buffer
      const nearby = this.enemyGrid.queryCircle(
        bullet.x,
        bullet.y,
        maxCheckRadius,
      );

      for (let e = 0; e < nearby.length; e++) {
        const enemy = nearby[e];
        if (!enemy.alive) continue;

        if (
          circlesOverlap(
            bullet.x,
            bullet.y,
            bullet.radius,
            enemy.x,
            enemy.y,
            enemy.radius,
          )
        ) {
          const killed = enemy.takeDamage(bullet.damage);
          audio.playHit();

          // #11 — Track hit position for damage numbers
          result.enemyHitPositions.push({
            x: enemy.x,
            y: enemy.y - enemy.radius,
            damage: bullet.damage,
          });
          // #4 — Track hit position for particles
          result.hitPositions.push({
            x: (bullet.x + enemy.x) / 2,
            y: (bullet.y + enemy.y) / 2,
            color: enemy.color,
          });

          if (killed) {
            result.enemiesKilled.push(enemy);
            player.killCount++;

            // Track exploders (#9)
            if (enemy.type === EnemyType.Exploder) {
              result.exploderDeaths.push(enemy);
            }
          }

          // Pierce logic
          if (bullet.pierceLeft > 0) {
            bullet.pierceLeft--;
          } else {
            bullet.alive = false;
            break;
          }
        }
      }
    }

    // --------------------------------------------------
    // 2. Enemy Bullet vs Player (#9)
    // --------------------------------------------------
    if (player.alive && !player.isInvuln) {
      for (let b = 0; b < enemyBullets.length; b++) {
        const bullet = enemyBullets[b];
        if (!bullet.alive) continue;

        if (
          circlesOverlap(
            bullet.x,
            bullet.y,
            bullet.radius,
            player.x,
            player.y,
            player.radius,
          )
        ) {
          player.takeDamage(bullet.damage);
          bullet.alive = false;
          result.playerHit = true;
        }
      }
    }

    // --------------------------------------------------
    // 3. Enemy vs Player (contact damage)
    // --------------------------------------------------
    if (player.alive) {
      // Use spatial grid to only check nearby enemies
      const nearPlayer = this.enemyGrid.queryCircle(
        player.x,
        player.y,
        player.radius + 50,
      );

      for (let e = 0; e < nearPlayer.length; e++) {
        const enemy = nearPlayer[e];
        if (!enemy.alive) continue;
        if (!enemy.canDealContactDamage()) continue;

        if (
          circlesOverlap(
            player.x,
            player.y,
            player.radius,
            enemy.x,
            enemy.y,
            enemy.radius,
          )
        ) {
          const died = player.takeDamage(enemy.damage);
          enemy.resetContactCooldown();
          result.playerHit = true;

          if (died) break;
        }
      }
    }

    // --------------------------------------------------
    // 4. Exploder area damage to player (#9)
    // --------------------------------------------------
    if (player.alive && result.exploderDeaths.length > 0) {
      for (let i = 0; i < result.exploderDeaths.length; i++) {
        const exp = result.exploderDeaths[i];
        if (
          circlesOverlap(
            player.x,
            player.y,
            player.radius,
            exp.x,
            exp.y,
            exp.explodeRadius,
          )
        ) {
          player.takeDamage(exp.damage);
          result.playerHit = true;
        }
      }
    }

    // --------------------------------------------------
    // 5. Pickup vs Player
    // --------------------------------------------------
    for (let p = 0; p < pickups.length; p++) {
      const pickup = pickups[p];
      if (!pickup.alive) continue;

      // Slightly generous collection radius (+5 px)
      if (
        circlesOverlap(
          player.x,
          player.y,
          player.radius + 5,
          pickup.x,
          pickup.y,
          pickup.radius,
        )
      ) {
        pickup.alive = false;
        audio.playPickup();

        if (pickup.type === PickupType.XP) {
          result.xpGained += pickup.value;
        } else if (pickup.type === PickupType.Health) {
          result.healthGained += pickup.value;
        }
      }
    }

    return result;
  }
}

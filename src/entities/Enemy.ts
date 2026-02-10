// =============================================
// Enemy.ts — Enemy entities with 6 distinct types
//
// Types:
//   Basic    – medium speed, medium HP (red circle)
//   Fast     – high speed, low HP (orange triangle) (#16)
//   Tank     – slow, high HP, large body (purple hexagon) (#16)
//   Boss     – huge, very high HP, screen shake on spawn (#8)
//   Ranged   – keeps distance, fires projectiles (#9)
//   Exploder – runs at player, explodes on death (#9)
//
// All enemies chase the player (except Ranged which keeps distance).
// Stats scale with the difficulty multiplier passed at construction.
// =============================================

import {
  EnemyType,
  BalanceConfig,
  clamp,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  TWO_PI,
  PI,
} from "../engine/Utils.js";
import { Bullet } from "./Bullet.js";

// --- Per-type base configurations (before difficulty scaling) ---
interface EnemyConfig {
  radius: number;
  speed: number;
  hp: number;
  damage: number;
  color: string;
  xpValue: number;
  sides: number; // polygon sides for rendering (#16) — 0 = circle
}

const ENEMY_CONFIGS: EnemyConfig[] = [
  // 0 = Basic chaser (circle)
  {
    radius: 14,
    speed: 80,
    hp: 3,
    damage: 1,
    color: "#e74c3c",
    xpValue: 1,
    sides: 0,
  },
  // 1 = Fast runner (triangle) (#16)
  {
    radius: 10,
    speed: 160,
    hp: 1,
    damage: 1,
    color: "#e67e22",
    xpValue: 1,
    sides: 3,
  },
  // 2 = Tank (hexagon) (#16)
  {
    radius: 24,
    speed: 50,
    hp: 10,
    damage: 2,
    color: "#8e44ad",
    xpValue: 3,
    sides: 6,
  },
  // 3 = Boss (#8) — large octagon
  {
    radius: 40,
    speed: 40,
    hp: 50,
    damage: 3,
    color: "#ff1744",
    xpValue: 15,
    sides: 8,
  },
  // 4 = Ranged (#9) — diamond shape
  {
    radius: 12,
    speed: 60,
    hp: 4,
    damage: 1,
    color: "#29b6f6",
    xpValue: 2,
    sides: 4,
  },
  // 5 = Exploder (#9) — pentagon
  {
    radius: 16,
    speed: 120,
    hp: 2,
    damage: 3,
    color: "#fdd835",
    xpValue: 2,
    sides: 5,
  },
];

// --- Contact damage cooldown so enemies don't hurt the player every frame ---
// (now driven by BalanceConfig.enemyContactCooldown)

// --- Duration of the white flash when an enemy takes damage ---
const FLASH_DURATION = 0.1; // seconds

// --- Ranged enemy constants (#9) ---
const RANGED_PREFERRED_DIST = 250; // tries to stay this far from player
const RANGED_BULLET_RADIUS = 5;

export class Enemy {
  // Position / physics
  public x: number;
  public y: number;
  public radius: number;
  public speed: number;

  // Health
  public hp: number;
  public maxHp: number;

  // Damage dealt on contact
  public damage: number;

  // Visuals
  public color: string;
  public sides: number; // polygon sides (#16)

  // XP dropped on death
  public xpValue: number;

  // Identity
  public type: EnemyType;
  public alive: boolean = true;

  // Prevents damage-per-frame on sustained contact
  public contactCooldown: number = 0;
  private contactCooldownTime: number;

  // White flash timer when hit
  public flashTimer: number = 0;

  // Ranged enemy shoot timer (#9)
  public shootTimer: number = 0;
  private rangedFireRate: number = 1.5;
  private rangedBulletSpeed: number = 200;
  private rangedBulletDamage: number = 1;

  // Exploder flag (#9)
  public explodeRadius: number = 0; // >0 means it explodes on death
  private explodeSpeedBoost: number = 1.5;

  // Boss flag (#8)
  public isBoss: boolean = false;

  /**
   * @param difficultyScale  0 at game start, increases over time.
   *                         Enemy HP and speed scale with it.
   * @param bal              BalanceConfig for the current difficulty
   */
  constructor(
    x: number,
    y: number,
    type: EnemyType,
    difficultyScale: number,
    bal: BalanceConfig,
  ) {
    this.x = x;
    this.y = y;
    this.type = type;

    const cfg = ENEMY_CONFIGS[type];
    const typeIdx = type as number;

    // Apply per-type multipliers from BalanceConfig, then difficulty scaling
    this.radius = cfg.radius;
    this.speed =
      cfg.speed *
      bal.enemySpeedMult[typeIdx] *
      (1 + difficultyScale * bal.enemySpeedScale);
    this.hp = Math.ceil(
      cfg.hp *
        bal.enemyHpMult[typeIdx] *
        (1 + difficultyScale * bal.enemyHpScale),
    );
    this.maxHp = this.hp;
    this.damage = Math.ceil(cfg.damage * bal.enemyDamageMult[typeIdx]);
    this.color = cfg.color;
    this.xpValue = cfg.xpValue;
    this.sides = cfg.sides;
    this.contactCooldownTime = bal.enemyContactCooldown;

    // Type-specific setup
    if (type === EnemyType.Boss) {
      this.isBoss = true;
    } else if (type === EnemyType.Exploder) {
      this.explodeRadius = bal.explodeRadius;
      this.explodeSpeedBoost = bal.explodeSpeedBoost;
    } else if (type === EnemyType.Ranged) {
      this.rangedFireRate = bal.rangedFireRate;
      this.rangedBulletSpeed = bal.rangedBulletSpeed;
      this.rangedBulletDamage = Math.ceil(
        cfg.damage * bal.enemyDamageMult[typeIdx],
      );
      this.shootTimer = 1 / this.rangedFireRate; // start with delay
    }
  }

  // -----------------------------------------------
  // Core update — chase the player (with variants)
  // -----------------------------------------------
  update(dt: number, playerX: number, playerY: number): Bullet[] | null {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    let newBullets: Bullet[] | null = null;

    if (this.type === EnemyType.Ranged) {
      // --- Ranged: keep distance, shoot at player (#9) ---
      if (len > 1) {
        if (len < RANGED_PREFERRED_DIST - 30) {
          // Too close — back away
          this.x -= (dx / len) * this.speed * dt;
          this.y -= (dy / len) * this.speed * dt;
        } else if (len > RANGED_PREFERRED_DIST + 30) {
          // Too far — approach
          this.x += (dx / len) * this.speed * dt;
          this.y += (dy / len) * this.speed * dt;
        }
        // else — hold position
      }

      // Shoot at player
      this.shootTimer -= dt;
      if (this.shootTimer <= 0 && len < 500) {
        this.shootTimer = 1 / this.rangedFireRate;
        const bvx = (dx / len) * this.rangedBulletSpeed;
        const bvy = (dy / len) * this.rangedBulletSpeed;
        newBullets = [
          new Bullet(
            this.x,
            this.y,
            bvx,
            bvy,
            RANGED_BULLET_RADIUS,
            this.rangedBulletDamage,
            0,
            true, // isEnemyBullet
          ),
        ];
      }
    } else if (this.type === EnemyType.Exploder) {
      // --- Exploder: rush toward player, speed up when close (#9) ---
      if (len > 1) {
        const speedMult = len < 100 ? this.explodeSpeedBoost : 1;
        this.x += (dx / len) * this.speed * speedMult * dt;
        this.y += (dy / len) * this.speed * speedMult * dt;
      }
    } else {
      // --- Default chase (Basic, Fast, Tank, Boss) ---
      if (len > 1) {
        this.x += (dx / len) * this.speed * dt;
        this.y += (dy / len) * this.speed * dt;
      }
    }

    // Keep inside arena
    this.x = clamp(this.x, this.radius, ARENA_WIDTH - this.radius);
    this.y = clamp(this.y, this.radius, ARENA_HEIGHT - this.radius);

    // Tick cooldowns
    if (this.contactCooldown > 0) {
      this.contactCooldown -= dt;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }

    return newBullets;
  }

  // -----------------------------------------------
  // Combat helpers
  // -----------------------------------------------

  /** Apply damage. Returns true if the enemy died. */
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    this.flashTimer = FLASH_DURATION;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  canDealContactDamage(): boolean {
    return this.contactCooldown <= 0;
  }

  resetContactCooldown(): void {
    this.contactCooldown = this.contactCooldownTime;
  }

  // -----------------------------------------------
  // Rendering (#16 — polygon shapes)
  // -----------------------------------------------
  render(ctx: CanvasRenderingContext2D): void {
    // --- Body ---
    if (this.flashTimer > 0) {
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.fillStyle = this.color;
    }

    if (this.sides > 0) {
      // Polygon rendering (#16)
      this.drawPolygon(ctx, this.x, this.y, this.radius, this.sides);
    } else {
      // Circle (Basic type)
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, TWO_PI);
      ctx.fill();
    }

    // Dark outline
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Boss glow ring (#8) ---
    if (this.isBoss) {
      ctx.strokeStyle = "rgba(255, 23, 68, 0.3)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 8, 0, TWO_PI);
      ctx.stroke();
    }

    // --- Exploder warning pulse (#9) ---
    if (this.type === EnemyType.Exploder) {
      const pulse = 0.3 + Math.sin(Date.now() * 0.01) * 0.15;
      ctx.fillStyle = `rgba(253, 216, 53, ${pulse})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 4, 0, TWO_PI);
      ctx.fill();
    }

    // --- Simple "eyes" ---
    ctx.fillStyle = "#000000";
    const eo = this.radius * 0.35; // eye offset
    const er = this.radius * 0.15; // eye radius
    ctx.beginPath();
    ctx.arc(this.x - eo, this.y - eo * 0.5, er, 0, TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x + eo, this.y - eo * 0.5, er, 0, TWO_PI);
    ctx.fill();

    // --- HP bar (only visible when damaged) ---
    if (this.hp < this.maxHp) {
      const barW = this.radius * 2;
      const barH = 4;
      const barX = this.x - barW / 2;
      const barY = this.y - this.radius - 8;
      const ratio = this.hp / this.maxHp;

      // Background
      ctx.fillStyle = "#333333";
      ctx.fillRect(barX, barY, barW, barH);

      // Fill — boss bar is red, others green
      ctx.fillStyle = this.isBoss ? "#ff4444" : "#44ff44";
      ctx.fillRect(barX, barY, barW * ratio, barH);
    }
  }

  /** Draw a regular polygon (#16) */
  private drawPolygon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    sides: number,
  ): void {
    const angleStep = TWO_PI / sides;
    const startAngle = -PI / 2; // point upward

    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = startAngle + i * angleStep;
      const px = cx + Math.cos(a) * radius;
      const py = cy + Math.sin(a) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
  }
}

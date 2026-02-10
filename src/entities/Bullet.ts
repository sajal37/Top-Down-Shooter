// =============================================
// Bullet.ts — Projectile fired by player or enemies
//
// Moves in a straight line. Destroyed when it
// leaves the arena bounds (with a small buffer).
// Supports:
//   - Pierce: can pass through multiple enemies
//   - Trail rendering (#14): fading line behind the bullet
//   - Enemy bullets (#9): flag to distinguish source
// =============================================

import { ARENA_WIDTH, ARENA_HEIGHT, TWO_PI } from "../engine/Utils.js";

// --- Trail constants (#14) ---
const MAX_TRAIL_LENGTH = 6;
const BULLET_OOB_BUFFER = 50;

/** A stored trail point for rendering the fading tail */
interface TrailPoint {
  x: number;
  y: number;
}

export class Bullet {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public radius: number;
  public damage: number;
  public pierceLeft: number; // how many MORE enemies this bullet can pass through
  public alive: boolean = true;

  /** true for enemy-fired bullets (skip enemy collision, check player) (#9) */
  public isEnemyBullet: boolean = false;

  /** Previous positions for trailing effect (#14) */
  public trail: TrailPoint[] = [];

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    damage: number,
    pierce: number,
    isEnemyBullet: boolean = false,
  ) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.damage = damage;
    this.pierceLeft = pierce;
    this.isEnemyBullet = isEnemyBullet;
  }

  /** Re-initialise for object pool reuse (#1) */
  init(
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    damage: number,
    pierce: number,
    isEnemyBullet: boolean = false,
  ): void {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.damage = damage;
    this.pierceLeft = pierce;
    this.isEnemyBullet = isEnemyBullet;
    this.alive = true;
    this.trail.length = 0;
  }

  update(dt: number): void {
    // Store trail point (#14)
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > MAX_TRAIL_LENGTH) {
      this.trail.shift();
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Kill bullet when it exits the arena
    if (
      this.x < -BULLET_OOB_BUFFER ||
      this.x > ARENA_WIDTH + BULLET_OOB_BUFFER ||
      this.y < -BULLET_OOB_BUFFER ||
      this.y > ARENA_HEIGHT + BULLET_OOB_BUFFER
    ) {
      this.alive = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const isEnemy = this.isEnemyBullet;
    const coreColor = isEnemy ? "#ff4444" : "#ffffff";
    const glowColor = isEnemy ? "#ff8844" : "#ffff00";
    const trailColor = isEnemy ? "255, 100, 50" : "255, 255, 0";

    // --- Bullet trail (#14) ---
    if (this.trail.length > 1) {
      for (let i = 0; i < this.trail.length - 1; i++) {
        const alpha = (i / this.trail.length) * 0.5;
        const width = (i / this.trail.length) * this.radius * 1.5;
        ctx.strokeStyle = `rgba(${trailColor}, ${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(this.trail[i].x, this.trail[i].y);
        ctx.lineTo(this.trail[i + 1].x, this.trail[i + 1].y);
        ctx.stroke();
      }
      // Trail segment from last trail point to current position
      const lastAlpha = 0.5;
      ctx.strokeStyle = `rgba(${trailColor}, ${lastAlpha})`;
      ctx.lineWidth = this.radius * 1.5;
      ctx.beginPath();
      ctx.moveTo(
        this.trail[this.trail.length - 1].x,
        this.trail[this.trail.length - 1].y,
      );
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }

    // --- Outer glow ---
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TWO_PI);
    ctx.fill();

    // --- Bright core ---
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.5, 0, TWO_PI);
    ctx.fill();
  }
}

// =============================================
// Pickup.ts — XP gems and health pickups
//
// Dropped by enemies on death. XP gems are attracted
// toward the player when close enough. Health pickups
// restore 1 HP.
// =============================================

import { TWO_PI, PICKUP_ATTRACT_SPEED } from "../engine/Utils.js";

export enum PickupType {
  XP = 0,
  Health = 1,
}

// --- Constants (#7) ---
const PICKUP_LIFETIME = 30; // seconds until despawn
const BOB_SPEED = 3;
const BOB_AMPLITUDE = 3;
const XP_RADIUS = 8;
const HEALTH_RADIUS = 10;

export class Pickup {
  public x: number;
  public y: number;
  public radius: number = XP_RADIUS;
  public type: PickupType;
  public value: number; // XP amount or heal amount
  public alive: boolean = true;
  public lifetime: number = PICKUP_LIFETIME;

  // Bobbing animation state
  private bobTimer: number = 0;
  private baseY: number;

  constructor(x: number, y: number, type: PickupType, value: number) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.type = type;
    this.value = value;

    if (type === PickupType.Health) {
      this.radius = HEALTH_RADIUS;
    }
  }

  /** Re-initialise for pool reuse (#1) */
  init(x: number, y: number, type: PickupType, value: number): void {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.type = type;
    this.value = value;
    this.alive = true;
    this.lifetime = PICKUP_LIFETIME;
    this.bobTimer = 0;
    this.radius = type === PickupType.Health ? HEALTH_RADIUS : XP_RADIUS;
  }

  /**
   * Update pickup position and lifetime.
   * @param dt           delta time
   * @param playerX      player world X
   * @param playerY      player world Y
   * @param attractRadius distance within which pickup is pulled toward player
   */
  update(
    dt: number,
    playerX: number,
    playerY: number,
    attractRadius: number,
  ): void {
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.alive = false;
      return;
    }

    // Gentle bobbing animation
    this.bobTimer += dt * BOB_SPEED;
    this.y = this.baseY + Math.sin(this.bobTimer) * BOB_AMPLITUDE;

    // Attract toward player when inside attraction radius
    const dx = playerX - this.x;
    const dy = playerY - this.baseY;
    const dSq = dx * dx + dy * dy;

    if (dSq < attractRadius * attractRadius && dSq > 1) {
      const d = Math.sqrt(dSq);
      this.x += (dx / d) * PICKUP_ATTRACT_SPEED * dt;
      this.baseY += (dy / d) * PICKUP_ATTRACT_SPEED * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.type === PickupType.XP) {
      // --- Blue-green diamond gem ---
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.PI / 4);

      // Soft glow
      ctx.fillStyle = "rgba(0, 200, 255, 0.25)";
      ctx.fillRect(
        -this.radius * 1.5,
        -this.radius * 1.5,
        this.radius * 3,
        this.radius * 3,
      );

      // Gem body
      ctx.fillStyle = "#00ccff";
      ctx.fillRect(
        -this.radius,
        -this.radius,
        this.radius * 2,
        this.radius * 2,
      );

      // Highlight
      ctx.fillStyle = "#88eeff";
      ctx.fillRect(
        -this.radius * 0.4,
        -this.radius * 0.4,
        this.radius * 0.8,
        this.radius * 0.8,
      );

      ctx.restore();
    } else {
      // --- Red cross health pickup ---
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, TWO_PI);
      ctx.fill();

      // White cross
      ctx.fillStyle = "#ffffff";
      const s = this.radius * 0.25;
      ctx.fillRect(this.x - s, this.y - s * 2.5, s * 2, s * 5);
      ctx.fillRect(this.x - s * 2.5, this.y - s, s * 5, s * 2);
    }
  }
}

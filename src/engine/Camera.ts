// =============================================
// Camera.ts — Camera controller (#6 — extracted from Game.ts)
//
// Smooth follow with lerp, screen shake, and
// arena boundary clamping.
// =============================================

import { clamp, randFloat, ARENA_WIDTH, ARENA_HEIGHT } from "./Utils.js";

const CAMERA_FOLLOW_SPEED = 8;

export class CameraController {
  public x: number;
  public y: number;
  public shakeOffsetX: number = 0;
  public shakeOffsetY: number = 0;
  public shakeTimer: number = 0;
  public shakeIntensity: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(
    dt: number,
    targetX: number,
    targetY: number,
    canvasW: number,
    canvasH: number,
  ): void {
    // Smooth follow with lerp
    this.x += (targetX - this.x) * CAMERA_FOLLOW_SPEED * dt;
    this.y += (targetY - this.y) * CAMERA_FOLLOW_SPEED * dt;

    // Clamp to arena bounds so we don't show void beyond the arena
    const halfW = canvasW / 2;
    const halfH = canvasH / 2;

    if (canvasW >= ARENA_WIDTH) {
      this.x = ARENA_WIDTH / 2;
    } else {
      this.x = clamp(this.x, halfW, ARENA_WIDTH - halfW);
    }

    if (canvasH >= ARENA_HEIGHT) {
      this.y = ARENA_HEIGHT / 2;
    } else {
      this.y = clamp(this.y, halfH, ARENA_HEIGHT - halfH);
    }

    // Shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.shakeOffsetX = randFloat(-this.shakeIntensity, this.shakeIntensity);
      this.shakeOffsetY = randFloat(-this.shakeIntensity, this.shakeIntensity);
      this.shakeIntensity *= 0.9; // decay
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeIntensity = 0;
    }
  }

  shake(intensity: number, duration: number): void {
    if (intensity > this.shakeIntensity) {
      this.shakeIntensity = intensity;
      this.shakeTimer = duration;
    }
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }
}

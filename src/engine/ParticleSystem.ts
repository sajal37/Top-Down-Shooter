// =============================================
// ParticleSystem.ts — Dedicated particle manager
//
// Manages all visual particles and death ring effects.
// Supports burst spawns (hit, death, muzzle flash) and
// expanding death rings for enemy kill effects.
// =============================================

import { Particle, DeathRing, TWO_PI, randFloat } from "./Utils.js";

// --- Constants (previously magic numbers) ---
const PARTICLE_SHRINK_RATE = 0.96;

export class ParticleSystem {
  public particles: Particle[] = [];
  public deathRings: DeathRing[] = [];

  // -----------------------------------------------
  // Update
  // -----------------------------------------------

  update(dt: number): void {
    // Particles (swap-and-pop removal)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.radius *= PARTICLE_SHRINK_RATE;

      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }

    // Death rings
    for (let i = this.deathRings.length - 1; i >= 0; i--) {
      const r = this.deathRings[i];
      r.life -= dt;
      r.radius += r.expandSpeed * dt;

      if (r.life <= 0) {
        this.deathRings[i] = this.deathRings[this.deathRings.length - 1];
        this.deathRings.pop();
      }
    }
  }

  // -----------------------------------------------
  // Render (world space)
  // -----------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    // Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Death rings (#15 — enemy death animation)
    for (let i = 0; i < this.deathRings.length; i++) {
      const r = this.deathRings[i];
      const alpha = r.life / r.maxLife;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * alpha;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // -----------------------------------------------
  // Spawn helpers
  // -----------------------------------------------

  /** Generic particle burst */
  spawnBurst(
    x: number,
    y: number,
    color: string,
    count: number,
    speedMin: number,
    speedMax: number,
    lifeMin: number,
    lifeMax: number,
    radiusMin: number,
    radiusMax: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = randFloat(0, TWO_PI);
      const speed = randFloat(speedMin, speedMax);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randFloat(lifeMin, lifeMax),
        maxLife: lifeMax,
        radius: randFloat(radiusMin, radiusMax),
        color,
      });
    }
  }

  /** Hit sparks when a bullet strikes an enemy */
  spawnHitParticles(x: number, y: number, color: string): void {
    this.spawnBurst(x, y, color, 5, 50, 150, 0.2, 0.4, 2, 4);
  }

  /** Death explosion when an enemy is killed */
  spawnDeathParticles(x: number, y: number, color: string): void {
    this.spawnBurst(x, y, color, 8, 80, 200, 0.3, 0.6, 3, 6);
  }

  /** Expanding ring effect on enemy death (#15) */
  spawnDeathRing(x: number, y: number, color: string): void {
    this.deathRings.push({
      x,
      y,
      radius: 5,
      expandSpeed: 150,
      life: 0.4,
      maxLife: 0.4,
      color,
    });
  }

  /** Brief muzzle flash particles at gun barrel (#13) */
  spawnMuzzleFlash(x: number, y: number): void {
    this.spawnBurst(x, y, "#ffff88", 3, 40, 100, 0.05, 0.12, 2, 4);
  }

  /** Clear all particles (for game reset) */
  clear(): void {
    this.particles.length = 0;
    this.deathRings.length = 0;
  }
}

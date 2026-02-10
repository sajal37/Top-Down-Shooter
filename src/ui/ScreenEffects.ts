// =============================================
// ScreenEffects.ts — Full-screen visual effects (#12, #13)
//
// Renders:
//   - Red vignette when the player takes damage
//   - Brief white flash for muzzle fire
// =============================================

export class ScreenEffects {
  // --- Red vignette on player hit (#12) ---
  private vignetteTimer: number = 0;
  private readonly vignetteDuration: number = 0.4;

  // --- White screen flash on shooting (#13) ---
  private flashTimer: number = 0;
  private readonly flashDuration: number = 0.04;

  triggerDamageVignette(): void {
    this.vignetteTimer = this.vignetteDuration;
  }

  triggerMuzzleFlash(): void {
    this.flashTimer = this.flashDuration;
  }

  update(dt: number): void {
    if (this.vignetteTimer > 0) this.vignetteTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
  }

  /** Render in screen space (call AFTER camera restore) */
  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Red vignette (#12)
    if (this.vignetteTimer > 0) {
      const alpha = (this.vignetteTimer / this.vignetteDuration) * 0.4;
      const gradient = ctx.createRadialGradient(
        w / 2,
        h / 2,
        w * 0.3,
        w / 2,
        h / 2,
        w * 0.75,
      );
      gradient.addColorStop(0, "rgba(255, 0, 0, 0)");
      gradient.addColorStop(1, `rgba(255, 0, 0, ${alpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    // White screen flash (#13)
    if (this.flashTimer > 0) {
      const alpha = (this.flashTimer / this.flashDuration) * 0.1;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

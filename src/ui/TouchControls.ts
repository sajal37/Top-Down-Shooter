// =============================================
// TouchControls.ts — Virtual joystick & buttons (#21)
//
// Provides mobile/touch support:
//   - Left side: virtual joystick for movement
//   - Right side: tap/drag to aim + auto-shoot
//   - Bottom-right: dash button
//
// Only activates on touch-capable devices.
// =============================================

import { TWO_PI } from "../engine/Utils.js";

export class TouchControls {
  public active: boolean = false;

  // --- Virtual joystick ---
  /** Joystick X axis: -1 (left) to +1 (right) */
  public joyX: number = 0;
  /** Joystick Y axis: -1 (up) to +1 (down) */
  public joyY: number = 0;
  private joyTouchId: number = -1;
  private joyBaseX: number = 0;
  private joyBaseY: number = 0;
  private joyKnobX: number = 0;
  private joyKnobY: number = 0;
  private joyActive: boolean = false;
  private readonly joyRadius: number = 60;

  // --- Shoot ---
  public shootPressed: boolean = false;
  private shootTouchId: number = -1;

  // --- Aim direction (screen coords for conversion to world) ---
  public aimX: number = 0;
  public aimY: number = 0;

  // --- Dash ---
  public dashPressed: boolean = false;
  public dashJustPressed: boolean = false;
  private dashTouchId: number = -1;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Detect touch support
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      this.active = true;
      this.setupListeners();
    }
  }

  private setupListeners(): void {
    this.canvas.addEventListener("touchstart", (e) => this.onTouchStart(e), {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", (e) => this.onTouchMove(e), {
      passive: false,
    });
    this.canvas.addEventListener("touchend", (e) => this.onTouchEnd(e), {
      passive: false,
    });
    this.canvas.addEventListener("touchcancel", (e) => this.onTouchEnd(e), {
      passive: false,
    });
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const tx = t.clientX - rect.left;
      const ty = t.clientY - rect.top;

      if (tx < w * 0.4) {
        // Left 40% — joystick
        this.joyTouchId = t.identifier;
        this.joyBaseX = tx;
        this.joyBaseY = ty;
        this.joyKnobX = tx;
        this.joyKnobY = ty;
        this.joyActive = true;
      } else if (tx > w * 0.75 && ty > h * 0.7) {
        // Bottom-right — dash button
        this.dashTouchId = t.identifier;
        this.dashPressed = true;
        this.dashJustPressed = true;
      } else {
        // Remaining area — aim + shoot
        this.shootTouchId = t.identifier;
        this.shootPressed = true;
        this.aimX = (tx / rect.width) * this.canvas.width;
        this.aimY = (ty / rect.height) * this.canvas.height;
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (t.identifier === this.joyTouchId) {
        this.joyKnobX = t.clientX - rect.left;
        this.joyKnobY = t.clientY - rect.top;

        let dx = this.joyKnobX - this.joyBaseX;
        let dy = this.joyKnobY - this.joyBaseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.joyRadius) {
          dx = (dx / dist) * this.joyRadius;
          dy = (dy / dist) * this.joyRadius;
          this.joyKnobX = this.joyBaseX + dx;
          this.joyKnobY = this.joyBaseY + dy;
        }

        this.joyX = dx / this.joyRadius;
        this.joyY = dy / this.joyRadius;
      } else if (t.identifier === this.shootTouchId) {
        this.aimX = ((t.clientX - rect.left) / rect.width) * this.canvas.width;
        this.aimY = ((t.clientY - rect.top) / rect.height) * this.canvas.height;
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (t.identifier === this.joyTouchId) {
        this.joyTouchId = -1;
        this.joyActive = false;
        this.joyX = 0;
        this.joyY = 0;
      } else if (t.identifier === this.shootTouchId) {
        this.shootTouchId = -1;
        this.shootPressed = false;
      } else if (t.identifier === this.dashTouchId) {
        this.dashTouchId = -1;
        this.dashPressed = false;
      }
    }
  }

  /** Clear per-frame flags — call at end of frame */
  endFrame(): void {
    this.dashJustPressed = false;
  }

  /** Draw virtual controls overlay (screen space) */
  render(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
  ): void {
    if (!this.active) return;

    ctx.save();

    // --- Joystick ---
    if (this.joyActive) {
      // Base circle
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(this.joyBaseX, this.joyBaseY, this.joyRadius, 0, TWO_PI);
      ctx.fill();

      // Knob
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#4fc3f7";
      ctx.beginPath();
      ctx.arc(this.joyKnobX, this.joyKnobY, 25, 0, TWO_PI);
      ctx.fill();
    }

    // --- Dash button hint ---
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#44ff44";
    ctx.beginPath();
    ctx.arc(canvasW - 70, canvasH - 70, 35, 0, TWO_PI);
    ctx.fill();

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("DASH", canvasW - 70, canvasH - 66);

    ctx.restore();
  }
}

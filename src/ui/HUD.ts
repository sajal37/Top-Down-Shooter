// =============================================
// HUD.ts — Heads-up display
//
// Renders in SCREEN space (no camera transform).
// Shows:
//   - Health bar, XP bar, level, kill count
//   - Survival timer, danger level, weapon info
//   - Dash cooldown
//   - FPS counter (#22)
//   - Kill combo (#10)
//   - Sound & fullscreen toggle buttons (#19, #20)
// =============================================

import { Player } from "../entities/Player.js";

// --- Button region for click detection (#19, #20) ---
export interface HUDButton {
  x: number;
  y: number;
  w: number;
  h: number;
  action: string;
}

export class HUD {
  // FPS tracking (#22)
  private fpsFrames: number = 0;
  private fpsTimer: number = 0;
  private fpsDisplay: number = 0;

  // Clickable regions (#19, #20)
  public buttons: HUDButton[] = [];

  /** Call every frame to accumulate FPS data (#22) */
  updateFPS(dt: number): void {
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fpsDisplay = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }
  }

  /**
   * Draw the full HUD overlay.
   * Call AFTER restoring the camera transform so everything
   * is positioned relative to the viewport.
   */
  render(
    ctx: CanvasRenderingContext2D,
    player: Player,
    canvasW: number,
    canvasH: number,
    elapsedTime: number,
    dangerLevel: number,
    soundEnabled: boolean,
  ): void {
    ctx.save();
    this.buttons = [];

    // -----------------------------------------------
    // Health bar (top-left)
    // -----------------------------------------------
    const hbX = 20;
    const hbY = 20;
    const hbW = 250;
    const hbH = 22;
    const hpRatio = player.health / player.maxHealth;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(hbX - 2, hbY - 2, hbW + 4, hbH + 4);

    // Fill colour changes based on remaining HP
    let hpColor = "#44ff44";
    if (hpRatio < 0.3) {
      hpColor = "#ff4444";
    } else if (hpRatio < 0.6) {
      hpColor = "#ffaa00";
    }
    ctx.fillStyle = hpColor;
    ctx.fillRect(hbX, hbY, hbW * hpRatio, hbH);

    // Border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(hbX, hbY, hbW, hbH);

    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "HP " + Math.ceil(player.health) + " / " + player.maxHealth,
      hbX + hbW / 2,
      hbY + 16,
    );

    // -----------------------------------------------
    // XP bar (below health)
    // -----------------------------------------------
    const xbY = hbY + hbH + 10;
    const xpNeeded = player.xpToNextLevel();
    const xpRatio = player.xp / xpNeeded;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(hbX - 2, xbY - 2, hbW + 4, 16);

    ctx.fillStyle = "#00ccff";
    ctx.fillRect(hbX, xbY, hbW * xpRatio, 12);

    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(hbX, xbY, hbW, 12);

    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("XP " + player.xp + " / " + xpNeeded, hbX + hbW / 2, xbY + 10);

    // -----------------------------------------------
    // Level & Kill count
    // -----------------------------------------------
    ctx.textAlign = "left";
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "#ffdd00";
    ctx.fillText("LV " + player.level, hbX, xbY + 32);

    ctx.font = "14px monospace";
    ctx.fillStyle = "#ff8888";
    ctx.fillText("Kills: " + player.killCount, hbX, xbY + 52);

    // -----------------------------------------------
    // Kill combo (#10)
    // -----------------------------------------------
    if (player.combo.count >= 2) {
      ctx.font = "bold 20px monospace";
      ctx.fillStyle = "#ff6600";
      ctx.textAlign = "center";
      ctx.fillText(
        "COMBO x" +
          player.combo.count +
          " (" +
          player.combo.multiplier.toFixed(2) +
          "x XP)",
        canvasW / 2,
        80,
      );
    }

    // -----------------------------------------------
    // Survival timer (top-centre)
    // -----------------------------------------------
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = Math.floor(elapsedTime % 60);
    const timeStr =
      String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");

    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(timeStr, canvasW / 2, 35);

    // -----------------------------------------------
    // Danger level (top-right)
    // -----------------------------------------------
    const drX = canvasW - 20;
    ctx.textAlign = "right";
    ctx.font = "bold 16px monospace";

    let dangerColor = "#44ff44";
    if (dangerLevel >= 7) {
      dangerColor = "#ff4444";
    } else if (dangerLevel >= 4) {
      dangerColor = "#ffaa00";
    }

    ctx.fillStyle = dangerColor;
    ctx.fillText("DANGER: " + dangerLevel + " / 10", drX, 30);

    // Danger bar
    const dbW = 150;
    const dbX = drX - dbW;
    const dbY = 38;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(dbX - 2, dbY - 2, dbW + 4, 10);

    ctx.fillStyle = dangerColor;
    ctx.fillRect(dbX, dbY, dbW * (dangerLevel / 10), 6);

    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(dbX, dbY, dbW, 6);

    // -----------------------------------------------
    // FPS counter (#22) — top-right below danger
    // -----------------------------------------------
    ctx.textAlign = "right";
    ctx.font = "12px monospace";
    ctx.fillStyle = "#888888";
    ctx.fillText("FPS: " + this.fpsDisplay, drX, 65);

    // -----------------------------------------------
    // Sound & Fullscreen toggles (#19, #20) — top-right
    // -----------------------------------------------
    const btnW = 30;
    const btnH = 20;
    const btnY = 75;

    // Sound toggle
    const soundBtnX = drX - btnW;
    ctx.fillStyle = soundEnabled
      ? "rgba(0, 180, 0, 0.5)"
      : "rgba(180, 0, 0, 0.5)";
    ctx.fillRect(soundBtnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(soundBtnX, btnY, btnW, btnH);
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(soundEnabled ? "SND" : "MUT", soundBtnX + btnW / 2, btnY + 15);
    this.buttons.push({
      x: soundBtnX,
      y: btnY,
      w: btnW,
      h: btnH,
      action: "toggleSound",
    });

    // Fullscreen toggle
    const fsBtnX = soundBtnX - btnW - 5;
    ctx.fillStyle = "rgba(60, 60, 100, 0.5)";
    ctx.fillRect(fsBtnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(fsBtnX, btnY, btnW, btnH);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("FS", fsBtnX + btnW / 2, btnY + 15);
    this.buttons.push({
      x: fsBtnX,
      y: btnY,
      w: btnW,
      h: btnH,
      action: "toggleFullscreen",
    });

    // -----------------------------------------------
    // Weapon & stats info (bottom-left)
    // -----------------------------------------------
    const stY = canvasH - 100;
    ctx.textAlign = "left";
    ctx.font = "12px monospace";
    ctx.fillStyle = "#cccccc";

    ctx.fillText("DMG: " + player.damage.toFixed(1), hbX, stY);
    ctx.fillText("SPD: " + player.speed.toFixed(0), hbX, stY + 16);
    ctx.fillText(
      "FIRE RATE: " + player.fireRate.toFixed(1) + "/s",
      hbX,
      stY + 32,
    );

    let weaponLabel = "PISTOL";
    if (player.spreadLevel > 0) {
      weaponLabel += " +SPREAD(" + (1 + player.spreadLevel * 2) + ")";
    }
    if (player.pierceLevel > 0) {
      weaponLabel += " +PIERCE(" + player.pierceLevel + ")";
    }
    ctx.fillStyle = "#ffdd00";
    ctx.fillText(weaponLabel, hbX, stY + 52);

    // -----------------------------------------------
    // Dash cooldown (bottom-right)
    // -----------------------------------------------
    ctx.textAlign = "right";
    if (player.dashCooldownTimer > 0) {
      ctx.fillStyle = "#888888";
      ctx.fillText(
        "DASH: " + player.dashCooldownTimer.toFixed(1) + "s",
        canvasW - 20,
        canvasH - 20,
      );
    } else {
      ctx.fillStyle = "#44ff44";
      ctx.fillText("DASH: READY", canvasW - 20, canvasH - 20);
    }

    ctx.restore();
  }

  /** Check if a screen-space click hits a HUD button. Returns action or null. */
  handleClick(mx: number, my: number): string | null {
    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i];
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        return b.action;
      }
    }
    return null;
  }
}

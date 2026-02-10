// =============================================
// Menu.ts — Start, Pause, Level-Up, and Game Over screens
//
// Each menu is drawn in SCREEN space on top of the gameplay.
// Buttons are tracked as rectangular regions; handleClick()
// tests whether a click lands on any of them and returns the
// corresponding action string (e.g. 'start', 'resume', 'upgrade_1').
// =============================================

import {
  GameState,
  UpgradeOption,
  SaveData,
  Difficulty,
  DIFFICULTY_NAMES,
  DIFFICULTY_COLORS,
  DIFFICULTY_DESCRIPTIONS,
} from "../engine/Utils.js";

/** A clickable rectangular region on a menu screen. */
interface ButtonRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  action: string;
}

export class Menu {
  /** Buttons registered during the most recent render(). */
  private buttons: ButtonRegion[] = [];

  // Cached level-up data (set by render when state === LevelUp)
  public upgradeChoices: UpgradeOption[] = [];
  public upgradeLevels: number[] = [];

  // Mouse position for hover detection (#18)
  private hoverX: number = -1;
  private hoverY: number = -1;

  // Currently highlighted difficulty on the start menu
  public selectedDifficulty: Difficulty = Difficulty.Normal;

  // =============================================
  // Public API
  // =============================================

  /**
   * Draw the appropriate menu overlay.
   * Must be called every frame the menu is visible so that
   * button regions stay in sync with what the player sees.
   */
  render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    w: number,
    h: number,
    data: {
      elapsedTime?: number;
      killCount?: number;
      level?: number;
      saveData?: SaveData;
      upgradeChoices?: UpgradeOption[];
      upgradeLevels?: number[];
      mouseX?: number;
      mouseY?: number;
    },
  ): void {
    // Clear previous frame's buttons
    this.buttons = [];

    // Update hover position (#18)
    this.hoverX = data.mouseX ?? -1;
    this.hoverY = data.mouseY ?? -1;

    if (state === GameState.StartMenu) {
      this.renderStartMenu(ctx, w, h);
    } else if (state === GameState.HowToPlay) {
      this.renderHowToPlay(ctx, w, h);
    } else if (state === GameState.Paused) {
      this.renderPauseMenu(ctx, w, h);
    } else if (state === GameState.LevelUp) {
      if (data.upgradeChoices && data.upgradeLevels) {
        this.upgradeChoices = data.upgradeChoices;
        this.upgradeLevels = data.upgradeLevels;
      }
      this.renderLevelUpMenu(ctx, w, h);
    } else if (state === GameState.GameOver) {
      this.renderGameOverMenu(
        ctx,
        w,
        h,
        data.elapsedTime || 0,
        data.killCount || 0,
        data.level || 1,
        data.saveData || { bestTime: 0, bestKills: 0, bestLevel: 0 },
      );
    }
  }

  /** Returns the action string of the button under (mx, my), or null. */
  handleClick(mx: number, my: number): string | null {
    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i];
      if (
        mx >= b.x &&
        mx <= b.x + b.width &&
        my >= b.y &&
        my <= b.y + b.height
      ) {
        return b.action;
      }
    }
    return null;
  }

  // =============================================
  // Start Menu
  // =============================================

  private renderStartMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    // Full-screen dim
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    let yPos = h * 0.08;

    // Title
    ctx.textAlign = "center";
    ctx.font = "bold 56px monospace";
    ctx.fillStyle = "#4fc3f7";
    ctx.fillText("SURVIVOR", cx, yPos);
    yPos += 45;

    ctx.font = "bold 36px monospace";
    ctx.fillStyle = "#ff6644";
    ctx.fillText("SHOOTER", cx, yPos);
    yPos += 50;

    // Controls list
    ctx.font = "15px monospace";
    ctx.fillStyle = "#aaaaaa";
    const lines = [
      "WASD / Arrows — Move    |    Mouse — Aim",
      "Left Click — Shoot (hold)    |    Space / Right Click — Dash",
      "ESC — Pause    |    M — Sound    |    F — Fullscreen",
    ];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, yPos + i * 22);
    }
    yPos += lines.length * 22 + 25;

    // ---- Difficulty selector ----
    ctx.font = "bold 22px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("SELECT DIFFICULTY", cx, yPos);
    yPos += 20;

    const cardW = 160;
    const cardH = 110;
    const gap = 16;
    const totalW = 4 * cardW + 3 * gap;
    const startX = cx - totalW / 2;

    for (let i = 0; i < 4; i++) {
      const x = startX + i * (cardW + gap);
      const isSelected = i === this.selectedDifficulty;
      const isHovered =
        this.hoverX >= x &&
        this.hoverX <= x + cardW &&
        this.hoverY >= yPos &&
        this.hoverY <= yPos + cardH;

      // Card background
      if (isSelected) {
        ctx.fillStyle = "rgba(80, 100, 160, 0.95)";
      } else if (isHovered) {
        ctx.fillStyle = "rgba(60, 70, 120, 0.9)";
      } else {
        ctx.fillStyle = "rgba(35, 35, 65, 0.9)";
      }
      ctx.fillRect(x, yPos, cardW, cardH);

      // Border
      ctx.strokeStyle = isSelected
        ? DIFFICULTY_COLORS[i]
        : isHovered
          ? "#aaaaaa"
          : "#444466";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(x, yPos, cardW, cardH);

      // Name
      ctx.font = "bold 18px monospace";
      ctx.fillStyle = DIFFICULTY_COLORS[i];
      ctx.fillText(DIFFICULTY_NAMES[i], x + cardW / 2, yPos + 30);

      // Description (word-wrap into up to 3 lines)
      ctx.font = "10px monospace";
      ctx.fillStyle = isSelected ? "#dddddd" : "#999999";
      const desc = DIFFICULTY_DESCRIPTIONS[i];
      const maxLineW = cardW - 20;
      const descWords = desc.split(" ");
      const descLines: string[] = [];
      let curLine = "";
      for (let wi = 0; wi < descWords.length; wi++) {
        const test = curLine + (curLine ? " " : "") + descWords[wi];
        if (ctx.measureText(test).width <= maxLineW) {
          curLine = test;
        } else {
          if (curLine) descLines.push(curLine);
          curLine = descWords[wi];
        }
      }
      if (curLine) descLines.push(curLine);
      for (let li = 0; li < Math.min(descLines.length, 3); li++) {
        ctx.fillText(descLines[li], x + cardW / 2, yPos + 52 + li * 14);
      }

      // Selected indicator
      if (isSelected) {
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = DIFFICULTY_COLORS[i];
        ctx.fillText("▶ SELECTED ◀", x + cardW / 2, yPos + cardH - 12);
      }

      // Register click region (action = "diff_0" through "diff_3")
      this.buttons.push({
        x,
        y: yPos,
        width: cardW,
        height: cardH,
        label: DIFFICULTY_NAMES[i],
        action: "diff_" + i,
      });
    }

    yPos += cardH + 25;

    // Start button
    this.drawButton(ctx, cx - 120, yPos, 240, 50, "START GAME", "start");
    yPos += 60;

    // How to play button
    this.drawButton(ctx, cx - 120, yPos, 240, 40, "HOW TO PLAY", "howtoplay");
    yPos += 60;

    // Footer
    ctx.font = "12px monospace";
    ctx.fillStyle = "#555555";
    ctx.fillText("Built with TypeScript + Canvas 2D", cx, h - 20);
  }

  // =============================================
  // How To Play screen
  // =============================================

  private renderHowToPlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    let y = 32;
    const leftCol = cx - 320;
    const rightCol = cx + 40;
    const colW = 280;

    // ---- Title ----
    ctx.textAlign = "center";
    ctx.font = "bold 34px monospace";
    ctx.fillStyle = "#4fc3f7";
    ctx.fillText("HOW TO PLAY", cx, y);
    y += 14;

    ctx.font = "13px monospace";
    ctx.fillStyle = "#888888";
    ctx.fillText(
      "You are alone. They are many. How long can you last?",
      cx,
      y + 16,
    );
    y += 44;

    // ---- Helper: section label ----
    const sectionLabel = (text: string, xPos: number, yPos: number): number => {
      ctx.textAlign = "left";
      ctx.font = "bold 16px monospace";
      ctx.fillStyle = "#ffdd00";
      ctx.fillText(text, xPos, yPos);
      // underline
      const tw = ctx.measureText(text).width;
      ctx.strokeStyle = "rgba(255, 221, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xPos, yPos + 4);
      ctx.lineTo(xPos + tw, yPos + 4);
      ctx.stroke();
      return yPos + 22;
    };

    // ---- Helper: info line ----
    const infoLine = (
      label: string,
      value: string,
      xPos: number,
      yPos: number,
      labelColor: string = "#aaaaaa",
      valueColor: string = "#ffffff",
    ): number => {
      ctx.textAlign = "left";
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = labelColor;
      ctx.fillText(label, xPos, yPos);
      ctx.font = "12px monospace";
      ctx.fillStyle = valueColor;
      ctx.fillText(value, xPos + ctx.measureText(label).width + 6, yPos);
      return yPos + 17;
    };

    // ========== LEFT COLUMN ==========
    let ly = y;

    // ---- Controls ----
    ly = sectionLabel("CONTROLS", leftCol, ly);
    const controls: [string, string][] = [
      ["WASD / Arrows", "Move"],
      ["Mouse", "Aim"],
      ["Left Click", "Shoot (hold for auto-fire)"],
      ["Space / Right Click", "Dash (has i-frames!)"],
      ["ESC", "Pause"],
      ["M", "Toggle sound"],
      ["F", "Toggle fullscreen"],
    ];
    for (const [key, desc] of controls) {
      ly = infoLine(key, desc, leftCol, ly, "#4fc3f7");
    }
    ly += 8;

    // ---- Enemies ----
    ly = sectionLabel("THE ENEMIES", leftCol, ly);
    const enemies: [string, string, string][] = [
      ["Basic", "Walks at you. Deadly in groups.", "#00cc44"],
      ["Fast", "Double speed. Don't get swarmed.", "#cccc00"],
      ["Tank", "Slow & beefy. Takes forever to kill.", "#cccc00"],
      ["Ranged", "Shoots at you from a distance.", "#ff8800"],
      ["Exploder", "Rushes & DETONATES on death.", "#ff3333"],
      ["Boss", "Massive. Tanky. Spawns on a timer.", "#ff0044"],
    ];
    for (const [name, desc, color] of enemies) {
      ctx.textAlign = "left";
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = color;
      ctx.fillText(name, leftCol, ly);
      ctx.font = "12px monospace";
      ctx.fillStyle = "#999999";
      ctx.fillText(desc, leftCol + 80, ly);
      ly += 17;
    }
    ly += 8;

    // ---- Combo ----
    ly = sectionLabel("COMBO SYSTEM", leftCol, ly);
    ctx.textAlign = "left";
    ctx.font = "12px monospace";
    ctx.fillStyle = "#cccccc";
    const comboLines = [
      "Kill quickly to build a combo chain.",
      "Higher combo = bonus XP per kill.",
      "Stop killing and the timer resets.",
      "Stay aggressive to level up faster!",
    ];
    for (const line of comboLines) {
      ctx.fillText(line, leftCol, ly);
      ly += 16;
    }

    // ========== RIGHT COLUMN ==========
    let ry = y;

    // ---- Upgrades ----
    ry = sectionLabel("UPGRADES", rightCol, ry);
    const upgrades: [string, string, string][] = [
      ["Damage Up", "+25% bullet damage", "x5"],
      ["Fire Rate", "+20% fire rate", "x5"],
      ["Speed Up", "+12% move speed", "x5"],
      ["Max Health", "+1 HP & full heal", "x5"],
      ["Bullet Spd", "+20% bullet velocity", "x5"],
      ["Spread Shot", "+2 bullets per shot", "x3"],
      ["Pierce", "Bullets pass thru +1", "x3"],
      ["Dash CDR", "-25% dash cooldown", "x3"],
    ];
    for (const [name, desc, max] of upgrades) {
      ctx.textAlign = "left";
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#ffdd00";
      ctx.fillText(name, rightCol, ry);
      ctx.font = "12px monospace";
      ctx.fillStyle = "#aaaaaa";
      ctx.fillText(desc, rightCol + 100, ry);
      ctx.fillStyle = "#666666";
      ctx.fillText(max, rightCol + colW - 10, ry);
      ry += 17;
    }
    ry += 8;

    // ---- Build Tips ----
    ry = sectionLabel("BUILD IDEAS", rightCol, ry);
    const builds: [string, string, string][] = [
      ["Glass Cannon", "Dmg + Fire Rate + Spread", "#ff4444"],
      ["Kite King", "Speed + Dash CDR + Bullet Spd", "#44ddff"],
      ["Immortal", "Max HP + Speed + Pierce", "#44ff44"],
      ["Shotgun Maniac", "Spread + Pierce + Damage", "#ffaa00"],
    ];
    for (const [name, desc, color] of builds) {
      ctx.textAlign = "left";
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = color;
      ctx.fillText(name, rightCol, ry);
      ctx.font = "12px monospace";
      ctx.fillStyle = "#999999";
      ctx.fillText(desc, rightCol + 130, ry);
      ry += 17;
    }
    ry += 8;

    // ---- Survival Tips ----
    ry = sectionLabel("SURVIVAL TIPS", rightCol, ry);
    const tips: string[] = [
      "Never stop moving. Standing still = death.",
      "Dash has i-frames. Use it to escape.",
      "Kill Exploders at range. Trust me.",
      "Hunt down Ranged enemies first.",
      "Combos = faster XP = more upgrades.",
      "Don't get cornered against arena walls.",
      "Clear small fry before focusing bosses.",
    ];
    ctx.textAlign = "left";
    ctx.font = "12px monospace";
    for (let i = 0; i < tips.length; i++) {
      ctx.fillStyle = "#4fc3f7";
      ctx.fillText(i + 1 + ".", rightCol, ry);
      ctx.fillStyle = "#cccccc";
      ctx.fillText(tips[i], rightCol + 22, ry);
      ry += 16;
    }

    // ---- Back button ----
    this.drawButton(ctx, cx - 100, h - 60, 200, 42, "BACK", "back");
  }

  // =============================================
  // Pause Menu
  // =============================================

  private renderPauseMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    ctx.textAlign = "center";
    ctx.font = "bold 40px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("PAUSED", cx, cy - 80);

    this.drawButton(ctx, cx - 100, cy - 30, 200, 45, "RESUME", "resume");
    this.drawButton(ctx, cx - 100, cy + 30, 200, 45, "RESTART", "restart");
    this.drawButton(ctx, cx - 100, cy + 90, 200, 45, "QUIT", "quit");
  }

  // =============================================
  // Level-Up Menu (upgrade selection)
  // =============================================

  private renderLevelUpMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;

    // Heading
    ctx.textAlign = "center";
    ctx.font = "bold 36px monospace";
    ctx.fillStyle = "#ffdd00";
    ctx.fillText("LEVEL UP!", cx, 100);

    ctx.font = "18px monospace";
    ctx.fillStyle = "#cccccc";
    ctx.fillText("Choose an upgrade:", cx, 135);

    // --- Upgrade cards ---
    const cardW = 220;
    const cardH = 200;
    const gap = 30;
    const count = this.upgradeChoices.length;
    const totalW = count * cardW + (count - 1) * gap;
    const startX = cx - totalW / 2;
    const cardY = 170;

    for (let i = 0; i < count; i++) {
      const choice = this.upgradeChoices[i];
      const x = startX + i * (cardW + gap);
      const curLvl = this.upgradeLevels[choice.id];

      // Hover check for card (#18)
      const isCardHovered =
        this.hoverX >= x &&
        this.hoverX <= x + cardW &&
        this.hoverY >= cardY &&
        this.hoverY <= cardY + cardH;

      // Card background — highlight on hover
      if (isCardHovered) {
        ctx.fillStyle = "rgba(60, 60, 120, 0.95)";
      } else {
        ctx.fillStyle = "rgba(40, 40, 80, 0.9)";
      }
      ctx.fillRect(x, cardY, cardW, cardH);
      ctx.strokeStyle = isCardHovered ? "#ffffff" : "#4fc3f7";
      ctx.lineWidth = isCardHovered ? 3 : 2;
      ctx.strokeRect(x, cardY, cardW, cardH);

      // Name
      ctx.textAlign = "center";
      ctx.font = "bold 18px monospace";
      ctx.fillStyle = "#ffdd00";
      ctx.fillText(choice.name, x + cardW / 2, cardY + 35);

      // Description
      ctx.font = "13px monospace";
      ctx.fillStyle = "#cccccc";
      ctx.fillText(choice.description, x + cardW / 2, cardY + 65);

      // Current → next level
      ctx.font = "14px monospace";
      ctx.fillStyle = "#88ff88";
      ctx.fillText(
        "Level: " + curLvl + " -> " + (curLvl + 1),
        x + cardW / 2,
        cardY + 95,
      );

      // Level pips (filled vs empty)
      const pipSize = 12;
      const pipGap = 4;
      const pipCount = choice.maxLevel;
      const pipsW = pipCount * (pipSize + pipGap) - pipGap;
      const pipStartX = x + cardW / 2 - pipsW / 2;
      const pipY = cardY + 115;

      for (let p = 0; p < pipCount; p++) {
        const px = pipStartX + p * (pipSize + pipGap);
        if (p <= curLvl) {
          ctx.fillStyle = "#ffdd00";
        } else {
          ctx.fillStyle = "#333333";
        }
        ctx.fillRect(px, pipY, pipSize, pipSize);
        ctx.strokeStyle = "#888888";
        ctx.lineWidth = 1;
        ctx.strokeRect(px, pipY, pipSize, pipSize);
      }

      // Key hint
      ctx.font = "bold 24px monospace";
      ctx.fillStyle = "#4fc3f7";
      ctx.fillText("[" + (i + 1) + "]", x + cardW / 2, cardY + 170);

      // Register clickable region
      this.buttons.push({
        x: x,
        y: cardY,
        width: cardW,
        height: cardH,
        label: choice.name,
        action: "upgrade_" + i,
      });
    }

    ctx.font = "14px monospace";
    ctx.fillStyle = "#888888";
    ctx.fillText(
      "Click a card or press 1, 2, 3 to choose",
      cx,
      cardY + cardH + 30,
    );
  }

  // =============================================
  // Game Over Menu
  // =============================================

  private renderGameOverMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    elapsed: number,
    kills: number,
    level: number,
    save: SaveData,
  ): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Title
    ctx.textAlign = "center";
    ctx.font = "bold 48px monospace";
    ctx.fillStyle = "#ff4444";
    ctx.fillText("GAME OVER", cx, cy - 130);

    // Session stats
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const tStr =
      String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");

    ctx.font = "20px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Time Survived: " + tStr, cx, cy - 60);
    ctx.fillText("Enemies Defeated: " + kills, cx, cy - 30);
    ctx.fillText("Level Reached: " + level, cx, cy);

    // High scores
    ctx.font = "16px monospace";
    ctx.fillStyle = "#ffdd00";

    const bMins = Math.floor(save.bestTime / 60);
    const bSecs = Math.floor(save.bestTime % 60);
    const bStr =
      String(bMins).padStart(2, "0") + ":" + String(bSecs).padStart(2, "0");

    ctx.fillText("--- HIGH SCORES ---", cx, cy + 40);
    ctx.fillText("Best Time: " + bStr, cx, cy + 65);
    ctx.fillText("Most Kills: " + save.bestKills, cx, cy + 90);
    ctx.fillText("Highest Level: " + save.bestLevel, cx, cy + 115);

    // Buttons
    this.drawButton(ctx, cx - 100, cy + 140, 200, 45, "RESTART", "restart");
    this.drawButton(ctx, cx - 100, cy + 200, 200, 45, "MAIN MENU", "quit");
  }

  // =============================================
  // Shared button renderer
  // =============================================

  private drawButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    action: string,
  ): void {
    // Hover detection (#18)
    const isHovered =
      this.hoverX >= x &&
      this.hoverX <= x + w &&
      this.hoverY >= y &&
      this.hoverY <= y + h;

    // Background — brighter on hover
    if (isHovered) {
      ctx.fillStyle = "rgba(80, 100, 160, 0.95)";
    } else {
      ctx.fillStyle = "rgba(60, 60, 100, 0.9)";
    }
    ctx.fillRect(x, y, w, h);

    // Border — highlighted on hover
    ctx.strokeStyle = isHovered ? "#ffffff" : "#4fc3f7";
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(x, y, w, h);

    // Label
    ctx.textAlign = "center";
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = isHovered ? "#ffdd00" : "#ffffff";
    ctx.fillText(label, x + w / 2, y + h / 2 + 7);

    // Register region
    this.buttons.push({ x, y, width: w, height: h, label, action });
  }
}

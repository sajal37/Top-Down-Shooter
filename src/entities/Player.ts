// =============================================
// Player.ts — The player character
//
// Handles movement (WASD / Arrows), aiming (mouse),
// shooting, dashing, invulnerability frames, and
// upgrade application.
// =============================================

import { Input } from "../engine/Input.js";
import { Audio } from "../engine/Audio.js";
import { Bullet } from "./Bullet.js";
import {
  clamp,
  normalize,
  angleBetween,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  TWO_PI,
  UpgradeId,
  UPGRADES,
  ComboState,
  BalanceConfig,
} from "../engine/Utils.js";
import { TouchControls } from "../ui/TouchControls.js";

// --- Dash / rendering constants (not balance-tuned) ---
const DASH_DURATION = 0.15; // seconds
const DASH_SPEED = 800; // px / second

export class Player {
  // ---- Position / physics ----
  public x: number;
  public y: number;
  public radius: number = 16;
  public angle: number = 0; // facing direction (toward mouse)

  // ---- Core stats (modified by upgrades) ----
  public maxHealth: number = 5;
  public health: number = 5;
  public speed: number = 200;
  public fireRate: number = 3;
  public damage: number = 1;
  public bulletSpeed: number = 500;
  public bulletRadius: number = 4;
  public dashCooldown: number = 3;
  public pickupRadius: number = 100;

  // ---- Upgrade tracking ----
  /** upgradeLevels[UpgradeId] = current level (0 = not taken) */
  public upgradeLevels: number[] = [];

  // ---- Weapon modifiers ----
  public spreadLevel: number = 0; // 0→1 bullet, 1→3, 2→5, 3→7
  public pierceLevel: number = 0; // extra enemies a bullet can pass through

  // ---- Shooting timer ----
  private shootTimer: number = 0;

  // ---- Dash ----
  public dashTimer: number = 0; // remaining dash movement time
  public dashCooldownTimer: number = 0; // time until dash available again
  private dashVx: number = 0;
  private dashVy: number = 0;
  public isDashing: boolean = false;

  // ---- Invulnerability ----
  public invulnTimer: number = 0;
  public isInvuln: boolean = false;

  // ---- Session tracking ----
  public xp: number = 0;
  public level: number = 1;
  public killCount: number = 0;
  public alive: boolean = true;

  // ---- Kill combo (#10) ----
  public combo: ComboState = { count: 0, timer: 0, multiplier: 1 };

  // ---- Muzzle flash position (#13) ----
  public muzzleX: number = 0;
  public muzzleY: number = 0;
  public justFired: boolean = false;

  // ---- Balance config (set by applyBalance) ----
  private bal!: BalanceConfig;

  // ---- References ----
  private input: Input;
  private audio: Audio;
  private touch: TouchControls | null = null;

  constructor(
    x: number,
    y: number,
    input: Input,
    audio: Audio,
    touch?: TouchControls,
  ) {
    this.x = x;
    this.y = y;
    this.input = input;
    this.audio = audio;
    this.touch = touch || null;

    // Initialize every upgrade to level 0
    for (let i = 0; i < UPGRADES.length; i++) {
      this.upgradeLevels.push(0);
    }
  }

  /** Apply a balance config (called when difficulty is selected). */
  applyBalance(bal: BalanceConfig): void {
    this.bal = bal;
    // Apply base stats from the config
    this.maxHealth = bal.playerMaxHealth;
    this.health = bal.playerMaxHealth;
    this.speed = bal.playerSpeed;
    this.fireRate = bal.playerFireRate;
    this.damage = bal.playerDamage;
    this.bulletSpeed = bal.playerBulletSpeed;
    this.bulletRadius = 4;
    this.dashCooldown = bal.playerDashCooldown;
    this.pickupRadius = bal.playerPickupRadius;
  }

  // =============================================
  // XP / Level helpers
  // =============================================

  /** XP required to advance from current level to the next. */
  xpToNextLevel(): number {
    return this.level * this.bal.xpPerLevelMult + this.bal.xpPerLevelBase;
  }

  /** Check threshold and level up if ready. Returns true when a level-up occurs. */
  checkLevelUp(): boolean {
    const needed = this.xpToNextLevel();
    if (this.xp >= needed) {
      this.xp -= needed;
      this.level++;
      this.audio.playLevelUp();
      return true;
    }
    return false;
  }

  // =============================================
  // Upgrade application
  // =============================================

  applyUpgrade(id: UpgradeId): void {
    this.upgradeLevels[id]++;
    const lvl = this.upgradeLevels[id];

    if (id === UpgradeId.Damage) {
      this.damage =
        this.bal.playerDamage * (1 + lvl * this.bal.upgDamagePerLevel);
    } else if (id === UpgradeId.FireRate) {
      this.fireRate =
        this.bal.playerFireRate * (1 + lvl * this.bal.upgFireRatePerLevel);
    } else if (id === UpgradeId.MoveSpeed) {
      this.speed =
        this.bal.playerSpeed * (1 + lvl * this.bal.upgMoveSpeedPerLevel);
    } else if (id === UpgradeId.MaxHealth) {
      this.maxHealth =
        this.bal.playerMaxHealth + lvl * this.bal.upgMaxHealthPerLevel;
      this.health = this.maxHealth; // full heal
    } else if (id === UpgradeId.BulletSpeed) {
      this.bulletSpeed =
        this.bal.playerBulletSpeed *
        (1 + lvl * this.bal.upgBulletSpeedPerLevel);
    } else if (id === UpgradeId.SpreadShot) {
      this.spreadLevel = lvl;
    } else if (id === UpgradeId.Pierce) {
      this.pierceLevel = lvl;
    } else if (id === UpgradeId.DashCDR) {
      this.dashCooldown = this.bal.playerDashCooldown * Math.pow(0.75, lvl);
    }
  }

  // =============================================
  // Main update — returns new bullets (or null)
  // =============================================

  /**
   * @param dt          delta time in seconds
   * @param worldMouseX mouse X in world coordinates
   * @param worldMouseY mouse Y in world coordinates
   * @returns           array of bullets if the player fired, else null
   */
  update(
    dt: number,
    worldMouseX: number,
    worldMouseY: number,
  ): Bullet[] | null {
    this.justFired = false;

    // Update combo timer (#10)
    if (this.combo.timer > 0) {
      this.combo.timer -= dt;
      if (this.combo.timer <= 0) {
        this.combo.count = 0;
        this.combo.multiplier = 1;
      }
    }

    // Face the mouse
    this.angle = angleBetween(this.x, this.y, worldMouseX, worldMouseY);

    // --- Invulnerability countdown ---
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.isInvuln = this.invulnTimer > 0;
    }

    // --- Dash cooldown countdown ---
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= dt;
    }

    // --- Active dash movement (overrides normal movement) ---
    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      } else {
        this.x += this.dashVx * dt;
        this.y += this.dashVy * dt;
        this.x = clamp(this.x, this.radius, ARENA_WIDTH - this.radius);
        this.y = clamp(this.y, this.radius, ARENA_HEIGHT - this.radius);
        return null; // can't shoot while dashing
      }
    }

    // --- Normal movement (WASD / Arrows / Touch joystick #21) ---
    let dx = 0;
    let dy = 0;
    if (this.input.isKeyDown("w") || this.input.isKeyDown("arrowup")) dy = -1;
    if (this.input.isKeyDown("s") || this.input.isKeyDown("arrowdown")) dy = 1;
    if (this.input.isKeyDown("a") || this.input.isKeyDown("arrowleft")) dx = -1;
    if (this.input.isKeyDown("d") || this.input.isKeyDown("arrowright")) dx = 1;

    // Touch joystick override (#21)
    if (this.touch && this.touch.active) {
      if (Math.abs(this.touch.joyX) > 0.1 || Math.abs(this.touch.joyY) > 0.1) {
        dx = this.touch.joyX;
        dy = this.touch.joyY;
      }
    }

    // Normalize so diagonal movement isn't faster
    if (dx !== 0 || dy !== 0) {
      const n = normalize(dx, dy);
      this.x += n.x * this.speed * dt;
      this.y += n.y * this.speed * dt;
    }

    // Arena bounds
    this.x = clamp(this.x, this.radius, ARENA_WIDTH - this.radius);
    this.y = clamp(this.y, this.radius, ARENA_HEIGHT - this.radius);

    // --- Dash trigger (Space or Right-click or Touch dash #21) ---
    const dashWanted =
      this.input.wasKeyPressed(" ") ||
      this.input.rightMouseJustPressed ||
      (this.touch !== null && this.touch.dashJustPressed);
    if (dashWanted && this.dashCooldownTimer <= 0 && !this.isDashing) {
      this.isDashing = true;
      this.dashTimer = DASH_DURATION;
      this.dashCooldownTimer = this.dashCooldown;

      // Dash direction: movement direction if moving, else toward mouse
      if (dx !== 0 || dy !== 0) {
        const n = normalize(dx, dy);
        this.dashVx = n.x * DASH_SPEED;
        this.dashVy = n.y * DASH_SPEED;
      } else {
        this.dashVx = Math.cos(this.angle) * DASH_SPEED;
        this.dashVy = Math.sin(this.angle) * DASH_SPEED;
      }

      // Brief invuln during dash
      this.invulnTimer = DASH_DURATION + 0.1;
      this.isInvuln = true;
      this.audio.playDash();
    }

    // --- Shooting (mouse or touch #21) ---
    this.shootTimer -= dt;
    let newBullets: Bullet[] | null = null;

    const wantsShoot =
      this.input.mouseDown || (this.touch !== null && this.touch.shootPressed);

    if (wantsShoot && this.shootTimer <= 0) {
      this.shootTimer = 1 / this.fireRate;
      newBullets = this.createBullets(worldMouseX, worldMouseY);
      this.audio.playShoot();

      // Track muzzle flash position (#13)
      const spawnDist = this.radius + 5;
      this.muzzleX = this.x + Math.cos(this.angle) * spawnDist;
      this.muzzleY = this.y + Math.sin(this.angle) * spawnDist;
      this.justFired = true;
    }

    return newBullets;
  }

  // =============================================
  // Combo tracking (#10)
  // =============================================

  /** Call when a kill is scored. Returns XP multiplier. */
  registerKill(): number {
    this.combo.count++;
    this.combo.timer = this.bal.comboTimeout;
    this.combo.multiplier = 1 + (this.combo.count - 1) * this.bal.comboXpBonus;
    return this.combo.multiplier;
  }

  // =============================================
  // Bullet factory (handles spread)
  // =============================================

  private createBullets(targetX: number, targetY: number): Bullet[] {
    const bullets: Bullet[] = [];
    const baseAngle = angleBetween(this.x, this.y, targetX, targetY);
    const count = 1 + this.spreadLevel * 2; // 1, 3, 5, or 7
    const SPREAD_ANGLE = 0.15; // radians between adjacent bullets

    // Compute starting offset so the pattern is centred on baseAngle
    const halfSpread = ((count - 1) * SPREAD_ANGLE) / 2;

    for (let i = 0; i < count; i++) {
      let angle: number;
      if (count === 1) {
        angle = baseAngle;
      } else {
        angle = baseAngle - halfSpread + i * SPREAD_ANGLE;
      }

      const vx = Math.cos(angle) * this.bulletSpeed;
      const vy = Math.sin(angle) * this.bulletSpeed;

      // Spawn slightly in front of the player
      const spawnDist = this.radius + 5;
      const spawnX = this.x + Math.cos(angle) * spawnDist;
      const spawnY = this.y + Math.sin(angle) * spawnDist;

      bullets.push(
        new Bullet(
          spawnX,
          spawnY,
          vx,
          vy,
          this.bulletRadius,
          this.damage,
          this.pierceLevel,
        ),
      );
    }

    return bullets;
  }

  // =============================================
  // Combat
  // =============================================

  /** Take damage. Returns true if the player dies. */
  takeDamage(amount: number): boolean {
    if (this.isInvuln) return false;

    this.health -= amount;
    this.invulnTimer = this.bal.playerInvulnDuration;
    this.isInvuln = true;

    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.audio.playDeath();
      return true;
    }
    return false;
  }

  /** Heal the player (clamped to max). */
  heal(amount: number): void {
    this.health += amount;
    if (this.health > this.maxHealth) {
      this.health = this.maxHealth;
    }
  }

  // =============================================
  // Rendering
  // =============================================

  render(ctx: CanvasRenderingContext2D): void {
    // Blink effect during invulnerability: skip draw on even 0.1s intervals
    if (this.isInvuln) {
      if (Math.floor(this.invulnTimer * 10) % 2 === 0) {
        return;
      }
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // Dash trail aura
    if (this.isDashing) {
      ctx.fillStyle = "rgba(100, 200, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.5, 0, TWO_PI);
      ctx.fill();
    }

    // --- Body circle ---
    ctx.fillStyle = "#4fc3f7";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, TWO_PI);
    ctx.fill();

    // Outline
    ctx.strokeStyle = "#0288d1";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(
      -this.radius * 0.2,
      -this.radius * 0.2,
      this.radius * 0.4,
      0,
      TWO_PI,
    );
    ctx.fill();

    // --- Gun barrel (direction indicator) ---
    ctx.rotate(this.angle);
    ctx.fillStyle = "#78909c";
    ctx.fillRect(this.radius * 0.3, -3, this.radius * 0.9, 6);

    ctx.restore();
  }

  // =============================================
  // Reset for new game
  // =============================================

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.maxHealth = this.bal.playerMaxHealth;
    this.health = this.bal.playerMaxHealth;
    this.speed = this.bal.playerSpeed;
    this.fireRate = this.bal.playerFireRate;
    this.damage = this.bal.playerDamage;
    this.bulletSpeed = this.bal.playerBulletSpeed;
    this.bulletRadius = 4;
    this.dashCooldown = this.bal.playerDashCooldown;
    this.pickupRadius = this.bal.playerPickupRadius;
    this.spreadLevel = 0;
    this.pierceLevel = 0;
    this.shootTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.isDashing = false;
    this.invulnTimer = 0;
    this.isInvuln = false;
    this.xp = 0;
    this.level = 1;
    this.killCount = 0;
    this.alive = true;
    this.angle = 0;
    this.combo = { count: 0, timer: 0, multiplier: 1 };
    this.justFired = false;

    // Reset all upgrade levels to 0
    for (let i = 0; i < this.upgradeLevels.length; i++) {
      this.upgradeLevels[i] = 0;
    }
  }
}

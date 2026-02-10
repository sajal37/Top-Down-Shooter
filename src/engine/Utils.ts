// =============================================
// Utils.ts — Math helpers, constants, shared types
//
// Central repository for all game constants (#7),
// enumerations, and shared interfaces.
// =============================================

// --- Arena dimensions ---
export const ARENA_WIDTH = 3000;
export const ARENA_HEIGHT = 2000;

// --- Frame timing ---
export const MAX_DT = 0.05; // clamp delta time to 50ms max

// --- Useful math constants ---
export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;

// --- Named constants (#7 — no more magic numbers) ---
export const HEALTH_DROP_CHANCE = 0.08;
export const DEATH_PARTICLE_COUNT = 8;
export const HIT_PARTICLE_COUNT = 5;
export const PICKUP_ATTRACT_SPEED = 300;
export const COMBO_TIMEOUT = 2.0; // seconds between kills to maintain combo
export const COMBO_XP_BONUS = 0.25; // +25% XP per combo step
export const MAX_BULLETS = 500;
export const MAX_ENEMIES = 200;
export const MAX_PICKUPS = 300;
export const MAX_ENEMY_BULLETS = 200;
export const BOSS_DANGER_INTERVAL = 5; // boss spawns every 5 danger levels
export const GRID_SIZE = 80; // background grid cell size
export const SPATIAL_CELL_SIZE = 120; // collision spatial grid cell
export const DEBRIS_COUNT = 40; // background debris items (#17)

// =============================================
// Difficulty system — 4 presets that tune every balance lever
// =============================================

export enum Difficulty {
  Easy = 0,
  Normal = 1,
  Hard = 2,
  Nightmare = 3,
}

export const DIFFICULTY_NAMES: string[] = [
  "EASY",
  "NORMAL",
  "HARD",
  "NIGHTMARE",
];
export const DIFFICULTY_COLORS: string[] = [
  "#44ff44",
  "#4fc3f7",
  "#ff8844",
  "#ff2222",
];
export const DIFFICULTY_DESCRIPTIONS: string[] = [
  "Relaxed pace, extra health, generous drops",
  "The intended experience",
  "Faster spawns, tougher foes, less healing",
  "Overwhelming hordes, punishing damage",
];

/**
 * Every tuneable balance value, grouped by category.
 * One instance per difficulty preset.
 */
export interface BalanceConfig {
  // --- Player ---
  playerMaxHealth: number;
  playerSpeed: number;
  playerFireRate: number;
  playerDamage: number;
  playerBulletSpeed: number;
  playerDashCooldown: number;
  playerInvulnDuration: number;
  playerPickupRadius: number;
  // --- Player upgrade multipliers (per-level) ---
  upgDamagePerLevel: number; // fraction added per level (e.g. 0.25 = +25%)
  upgFireRatePerLevel: number;
  upgMoveSpeedPerLevel: number;
  upgMaxHealthPerLevel: number; // flat HP added per level
  upgBulletSpeedPerLevel: number;
  // --- XP / leveling ---
  xpPerLevelBase: number; // xpToNextLevel = level * xpPerLevelMult + xpPerLevelBase
  xpPerLevelMult: number;
  // --- Combo ---
  comboTimeout: number;
  comboXpBonus: number;
  // --- Health drops ---
  healthDropChance: number;
  // --- Spawner ---
  baseSpawnInterval: number;
  minSpawnInterval: number;
  spawnIntervalDecay: number;
  maxSpawnPerTick: number;
  initialSpawnDelay: number;
  maxEnemies: number;
  bossInterval: number; // boss every N danger levels
  dangerPeriod: number; // seconds per danger level
  spawnCountDivisor: number; // multi-spawn: 1 + floor(time / this)
  // --- Enemy scaling ---
  enemySpeedScale: number; // HP multiplied by (1 + diffScale * this)
  enemyHpScale: number; // speed multiplied by (1 + diffScale * this)
  enemyContactCooldown: number;
  // --- Enemy type configs [Basic, Fast, Tank, Boss, Ranged, Exploder] ---
  enemyHpMult: number[]; // per-type HP multiplier (applied to base config)
  enemySpeedMult: number[]; // per-type speed multiplier
  enemyDamageMult: number[]; // per-type damage multiplier
  // --- Ranged ---
  rangedFireRate: number;
  rangedBulletSpeed: number;
  // --- Exploder ---
  explodeRadius: number;
  explodeSpeedBoost: number;
  // --- Enemy type spawn phases (time thresholds) ---
  earlyPhaseEnd: number; // seconds — end of "early game"
  midPhaseEnd: number; // seconds — end of "mid game"
}

// =============================================
// Difficulty presets
// =============================================

const EASY: BalanceConfig = {
  // Player — generous
  playerMaxHealth: 8,
  playerSpeed: 230,
  playerFireRate: 4,
  playerDamage: 1.5,
  playerBulletSpeed: 550,
  playerDashCooldown: 2,
  playerInvulnDuration: 1.5,
  playerPickupRadius: 160,
  // Upgrades — strong
  upgDamagePerLevel: 0.35,
  upgFireRatePerLevel: 0.25,
  upgMoveSpeedPerLevel: 0.15,
  upgMaxHealthPerLevel: 2,
  upgBulletSpeedPerLevel: 0.25,
  // XP — fast levels
  xpPerLevelBase: 3,
  xpPerLevelMult: 5,
  // Combo — forgiving
  comboTimeout: 3.0,
  comboXpBonus: 0.35,
  // Health — generous
  healthDropChance: 0.15,
  // Spawner — relaxed
  baseSpawnInterval: 3.0,
  minSpawnInterval: 0.6,
  spawnIntervalDecay: 0.008,
  maxSpawnPerTick: 3,
  initialSpawnDelay: 3,
  maxEnemies: 120,
  bossInterval: 8,
  dangerPeriod: 40,
  spawnCountDivisor: 60,
  // Enemy scaling — gentle
  enemySpeedScale: 0.08,
  enemyHpScale: 0.15,
  enemyContactCooldown: 0.8,
  // Per-type multipliers (base × this)
  enemyHpMult: [0.7, 0.8, 0.7, 0.6, 0.8, 0.8],
  enemySpeedMult: [0.85, 0.85, 0.85, 0.85, 0.85, 0.85],
  enemyDamageMult: [1, 1, 1, 1, 1, 0.7],
  // Ranged — less threatening
  rangedFireRate: 0.8,
  rangedBulletSpeed: 140,
  // Exploder — less lethal
  explodeRadius: 60,
  explodeSpeedBoost: 1.2,
  // Phases — longer early game
  earlyPhaseEnd: 50,
  midPhaseEnd: 120,
};

const NORMAL: BalanceConfig = {
  // Player — standard
  playerMaxHealth: 5,
  playerSpeed: 200,
  playerFireRate: 3,
  playerDamage: 1,
  playerBulletSpeed: 500,
  playerDashCooldown: 3,
  playerInvulnDuration: 1.0,
  playerPickupRadius: 100,
  // Upgrades — standard
  upgDamagePerLevel: 0.25,
  upgFireRatePerLevel: 0.2,
  upgMoveSpeedPerLevel: 0.12,
  upgMaxHealthPerLevel: 1,
  upgBulletSpeedPerLevel: 0.2,
  // XP — standard
  xpPerLevelBase: 5,
  xpPerLevelMult: 8,
  // Combo
  comboTimeout: 2.0,
  comboXpBonus: 0.25,
  // Health
  healthDropChance: 0.08,
  // Spawner
  baseSpawnInterval: 2.0,
  minSpawnInterval: 0.3,
  spawnIntervalDecay: 0.015,
  maxSpawnPerTick: 5,
  initialSpawnDelay: 2,
  maxEnemies: 200,
  bossInterval: 5,
  dangerPeriod: 30,
  spawnCountDivisor: 45,
  // Enemy scaling
  enemySpeedScale: 0.15,
  enemyHpScale: 0.3,
  enemyContactCooldown: 0.5,
  // Per-type multipliers — baseline 1.0
  enemyHpMult: [1, 1, 1, 1, 1, 1],
  enemySpeedMult: [1, 1, 1, 1, 1, 1],
  enemyDamageMult: [1, 1, 1, 1, 1, 1],
  // Ranged
  rangedFireRate: 1.5,
  rangedBulletSpeed: 200,
  // Exploder
  explodeRadius: 80,
  explodeSpeedBoost: 1.5,
  // Phases
  earlyPhaseEnd: 30,
  midPhaseEnd: 90,
};

const HARD: BalanceConfig = {
  // Player — weaker
  playerMaxHealth: 4,
  playerSpeed: 190,
  playerFireRate: 2.5,
  playerDamage: 1,
  playerBulletSpeed: 480,
  playerDashCooldown: 3.5,
  playerInvulnDuration: 0.7,
  playerPickupRadius: 80,
  // Upgrades — weaker
  upgDamagePerLevel: 0.2,
  upgFireRatePerLevel: 0.15,
  upgMoveSpeedPerLevel: 0.1,
  upgMaxHealthPerLevel: 1,
  upgBulletSpeedPerLevel: 0.15,
  // XP — slower
  xpPerLevelBase: 7,
  xpPerLevelMult: 10,
  // Combo — stricter
  comboTimeout: 1.5,
  comboXpBonus: 0.2,
  // Health — scarce
  healthDropChance: 0.04,
  // Spawner — aggressive
  baseSpawnInterval: 1.5,
  minSpawnInterval: 0.2,
  spawnIntervalDecay: 0.02,
  maxSpawnPerTick: 6,
  initialSpawnDelay: 1.5,
  maxEnemies: 250,
  bossInterval: 4,
  dangerPeriod: 25,
  spawnCountDivisor: 35,
  // Enemy scaling — steep
  enemySpeedScale: 0.2,
  enemyHpScale: 0.4,
  enemyContactCooldown: 0.35,
  // Per-type multipliers — stronger enemies
  enemyHpMult: [1.3, 1.2, 1.3, 1.2, 1.2, 1.2],
  enemySpeedMult: [1.1, 1.1, 1.1, 1.1, 1.1, 1.15],
  enemyDamageMult: [1, 1, 1.5, 1.5, 1, 1.5],
  // Ranged — more dangerous
  rangedFireRate: 2.2,
  rangedBulletSpeed: 260,
  // Exploder — bigger boom
  explodeRadius: 100,
  explodeSpeedBoost: 1.8,
  // Phases — shorter early advantage
  earlyPhaseEnd: 20,
  midPhaseEnd: 60,
};

const NIGHTMARE: BalanceConfig = {
  // Player — fragile
  playerMaxHealth: 3,
  playerSpeed: 175,
  playerFireRate: 2,
  playerDamage: 1,
  playerBulletSpeed: 450,
  playerDashCooldown: 4.5,
  playerInvulnDuration: 0.4,
  playerPickupRadius: 60,
  // Upgrades — minimal impact
  upgDamagePerLevel: 0.15,
  upgFireRatePerLevel: 0.12,
  upgMoveSpeedPerLevel: 0.08,
  upgMaxHealthPerLevel: 1,
  upgBulletSpeedPerLevel: 0.12,
  // XP — grueling
  xpPerLevelBase: 10,
  xpPerLevelMult: 14,
  // Combo — almost no window
  comboTimeout: 1.0,
  comboXpBonus: 0.1,
  // Health — almost none
  healthDropChance: 0.02,
  // Spawner — overwhelming
  baseSpawnInterval: 1.0,
  minSpawnInterval: 0.12,
  spawnIntervalDecay: 0.03,
  maxSpawnPerTick: 8,
  initialSpawnDelay: 0.5,
  maxEnemies: 350,
  bossInterval: 3,
  dangerPeriod: 20,
  spawnCountDivisor: 25,
  // Enemy scaling — brutal
  enemySpeedScale: 0.25,
  enemyHpScale: 0.5,
  enemyContactCooldown: 0.2,
  // Per-type multipliers — lethal
  enemyHpMult: [1.5, 1.5, 1.6, 1.5, 1.4, 1.4],
  enemySpeedMult: [1.2, 1.2, 1.15, 1.15, 1.15, 1.3],
  enemyDamageMult: [1.5, 1.5, 2, 2, 1.5, 2],
  // Ranged — relentless
  rangedFireRate: 3.0,
  rangedBulletSpeed: 320,
  // Exploder — devastating
  explodeRadius: 120,
  explodeSpeedBoost: 2.0,
  // Phases — thrown in the deep end
  earlyPhaseEnd: 12,
  midPhaseEnd: 40,
};

export const DIFFICULTY_CONFIGS: BalanceConfig[] = [
  EASY,
  NORMAL,
  HARD,
  NIGHTMARE,
];

/** Get the balance config for a difficulty preset */
export function getBalanceConfig(difficulty: Difficulty): BalanceConfig {
  return DIFFICULTY_CONFIGS[difficulty];
}

// --- Game states ---
export enum GameState {
  StartMenu = 0,
  Playing = 1,
  Paused = 2,
  LevelUp = 3,
  GameOver = 4,
  HowToPlay = 5,
}

// --- Enemy types (#8, #9 — Boss, Ranged, Exploder) ---
export enum EnemyType {
  Basic = 0,
  Fast = 1,
  Tank = 2,
  Boss = 3,
  Ranged = 4,
  Exploder = 5,
}

// --- Upgrade identifiers ---
export enum UpgradeId {
  Damage = 0,
  FireRate = 1,
  MoveSpeed = 2,
  MaxHealth = 3,
  BulletSpeed = 4,
  SpreadShot = 5,
  Pierce = 6,
  DashCDR = 7,
}

// --- Entity interface (#5 — shared base for all game entities) ---
export interface Entity {
  x: number;
  y: number;
  radius: number;
  alive: boolean;
}

// --- Shared interfaces ---

export interface UpgradeOption {
  id: UpgradeId;
  name: string;
  description: string;
  maxLevel: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}

/** Expanding ring on enemy death (#15) */
export interface DeathRing {
  x: number;
  y: number;
  radius: number;
  expandSpeed: number;
  life: number;
  maxLife: number;
  color: string;
}

/** Camera state (kept for compatibility; CameraController is preferred) */
export interface Camera {
  x: number;
  y: number;
  shakeOffsetX: number;
  shakeOffsetY: number;
  shakeTimer: number;
  shakeIntensity: number;
}

export interface SaveData {
  bestTime: number;
  bestKills: number;
  bestLevel: number;
}

/** Kill combo tracker (#10) */
export interface ComboState {
  count: number;
  timer: number;
  multiplier: number;
}

/** Background decoration item (#17) */
export interface Debris {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

// --- Master upgrade definitions ---
export const UPGRADES: UpgradeOption[] = [
  {
    id: UpgradeId.Damage,
    name: "Damage Up",
    description: "+25% bullet damage",
    maxLevel: 5,
  },
  {
    id: UpgradeId.FireRate,
    name: "Fire Rate Up",
    description: "+20% fire rate",
    maxLevel: 5,
  },
  {
    id: UpgradeId.MoveSpeed,
    name: "Speed Up",
    description: "+12% move speed",
    maxLevel: 5,
  },
  {
    id: UpgradeId.MaxHealth,
    name: "Max Health Up",
    description: "+1 max HP & full heal",
    maxLevel: 5,
  },
  {
    id: UpgradeId.BulletSpeed,
    name: "Bullet Speed Up",
    description: "+20% bullet speed",
    maxLevel: 5,
  },
  {
    id: UpgradeId.SpreadShot,
    name: "Spread Shot",
    description: "+2 bullets per shot",
    maxLevel: 3,
  },
  {
    id: UpgradeId.Pierce,
    name: "Pierce",
    description: "Bullets pierce +1 foe",
    maxLevel: 3,
  },
  {
    id: UpgradeId.DashCDR,
    name: "Dash CDR",
    description: "-25% dash cooldown",
    maxLevel: 3,
  },
];

// =============================================
// Math helper functions
// =============================================

/** Clamp value between min and max (inclusive) */
export function clamp(val: number, min: number, max: number): number {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

/** Random float in [min, max) */
export function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Random integer in [min, max] (inclusive both ends) */
export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Euclidean distance between two points */
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Squared distance — avoids sqrt when only comparing magnitudes */
export function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/** Normalize a 2D vector. Returns zero vector if length is 0. */
export function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/** Angle in radians from point (x1,y1) to point (x2,y2) */
export function angleBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Linear interpolation between a and b */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Fast circle-vs-circle overlap test (no sqrt) */
export function circlesOverlap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const combined = r1 + r2;
  return dx * dx + dy * dy <= combined * combined;
}

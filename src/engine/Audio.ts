// =============================================
// Audio.ts — Simple retro beep sounds using the Web Audio API
//
// AudioContext is lazily created on first sound to satisfy
// browser autoplay policies (must come from user gesture).
//
// Includes:
//   - Toggle on/off (#19)
//   - Boss roar, explosion, ranged shot sounds (#8, #9)
// =============================================

export class Audio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _enabled: boolean = true;

  constructor() {
    // Intentionally empty — context created on demand
  }

  // -----------------------------------------------
  // Public toggle (#19)
  // -----------------------------------------------

  get enabled(): boolean {
    return this._enabled;
  }

  /** Toggle sound on/off. Returns the new enabled state. */
  toggle(): boolean {
    this._enabled = !this._enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = this._enabled ? 0.3 : 0;
    }
    return this._enabled;
  }

  // -----------------------------------------------
  // Internal helpers
  // -----------------------------------------------

  /** Ensure the AudioContext exists. Returns false on failure. */
  private ensureContext(): boolean {
    if (this.ctx) return true;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._enabled ? 0.3 : 0;
      this.masterGain.connect(this.ctx.destination);
      return true;
    } catch {
      this._enabled = false;
      return false;
    }
  }

  /** Play a single tone with quick exponential fade-out to avoid clicks. */
  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "square",
    volume: number = 0.3,
    delay: number = 0,
  ): void {
    if (!this._enabled) return;
    if (!this.ensureContext()) return;
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  // -----------------------------------------------
  // Public sound effects
  // -----------------------------------------------

  playShoot(): void {
    this.playTone(800, 0.05, "square", 0.12);
  }

  playHit(): void {
    this.playTone(200, 0.1, "sawtooth", 0.15);
  }

  playPickup(): void {
    this.playTone(1200, 0.08, "sine", 0.12);
  }

  playLevelUp(): void {
    // Short ascending arpeggio
    this.playTone(400, 0.1, "sine", 0.18, 0);
    this.playTone(600, 0.1, "sine", 0.18, 0.08);
    this.playTone(800, 0.15, "sine", 0.18, 0.16);
  }

  playDeath(): void {
    this.playTone(150, 0.3, "sawtooth", 0.25);
  }

  playDash(): void {
    this.playTone(400, 0.08, "triangle", 0.12);
  }

  /** Deep rumble for boss spawn (#8) */
  playBossRoar(): void {
    this.playTone(80, 0.5, "sawtooth", 0.3, 0);
    this.playTone(60, 0.3, "square", 0.2, 0.2);
  }

  /** Explosion sound for exploder enemies (#9) */
  playExplosion(): void {
    this.playTone(100, 0.25, "sawtooth", 0.25);
    this.playTone(60, 0.15, "square", 0.2, 0.05);
  }

  /** Ranged enemy shot (#9) */
  playEnemyShoot(): void {
    this.playTone(400, 0.06, "sawtooth", 0.08);
  }

  /** Kill combo ping (#10) */
  playCombo(): void {
    this.playTone(1000, 0.06, "sine", 0.1);
  }
}

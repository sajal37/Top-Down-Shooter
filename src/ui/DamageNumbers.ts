// =============================================
// DamageNumbers.ts — Floating damage text (#11)
//
// Shows damage values rising and fading above enemies
// when they take hits. Larger text for bigger damage.
// =============================================

export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  life: number;
  maxLife: number;
  color: string;
  vy: number;
  fontSize: number;
}

const DAMAGE_NUMBER_LIFE = 0.8;
const DAMAGE_NUMBER_RISE_SPEED = -60;

export class DamageNumberSystem {
  public numbers: DamageNumber[] = [];

  spawn(x: number, y: number, value: number, color: string = "#ffffff"): void {
    // Slight horizontal scatter to avoid overlap
    const fontSize = value >= 5 ? 22 : value >= 2 ? 18 : 14;
    this.numbers.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      value,
      life: DAMAGE_NUMBER_LIFE,
      maxLife: DAMAGE_NUMBER_LIFE,
      color,
      vy: DAMAGE_NUMBER_RISE_SPEED,
      fontSize,
    });
  }

  update(dt: number): void {
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.y += n.vy * dt;
      n.life -= dt;

      if (n.life <= 0) {
        this.numbers[i] = this.numbers[this.numbers.length - 1];
        this.numbers.pop();
      }
    }
  }

  /** Render in world space (call inside camera transform) */
  render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.numbers.length; i++) {
      const n = this.numbers[i];
      const alpha = n.life / n.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = n.color;
      ctx.font = `bold ${n.fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(
        n.value % 1 === 0 ? String(n.value) : n.value.toFixed(1),
        n.x,
        n.y,
      );
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.numbers.length = 0;
  }
}

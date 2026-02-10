// =============================================
// ObjectPool.ts — Generic object pool to reduce GC pressure
//
// Reuses objects instead of allocating new ones every frame.
// Dramatically reduces garbage collection pauses for bullets,
// particles, and pickups.
// =============================================

export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private resetFn: (obj: T) => void;

  constructor(
    factory: () => T,
    resetFn: (obj: T) => void,
    initialSize: number = 0,
  ) {
    this.factory = factory;
    this.resetFn = resetFn;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T): void {
    this.resetFn(obj);
    this.pool.push(obj);
  }

  releaseMany(arr: T[]): void {
    for (let i = 0; i < arr.length; i++) {
      this.resetFn(arr[i]);
      this.pool.push(arr[i]);
    }
  }

  get available(): number {
    return this.pool.length;
  }
}

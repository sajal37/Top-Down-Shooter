// =============================================
// Input.ts — Keyboard + mouse input handling
//
// Tracks:
//   - keys currently held (isKeyDown)
//   - keys freshly pressed this frame (wasKeyPressed)
//   - mouse screen position, button states, and just-pressed flags
//   - focus loss / visibility change (#23)
//
// Call endFrame() at the END of each game loop tick to clear
// the per-frame "just pressed" flags.
// =============================================

export class Input {
  // --- Internal state ---
  private keysDown: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();

  // --- Public mouse state ---
  /** Mouse X in canvas pixel coordinates */
  public mouseX: number = 0;
  /** Mouse Y in canvas pixel coordinates */
  public mouseY: number = 0;

  public mouseDown: boolean = false;
  public mouseJustPressed: boolean = false;

  public rightMouseDown: boolean = false;
  public rightMouseJustPressed: boolean = false;

  // --- Focus loss detection (#23) ---
  public focusLost: boolean = false;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // --- Keyboard listeners (attached to window so they work even if
    //     canvas isn't focused) ---

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!this.keysDown.has(key)) {
        this.keysJustPressed.add(key);
      }
      this.keysDown.add(key);

      // Prevent browser default for game-relevant keys
      if (key === " " || key === "escape" || key.startsWith("arrow")) {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      this.keysDown.delete(key);
    });

    // --- Mouse listeners (attached to canvas) ---

    canvas.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      // Scale mouse coords to match canvas internal resolution
      // (handles CSS scaling if present)
      this.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    });

    canvas.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseJustPressed = true;
      } else if (e.button === 2) {
        this.rightMouseDown = true;
        this.rightMouseJustPressed = true;
      }
    });

    canvas.addEventListener("mouseup", (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseDown = false;
      } else if (e.button === 2) {
        this.rightMouseDown = false;
      }
    });

    // Suppress the browser context menu on right-click
    canvas.addEventListener("contextmenu", (e: Event) => {
      e.preventDefault();
    });

    // --- Focus / visibility loss detection (#23) ---
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.focusLost = true;
        // Release all keys when tabbing away
        this.keysDown.clear();
        this.mouseDown = false;
        this.rightMouseDown = false;
      }
    });

    window.addEventListener("blur", () => {
      this.focusLost = true;
      this.keysDown.clear();
      this.mouseDown = false;
      this.rightMouseDown = false;
    });
  }

  /** Is the key currently held down? Use lowercase names (e.g. 'w', ' ', 'arrowup'). */
  isKeyDown(key: string): boolean {
    return this.keysDown.has(key);
  }

  /** Was the key freshly pressed THIS frame? Cleared at end of frame. */
  wasKeyPressed(key: string): boolean {
    return this.keysJustPressed.has(key);
  }

  /** Call once at the END of each frame to clear per-frame flags. */
  endFrame(): void {
    this.keysJustPressed.clear();
    this.mouseJustPressed = false;
    this.rightMouseJustPressed = false;
    this.focusLost = false;
  }
}

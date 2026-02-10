// =============================================
// main.ts — Application entry point
//
// Waits for the DOM to load, grabs the <canvas>,
// instantiates the Game, and starts the loop.
// =============================================

import { Game } from "./engine/Game.js";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
  if (!canvas) {
    throw new Error("Canvas element #gameCanvas not found");
  }

  const game = new Game(canvas);
  game.start();
});

# 🔫 Survivor Shooter

A fast-paced top-down arena shooter built from scratch with **TypeScript** and the **HTML5 Canvas API**. No frameworks, no game engine — just math and pixels.

Survive endless waves of increasingly dangerous enemies, collect XP, level up, choose powerful upgrades, and see how long you can last.

**[▶ Play Now](https://sajal37.github.io/Top-Down-Shooter/)** · **[Report Bug](https://github.com/sajal37/Top-Down-Shooter/issues)**

---

## ✨ Features

- **6 Enemy Types** — Basic, Fast, Tank, Ranged, Exploder, and Boss, each with unique behavior
- **8 Upgrades** — Damage, fire rate, speed, health, bullet speed, spread shot, pierce, and dash CDR
- **4 Difficulty Presets** — Easy, Normal, Hard, and Nightmare with full balance scaling
- **Combo System** — Chain kills for bonus XP; aggression is rewarded
- **Particle Effects** — Muzzle flash, bullet trails, hit sparks, death rings, and explosions
- **Camera System** — Smooth follow with screen shake on impacts
- **Object Pooling** — Efficient entity reuse for smooth performance
- **Spatial Grid Collision** — Fast broad-phase collision detection
- **Mobile Support** — Touch controls with virtual joystick
- **Persistent Records** — Best time, kills, and level saved to localStorage
- **In-Game Guide** — Full "How to Play" screen accessible from the main menu

---

## 🛠️ Tech Stack

| Technology      | Purpose                                         |
| --------------- | ----------------------------------------------- |
| TypeScript      | Game logic, strict typing                       |
| HTML5 Canvas 2D | All rendering — no DOM manipulation in gameplay |
| Web Audio API   | Procedurally generated sound effects            |
| localStorage    | Save/load high scores                           |

**Zero runtime dependencies.** Only `typescript` as a dev dependency.

---

## 📁 Project Structure

```
├── index.html              # Entry point
├── style.css               # Minimal canvas styling
├── package.json            # Project metadata & scripts
├── tsconfig.json           # TypeScript configuration
└── src/
    ├── main.ts             # Bootstrap — creates canvas & starts game
    ├── engine/
    │   ├── Audio.ts        # Procedural sound effects (Web Audio API)
    │   ├── Camera.ts       # Smooth follow camera with shake
    │   ├── Game.ts         # Core loop, state machine, entity management
    │   ├── Input.ts        # Keyboard + mouse input handling
    │   ├── ObjectPool.ts   # Generic object pool for entity reuse
    │   ├── ParticleSystem.ts # Particles, death rings, burst effects
    │   └── Utils.ts        # Constants, types, enums, balance configs
    ├── entities/
    │   ├── Bullet.ts       # Player & enemy projectiles with trails
    │   ├── Enemy.ts        # 6 enemy types with polygon rendering
    │   ├── Pickup.ts       # XP orbs & health drops with magnet behavior
    │   └── Player.ts       # Movement, shooting, dash, upgrades, combo
    ├── systems/
    │   ├── Collision.ts    # Spatial grid broad-phase + narrow-phase
    │   └── Spawner.ts      # Wave logic, enemy type selection, boss timer
    └── ui/
        ├── DamageNumbers.ts # Floating damage text
        ├── HUD.ts          # Health bar, XP bar, FPS, combo, toggles
        ├── Menu.ts         # Start, pause, level-up, game over, how-to-play
        ├── ScreenEffects.ts # Damage vignette, muzzle flash overlay
        └── TouchControls.ts # Mobile virtual joystick & fire button
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Setup

```bash
# Clone the repository
git clone https://github.com/sajal37/Top-Down-Shooter.git
cd Top-Down-Shooter

# Install dependencies
npm install

# Build
npm run build

# Open in browser
# Simply open index.html in any modern browser — no server required
```

### Development

```bash
# Watch mode — recompiles on save
npm run watch
```

Then open `index.html` in your browser. Refresh after changes compile.

---

## 🎮 How to Play

### Controls

| Action                | Input                            |
| --------------------- | -------------------------------- |
| **Move**              | `WASD` or `Arrow Keys`           |
| **Aim**               | Mouse cursor                     |
| **Shoot**             | `Left Click` (hold to auto-fire) |
| **Dash**              | `Space` or `Right Click`         |
| **Pause**             | `Escape`                         |
| **Toggle Sound**      | `M`                              |
| **Toggle Fullscreen** | `F`                              |

> Touch controls appear automatically on mobile devices.

### Enemies

| Enemy        | Behavior                               | Threat       |
| ------------ | -------------------------------------- | ------------ |
| **Basic**    | Walks toward you. Deadly in packs.     | 🟢 Low       |
| **Fast**     | Same idea, twice the speed.            | 🟡 Medium    |
| **Tank**     | Slow and beefy. Takes forever to kill. | 🟡 Medium    |
| **Ranged**   | Stops at distance and shoots at you.   | 🟠 High      |
| **Exploder** | Rushes you, detonates on death.        | 🔴 Very High |
| **Boss**     | Massive. Tanky. Spawns on a timer.     | 💀 Extreme   |

### Upgrades

| Upgrade         | Effect                        | Max |
| --------------- | ----------------------------- | --- |
| Damage Up       | +25% bullet damage            | 5   |
| Fire Rate Up    | +20% fire rate                | 5   |
| Speed Up        | +12% move speed               | 5   |
| Max Health Up   | +1 HP & full heal             | 5   |
| Bullet Speed Up | +20% bullet velocity          | 5   |
| Spread Shot     | +2 bullets per shot           | 3   |
| Pierce          | Bullets pass through +1 enemy | 3   |
| Dash CDR        | -25% dash cooldown            | 3   |

### Difficulty

| Preset           | Description                                           |
| ---------------- | ----------------------------------------------------- |
| 🟢 **Easy**      | Relaxed pace, extra health, generous drops            |
| 🔵 **Normal**    | The intended experience — balanced scaling            |
| 🟠 **Hard**      | Faster spawns, tougher enemies, scarce healing        |
| 🔴 **Nightmare** | You start fragile. Enemies are relentless. Good luck. |

### Tips

1. **Keep moving.** Standing still is how you die.
2. **Dash through danger.** It has invincibility frames.
3. **Kill Exploders at range.** The detonation hurts.
4. **Hunt Ranged enemies.** Off-screen bullets ruin runs.
5. **Chain kills for combos.** Bonus XP means faster upgrades.
6. **Don't get cornered.** The arena walls are not your friend.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

_Built with TypeScript + Canvas 2D. No frameworks. No engine. Just math and pixels._

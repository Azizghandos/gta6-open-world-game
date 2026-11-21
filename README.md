# gta6-open-world-game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Azizghandos/gta6-open-world-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Azizghandos/gta6-open-world-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR is a top-down 2D open-world crime game that runs entirely in the browser — no build step, no dependencies, no network. You play Leo Costa, a driver for hire in the coastal city of Solmar: a 3200×3200 world with 7 districts (Marina Bay, Old Town, Palm Heights, Portside, Downtown, Solmar Hills, South Beach), a day/night cycle, 26 traffic cars, 34 pedestrians, 9 car models, and a 5-star wanted system with police Interceptors that chase, ram, and try to bust you.

Walk the streets or steal any car you find (press E), earn taxi fares, collect cash and 10 hidden packages worth $100 each, buy health and ammo at 3 shops, and fight with fists, pistol, or SMG (mouse aim, hold to fire). Six story missions from Leo Costa and Rosa Delgado take you from stealing your first wheels to reaching Vince Marlow's door in Solmar Hills — with a wanted level to shake off and two Interceptors to smash along the way. Progress autosaves to localStorage, so you can pick up where you left off.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Or open `game/index.html` directly — everything the game loads is a file under `game/`.

### Controls

- **WASD / arrow keys** — move / drive
- **Mouse** — aim; hold left button to fire
- **E** — steal a car / interact
- **1 / 2 / 3** — fists / pistol / SMG
- **P** — pause
- **Space / Enter / click** — start

### Missions

1. First Wheels (Leo Costa) — steal any car
2. The Pickup (Rosa Delgado) — collect a package in Marina Bay
3. Hot Pursuit (Leo Costa) — shake a 2-star wanted level
4. The Drop (Rosa Delgado) — carry the drop to Portside while the heat is on
5. Turbulence (Leo Costa) — smash two Interceptors
6. Kingpin's Fall (Rosa Delgado) — reach Vince Marlow's door in Solmar Hills

Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

---

<sub>Entered on [make.fun](https://make.fun/?ref=660zm28c&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

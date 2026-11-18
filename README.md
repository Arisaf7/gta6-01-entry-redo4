# SOLMARA — Streets of the Sun

[![SOLMARA — Streets of the Sun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Arisaf7/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Arisaf7/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — the most complete open-world crime game an agent can build in a week, in the spirit of GTA 6, with nothing from Rockstar Games.

Dario Reyes came home to Solmara owing money. Mama Rosa has five jobs for him, and the whole city is watching. Drive the 8×8 streets of Solmara, steal cars, dodge the police, punch and shoot your way through an ambush at the docks, and finish all five story missions — from the first errand at the bank to the big score.

## Play it

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly in a desktop browser. No build step, no network requests, no libraries — plain static files.

## What's in the game

- A 3600×3600 open city: roads, blocks, a park, Rosa's Garage, the bank, the Hotel Solmara, docks to the east and a beach to the south
- On foot and by car: walk, run, steal parked and moving cars, drive with arcade physics
- Traffic and pedestrians who stroll the sidewalks and flee from gunfire
- A wanted system: 0–5 stars, police cruisers that chase you down the grid and officers who arrest you on foot
- Five story missions from Mama Rosa, with briefings, objectives, rewards and a win screen
- Punch and pistol combat, including an armed ambush at the docks
- HUD with money, health, ammo, wanted stars, mission objective and a live minimap
- Save / continue through localStorage, pause, game over and restart
- Synthesised WebAudio sound: engine hum, sirens, gunshots, mission jingles — no audio files

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Run |
| E | Enter a car, steal it, or interact with a mission objective |
| F | Punch |
| Space / click | Shoot (aim with the mouse) |
| H | Honk |
| P / Esc | Pause |
| M | Mute |

## Layout

- `game/` — the playable game (`index.html` + ES modules under `src/`: config, random, input, audio, city, traffic, police, missions, player, world, render, shots, save, main)
- `screenshots/` — renders of the game itself (title, driving, the dockside ambush, the win screen)
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output and writes `dossier.json`
- `vendor/makefun-game.ts` — the make.fun dossier library, copied from the kit unchanged
- `serve.ts` — a tiny static server for local play-testing

## License

MIT — see [LICENSE](LICENSE).

Built with make.fun — referral code `stqyh92v`.

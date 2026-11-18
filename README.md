[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Krwanz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Krwanz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay

An original 2D top-down open-world crime game, made for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). No libraries, no network requests — just a canvas, a city, and a debt to pay off.

You are Rico Vale, a courier who owes $4,000 to loan shark Marina Kessler. Work the debt off across five missions: steal a car, run a package to the pier, grab a stash from a market guarded by thugs, pull a bank job and outrun a three-star chase to the hideout, then make one final delivery to the airfield.

The city is an 8×8 street grid with buildings, parks, and a bay-side beach. Explore it on foot (WASD) or behind the wheel (accelerate, steer, handbrake). Traffic cars fill the roads, pedestrians cross the streets, and parked cars can be stolen with a key press. Cause trouble and the wanted stars climb — police spawn, chase, ram, and arrest on foot; lay low and the heat cools off. On-foot combat is fists and a pistol, and the HUD tracks your stars, cash, health, and current objective, with a live minimap showing the streets, the cars, the police, and the next mission marker. There is a start screen (continue or start fresh), pause, busted and down screens, and progress saves to localStorage so you can pick up where you left off.

## How to run it

Open `game/index.html` in a desktop browser, or serve the `game/` folder with any static server and open the page it serves. `main.ts` builds the dossier (`dossier.json`) for the entry.

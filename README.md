# THE LAST SAVE

**A turn-based story RPG about exploring a fractured world, building a hero, and discovering what the game remembers.**

▶️ **[Play THE LAST SAVE in your browser](https://lseeecubb-code.github.io/rpg-game/)**

## Start playing

1. Open the game link above.
2. Type **explore** and press **Enter** to travel and advance the story.
3. Type **menu** to see every command. You can enter a command by name or select its number.

The game runs in the browser and saves progress automatically. Use the **music volume slider** in the toolbar to adjust or mute background music. Sound effects have a separate setting. The input line supports command history with the up and down arrow keys.

## What you can do

- **Explore and choose your approach.** Follow enemy tracks, investigate a discovery, or leave both leads. Random encounters can include groups. Before an ordinary encounter, choose whether to fight or spare the enemy; sparing grants no XP, loot, or kill progress.
- **Fight tactically.** Enemy moves show their accuracy and intent. Attacks can miss, and an opening gives you a chance to respond. In a group battle, enemies take their turns one at a time. Learn elemental weaknesses, build break and stagger, and use parries, guards, spells, items, and companions.
- **Hear a distinct battle song for every enemy.** Each enemy name deterministically generates its own melody, harmony, rhythm, tempo, key, and lead sound in your browser. Music works offline and needs no downloaded audio files.
- **Shape your character.** Allocate Strength, Agility, Vitality, and Focus; learn spells and perks; preview stat changes before equipping or upgrading weapons, armor, shields, headgear, and trinkets; and craft gear from materials.
- **Keep a campaign chronicle.** Your major discoveries, choices, companions, and ending are saved in the **chronicle**. Use **replay** or **replay [chapter]** to revisit completed chapters with companion memories and see a what-if ending, without changing campaign progress.
- **Follow the story.** Progress through 11 chapters, finish side quests, meet companions, uncover secrets, and choose an ending. Completed campaigns unlock New Game+.
- **Take on optional challenges.** Run five-floor dungeons with a rest-or-push decision between floors, climb the endless tower, or discover a five-island raid. Raids have no timer; after an island, continue or leave. Clearing all five islands earns bonus rewards and raid tokens for permanent upgrades.
- **Explore the Quiet Road in more depth.** Take four linked Wayrest jobs, meet mosslings, burrow rats, and lantern thieves, and choose how to handle an injured courier or fallen waystone. At level 3, finishing the jobs can reveal the optional Mossback Guardian. Those encounters teach early recipes for useful boots, charms, a buckler, and field stew.
- **Find more stories off the main road.** The Broken Frontier has a scout mission and outrider materials. The Cathedral of Ash has a linked Bellkeeper quest and a hidden bell boss. Later regions hold the Archive's Index Hound, three regional surveys, and the optional Lost Cartographer hunt.
- **Track rewards clearly.** Combat presents earned XP, coins, and item drops in short reward lines.

## Useful commands

| Command | What it does |
| --- | --- |
| **explore** | Travel, meet encounters, make choices, and advance the campaign |
| **map** | Pick a safe road or a risky shortcut once in each chapter |
| **story** / **guide** | Review the current objective or get progression guidance |
| **chronicle** | Review recorded campaign moments |
| **replay** / **replay [chapter]** | Revisit a completed chapter and view an alternate ending preview |
| **quests** | View and turn in available side quests |
| **fight (enemy name)** | Challenge a discovered enemy when it is unlocked |
| **bestiary (enemy name)** | Review enemy attacks, accuracy, drops, and weaknesses |
| **stats** / **allocate** | Review your stats or spend stat points |
| **inventory** / **equip (item name)** | Manage supplies and gear |
| **craft (item name) (amount)** / **recipes** | Craft items or browse and track recipes |
| **party** | Review companions and choose your active ally |
| **dungeon** / **tower** / **raids** | Enter an optional combat challenge |
| **town** | Rest, trade, upgrade equipment, or train |
| **save** / **saves** | Save now or manage local save slots |
| **copy** / **load** | Copy a portable save code or load one |
| **menu** | See the complete command list |

Stat points can be spent by number or name. For example, **allocate 2 3** spends three points on Agility; **allocate vitality 2** spends two on Vitality. Check **stats** to see your available points.

## Progression

The main route moves through these regions:

1. The Quiet Road
2. The Broken Frontier
3. The Cathedral of Ash
4. The Null Expanse
5. The Unfinished Room
6. Outside the World
7. The Archive of Attempts
8. The Hollow Kingdom
9. The Margin
10. The Blank Page
11. The Last Autosave

Type **story** for your current objective or **guide** for level targets and the campaign route. Visit **town** and choose the Wayrest quest board to accept the new early jobs. Side quests and optional bosses are separate from the chapter objectives, so you can return to them when you are ready.

## Saves and offline play

Progress autosaves in the browser. Use **saves** to manage local slots, or **copy** and **load** to move a save with its code. The tower leaderboard is stored separately in the current browser.

To play offline, download or clone this repository and keep the project files together. Open **index.html** in a modern browser. The live site is the easiest way to keep browser saves and the tower leaderboard available.

## Custom enemy music

See [ENEMY_MUSIC_GUIDE.md](ENEMY_MUSIC_GUIDE.md) for adding audio tracks, assigning boss phase music, and troubleshooting playback. Enemy audio files belong in **audio/enemies/**.

## Project files

- **index.html** — page layout, styles, and script loading
- **index.js**, **commands.js**, **helpers.js** — startup, command input, and shared helpers
- **story.js**, **dialogue.js**, **rpgSystems.js** — campaign, exploration, quests, raids, dungeons, and tower
- **combat.js**, **monsters.js**, **effects.js** — battles, enemy data, and combat effects
- **items.js**, **playerGear.js**, **crafting.js** — items, stats, equipment, and crafting
- **saves.js**, **admin.js**, **typewriter.js** — save handling, developer utilities, and text display
- **audio/** — optional enemy music
- **patches/** — historical patch files kept for reference; the JavaScript files above are the current game source

## Contributing

For a code change, edit the current source files, keep item, enemy, and recipe names consistent across their data files, and update the script version query in **index.html** when a browser cache refresh is needed.


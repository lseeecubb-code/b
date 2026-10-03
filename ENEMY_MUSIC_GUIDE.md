# Enemy Music Guide

This guide explains how to add a custom music file to an enemy in **THE LAST SAVE**. Enemies without a custom track continue using the game's synthesized battle music.

## 1. Add the audio file

Create an `audio/enemies` folder in the project and put your audio file there. For example:

```text
audio/
└── enemies/
    └── wyvern.mp3
```

MP3 is a good default. Audio format support depends on the browser.

## 2. Assign it to an enemy

Open `monsters.js` and find that enemy's entry in the `monsters` object. Add a `music_file` property with the path from the project folder:

```js
"wyvern": {
  // Existing enemy settings...
  music_file: "audio/enemies/wyvern.mp3",
},
```

Keep the property inside the enemy object and add a comma after it if more properties follow.

## 3. Give a boss phase its own track (optional)

Open the `BOSS_PHASE_TWO` object in `monsters.js` and add `music_file` to the phase you want to customize:

```js
"the last save": {
  // Existing phase settings...
  music_file: "audio/enemies/last-save-phase-two.mp3",
},
```

A phase-specific file is used for that phase. If you leave the property off, the phase uses its synthesized theme (or the boss's configured file when one is set).

## 4. Try it in a fight

Start the game, make sure sound is enabled, and enter a battle with that enemy. The track loops during battle and stops when combat ends or the game switches back to exploration music.

## If the custom track does not play

The game automatically falls back to its synthesized battle theme when the file cannot be found, loaded, or played. Check that:

- The file exists at the exact path in `music_file`. Capitalization must match on GitHub Pages.
- The file is included in the project when you publish or download the game.
- The browser supports the file's audio format and sound is enabled.
- You are testing on the published game or a local web server if your browser restricts media loaded from `file://`.

Leave `music_file` out to use synthesized battle music at any time.

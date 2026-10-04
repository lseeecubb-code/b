# Enemy Music Guide

This guide explains how enemy and ambient music files are organized in **THE LAST SAVE**.

## 1. Add the audio file

Enemy and boss remasters used during normal play are stored under `audio/remastered/enemies`. Each roster entry maps to a kebab-case WAV filename. For example:

```text
audio/
└── remastered/
    └── enemies/
        └── wyvern.wav
```

Ambient remasters are under `audio/remastered/ambient`.

## 2. Enemy file names

The game assigns these files automatically in `monsters.js`. Boss phase-two files use the suffix `-phase-two.wav`, such as `wyvern-phase-two.wav`. Keep filenames aligned with the enemy music slug. For example, the clean Wyvern theme is:

`audio/remastered/enemies/wyvern.wav`

## 3. Preserved distortion tracks

Original tracks are kept separately:

`audio/distorted/enemies/` and `audio/distorted/ambient/`

When the terminal displays corruption or a reality cut, playback temporarily uses the matching original file from `audio/distorted`, then returns to the remaster.

## 4. Try it in a fight

The music volume slider controls enemy and ambient tracks. Background ambience begins after the first user interaction.

## If the custom track does not play

The game falls back to synthesized music when a remaster cannot be found, loaded, or played. Check that:

- The file exists at the exact remastered path. Capitalization must match on GitHub Pages.
- The file is included in the project when you publish or download the game.
- The browser supports WAV audio.
- You are testing on the published game or a local web server if your browser restricts media loaded from `file://`.

Keep the remastered and distorted filenames in sync so corruption moments can find their original counterpart.

"""Render hand-authored scores for the clean soundtrack set.

Each enemy has an explicit score below (tempo, key, mode, palette, rhythm,
chords, and melody). This script only renders those authored choices to WAV.
The game's existing audio files are kept separately for corruption moments.
"""
from pathlib import Path
import hashlib
import json
import wave

import numpy as np

SR = 22050
ENEMY_OUT = Path("audio/remastered/enemies")
AMBIENT_OUT = Path("audio/remastered/ambient")
ENEMY_OUT.mkdir(parents=True, exist_ok=True)
AMBIENT_OUT.mkdir(parents=True, exist_ok=True)

MODES = {
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "harmonic": [0, 2, 3, 5, 7, 8, 11],
    "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "major": [0, 2, 4, 5, 7, 9, 11],
    "lydian": [0, 2, 4, 6, 7, 9, 11],
    "whole": [0, 2, 4, 6, 8, 10],
    "locrian": [0, 1, 3, 5, 6, 8, 10],
    "pent_minor": [0, 3, 5, 7, 10],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
}

# Inharmonic partials and gentle detuning give each patch a distinct body.
PATCHES = {
    "cello": [(1,.75),(1.006,.42),(2.01,.28),(3.02,.16),(4.04,.08)],
    "strings": [(1,.7),(1.004,.55),(2.01,.33),(3.02,.2),(4.03,.11),(5.04,.05)],
    "brass": [(1,.76),(2,.66),(3,.48),(4,.28),(5,.16),(6,.08)],
    "horn": [(1,.72),(2,.54),(3,.39),(4,.2),(5,.12)],
    "woodwind": [(1,1),(2.01,.16),(3.03,.08),(4.02,.03)],
    "flute": [(1,1),(2,.04),(3,.015)],
    "harp": [(1,1),(2,.52),(3,.24),(4,.13),(5,.06)],
    "lute": [(1,.85),(2.01,.58),(3.04,.3),(4.1,.16),(5.2,.07)],
    "bell": [(1,.42),(2.76,.4),(5.4,.27),(8.93,.17),(12.1,.08)],
    "crystal": [(1,.35),(2.71,.39),(4.98,.27),(7.4,.2),(10.2,.13),(13.4,.06)],
    "organ": [(1,.8),(2,.52),(3,.3),(4,.22),(5,.12),(6,.06)],
    "choir": [(.5,.2),(1,.8),(1.003,.46),(2.01,.34),(3.02,.18),(4.03,.08)],
    "reed": [(1,.78),(2,.08),(3,.4),(4,.06),(5,.17),(7,.05)],
    "metal": [(1,.62),(2.71,.43),(4.36,.28),(6.83,.18),(9.2,.08)],
    "woodblock": [(1,.72),(2.4,.25),(3.8,.13),(5.9,.05)],
    "rubber": [(1,.7),(1.49,.32),(2.17,.24),(3.71,.11)],
    "sub": [(1,1),(1.5,.2),(2.01,.1)],
    "fuzz": [(1,.65),(2,.7),(3,.58),(4,.4),(5,.25),(6,.14)],
    "twang": [(1,.64),(2.01,.51),(3.02,.32),(4.13,.2),(5.3,.1)],
    "marimba": [(1,.72),(2.76,.34),(4.8,.19),(7.1,.1)],
    "glass": [(1,.48),(2.76,.42),(5.4,.29),(8.93,.16)],
    "chime": [(1,.38),(2.03,.22),(3.96,.31),(6.15,.13),(8.7,.08)],
    "bowed": [(1,.62),(1.008,.57),(2.02,.3),(3.03,.14),(4.04,.08)],
    "bass": [(1,.9),(2,.32),(3,.13)],
    "accordion": [(1,.7),(2,.55),(3,.34),(4,.16),(5,.08)],
    "nylon": [(1,.8),(2,.4),(3,.18),(4,.08)],
    "dulcimer": [(1,.45),(2.01,.38),(3.01,.27),(4.03,.17),(5.04,.08)],
    "paper": [(1,.55),(2.63,.38),(4.2,.2),(6.1,.11)],
    "plucked-glass": [(1,.48),(2.71,.4),(5.2,.22),(8.1,.1)],
    "gear": [(1,.7),(1.98,.45),(3.03,.3),(4.1,.16),(6.2,.08)],
    "breath": [(1,.78),(1.006,.48),(2.01,.22),(3.02,.1)],
    "echo": [(1,.58),(1.5,.3),(2.01,.22),(3.02,.1)],
}

SCORES = {}


def score(name, bpm, root, mode, lead, bed, groove, chords, melody, grid=8):
    SCORES[name] = {
        "bpm": bpm, "root": root, "mode": mode, "lead": lead, "bed": bed,
        "groove": groove, "chords": chords, "melody": melody, "grid": grid,
    }


# Hand-authored enemy and boss scores. Rests are -1; scale degrees are relative
# to each score's named mode. Related creatures share a family sound, not a score.
score("rat", 154, 52, "phrygian", "woodblock", "lute", "skitter", [0,5,2,6], [0,3,-1,5,2,6,1,-1], 12)
score("slime", 88, 43, "whole", "rubber", "sub", "bubbles", [0,3,1,4], [0,-1,4,2,-1,5,1,-1], 6)
score("goblin", 142, 48, "dorian", "lute", "accordion", "shuffle", [0,3,5,2], [0,3,2,-1,5,4,1,3])
score("wolf", 112, 40, "minor", "cello", "strings", "stalk", [0,5,3,1], [0,-1,4,2,-1,5,3,1], 6)
score("wild-boar", 132, 38, "mixolydian", "horn", "cello", "stomp", [0,4,2,5], [0,2,2,-1,5,3,1,0], 4)
score("zombie", 76, 39, "locrian", "choir", "organ", "plod", [0,2,5,1], [0,-1,1,-1,4,2,-1,5], 4)
score("giant-spider", 148, 45, "phrygian", "bowed", "harp", "skitter", [0,4,1,5], [0,5,1,6,2,-1,4,1], 16)
score("skeleton", 118, 47, "harmonic", "woodblock", "dulcimer", "rattle", [0,3,6,2], [0,3,0,5,1,4,2,-1], 12)
score("giant-crab", 102, 37, "dorian", "metal", "sub", "clank", [0,4,1,5], [0,-1,0,3,5,-1,2,0], 4)
score("harpy", 137, 58, "lydian", "flute", "strings", "flutter", [0,4,1,5], [0,4,2,6,3,5,1,4], 12)
score("armored-goblin", 126, 46, "minor", "lute", "metal", "shuffle", [0,4,3,5], [0,2,4,-1,3,5,2,0])
score("orc", 124, 41, "minor", "brass", "cello", "march", [0,5,3,6], [0,0,4,3,5,4,2,0])
score("bandit", 127, 50, "mixolydian", "twang", "nylon", "shuffle", [0,4,5,3], [0,3,2,4,1,5,3,-1])
score("bandit-captain", 136, 47, "dorian", "twang", "brass", "march", [0,5,2,4], [0,3,5,2,6,4,1,0])
score("witch", 86, 45, "harmonic", "glass", "choir", "ritual", [0,1,5,3], [0,1,5,2,6,3,1,4], 6)
score("fire-elemental", 153, 42, "phrygian", "fuzz", "brass", "rush", [0,3,6,2], [0,4,1,5,2,6,3,0], 16)
score("werewolf", 164, 39, "harmonic", "fuzz", "cello", "rush", [0,5,2,6], [0,3,5,2,6,4,1,5], 16)
score("dire-wolf", 98, 36, "minor", "bowed", "sub", "heartbeat", [0,6,3,5], [0,-1,5,3,-1,6,2,0], 4)
score("troll", 92, 35, "minor", "horn", "sub", "stomp", [0,3,5,2], [0,0,2,-1,5,3,1,0], 4)
score("ice-golem", 82, 40, "lydian", "crystal", "organ", "sparse-bell", [0,4,2,5], [0,-1,4,6,-1,3,5,-1], 4)
score("vampire", 106, 46, "harmonic", "accordion", "strings", "waltz", [0,5,1,4], [0,4,2,5,3,1,6,4], 6)
score("ogre", 89, 37, "pent_minor", "horn", "sub", "stomp", [0,3,4,2], [0,-1,2,0,4,-1,3,0], 4)
score("berserker", 168, 40, "phrygian", "fuzz", "brass", "rush", [0,2,5,3], [0,3,5,2,6,4,1,5], 16)
score("wraith", 72, 44, "locrian", "breath", "choir", "free", [0,5,1,6], [0,-1,5,-1,1,4,-1,6], 5)
score("lich", 96, 39, "harmonic", "organ", "choir", "ritual", [0,1,5,2], [0,1,5,4,2,6,3,0], 6)
score("stone-golem", 84, 36, "dorian", "metal", "organ", "clank", [0,4,1,5], [0,-1,0,3,5,-1,2,0], 4)
score("dragon", 116, 38, "minor", "brass", "strings", "war", [0,5,3,6], [0,4,3,6,5,2,4,0])
score("ancient-dragon", 108, 34, "harmonic", "brass", "choir", "war", [0,6,3,5], [0,5,3,6,4,2,5,0])
score("wyvern", 146, 49, "lydian", "flute", "brass", "flutter", [0,3,5,1], [0,5,2,6,3,1,4,6], 12)
score("demon", 134, 35, "locrian", "fuzz", "choir", "ritual", [0,1,4,6], [0,6,1,5,2,4,0,3], 6)
score("frost-giant", 80, 37, "lydian", "horn", "crystal", "march", [0,4,2,5], [0,-1,4,6,3,-1,5,1], 4)
score("mossling", 106, 53, "major", "woodwind", "harp", "organic", [0,4,1,5], [0,2,5,4,1,3,6,2], 7)
score("burrow-rat", 166, 49, "minor", "woodblock", "bass", "skitter", [0,3,5,1], [0,5,2,6,1,4,0,3], 16)
score("lantern-thief", 104, 54, "pent_minor", "plucked-glass", "nylon", "sneak", [0,4,2,3], [0,-1,5,1,-1,4,2,6], 8)
score("mossback-guardian", 94, 39, "dorian", "cello", "woodwind", "stomp", [0,3,5,4], [0,3,5,2,4,1,6,0], 4)
score("dust-jackal", 121, 43, "minor", "reed", "cello", "stalk", [0,4,2,6], [0,4,1,5,2,6,3,0], 6)
score("frontier-marksman", 120, 50, "mixolydian", "twang", "nylon", "sneak", [0,4,5,3], [0,-1,4,2,-1,5,3,1], 8)
score("bellbound-acolyte", 98, 48, "mixolydian", "bell", "choir", "toll", [0,4,2,5], [0,4,2,6,5,3,1,4], 4)
score("null-leech", 64, 32, "locrian", "sub", "breath", "heartbeat", [0,5,1,6], [0,-1,-1,5,1,-1,6,-1], 4)
score("footnote-mimic", 113, 49, "phrygian", "paper", "dulcimer", "type", [0,3,1,6], [0,3,1,6,2,5,4,1], 8)
score("alpha-wolf", 118, 41, "minor", "cello", "strings", "stalk", [0,5,2,6], [0,4,3,1,5,2,6,0], 6)
score("alpha-wolf-phase-two", 142, 38, "harmonic", "fuzz", "brass", "war", [0,6,3,5], [0,5,3,6,2,4,1,0], 8)
score("ancient-golem", 88, 35, "dorian", "metal", "organ", "clank", [0,4,2,6], [0,0,3,5,0,4,2,0], 4)
score("ancient-golem-phase-two", 122, 33, "locrian", "fuzz", "metal", "machine", [0,5,1,6], [0,5,1,6,3,0,4,2], 8)
score("archive-stalker", 116, 43, "locrian", "paper", "bowed", "type", [0,1,5,2], [0,5,1,6,2,4,3,0], 8)
score("archive-stalker-phase-two", 148, 40, "phrygian", "fuzz", "paper", "machine", [0,6,1,5], [0,6,2,5,1,4,3,0], 12)
score("ash-demon", 140, 36, "phrygian", "fuzz", "brass", "rush", [0,1,4,6], [0,6,1,5,2,4,0,3], 16)
score("ash-demon-phase-two", 166, 33, "locrian", "fuzz", "choir", "war", [0,6,2,5], [0,6,3,1,5,2,4,0], 16)
score("ashbound-sentinel", 108, 41, "minor", "metal", "choir", "march", [0,5,3,6], [0,2,0,5,3,6,2,0], 8)
score("bellbound-cantor", 92, 50, "major", "choir", "bell", "toll", [0,4,1,5], [0,4,6,5,3,1,2,4], 4)
score("clockwork-hound", 138, 46, "lydian", "gear", "metal", "machine", [0,4,2,6], [0,0,4,0,2,5,2,0], 8)
score("clockwork-hound-phase-two", 164, 43, "whole", "fuzz", "gear", "machine", [0,3,1,4], [0,3,0,6,2,5,1,4], 16)
score("frontier-outrider", 132, 51, "mixolydian", "twang", "brass", "shuffle", [0,4,5,3], [0,3,2,5,1,4,6,2], 8)
score("frost-giant-king", 98, 35, "lydian", "crystal", "brass", "march", [0,4,2,5], [0,5,3,6,2,4,1,0], 4)
score("frost-giant-king-phase-two", 124, 32, "harmonic", "brass", "crystal", "war", [0,6,3,5], [0,6,4,2,5,3,1,0], 8)
score("glasswing-moth", 128, 60, "lydian", "crystal", "flute", "flutter", [0,4,1,5], [0,6,2,5,1,4,3,6], 12)
score("goblin-king", 132, 45, "dorian", "brass", "lute", "war", [0,5,3,6], [0,3,5,2,6,4,2,0], 8)
score("goblin-king-phase-two", 158, 42, "harmonic", "brass", "fuzz", "war", [0,6,2,5], [0,5,6,3,1,4,2,0], 16)
score("hollow-sentinel", 104, 40, "locrian", "metal", "choir", "heartbeat", [0,1,5,3], [0,-1,5,1,6,-1,3,0], 4)
score("index-hound", 144, 48, "lydian", "gear", "paper", "machine", [0,4,2,5], [0,4,0,6,2,5,1,3], 8)
score("margin-warden", 112, 39, "minor", "metal", "strings", "clank", [0,5,3,6], [0,4,1,5,0,3,6,2], 4)
score("margin-warden-phase-two", 138, 36, "phrygian", "brass", "metal", "march", [0,6,2,5], [0,5,2,6,1,4,3,0], 8)
score("mire-witch", 84, 42, "phrygian", "reed", "bowed", "ritual", [0,1,5,3], [0,1,5,2,6,4,1,3], 6)
score("mire-witch-phase-two", 106, 39, "locrian", "glass", "fuzz", "ritual", [0,6,1,5], [0,6,1,4,2,5,3,0], 6)
score("orc-warlord", 128, 39, "minor", "brass", "horn", "war", [0,5,3,6], [0,0,4,3,6,5,2,0], 8)
score("orc-warlord-phase-two", 156, 36, "harmonic", "fuzz", "brass", "war", [0,6,3,5], [0,5,6,3,1,4,2,0], 16)
score("the-archivist", 100, 45, "dorian", "organ", "choir", "type", [0,4,1,5], [0,3,1,5,2,6,4,0], 8)
score("the-archivist-phase-two", 126, 42, "harmonic", "choir", "paper", "machine", [0,6,3,5], [0,6,2,5,1,4,3,0], 12)
score("the-author", 90, 37, "lydian", "choir", "crystal", "free", [0,3,5,1], [0,6,2,5,1,4,3,0], 5)
score("the-author-phase-two", 116, 34, "locrian", "fuzz", "choir", "ritual", [0,6,1,5], [0,5,1,6,3,2,4,0], 6)
score("the-bell-without-a-tongue", 66, 40, "harmonic", "bell", "sub", "toll", [0,1,5,2], [0,-1,6,-1,1,5,-1,3], 4)
score("the-echo-of-attempts", 122, 43, "dorian", "echo", "strings", "echo", [0,5,2,6], [0,3,5,3,1,6,2,0], 8)
score("the-echo-of-attempts-phase-two", 150, 40, "minor", "echo", "fuzz", "machine", [0,6,3,5], [0,5,3,0,6,2,4,1], 16)
score("the-editor", 130, 47, "phrygian", "paper", "metal", "machine", [0,3,1,6], [0,3,0,5,2,6,1,4], 8)
score("the-editor-phase-two", 158, 44, "locrian", "fuzz", "paper", "machine", [0,6,2,5], [0,6,2,4,1,5,3,0], 16)
score("the-first-hero", 134, 50, "major", "brass", "strings", "war", [0,4,5,3], [0,2,4,5,3,6,5,0], 8)
score("the-first-hero-phase-two", 160, 47, "mixolydian", "brass", "choir", "war", [0,5,3,6], [0,4,5,2,6,3,1,0], 16)
score("the-last-save", 76, 36, "harmonic", "choir", "organ", "heartbeat", [0,1,5,3], [0,-1,5,1,6,-1,3,0], 4)
score("the-last-save-phase-two", 98, 33, "locrian", "fuzz", "choir", "heartbeat", [0,6,1,5], [0,6,1,4,2,5,3,0], 4)
score("the-leftover", 118, 48, "phrygian", "paper", "accordion", "shuffle", [0,1,5,3], [0,4,1,5,3,6,2,1], 6)
score("the-leftover-phase-two", 146, 45, "locrian", "fuzz", "paper", "type", [0,6,2,5], [0,6,2,5,1,4,3,0], 12)
score("the-lost-cartographer", 88, 51, "major", "woodwind", "harp", "waltz", [0,4,1,5], [0,4,2,5,3,1,4,0], 6)
score("the-missing-page", 108, 45, "phrygian", "paper", "dulcimer", "type", [0,1,5,3], [0,3,1,6,2,5,4,1], 8)
score("the-missing-page-phase-two", 136, 42, "harmonic", "fuzz", "paper", "machine", [0,6,3,5], [0,6,1,4,2,5,3,0], 12)
score("the-unnamed-king", 110, 38, "harmonic", "brass", "organ", "march", [0,6,3,5], [0,5,3,6,4,2,5,0], 8)
score("the-unnamed-king-phase-two", 138, 35, "locrian", "fuzz", "brass", "war", [0,6,1,5], [0,6,4,2,5,3,1,0], 16)
score("the-watcher", 80, 42, "minor", "bowed", "sub", "heartbeat", [0,5,1,6], [0,-1,1,5,-1,3,6,2], 4)
score("the-watcher-phase-two", 104, 39, "phrygian", "fuzz", "bowed", "stalk", [0,6,2,5], [0,5,1,6,2,4,3,0], 6)
score("the-witness", 86, 46, "lydian", "choir", "strings", "free", [0,4,1,5], [0,4,2,6,1,5,3,0], 5)
score("the-witness-phase-two", 112, 43, "harmonic", "choir", "brass", "ritual", [0,6,3,5], [0,5,3,6,2,4,1,0], 6)


def slug(value):
    return "-".join(value.lower().split())


def render_enemy(name, cfg):
    bpm, root_midi = cfg["bpm"], cfg["root"]
    beat = 60.0/bpm
    bar_len = beat*4
    bars = 8
    duration = bars*bar_len
    count = int(round(duration*SR))
    mix = np.zeros((count,2),dtype=np.float64)
    scale = MODES[cfg["mode"]]
    root = 440*2**((root_midi-69)/12)
    rng = np.random.default_rng(int.from_bytes(hashlib.sha256(name.encode()).digest()[:8],"little"))

    def add(signal, start, pan, gain):
        a=max(0,int(start*SR)); b=min(count,a+len(signal))
        if b<=a: return
        angle=(np.clip(pan,-1,1)+1)*np.pi/4
        mix[a:b,0]+=signal[:b-a]*np.cos(angle)*gain
        mix[a:b,1]+=signal[:b-a]*np.sin(angle)*gain

    def hz(degree, octave=0):
        return root*2**((scale[degree%len(scale)]+12*octave)/12)

    def note(freq,start,dur,amp,patch,role="lead",pan=0):
        a=max(0,int(start*SR)); b=min(count,int((start+dur)*SR))
        if b<=a:return
        t=np.arange(b-a)/SR
        if role=="bed": attack=min(.65,dur*.38); release=min(.9,dur*.42)
        elif role=="bell": attack=.006; release=min(1.2,dur*.46)
        elif patch in ("harp","lute","twang","dulcimer","nylon","plucked-glass","woodblock","paper"):
            attack=.012; release=min(.32,dur*.4)
        else: attack=min(.055,dur*.3); release=min(.22,dur*.43)
        env=np.minimum(1,t/max(attack,1e-4))*np.minimum(1,np.maximum(0,(dur-t)/max(release,1e-4)))
        if patch in ("harp","lute","twang","dulcimer","nylon","plucked-glass","woodblock","paper"):
            env*=np.exp(-t*(2.6 if role=="bed" else 4.1))
        vib=.0035*np.sin(2*np.pi*(4.4 if patch in ("cello","strings","bowed","choir") else 5.2)*t)
        phase=2*np.pi*freq*(t+vib*t)
        sig=np.zeros_like(t); total=0
        for ratio,weight in PATCHES[patch]:
            sig+=weight*np.sin(phase*ratio+(ratio%1)*.37)
            total+=weight
        sig/=max(total,1)
        if patch in ("brass","horn","fuzz"):
            sig=np.tanh(sig*(1.65 if patch=="fuzz" else 1.25))
        if patch in ("cello","strings","bowed","choir"):
            sig+=.1*np.sin(phase*1.005+.4)
            env*=.9+.1*np.sin(2*np.pi*4.6*t)
        if patch=="rubber":
            phase+=.2*np.sin(2*np.pi*1.8*t)
            sig=np.sin(phase)+.25*np.sin(phase*2.3)
        if role=="bed": env*=.84+.16*np.sin(2*np.pi*.16*t+freq*.001)
        add(sig*env,start,pan,amp)

    # Hand-set four-chord arc with sustained voicings and a separate bass role.
    for bar in range(bars):
        degree=cfg["chords"][bar%4]
        t0=bar*bar_len
        for i,offset in enumerate((0,2,4)):
            chord_degree=(degree+offset)%len(scale)
            octave=0 if i==0 else 1
            amp=(.068 if i==0 else .043)*(1.08 if bar>=4 else 1)
            note(hz(chord_degree,octave),t0,bar_len*.99,amp,cfg["bed"],"bed",(-.62,0,.62)[i])
        bass_degree=degree
        note(hz(bass_degree,-1),t0,beat*1.85,.105,"bass","bed",-.08 if bar%2 else .08)
        if bar%2==1:
            note(hz((degree+4)%len(scale),-1),t0+2*beat,beat*1.15,.07,"bass","bed",.08 if bar%2 else -.08)

    # Per-score motif, with written development in bars 5–6 and a return in 7–8.
    motif=cfg["melody"]
    grid=cfg["grid"]
    for bar in range(bars):
        bar_t=bar*bar_len
        for step in range(grid):
            degree=motif[step%len(motif)]
            if degree<0: continue
            if bar in (2,3): degree=(degree+1)%len(scale)
            elif bar in (4,5): degree=(degree+3)%len(scale)
            elif bar in (6,7): degree=(degree+(1 if bar==6 else 0))%len(scale)
            slot=bar_len/grid
            # Short anticipations are deliberately different for swing and fast grooves.
            swing=.14 if cfg["groove"] in ("shuffle","waltz","swing") and step%2 else 0
            start=bar_t+step*slot+swing*slot
            octave=2 if cfg["lead"] in ("flute","crystal","glass","bell","chime","plucked-glass") else (1 if step%3 else 0)
            role="bell" if cfg["lead"] in ("bell","glass","crystal","chime","plucked-glass") else "lead"
            if bar>=4 and cfg["groove"] in ("war","march","rush"):
                octave+=1
            note(hz(degree,octave),start,slot*(1.35 if role=="bell" else .8),.06,cfg["lead"],role,(-.48 if step%2 else .48)*(1 if bar%2 else -1))
            if cfg["groove"] in ("machine","echo") and step in (1,5):
                note(hz(degree,octave+1),start+slot*.48,slot*.6,.025,"bell" if cfg["groove"]=="echo" else cfg["lead"],"bell",.2)

    # Explicit groove family per score; no common four-on-the-floor default.
    for bar in range(bars):
        t0=bar*bar_len
        groove=cfg["groove"]
        if groove in ("march","war","stomp","plod","heartbeat","stalk","clank"):
            kicks={"heartbeat":[0,3],"stalk":[0,2.75],"plod":[0,2],"clank":[0,2],"stomp":[0,2],"march":[0,2],"war":[0,2]}[groove]
            for bi in kicks:
                start=t0+bi*beat; n=int(.42*SR); t=np.arange(n)/SR
                f0=36 if groove in ("stomp","war","clank") else 48
                kick=np.sin(2*np.pi*(f0+54*np.exp(-t*11))*t)*np.exp(-t*(8 if groove!="clank" else 12))
                if groove=="clank": kick+=.3*np.sin(2*np.pi*231*t)*np.exp(-t*22)
                add(kick,start,.08 if bi==0 else -.08,.18 if bi==0 else .11)
            if groove in ("march","war","stomp"):
                for bi in (1,3):
                    start=t0+bi*beat; n=int(.13*SR); t=np.arange(n)/SR
                    noise=rng.normal(0,1,n); noise=np.convolve(noise,np.ones(29)/29,mode="same")
                    add(noise*np.exp(-t*24),start,.2 if bi==1 else -.2,.05 if groove!="war" else .075)
        elif groove in ("skitter","rattle","flutter","rush","machine","type","echo"):
            pulses={"skitter":12,"rattle":8,"flutter":6,"rush":16,"machine":8,"type":6,"echo":4}[groove]
            for pulse in range(pulses):
                if (pulse+bar)%({"skitter":3,"rattle":2,"flutter":2,"rush":5,"machine":3,"type":2,"echo":3}[groove])==1: continue
                start=t0+(pulse/pulses)*bar_len
                n=int((.035 if groove in ("skitter","type") else .07)*SR); t=np.arange(n)/SR
                noise=rng.normal(0,1,n); width=7 if groove in ("skitter","type") else 27
                noise=np.convolve(noise,np.ones(width)/width,mode="same")
                add(noise*np.exp(-t*(88 if width==7 else 32)),start,(-.5 if pulse%2 else .5),.048 if groove!="type" else .065)
        elif groove in ("bubbles","toll","ritual","sparse-bell","waltz","shuffle","folk","free","organic","sneak"):
            placements={"bubbles":[.65,2.8],"toll":[0,2.5],"ritual":[0,1.5,3],"sparse-bell":[0,2.5],"waltz":[0,2],"shuffle":[0,1.5,2.75],"folk":[0,2],"free":[1.3],"organic":[.4,2.2],"sneak":[0,3]}[groove]
            for j,bi in enumerate(placements):
                start=t0+bi*beat; n=int(.46*SR); t=np.arange(n)/SR
                if groove=="bubbles": hit=np.sin(2*np.pi*(185-100*np.exp(-t*7))*t)*np.exp(-t*7)
                elif groove in ("toll","ritual","sparse-bell"):
                    f=180+37*j+root_midi; hit=np.sin(2*np.pi*f*t)+.32*np.sin(2*np.pi*f*2.76*t); hit*=np.exp(-t*5.2)
                elif groove in ("organic","free"):
                    noise=rng.normal(0,1,n); hit=noise*np.exp(-t*9)
                else:
                    hit=np.sin(2*np.pi*(57+26*np.exp(-t*9))*t)*np.exp(-t*8)
                add(hit,start,.17 if j%2 else -.17,.075 if j==0 else .045)

    # Character-dependent short room reflections; the original soundtrack remains untouched.
    dry=mix.copy()
    if cfg["lead"] in ("bell","glass","crystal","chime","choir","organ"):
        echoes=((.16,.2,True),(.31,.13,False),(.52,.07,True),(.76,.04,False))
    elif cfg["lead"] in ("metal","gear","woodblock"):
        echoes=((.045,.1,True),(.11,.065,False),(.2,.03,True))
    else:
        echoes=((.1,.14,True),(.22,.08,False),(.38,.045,True))
    for delay,gain,swap in echoes:
        shift=int(delay*SR)
        if shift<count:
            source=dry[:-shift] if swap else dry[:-shift,::-1]
            mix[shift:]+=source*gain
    seam=int(.09*SR); fade=np.linspace(0,1,seam)[:,None]
    mix[-seam:]=mix[-seam:]*(1-fade)+mix[:seam]*fade
    mix=np.tanh(mix*1.18)
    peak=np.max(np.abs(mix)) or 1
    mix*=.89/peak
    # Keep the web delivery size reasonable while preserving the original 22.05 kHz / 16-bit WAV format.
    mono=mix.mean(axis=1)
    mono*=.89/(np.max(np.abs(mono)) or 1)
    pcm=np.asarray(np.round(mono*32767),dtype="<i2")
    path=ENEMY_OUT/(slug(name)+".wav")
    with wave.open(str(path),"wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    return {"name":name,"path":str(path),"bytes":path.stat().st_size,"seconds":round(duration,2),"sample_rate":SR,"channels":1,"lead":cfg["lead"],"bed":cfg["bed"],"groove":cfg["groove"],"motif":cfg["melody"]}


def ambient_song(title, root_hz, mode, chord_line, patch, lead, ambience, pulse):
    duration=36.0; count=int(duration*SR); t=np.arange(count)/SR
    mix=np.zeros((count,2),dtype=np.float64); scale=MODES[mode]
    seed=int.from_bytes(hashlib.sha256(title.encode()).digest()[:8],"little")
    rng=np.random.default_rng(seed)

    def add(signal,start,pan,gain):
        a=max(0,int(start*SR)); b=min(count,a+len(signal))
        if b<=a:return
        angle=(np.clip(pan,-1,1)+1)*np.pi/4
        mix[a:b,0]+=signal[:b-a]*np.cos(angle)*gain
        mix[a:b,1]+=signal[:b-a]*np.sin(angle)*gain

    # Explicit chord voicings and intervals are hand-written per region.
    for ci,degree in enumerate(chord_line):
        start=ci*9; end=(ci+1)*9; a=int(start*SR); b=int(end*SR); u=t[a:b]-start
        env=np.minimum(1,u/3.2)*np.minimum(1,(9-u)/3.2)
        for voice_i,interval in enumerate((0,2,4)):
            d=(degree+interval)%len(scale); f=root_hz*2**((scale[d]+12*(voice_i>0))/12)
            ph=2*np.pi*f*u
            partial=PATCHES[patch]
            body=np.zeros_like(u); denom=0
            for ratio,weight in partial:
                body+=weight*np.sin(ph*ratio+(ratio%1)*.25); denom+=weight
            body/=max(denom,1)
            slow=.82+.18*np.sin(2*np.pi*(.04+voice_i*.012)*u+ci)
            add(env*slow*body,start,(-.7,0,.7)[voice_i],.045 if voice_i==0 else .032)

    # Area-specific motif and environmental texture; none share the same bed/noise source.
    if title=="the-quiet-road":
        # Plucked traveler motif answered by short birdlike woodwind chirps.
        notes=[0,2,4,2,5,4,1,3,0,4,2,6]
        for i,d in enumerate(notes):
            st=1.1+i*2.55; f=root_hz*2**((scale[d%len(scale)]+12)/12)
            u=np.arange(int(2.3*SR))/SR; pluck=(np.sin(2*np.pi*f*u)+.38*np.sin(2*np.pi*2*f*u))*np.exp(-u*2.4)
            add(pluck,st,-.45 if i%2 else .45,.07)
        for i in range(12):
            st=2.5+i*2.7; u=np.arange(int(.95*SR))/SR; f=1550+((i*197)%680)
            chirp=np.sin(2*np.pi*(f+160*np.sin(2*np.pi*2.1*u))*u)*np.exp(-u*3.4)
            add(chirp,st,.56 if i%2 else -.56,.021)
        ctl=np.arange(0,37,.2); wind=np.interp(t,ctl,rng.normal(0,1,len(ctl)))
        add(wind,0,0,.005)
    elif title=="the-ruined-sanctuary":
        # Low pipe organ, distant bell tolls, and stone-air gusts.
        sub=np.sin(2*np.pi*root_hz*.5*t + .22*np.sin(2*np.pi*.025*t))
        add(sub,0,0,.09)
        for i,st in enumerate([1.5,8.9,17.7,26.4,34.1]):
            f=196+31*i; u=np.arange(int(5.1*SR))/SR
            toll=(np.sin(2*np.pi*f*u)+.42*np.sin(2*np.pi*f*2.72*u)+.2*np.sin(2*np.pi*f*5.4*u))*np.exp(-u*.82)
            add(toll,st,.16 if i%2 else -.16,.065)
        ctl=np.arange(0,37,.5); air=np.interp(t,ctl,rng.normal(0,1,len(ctl)))
        add(air,0,0,.012)
    elif title=="the-starlit-archive":
        # Glass arpeggios drift in a suspended high register, with no percussion or wind.
        motif=[0,4,1,5,2,6,3,5,1,4,6,2,0,3,5,4]
        for i,d in enumerate(motif):
            st=.7+i*2.1; f=root_hz*2**((scale[d%len(scale)]+24+12*(i%5==0))/12)
            u=np.arange(int(3*SR))/SR
            shard=(np.sin(2*np.pi*f*u)+.38*np.sin(2*np.pi*f*2.76*u)+.12*np.sin(2*np.pi*f*5.4*u))*np.exp(-u*1.25)
            add(shard,st,-.55 if i%2 else .55,.045)
        shimmer=np.sin(2*np.pi*root_hz*1.503*t+.27*np.sin(2*np.pi*.032*t))
        add(shimmer,0,.2,.025)
    else:
        # Ash wind and low bowed dissonance with intermittent ember crackles.
        base=np.sin(2*np.pi*root_hz*.5*t+.35*np.sin(2*np.pi*.02*t))
        add(base,0,0,.1)
        ctl=np.arange(0,37,.16); gust=np.interp(t,ctl,rng.normal(0,1,len(ctl)))
        env=.55+.3*np.sin(2*np.pi*.031*t)+.12*np.sin(2*np.pi*.014*t+1.3)
        add(gust*env,0,.2,.025)
        for ci,d in enumerate([0,3,1,4]):
            st=ci*9; u=np.arange(int(9*SR))/SR
            f=root_hz*2**((scale[d%len(scale)]+12)/12); ph=2*np.pi*f*u
            drone=(np.sin(ph)+.45*np.sin(ph*1.006)+.18*np.sin(ph*2.01))*np.minimum(1,u/2)*np.minimum(1,(9-u)/2)
            add(drone,st,-.15 if ci%2 else .15,.052)
        for i in range(30):
            st=(i*17)%350/10; u=np.arange(int(.11*SR))/SR; crackle=rng.normal(0,1,len(u))*np.exp(-u*35)
            add(crackle,st,(-.6 if i%2 else .6),.017)

    seam=int(.8*SR); fade=np.linspace(0,1,seam)[:,None]
    mix[-seam:]=mix[-seam:]*(1-fade)+mix[:seam]*fade
    mix=np.tanh(mix*1.2); peak=np.max(np.abs(mix)) or 1; mix*=.86/peak
    mono=mix.mean(axis=1)
    mono*=.86/(np.max(np.abs(mono)) or 1)
    pcm=np.asarray(np.round(mono*32767),dtype="<i2")
    path=AMBIENT_OUT/(title+".wav")
    with wave.open(str(path),"wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    return {"name":title,"path":str(path),"bytes":path.stat().st_size,"seconds":duration,"sample_rate":SR,"channels":1}


if len(SCORES)!=90:
    raise ValueError(f"Expected 90 individually authored enemy scores; got {len(SCORES)}")
enemy_manifest=[render_enemy(name,cfg) for name,cfg in SCORES.items()]
(ENEMY_OUT/"manifest.json").write_text(json.dumps(enemy_manifest,indent=2),encoding="utf-8")
ambient_specs=[
    ("the-quiet-road",110.0,"major",[0,4,1,5],"strings","harp","outdoor air","bird replies"),
    ("the-ruined-sanctuary",73.42,"phrygian",[0,3,1,4],"organ","bell","stone wind","tolls"),
    ("the-starlit-archive",130.81,"lydian",[0,3,5,1],"crystal","glass","none","glass arpeggios"),
    ("the-ashen-wilds",55.0,"locrian",[0,3,1,4],"bowed","sub","ash wind","embers"),
]
ambient_manifest=[ambient_song(*spec) for spec in ambient_specs]
(AMBIENT_OUT/"manifest.json").write_text(json.dumps(ambient_manifest,indent=2),encoding="utf-8")
print(json.dumps({"enemy_count":len(enemy_manifest),"enemy_bytes":sum(x["bytes"] for x in enemy_manifest),"ambient_count":len(ambient_manifest),"ambient_bytes":sum(x["bytes"] for x in ambient_manifest),"distinct_motifs":len({tuple(x["motif"]) for x in enemy_manifest})}))

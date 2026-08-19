# Model files

These are served as static files rather than bundled through `src/assets`, because
they are multi-megabyte binaries. Bundling them would inline them into the JS and
block first paint; here they can be fetched after the app is already interactive.

Nothing in this folder is committed — see the `.gitignore` rule. Mixamo's licence
allows use but not redistribution, and a 10 MB binary in Git history is permanent.
Anyone cloning the repo downloads their own copies using the steps below.

## What goes here

```
public/models/
  character.fbx        <- the character, With Skin
  dances/
    idle.fbx           <- animation only, Without Skin
    hiphop.fbx
    salsa.fbx
    robot.fbx
    shuffle.fbx
```

The app falls back to the built-in primitive figure when `character.fbx` is
missing, so a fresh clone still runs with an empty folder.

## Getting the files from Mixamo

Sign in at [mixamo.com](https://www.mixamo.com) with a free Adobe account.

**1. The character** — from the Characters tab, choose **Y Bot** or **X Bot**.
Then Download with:

| Setting | Value |
|---|---|
| Format | **FBX Binary (.fbx)** |
| Pose | **T-pose** |

Save as `character.fbx`.

Y Bot and X Bot are recommended rather than required. They are untextured
mannequins whose stylised look sits closer to Bitmoji than a photoreal human,
and their files are far smaller.

Any Mixamo character will work, because the loader strips textures and resets
every material to plain white before the colour pickers touch it. That is what
makes a chosen colour come out as that exact colour: tinting on top of baked-in
artwork is only ever a wash over someone else's skin and clothing, so a deep
tone would dim the whole character instead of actually changing its skin. The
trade is that a photoreal character loses its painted detail and arrives as a
blank mannequin. Being able to pick a colour and get it is worth more here.

**2. The dances** — keep the *same character selected*, then for each animation
in the Animations tab, Download with:

| Setting | Value |
|---|---|
| Format | **FBX Binary (.fbx)** |
| Skin | **Without Skin** |
| Frames per Second | **30** |
| Keyframe Reduction | **none** |

Save into `dances/` using the names listed above.

Without Skin matters: it exports the animation only, no duplicate mesh. Five
copies of the same character would otherwise be downloaded for no reason.

Staying on one character matters too. Mixamo names every bone identically across
its own rigs, so animations exported from the same character drop onto the
skeleton with no retargeting. Mixing characters reintroduces bone-name mismatch,
which is the usual reason Mixamo animations explode into a tangle of limbs.

## Gotchas already handled in code

- **Scale.** Mixamo exports in centimetres, so a character arrives 100× too large.
  `AvatarModel` scales by 0.01 on load.
- **Clip names.** Mixamo calls almost every clip `mixamo.com`, so clips are keyed
  by the filename they came from rather than the name inside the file.

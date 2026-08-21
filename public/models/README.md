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
  character.fbx        <- the character, With Skin, carrying the idle
  dances/
    hiphop.fbx         <- animation only, Without Skin
    salsa.fbx
    robot.fbx
    shuffle.fbx
    uprock.fbx
    rumba.fbx
    house.fbx
```

There is no `idle.fbx`. Downloading the character With Skin bundles whichever
animation was selected at the time, so the idle is already inside
`character.fbx` and fetching it again as a dance would parse the same few
megabytes twice.

The app falls back to the built-in primitive figure when `character.fbx` is
missing, so a fresh clone still runs with an empty folder.

## Getting the files from Mixamo

Sign in at [mixamo.com](https://www.mixamo.com) with a free Adobe account.

**1. The character** — from the Characters tab, choose **Y Bot** or **X Bot**.
Then go to the Animations tab, pick an idle (**Breathing Idle** works well),
and Download with:

| Setting | Value |
|---|---|
| Format | **FBX Binary (.fbx)** |
| Skin | **With Skin** |
| Frames per Second | **30** |
| Keyframe Reduction | **none** |

Save as `character.fbx`.

Downloading it in **T-pose** instead is the one thing to avoid. It gives a file
with no animation in it, and the app has nowhere else to get an idle from, so
the avatar stands with its arms straight out whenever it is not dancing.

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

## Restart the dev server after adding a file here

Vite decides what lives in `public/` when it starts, and this folder is left out
of its file watcher (watching multi-megabyte binaries gains nothing and killed
the server with EBUSY when it opened one mid-copy). A file added while the
server is running is therefore invisible to it.

The failure is quiet rather than loud: the request falls through to the SPA
fallback, so the browser gets `index.html` with a **200 OK** and the FBX loader
reports a parse failure on what looks like a perfectly good response. Checking
the status code will not reveal it — check that the body starts with
`Kaydara FBX Binary`.

Overwriting a file that already existed works without a restart. Only new
filenames need one.

## Gotchas already handled in code

- **Scale.** Mixamo exports in centimetres, so a character arrives 100× too large.
  `AvatarModel` scales by 0.01 on load.
- **Clip names.** Mixamo calls almost every clip `mixamo.com`, so clips are keyed
  by the filename they came from rather than the name inside the file.
- **Empty animation stacks.** Some exports carry an empty `Take 001` beside the
  real clip, and the order varies between files — `hiphop.fbx` puts the real one
  first, `character.fbx` puts it second. The loader picks the first clip that has
  any tracks rather than the first one in the list.

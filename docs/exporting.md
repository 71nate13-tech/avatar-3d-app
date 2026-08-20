# Getting an avatar out

There are two ways, and they are not interchangeable.

## The code — 52 characters

An avatar in this app is not a mesh anybody authored. It is a **recipe**: a
body, plus a set of choices about skin, hair, build, clothes and accessories.
So what gets handed over is the recipe.

That is why a whole character fits in 52 characters:

```
AVwzF9lPii5rT8BLSyMjKejo6B96XI5FhcmiJwUFAwEBAQIBAs-1
```

The layout is in `src/lib/avatarCode.ts` — 39 bytes, fixed, base64url. Because
39 divides by three there is never any padding, which is why the code is always
exactly the same length.

What this buys:

- **It fits in a QR code** with room to spare, so the code *is* the avatar
  rather than a link to one held on a server.
- **It works with no connection.** Two people in a room trade by pointing a
  camera at a screen. No account, no network, no hosting.
- **It stays editable.** What arrives is choices, so the recipient can change
  the hair and trade it on.
- **It carries none of the model**, which matters for the licence — see below.

It has one limitation, and it is the obvious one: a code only means something
to another copy of this app.

## The `.glb` — a few megabytes

For everywhere else there is **Download 3D model**, which bakes the avatar into
a single `.glb` with the current dance in it. That opens in Blender, Unity, or
any glTF viewer, which is what makes it usable in a video or a mockup.

The trade is real:

|  | Code | `.glb` |
|---|---|---|
| Size | 52 characters | several MB |
| Editable afterwards | yes | no |
| Needs the app | yes | no |
| Contains the model | no | yes |

## The licence, plainly

The character and the dances come from **Mixamo**. Adobe's terms let you *use*
those assets in what you make. They do not let you **redistribute the assets
themselves** — and a `.glb` export contains the geometry and the animation
data, not a reference to them.

In practice:

- **Exporting your own avatar for your own use** — a render, a video, a mockup,
  something you are making — is what the licence is for. Fine.
- **Handing the `.glb` to other people**, publishing it for download, or
  shipping it inside something you distribute, is redistributing Mixamo's
  assets. Not fine, whatever this app makes technically possible.
- **Trading by code is never affected.** A code contains no geometry at all —
  it is a list of choices, and choices are not Adobe's. Trade codes freely.

This is also the reason the model binaries are gitignored rather than committed
(see `public/models/README.md`): the repo describes how to fetch them, and does
not carry them.

If the project ever needs an export anybody can pass around, the fix is to
replace the base body with a mesh whose licence permits redistribution — a CC0
character, or one built from the app's own primitives. The codec would not
change; only what the recipe is applied to.

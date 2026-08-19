# Avatar 3D App

A web-based 3D avatar viewer combining features from Bitmoji, Zepeto, and Viggle AI. Create and customize your avatar, view it from all angles with a Mario 64-style camera, and watch it dance.

## Features (MVP)

- 🎨 Customizable avatar (skin tone, clothing, accessories)
- 📷 Mario 64-style orbit camera (pan, rotate, zoom)
- 💃 Dance animations (Salsa, Robot, Wiggle, Wave, Idle)
- 📱 Cross-platform (Web, Windows, Android)
- ⚡ Built with React, Three.js, Vite

## Tech Stack

- **Frontend:** React 18 + TypeScript
- **3D Graphics:** Three.js
- **State Management:** Zustand
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Desktop:** Electron
- **Mobile:** Capacitor

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd avatar-3d-app
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

Model files are not in the repo — see [public/models/README.md](public/models/README.md)
for how to fetch them. The app falls back to a built-in primitive figure without
them, so a fresh clone still runs.

### Windows desktop

```bash
npm run electron:dev     # runs against the dev server, hot reloads
npm run electron:build   # installable .exe in release/
```

### Android

Needs a JDK (17+) and the Android SDK. No Android Studio required — Gradle does
the build and the Capacitor CLI drives it.

```bash
npm run android:sync     # rebuild web assets and copy them into the native project
npm run android:apk      # build a debug APK
npm run android:run      # build, install, and launch on a connected device
```

The APK lands in `android/app/build/outputs/apk/debug/`.

`cap sync` copies whatever is currently in `dist/`, so every one of these scripts
runs `vite build` first. Running `cap sync` on its own ships the previous build
to the phone, which looks exactly like a change that failed to take effect.

### Web build

```bash
npm run build
```

## Project Structure

See [CLAUDE.md](CLAUDE.md) for detailed architecture and codebase documentation.

## Roadmap

- **v1.0** (MVP): Web app with avatar viewer, customization, and dance animations
- **v2.0**: Desktop (Electron) and Android (Capacitor) apps
- **v3.0+**: Multiplayer, avatar export, social features

## License

MIT

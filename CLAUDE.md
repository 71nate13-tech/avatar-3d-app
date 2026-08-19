# Avatar 3D App - Codebase Documentation

## Project Overview

**Purpose:** Create a web-based 3D avatar viewer combining avatar customization (Bitmoji/Zepeto style) with interactive 3D controls (Mario 64 camera) and dance animations (Viggle AI style).

**Status:** MVP Phase - Building web version first, desktop/mobile in Phase 2.

**Architecture:** React (Vite) + Three.js + Zustand

---

## Tech Stack Rationale

| Tool | Why |
|------|-----|
| **Vite** | Fast HMR, instant dev feedback, zero-config for Electron/Capacitor |
| **React 18** | Hooks, component reusability, large ecosystem |
| **Three.js** | Best community for avatar work, excellent documentation, proven for Bitmoji-like apps |
| **Zustand** | Minimal boilerplate for avatar state (colors, clothing, animations) |
| **Tailwind CSS** | Rapid UI prototyping, responsive design, DX |
| **TypeScript** | Type safety, better IDE support |

---

## Project Structure

```
avatar-3d-app/
├── README.md
├── CLAUDE.md (this file)
├── package.json
├── vite.config.ts          # Vite configuration
├── tsconfig.json
├── tailwind.config.js
├── index.html              # Entry HTML
│
├── src/
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Root component
│   ├── App.css
│   │
│   ├── stores/             # Zustand state
│   │   ├── avatarStore.ts  # Avatar appearance (colors, clothing)
│   │   ├── cameraStore.ts  # Camera position/rotation state
│   │   └── danceStore.ts   # Animation playback state
│   │
│   ├── components/
│   │   ├── Canvas3D.tsx    # Three.js canvas wrapper
│   │   ├── ControlPanel.tsx # Sidebar UI
│   │   │
│   │   ├── customization/
│   │   │   ├── ColorPicker.tsx
│   │   │   ├── ClothingSelector.tsx
│   │   │   └── PresetButtons.tsx
│   │   │
│   │   ├── dance/
│   │   │   ├── DanceController.tsx
│   │   │   └── AnimationList.tsx
│   │   │
│   │   └── camera/
│   │       └── OrbitControls.tsx
│   │
│   ├── three/              # Three.js utilities
│   │   ├── scene.ts        # Scene, camera, renderer setup
│   │   ├── renderer.ts
│   │   ├── lighting.ts
│   │   │
│   │   ├── avatar/
│   │   │   ├── AvatarModel.ts    # Load/manage GLB models
│   │   │   ├── humanoid.ts       # Fallback primitive avatar
│   │   │   └── AnimationManager.ts
│   │   │
│   │   ├── camera/
│   │   │   └── MarioCamera.ts    # Orbit camera logic
│   │   │
│   │   └── utils.ts
│   │
│   ├── hooks/
│   │   ├── useThreeScene.ts      # Initialize Three.js, manage lifecycle
│   │   ├── useAvatarModel.ts     # Load avatar GLB
│   │   └── useOrbitCamera.ts     # Setup camera with event listeners
│   │
│   ├── types/
│   │   ├── avatar.ts      # TypeScript types for avatar config
│   │   ├── animation.ts   # Animation types
│   │   └── index.ts
│   │
│   └── assets/
│       ├── models/
│       │   ├── avatar-base.glb        # Default avatar model
│       │   └── animations/
│       │       ├── salsa.glb
│       │       ├── robot.glb
│       │       ├── wiggle.glb
│       │       ├── wave.glb
│       │       └── idle.glb
│       └── textures/
│           └── placeholder.png
│
├── public/
│   └── index.html
│
└── scripts/
    └── convert-animations.js    # FBX → GLB converter (prep step)
```

---

## Core Components

### 1. **Canvas3D.tsx**
Three.js scene container. Initializes the 3D world, loads avatar, and manages the render loop.

**Responsibilities:**
- Create Three.js scene, camera, renderer
- Load avatar model
- Setup orbit camera with mouse/touch events
- Animation loop with `requestAnimationFrame`
- Handle window resize

**Dependencies:**
- `useThreeScene` hook
- `AvatarModel` class
- `MarioCamera` class

---

### 2. **ControlPanel.tsx**
UI sidebar for customization and animation controls.

**Responsibilities:**
- Render customization UI (color picker, clothing selector, presets)
- Render dance animation buttons
- Update Zustand stores on user interaction

**State:**
- Connects to `avatarStore`, `danceStore`, `cameraStore`

---

### 3. **AvatarModel.ts**
Manages avatar 3D model, materials, and mesh swapping.

**Key Methods:**
- `loadModel(url)` - Load GLB file
- `setMaterialColor(partName, color)` - Update material color
- `setClothing(type)` - Swap clothing mesh
- `getAnimations()` - Return loaded animation clips

**Implementation Notes:**
- Uses THREE.GLTFLoader
- Fallback to primitive humanoid if GLB fails
- Caches loaded model in memory

---

### 4. **MarioCamera.ts**
Orbit camera implementation (Mario 64 style).

**Features:**
- Spherical coordinates (radius, polar, azimuth)
- Mouse drag to rotate
- Mouse wheel to zoom
- Touch support (swipe, pinch)
- Smooth damping with lerp

**Constraints:**
- Radius: 2-6 units
- Polar: 0.2 rad to π-0.2 rad
- Target: Avatar center (0, 1, 0)

---

### 5. **AnimationManager.ts**
Manages avatar animations (loading, playing, blending).

**Key Methods:**
- `loadAnimations(glb)` - Parse GLB animation clips
- `playAnimation(name, loop)` - Play by name
- `blendToAnimation(name, duration)` - Crossfade between animations
- `stop()` - Stop current animation

**Implementation:**
- Uses THREE.AnimationMixer
- Tracks animation state in danceStore
- Supports looping and one-shot animations

---

## State Management (Zustand)

### **avatarStore**
Tracks avatar appearance.

```typescript
interface AvatarState {
  skinColor: string
  clothingStyle: "casual" | "formal" | "sporty"
  accessory: "none" | "hat" | "glasses"
  
  setSkinColor: (color: string) => void
  setClothing: (style: string) => void
  setAccessory: (accessory: string) => void
  reset: () => void
}
```

### **danceStore**
Tracks animation playback.

```typescript
interface DanceState {
  currentAnimation: string | null
  isPlaying: boolean
  
  playAnimation: (name: string) => void
  stopAnimation: () => void
}
```

### **cameraStore**
Tracks camera state (optional, for saving camera position).

```typescript
interface CameraState {
  azimuth: number
  polar: number
  radius: number
}
```

---

## Key Design Decisions

1. **No physics engine** - Reduces bundle size and complexity. Avatar is static (no cloth/hair sim).

2. **Hand-rolled orbit camera** - Better learning than Three.js OrbitControls library. Simpler for Mario 64 style (fixed target).

3. **Zustand over Redux** - 90% less boilerplate for a small app. Easy to understand for beginners.

4. **Fallback humanoid** - If GLB loading fails, render primitive avatar using THREE.BoxGeometry/SphereGeometry. Ensures MVP works even without assets.

5. **Mixamo for animations** - Pre-rigged, free animations. Avoid custom rigging (steep learning curve).

6. **One-way data flow** - UI updates Zustand → Three.js reads from store. No Three.js → React feedback (except performance metrics).

---

## Development Workflow

### Adding a new animation:
1. Download FBX from Mixamo (or export GLB)
2. Save to `src/assets/models/animations/`
3. Update `AnimationManager.loadAnimations()` to include new clip name
4. Add button in `DanceController.tsx`
5. Commit with message: "feat: add {animation-name} dance"

### Customizing avatar appearance:
1. Modify AvatarModel material/mesh in Three.js
2. Add UI control in `ControlPanel.tsx`
3. Update avatarStore with new state
4. Test live in dev server
5. Commit: "feat: add {customization} option"

### Camera tweaks:
1. Edit `MarioCamera.ts` (radius bounds, damping, rotation speed)
2. Test in `npm run dev`
3. Commit: "tweak: adjust camera {property}"

---

## Phase 2 Deployment Notes

### Electron (Windows Desktop)
- Wrap React app in Electron shell
- No code changes needed
- Add native menu, window controls
- Build: `npm run electron:build` → `.exe`

### Capacitor (Android)
- Re-use React + Three.js code
- Handle touch input (already in MVP)
- Build: `npm run build && npx cap sync && npx cap open android`

---

## Performance Targets

- **Web:** 60 FPS on desktop, 30 FPS on mobile
- **Avatar geometry:** < 10K triangles
- **Animations:** < 2 seconds load time
- **Bundle size:** < 2MB gzipped (React + Three.js + UI)

---

## Testing Strategy

### Web (MVP)
- Chrome DevTools for debugging Three.js
- Chrome DevTools remote debugging for mobile touch testing
- No emulator needed

### Desktop (Phase 2)
- Electron DevTools
- Native Windows .exe testing

### Android (Phase 2)
- Remote debugging via USB + Chrome DevTools
- Or Android Studio emulator (slower)

---

## Common Tasks

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| Preview build | `npm run preview` |
| Type check | `tsc --noEmit` |
| Type check + watch | `tsc --noEmit --watch` |

---

## Common Pitfalls & Solutions

| Issue | Solution |
|-------|----------|
| Avatar doesn't load | Check console for GLB errors, fallback humanoid should render |
| Camera jittery | Increase damping coefficient in MarioCamera, reduce mouse sensitivity |
| Animations don't play | Verify GLB has animation clips, check AnimationManager.loadAnimations() |
| Low FPS on mobile | Reduce avatar geometry, remove unnecessary lights, enable WebGL compression |
| Zustand state not updating UI | Ensure component uses `useShallow` hook for nested state |

---

## External Resources

- **Three.js Docs:** https://threejs.org/docs/
- **Mixamo:** https://www.mixamo.com/ (free animations)
- **Sketchfab:** https://sketchfab.com/ (free GLB models)
- **Zustand Guide:** https://github.com/pmndrs/zustand
- **Vite Docs:** https://vitejs.dev/

---

## Next Steps

1. ✅ Project setup (package.json, Git, structure)
2. ⬜ Install dependencies (`npm install`)
3. ⬜ Setup Vite config + TypeScript
4. ⬜ Create basic Three.js scene
5. ⬜ Implement Mario 64 camera
6. ⬜ Load avatar model (or fallback)
7. ⬜ Build customization UI
8. ⬜ Load animations, build dance controller
9. ⬜ Polish, optimize, test
10. ⬜ Deploy to Vercel (web)
11. ⬜ Wrap with Electron (desktop)
12. ⬜ Wrap with Capacitor (mobile)

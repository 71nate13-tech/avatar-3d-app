import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nate.avatar3d',
  appName: 'Avatar 3D',
  // Capacitor copies this folder into the app bundle, so `npm run build` has
  // to run before every `cap sync` or the phone gets the previous build.
  webDir: 'dist',
  android: {
    // The FBX files are several megabytes and are read straight off local
    // storage, so there is no network involved and no reason to allow it.
    allowMixedContent: false,
  },
}

export default config

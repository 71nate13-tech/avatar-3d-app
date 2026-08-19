// CommonJS on purpose: package.json sets "type": "module" for the React side,
// so this file needs the .cjs extension to be loaded as CommonJS by Electron.
const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')

/** Set only by the `electron:dev` script. Its absence means this is a packaged
 *  build, which loads the files bundled beside it instead of a dev server. */
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 540,
    // Matches the app's own background, so startup does not flash white.
    backgroundColor: '#12121a',
    show: false,
    webPreferences: {
      // The page is ordinary web code with no need for Node, so keep the
      // renderer sandboxed. Anything loaded into it stays unprivileged.
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Waiting for the first paint avoids showing an empty frame while the
  // WebGL context and the character model are still coming up.
  window.once('ready-to-show', () => window.show())

  if (DEV_SERVER_URL) {
    window.loadURL(DEV_SERVER_URL)
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Send external links to the real browser rather than opening a second,
  // chrome-less app window that the user cannot navigate.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // macOS convention is for the app to stay alive with no windows open.
  if (process.platform !== 'darwin') app.quit()
})

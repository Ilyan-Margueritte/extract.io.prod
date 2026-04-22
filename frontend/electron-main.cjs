const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';
let backendProcess = null;

function startBackend() {
  if (isDev) {
    console.log("Mode dev : le backend (./start.sh ou uvicorn) doit être lancé manuellement.");
    return;
  }
  
  // Chemin de l'exécutable Python compilé
  const enginePath = path.join(process.resourcesPath, 'backend-bin', 'extract-engine');
  
  try {
    backendProcess = spawn(enginePath, [], { detached: false });
    backendProcess.stdout.on('data', (data) => console.log(`[Backend]: ${data}`));
    backendProcess.stderr.on('data', (data) => console.error(`[Backend API]: ${data}`));
  } catch (e) {
    console.error("Impossible de lancer le backend:", e);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: 'hiddenInset', // Style natif macOS avec les boutons de fenêtre incrustés
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    // Sur macOS, il est commun de recréer une fenêtre si on clique sur l'icône du dock
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  // Quitte l'application sauf sur macOS (comportement standard)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

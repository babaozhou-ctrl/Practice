const { app, BrowserWindow } = require("electron")
app.commandLine.appendSwitch("ignore-gpu-blacklist")
app.commandLine.appendSwitch("enable-webgl")
app.commandLine.appendSwitch("use-gl", "swiftshader")

app.whenReady().then(() => {
  const w = new BrowserWindow({
    width: 350, height: 520,
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { contextIsolation: true }
  })
  w.loadFile("D:/deep-pet/test.html")
})

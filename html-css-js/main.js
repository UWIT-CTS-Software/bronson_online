
import buildingData from './JackNet/campus.json' with { type: "json" }
import checkerBoard from './checkerboard/roomChecks.json' with { type: 'json' }

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  });

  win.loadFile('html-css/index.html');
}

// app.whenReady().then(() => {
//   createWindow()
// })

export { buildingData, checkerBoard };
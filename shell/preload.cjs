// The bridge. A sandboxed preload cannot be an ES module, so this one file is
// CommonJS. It gives the page two functions and nothing of Electron:
//
//   shell.ask(door, method, args, askedBy)  one ask of a door, answered
//                                           { ok, value } or { ok: false, refused }
//   shell.on(listener)                      what the shell tells the page
//
// The preload, not the page, says whether the person's own press is behind an
// ask: `navigator.userActivation.isActive` read here cannot be set by the page.
// `askedBy` names an agent where a tool, not a control, made the ask.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('shell', {
  ask(door, method, args, askedBy) {
    const who = {
      gesture: navigator.userActivation ? navigator.userActivation.isActive === true : false,
      askedBy: typeof askedBy === 'string' ? askedBy.slice(0, 80) : undefined,
    }
    return ipcRenderer.invoke('shell:ask', { door, method, args }, who)
  },
  on(listener) {
    const heard = (_event, told) => listener(told)
    ipcRenderer.on('shell:tell', heard)
    return () => ipcRenderer.removeListener('shell:tell', heard)
  },
})

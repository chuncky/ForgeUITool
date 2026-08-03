const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("forgeuiDesktop", {
  openProjectDir: () => ipcRenderer.invoke("dialog:openProjectDir"),
  chooseNewProjectDir: () => ipcRenderer.invoke("dialog:chooseNewProjectDir"),
  getRepoRoot: () => ipcRenderer.invoke("app:getRepoRoot"),
  openProjectFolder: () => ipcRenderer.invoke("shell:openProjectFolder"),
  readDoc: (id) => ipcRenderer.invoke("app:readDoc", id),
  openProject: (dir) => ipcRenderer.invoke("project:open", dir),
  openHello: () => ipcRenderer.invoke("project:openHello"),
  createProject: (opts) => ipcRenderer.invoke("project:create", opts),
  saveProject: () => ipcRenderer.invoke("project:save"),
  updateMeta: (patch) => ipcRenderer.invoke("project:updateMeta", patch),
  updateNode: (args) => ipcRenderer.invoke("project:updateNode", args),
  setEvents: (args) => ipcRenderer.invoke("project:setEvents", args),
  addNode: (args) => ipcRenderer.invoke("project:addNode", args),
  removeNode: (args) => ipcRenderer.invoke("project:removeNode", args),
  addScreen: (opts) => ipcRenderer.invoke("project:addScreen", opts),
  renameScreen: (args) => ipcRenderer.invoke("project:renameScreen", args),
  removeScreen: (args) => ipcRenderer.invoke("project:removeScreen", args),
  duplicateScreen: (args) => ipcRenderer.invoke("project:duplicateScreen", args),
  reorderScreen: (args) => ipcRenderer.invoke("project:reorderScreen", args),
  setDefaultScreen: (args) => ipcRenderer.invoke("project:setDefaultScreen", args),
  duplicateNode: (args) => ipcRenderer.invoke("project:duplicateNode", args),
  moveNodeOrder: (args) => ipcRenderer.invoke("project:moveNodeOrder", args),
  setNodeFlags: (args) => ipcRenderer.invoke("project:setNodeFlags", args),
  alignNode: (args) => ipcRenderer.invoke("project:alignNode", args),
  undo: (editor) => ipcRenderer.invoke("project:undo", editor),
  redo: (editor) => ipcRenderer.invoke("project:redo", editor),
  historyState: () => ipcRenderer.invoke("project:historyState"),
  listCodeFiles: () => ipcRenderer.invoke("project:listCodeFiles"),
  readProjectFile: (relPath) => ipcRenderer.invoke("project:readFile", relPath),
  writeUserFile: (args) => ipcRenderer.invoke("project:writeUserFile", args),
  listWidgets: () => ipcRenderer.invoke("project:listWidgets"),
  generate: (opts) => ipcRenderer.invoke("tool:generate", opts ?? {}),
  preview: (opts) => ipcRenderer.invoke("tool:preview", opts),
  onPreviewBuildLog: (cb) => {
    const handler = (_e, line) => cb(line);
    ipcRenderer.on("preview:buildLog", handler);
    return () => ipcRenderer.removeListener("preview:buildLog", handler);
  },
  exportSdk: (opts) => ipcRenderer.invoke("tool:exportSdk", opts),
  pack: () => ipcRenderer.invoke("tool:pack"),
});

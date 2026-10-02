const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("atlas", {
  listArticles: () => ipcRenderer.invoke("articles:list"),
  listSources: () => ipcRenderer.invoke("sources:list"),
  getArticle: (sourceUrl) => ipcRenderer.invoke("articles:get", sourceUrl),
  captureArticles: (urls) => ipcRenderer.invoke("articles:capture", urls),
  onCaptureProgress: (listener) => {
    const handler = (_event, progress) => listener(progress);
    ipcRenderer.on("articles:capture:progress", handler);
    return () => ipcRenderer.removeListener("articles:capture:progress", handler);
  },
});

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("atlas", {
  listArticles: () => ipcRenderer.invoke("articles:list"),
  getArticle: (sourceUrl) => ipcRenderer.invoke("articles:get", sourceUrl),
  captureArticles: (urls) => ipcRenderer.invoke("articles:capture", urls),
});

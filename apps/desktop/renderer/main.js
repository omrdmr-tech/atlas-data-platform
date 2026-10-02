const form = document.querySelector("#capture-form");
const textarea = document.querySelector("#article-urls");
const captureButton = document.querySelector("#capture-button");
const formMessage = document.querySelector("#form-message");
const articleList = document.querySelector("#article-list");
const articleCount = document.querySelector("#article-count");
const reader = document.querySelector("#reader");
const sourceList = document.querySelector("#source-list");
let selectedUrl = null;

function setMessage(message, tone = "") {
  formMessage.textContent = message;
  formMessage.className = `form-message ${tone}`.trim();
}

function readableAddress(value) {
  try {
    const url = new URL(value);
    return { domain: url.hostname, path: `${url.pathname}${url.search}` || "/" };
  } catch {
    return { domain: value, path: "" };
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderList(articles) {
  articleCount.textContent = `${articles.length} kayıt`;
  articleList.replaceChildren();

  if (articles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "list-empty";
    empty.textContent = "Henüz kaydedilmiş haber yok. İlk adresini ekle.";
    articleList.append(empty);
    return;
  }

  for (const article of articles) {
    const address = readableAddress(article.sourceUrl);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `article-item${article.sourceUrl === selectedUrl ? " selected" : ""}`;
    button.dataset.url = article.sourceUrl;

    const domain = document.createElement("div");
    domain.className = "article-domain";
    domain.textContent = address.domain;

    const path = document.createElement("div");
    path.className = "article-path";
    path.textContent = address.path;

    const date = document.createElement("div");
    date.className = "article-date";
    date.textContent = formatDate(article.fetchedAt);

    button.append(domain, path, date);
    button.addEventListener("click", () => void openArticle(article.sourceUrl));
    articleList.append(button);
  }
}

async function refreshList() {
  const articles = await window.atlas.listArticles();
  renderList(articles);
  return articles;
}

async function refreshSources() {
  const sources = await window.atlas.listSources();
  sourceList.replaceChildren();
  if (sources.length === 0) {
    const empty = document.createElement("p");
    empty.className = "list-empty";
    empty.textContent = "Henüz adres kaydı yok.";
    sourceList.append(empty);
    return;
  }
  for (const source of sources) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "source-item";
    const address = document.createElement("span");
    address.textContent = source.sourceUrl;
    const info = document.createElement("small");
    info.textContent = [source.language, source.region, source.lastStatus === "failed" ? "Hata" : source.lastStatus === "success" ? "Başarılı" : "Sırada"].filter(Boolean).join(" · ");
    row.append(address, info);
    row.title = "Bu adresi giriş alanına getirip düzenle";
    row.addEventListener("click", () => {
      const urls = textarea.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      if (!urls.includes(source.sourceUrl)) urls.push(source.sourceUrl);
      textarea.value = urls.join("\n");
      textarea.focus();
    });
    sourceList.append(row);
  }
}

async function openArticle(sourceUrl) {
  selectedUrl = sourceUrl;
  reader.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "loading-copy";
  loading.textContent = "Kopya açılıyor…";
  reader.append(loading);

  try {
    const snapshot = await window.atlas.getArticle(sourceUrl);
    if (!snapshot) {
      throw new Error("Bu kayıt arşivde bulunamadı.");
    }

    const parsed = new DOMParser().parseFromString(snapshot.html, "text/html");
    parsed.querySelectorAll("script, style, noscript, svg, iframe, object, embed, template").forEach((element) => element.remove());
    const contentRoot = parsed.querySelector("article") || parsed.querySelector("main") || parsed.body;
    const title = parsed.querySelector("h1")?.textContent?.trim() ||
      parsed.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ||
      parsed.title?.trim() || readableAddress(snapshot.sourceUrl).domain;
    const text = contentRoot.innerText?.trim() || contentRoot.textContent?.trim() || "Bu sayfadan okunabilir metin çıkarılamadı. Ham HTML kopyası arşivde duruyor.";

    const metadata = document.createElement("div");
    metadata.className = "reader-meta";
    const locale = [snapshot.language, snapshot.region].filter(Boolean).join(" · ");
    metadata.textContent = `Kaydedilme: ${formatDate(snapshot.fetchedAt)} · ${snapshot.scraperId}${locale ? ` · ${locale}` : ""}`;

    const heading = document.createElement("h2");
    heading.className = "reader-title";
    heading.textContent = title;

    const url = document.createElement("div");
    url.className = "reader-url";
    url.textContent = snapshot.sourceUrl;
    url.title = snapshot.sourceUrl;

    const copy = document.createElement("div");
    copy.className = "reader-copy";
    copy.textContent = text;

    reader.replaceChildren(metadata, heading, url, copy);
    renderList(await window.atlas.listArticles());
  } catch (error) {
    const message = document.createElement("p");
    message.className = "loading-copy";
    message.textContent = error instanceof Error ? error.message : String(error);
    reader.replaceChildren(message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const urls = textarea.value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);

  if (urls.length === 0) {
    setMessage("En az bir haber adresi gir.", "error");
    return;
  }

  if (urls.length > 500) {
    setMessage("Bir seferde en fazla 500 adres ekleyebilirsin.", "error");
    return;
  }

  captureButton.disabled = true;
  setMessage(`${urls.length} adres işleniyor…`);
  const stopListening = window.atlas.onCaptureProgress(({ processed, total }) => {
    setMessage(`${processed}/${total} adres işlendi…`);
  });

  try {
    const results = await window.atlas.captureArticles(urls);
    const saved = results.filter((result) => result.success).length;
    const failed = results.length - saved;
    const tone = failed === 0 ? "success" : "error";
    setMessage(failed === 0
      ? `${saved} haber arşive kaydedildi.`
      : `${saved} kayıt başarılı, ${failed} adres alınamadı.`, tone);
    textarea.value = "";

    const articles = await refreshList();
    await refreshSources();
    if (articles.length > 0) {
      const latest = results.find((result) => result.success)?.article?.sourceUrl;
      await openArticle(latest || articles[0].sourceUrl);
    }
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), "error");
  } finally {
    stopListening();
    captureButton.disabled = false;
  }
});

document.querySelector("#refresh-button").addEventListener("click", () => {
  void refreshList().catch((error) => setMessage(String(error), "error"));
});

refreshList().catch((error) => {
  articleCount.textContent = "yüklenemedi";
  setMessage(error instanceof Error ? error.message : String(error), "error");
});
refreshSources().catch((error) => setMessage(error instanceof Error ? error.message : String(error), "error"));

/* Guarda a aplicação no telemóvel para funcionar sem internet. Muda a versão a cada atualização. */
const VERSAO = "1.9.0-t2";
const FICHEIROS = ["./", "icone-180.png", "icone-512.png", "index.html", "manifest.json", "pacotes/aplicacao.zip", "pacotes/bibliotecas.zip", "ponte-pagina.js", "pyodide/Jinja2-3.1.3-py3-none-any.whl", "pyodide/click-8.1.7-py3-none-any.whl", "pyodide/markupsafe-2.1.5-cp312-cp312-pyodide_2024_0_wasm32.whl", "pyodide/pyodide-lock.json", "pyodide/pyodide.asm.js", "pyodide/pyodide.asm.wasm", "pyodide/pyodide.js", "pyodide/python_stdlib.zip", "pyodide/sqlite3-1.0.0-cp312-cp312-pyodide_2024_0_wasm32.whl", "static/app.js", "static/style.css"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("controlo-" + VERSAO).then((c) => c.addAll(FICHEIROS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("controlo-") && k !== "controlo-" + VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});

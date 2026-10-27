/* Corre dentro de cada página da aplicação (no iframe), antes dos outros scripts.
   Liga cliques, formulários e mudanças de página à aplicação que corre no telemóvel (window.parent.Controlo). */
(function () {
  "use strict";
  var C = window.parent && window.parent.Controlo;
  if (!C) return;

  // a âncora (#taxas, #irs…) que a aplicação pediu: os separadores das Configurações e da Simulação leem-na
  if (C.fragAtual) { try { history.replaceState(null, "", "#" + C.fragAtual); } catch (e) { /* sem âncora */ } }

  function interno(href) {
    try {
      var u = new URL(href, C.base);
      return u.origin === location.origin && (u.pathname + "/").indexOf(C.prefixo + "/") === 0 ? u : null;
    } catch (e) { return null; }
  }

  window.irPara = function (href) { C.navegar("GET", href); };
  history.back = function () { C.voltar(); };

  // ligações: só as da aplicação; as externas (Portal das Finanças…) abrem fora
  window.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;              // âncoras da própria página
    var u = interno(a.href);
    if (!u) { if (!a.target) { e.preventDefault(); window.open(a.href, "_blank", "noopener"); } return; }
    if (u.pathname.indexOf(C.prefixo + "/static/") === 0) return;
    e.preventDefault();
    C.navegar("GET", u.href);
  });

  function enviar(form, botao) {
    var metodo = (form.getAttribute("method") || "GET").toUpperCase();
    var acao = form.getAttribute("action");
    var url = new URL(acao === null || acao === "" ? C.urlAtual : form.action, C.base);
    var fd = new FormData(form);
    if (botao && botao.name) fd.append(botao.name, botao.value || "");
    if (metodo === "GET") {
      var q = new URLSearchParams();
      fd.forEach(function (v, k) { if (typeof v === "string") q.append(k, v); });
      url.search = q.toString();
      C.navegar("GET", url.href);
    } else {
      C.navegar("POST", url.href, fd);
    }
  }

  window.addEventListener("submit", function (e) {
    if (e.defaultPrevented) return;  // ex.: «Apagar este lançamento?» respondido com Cancelar
    e.preventDefault();
    enviar(e.target, e.submitter);
  });
  // form.submit() (escolha do ano, filtros) não dispara o evento «submit»
  HTMLFormElement.prototype.submit = function () { enviar(this, null); };
})();

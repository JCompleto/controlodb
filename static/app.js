/* Controlo Empresa — comportamento dos formulários e da lista. */
// v1.10.0: o que prepara o conteúdo da página (balões «i», avisos…) regista-se aqui, para voltar a correr
// quando o conteúdo é trocado sem recarregar (confirmar pago/recebido no Painel e nos Lançamentos)
window.CE = window.CE || { ini: [], iniciar: function (raiz) { this.ini.forEach(function (f) { f(raiz); }); } };
(function () {
  "use strict";

  // ---------- valores: aceita 1.234,56 · 260*21 · ROUND(1800*1.23;2) ----------
  function num(txt) {
    var s = String(txt || "").replace(/€|\s/g, "").replace(/^=/, "");
    if (!s) return 0;
    if (/round\s*\(/i.test(s)) s = s.replace(/;/g, ","); else if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(/,/g, ".");
    if (!/^[-+*/().,0-9a-z]*$/i.test(s)) return NaN;
    try {
      var js = s.replace(/round\s*\(/gi, "__r(");
      if (/[a-z_]/i.test(js.replace(/__r/g, ""))) return NaN;
      var v = Function("__r", '"use strict"; return (' + js + ");")(function (x, d) { d = d === undefined ? 0 : d; var f = Math.pow(10, d); return Math.round(x * f) / f; });
      return isFinite(v) ? v : NaN;
    } catch (e) { return NaN; }
  }
  function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  // mesmo formato do servidor: 1.234,56 € (o toLocaleString do browser não agrupa milhares de 4 dígitos)
  function eur(x) {
    if (!isFinite(x)) return "—";
    var p = Math.abs(x).toFixed(2).split(".");
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (x < -0.004 ? "-" : "") + p[0] + "," + p[1] + " €";
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function set(id, v) { var e = document.getElementById(id); if (e) e.textContent = eur(v); }
  function campo(f, nome) { var e = f.elements[nome]; return e ? num(e.value) : 0; }

  var f = $("form.lanc-form");
  if (f) {
    var tipo = f.dataset.tipo, iva = parseFloat(f.dataset.iva);

    if (tipo === "fatura") {
      var blocos = f.querySelectorAll("[data-modo]");
      var modo = function () { var r = f.querySelector("input[name=modo]:checked"); return r ? r.value : "dias"; };
      var calcular = function () {
        var m = modo();
        blocos.forEach(function (b) { b.hidden = b.dataset.modo !== m; });
        var base = m === "dias" ? r2(campo(f, "dias") * campo(f, "valor_dia")) : campo(f, "base");
        var isento = f.elements.rubrica.value === "isento";
        var v = isento ? 0 : r2(base * iva);
        set("p-base", base); set("p-iva", v); set("p-total", r2(base + v));
        document.getElementById("p-iva").parentNode.hidden = isento;
      };
      f.addEventListener("input", calcular); f.addEventListener("change", calcular); calcular();
    }

    if (tipo === "custo") {
      var ativa = function (div, on) {  // esconde e desativa (não envia) os campos de um bloco
        if (!div) return;
        div.hidden = !on;
        div.querySelectorAll("input,select").forEach(function (i) { i.disabled = !on; });
      };
      var calcC = function () {
        var v = campo(f, "valor"), renda = f.elements.rubrica.value === "renda";
        ativa(document.getElementById("c-renda"), renda);
        ativa(document.getElementById("c-pago-renda"), renda);
        ativa(document.getElementById("c-pago-normal"), !renda);
        document.getElementById("c-semiva-linha").hidden = renda;
        if (renda) {
          var pct = campo(f, "retencao_pct"), ret = r2(v * (isFinite(pct) ? pct : 0) / 100);
          set("p-ret-renda", ret); set("p-senhorio", r2(v - ret));
          set("p-total", v);
          document.getElementById("p-total-nome").textContent = "Fatura da renda (custo da empresa, sem IVA)";
        } else {
          set("p-total", f.elements.sem_iva.checked ? r2(v * (1 + iva)) : v);
          document.getElementById("p-total-nome").textContent = "Valor a registar";
        }
      };
      f.addEventListener("input", calcC); f.addEventListener("change", calcC); calcC();
    }

    if (tipo === "salario") {
      var ssC = parseFloat(f.dataset.ssColab), ssE = parseFloat(f.dataset.ssEmpresa);
      var pAlim = parseFloat(f.dataset.alim), pKm = parseFloat(f.dataset.km), pAj = parseFloat(f.dataset.ajuda);
      // subsídios de férias e de Natal: calculados pela definição do ano (não se escrevem)
      function subsidios() {
        var venc = campo(f, "vencimento"), ise = campo(f, "isencao"), mes = parseInt((document.getElementById("s-mes") || {}).value, 10) || 0;
        var sf, sn;
        if (f.dataset.subsDuo === "1") { sf = r2((venc + ise) / 12); sn = r2(venc / 12); }
        else { sf = mes === parseInt(f.dataset.subsMf, 10) ? r2(venc + ise) : 0; sn = mes === parseInt(f.dataset.subsMn, 10) ? r2(venc) : 0; }
        f.elements["sub_ferias"].value = sf.toFixed(2).replace(".", ",");
        f.elements["sub_natal"].value = sn.toFixed(2).replace(".", ",");
      }
      var calcS = function () {
        subsidios();
        if (typeof sugerirIRS === "function") sugerirIRS();
        var base = campo(f, "vencimento") + campo(f, "isencao") + campo(f, "sub_ferias") + campo(f, "sub_natal");
        var alim = r2(campo(f, "dias_alim") * pAlim), kmaj = r2(campo(f, "kms") * pKm) + r2(campo(f, "dias_ajudas") * pAj);
        var ss = r2(base * ssC), irs = campo(f, "irs"), ssEmp = r2(base * ssE);
        set("p-alim", alim); set("p-kmaj", kmaj); set("p-bruto", base + alim + kmaj);
        set("p-irs", irs); set("p-sscol", ss); set("p-liq", base + alim + kmaj - ss - irs);
        set("p-ssemp", ssEmp); set("p-estado", r2(irs + ss + ssEmp));
      };
      // IRS pela tabela oficial (mesma conta que core/irs.py).
      // Salário novo: o campo «IRS retido» acompanha a tabela sozinho, até ser alterado à mão.
      // Salário já lançado: fica o valor guardado; se diferir da tabela, aparece «Usar a tabela».
      var dica = document.getElementById("irs-dica"), sugerido = null;
      var auto = dica ? dica.dataset.auto === "1" : false, campoIRS = f.elements["irs"];
      function tabelaIRS() {
        var d = JSON.parse(dica.dataset.tabelas), linhas = d.tabelas[dica.dataset.tabela] || d.tabelas.I;
        var dep = parseInt(dica.dataset.dep, 10) || 0, mes = parseInt((document.getElementById("s-mes") || {}).value, 10) || 0;
        var R = campo(f, "vencimento") + campo(f, "isencao"), duo = campo(f, "sub_ferias") + campo(f, "sub_natal");
        var l = linhas[linhas.length - 1];
        for (var i = 0; i < linhas.length; i++) { if (linhas[i][0] === null || R <= linhas[i][0] + 1e-9) { l = linhas[i]; break; } }
        var taxa = l[1], parc = l[2];
        if (typeof parc === "object") parc = taxa * parc.k * (parc.c - R);
        var base = Math.max(0, R * taxa - parc - dep * l[3]), sub = R ? duo * base / R : 0, meio = false;
        if (f.dataset.subsDuo !== "1") sub = reterSo(linhas, duo, dep);  // por inteiro: retenção autónoma sobre o subsídio
        (d.ajustes || []).forEach(function (a) {
          if (a.mes === mes && !(a.exceto_acima_penultimo && R > linhas[linhas.length - 2][0])) { base *= a.fator; sub *= a.fator; meio = true; }
        });
        return { valor: r2(base + sub), isento: taxa === 0, meio: meio };
      }
      function reterSo(linhas, R, dep) {
        if (R <= 0) return 0;
        var l = linhas[linhas.length - 1];
        for (var i = 0; i < linhas.length; i++) { if (linhas[i][0] === null || R <= linhas[i][0] + 1e-9) { l = linhas[i]; break; } }
        var p = l[2]; if (typeof p === "object") p = l[1] * p.k * (p.c - R);
        return Math.max(0, R * l[1] - p - dep * l[3]);
      }
      function sugerirIRS() {
        if (!dica) return;
        var t = tabelaIRS(); sugerido = t.valor;
        var txt = sugerido.toFixed(2).replace(".", ",");
        if (auto && campoIRS.value !== txt) { campoIRS.value = txt; }
        var lancado = campo(f, "irs"), igual = Math.abs(lancado - sugerido) < 0.005;
        document.getElementById("irs-sug").textContent = eur(sugerido) + (t.isento ? " (isento)" : "") + (t.meio ? " (50 % em novembro)" : "");
        document.getElementById("irs-estado").textContent = (auto ? "Calculado pela tabela" : (igual ? "Igual à tabela" : "Pela tabela")) + ":";
        document.getElementById("irs-usar").hidden = auto || igual;
        dica.classList.toggle("difere", !auto && !igual);
      }
      if (campoIRS) campoIRS.addEventListener("input", function () { auto = false; });
      var usar = document.getElementById("irs-usar");
      if (usar) usar.addEventListener("click", function () { auto = true; calcS(); });
      f.addEventListener("input", calcS); calcS();
      // mudar de mês recarrega o formulário com os valores desse mês (ou do último lançado)
      var sel = document.getElementById("s-mes");
      if (sel) sel.addEventListener("change", function () { var u = sel.dataset.url + "&mes=" + sel.value; if (window.irPara) window.irPara(u); else location.href = u; });  // irPara: versão telemóvel
    }

    if (tipo === "despesa") {
      var rotuloD = function () {
        var por = f.querySelector("input[name=pago_por]:checked"), d = document.getElementById("d-pago");
        var emp = por && por.value === "empresa";
        d.querySelector("label.check").lastChild.textContent = " " + d.dataset[emp ? "txtEmpresa" : "txtSocio"];
        f.querySelectorAll("[data-pagopor-nota]").forEach(function (n) { n.hidden = n.getAttribute("data-pagopor-nota") !== (emp ? "empresa" : "socio"); });
      };
      f.addEventListener("change", rotuloD); rotuloD();
    }

    // «Em que dia?» só aparece quando o lançamento está marcado como pago/recebido
    f.querySelectorAll(".pago-bloco").forEach(function (bloco) {
      var cx = bloco.querySelector("input[type=checkbox]"), dt = bloco.querySelector(".data-pago");
      var atualiza = function () { dt.hidden = !cx.checked; if (cx.checked && !dt.querySelector("input").value) dt.querySelector("input").value = new Date().toISOString().slice(0, 10); };
      cx.addEventListener("change", atualiza); dt.hidden = !cx.checked;
    });

    // Enter não deve guardar sem querer num campo de seleção; Esc volta atrás
    f.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (document.querySelector(".ajuda-wrap.aberto") || (e.target && e.target.closest && e.target.closest(".ajuda-wrap"))) return; // Esc fecha só o balão
      history.back();
    });
  }

  // ---------- pesquisa no diário ----------
  document.addEventListener("input", function (ev) {
    var q = ev.target;
    if (!q || q.id !== "filtro-texto") return;
    (function () {
      var t = q.value.trim().toLowerCase();
      document.querySelectorAll("#diario tr[data-txt]").forEach(function (tr) { tr.hidden = t && tr.dataset.txt.indexOf(t) < 0; });
      // esconde o cabeçalho de um mês quando não sobra nenhuma linha dele
      var cab = null, algum = false;
      document.querySelectorAll("#diario tr").forEach(function (tr) {
        if (tr.classList.contains("mes-cab")) { if (cab) cab.hidden = !algum; cab = tr; algum = false; }
        else if (!tr.hidden) algum = true;
      });
      if (cab) cab.hidden = !algum;
      var soma = 0, n = 0;
      document.querySelectorAll("#diario tr[data-valor]").forEach(function (tr) { if (!tr.hidden) { soma += parseFloat(tr.dataset.valor) || 0; n++; } });
      var tv = document.getElementById("tot-valor"), tn = document.getElementById("tot-n");
      if (tv) tv.textContent = soma.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
      if (tn) tn.textContent = n;
    })();
  });
})();

// v4: janela de confirmação (ex.: «Trocar» de base de dados)
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var abrir = e.target.closest("[data-abrir]");
    if (abrir) {
      if (abrir.tagName === "A" && !(e.ctrlKey || e.metaKey || e.shiftKey)) e.preventDefault();  // a janela em vez da página
      var d = document.getElementById(abrir.getAttribute("data-abrir"));
      if (d && d.showModal) { d.showModal(); var b = d.querySelector("[data-fechar]"); if (b) b.focus(); }
      else if (d) { var f = d.querySelector("form"); if (f && window.confirm("Tem a certeza de que quer trocar de base de dados?")) f.submit(); }
      return;
    }
    var fechar = e.target.closest("[data-fechar]");
    if (fechar) { var dd = fechar.closest("dialog"); if (dd) dd.close(); return; }
    if (e.target.tagName === "DIALOG") e.target.close(); // clique fora da caixa
  });
})();

// v6: notificações em baixo que desaparecem sozinhas (erros ficam mais tempo)
(function () {
  "use strict";
  function fechar(t) { if (!t || t.classList.contains("sai")) return; t.classList.add("sai"); setTimeout(function () { t.remove(); }, 320); }
  function preparar(raiz) { raiz.querySelectorAll(".toast").forEach(function (t) {
    var tempo = t.classList.contains("erro") ? 12000 : 5000, id = setTimeout(function () { fechar(t); }, tempo);
    t.addEventListener("mouseenter", function () { clearTimeout(id); });
    t.addEventListener("mouseleave", function () { id = setTimeout(function () { fechar(t); }, 2500); });
    var x = t.querySelector(".toast-x"); if (x) x.addEventListener("click", function () { fechar(t); });
  }); }
  preparar(document);
  window.CE.ini.push(preparar);
})();


// imposto: ao mudar o imposto (num lançamento novo), sugere o ano a que respeita
(function () {
  "use strict";
  var f = document.querySelector("form.lanc-form[data-tipo=imposto]");
  if (!f) return;
  var rub = f.elements["rubrica"], ref = document.getElementById("i-ano-ref"), mexido = false;
  if (!rub || !ref) return;
  ref.addEventListener("change", function () { mexido = true; });
  rub.addEventListener("change", function () {
    if (mexido || f.dataset.editar) return;
    var a = parseInt(ref.dataset.ano, 10);
    ref.value = String(a);  // cada imposto no ano a que respeita, como no Excel
  });
})();

// v1.1.0: explicações em balões «i» junto aos títulos, em vez de texto solto nos blocos
(function () {
  "use strict";
  var raiz = document.documentElement;
  var CAB = ".titulo-linha, .cc-cab, .lc-cab, .fc-cab";

  function cabecalhoDe(el) {
    if (el.matches("h1, h2, h3, legend")) return el;
    if (el.matches(CAB)) { var hs = el.querySelectorAll("h1, h2, h3"); return hs.length ? hs[hs.length - 1] : null; }
    return null;
  }
  // título a que a nota pertence: o indicado, o anterior no mesmo bloco, ou o do bloco que a contém
  function ancora(nota) {
    var alvo = nota.getAttribute("data-ajuda-para");
    if (alvo) { var a = document.querySelector(alvo); if (a) return a; }
    var el = nota;
    while (el && el.tagName !== "MAIN" && el.tagName !== "BODY") {
      for (var s = el.previousElementSibling; s; s = s.previousElementSibling) {
        var h = cabecalhoDe(s);
        if (h) return h;
      }
      el = el.parentElement;
    }
    return null;
  }
  function fecharTodos(excepto) {
    document.querySelectorAll(".ajuda-wrap.aberto").forEach(function (w) {
      if (w !== excepto) { w.classList.remove("aberto"); w.querySelector(".ajuda-btn").setAttribute("aria-expanded", "false"); }
    });
  }
  function posicionar(w) {
    var b = w.querySelector(".ajuda-balao");
    b.classList.remove("direita");
    var r = w.getBoundingClientRect();
    if (r.left + 380 > window.innerWidth) b.classList.add("direita");
  }

  var n = 0;
  function preparar(raiz) { raiz.querySelectorAll("p.nota:not(.fica)").forEach(function (nota) {
    if (!nota.closest("main") || nota.closest(".ajuda-balao")) return;
    var h = ancora(nota);
    if (!h) { nota.classList.add("fica"); return; }
    var w = h.querySelector(":scope > .ajuda-wrap");
    if (!w) {
      n += 1;
      w = document.createElement("span");
      w.className = "ajuda-wrap";
      w.innerHTML = '<button type="button" class="ajuda-btn" aria-expanded="false" aria-describedby="ajuda-' + n + '" aria-label="O que é isto?">i</button>' +
                    '<span class="ajuda-balao" role="tooltip" id="ajuda-' + n + '"></span>';
      h.appendChild(w);
      var btn = w.querySelector(".ajuda-btn");
      btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        var abrir = !w.classList.contains("aberto");
        fecharTodos(w);
        w.classList.toggle("aberto", abrir);
        btn.setAttribute("aria-expanded", abrir ? "true" : "false");
        if (abrir) posicionar(w);
      });
      w.addEventListener("mouseenter", function () { posicionar(w); });
      w.addEventListener("click", function (e) { if (e.target.closest(".ajuda-balao")) e.stopPropagation(); });
    }
    w.querySelector(".ajuda-balao").appendChild(nota);
  }); }
  preparar(document);
  window.CE.ini.push(preparar);
  raiz.classList.add("ajuda-pronta");
  document.addEventListener("click", function () { fecharTodos(null); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { fecharTodos(null); if (document.activeElement && document.activeElement.classList.contains("ajuda-btn")) document.activeElement.blur(); }
    var t = e.target;
    if (e.key === "?" && !(t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)))) { e.preventDefault(); alternar(); }
  });

  // interruptor: mostrar todas as explicações no sítio (fica memorizado neste computador)
  var tg = document.getElementById("ajuda-toggle");
  function mostrarEstado() {
    var fixa = raiz.classList.contains("ajuda-fixa");
    if (tg) { tg.setAttribute("aria-pressed", fixa ? "true" : "false"); tg.querySelector(".at-estado").textContent = fixa ? "visíveis" : "ocultas"; }
  }
  function alternar() {
    var fixa = raiz.classList.toggle("ajuda-fixa");
    try { localStorage.setItem("ajuda-fixa", fixa ? "1" : "0"); } catch (e) { /* sem memória: fica só nesta página */ }
    fecharTodos(null); mostrarEstado();
  }
  if (tg) tg.addEventListener("click", alternar);
  mostrarEstado();
})();


// configurações: meses dos subsídios só quando são pagos por inteiro
(function () {
  "use strict";
  var m = document.getElementById("subs-modo");
  if (!m) return;
  function mostrar() { document.querySelectorAll("[data-subs-inteiro]").forEach(function (l) { l.hidden = m.value !== "inteiro"; }); }
  m.addEventListener("change", mostrar); mostrar();
})();

// v1.4.0: separadores das Configurações (#empresa, #taxas, #verificacoes, #despesas, #dados)
(function () {
  "use strict";
  var barra = document.querySelector(".seps-pagina");
  if (!barra) return;
  var paineis = document.querySelectorAll(".sep-painel");
  // ligações antigas para dentro de um separador
  var ALIAS = { irs: "verificacoes", "tipos-despesa": "despesas" };
  function existe(n) { return !!document.querySelector('.sep-painel[data-sep="' + n + '"]'); }
  function mostrar(nome, alvo) {
    if (!existe(nome)) nome = barra.dataset.inicio || "empresa";
    paineis.forEach(function (p) { p.classList.toggle("ativo", p.dataset.sep === nome); });
    barra.querySelectorAll("a[data-sep]").forEach(function (a) {
      var on = a.dataset.sep === nome;
      a.classList.toggle("ativo", on); a.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (alvo) { var el = document.getElementById(alvo); if (el) el.scrollIntoView({ block: "start" }); }
  }
  function doHash() {
    var h = (location.hash || "").replace("#", "");
    if (!h) return mostrar(barra.dataset.inicio || "empresa");
    if (ALIAS[h]) return mostrar(ALIAS[h], h);
    mostrar(h);
  }
  barra.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-sep]");
    if (!a) return;
    e.preventDefault();
    history.replaceState(null, "", "#" + a.dataset.sep);
    mostrar(a.dataset.sep);
    window.scrollTo({ top: 0 });
  });
  window.addEventListener("hashchange", doHash);
  doHash();
  document.documentElement.classList.add("seps-prontos");
})();


// v1.8.0: tema, guardado neste browser (v1.19.5: Night Blue, Claro, Aurora, Estação)
(function () {
  "use strict";
  var TEMAS = ["claro", "aurora", "estacao"];  // o Night Blue é o tema sem atributo
  var raiz = document.documentElement, ops = document.querySelectorAll('input[name="tema"]');
  if (!ops.length) return;
  var atual = TEMAS.indexOf(raiz.dataset.tema) >= 0 ? raiz.dataset.tema : "night-blue";
  ops.forEach(function (o) {
    o.checked = o.value === atual;
    o.addEventListener("change", function () {
      var t = TEMAS.indexOf(o.value) >= 0 ? o.value : "night-blue";
      if (t === "night-blue") delete raiz.dataset.tema; else raiz.dataset.tema = t;
      try { localStorage.setItem("tema", t); } catch (e) { /* sem memória: só nesta página */ }
    });
  });
})();


// v1.10.0: confirmar «pago/recebido» (ou desfazer) sem recarregar a página toda: envia em segundo plano e troca só o
// conteúdo, mantendo a posição. Se algo correr mal, envia da forma normal.
(function () {
  "use strict";
  if (window.parent && window.parent !== window && window.parent.Controlo) return; // no telemóvel a ponte trata dos formulários
  if (!window.fetch || !window.DOMParser) return;
  var main = document.querySelector("main.conteudo");
  if (!main) return;

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (e.defaultPrevented || !form.closest || !form.closest("details.est")) return;
    e.preventDefault();
    var botao = form.querySelector("button[type=submit]");
    if (botao) botao.disabled = true;
    var y = window.scrollY;
    var rolagens = Array.prototype.map.call(main.querySelectorAll(".rolagem"), function (r) { return r.scrollTop; });
    var filtro = document.getElementById("filtro-texto"), txt = filtro ? filtro.value : "";
    fetch(form.action, { method: "POST", body: new FormData(form), credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        var u = new URL(r.url);
        if (u.pathname !== location.pathname) { location.href = r.url; return null; } // foi para outra página (ex.: escolher a base)
        return r.text();
      })
      .then(function (html) {
        if (html === null) return;
        var novo = new DOMParser().parseFromString(html, "text/html").querySelector("main.conteudo");
        if (!novo) throw new Error("sem conteúdo");
        main.innerHTML = novo.innerHTML;
        window.CE.iniciar(main);
        main.querySelectorAll(".rolagem").forEach(function (r, i) { if (rolagens[i]) r.scrollTop = rolagens[i]; });
        var f2 = document.getElementById("filtro-texto");
        if (f2 && txt) { f2.value = txt; f2.dispatchEvent(new Event("input", { bubbles: true })); }
        window.scrollTo(0, y);
      })
      .catch(function () { if (botao) botao.disabled = false; HTMLFormElement.prototype.submit.call(form); });
  });
})();

// v1.11.0: fatura ligada ao lançamento — escolher na pasta da empresa, carregar do computador ou tirar
(function () {
  "use strict";
  var bloco = document.querySelector("[data-doc]");
  if (!bloco) return;
  var f = bloco.closest("form");
  var campo = bloco.querySelector("input[name=documento]");
  var ficheiro = bloco.querySelector("[data-doc-ficheiro]");
  var nome = bloco.querySelector("[data-doc-nome]"), ext = bloco.querySelector("[data-doc-ext]");
  var abrir = bloco.querySelector("[data-doc-abrir]"), tirar = bloco.querySelector("[data-doc-tirar]");
  var escolher = bloco.querySelector("[data-doc-escolher]"), tit = document.getElementById("doc-tit");
  var janela = document.querySelector("[data-doc-janela]");
  var lista = janela.querySelector("[data-dj-lista]"), migalhas = janela.querySelector("[data-dj-migalhas]"), msg = janela.querySelector("[data-dj-msg]");

  var dispensa = document.querySelector("[data-doc-dispensa]");
  function extensao(n) { var p = String(n).split("."); return p.length > 1 ? p.pop().toUpperCase().slice(0, 4) : "?"; }
  function mostrar(rel, carregado) {
    var tem = !!(rel || carregado);
    bloco.classList.toggle("tem", tem);
    if (carregado) {
      nome.textContent = carregado + " (vai para a pasta do mês ao guardar)";
      ext.textContent = extensao(carregado);
    } else {
      nome.textContent = rel ? rel.split("/").join(" › ") : "Sem fatura ligada";
      ext.textContent = rel ? extensao(rel) : "+";
    }
    if (tit) tit.firstChild.textContent = tem ? "Fatura ligada" : "Fatura";
    abrir.hidden = !rel || !!carregado;
    if (rel) abrir.href = bloco.dataset.fichUrl + "?p=" + encodeURIComponent(rel);
    tirar.hidden = !tem;
    if (dispensa) { dispensa.closest("label").hidden = tem; if (tem) dispensa.checked = false; }
    escolher.textContent = tem ? "Trocar" : "Escolher na pasta";
  }
  ficheiro.addEventListener("change", function () {
    if (ficheiro.files && ficheiro.files[0]) { campo.value = ""; mostrar("", ficheiro.files[0].name); }
  });
  tirar.addEventListener("click", function () { campo.value = ""; ficheiro.value = ""; mostrar("", ""); });

  function valor(nomeCampo) { var e = f.elements[nomeCampo]; return e ? (e.value || "") : ""; }
  function socio() {
    var r = f.querySelector("input[name=pago_por]:checked");
    return r ? (r.value === "socio" ? "1" : "0") : bloco.dataset.socio;
  }
  function erro(t) { msg.textContent = t; msg.hidden = false; }

  function carregar(rel) {
    msg.hidden = true;
    fetch(bloco.dataset.pastaUrl + "?p=" + encodeURIComponent(rel || ""), { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.erro) { erro(d.erro); return; }
        migalhas.textContent = "";
        d.migalhas.forEach(function (m, i) {
          if (i) { var s = document.createElement("span"); s.className = "dj-sep"; s.textContent = "›"; migalhas.appendChild(s); }
          var b = document.createElement("button");
          b.type = "button"; b.className = "dj-mig"; b.textContent = m.nome;
          if (i === d.migalhas.length - 1) b.setAttribute("aria-current", "true");
          b.addEventListener("click", function () { carregar(m.rel); });
          migalhas.appendChild(b);
        });
        lista.textContent = "";
        d.pastas.forEach(function (p) {
          var li = document.createElement("li"), b = document.createElement("button");
          b.type = "button"; b.className = "dj-item dj-pasta";
          b.innerHTML = '<span class="dj-ico" aria-hidden="true"></span><span class="dj-n"></span>';
          b.querySelector(".dj-n").textContent = p.nome;
          b.addEventListener("click", function () { carregar(p.rel); });
          li.appendChild(b); lista.appendChild(li);
        });
        d.ficheiros.forEach(function (p) {
          var li = document.createElement("li"), b = document.createElement("button");
          b.type = "button"; b.className = "dj-item dj-fich" + (p.rel === campo.value ? " atual" : "");
          b.innerHTML = '<span class="dj-ext"></span><span class="dj-n"></span><span class="dj-kb"></span>';
          b.querySelector(".dj-ext").textContent = extensao(p.nome);
          b.querySelector(".dj-n").textContent = p.nome;
          b.querySelector(".dj-kb").textContent = p.kb + " KB";
          b.addEventListener("click", function () { campo.value = p.rel; ficheiro.value = ""; mostrar(p.rel, ""); janela.close(); });
          var ver = document.createElement("a");
          ver.className = "botao peq dj-ver"; ver.textContent = "Ver"; ver.target = "_blank"; ver.rel = "noopener";
          ver.href = bloco.dataset.fichUrl + "?p=" + encodeURIComponent(p.rel);
          li.appendChild(b); li.appendChild(ver); lista.appendChild(li);
        });
        if (!d.pastas.length && !d.ficheiros.length) erro("Esta pasta não tem PDFs nem imagens.");
      })
      .catch(function () { erro("Não consegui ler a pasta."); });
  }

  escolher.addEventListener("click", function () {
    janela.showModal();
    if (campo.value) { carregar(campo.value.split("/").slice(0, -1).join("/")); return; }
    var mes = valor("mes"), data = valor("data");
    var q = "?ano=" + encodeURIComponent(bloco.dataset.ano) + "&mes=" + encodeURIComponent(mes) + "&data=" + encodeURIComponent(data) + "&socio=" + socio();
    fetch(bloco.dataset.sugUrl + q).then(function (r) { return r.json(); })
      .then(function (d) { carregar(d.rel || ""); }).catch(function () { carregar(""); });
  });
})();

// v1.11.0: conta do sócio — total do reembolso conforme as despesas marcadas
(function () {
  "use strict";
  var f = document.querySelector("form[data-reembolso]");
  if (!f) return;
  var out = f.querySelector("[data-reembolso-total]");
  function eur(x) { var p = Math.abs(x).toFixed(2).split("."); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, "."); return p[0] + "," + p[1] + " €"; }
  function somar() {
    var t = 0;
    f.querySelectorAll("input[data-valor]:checked").forEach(function (c) { t += parseFloat(c.dataset.valor) || 0; });
    out.textContent = eur(t);
  }
  f.addEventListener("change", somar);
})();

// v1.14.0: primeiro ano de uma base nova — mostra o saldo inicial que vai ficar guardado
(function () {
  "use strict";
  var f = document.querySelector("form[data-primeiro-ano]");
  if (!f) return;
  function num(t) {
    var s = String(t || "").replace(/€|\s/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    var v = parseFloat(s);
    return isFinite(v) ? v : 0;
  }
  function eur(x) { var p = Math.abs(x).toFixed(2).split("."); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, "."); return (x < -0.004 ? "-" : "") + p[0] + "," + p[1] + " €"; }
  var real = f.querySelector("[data-pa=real]"), est = f.querySelector("[data-pa=est]");
  var ano = f.elements.novo, data = f.elements.data;
  function calc() {
    var b = num(f.elements.banco.value), c = num(f.elements.capital.value), s = num(f.elements.socio.value);
    real.textContent = f.elements.banco.value ? eur(b - c) : "—";
    est.textContent = f.elements.banco.value ? eur(b - c - s) : "—";
  }
  ano.addEventListener("change", function () { if (/^\d{4}$/.test(ano.value) && (!data.value || data.value.slice(5) === "01-01")) data.value = ano.value + "-01-01"; });
  f.addEventListener("input", calc); calc();
})();

// v1.19.1: «Lançamento» desfoca a página e abre a lista vertical dos tipos
(function () {
  "use strict";
  var veu = document.querySelector(".nb-veu");
  function aberta() { return document.querySelector(".nb-wrap.aberto"); }
  function fechar(focar) {
    var w = aberta();
    if (!w) return;
    w.classList.remove("aberto");
    w.querySelector(".nb-lista").hidden = true;
    w.querySelector(".nb-btn").setAttribute("aria-expanded", "false");
    if (veu) veu.hidden = true;
    document.documentElement.classList.remove("nb-ativo");
    if (focar) w.querySelector(".nb-btn").focus();
  }
  function abrir(w) {
    fechar(false);
    w.classList.add("aberto");
    w.querySelector(".nb-lista").hidden = false;
    w.querySelector(".nb-btn").setAttribute("aria-expanded", "true");
    if (veu) veu.hidden = false;
    document.documentElement.classList.add("nb-ativo");
    var a = w.querySelector(".nb-op.sugerido") || w.querySelector(".nb-op");
    if (a) a.focus();
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".nb-btn");
    if (btn) {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      var w = btn.closest(".nb-wrap");
      if (w.classList.contains("aberto")) fechar(true); else abrir(w);
      return;
    }
    if (aberta() && !e.target.closest(".nb-lista")) fechar(false);
  });
  document.addEventListener("keydown", function (e) {
    var w = aberta();
    if (!w) return;
    if (e.key === "Escape") { e.preventDefault(); fechar(true); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      var ops = Array.prototype.slice.call(w.querySelectorAll(".nb-op")), i = ops.indexOf(document.activeElement);
      e.preventDefault();
      ops[(i + (e.key === "ArrowDown" ? 1 : -1) + ops.length) % ops.length].focus();
    }
  });
})();

// v1.19.4: bloco Contas — ao clicar num valor, a página desfoca (como no «Lançamento») e a lista do que o forma
// cai por baixo da linha clicada, que fica nítida. Fecha ao clicar fora, com Esc ou voltando a clicar.
(function () {
  "use strict";
  var veu = document.querySelector(".nb-veu");
  var alvo = null, lista = null;
  function fechar(focar) {
    if (!alvo) return;
    lista.hidden = true;
    alvo.classList.remove("bv-alvo");
    alvo.setAttribute("aria-expanded", "false");
    if (veu) veu.hidden = true;
    if (focar) alvo.focus();
    alvo = lista = null;
  }
  function posicionar() {
    if (!alvo) return;
    var r = alvo.getBoundingClientRect(), w = lista.offsetWidth;
    var esq = Math.max(16, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - w - 16));
    lista.style.left = esq + "px";
    // a seta do balão aponta para o início do texto da linha clicada
    lista.style.setProperty("--seta", Math.max(14, Math.min(w - 30, r.left + window.scrollX - esq + 24)) + "px");
    lista.style.top = (r.bottom + window.scrollY + 12) + "px";
  }
  function abrir(a) {
    fechar(false);
    var l = document.getElementById(a.getAttribute("data-balao"));
    if (!l) return;
    // depois de uma atualização parcial do Painel pode haver uma cópia antiga já mudada para o fim da página
    Array.prototype.forEach.call(document.querySelectorAll("body > .bv-lista"), function (x) { if (x !== l && x.id === l.id) x.remove(); });
    if (l.parentNode !== document.body) document.body.appendChild(l);
    alvo = a; lista = l;
    a.classList.add("bv-alvo");
    a.setAttribute("aria-expanded", "true");
    if (veu) veu.hidden = false;
    l.hidden = false;
    posicionar();
    var p = l.querySelector(".bv-op") || l.querySelector(".bv-link");
    if (p) p.focus({ preventScroll: true });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-balao]");
    if (a) {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      if (a === alvo) fechar(true); else abrir(a);
      return;
    }
    if (alvo && !e.target.closest(".bv-lista")) fechar(false);
  });
  document.addEventListener("keydown", function (e) {
    if (!alvo) return;
    if (e.key === "Escape") { e.preventDefault(); fechar(true); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      var ops = Array.prototype.slice.call(lista.querySelectorAll(".bv-op, .bv-link")), i = ops.indexOf(document.activeElement);
      e.preventDefault();
      ops[(i + (e.key === "ArrowDown" ? 1 : -1) + ops.length) % ops.length].focus();
    }
  });
  window.addEventListener("resize", posicionar);
})();

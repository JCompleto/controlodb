/* Controlo Empresa — comportamento dos formulários e da lista. */
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
  var q = document.getElementById("filtro-texto");
  if (q) {
    q.addEventListener("input", function () {
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
    });
  }
})();

// v4: janela de confirmação (ex.: «Trocar» de base de dados)
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var abrir = e.target.closest("[data-abrir]");
    if (abrir) {
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
  document.querySelectorAll(".toast").forEach(function (t) {
    var tempo = t.classList.contains("erro") ? 12000 : 5000, id = setTimeout(function () { fechar(t); }, tempo);
    t.addEventListener("mouseenter", function () { clearTimeout(id); });
    t.addEventListener("mouseleave", function () { id = setTimeout(function () { fechar(t); }, 2500); });
    var x = t.querySelector(".toast-x"); if (x) x.addEventListener("click", function () { fechar(t); });
  });
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
  document.querySelectorAll("main p.nota:not(.fica)").forEach(function (nota) {
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
  });
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


// v1.8.0: tema (Night Blue / Claro), guardado neste browser
(function () {
  "use strict";
  var raiz = document.documentElement, ops = document.querySelectorAll('input[name="tema"]');
  if (!ops.length) return;
  var atual = raiz.dataset.tema === "claro" ? "claro" : "night-blue";
  ops.forEach(function (o) {
    o.checked = o.value === atual;
    o.addEventListener("change", function () {
      if (o.value === "claro") raiz.dataset.tema = "claro"; else delete raiz.dataset.tema;
      try { localStorage.setItem("tema", o.value === "claro" ? "claro" : "night-blue"); } catch (e) { /* sem memória: só nesta página */ }
    });
  });
})();

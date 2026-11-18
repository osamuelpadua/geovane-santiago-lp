/* Questionário de agendamento em modal.
   Abre ao clicar em qualquer [data-agendar]; no fim monta a mensagem com as respostas e abre o WhatsApp.
   Sem JavaScript, os botões continuam funcionando como link direto para o WhatsApp (href). */
(function () {
  var dialog = document.getElementById('agendar');
  if (!dialog) return;

  var CONFIG = window.AGENDAR_CONFIG || {};
  var FONE = CONFIG.whatsapp || '5514996093713';

  var raiz = dialog.querySelector('.ag-body');
  var barra = document.getElementById('ag-bar');
  var ordem = ['ag-local', 'ag-queixa', 'ag-trat', 'ag-part', 'ag-nome'];
  var progresso = { 'ag-local': 16, 'ag-presencial': 16, 'ag-queixa': 33, 'ag-outra': 33, 'ag-trat': 50, 'ag-part': 66, 'ag-reembolso': 66, 'ag-nome': 83, 'ag-whats': 100, 'ag-fim': 100, 'ag-pensar': 100 };
  var pilha = [];
  var resp = {};
  var ultimoGatilho = null;
  var temporizador = null;
  var tentativaAtual = 0;
  var envioId = '';
  document.getElementById('ag-wa').addEventListener('click', function () { clearInterval(temporizador); });

  function push(obj) {
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(obj); } catch (e) {}
  }

  /* ---------- abrir / fechar ---------- */
  function abrir(gatilho) {
    ultimoGatilho = gatilho || null;
    reiniciar();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.documentElement.classList.add('ag-aberto');
    push({ event: 'agendamento_aberto' });
  }
  function fechar() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
  dialog.addEventListener('close', function () {
    tentativaAtual++;
    document.documentElement.classList.remove('ag-aberto');
    clearInterval(temporizador);
    if (ultimoGatilho && ultimoGatilho.focus) ultimoGatilho.focus();
  });
  dialog.querySelector('.ag-close').addEventListener('click', fechar);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) fechar(); }); // clique fora do cartão

  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-agendar]');
    if (!g || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    abrir(g);
  });
  if (location.hash === '#agendar') abrir();

  /* ---------- navegação entre telas ---------- */
  function tela(id) {
    raiz.querySelectorAll('.ag-step').forEach(function (s) { s.classList.remove('on'); });
    document.getElementById(id).classList.add('on');
    if (progresso[id]) barra.style.width = progresso[id] + '%';
    raiz.scrollTop = 0;
  }

  function reiniciar() {
    tentativaAtual++;
    clearInterval(temporizador);
    pilha = [];
    resp = {};
    raiz.querySelectorAll('.ag-opt').forEach(function (o) { o.classList.remove('sel'); });
    raiz.querySelectorAll('.ag-next').forEach(function (b) { b.disabled = true; });
    ['ag-in-outra', 'ag-in-nome', 'ag-in-whats'].forEach(function (id) { document.getElementById(id).value = ''; });
    document.getElementById('ag-erro-whats').textContent = '';
    document.getElementById('ag-opening').classList.remove('done');
    document.getElementById('ag-wa').removeAttribute('href');
    document.getElementById('ag-wa').setAttribute('aria-disabled', 'true');
    document.getElementById('ag-retry').hidden = true;
    envioId = '';
    tela('ag-local');
  }

  /* ---------- perguntas de escolha: avançam sozinhas ---------- */
  raiz.querySelectorAll('.ag-step').forEach(function (sec) {
    var botao = sec.querySelector('.ag-next');
    var opcoes = sec.querySelectorAll('.ag-opt');
    if (!opcoes.length) return;
    if (botao) botao.style.display = 'none';
    var espera = null;
    opcoes.forEach(function (op) {
      op.setAttribute('role', 'button');
      function marcar() {
        opcoes.forEach(function (o) { o.classList.remove('sel'); });
        op.classList.add('sel');
        resp[sec.id] = op.dataset.v || '';
        if (botao) botao.disabled = false;
        clearTimeout(espera);
        espera = setTimeout(function () { if (botao && sec.classList.contains('on')) botao.click(); }, 320);
      }
      op.addEventListener('click', marcar);
      op.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); marcar(); }
      });
    });
  });

  raiz.querySelectorAll('.ag-next').forEach(function (b) {
    b.addEventListener('click', function () {
      var sec = b.closest('.ag-step');
      var sel = sec.querySelector('.ag-opt.sel');
      if (!sel) return;
      pilha.push(sec.id);
      if (sel.dataset.go) { tela(sel.dataset.go); return; }
      // "vou me organizar para ir" volta ao fluxo normal
      if (sec.id === 'ag-presencial') { resp['ag-local'] = resp['ag-presencial']; tela('ag-queixa'); return; }
      // "entendi, quero seguir pelo reembolso" segue para o nome
      if (sec.id === 'ag-reembolso') { resp['ag-part'] = resp['ag-reembolso']; tela('ag-nome'); return; }
      var i = ordem.indexOf(sec.id);
      if (i > -1 && i + 1 < ordem.length) tela(ordem[i + 1]);
    });
  });

  raiz.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () {
      var anterior = pilha.pop();
      if (anterior) tela(anterior);
    });
  });

  /* ---------- outra queixa (texto livre) ---------- */
  var campoOutra = document.getElementById('ag-in-outra');
  var btOutra = document.getElementById('ag-bt-outra');
  campoOutra.addEventListener('input', function () {
    resp['ag-outra'] = campoOutra.value.trim();
    btOutra.disabled = resp['ag-outra'].length < 3;
  });
  btOutra.addEventListener('click', function () { pilha.push('ag-outra'); tela('ag-trat'); });

  /* ---------- nome ---------- */
  var campoNome = document.getElementById('ag-in-nome');
  var btNome = document.getElementById('ag-bt-nome');
  campoNome.addEventListener('input', function () {
    resp.nome = campoNome.value.trim();
    btNome.disabled = resp.nome.length < 2;
  });
  campoNome.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !btNome.disabled) { e.preventDefault(); btNome.click(); }
  });
  btNome.addEventListener('click', function () {
    pilha.push('ag-nome');
    var nm = primeiroNome();
    document.getElementById('ag-whats-q').textContent = nm ? 'Qual o seu WhatsApp, ' + nm + '?' : 'Qual o seu WhatsApp?';
    tela('ag-whats');
    setTimeout(function () { campoWhats.focus(); }, 320);
  });

  /* ---------- WhatsApp (máscara brasileira) ---------- */
  var campoWhats = document.getElementById('ag-in-whats');
  var btWhats = document.getElementById('ag-bt-whats');
  var erroWhats = document.getElementById('ag-erro-whats');

  function digitos() { return campoWhats.value.replace(/\D/g, '').slice(0, 11); }
  function mascara(d) {
    if (d.length <= 2) return d ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }
  // celular: DDD + 9 + 8 dígitos; fixo: DDD + 8 dígitos começando em 2 a 5
  function valido(d) { return (d.length === 11 && d.charAt(2) === '9') || (d.length === 10 && /[2-5]/.test(d.charAt(2))); }

  function checar(mostrarErro) {
    var d = digitos();
    var ok = valido(d);
    resp.whats = ok ? '55' + d : '';
    btWhats.disabled = !ok;
    erroWhats.textContent = !ok && mostrarErro && d.length
      ? 'Confira o número: falta algum dígito ou o DDD está errado.' : '';
  }
  campoWhats.addEventListener('input', function () { campoWhats.value = mascara(digitos()); checar(false); });
  campoWhats.addEventListener('blur', function () { checar(true); });
  campoWhats.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !btWhats.disabled) { e.preventDefault(); btWhats.click(); }
  });
  btWhats.addEventListener('click', function () { pilha.push('ag-whats'); concluir(); });

  /* ---------- montagem da mensagem e desfecho ---------- */
  function primeiroNome() {
    var n = (resp.nome || '').trim().split(/\s+/)[0] || '';
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
  }
  function queixa() {
    if (resp['ag-queixa'] === 'Outra queixa' && resp['ag-outra']) return resp['ag-outra'];
    return resp['ag-queixa'] || '';
  }
  function mensagem() {
    var l = ['Olá, Dr. Geovane! Meu nome é ' + primeiroNome() + '. Vim pelo site e preenchi o formulário.', ''];
    if (resp['ag-local']) l.push('• Atendimento presencial: ' + resp['ag-local']);
    if (queixa()) l.push('• Queixa: ' + queixa());
    if (resp['ag-trat']) l.push('• Tratamento anterior: ' + resp['ag-trat']);
    if (resp['ag-part']) l.push('• Atendimento particular: ' + resp['ag-part']);
    if (campoWhats.value) l.push('• WhatsApp para contato: ' + campoWhats.value);
    l.push('', 'Gostaria de agendar uma avaliação.');
    return l.join('\n');
  }

  function concluir() {
    var url = 'https://api.whatsapp.com/send/?phone=' + FONE + '&text=' + encodeURIComponent(mensagem()) + '&type=phone_number&app_absent=0';
    var link = document.getElementById('ag-wa');
    var repetir = document.getElementById('ag-retry');
    var alvo = document.getElementById('ag-timer');
    var caixa = document.getElementById('ag-opening');
    var tituloFim = document.getElementById('ag-fim-t');
    var tentativa = ++tentativaAtual;
    envioId = envioId || (window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : String(Date.now()) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    btWhats.disabled = true;
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    repetir.hidden = true;
    var nm = primeiroNome();
    tituloFim.textContent = 'Só um instante. Estamos registrando suas respostas.';
    tela('ag-fim');

    alvo.textContent = 'Registrando suas respostas…';
    caixa.classList.remove('done');
    function salvar() {
      repetir.hidden = true;
      tituloFim.textContent = 'Só um instante. Estamos registrando suas respostas.';
      alvo.textContent = 'Registrando suas respostas…';
      caixa.classList.remove('done');
      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envioId: envioId,
          nome: resp.nome || '',
          whatsapp: resp.whats || '',
          atendimento: resp['ag-local'] || '',
          queixa: queixa(),
          tratamento: resp['ag-trat'] || '',
          particular: resp['ag-part'] || '',
          pagina: location.href
        })
      }).then(function (resposta) {
        if (!resposta.ok) throw new Error('Falha ao registrar');
        return resposta.json();
      }).then(function (resultado) {
        if (!resultado.ok || resultado.envioId !== envioId) throw new Error('Registro não confirmado');
        if (tentativa !== tentativaAtual) return;
        link.href = url;
        link.removeAttribute('aria-disabled');
        tituloFim.textContent = nm ? 'Tudo certo, ' + nm + '. Vamos falar no WhatsApp?' : 'Tudo certo. Vamos falar no WhatsApp?';
        caixa.classList.add('done');
        push({ event: 'lead_contato' }); // sem respostas de saúde nem dados pessoais no dataLayer
        var segundos = 3;
        alvo.textContent = 'Abrindo em 3…';
        clearInterval(temporizador);
        temporizador = setInterval(function () {
          if (tentativa !== tentativaAtual) { clearInterval(temporizador); return; }
          segundos--;
          if (segundos > 0) { alvo.textContent = 'Abrindo em ' + segundos + '…'; return; }
          clearInterval(temporizador);
          alvo.textContent = 'Se não abrir sozinho, toque no botão acima';
          window.location.href = url;
        }, 1000);
      }).catch(function () {
        if (tentativa !== tentativaAtual) return;
        caixa.classList.add('done');
        tituloFim.textContent = 'Não conseguimos registrar suas respostas.';
        alvo.textContent = 'Toque em tentar novamente para continuar.';
        repetir.hidden = false;
      });
    }
    repetir.onclick = salvar;
    salvar();
  }
})();

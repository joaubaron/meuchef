// === EXTRAS: Modo Cozinhar + Lista de Compras ===
// Arquivo separado: NÃO altera o script.js.
// Se algo falhar aqui, o resto do app continua funcionando normalmente.
(function () {
  'use strict';
  try {

    const semAcento = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    function aviso(msg) {
      if (typeof showCustomModal === 'function') showCustomModal(msg);
    }

    // ---------- Lê título, ingredientes e passos direto da tela ----------
    function lerReceita(caixa) {
      const saida = { titulo: '', ingredientes: [], passos: [] };
      if (!caixa) return saida;

      const raiz = caixa.querySelector('.recipe-output') || caixa;
      const secoes = [];
      let atual = null;

      raiz.childNodes.forEach(no => {
        if (no.nodeType === 3) {
          if (atual) atual.texto += no.textContent;
        } else if (no.nodeType === 1) {
          if (no.tagName === 'STRONG') {
            atual = { nome: no.textContent.trim(), texto: '' };
            secoes.push(atual);
          } else if (no.tagName === 'BR') {
            if (atual) atual.texto += '\n';
          }
        }
      });

      if (secoes.length) saida.titulo = secoes[0].nome;

      secoes.slice(1).forEach(s => {
        const nome = semAcento(s.nome);
        const linhas = s.texto.split('\n').map(l => l.trim()).filter(Boolean);

        if (nome.includes('ingredientes')) {
          saida.ingredientes = linhas
            .map(l => l.replace(/^[-–—•\s]+/, '').trim())
            .filter(Boolean);
        } else if (nome.includes('modo de preparo')) {
          let passos = linhas
            .map(l => l.replace(/^\d+\s*[.)\-]\s*/, '').trim())
            .filter(Boolean);
          if (passos.length === 1 && passos[0].length > 120) {
            passos = passos[0].split(/\.\s+/).map(p => p.trim()).filter(Boolean);
          }
          saida.passos = passos;
        }
      });

      return saida;
    }

    // ---------- Telas cheias (criadas só na primeira vez que abrem) ----------
    function criarOverlay(id, html) {
      const el = document.createElement('div');
      el.id = id;
      el.className = 'cook-overlay oculto';
      el.setAttribute('role', 'dialog');
      el.innerHTML = html;
      ['touchstart', 'touchmove', 'touchend'].forEach(ev =>
        el.addEventListener(ev, e => e.stopPropagation(), { passive: true })
      );
      document.body.appendChild(el);
      return el;
    }

    // ---------- Tela não apaga ----------
    let wake = null;
    let cookAberto = false;

    async function pedirTelaLigada() {
      try {
        if ('wakeLock' in navigator) {
          wake = await navigator.wakeLock.request('screen');
          wake.addEventListener('release', () => { wake = null; });
        }
      } catch (e) { }
    }

    function soltarTelaLigada() {
      try { if (wake) wake.release(); } catch (e) {}
      wake = null;
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && cookAberto && !wake) pedirTelaLigada();
    });

    // ---------- Estilo do botão/painel de ingredientes (dentro do Modo Cozinhar) ----------
    function injetarEstiloCook() {
      if (document.getElementById('cookIngrEstilo')) return;
      const s = document.createElement('style');
      s.id = 'cookIngrEstilo';
      s.textContent =
        '.cook-ingr-linha{text-align:center;margin:6px 0}' +
        '.cook-ingr{font-size:16px;padding:8px 16px;border-radius:20px;border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;cursor:pointer}' +
        '.cook-ingr-painel{position:fixed;top:0;left:0;right:0;bottom:0;z-index:5;background:#fff;color:#333;display:none;flex-direction:column;padding:16px;box-sizing:border-box}' +
        '.cook-ingr-topo{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:20px;font-weight:bold}' +
        '.cook-ingr-fechar{font-size:16px;padding:8px 14px;border-radius:10px;border:1px solid #ccc;background:#f5f5f5;color:#333;cursor:pointer}' +
        '.cook-ingr-lista{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
        '.cook-ingr-item{font-size:20px;line-height:1.4;padding:10px 4px;border-bottom:1px solid #eee}' +
        // Container da foto no modo cozinhar: centraliza sem quebrar o formato
        '.cook-foto-wrap{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:8px;box-sizing:border-box}' +
        '.cook-foto-wrap .foto-receita{margin:0;max-height:100%;width:100%;}';
      document.head.appendChild(s);
    }

    // ---------- MODO COZINHAR ----------
    let cook = null;
    let passos = [];
    let idx = 0;
    let cookCaixa = null;
    let cookFotoUrl = null;
    let cookIngredientes = [];

    function montarCook() {
      if (cook) return;
      injetarEstiloCook();
      cook = criarOverlay('modoCozinhar',
        '<div class="cook-topo"><span class="cook-titulo"></span>' +
        '<button type="button" class="cook-fechar">✕ Fechar</button></div>' +
        '<div class="cook-progresso"><div class="cook-barra"></div></div>' +
        '<div class="cook-contador"></div>' +
        '<div class="cook-ingr-linha"><button type="button" class="cook-ingr">🧺 Ingredientes</button></div>' +
        '<div class="cook-passo"><span></span></div>' +
        '<div class="cook-nav">' +
        '<button type="button" class="cook-voltar">← Voltar</button>' +
        '<button type="button" class="cook-proximo">Próximo →</button></div>' +
        '<div class="cook-ingr-painel">' +
        '<div class="cook-ingr-topo"><span>🧺 Ingredientes</span>' +
        '<button type="button" class="cook-ingr-fechar">✕ Fechar</button></div>' +
        '<div class="cook-ingr-lista"></div></div>'
      );
      cook.querySelector('.cook-fechar').addEventListener('click', fecharCook);
      cook.querySelector('.cook-ingr').addEventListener('click', abrirIngredientesCook);
      cook.querySelector('.cook-ingr-fechar').addEventListener('click', fecharIngredientesCook);
      cook.querySelector('.cook-voltar').addEventListener('click', () => {
        if (idx > 0) { 
          idx--; 
          const btnProximo = cook.querySelector('.cook-proximo');
          if (btnProximo.textContent === 'Concluir') {
            const novoBtn = btnProximo.cloneNode(true);
            btnProximo.replaceWith(novoBtn);
            novoBtn.addEventListener('click', avancarCook);
          }
          cook.querySelector('.cook-voltar').style.display = '';
          cook.querySelector('.cook-passo').innerHTML = '<span></span>';
          desenharCook(); 
        }
      });
      cook.querySelector('.cook-proximo').addEventListener('click', avancarCook);
    }

    function abrirIngredientesCook() {
      if (!cook) return;
      const lista = cook.querySelector('.cook-ingr-lista');
      lista.textContent = '';
      cookIngredientes.forEach(item => {
        const linha = document.createElement('div');
        linha.className = 'cook-ingr-item';
        linha.textContent = item;
        lista.appendChild(linha);
      });
      lista.scrollTop = 0;
      cook.querySelector('.cook-ingr-painel').style.display = 'flex';
    }

    function fecharIngredientesCook() {
      if (!cook) return;
      cook.querySelector('.cook-ingr-painel').style.display = 'none';
    }

    function avancarCook() {
      if (idx < passos.length - 1) { 
        idx++; 
        desenharCook(); 
      } else if (idx === passos.length - 1) {
        mostrarFoto();
      } else {
        fecharCook();
      }
    }

    function desenharCook() {
      cook.querySelector('.cook-contador').textContent = 'Passo ' + (idx + 1) + ' de ' + passos.length;
      cook.querySelector('.cook-barra').style.width = ((idx + 1) / passos.length * 100) + '%';
      const alvo = cook.querySelector('.cook-passo');
      if (alvo.firstElementChild.tagName !== 'IMG') {
        alvo.firstElementChild.textContent = passos[idx];
      } else {
        alvo.innerHTML = '<span>' + passos[idx] + '</span>';
      }
      alvo.scrollTop = 0;
      cook.querySelector('.cook-voltar').disabled = (idx === 0);
      cook.querySelector('.cook-proximo').textContent = (idx === passos.length - 1) ? 'Ver foto →' : 'Próximo →';
    }

    // Foto do favorito: vem do IndexedDB (sem gastar cota).
    // Receita recém-gerada: copia a imagem que já está carregada na tela.
    async function obterFotoCook() {
      if (cookFotoUrl) {
        try { URL.revokeObjectURL(cookFotoUrl); } catch (e) {}
        cookFotoUrl = null;
      }
      const caixa = cookCaixa;
      if (!caixa) return null;

      if (caixa.closest('#conteudoReceitaFavorito') &&
          typeof FotoDB !== 'undefined' &&
          typeof AppState !== 'undefined' &&
          typeof urlFotoDoFavorito === 'function') {
        try {
          const rec = AppState.receitasFavoritas[AppState.indiceFavoritoAtual];
          if (rec) {
            const blob = await FotoDB.obter(urlFotoDoFavorito(rec));
            if (blob) {
              cookFotoUrl = URL.createObjectURL(blob);
              return cookFotoUrl;
            }
          }
        } catch (e) {}
      }

      const img = caixa.querySelector('.foto-receita');
      if (img && img.complete && img.naturalWidth > 0) {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          return c.toDataURL('image/jpeg', 0.9);
        } catch (e) {}
        return img.src;
      }
      return null;
    }

    async function mostrarFoto() {
      const btnAntes = cook.querySelector('.cook-proximo');
      btnAntes.disabled = true;

      const src = await obterFotoCook();
      if (!cookAberto) return;

      cook.querySelector('.cook-contador').textContent = 'Qualquer um pode cozinhar!';
      cook.querySelector('.cook-barra').style.width = '100%';
      cook.querySelector('.cook-voltar').style.display = 'none';

      const alvo = cook.querySelector('.cook-passo');
      alvo.innerHTML = '';

      if (src) {
        // Container centralizado (não estoura a tela e não quebra o formato)
        const wrap = document.createElement('div');
        wrap.className = 'cook-foto-wrap';

        const img = document.createElement('img');
        img.src = src;
        // Usa a MESMA classe da receita: border-radius, shadow, aspect-ratio 3/2 e object-fit cover
        img.className = 'foto-receita';
        img.alt = 'Foto da receita';
        // Só limita a altura para caber no modo cozinhar (o resto vem do CSS)
        img.style.maxHeight = '100%';

        wrap.appendChild(img);
        alvo.appendChild(wrap);
      } else {
        const avisoImg = document.createElement('span');
        avisoImg.textContent = 'Foto não disponível.';
        alvo.appendChild(avisoImg);
      }

      const btn = cook.querySelector('.cook-proximo');
      btn.textContent = 'Concluir';
      btn.disabled = false;

      const novoBtn = btn.cloneNode(true);
      btn.replaceWith(novoBtn);
      novoBtn.addEventListener('click', fecharCook);
    }

    function abrirCook(receita, caixa) {
      montarCook();
      cookCaixa = caixa || null;
      passos = receita.passos;
      cookIngredientes = receita.ingredientes || [];
      idx = 0;
      cook.querySelector('.cook-titulo').textContent = receita.titulo;
      cook.querySelector('.cook-voltar').style.display = '';
      cook.querySelector('.cook-passo').innerHTML = '<span></span>';
      fecharIngredientesCook();
      
      const btn = cook.querySelector('.cook-proximo');
      if (btn.textContent === 'Concluir') {
        const novoBtn = btn.cloneNode(true);
        btn.replaceWith(novoBtn);
        novoBtn.addEventListener('click', avancarCook);
      }
      
      desenharCook();
      cook.classList.remove('oculto');
      cookAberto = true;
      pedirTelaLigada();
    }

    function fecharCook() {
      fecharIngredientesCook();
      if (cook) cook.classList.add('oculto');
      cookAberto = false;
      soltarTelaLigada();
    }

    // ---------- LISTA DE COMPRAS ----------
    let compras = null;
    let comprasTitulo = '';

    function montarCompras() {
      if (compras) return;
      compras = criarOverlay('listaCompras',
        '<div class="cook-topo"><span class="cook-titulo">🛒 Lista de compras</span>' +
        '<button type="button" class="cook-fechar">✕ Fechar</button></div>' +
        '<div class="compras-sub"></div>' +
        '<div class="compras-dica">Marque o que você já tem.</div>' +
        '<div class="compras-itens"></div>' +
        '<div class="cook-nav"><button type="button" class="compras-compartilhar">🔗 Compartilhar ingredientes</button></div>'
      );
      compras.querySelector('.cook-fechar').addEventListener('click', () => compras.classList.add('oculto'));
      compras.querySelector('.compras-compartilhar').addEventListener('click', compartilharCompras);
    }

    function abrirCompras(receita) {
      montarCompras();
      comprasTitulo = receita.titulo;
      compras.querySelector('.compras-sub').textContent = receita.titulo;
      const lista = compras.querySelector('.compras-itens');
      lista.textContent = '';
      receita.ingredientes.forEach(item => {
        const rotulo = document.createElement('label');
        rotulo.className = 'compras-item';
        const marca = document.createElement('input');
        marca.type = 'checkbox';
        const texto = document.createElement('span');
        texto.textContent = item;
        rotulo.appendChild(marca);
        rotulo.appendChild(texto);
        lista.appendChild(rotulo);
      });
      compras.classList.remove('oculto');
    }

    async function compartilharTexto(titulo, texto) {
      try {
        if (navigator.share) {
          await navigator.share({ title: titulo, text: texto });
          return;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
      try {
        await navigator.clipboard.writeText(texto);
        aviso('📋 Lista copiada!');
      } catch (e) {
        aviso('❌ Não foi possível compartilhar');
      }
    }

    function compartilharCompras() {
      const faltam = Array.from(compras.querySelectorAll('.compras-item'))
        .filter(l => !l.querySelector('input').checked)
        .map(l => '- ' + l.querySelector('span').textContent);

      if (!faltam.length) {
        aviso('Você já tem tudo! 🎉');
        return;
      }
      const texto = '🧺 Compras: ' + comprasTitulo + '\n\n' + faltam.join('\n');
      compartilharTexto('Lista de compras', texto);
    }

    // ---------- Ação dos botões ----------
    function tratarAcao(acao, caixa) {
      const receita = lerReceita(caixa);
      if (acao === 'cozinhar') {
        if (!receita.passos.length) { aviso('Esta receita não tem passos.'); return; }
        abrirCook(receita, caixa);
      } else {
        if (!receita.ingredientes.length) { aviso('Esta receita não tem ingredientes.'); return; }
        abrirCompras(receita);
      }
    }

    // ---------- Botões na receita recém-gerada ----------
    let barra = null;

    function garantirBarra() {
      if (barra) return barra;
      const resultado = document.getElementById('resultado');
      if (!resultado || !resultado.parentNode) return null;

      barra = document.createElement('div');
      barra.id = 'extrasReceita';
      barra.className = 'oculto';
      barra.innerHTML =
        '<button type="button" data-acao="compras">🧺 Ir ao mercado</button>' +
        '<button type="button" data-acao="cozinhar">👨‍🍳 Cozinhar essa receita</button>';
      barra.addEventListener('click', e => {
        const botao = e.target.closest('button');
        if (!botao) return;
        tratarAcao(botao.dataset.acao, document.querySelector('#resultado .recipe-box'));
      });
      resultado.parentNode.insertBefore(barra, resultado);
      return barra;
    }

    function atualizarBarra() {
      const b = garantirBarra();
      if (!b) return;
      b.classList.toggle('oculto', !document.querySelector('#resultado .recipe-box'));
    }

    // ---------- Botões na receita favorita ----------
    function injetarFavorito() {
      const caixa = document.querySelector('#conteudoReceitaFavorito .recipe-box');
      const botoes = caixa && caixa.querySelector('.botoes-receita');
      if (!botoes) return;

      if (document.getElementById('btn-extra-compras')) return;

      botoes.querySelectorAll('button').forEach(b => {
        if (b.textContent.includes('Compras') || (b.textContent.includes('Cozinhar') && !b.textContent.includes('Cozinha'))) {
          b.style.setProperty('display', 'none', 'important');
        }
      });

      const btnCompras = document.createElement('button');
      btnCompras.id = 'btn-extra-compras';
      btnCompras.type = 'button';
      btnCompras.className = 'botao-padrao btn-extra';
      btnCompras.textContent = '🧺 Ir ao mercado';
      btnCompras.addEventListener('click', () => tratarAcao('compras', caixa));
      botoes.appendChild(btnCompras);

      const btnCozinhar = document.createElement('button');
      btnCozinhar.id = 'btn-extra-cozinhar';
      btnCozinhar.type = 'button';
      btnCozinhar.className = 'botao-padrao btn-extra';
      btnCozinhar.textContent = '👨‍🍳 Cozinhar essa receita';
      btnCozinhar.addEventListener('click', () => tratarAcao('cozinhar', caixa));
      botoes.appendChild(btnCozinhar);
    }

    // ---------- RECENTES (últimas 10 receitas geradas) ----------
    const CHAVE_RECENTES = 'meuchef_recentes';
    const MAX_RECENTES = 10;
    let restaurando = false;
    let recentes = null;

    function lerRecentes() {
      try {
        const lista = JSON.parse(localStorage.getItem(CHAVE_RECENTES));
        return Array.isArray(lista) ? lista : [];
      } catch (e) { return []; }
    }

    function gravarRecentes(lista) {
      try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista)); } catch (e) {}
    }

    function guardarRecente() {
      if (restaurando) return;
      const resultado = document.getElementById('resultado');
      const caixa = resultado && resultado.querySelector('.recipe-box');
      if (!caixa) return;

      const r = lerReceita(caixa);
      if (!r.titulo || r.titulo === 'Erro de formatação' || !r.ingredientes.length || !r.passos.length) return;

      const html = resultado.innerHTML;
      const lista = lerRecentes();
      if (lista.length && lista[0].html === html) return;

      const nova = lista.filter(i => i.html !== html);
      nova.unshift({ titulo: r.titulo, html: html, data: Date.now() });
      gravarRecentes(nova.slice(0, MAX_RECENTES));
    }

    function formatarData(ms) {
      try {
        return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch (e) { return ''; }
    }

    function montarRecentes() {
      if (recentes) return;
      recentes = criarOverlay('listaRecentes',
        '<div class="cook-topo"><span class="cook-titulo">🕘 Recentes</span>' +
        '<button type="button" class="cook-fechar">✕ Fechar</button></div>' +
        '<div class="compras-dica">Toque para abrir a receita.</div>' +
        '<div class="recentes-lista"></div>'
      );
      recentes.querySelector('.cook-fechar').addEventListener('click', () => recentes.classList.add('oculto'));
    }

    function restaurarRecente(item) {
      const resultado = document.getElementById('resultado');
      if (!resultado) return;
      restaurando = true;
      resultado.innerHTML = item.html;
      resultado.classList.remove('empty');
      setTimeout(() => { restaurando = false; }, 0);
      recentes.classList.add('oculto');
      try { resultado.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }

    function abrirRecentes() {
      montarRecentes();
      const alvo = recentes.querySelector('.recentes-lista');
      alvo.textContent = '';
      const lista = lerRecentes();

      if (!lista.length) {
        const vazio = document.createElement('div');
        vazio.className = 'recentes-vazio';
        vazio.textContent = 'Nenhuma receita ainda.';
        alvo.appendChild(vazio);
      }

      lista.forEach(item => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'recentes-item';
        const nome = document.createElement('span');
        nome.className = 'recentes-nome';
        nome.textContent = item.titulo;
        const data = document.createElement('span');
        data.className = 'recentes-data';
        data.textContent = formatarData(item.data);
        botao.appendChild(nome);
        botao.appendChild(data);
        botao.addEventListener('click', () => restaurarRecente(item));
        alvo.appendChild(botao);
      });

      recentes.classList.remove('oculto');
    }

    function injetarTagRecentes() {
      if (document.querySelector('.tag[data-extra="recentes"]')) return;
      const favoritas = document.querySelector('.tag[onclick="mostrarFavoritosComBusca()"]');
      if (!favoritas) return;
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.dataset.extra = 'recentes';
      tag.textContent = '🕘 Recentes';
      tag.addEventListener('click', abrirRecentes);
      favoritas.insertAdjacentElement('afterend', tag);
    }

    // ---------- Início ----------
    function iniciar() {
      atualizarBarra();
      injetarTagRecentes();

      const resultado = document.getElementById('resultado');
      if (resultado) {
        new MutationObserver(() => { atualizarBarra(); guardarRecente(); })
          .observe(resultado, { childList: true });
      }

      const fav = document.getElementById('conteudoReceitaFavorito');
      if (fav) new MutationObserver(injetarFavorito).observe(fav, { childList: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', iniciar);
    } else {
      iniciar();
    }

  } catch (erro) {
    console.warn('Extras (cozinhar/compras) não iniciaram:', erro);
  }
})();

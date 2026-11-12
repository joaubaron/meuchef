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
// Evita que o "puxar para recarregar" do script.js dispare aqui dentro
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
} catch (e) { /* sem suporte: segue normal */ }
}

function soltarTelaLigada() {
try { if (wake) wake.release(); } catch (e) {}
wake = null;
}

document.addEventListener('visibilitychange', () => {
if (!document.hidden && cookAberto && !wake) pedirTelaLigada();
});

// ---------- MODO COZINHAR ----------
let cook = null;
let passos = [];
let idx = 0;

function montarCook() {
if (cook) return;
cook = criarOverlay('modoCozinhar',
'<div class="cook-topo"><span class="cook-titulo"></span>' +
'<button type="button" class="cook-fechar">✕ Fechar</button></div>' +
'<div class="cook-progresso"><div class="cook-barra"></div></div>' +
'<div class="cook-contador"></div>' +
'<div class="cook-passo"><span></span></div>' +
'<div class="cook-nav">' +
'<button type="button" class="cook-voltar">← Voltar</button>' +
'<button type="button" class="cook-proximo">Próximo →</button></div>'
);
cook.querySelector('.cook-fechar').addEventListener('click', fecharCook);
cook.querySelector('.cook-voltar').addEventListener('click', () => {
if (idx > 0) { idx--; desenharCook(); }
});
cook.querySelector('.cook-proximo').addEventListener('click', () => {
if (idx < passos.length - 1) { idx++; desenharCook(); } else { fecharCook(); }
});
}

function desenharCook() {
cook.querySelector('.cook-contador').textContent = 'Passo ' + (idx + 1) + ' de ' + passos.length;
cook.querySelector('.cook-barra').style.width = ((idx + 1) / passos.length * 100) + '%';
const alvo = cook.querySelector('.cook-passo');
alvo.firstElementChild.textContent = passos[idx];
alvo.scrollTop = 0;
cook.querySelector('.cook-voltar').disabled = (idx === 0);
cook.querySelector('.cook-proximo').textContent = (idx === passos.length - 1) ? '🎉 Pronto' : 'Próximo →';
}

function abrirCook(receita) {
montarCook();
passos = receita.passos;
idx = 0;
cook.querySelector('.cook-titulo').textContent = receita.titulo;
desenharCook();
cook.classList.remove('oculto');
cookAberto = true;
pedirTelaLigada();
}

function fecharCook() {
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
'<div class="cook-nav"><button type="button" class="compras-compartilhar">📤 Compartilhar o que falta</button></div>'
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
if (e && e.name === 'AbortError') return; // usuário fechou o menu
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
const texto = '🛒 Compras: ' + comprasTitulo + '\n\n' + faltam.join('\n');
compartilharTexto('Lista de compras', texto);
}

// ---------- Ação dos botões ----------
function tratarAcao(acao, caixa) {
const receita = lerReceita(caixa);
if (acao === 'cozinhar') {
if (!receita.passos.length) { aviso('Esta receita não tem passos.'); return; }
abrirCook(receita);
} else {
if (!receita.ingredientes.length) { aviso('Esta receita não tem ingredientes.'); return; }
abrirCompras(receita);
}
}

// ---------- Botões na receita recém-gerada (ficam FORA do que é salvo) ----------
let barra = null;

function garantirBarra() {
if (barra) return barra;
const resultado = document.getElementById('resultado');
if (!resultado || !resultado.parentNode) return null;

barra = document.createElement('div');
barra.id = 'extrasReceita';
barra.className = 'oculto';
barra.innerHTML =
'<button type="button" data-acao="cozinhar">🍳 Cozinhar</button>' +
'<button type="button" data-acao="compras">🛒 Compras</button>';
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
if (!botoes || botoes.querySelector('.btn-extra')) return;

const excluir = botoes.querySelector('.botao-excluir');
[['cozinhar', '🍳 Cozinhar'], ['compras', '🛒 Compras']].forEach(par => {
const b = document.createElement('button');
b.type = 'button';
b.className = 'botao-padrao btn-extra';
b.textContent = par[1];
b.addEventListener('click', () => tratarAcao(par[0], caixa));
botoes.insertBefore(b, excluir); // Excluir continua por último
});
}

// ---------- Início ----------
function iniciar() {
atualizarBarra();

const resultado = document.getElementById('resultado');
if (resultado) new MutationObserver(atualizarBarra).observe(resultado, { childList: true });

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

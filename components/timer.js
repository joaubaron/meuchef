// === TEMPORIZADOR do Modo Cozinhar ===
// Arquivo separado: NÃO altera script.js nem extras.js.
// Se algo falhar aqui, o resto do app continua funcionando normalmente.
// Carregar DEPOIS do extras.js.
(function () {
'use strict';
try {

let cook = null;
let areaTimer = null;
let sugestoesEl = null;
let ativosEl = null;
let alertaEl = null;

let timers = [];          // { id, passo, dur, fim }
let proximoId = 1;
let sugAtuais = [];       // tempos achados no passo que está na tela
let passoAtual = 0;
let tituloAtual = '';

let tick = null;
let toque = null;
let toqueTimeout = null;
let audio = null;

// ---------- Ler tempos do texto do passo ----------
function lerTempos(texto) {
let t = ' ' + String(texto || '').toLowerCase() + ' ';
const achados = [];

// "1 hora e meia" e "meia hora"
t = t.replace(/(\d+)\s*horas?\s*e\s*meia/g, (m, n) => {
achados.push(parseInt(n, 10) * 3600 + 1800);
return ' ';
});
t = t.replace(/meia\s*hora/g, () => {
achados.push(1800);
return ' ';
});

// "15 minutos", "10 a 15 min", "1 hora", "30 segundos"
// (em faixa, usa o menor valor)
t = t.replace(
/(\d+(?:[.,]\d+)?)\s*(?:(?:a|à|ou|até|-|–)\s*\d+(?:[.,]\d+)?\s*)?(horas?|hrs?|minutos?|mins?|segundos?|segs?|h)\b/g,
(m, n, u) => {
const v = parseFloat(n.replace(',', '.'));
let s;
if (u[0] === 'h') s = v * 3600;
else if (u[0] === 'm') s = v * 60;
else s = v;
achados.push(Math.round(s));
return ' ';
}
);

const unicos = [];
achados.forEach(s => {
if (s >= 5 && s <= 6 * 3600 && unicos.indexOf(s) === -1) unicos.push(s);
});
return unicos.slice(0, 3);
}

// ---------- Formatos ----------
const pad = n => (n < 10 ? '0' : '') + n;

function rotulo(s) {
const h = Math.floor(s / 3600);
const m = Math.floor((s % 3600) / 60);
const x = s % 60;
const p = [];
if (h) p.push(h + ' h');
if (m) p.push(m + ' min');
if (x) p.push(x + ' seg');
return p.join(' ');
}

function relogio(ms) {
const s = Math.max(0, Math.ceil(ms / 1000));
const h = Math.floor(s / 3600);
const m = Math.floor((s % 3600) / 60);
const x = s % 60;
return h ? h + ':' + pad(m) + ':' + pad(x) : pad(m) + ':' + pad(x);
}

// ---------- Estilo ----------
function injetarEstilo() {
if (document.getElementById('cookTimerEstilo')) return;
const s = document.createElement('style');
s.id = 'cookTimerEstilo';
s.textContent =
'.cook-timer{flex:0 0 auto;margin-top:10px}' +
'.cook-timer-sug{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}' +
'.cook-timer-sug button{background:#fff3e8;color:var(--terracota);border:1.5px solid #f1d4bd;border-radius:999px;padding:10px 18px;font-size:16px;font-weight:700;font-family:"Quicksand",sans-serif}' +
'.cook-timer-sug button:active{transform:scale(.96)}' +
'.cook-timer-ativos{display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:132px;overflow-y:auto}' +
'.cook-timer-ativos:empty{margin-top:0}' +
'.cook-chip{display:flex;align-items:center;gap:8px;background:var(--lilas);border:1px solid var(--lilas-borda);border-radius:14px;padding:6px 8px 6px 14px;color:var(--roxo);font-weight:700;font-size:15px}' +
'.cook-chip-tempo{margin-left:auto;font-size:22px;font-variant-numeric:tabular-nums}' +
'.cook-chip button{background:#fff;color:var(--roxo);border:1px solid var(--lilas-borda);border-radius:999px;padding:7px 12px;font-size:14px;font-weight:700}' +
'.cook-alerta{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2000;background:rgba(60,30,20,.55);display:flex;align-items:center;justify-content:center;padding:20px}' +
'.cook-alerta.oculto{display:none!important}' +
'.cook-alerta-caixa{background:#fff;border-radius:24px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 14px 40px rgba(90,64,55,.3)}' +
'.cook-alerta-titulo{font-family:"Quicksand",sans-serif;font-size:26px;font-weight:700;color:var(--terracota);margin-bottom:8px}' +
'.cook-alerta-sub{font-size:16px;color:var(--marrom);margin-bottom:20px}' +
'.cook-alerta-parar{width:100%;padding:16px;border-radius:999px;font-size:18px;font-weight:700;font-family:"Quicksand",sans-serif;color:#fff;background:linear-gradient(135deg,var(--terracota-claro),var(--terracota))}';
document.head.appendChild(s);
}

// ---------- Som e vibração ----------
function destravarAudio() {
try {
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;
if (!audio) audio = new AC();
if (audio.state === 'suspended') audio.resume();
} catch (e) {}
}

function bipe() {
try {
if (audio) {
if (audio.state === 'suspended') audio.resume();
const o = audio.createOscillator();
const g = audio.createGain();
const t0 = audio.currentTime;
o.type = 'sine';
o.frequency.value = 880;
g.gain.setValueAtTime(0.0001, t0);
g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
o.connect(g);
g.connect(audio.destination);
o.start(t0);
o.stop(t0 + 0.4);
}
} catch (e) {}
try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
}

function pararToque() {
if (toque) { clearInterval(toque); toque = null; }
if (toqueTimeout) { clearTimeout(toqueTimeout); toqueTimeout = null; }
try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {}
if (alertaEl) alertaEl.classList.add('oculto');
}

// ---------- Aviso de tempo acabou ----------
function montarAlerta() {
if (alertaEl) return;
alertaEl = document.createElement('div');
alertaEl.className = 'cook-alerta oculto';
alertaEl.setAttribute('role', 'alertdialog');
alertaEl.innerHTML =
'<div class="cook-alerta-caixa">' +
'<div class="cook-alerta-titulo">⏰ Tempo acabou!</div>' +
'<div class="cook-alerta-sub"></div>' +
'<button type="button" class="cook-alerta-parar">Parar</button>' +
'</div>';
alertaEl.querySelector('.cook-alerta-parar').addEventListener('click', pararToque);
document.body.appendChild(alertaEl);
}

function alertar(lista) {
montarAlerta();
alertaEl.querySelector('.cook-alerta-sub').textContent =
lista.map(t => 'Passo ' + t.passo + ' (' + rotulo(t.dur) + ')').join(' · ');
alertaEl.classList.remove('oculto');

pararToqueSemFechar();
bipe();
toque = setInterval(bipe, 1200);
toqueTimeout = setTimeout(pararToque, 60000); // desliga sozinho em 1 minuto
}

function pararToqueSemFechar() {
if (toque) { clearInterval(toque); toque = null; }
if (toqueTimeout) { clearTimeout(toqueTimeout); toqueTimeout = null; }
}

// ---------- Desenho na tela ----------
function mostrarArea() {
if (!areaTimer) return;
areaTimer.style.display = (sugAtuais.length || timers.length) ? '' : 'none';
}

function desenharSugestoes() {
if (!sugestoesEl) return;
sugestoesEl.textContent = '';
sugAtuais.forEach(s => {
// não repete se esse tempo já está rodando neste passo
if (timers.some(t => t.passo === passoAtual && t.dur === s)) return;
const b = document.createElement('button');
b.type = 'button';
b.textContent = '⏱️ Iniciar ' + rotulo(s);
b.addEventListener('click', () => iniciar(s));
sugestoesEl.appendChild(b);
});
mostrarArea();
}

function desenharAtivos() {
if (!ativosEl) return;
ativosEl.textContent = '';
timers.forEach(t => {
const chip = document.createElement('div');
chip.className = 'cook-chip';
chip.dataset.id = t.id;

const nome = document.createElement('span');
nome.textContent = 'Passo ' + t.passo;

const tempo = document.createElement('span');
tempo.className = 'cook-chip-tempo';
tempo.textContent = relogio(t.fim - Date.now());

const mais = document.createElement('button');
mais.type = 'button';
mais.dataset.acao = 'mais';
mais.textContent = '+1 min';

const x = document.createElement('button');
x.type = 'button';
x.dataset.acao = 'cancelar';
x.setAttribute('aria-label', 'Cancelar');
x.textContent = '✕';

chip.appendChild(nome);
chip.appendChild(tempo);
chip.appendChild(mais);
chip.appendChild(x);
ativosEl.appendChild(chip);
});
mostrarArea();
}

function atualizarTextos() {
if (!ativosEl) return;
const agora = Date.now();
ativosEl.querySelectorAll('.cook-chip').forEach(c => {
const t = timers.find(x => String(x.id) === c.dataset.id);
const el = c.querySelector('.cook-chip-tempo');
if (t && el) el.textContent = relogio(t.fim - agora);
});
}

// ---------- Lógica dos timers ----------
function ligarTick() {
if (!tick) tick = setInterval(conferir, 500);
}

function desligarTickSeVazio() {
if (!timers.length && tick) {
clearInterval(tick);
tick = null;
}
}

function conferir() {
const agora = Date.now();
const acabaram = timers.filter(t => t.fim <= agora);
if (acabaram.length) {
timers = timers.filter(t => t.fim > agora);
desenharAtivos();
desenharSugestoes();
alertar(acabaram);
} else {
atualizarTextos();
}
desligarTickSeVazio();
}

function iniciar(segundos) {
destravarAudio(); // precisa ser num toque do usuário, para o som funcionar depois
timers.push({
id: proximoId++,
passo: passoAtual,
dur: segundos,
fim: Date.now() + segundos * 1000
});
desenharAtivos();
desenharSugestoes();
ligarTick();
}

function limparTodos() {
timers = [];
desenharAtivos();
desligarTickSeVazio();
pararToque();
}

function tratarCliqueAtivos(e) {
const botao = e.target.closest('button');
if (!botao) return;
const chip = botao.closest('.cook-chip');
if (!chip) return;
const t = timers.find(x => String(x.id) === chip.dataset.id);
if (!t) return;

if (botao.dataset.acao === 'mais') {
t.fim += 60000;
atualizarTextos();
} else if (botao.dataset.acao === 'cancelar') {
timers = timers.filter(x => x !== t);
desenharAtivos();
desenharSugestoes();
desligarTickSeVazio();
}
}

// ---------- Acompanha o passo que está na tela ----------
function atualizarPasso() {
if (!cook) return;
const alvo = cook.querySelector('.cook-passo');
const contador = cook.querySelector('.cook-contador');
const tituloEl = cook.querySelector('.cook-titulo');
if (!alvo || !contador || !tituloEl) return;

// Receita diferente: zera os timers antigos
const titulo = tituloEl.textContent;
if (titulo !== tituloAtual) {
if (tituloAtual) limparTodos();
tituloAtual = titulo;
}

const m = contador.textContent.match(/Passo\s+(\d+)/i);
passoAtual = m ? parseInt(m[1], 10) : 0;

// Na tela da foto (ou sem passo) não tem o que sugerir
const texto = (passoAtual && !alvo.querySelector('img')) ? alvo.textContent : '';
sugAtuais = texto ? lerTempos(texto) : [];
desenharSugestoes();
}

// ---------- Montagem ----------
function preparar(el) {
cook = el;
injetarEstilo();

areaTimer = document.createElement('div');
areaTimer.className = 'cook-timer';
areaTimer.style.display = 'none';

sugestoesEl = document.createElement('div');
sugestoesEl.className = 'cook-timer-sug';

ativosEl = document.createElement('div');
ativosEl.className = 'cook-timer-ativos';
ativosEl.addEventListener('click', tratarCliqueAtivos);

areaTimer.appendChild(sugestoesEl);
areaTimer.appendChild(ativosEl);

const nav = cook.querySelector('.cook-nav');
if (nav) cook.insertBefore(areaTimer, nav);
else cook.appendChild(areaTimer);

const passoEl = cook.querySelector('.cook-passo');
if (passoEl) {
new MutationObserver(atualizarPasso)
.observe(passoEl, { childList: true, subtree: true, characterData: true });
}

atualizarPasso();
}

function procurar() {
const el = document.getElementById('modoCozinhar');
if (el) { preparar(el); return true; }
return false;
}

// O Modo Cozinhar só é criado na primeira vez que abre: espera ele aparecer
if (!procurar()) {
const olheiro = new MutationObserver(() => {
if (procurar()) olheiro.disconnect();
});
olheiro.observe(document.body, { childList: true });
}

// Voltou pro app: confere se algum tempo já acabou
document.addEventListener('visibilitychange', () => {
if (!document.hidden && timers.length) conferir();
});

} catch (erro) {
console.warn('Temporizador não iniciou:', erro);
}
})();

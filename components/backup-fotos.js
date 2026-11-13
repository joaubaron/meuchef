// === BACKUP COM FOTOS ===
// Arquivo separado: NÃO altera o script.js.
// Troca o Exportar e o Importar dos favoritos por versões que levam as fotos junto.
// Se algo falhar aqui, o Exportar/Importar antigo continua valendo.
// Carregar DEPOIS do script.js e do extras.js.
(function () {
'use strict';
try {

// Tamanho e qualidade das fotos dentro do backup (menor = arquivo mais leve)
const LADO_MAX = 900;      // maior lado da foto, em pixels
const QUALIDADE = 0.8;     // 0.1 a 1 (0.8 é um bom meio-termo)

const exportarOriginal = window.exportarFavoritosComCategorias;
const importarOriginal = window.importarFavoritos;
if (typeof exportarOriginal !== 'function' || typeof importarOriginal !== 'function') return;

// ---------- Foto <-> texto ----------
function blobParaDataUrl(blob) {
return new Promise(resolve => {
try {
const url = URL.createObjectURL(blob);
const img = new Image();
img.onload = () => {
try {
const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
const c = document.createElement('canvas');
c.width = Math.round(img.naturalWidth * escala);
c.height = Math.round(img.naturalHeight * escala);
c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
resolve(c.toDataURL('image/jpeg', QUALIDADE));
} catch (e) { resolve(null); }
URL.revokeObjectURL(url);
};
img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
img.src = url;
} catch (e) { resolve(null); }
});
}

async function dataUrlParaBlob(dataUrl) {
const resp = await fetch(dataUrl);
return await resp.blob();
}

// ---------- EXPORTAR ----------
async function exportarComFotos() {
try {
if (AppState.receitasFavoritas.length === 0) {
showCustomModal('Nenhuma receita favorita para exportar.');
return;
}

migrarReceitasAntigas();

// Uma foto por favorito (se duas receitas usam a mesma foto, guarda uma vez só)
const fotos = {};
let totalFotos = 0;
for (const receita of AppState.receitasFavoritas) {
try {
const chave = urlFotoDoFavorito(receita);
if (fotos[chave]) continue;
const blob = await FotoDB.obter(chave);
if (!blob) continue;
const dataUrl = await blobParaDataUrl(blob);
if (dataUrl) { fotos[chave] = dataUrl; totalFotos++; }
} catch (e) { /* pula essa foto e segue */ }
}

const now = new Date();
const dia = String(now.getDate()).padStart(2, '0');
const mes = String(now.getMonth() + 1).padStart(2, '0');
const ano = String(now.getFullYear()).slice(-2);
const hora = String(now.getHours()).padStart(2, '0');
const min = String(now.getMinutes()).padStart(2, '0');
const fileName = `meuchef_${dia}${mes}${ano}_${hora}${min}.json`;

const categorias = {};
AppState.receitasFavoritas.forEach(r => {
const cat = r.categoria || 'outros';
categorias[cat] = (categorias[cat] || 0) + 1;
});

const dados = {
versao: '2.1',
dataExportacao: new Date().toISOString(),
totalReceitas: AppState.receitasFavoritas.length,
totalFotos: totalFotos,
categorias: categorias,
receitas: AppState.receitasFavoritas,
fotos: fotos
};

const blob = new Blob([JSON.stringify(dados)], { type: 'application/json' });
const baixar = () => {
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = fileName;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Única mensagem: fica na tela até você tocar em Ok. Só depois abre a tela de salvar.
const modal = ModalManager.open({
title: 'Backup pronto',
content:
'<p class="modal-subtitulo">' + totalFotos + ' foto(s) - ' + dados.totalReceitas + ' receita(s)</p>' +
'<p>Toque em Ok para salvar o arquivo</p>',
actions: '<button id="btn-backup-ok" class="btn-confirmar-novo">Ok</button>'
});

if (!modal) { baixar(); return; }

document.getElementById('btn-backup-ok').addEventListener('click', () => {
ModalManager.close(modal);
baixar();
});
} catch (erro) {
console.warn('Backup com fotos falhou, usando o exportar antigo:', erro);
exportarOriginal();
}
}

// ---------- IMPORTAR ----------
async function importarComFotos(event) {
let restauradas = 0;

try {
const arquivo = event.target.files && event.target.files[0];
if (arquivo) {
const dados = JSON.parse(await arquivo.text());
const fotos = dados && dados.fotos;
if (fotos && typeof fotos === 'object') {
for (const chave of Object.keys(fotos)) {
try {
if (await FotoDB.obter(chave)) continue; // já tem essa foto no aparelho
const blob = await dataUrlParaBlob(fotos[chave]);
if (blob) { await FotoDB.salvar(chave, blob); restauradas++; }
} catch (e) { /* pula essa foto e segue */ }
}
}
}
} catch (e) { /* arquivo sem fotos ou inválido: o importar antigo cuida */ }

if (restauradas) {
// Soma o aviso das fotos na mensagem final do importar antigo
const mostrarOriginal = window.showCustomModal;
window.showCustomModal = function (msg) {
window.showCustomModal = mostrarOriginal;
mostrarOriginal(msg + '<br>' + restauradas + ' foto(s) de volta');
};
setTimeout(() => {
if (window.showCustomModal !== mostrarOriginal) window.showCustomModal = mostrarOriginal;
}, 15000);
}

// As receitas são importadas pelo código que você já tinha
importarOriginal(event);
}

window.exportarFavoritosComCategorias = exportarComFotos;
window.importarFavoritos = importarComFotos;

} catch (erro) {
console.warn('Backup com fotos não iniciou:', erro);
}
})();

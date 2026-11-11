--- script.orig.js	2026-11-11 11:48:27.738592414 +0000
+++ script.js	2026-11-11 11:48:47.492602116 +0000
@@ -153,7 +153,7 @@
 }
 
 function fotoHTML(titulo, promptFoto) {
-return `<img class="foto-receita" src="${escapeHtml(fotoUrl(titulo, promptFoto))}" alt="Foto: ${escapeHtml(titulo || '')}" onload="fotoReceitaOk(this)" onerror="fotoReceitaErro(this)">`;
+return `<img class="foto-receita" crossorigin="anonymous" src="${escapeHtml(fotoUrl(titulo, promptFoto))}" alt="Foto: ${escapeHtml(titulo || '')}" onload="fotoReceitaOk(this)" onerror="fotoReceitaErro(this)">`;
 }
 
 function fotoReceitaOk(img) {
@@ -170,6 +170,115 @@
 }
 }
 
+// === FOTOS DOS FAVORITOS (guardadas no aparelho) ===
+const FotoDB = {
+_db: null,
+abrir() {
+if (this._db) return Promise.resolve(this._db);
+return new Promise((resolve, reject) => {
+const req = indexedDB.open('meuchef-fotos', 1);
+req.onupgradeneeded = () => req.result.createObjectStore('fotos');
+req.onsuccess = () => { this._db = req.result; resolve(this._db); };
+req.onerror = () => reject(req.error);
+});
+},
+async obter(chave) {
+try {
+const db = await this.abrir();
+return await new Promise(resolve => {
+const r = db.transaction('fotos').objectStore('fotos').get(chave);
+r.onsuccess = () => resolve(r.result || null);
+r.onerror = () => resolve(null);
+});
+} catch (e) { return null; }
+},
+async salvar(chave, blob) {
+try {
+const db = await this.abrir();
+await new Promise(resolve => {
+const tx = db.transaction('fotos', 'readwrite');
+tx.objectStore('fotos').put(blob, chave);
+tx.oncomplete = () => resolve();
+tx.onerror = () => resolve();
+});
+} catch (e) {}
+},
+async apagar(chave) {
+try {
+const db = await this.abrir();
+await new Promise(resolve => {
+const tx = db.transaction('fotos', 'readwrite');
+tx.objectStore('fotos').delete(chave);
+tx.oncomplete = () => resolve();
+tx.onerror = () => resolve();
+});
+} catch (e) {}
+}
+};
+
+function normalizarUrlFoto(url) {
+return String(url || '').replace(/&amp;/g, '&').replace(/&r=\d+$/, '');
+}
+
+function urlFotoDoFavorito(receita) {
+if (receita.fotoUrl) return receita.fotoUrl;
+const tag = (receita.conteudo || '').match(/<img[^>]*class="foto-receita[^"]*"[^>]*>/);
+const src = tag && tag[0].match(/src="([^"]+)"/);
+receita.fotoUrl = src ? normalizarUrlFoto(src[1]) : fotoUrl(receita.titulo, '');
+localStorage.setItem('receitasFavoritas', JSON.stringify(AppState.receitasFavoritas));
+return receita.fotoUrl;
+}
+
+function fotoImgParaBlob(img) {
+return new Promise(resolve => {
+try {
+const c = document.createElement('canvas');
+c.width = img.naturalWidth;
+c.height = img.naturalHeight;
+c.getContext('2d').drawImage(img, 0, 0);
+c.toBlob(b => resolve(b), 'image/jpeg', 0.9);
+} catch (e) { resolve(null); }
+});
+}
+
+// Ao favoritar: guarda a foto que já está na tela (sem gastar cota)
+async function guardarFotoDaTela(receita) {
+const img = document.querySelector('#resultado img.foto-receita.pronta');
+if (!img) return;
+const url = urlFotoDoFavorito(receita);
+const blob = await fotoImgParaBlob(img);
+if (blob) await FotoDB.salvar(url, blob);
+}
+
+// Ao abrir o favorito: usa a foto guardada; se não tiver, gera uma vez e guarda
+async function mostrarFotoFavorito(receita) {
+const box = document.querySelector('#conteudoReceitaFavorito .recipe-box');
+const ancora = box && box.querySelector('.bom-apetite');
+if (!ancora) return;
+
+const url = urlFotoDoFavorito(receita);
+const img = document.createElement('img');
+img.className = 'foto-receita';
+img.alt = 'Foto: ' + (receita.titulo || '');
+ancora.insertAdjacentElement('beforebegin', img);
+
+const blob = await FotoDB.obter(url);
+if (blob) {
+img.onload = () => img.classList.add('pronta');
+img.src = URL.createObjectURL(blob);
+return;
+}
+
+img.crossOrigin = 'anonymous';
+img.onload = async () => {
+img.classList.add('pronta');
+const b = await fotoImgParaBlob(img);
+if (b) FotoDB.salvar(url, b);
+};
+img.onerror = () => { img.style.display = 'none'; };
+img.src = url;
+}
+
 // === DEBOUNCING HELPER ===
 const createDebouncedFunction = (func, delay = 300) => {
 let timeout;
@@ -1023,14 +1132,16 @@
 }
 titulo = novoTitulo;
 
-AppState.receitasFavoritas.push({
+const novoFavorito = {
 titulo: titulo,
 conteudo: receitaHTML,
 categoria: categoria || 'diversos',
 data: new Date().toLocaleString()
-});
+};
+AppState.receitasFavoritas.push(novoFavorito);
 
 localStorage.setItem('receitasFavoritas', JSON.stringify(AppState.receitasFavoritas));
+guardarFotoDaTela(novoFavorito);
 ModalManager.close(document.querySelector('.modal-categoria-overlay'));
 
 const categoriaEncontrada = categoriasPredefinidas.find(cat => cat.id === categoria);
@@ -1242,7 +1353,7 @@
 https://github.com/joaubaron/meuchef/blob/main/components/script.js
 function formatarReceitaParaExibicao(htmlConteudo) {
 // Tira a foto dos favoritos (evita pedir imagem de novo e gastar o limite)
-htmlConteudo = (htmlConteudo || '').replace(/<img class="foto-receita"[^>]*>/g, '');
+htmlConteudo = (htmlConteudo || '').replace(/<img[^>]*class="foto-receita[^"]*"[^>]*>/g, '');
 
 let conteudoProcessado = htmlConteudo || '';
 const tmp = document.createElement('div');
@@ -1303,6 +1414,7 @@
 conteudoReceita.innerHTML = receitaFormatadaHTML;
 listaTitulos.classList.add('oculto');
 receitaCompleta.classList.remove('oculto');
+mostrarFotoFavorito(receita);
 }
 
 function compartilharFavoritoAtual() {
@@ -1358,7 +1470,11 @@
 
 function confirmarExclusaoFavorito() {
 if (AppState.indiceFavoritoAtual >= 0) {
-AppState.receitasFavoritas.splice(AppState.indiceFavoritoAtual, 1);
+const removida = AppState.receitasFavoritas.splice(AppState.indiceFavoritoAtual, 1)[0];
+const urlRemovida = removida && removida.fotoUrl;
+if (urlRemovida && !AppState.receitasFavoritas.some(r => r.fotoUrl === urlRemovida)) {
+FotoDB.apagar(urlRemovida);
+}
 localStorage.setItem('receitasFavoritas', JSON.stringify(AppState.receitasFavoritas));
 
 showCustomModal('Receita excluída dos favoritos');

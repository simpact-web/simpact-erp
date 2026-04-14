/* ═══════════════════════════════════════════════════════════════
   SIMPACT PREFLIGHT CLIENT v1.0
   Intégration côté navigateur : upload PDF → preflight → BAT 3D
   Utilisé par : orders.html, client-portal.html
   ═══════════════════════════════════════════════════════════════ */

const SIMPACT_PREFLIGHT = (function () {

  const DEFAULT_SERVER = 'http://localhost:3200';

  /* ══════════════════════════════════════════════════
     API PUBLIQUE
     ══════════════════════════════════════════════════ */

  /**
   * Lance le workflow preflight complet :
   * upload → analyse → affichage progression → ouverture BAT 3D
   *
   * @param {File}   pdfFile   - Objet File du PDF
   * @param {Object} jobSpec   - Spec du job (productType, format, pages…)
   * @param {Object} callbacks - { onProgress, onComplete, onError }
   */
  async function runPreflight(pdfFile, jobSpec, callbacks = {}) {
    const server = _getServer();
    const { onProgress, onComplete, onError } = callbacks;

    try {
      // 1. Upload + lancer le job
      onProgress?.('upload', 5, 'Envoi du PDF au serveur…');
      const { jobId } = await _uploadPDF(server, pdfFile, jobSpec);

      // 2. Écouter la progression via WebSocket
      await _watchJob(server, jobId, {
        onProgress,
        onComplete: (job) => {
          onComplete?.(job);
          _openBATViewer(server, jobId, jobSpec.productType);
        },
        onError,
      });

    } catch (err) {
      onError?.(err.message);
      showToast?.('Preflight échoué : ' + err.message, 'error');
    }
  }

  /**
   * Ouvre le viewer BAT 3D dans une nouvelle fenêtre.
   */
  function openViewer(jobId, productType) {
    _openBATViewer(_getServer(), jobId, productType);
  }

  /**
   * Génère le widget de téléchargement PDF + bouton preflight
   * à insérer dans un formulaire de commande.
   *
   * @param {string} containerId - ID de l'élément parent
   * @param {Object} options     - { productType, format, pageMultiple }
   * @returns {Function} getJobId() - retourne le jobId courant si dispo
   */
  function renderUploadWidget(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return () => null;

    let currentJobId = null;

    container.innerHTML = `
      <div class="pf-widget">
        <div class="pf-drop-zone" id="pf-drop-${containerId}">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a9fd4" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <div class="pf-drop-label">Déposer le PDF ici<br><span>ou cliquer pour sélectionner</span></div>
          <input type="file" accept="application/pdf" id="pf-input-${containerId}" style="display:none">
        </div>
        <div class="pf-file-info" id="pf-info-${containerId}" style="display:none">
          <span class="pf-file-name" id="pf-name-${containerId}"></span>
          <button class="pf-btn-analyze" id="pf-btn-${containerId}">
            🔍 Analyser &amp; Valider (Preflight)
          </button>
        </div>
        <div class="pf-progress-bar" id="pf-prog-${containerId}" style="display:none">
          <div class="pf-progress-fill" id="pf-fill-${containerId}"></div>
        </div>
        <div class="pf-status" id="pf-status-${containerId}"></div>
        <div class="pf-result" id="pf-result-${containerId}" style="display:none">
          <button class="pf-btn-bat" id="pf-bat-${containerId}">🎯 Ouvrir BAT 3D</button>
        </div>
      </div>
      ${_widgetCSS()}
    `;

    const dropZone   = document.getElementById(`pf-drop-${containerId}`);
    const fileInput  = document.getElementById(`pf-input-${containerId}`);
    const btnAnalyze = document.getElementById(`pf-btn-${containerId}`);
    const btnBAT     = document.getElementById(`pf-bat-${containerId}`);

    // Drag & drop
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('pf-drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('pf-drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('pf-drag-over');
      const file = e.dataTransfer.files[0];
      if (file?.type === 'application/pdf') _handleFile(file);
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) _handleFile(fileInput.files[0]);
    });

    function _handleFile(file) {
      document.getElementById(`pf-name-${containerId}`).textContent = `📄 ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`;
      document.getElementById(`pf-info-${containerId}`).style.display = '';
      dropZone.style.display = 'none';
      btnAnalyze._file = file;
    }

    btnAnalyze.addEventListener('click', async () => {
      const file = btnAnalyze._file;
      if (!file) return;

      btnAnalyze.disabled = true;
      document.getElementById(`pf-prog-${containerId}`).style.display = '';

      const spec = {
        productType: options.productType || 'fly',
        format: options.format || { width: 210, height: 297 },
        pageMultiple: options.pageMultiple || 1,
      };

      await runPreflight(file, spec, {
        onProgress: (step, pct, detail) => {
          document.getElementById(`pf-fill-${containerId}`).style.width = pct + '%';
          _setStatus(containerId, detail, 'info');
        },
        onComplete: (job) => {
          currentJobId = job.id;
          btnBAT.onclick = () => openViewer(job.id, spec.productType);
          document.getElementById(`pf-result-${containerId}`).style.display = '';
          document.getElementById(`pf-prog-${containerId}`).style.display = 'none';

          const s = job.status;
          _setStatus(containerId,
            s === 'ok'       ? '✓ Preflight réussi — aucun problème détecté' :
            s === 'warnings' ? '⚠ Preflight terminé avec avertissements' :
            s === 'errors'   ? '✗ Erreurs détectées — vérifier le BAT' :
                               'Preflight terminé',
            s === 'ok' ? 'ok' : s === 'errors' ? 'err' : 'warn'
          );
          btnAnalyze.disabled = false;
        },
        onError: (msg) => {
          _setStatus(containerId, '✗ Erreur : ' + msg, 'err');
          btnAnalyze.disabled = false;
          document.getElementById(`pf-prog-${containerId}`).style.display = 'none';
        },
      });
    });

    return () => currentJobId;
  }

  /* ══════════════════════════════════════════════════
     FONCTIONS INTERNES
     ══════════════════════════════════════════════════ */

  async function _uploadPDF(server, file, spec) {
    const form = new FormData();
    form.append('pdf', file);
    form.append('spec', JSON.stringify(spec));

    const res = await fetch(`${server}/api/preflight`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  function _watchJob(server, jobId, callbacks) {
    return new Promise((resolve, reject) => {
      const wsUrl = server.replace(/^http/, 'ws') + '/ws';
      let ws;

      try {
        ws = new WebSocket(wsUrl);
      } catch {
        // WebSocket non dispo → polling
        _pollJob(server, jobId, callbacks, resolve, reject);
        return;
      }

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe', jobId }));
      });

      ws.addEventListener('message', (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          switch (msg.type) {
            case 'progress':
              callbacks.onProgress?.(msg.step, msg.pct, msg.detail);
              break;
            case 'complete':
              ws.close();
              callbacks.onComplete?.(msg.job);
              resolve(msg.job);
              break;
            case 'error':
              ws.close();
              callbacks.onError?.(msg.error);
              reject(new Error(msg.error));
              break;
          }
        } catch {}
      });

      ws.addEventListener('error', () => {
        _pollJob(server, jobId, callbacks, resolve, reject);
      });
    });
  }

  // Fallback polling si WebSocket indisponible
  async function _pollJob(server, jobId, callbacks, resolve, reject) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const res = await fetch(`${server}/api/preflight/${jobId}`);
        const job = await res.json();

        callbacks.onProgress?.('poll', 50 + i, 'Traitement en cours…');

        if (job.status === 'processing') continue;

        if (job.status === 'error') {
          callbacks.onError?.(job.error);
          reject(new Error(job.error));
          return;
        }

        callbacks.onComplete?.(job);
        resolve(job);
        return;

      } catch (err) {
        reject(err);
        return;
      }
    }
    reject(new Error('Timeout — le serveur preflight ne répond pas.'));
  }

  function _openBATViewer(server, jobId, productType) {
    const url = `bat-3d.html?jobId=${jobId}&server=${encodeURIComponent(server)}&type=${productType || 'fly'}`;
    window.open(url, `bat_${jobId}`, 'width=1200,height=800,menubar=no,toolbar=no');
  }

  function _getServer() {
    if (typeof SIMPACT_CONFIG !== 'undefined' && SIMPACT_CONFIG.preflightServer) {
      return SIMPACT_CONFIG.preflightServer;
    }
    return DEFAULT_SERVER;
  }

  function _setStatus(containerId, msg, type) {
    const el = document.getElementById(`pf-status-${containerId}`);
    if (!el) return;
    const cls = type === 'ok' ? 'pf-ok' : type === 'err' ? 'pf-err' : type === 'warn' ? 'pf-warn' : 'pf-info';
    el.className = 'pf-status ' + cls;
    el.textContent = msg;
  }

  function _widgetCSS() {
    if (document.getElementById('pf-style')) return '';
    return `<style id="pf-style">
      .pf-widget{font-family:'Segoe UI',sans-serif}
      .pf-drop-zone{border:2px dashed #2a4570;border-radius:10px;padding:28px 20px;text-align:center;cursor:pointer;transition:.2s;background:#0d1b2a}
      .pf-drop-zone:hover,.pf-drop-zone.pf-drag-over{border-color:#4a9fd4;background:#162032}
      .pf-drop-label{font-size:13px;color:#5a7a99;margin-top:8px}
      .pf-drop-label span{font-size:11px;color:#3a5570}
      .pf-file-info{display:flex;align-items:center;gap:10px;padding:8px 0}
      .pf-file-name{font-size:12px;color:#a0b4c8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pf-btn-analyze{background:#c9a84c;color:#0d1b2a;border:none;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
      .pf-btn-analyze:hover{background:#e0bc60}
      .pf-btn-analyze:disabled{background:#2a3a4a;color:#5a7a99;cursor:not-allowed}
      .pf-progress-bar{height:4px;background:#1e3050;border-radius:2px;margin:8px 0;overflow:hidden}
      .pf-progress-fill{height:100%;background:linear-gradient(90deg,#4a9fd4,#c9a84c);width:0%;transition:width .4s;border-radius:2px}
      .pf-status{font-size:12px;padding:6px 0;min-height:20px}
      .pf-ok{color:#4caf88}.pf-err{color:#ef5350}.pf-warn{color:#c9a84c}.pf-info{color:#4a9fd4}
      .pf-btn-bat{background:#4a9fd4;color:#fff;border:none;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;margin-top:6px}
      .pf-btn-bat:hover{background:#5ab0e5}
    </style>`;
  }

  /* ══════════════════════════════════════════════════
     EXPORT
     ══════════════════════════════════════════════════ */
  return { runPreflight, openViewer, renderUploadWidget };

})();

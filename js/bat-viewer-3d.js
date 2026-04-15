/* ═══════════════════════════════════════════════════════════════
   SIMPACT BAT VIEWER 3D v2.0
   Viewer Three.js + vérification preflight automatique du fichier BAT
   Utilisé par : client-portal.html
   ═══════════════════════════════════════════════════════════════ */

const BAT_VIEWER_3D = (function () {

  /* ── Dimensions [largeur, hauteur, épaisseur] en unités Three.js ── */
  const DIMS = {
    fly:     [1.48, 2.10, 0.003],   // Flyer A5
    a4:      [2.10, 2.97, 0.003],   // Flyer A4
    a3:      [2.97, 4.20, 0.004],   // Affiche A3
    a2:      [4.20, 5.94, 0.004],   // Affiche A2
    poster:  [2.97, 4.20, 0.004],   // Poster
    card:    [1.70, 1.10, 0.008],   // Carte de visite
    booklet: [2.10, 2.97, 0.35],    // Brochure / livret
    book:    [2.10, 2.97, 0.50],    // Livre
  };

  /* ── État interne ── */
  let _renderer = null, _scene = null, _camera = null;
  let _controls = null, _mesh = null, _animId = null;
  let _autoRotate = true;

  /* ════════════════════════════════════════════════
     API PUBLIQUE
     ════════════════════════════════════════════════ */

  /**
   * @param {string}      fileUrl       - URL publique du fichier BAT (PDF ou image)
   * @param {string}      productType   - type produit (card / fly / a4 / a3…)
   * @param {string}      productName   - nom affiché dans le titre
   * @param {string|null} expectedPages - nombre de pages attendues (optionnel)
   */
  async function open(fileUrl, productType, productName, expectedPages) {
    _showOverlay(productName || 'BAT 3D');

    try {
      await _loadDeps();
      _initScene();

      const ext = (fileUrl.split('?')[0].split('.').pop() || '').toLowerCase();
      let texture = null;

      if (ext === 'pdf') {
        /* ── Charger le PDF une seule fois : preflight + texture ── */
        _setLoading('Analyse du fichier PDF…');
        const pdfDoc = await pdfjsLib.getDocument({ url: fileUrl, withCredentials: false }).promise;

        /* Preflight (non bloquant si PREFLIGHT non chargé) */
        if (typeof PREFLIGHT !== 'undefined') {
          _setLoading('Vérification du fichier…');
          try {
            const result = await PREFLIGHT.check(
              pdfDoc,
              productType,
              expectedPages ? parseInt(expectedPages, 10) : null
            );
            _renderBanner(result);
          } catch (pfErr) {
            console.warn('BAT_VIEWER_3D preflight:', pfErr);
          }
        }

        _setLoading('Génération de la maquette 3D…');
        texture = await _pdfDocToTexture(pdfDoc);

      } else {
        texture = await _imageToTexture(fileUrl);
      }

      _buildMesh(productType, texture);
      _startLoop();

    } catch (err) {
      console.error('BAT_VIEWER_3D:', err);
      _setLoading('Erreur : ' + err.message);
    }
  }

  function close() {
    _stopLoop();
    _disposeScene();
    const overlay = document.getElementById('bat3d-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  /* ════════════════════════════════════════════════
     BANDEAU PREFLIGHT
     ════════════════════════════════════════════════ */

  function _renderBanner(result) {
    const banner = document.getElementById('bat3d-banner');
    if (!banner) return;

    const STATUS_MAP = {
      ok:    { border: 'rgba(76,175,136,.6)',  bg: 'rgba(76,175,136,.12)',  icon: '🟢', title: 'Fichier conforme' },
      warn:  { border: 'rgba(201,168,76,.6)',  bg: 'rgba(201,168,76,.12)',  icon: '🟡', title: 'Avertissement(s)' },
      error: { border: 'rgba(239,83,80,.6)',   bg: 'rgba(239,83,80,.12)',   icon: '🔴', title: 'Erreur(s) détectée(s)' },
    };
    const ITEM_MAP = {
      ok:    { pill: 'rgba(76,175,136,.2)',  txt: '#4caf88', pfx: '✓' },
      warn:  { pill: 'rgba(201,168,76,.2)',  txt: '#e0bc60', pfx: '⚠' },
      error: { pill: 'rgba(239,83,80,.2)',   txt: '#ef5350', pfx: '✗' },
      info:  { pill: 'rgba(74,159,212,.2)',  txt: '#4a9fd4', pfx: '·' },
    };

    const s = STATUS_MAP[result.status] || STATUS_MAP.ok;
    banner.style.cssText = `
      position:absolute;bottom:0;left:0;right:0;z-index:20;
      padding:14px 20px 16px;
      background:${s.bg};
      border-top:1px solid ${s.border};
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
    `;

    const pills = (result.items || []).map(item => {
      const c = ITEM_MAP[item.type] || ITEM_MAP.info;
      return `<span style="
        display:inline-flex;align-items:center;gap:5px;
        padding:5px 12px;border-radius:20px;
        background:${c.pill};border:1px solid ${c.txt}44;
        font-size:11px;color:${c.txt};
        font-family:'DM Mono',monospace;white-space:nowrap;
        line-height:1.4">
        <strong>${c.pfx} ${item.label}</strong><span style="opacity:.8">— ${item.detail}</span>
      </span>`;
    }).join('');

    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:18px;line-height:1">${s.icon}</span>
          <span style="font-size:12px;font-weight:700;color:#fff;
                       text-transform:uppercase;letter-spacing:1px;
                       font-family:'DM Mono',monospace">${s.title}</span>
        </div>
        <button onclick="document.getElementById('bat3d-banner').style.display='none'"
          style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);
                 color:rgba(255,255,255,.7);border-radius:50%;width:26px;height:26px;
                 font-size:14px;cursor:pointer;line-height:1;flex-shrink:0"
          title="Fermer">×</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${pills}</div>
    `;

    banner.style.display = 'block';
  }

  /* ════════════════════════════════════════════════
     CHARGEMENT DYNAMIQUE DES DÉPENDANCES
     ════════════════════════════════════════════════ */

  async function _loadDeps() {
    if (!window.THREE) {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      await _loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    if (!window.pdfjsLib) {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Échec chargement : ' + src));
      document.head.appendChild(s);
    });
  }

  /* ════════════════════════════════════════════════
     SCÈNE THREE.JS
     ════════════════════════════════════════════════ */

  function _initScene() {
    const canvas = document.getElementById('bat3d-canvas');
    const W = canvas.clientWidth  || window.innerWidth;
    const H = canvas.clientHeight || window.innerHeight;

    _renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    _renderer.setSize(W, H, false);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.setClearColor(0x0a0a1a, 1);

    _scene = new THREE.Scene();

    _camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 100);
    _camera.position.set(0, 0, 5);

    /* Lumières */
    _scene.add(new THREE.AmbientLight(0xfff5e0, 0.55));

    const key = new THREE.DirectionalLight(0xfff8f0, 1.1);
    key.position.set(3, 4, 5);
    _scene.add(key);

    const fill = new THREE.DirectionalLight(0xc9a84c, 0.35);
    fill.position.set(-4, -2, 2);
    _scene.add(fill);

    const rim = new THREE.DirectionalLight(0x4a7fd4, 0.2);
    rim.position.set(0, 0, -6);
    _scene.add(rim);

    /* OrbitControls */
    _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
    _controls.enableDamping  = true;
    _controls.dampingFactor  = 0.08;
    _controls.minDistance    = 1.5;
    _controls.maxDistance    = 14;
    _controls.addEventListener('start', () => { _autoRotate = false; });

    window.addEventListener('resize', _onResize);
  }

  function _buildMesh(productType, texture) {
    const type = _normalizeType(productType);
    const [w, h, d] = DIMS[type] || DIMS.fly;

    const geo      = new THREE.BoxGeometry(w, h, d);
    const edgeMat  = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    const frontMat = texture
      ? new THREE.MeshBasicMaterial({ map: texture })
      : new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    const backMat  = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });

    /* BoxGeometry face order : +X, -X, +Y, -Y, +Z (avant), -Z (arrière) */
    _mesh = new THREE.Mesh(geo, [
      edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat,
    ]);
    _mesh.rotation.x =  0.12;
    _mesh.rotation.y = -0.45;
    _scene.add(_mesh);

    _setLoading(null);
  }

  /* ════════════════════════════════════════════════
     CHARGEMENT DE TEXTURE
     ════════════════════════════════════════════════ */

  /** Rend la page 1 d'un PDFDocumentProxy déjà chargé en CanvasTexture Three.js */
  async function _pdfDocToTexture(pdfDoc) {
    const page = await pdfDoc.getPage(1);
    const vp   = page.getViewport({ scale: 2.0 });

    const offscreen = document.createElement('canvas');
    offscreen.width  = vp.width;
    offscreen.height = vp.height;
    const ctx = offscreen.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const tex = new THREE.CanvasTexture(offscreen);
    tex.needsUpdate = true;
    return tex;
  }

  function _imageToTexture(url) {
    return new Promise((resolve, reject) => {
      _setLoading('Chargement de l\'image…');
      new THREE.TextureLoader().load(url, resolve, undefined, reject);
    });
  }

  /* ════════════════════════════════════════════════
     BOUCLE DE RENDU
     ════════════════════════════════════════════════ */

  function _startLoop() {
    function loop() {
      _animId = requestAnimationFrame(loop);
      if (_autoRotate && _mesh) _mesh.rotation.y += 0.004;
      _controls?.update();
      if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
    }
    loop();
  }

  function _stopLoop() {
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
    window.removeEventListener('resize', _onResize);
  }

  function _disposeScene() {
    if (_mesh) {
      _mesh.geometry.dispose();
      const mats = Array.isArray(_mesh.material) ? _mesh.material : [_mesh.material];
      mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      _mesh = null;
    }
    if (_renderer) { _renderer.dispose(); _renderer = null; }
    _scene = null; _camera = null; _controls = null;
    _autoRotate = true;
  }

  function _onResize() {
    if (!_renderer || !_camera) return;
    const canvas = document.getElementById('bat3d-canvas');
    if (!canvas) return;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    _camera.aspect = W / H;
    _camera.updateProjectionMatrix();
    _renderer.setSize(W, H, false);
  }

  /* ════════════════════════════════════════════════
     OVERLAY UI (créé dynamiquement au premier appel)
     ════════════════════════════════════════════════ */

  function _showOverlay(title) {
    let overlay = document.getElementById('bat3d-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bat3d-overlay';
      overlay.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;background:#0a0a1a;z-index:9999;display:none';

      overlay.innerHTML = `
        <!-- Barre de titre -->
        <div style="position:absolute;top:0;left:0;right:0;padding:16px 20px;
                    display:flex;align-items:center;justify-content:space-between;
                    z-index:10;background:linear-gradient(180deg,rgba(10,10,26,.95) 0%,transparent 100%)">
          <div>
            <div style="font-size:10px;color:#c9a84c;font-family:'DM Mono',monospace;
                        text-transform:uppercase;letter-spacing:1.5px;margin-bottom:2px">✦ BAT 3D</div>
            <div id="bat3d-title" style="font-size:17px;font-weight:600;color:#fff"></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:11px;color:rgba(255,255,255,.35);font-family:'DM Mono',monospace">
              Glisser · Scroll
            </div>
            <button onclick="BAT_VIEWER_3D.close()"
              style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);
                     color:#fff;border-radius:50%;width:40px;height:40px;font-size:22px;
                     cursor:pointer;line-height:1;transition:.2s"
              onmouseover="this.style.background='rgba(255,255,255,.22)'"
              onmouseout="this.style.background='rgba(255,255,255,.1)'">×</button>
          </div>
        </div>

        <!-- Canvas 3D (plein écran) -->
        <canvas id="bat3d-canvas"
          style="width:100%;height:100%;display:block;touch-action:none"></canvas>

        <!-- Indicateur de chargement -->
        <div id="bat3d-loading"
          style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                 color:#c9a84c;font-size:13px;font-family:'DM Mono',monospace;
                 letter-spacing:1px;pointer-events:none;text-align:center">
          Initialisation…
        </div>

        <!-- Bandeau preflight (rempli dynamiquement) -->
        <div id="bat3d-banner" style="display:none"></div>
      `;
      document.body.appendChild(overlay);
    }

    /* Reset à chaque ouverture */
    document.getElementById('bat3d-title').textContent = title;
    const banner = document.getElementById('bat3d-banner');
    if (banner) banner.style.display = 'none';
    overlay.style.display = 'block';
    _setLoading('Initialisation…');
    _autoRotate = true;
  }

  function _setLoading(msg) {
    const el = document.getElementById('bat3d-loading');
    if (!el) return;
    if (msg) { el.textContent = msg; el.style.display = ''; }
    else      { el.style.display = 'none'; }
  }

  /* ════════════════════════════════════════════════
     UTILITAIRES
     ════════════════════════════════════════════════ */

  function _normalizeType(str) {
    const n = (str || '').toLowerCase();
    if (/carte.*visite|business|card/.test(n))  return 'card';
    if (/brochure|livret|agraf/.test(n))         return 'booklet';
    if (/livre|book/.test(n))                    return 'book';
    if (/affiche|poster|a3/.test(n))             return 'a3';
    if (/affiche|poster|a2/.test(n))             return 'a2';
    if (/a4/.test(n))                            return 'a4';
    return 'fly';
  }

  /* ════════════════════════════════════════════════
     EXPORT
     ════════════════════════════════════════════════ */
  return { open, close };

})();

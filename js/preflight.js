/* ═══════════════════════════════════════════════════════════════
   SIMPACT PREFLIGHT CLIENT-SIDE v1.0
   Vérification automatique du fichier BAT/PDF dans le navigateur
   Dépendance : PDF.js (pdfjsLib doit être disponible au moment de l'appel)
   Utilisé par : bat-viewer-3d.js
   ═══════════════════════════════════════════════════════════════ */

const PREFLIGHT = (function () {

  /* ── 1 point = 1/72 pouce = 0.3528 mm ── */
  const PT_MM = 25.4 / 72;

  /* ── Dimensions de référence [largeur_mm, hauteur_mm] par type produit ── */
  const FORMAT_SPECS = {
    card:    [85,  55 ],   // Carte de visite standard
    fly:     [148, 210],   // Flyer A5
    a4:      [210, 297],   // Flyer / document A4
    a3:      [297, 420],   // Affiche A3
    a2:      [420, 594],   // Affiche A2
    poster:  [297, 420],   // Poster (idem A3)
    booklet: [210, 297],   // Brochure / livret A4
    book:    [210, 297],   // Livre A4
  };

  /* Tolérance format en mm (fonds perdus + rogner : ±4mm chaque côté = ±8mm) */
  const BLEED_TOL = 8;
  const DPI_OK    = 300;
  const DPI_WARN  = 200;

  /* ════════════════════════════════════════════════
     API PUBLIQUE
     ════════════════════════════════════════════════ */

  /**
   * Analyse un PDF déjà chargé via PDF.js.
   *
   * @param {PDFDocumentProxy} pdfDoc      - document PDF.js chargé
   * @param {string}           productType - type produit (card / fly / a4 / a3…)
   * @param {number|null}      expectedPgs - nombre de pages attendues, null = pas de vérification
   * @returns {Promise<{ status:'ok'|'warn'|'error', items: CheckItem[] }>}
   */
  async function check(pdfDoc, productType, expectedPgs) {
    const items = [];

    /* ── 1. Nombre de pages ───────────────────────────────── */
    items.push(_checkPages(pdfDoc.numPages, expectedPgs));

    /* ── 2. Format & 3. Résolution (page 1) ─────────────────── */
    try {
      const page = await pdfDoc.getPage(1);
      const vp   = page.getViewport({ scale: 1 });

      items.push(_checkFormat(vp.width, vp.height, productType));

      const dpiItem = await _checkDPI(page, vp);
      if (dpiItem) items.push(dpiItem);

    } catch (e) {
      items.push({ type: 'warn', label: 'Analyse', detail: 'Impossible d\'analyser la page : ' + e.message });
    }

    const status = items.some(i => i.type === 'error') ? 'error'
                 : items.some(i => i.type === 'warn')  ? 'warn'
                 : 'ok';

    return { status, items };
  }

  /* ════════════════════════════════════════════════
     VÉRIFICATIONS
     ════════════════════════════════════════════════ */

  function _checkPages(numPages, expected) {
    if (!expected || expected <= 1) {
      return { type: 'ok', label: 'Pages',
               detail: `${numPages} page${numPages > 1 ? 's' : ''} ✓` };
    }
    if (numPages === expected) {
      return { type: 'ok',    label: 'Pages', detail: `${numPages} pages ✓` };
    }
    if (Math.abs(numPages - expected) <= 2) {
      return { type: 'warn',  label: 'Pages',
               detail: `${numPages}p reçues — ${expected}p attendues (±2 toléré)` };
    }
    return   { type: 'error', label: 'Pages',
               detail: `${numPages}p reçues — ${expected}p attendues` };
  }

  function _checkFormat(widthPts, heightPts, productType) {
    const wMm  = widthPts  * PT_MM;
    const hMm  = heightPts * PT_MM;
    const spec = FORMAT_SPECS[productType];

    const got = `${wMm.toFixed(0)} × ${hMm.toFixed(0)} mm`;

    if (!spec) {
      return { type: 'ok', label: 'Format', detail: got };
    }

    const [sw, sh] = spec;
    /* Accepter portrait ET paysage + tolérance fonds perdus */
    const okPortrait  = Math.abs(wMm - sw) <= BLEED_TOL && Math.abs(hMm - sh) <= BLEED_TOL;
    const okLandscape = Math.abs(wMm - sh) <= BLEED_TOL && Math.abs(hMm - sw) <= BLEED_TOL;
    const exp = `${sw} × ${sh} mm`;

    if (okPortrait || okLandscape) {
      return { type: 'ok',    label: 'Format', detail: `${got} ✓ (attendu ${exp})` };
    }
    return   { type: 'error', label: 'Format', detail: `${got} — attendu ${exp}` };
  }

  async function _checkDPI(page, viewport) {
    try {
      const ops = await page.getOperatorList();
      const OPS = pdfjsLib.OPS;

      /* ── Suivi de la CTM (Current Transformation Matrix) ── */
      let ctm         = [1, 0, 0, 1, 0, 0]; // matrice identité
      const ctmStack  = [];
      const imgCalls  = []; // { name, ctm }

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn   = ops.fnArray[i];
        const args = ops.argsArray[i];

        if      (fn === OPS.save)      { ctmStack.push([...ctm]); }
        else if (fn === OPS.restore)   { ctm = ctmStack.pop() || [1,0,0,1,0,0]; }
        else if (fn === OPS.transform) { ctm = _mmul(args, ctm); }
        else if (
          fn === OPS.paintImageXObject       ||
          fn === OPS.paintJpegXObject        ||
          fn === OPS.paintInlineImageXObject
        ) {
          /* Pour les images inline, args[0] est un objet (pas un nom) — on ignore */
          if (typeof args[0] === 'string') {
            imgCalls.push({ name: args[0], ctm: [...ctm] });
          }
        }
      }

      if (!imgCalls.length) {
        return { type: 'ok', label: 'Résolution', detail: 'PDF vectoriel — résolution illimitée ✓' };
      }

      /* Rendu à scale=1 pour forcer le chargement des objets image */
      const tmp = Object.assign(document.createElement('canvas'), {
        width:  Math.max(1, Math.round(viewport.width)),
        height: Math.max(1, Math.round(viewport.height)),
      });
      await page.render({ canvasContext: tmp.getContext('2d'), viewport }).promise;

      let minDpi = Infinity;
      let count  = 0;

      for (const { name, ctm: m } of imgCalls) {
        const img = _getObj(page, name);
        if (!img?.width || !img?.height) continue;

        /* Taille de l'image peinte (1 image unit → CTM) en points */
        const wPts = Math.hypot(m[0], m[1]);
        const hPts = Math.hypot(m[2], m[3]);
        if (wPts < 1 || hPts < 1) continue;

        /* DPI = pixels / (points / 72) */
        const dpiX = img.width  / (wPts / 72);
        const dpiY = img.height / (hPts / 72);
        const dpi  = Math.round(Math.min(dpiX, dpiY));

        if (dpi > 10 && dpi < 50000) { // filtre valeurs aberrantes
          minDpi = Math.min(minDpi, dpi);
          count++;
        }
      }

      if (!count) {
        return { type: 'ok', label: 'Résolution', detail: 'PDF vectoriel — résolution illimitée ✓' };
      }

      const suffix = count > 1 ? ` (${count} images)` : '';

      if (minDpi >= DPI_OK) {
        return { type: 'ok',    label: 'Résolution', detail: `${minDpi} DPI ✓${suffix}` };
      }
      if (minDpi >= DPI_WARN) {
        return { type: 'warn',  label: 'Résolution', detail: `${minDpi} DPI${suffix} — recommandé ≥ 300 DPI` };
      }
      return   { type: 'error', label: 'Résolution', detail: `${minDpi} DPI${suffix} — trop faible (min. 300 requis)` };

    } catch {
      return null; // ne pas bloquer le viewer si le check DPI échoue
    }
  }

  /* ════════════════════════════════════════════════
     UTILITAIRES INTERNES
     ════════════════════════════════════════════════ */

  /** Récupère un objet PDF.js depuis page.objs ou page.commonObjs */
  function _getObj(page, name) {
    try { const o = page.objs.get(name);       if (o) return o; } catch {}
    try { const o = page.commonObjs.get(name); if (o) return o; } catch {}
    return null;
  }

  /**
   * Multiplication de matrices affines PDF [a, b, c, d, e, f].
   * L'opérateur `cm` prémultiplie la CTM courante : CTM_new = M_cm × CTM.
   */
  function _mmul(a, b) {
    return [
      a[0]*b[0] + a[1]*b[2],
      a[0]*b[1] + a[1]*b[3],
      a[2]*b[0] + a[3]*b[2],
      a[2]*b[1] + a[3]*b[3],
      a[4]*b[0] + a[5]*b[2] + b[4],
      a[4]*b[1] + a[5]*b[3] + b[5],
    ];
  }

  /* ════════════════════════════════════════════════
     EXPORT
     ════════════════════════════════════════════════ */
  return { check };

})();

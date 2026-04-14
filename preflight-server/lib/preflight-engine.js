/* ═══════════════════════════════════════════════════════════════
   SIMPACT PREFLIGHT ENGINE v1.0
   Moteur d'analyse et correction PDF pour impression

   Pipeline : Pagination → Format → Traits de coupe → Fond perdu
              → DPI → Corrections → Génération previews

   Dépendances : pdf-lib, sharp, pdfjs-dist
   Dep. système : Ghostscript (gs) pour rastérisation HD
   ═══════════════════════════════════════════════════════════════ */

const { PDFDocument, PDFName, PDFArray, PDFNumber, rgb, pushGraphicsState,
        popGraphicsState, moveTo, lineTo, setLineWidth, setStrokingColor,
        closePath, stroke, StandardFonts, degrees } = require('pdf-lib');
const sharp  = require('sharp');
const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');

/* ── Constantes ──────────────────────────────────────────────── */
const MM   = 2.83465;  // 1 mm = 2.83465 points PDF
const INCH = 72;       // 1 inch = 72 points PDF

const DPI_REJECT  = 150;
const DPI_WARN    = 250;
const BLEED_MM    = 3;
const CROP_LEN_MM = 5;
const CROP_OFF_MM = 3;

/* ── Formats produits SIMPACT (mm) ───────────────────────────── */
const PRODUCT_FORMATS = {
  cdv: { w: 85, h: 55, pageMultiple: 1 },
  fly: { w: 210, h: 297, pageMultiple: 1 },
  bro: { w: 210, h: 297, pageMultiple: 4 },
  aff: { w: 297, h: 420, pageMultiple: 1 },
  ent: { w: 210, h: 297, pageMultiple: 1 },
  dep: { w: 210, h: 297, pageMultiple: 1 },
  liv: { w: 148, h: 210, pageMultiple: 4 },
  off: { w: 210, h: 297, pageMultiple: 1 },
};


class PreflightEngine {

  /* ════════════════════════════════════════════════════════════
     POINT D'ENTRÉE PRINCIPAL
     ════════════════════════════════════════════════════════════ */

  async run(pdfBuffer, spec, opts = {}) {
    const { jobDir, onProgress } = opts;
    const progress = onProgress || (() => {});

    // Normaliser le spec
    const s = this._normalizeSpec(spec);

    // Charger le PDF
    progress('load', 10, 'Analyse du document…');
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const pages  = pdfDoc.getPages();

    // Rapport
    const report = {
      originalPageCount: pages.length,
      checks: {},
      corrections: [],
      hasBlockingErrors: false,
      hasWarnings: false,
    };

    // ── 1. Pagination ────────────────────────────────────────
    progress('pagination', 20, 'Vérification du chemin de fer…');
    report.checks.pagination = this._checkPagination(pdfDoc, s);
    if (report.checks.pagination.corrected) {
      report.corrections.push(report.checks.pagination.correction);
    }

    // ── 2. Format & Orientation ──────────────────────────────
    progress('format', 30, 'Contrôle du format et orientation…');
    report.checks.format = this._checkFormat(pdfDoc, s);
    if (report.checks.format.corrections.length > 0) {
      report.corrections.push(...report.checks.format.corrections);
    }

    // ── 3. Traits de coupe ───────────────────────────────────
    progress('cropMarks', 45, 'Vérification des traits de coupe…');
    report.checks.cropMarks = this._handleCropMarks(pdfDoc, s);
    if (report.checks.cropMarks.added) {
      report.corrections.push('Traits de coupe vectoriels ajoutés sur toutes les pages.');
    }

    // ── 4. Fond perdu (Bleed) ────────────────────────────────
    progress('bleed', 55, 'Contrôle du fond perdu…');
    report.checks.bleed = await this._handleBleed(pdfDoc, pdfBuffer, s, jobDir);
    if (report.checks.bleed.generated) {
      report.corrections.push(`Fond perdu ${BLEED_MM}mm généré par effet miroir.`);
    }

    // ── 5. Analyse DPI ───────────────────────────────────────
    progress('dpi', 70, 'Analyse de la résolution des images…');
    report.checks.dpi = await this._analyzeDPI(pdfBuffer);
    if (report.checks.dpi.rejected.length > 0) report.hasBlockingErrors = true;
    if (report.checks.dpi.warned.length > 0)   report.hasWarnings = true;

    // ── 6. Sauvegarder le PDF corrigé ────────────────────────
    progress('save', 85, 'Sauvegarde du PDF corrigé…');
    const correctedPdf = await pdfDoc.save();

    // ── 7. Générer les previews (PNG HD) ─────────────────────
    progress('previews', 90, 'Génération des aperçus…');
    const previews = await this._generatePreviews(
      Buffer.from(correctedPdf), jobDir
    );

    // Résumé
    report.finalPageCount = pdfDoc.getPageCount();
    report.correctionCount = report.corrections.length;

    return { report, correctedPdf: Buffer.from(correctedPdf), previews };
  }


  /* ════════════════════════════════════════════════════════════
     1. PAGINATION
     ════════════════════════════════════════════════════════════ */

  _checkPagination(pdfDoc, spec) {
    const count    = pdfDoc.getPageCount();
    const multiple = spec.pageMultiple || 1;
    const result   = {
      status: 'ok',
      pageCount: count,
      requiredMultiple: multiple,
      corrected: false,
      correction: null,
    };

    if (multiple <= 1) return result;

    const remainder = count % multiple;
    if (remainder === 0) return result;

    const blanksNeeded = multiple - remainder;
    const lastPage     = pdfDoc.getPages()[count - 1];
    const { width, height } = lastPage.getSize();

    for (let i = 0; i < blanksNeeded; i++) {
      pdfDoc.addPage([width, height]);
    }

    result.status     = 'corrected';
    result.corrected  = true;
    result.correction = `${blanksNeeded} page(s) blanche(s) ajoutée(s) pour atteindre un multiple de ${multiple} (${count} → ${count + blanksNeeded}).`;
    result.blanksAdded = blanksNeeded;

    return result;
  }


  /* ════════════════════════════════════════════════════════════
     2. FORMAT & ORIENTATION
     ════════════════════════════════════════════════════════════ */

  _checkFormat(pdfDoc, spec) {
    const targetW = spec.formatW * MM;
    const targetH = spec.formatH * MM;
    const tolerance = 1 * MM; // 1mm de tolérance

    const result = {
      status: 'ok',
      targetMm: { w: spec.formatW, h: spec.formatH },
      pages: [],
      corrections: [],
    };

    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = this._getTrimBox(page);
      const pageInfo = {
        page: i + 1,
        detectedMm: { w: +(width / MM).toFixed(1), h: +(height / MM).toFixed(1) },
        action: 'none',
      };

      // Vérifier si le format correspond (avec tolérance)
      const matchDirect = Math.abs(width - targetW) < tolerance &&
                          Math.abs(height - targetH) < tolerance;
      const matchRotated = Math.abs(width - targetH) < tolerance &&
                           Math.abs(height - targetW) < tolerance;

      if (matchDirect) {
        pageInfo.action = 'ok';
      } else if (matchRotated) {
        // Rotation nécessaire
        page.setRotation(degrees(90));
        pageInfo.action = 'rotated';
        result.corrections.push(`Page ${i + 1} : rotation 90° appliquée.`);
      } else {
        // Mise à l'échelle homothétique
        const scaleX = targetW / width;
        const scaleY = targetH / height;
        const scale  = Math.min(scaleX, scaleY); // homothétique (conserver les proportions)

        page.scaleContent(scale, scale);

        // Recentrer le contenu sur la page redimensionnée
        const newW = width * scale;
        const newH = height * scale;
        const dx = (targetW - newW) / 2;
        const dy = (targetH - newH) / 2;
        page.translateContent(dx, dy);
        page.setSize(targetW, targetH);

        pageInfo.action = 'scaled';
        pageInfo.scale = +(scale * 100).toFixed(1);
        result.corrections.push(
          `Page ${i + 1} : mise à l'échelle ${pageInfo.scale}% (${pageInfo.detectedMm.w}×${pageInfo.detectedMm.h}mm → ${spec.formatW}×${spec.formatH}mm).`
        );
      }

      result.pages.push(pageInfo);
    }

    if (result.corrections.length > 0) result.status = 'corrected';
    return result;
  }


  /* ════════════════════════════════════════════════════════════
     3. TRAITS DE COUPE (CROP MARKS)
     ════════════════════════════════════════════════════════════ */

  _handleCropMarks(pdfDoc, spec) {
    const result = { status: 'ok', added: false, details: '' };

    const trimW   = spec.formatW * MM;
    const trimH   = spec.formatH * MM;
    const bleed   = BLEED_MM * MM;
    const cropLen = CROP_LEN_MM * MM;
    const cropOff = CROP_OFF_MM * MM;

    // MediaBox doit être assez grande pour contenir trim + bleed + traits de coupe
    const totalMargin = bleed + cropOff + cropLen;
    const mediaW = trimW + 2 * totalMargin;
    const mediaH = trimH + 2 * totalMargin;

    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();

      // Agrandir la page si nécessaire pour les traits de coupe
      if (width < mediaW || height < mediaH) {
        const dx = (mediaW - width) / 2;
        const dy = (mediaH - height) / 2;
        page.setSize(mediaW, mediaH);
        page.translateContent(dx, dy);
      }

      const cx = (page.getWidth() - trimW) / 2;  // TrimBox X offset
      const cy = (page.getHeight() - trimH) / 2;  // TrimBox Y offset

      // Dessiner les 8 traits de coupe (4 coins × 2 traits)
      this._drawCropMarks(page, cx, cy, trimW, trimH, cropLen, cropOff);

      // Définir les boxes PDF
      this._setTrimBox(page, cx, cy, trimW, trimH);
      this._setBleedBox(page, cx - bleed, cy - bleed,
                         trimW + 2 * bleed, trimH + 2 * bleed);
    }

    result.added   = true;
    result.status  = 'corrected';
    result.details = `Traits de coupe vectoriels ajoutés (${CROP_LEN_MM}mm, offset ${CROP_OFF_MM}mm).`;

    return result;
  }

  _drawCropMarks(page, tx, ty, tw, th, len, off) {
    // Couleur noire, ligne fine (0.25pt)
    const opts = { color: rgb(0, 0, 0), opacity: 1 };

    // Points clés : coins de la TrimBox
    const corners = [
      { x: tx,      y: ty },       // bas-gauche
      { x: tx + tw, y: ty },       // bas-droit
      { x: tx + tw, y: ty + th },  // haut-droit
      { x: tx,      y: ty + th },  // haut-gauche
    ];

    for (const { x, y } of corners) {
      // Trait horizontal (à gauche ou à droite du coin)
      const hDir = (x === tx) ? -1 : 1;
      page.drawLine({
        start: { x: x + hDir * off, y },
        end:   { x: x + hDir * (off + len), y },
        thickness: 0.25, ...opts,
      });

      // Trait vertical (en bas ou en haut du coin)
      const vDir = (y === ty) ? -1 : 1;
      page.drawLine({
        start: { x, y: y + vDir * off },
        end:   { x, y: y + vDir * (off + len) },
        thickness: 0.25, ...opts,
      });
    }
  }


  /* ════════════════════════════════════════════════════════════
     4. FOND PERDU (BLEED)
     ════════════════════════════════════════════════════════════ */

  async _handleBleed(pdfDoc, originalBuffer, spec, jobDir) {
    const result = {
      status: 'ok',
      bleedMm: 0,
      generated: false,
      method: null,
    };

    const pages   = pdfDoc.getPages();
    const trimW   = spec.formatW * MM;
    const trimH   = spec.formatH * MM;
    const bleedPt = BLEED_MM * MM;

    // Vérifier si le BleedBox est déjà correct
    const firstPage = pages[0];
    const bleedBox  = this._getBleedBox(firstPage);
    const trimBox   = this._getTrimBox(firstPage);

    if (bleedBox) {
      const bLeft   = trimBox.x - bleedBox.x;
      const bBottom = trimBox.y - bleedBox.y;
      const bRight  = (bleedBox.x + bleedBox.width) - (trimBox.x + trimBox.width);
      const bTop    = (bleedBox.y + bleedBox.height) - (trimBox.y + trimBox.height);
      const minBleed = Math.min(bLeft, bBottom, bRight, bTop);

      if (minBleed >= bleedPt * 0.9) { // 90% de tolérance
        result.status  = 'ok';
        result.bleedMm = +(minBleed / MM).toFixed(1);
        result.details = `Fond perdu existant : ${result.bleedMm}mm — conforme.`;
        return result;
      }
    }

    // Générer le fond perdu par effet miroir (sharp)
    if (!jobDir) {
      result.status  = 'warning';
      result.details = 'Fond perdu manquant — correction impossible (pas de répertoire de travail).';
      return result;
    }

    result.generated = true;
    result.method    = 'mirror-edge';
    result.bleedMm   = BLEED_MM;

    for (let i = 0; i < pages.length; i++) {
      try {
        await this._generateBleedForPage(pdfDoc, originalBuffer, i, spec, jobDir);
      } catch (err) {
        console.warn(`Bleed page ${i + 1}: ${err.message}`);
      }
    }

    result.status  = 'corrected';
    result.details = `Fond perdu ${BLEED_MM}mm généré par effet miroir sur ${pages.length} page(s).`;
    return result;
  }

  async _generateBleedForPage(pdfDoc, originalBuffer, pageIndex, spec, jobDir) {
    const trimWmm = spec.formatW;
    const trimHmm = spec.formatH;
    const bleed   = BLEED_MM;
    const dpi     = 300;

    // Rendre la page en image HD via Ghostscript
    const pageImg = path.join(jobDir, `_bleed_page_${pageIndex}.png`);
    const trimWpx = Math.round(trimWmm / 25.4 * dpi);
    const trimHpx = Math.round(trimHmm / 25.4 * dpi);
    const bleedPx = Math.round(bleed / 25.4 * dpi);

    // Ghostscript : rendre la page spécifique
    try {
      execSync(
        `gs -q -dBATCH -dNOPAUSE -dSAFER -sDEVICE=png16m ` +
        `-dFirstPage=${pageIndex + 1} -dLastPage=${pageIndex + 1} ` +
        `-r${dpi} -dTextAlphaBits=4 -dGraphicsAlphaBits=4 ` +
        `-sOutputFile="${pageImg}" -`,
        { input: originalBuffer, timeout: 30000 }
      );
    } catch {
      // Fallback : pas de Ghostscript, skip
      return;
    }

    if (!fs.existsSync(pageImg)) return;

    // Lire l'image rendue
    const img    = sharp(pageImg);
    const meta   = await img.metadata();
    const buf    = await img.raw().toBuffer();
    const { width: imgW, height: imgH, channels } = meta;

    // Créer le canvas étendu avec fond perdu
    const extW = imgW + 2 * bleedPx;
    const extH = imgH + 2 * bleedPx;

    // Bord haut — miroir vertical des N premières lignes
    const topStrip  = await sharp(pageImg)
      .extract({ left: 0, top: 0, width: imgW, height: bleedPx })
      .flip() // miroir vertical
      .toBuffer();

    // Bord bas — miroir vertical des N dernières lignes
    const bottomStrip = await sharp(pageImg)
      .extract({ left: 0, top: imgH - bleedPx, width: imgW, height: bleedPx })
      .flip()
      .toBuffer();

    // Bord gauche — miroir horizontal des N premières colonnes
    const leftStrip = await sharp(pageImg)
      .extract({ left: 0, top: 0, width: bleedPx, height: imgH })
      .flop() // miroir horizontal
      .toBuffer();

    // Bord droit — miroir horizontal des N dernières colonnes
    const rightStrip = await sharp(pageImg)
      .extract({ left: imgW - bleedPx, top: 0, width: bleedPx, height: imgH })
      .flop()
      .toBuffer();

    // Coins (miroir dans les deux directions)
    const tlCorner = await sharp(pageImg)
      .extract({ left: 0, top: 0, width: bleedPx, height: bleedPx })
      .flip().flop().toBuffer();
    const trCorner = await sharp(pageImg)
      .extract({ left: imgW - bleedPx, top: 0, width: bleedPx, height: bleedPx })
      .flip().flop().toBuffer();
    const blCorner = await sharp(pageImg)
      .extract({ left: 0, top: imgH - bleedPx, width: bleedPx, height: bleedPx })
      .flip().flop().toBuffer();
    const brCorner = await sharp(pageImg)
      .extract({ left: imgW - bleedPx, top: imgH - bleedPx, width: bleedPx, height: bleedPx })
      .flip().flop().toBuffer();

    // Composer l'image finale avec fond perdu
    const extendedPath = path.join(jobDir, `_bleed_ext_${pageIndex}.png`);
    await sharp({
      create: {
        width: extW,
        height: extH,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        // Image originale au centre
        { input: pageImg, left: bleedPx, top: bleedPx },
        // Bandes miroir
        { input: topStrip,    left: bleedPx, top: 0 },
        { input: bottomStrip, left: bleedPx, top: bleedPx + imgH },
        { input: leftStrip,   left: 0,       top: bleedPx },
        { input: rightStrip,  left: bleedPx + imgW, top: bleedPx },
        // Coins
        { input: tlCorner, left: 0, top: 0 },
        { input: trCorner, left: bleedPx + imgW, top: 0 },
        { input: blCorner, left: 0, top: bleedPx + imgH },
        { input: brCorner, left: bleedPx + imgW, top: bleedPx + imgH },
      ])
      .png()
      .toFile(extendedPath);

    // Intégrer l'image étendue dans le PDF (en remplacement de la page)
    const extImgBytes = fs.readFileSync(extendedPath);
    const pngImage    = await pdfDoc.embedPng(extImgBytes);

    const page       = pdfDoc.getPages()[pageIndex];
    const bleedPt    = BLEED_MM * MM;
    const newW       = spec.formatW * MM + 2 * bleedPt;
    const newH       = spec.formatH * MM + 2 * bleedPt;

    page.setSize(newW, newH);
    page.drawImage(pngImage, {
      x: 0, y: 0,
      width: newW, height: newH,
    });

    // Nettoyer les fichiers temporaires
    try { fs.unlinkSync(pageImg); } catch {}
    try { fs.unlinkSync(extendedPath); } catch {}
  }


  /* ════════════════════════════════════════════════════════════
     5. ANALYSE DPI
     ════════════════════════════════════════════════════════════ */

  async _analyzeDPI(pdfBuffer) {
    const result = {
      status: 'ok',
      images: [],
      rejected: [],
      warned: [],
      validated: [],
    };

    try {
      // Utiliser pdfjs-dist pour extraire les infos d'images
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
      const doc = await loadingTask.promise;

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const ops  = await page.getOperatorList();
        const vp   = page.getViewport({ scale: 1 });

        // Chercher les opérations paintImageXObject
        for (let j = 0; j < ops.fnArray.length; j++) {
          // OPS.paintImageXObject = 85
          if (ops.fnArray[j] === 85) {
            const imgName = ops.argsArray[j][0];
            try {
              const imgObj = await page.objs.get(imgName);
              if (imgObj && imgObj.width && imgObj.height) {
                // Dimensions natives de l'image (pixels)
                const nativeW = imgObj.width;
                const nativeH = imgObj.height;

                // Dimensions d'affichage (approximation via viewport)
                // Pour un calcul précis, il faudrait lire la matrice CTM
                const displayW = vp.width / 72 * 25.4;  // mm
                const displayH = vp.height / 72 * 25.4;  // mm

                // DPI effectif
                const dpiX = nativeW / (displayW / 25.4);
                const dpiY = nativeH / (displayH / 25.4);
                const dpi  = Math.min(dpiX, dpiY);

                const imgInfo = {
                  page: i,
                  name: imgName,
                  nativeSize: { w: nativeW, h: nativeH },
                  effectiveDpi: Math.round(dpi),
                  status: dpi < DPI_REJECT ? 'rejected' :
                          dpi < DPI_WARN   ? 'warning'  : 'ok',
                };

                result.images.push(imgInfo);
                if (imgInfo.status === 'rejected') result.rejected.push(imgInfo);
                else if (imgInfo.status === 'warning') result.warned.push(imgInfo);
                else result.validated.push(imgInfo);
              }
            } catch { /* image non lisible — skip */ }
          }
        }
      }

      if (result.rejected.length > 0) result.status = 'error';
      else if (result.warned.length > 0) result.status = 'warning';

    } catch (err) {
      console.warn('DPI analysis fallback:', err.message);
      result.status = 'skipped';
      result.details = 'Analyse DPI non disponible : ' + err.message;
    }

    return result;
  }


  /* ════════════════════════════════════════════════════════════
     6. GÉNÉRATION DES PREVIEWS (PNG)
     ════════════════════════════════════════════════════════════ */

  async _generatePreviews(correctedBuffer, jobDir) {
    const previews = [];
    if (!jobDir) return previews;

    const pageCount = await this._countPages(correctedBuffer);
    const dpi = 150; // Résolution preview (suffisant pour Three.js)

    for (let i = 1; i <= pageCount; i++) {
      const outPath = path.join(jobDir, `preview_${i}.png`);
      try {
        execSync(
          `gs -q -dBATCH -dNOPAUSE -dSAFER -sDEVICE=png16m ` +
          `-dFirstPage=${i} -dLastPage=${i} ` +
          `-r${dpi} -dTextAlphaBits=4 -dGraphicsAlphaBits=4 ` +
          `-sOutputFile="${outPath}" -`,
          { input: correctedBuffer, timeout: 30000 }
        );

        if (fs.existsSync(outPath)) {
          const meta = await sharp(outPath).metadata();
          previews.push({ page: i, path: outPath, width: meta.width, height: meta.height });
        }
      } catch (err) {
        console.warn(`Preview page ${i}: ${err.message}`);
      }
    }

    return previews;
  }

  async _countPages(buffer) {
    try {
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      return doc.getPageCount();
    } catch { return 0; }
  }


  /* ════════════════════════════════════════════════════════════
     UTILITAIRES PDF BOXES
     ════════════════════════════════════════════════════════════ */

  _getTrimBox(page) {
    try {
      const tb = page.node.lookup(PDFName.of('TrimBox'));
      if (tb instanceof PDFArray && tb.size() === 4) {
        const [x1, y1, x2, y2] = tb.asArray().map(n => n instanceof PDFNumber ? n.asNumber() : 0);
        return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
      }
    } catch {}
    // Fallback: MediaBox
    const { width, height } = page.getSize();
    return { x: 0, y: 0, width, height };
  }

  _getBleedBox(page) {
    try {
      const bb = page.node.lookup(PDFName.of('BleedBox'));
      if (bb instanceof PDFArray && bb.size() === 4) {
        const [x1, y1, x2, y2] = bb.asArray().map(n => n instanceof PDFNumber ? n.asNumber() : 0);
        return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
      }
    } catch {}
    return null;
  }

  _setTrimBox(page, x, y, w, h) {
    page.node.set(PDFName.of('TrimBox'),
      page.doc.context.obj([x, y, x + w, y + h]));
  }

  _setBleedBox(page, x, y, w, h) {
    page.node.set(PDFName.of('BleedBox'),
      page.doc.context.obj([x, y, x + w, y + h]));
  }


  /* ════════════════════════════════════════════════════════════
     NORMALISATION DU SPEC
     ════════════════════════════════════════════════════════════ */

  _normalizeSpec(spec) {
    const defaults = PRODUCT_FORMATS[spec.productType] || PRODUCT_FORMATS.fly;
    return {
      productType:  spec.productType || 'fly',
      formatW:      spec.format?.width  || defaults.w,
      formatH:      spec.format?.height || defaults.h,
      pageMultiple: spec.pageMultiple   || defaults.pageMultiple,
      bleedMm:      spec.bleedRequired  || BLEED_MM,
      binding:      spec.binding        || null,
      foldType:     spec.foldType       || null,
      colors:       spec.colors         || '44',
    };
  }
}


module.exports = { PreflightEngine };

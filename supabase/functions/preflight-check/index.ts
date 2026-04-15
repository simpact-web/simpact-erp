// @ts-nocheck
/**
 * SIMPACT — Edge Function: preflight-check
 *
 * POST /functions/v1/preflight-check
 * Body: { fileUrl: string, productType: string, expectedPages?: number }
 *
 * Retourne : { status: 'ok'|'warn'|'error', checks: CheckItem[] }
 * où CheckItem = { type: 'ok'|'warn'|'error', label: string, detail: string }
 *
 * Vérifications effectuées :
 *   1. Taille du fichier (Ko / Mo)
 *   2. Nombre de pages vs specs commande
 *   3. Format de la page (mm) vs dimensions attendues du produit
 */

import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1?target=deno&no-dts";

/* ── CORS ─────────────────────────────────────────────────────── */
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ── Constantes ────────────────────────────────────────────────── */
const PT_MM      = 25.4 / 72;   // 1 point PDF = 0.3528 mm
const BLEED_TOL  = 8;            // tolérance format mm (±4mm fonds perdus chaque côté)
const MAX_MB     = 150;          // limite haute (avertissement)
const WARN_MB    = 80;           // seuil avertissement taille

/** Dimensions de référence [largeur_mm, hauteur_mm] par type produit */
const FORMAT_SPECS: Record<string, [number, number]> = {
  card:    [85,  55 ],
  fly:     [148, 210],
  a4:      [210, 297],
  a3:      [297, 420],
  a2:      [420, 594],
  poster:  [297, 420],
  booklet: [210, 297],
  book:    [210, 297],
};

/* ── Types ─────────────────────────────────────────────────────── */
interface CheckItem {
  type:   "ok" | "warn" | "error";
  label:  string;
  detail: string;
}

interface PreflightResult {
  status: "ok" | "warn" | "error";
  checks: CheckItem[];
}

/* ════════════════════════════════════════════════════════════════
   HANDLER PRINCIPAL
   ════════════════════════════════════════════════════════════════ */

Deno.serve(async (req: Request): Promise<Response> => {

  /* Preflight CORS */
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Méthode non autorisée" }, { status: 405, headers: CORS });
  }

  /* ── Parse du body ── */
  let fileUrl: string;
  let productType: string;
  let expectedPages: number | null;

  try {
    const body = await req.json();
    fileUrl      = body.fileUrl;
    productType  = (body.productType || "fly").toLowerCase();
    expectedPages = body.expectedPages ? parseInt(body.expectedPages, 10) : null;

    if (!fileUrl) throw new Error("fileUrl requis");
  } catch (e) {
    return Response.json({ error: "Corps invalide : " + (e as Error).message }, { status: 400, headers: CORS });
  }

  /* ── Téléchargement du fichier ── */
  let buffer: ArrayBuffer;
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return Response.json(
        { error: `Impossible de télécharger le fichier (HTTP ${response.status})` },
        { status: 400, headers: CORS }
      );
    }
    buffer = await response.arrayBuffer();
  } catch (e) {
    return Response.json({ error: "Erreur réseau : " + (e as Error).message }, { status: 400, headers: CORS });
  }

  const checks: CheckItem[] = [];

  /* ── Check 1 : Taille du fichier ── */
  checks.push(checkSize(buffer.byteLength));

  /* ── Lecture PDF ── */
  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  } catch (e) {
    checks.push({
      type:   "error",
      label:  "Fichier",
      detail: "Impossible de lire le PDF : " + (e as Error).message,
    });
    return Response.json(buildResult(checks), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  /* ── Check 2 : Nombre de pages ── */
  checks.push(checkPages(pdfDoc.getPageCount(), expectedPages));

  /* ── Check 3 : Format de la page 1 ── */
  checks.push(checkFormat(pdfDoc.getPage(0), productType));

  /* ── Réponse ── */
  return Response.json(buildResult(checks), { headers: { ...CORS, "Content-Type": "application/json" } });
});

/* ════════════════════════════════════════════════════════════════
   VÉRIFICATIONS
   ════════════════════════════════════════════════════════════════ */

function checkSize(bytes: number): CheckItem {
  const kb = bytes / 1024;
  const mb = kb / 1024;

  if (kb < 5) {
    return { type: "error", label: "Taille", detail: `${kb.toFixed(0)} Ko — fichier suspect (trop petit)` };
  }
  if (mb > MAX_MB) {
    return { type: "error", label: "Taille", detail: `${mb.toFixed(0)} Mo — fichier trop volumineux (max ${MAX_MB} Mo)` };
  }
  if (mb > WARN_MB) {
    return { type: "warn", label: "Taille", detail: `${mb.toFixed(0)} Mo — fichier très volumineux` };
  }
  const display = mb >= 1 ? `${mb.toFixed(1)} Mo` : `${kb.toFixed(0)} Ko`;
  return { type: "ok", label: "Taille", detail: `${display} ✓` };
}

function checkPages(numPages: number, expected: number | null): CheckItem {
  if (!expected || expected <= 1) {
    return {
      type:   "ok",
      label:  "Pages",
      detail: `${numPages} page${numPages > 1 ? "s" : ""} ✓`,
    };
  }
  if (numPages === expected) {
    return { type: "ok",    label: "Pages", detail: `${numPages} pages ✓` };
  }
  if (Math.abs(numPages - expected) <= 2) {
    return { type: "warn",  label: "Pages", detail: `${numPages}p reçues — ${expected}p attendues (±2 toléré)` };
  }
  return   { type: "error", label: "Pages", detail: `${numPages}p reçues — ${expected}p attendues` };
}

function checkFormat(page: ReturnType<typeof PDFDocument.prototype.getPage>, productType: string): CheckItem {
  const { width: wPts, height: hPts } = page.getSize();
  const wMm = wPts * PT_MM;
  const hMm = hPts * PT_MM;
  const got = `${Math.round(wMm)} × ${Math.round(hMm)} mm`;

  const spec = FORMAT_SPECS[productType];
  if (!spec) {
    return { type: "ok", label: "Format", detail: got };
  }

  const [sw, sh] = spec;
  /* Portrait ET paysage + tolérance fonds perdus */
  const okP = Math.abs(wMm - sw) <= BLEED_TOL && Math.abs(hMm - sh) <= BLEED_TOL;
  const okL = Math.abs(wMm - sh) <= BLEED_TOL && Math.abs(hMm - sw) <= BLEED_TOL;
  const exp = `${sw} × ${sh} mm`;

  if (okP || okL) {
    return { type: "ok",    label: "Format", detail: `${got} ✓ (attendu ${exp})` };
  }
  return   { type: "error", label: "Format", detail: `${got} — attendu ${exp}` };
}

/* ════════════════════════════════════════════════════════════════
   UTILITAIRES
   ════════════════════════════════════════════════════════════════ */

function buildResult(checks: CheckItem[]): PreflightResult {
  const status: PreflightResult["status"] =
    checks.some(c => c.type === "error") ? "error" :
    checks.some(c => c.type === "warn")  ? "warn"  : "ok";
  return { status, checks };
}

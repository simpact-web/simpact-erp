/**
 * SIMPACT — Edge Function: preflight-check
 * Deno runtime (Supabase Edge Functions)
 *
 * POST /functions/v1/preflight-check
 * Body : { fileUrl: string, productType: string, expectedPages?: number }
 *
 * Réponse :
 * {
 *   "status": "ok" | "warning" | "error",
 *   "checks": [
 *     { "label": "Format",        "status": "ok",    "detail": "A4 détecté (210×297 mm)" },
 *     { "label": "Pages",         "status": "error", "detail": "4 pages reçues, 64 attendues" },
 *     { "label": "Taille fichier","status": "ok",    "detail": "2.3 Mo" }
 *   ]
 * }
 *
 * Lecture PDF : pdf-lib via esm.sh (compatible Deno, pas de worker Node.js requis).
 * Fallback : parsing bytes bruts si pdf-lib échoue.
 */

import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1?target=deno&no-dts";

/* ── CORS ────────────────────────────────────────────────────── */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type":                 "application/json",
};

/* ── Constantes ─────────────────────────────────────────────── */
const PT_MM     = 25.4 / 72;   // 1 point PDF → mm
const BLEED_TOL = 8;            // tolérance format mm (fonds perdus ±4 mm/côté)
const WARN_MB   = 80;
const MAX_MB    = 150;

/** Dimensions [largeur_mm, hauteur_mm] attendues par type produit */
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

/** Noms lisibles des formats pour les messages */
const FORMAT_NAMES: Record<string, string> = {
  card: "Carte de visite", fly: "Flyer A5", a4: "A4",
  a3: "A3", a2: "A2", poster: "Affiche", booklet: "Brochure A4", book: "Livre A4",
};

type CheckStatus = "ok" | "warning" | "error";
interface CheckItem { label: string; status: CheckStatus; detail: string; }
interface Result    { status: CheckStatus; checks: CheckItem[]; }

/* ════════════════════════════════════════════════════════════════
   HANDLER
   ════════════════════════════════════════════════════════════════ */

Deno.serve(async (req: Request): Promise<Response> => {

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Méthode non autorisée" }, 405);
  }

  /* ── Parse body ── */
  let fileUrl: string;
  let productType: string;
  let expectedPages: number | null;
  let detectOnly: boolean;

  try {
    const body = await req.json();
    fileUrl       = body.fileUrl;
    productType   = String(body.productType || "fly").toLowerCase();
    expectedPages = body.expectedPages ? parseInt(String(body.expectedPages), 10) : null;
    detectOnly    = !!body.detectOnly;
    if (!fileUrl) throw new Error("fileUrl manquant");
  } catch (e) {
    return json({ error: String((e as Error).message) }, 400);
  }

  /* ── Téléchargement ── */
  let rawBytes: Uint8Array;
  try {
    const resp = await fetch(fileUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} lors du téléchargement`);
    rawBytes = new Uint8Array(await resp.arrayBuffer());
  } catch (e) {
    return json({ error: "Impossible de télécharger le fichier : " + (e as Error).message }, 400);
  }

  /* ── Mode détection automatique (sans vérifications) ── */
  if (detectOnly) {
    const meta = await readPdfMeta(rawBytes);
    if (!meta.ok) return json({ error: meta.error! }, 400);
    const wMm = Math.round(meta.widthPts!  * PT_MM);
    const hMm = Math.round(meta.heightPts! * PT_MM);
    return json({
      detected: {
        pages:      meta.numPages!,
        widthMm:    wMm,
        heightMm:   hMm,
        formatName: detectFormatName(wMm, hMm),
        colorMode:  detectColorMode(rawBytes),
      },
    });
  }

  const checks: CheckItem[] = [];

  /* ── Check 1 : Taille fichier ── */
  checks.push(checkSize(rawBytes.byteLength));

  /* ── Lecture PDF ── */
  const meta = await readPdfMeta(rawBytes);
  if (!meta.ok) {
    checks.push({ label: "Fichier PDF", status: "error", detail: meta.error! });
    return json(buildResult(checks));
  }

  /* ── Check 2 : Nombre de pages ── */
  checks.push(checkPages(meta.numPages!, expectedPages));

  /* ── Check 3 : Format ── */
  checks.push(checkFormat(meta.widthPts!, meta.heightPts!, productType));

  return json(buildResult(checks));
});

/* ════════════════════════════════════════════════════════════════
   DÉTECTION AUTOMATIQUE (mode detectOnly)
   ════════════════════════════════════════════════════════════════ */

const KNOWN_FORMATS: [string, number, number][] = [
  ["Carte de visite (85×55mm)",  85,  55 ],
  ["A6 (105×148mm)",            105, 148 ],
  ["A5 (148×210mm)",            148, 210 ],
  ["16×23 cm",                  160, 230 ],
  ["A4 (210×297mm)",            210, 297 ],
  ["A3 (297×420mm)",            297, 420 ],
  ["Carré 210mm",               210, 210 ],
];

function detectFormatName(wMm: number, hMm: number): string {
  let best = "Personnalisé", minD = 25;
  for (const [name, sw, sh] of KNOWN_FORMATS) {
    const d = Math.min(
      Math.hypot(wMm - sw, hMm - sh),
      Math.hypot(wMm - sh, hMm - sw),
    );
    if (d < minD) { minD = d; best = name; }
  }
  return best;
}

/** Heuristique rapide : cherche des espaces colorimétriques RVB/CMJN dans les 500 premiers Ko */
function detectColorMode(bytes: Uint8Array): "color" | "bw" {
  const sample = new TextDecoder("latin-1").decode(
    bytes.slice(0, Math.min(bytes.length, 500_000))
  );
  const hasColor = /\/DeviceCMYK|\/DeviceRGB|\/CalRGB|\/ICCBased/.test(sample);
  const grayOnly = /\/DeviceGray/.test(sample) && !hasColor;
  return grayOnly ? "bw" : "color";
}

/* ════════════════════════════════════════════════════════════════
   VÉRIFICATIONS
   ════════════════════════════════════════════════════════════════ */

function checkSize(bytes: number): CheckItem {
  const kb = bytes / 1024;
  const mb = kb / 1024;
  const display = mb >= 1 ? `${mb.toFixed(1)} Mo` : `${Math.round(kb)} Ko`;

  if (kb < 5) {
    return { label: "Taille fichier", status: "error",   detail: `${display} — fichier trop petit ou corrompu` };
  }
  if (mb > MAX_MB) {
    return { label: "Taille fichier", status: "error",   detail: `${display} — dépasse la limite de ${MAX_MB} Mo` };
  }
  if (mb > WARN_MB) {
    return { label: "Taille fichier", status: "warning", detail: `${display} — fichier très volumineux` };
  }
  return   { label: "Taille fichier", status: "ok",      detail: display };
}

function checkPages(numPages: number, expected: number | null): CheckItem {
  if (!expected || expected <= 1) {
    return {
      label:  "Pages",
      status: "ok",
      detail: `${numPages} page${numPages > 1 ? "s" : ""} reçue${numPages > 1 ? "s" : ""}`,
    };
  }
  if (numPages === expected) {
    return { label: "Pages", status: "ok",      detail: `${numPages} pages ✓` };
  }
  if (Math.abs(numPages - expected) <= 2) {
    return { label: "Pages", status: "warning", detail: `${numPages} pages reçues, ${expected} attendues` };
  }
  return   { label: "Pages", status: "error",   detail: `${numPages} pages reçues, ${expected} attendues` };
}

function checkFormat(wPts: number, hPts: number, productType: string): CheckItem {
  const wMm  = wPts * PT_MM;
  const hMm  = hPts * PT_MM;
  const got  = `${Math.round(wMm)}×${Math.round(hMm)} mm`;
  const spec = FORMAT_SPECS[productType];

  if (!spec) {
    return { label: "Format", status: "ok", detail: `${got} détecté` };
  }

  const [sw, sh] = spec;
  const name     = FORMAT_NAMES[productType] || productType.toUpperCase();

  /* Accepter portrait ET paysage + tolérance fonds perdus */
  const okPortrait  = Math.abs(wMm - sw) <= BLEED_TOL && Math.abs(hMm - sh) <= BLEED_TOL;
  const okLandscape = Math.abs(wMm - sh) <= BLEED_TOL && Math.abs(hMm - sw) <= BLEED_TOL;

  if (okPortrait || okLandscape) {
    return { label: "Format", status: "ok",    detail: `${name} détecté (${got})` };
  }
  return   { label: "Format", status: "error", detail: `${got} reçu — attendu ${sw}×${sh} mm (${name})` };
}

/* ════════════════════════════════════════════════════════════════
   LECTURE PDF  (pdf-lib → fallback bytes bruts)
   ════════════════════════════════════════════════════════════════ */

interface PdfMeta {
  ok:        boolean;
  error?:    string;
  numPages?: number;
  widthPts?: number;
  heightPts?: number;
}

async function readPdfMeta(bytes: Uint8Array): Promise<PdfMeta> {
  /* ── Tentative 1 : pdf-lib ── */
  try {
    const doc      = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const page     = doc.getPage(0);
    const { width, height } = page.getSize();
    return { ok: true, numPages: doc.getPageCount(), widthPts: width, heightPts: height };
  } catch {
    /* pdf-lib a échoué → on passe au parsing bytes bruts */
  }

  /* ── Tentative 2 : parsing bytes bruts ── */
  return parsePdfRaw(bytes);
}

/**
 * Extraction minimale des métadonnées PDF par lecture des bytes bruts.
 * Fonctionne pour les PDFs conformes (pas de compression xref).
 */
function parsePdfRaw(bytes: Uint8Array): PdfMeta {
  /* Vérifier signature PDF */
  const sig = String.fromCharCode(...bytes.slice(0, 5));
  if (!sig.startsWith("%PDF")) {
    return { ok: false, error: "Le fichier n'est pas un PDF valide" };
  }

  /* Décoder en latin-1 pour préserver les octets tels quels */
  const text = new TextDecoder("latin-1").decode(bytes);

  /* ── Nombre de pages ──
     Cherche /Type /Page (mais pas /Type /Pages) dans le flux */
  const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
  const numPages    = pageMatches ? pageMatches.length : 1;

  /* ── Dimensions : première MediaBox trouvée ──
     Format : /MediaBox [llx lly urx ury] */
  const mbMatch = text.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  let widthPts = 595.28, heightPts = 841.89; // défaut A4

  if (mbMatch) {
    const llx = parseFloat(mbMatch[1]), lly = parseFloat(mbMatch[2]);
    const urx = parseFloat(mbMatch[3]), ury = parseFloat(mbMatch[4]);
    widthPts  = urx - llx;
    heightPts = ury - lly;
  }

  return { ok: true, numPages, widthPts, heightPts };
}

/* ════════════════════════════════════════════════════════════════
   UTILITAIRES
   ════════════════════════════════════════════════════════════════ */

function buildResult(checks: CheckItem[]): Result {
  const status: CheckStatus =
    checks.some(c => c.status === "error")   ? "error"   :
    checks.some(c => c.status === "warning") ? "warning" : "ok";
  return { status, checks };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

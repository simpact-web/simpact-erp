/* ═══════════════════════════════════════════════════════════════
   SIMPACT ERP — Client Supabase
   Les clés sont lues depuis SIMPACT_CONFIG (js/config.js).
   Ce fichier ne contient AUCUNE clé en dur.
   ═══════════════════════════════════════════════════════════════ */

function getSupabaseClient() {
  if (!window._supa) {
    if (!window.supabase) {
      console.error('SDK Supabase non chargé — vérifiez le CDN');
      return null;
    }
    if (!window.SIMPACT_CONFIG) {
      console.error('js/config.js manquant — copiez config.example.js et renseignez vos clés');
      return null;
    }
    window._supa = window.supabase.createClient(
      SIMPACT_CONFIG.supabaseUrl,
      SIMPACT_CONFIG.supabaseKey
    );
  }
  return window._supa;
}

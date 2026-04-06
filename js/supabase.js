/* ═══════════════════════════════════════════════════════════════
   SIMPACT ERP — Client Supabase
   Lit les clés depuis SIMPACT_CONFIG (js/config.js) si disponible,
   sinon utilise les clés par défaut (clé anon publique).
   ═══════════════════════════════════════════════════════════════ */

const _SUPA_DEFAULTS = {
  url: 'https://yqileqgxpihnyaauwmtr.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxaWxlcWd4cGlobnlhYXV3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Mjc4MTMsImV4cCI6MjA5MDAwMzgxM30.UGU_3OwlVkPZZylJPY3Wjl7WEe1-uNistfEmk5B_HUo',
};

function getSupabaseClient() {
  if (!window._supa) {
    if (!window.supabase) {
      console.error('SDK Supabase non chargé — vérifiez le CDN');
      return null;
    }
    const cfg = window.SIMPACT_CONFIG || _SUPA_DEFAULTS;
    window._supa = window.supabase.createClient(
      cfg.supabaseUrl || cfg.url,
      cfg.supabaseKey || cfg.key
    );
  }
  return window._supa;
}

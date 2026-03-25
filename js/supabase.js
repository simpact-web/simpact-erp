/* ═══════════════════════════════════════════════════════════════
   SIMPACT ERP — Client Supabase
   ═══════════════════════════════════════════════════════════════ */

const SUPA_URL = 'https://yqileqqxpihnyaauwmtr.supabase.co';
const SUPA_KEY = 'sb_publishable_TKDRwEdIAm8wKRYxPRc-IQ_GdkSWG59';

// Chargement dynamique du SDK Supabase depuis CDN
(function loadSupabaseSDK() {
  if (window.supabase) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.async = false;
  document.head.appendChild(script);
})();

// Attendre que le SDK soit chargé avant d'initialiser
function getSupabaseClient() {
  if (!window._supa) {
    if (!window.supabase) {
      console.error('Supabase SDK non chargé');
      return null;
    }
    window._supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  }
  return window._supa;
}

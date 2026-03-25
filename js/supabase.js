/* ═══════════════════════════════════════════════════════════════
   SIMPACT ERP — Client Supabase
   Le SDK est chargé via <script> dans chaque HTML avant ce fichier
   ═══════════════════════════════════════════════════════════════ */

const SUPA_URL = 'https://yqileqqxpihnyaauwmtr.supabase.co';
const SUPA_KEY = 'sb_publishable_TKDRwEdIAm8wKRYxPRc-IQ_GdkSWG59';

function getSupabaseClient() {
  if (!window._supa) {
    if (!window.supabase) { console.error('SDK Supabase non chargé'); return null; }
    window._supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  }
  return window._supa;
}

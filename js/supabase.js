/* ═══════════════════════════════════════════════════════════════
   SIMPACT ERP — Client Supabase
   ═══════════════════════════════════════════════════════════════ */

const SUPA_URL = 'https://yqileqgxpihnyaauwmtr.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxaWxlcWd4cGlobnlhYXV3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Mjc4MTMsImV4cCI6MjA5MDAwMzgxM30.UGU_3OwlVkPZZylJPY3Wjl7WEe1-uNistfEmk5B_HUo';

function getSupabaseClient() {
  if (!window._supa) {
    if (!window.supabase) { console.error('SDK Supabase non chargé'); return null; }
    window._supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  }
  return window._supa;
}

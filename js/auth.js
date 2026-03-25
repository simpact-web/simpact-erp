/* ═══════════════════════════════════════════════════════════════
   SIMPACT ERP v5.0 — Authentification (Supabase + fallback local)
   ═══════════════════════════════════════════════════════════════ */

// ── Comptes de secours (si Supabase inaccessible) ────────────────
const USERS_FALLBACK = [
  { id:"u001", username:"youssef",    password:"simpact2024", name:"Youssef",                       role:"superadmin", avatar:"YB", email:"direction@simpact.tn",  permissions:["all"],            client_id:null },
  { id:"u002", username:"production", password:"prod2024",    name:"Équipe Production",              role:"team",       avatar:"EP", email:"production@simpact.tn", permissions:["orders","stock","dashboard"], client_id:null },
  { id:"u003", username:"commercial", password:"com2024",     name:"Commercial",                     role:"team",       avatar:"CM", email:"commercial@simpact.tn", permissions:["orders","clients","configurator","dashboard"], client_id:null },
  { id:"u004", username:"stb",        password:"stb2024",     name:"STB — Société Tunisienne de Banque", role:"client", avatar:"ST", email:"commandes@stb.tn",     permissions:["client-portal"],  client_id:"c001" },
  { id:"u005", username:"biat",       password:"biat2024",    name:"BIAT",                           role:"client",     avatar:"BI", email:"print@biat.com.tn",     permissions:["client-portal"],  client_id:"c002" },
  { id:"u006", username:"star",       password:"star2024",    name:"STAR Assurances",                role:"client",     avatar:"SA", email:"print@star.com.tn",     permissions:["client-portal"],  client_id:"c003" },
];

const SIMPACT_AUTH = {

  ROLE_REDIRECT: {
    superadmin: "dashboard.html",
    team:       "dashboard.html",
    client:     "client-portal.html"
  },

  // ── Login : essaie Supabase, replie sur fallback ─────────────
  async login(username, password) {
    const uname = (username || "").trim().toLowerCase();
    const pwd   = (password || "").trim();

    let user = null;

    // 1. Essayer Supabase
    try {
      const supa = getSupabaseClient();
      if (supa) {
        const { data, error } = await supa
          .from("utilisateurs")
          .select("*")
          .eq("username", uname)
          .eq("password", pwd)
          .single();
        if (!error && data) user = data;
      }
    } catch(e) {
      console.warn("Supabase inaccessible, utilisation du fallback local:", e.message);
    }

    // 2. Fallback local si Supabase a échoué
    if (!user) {
      user = USERS_FALLBACK.find(u => u.username === uname && u.password === pwd) || null;
    }

    if (!user) return { success: false, error: "Identifiants incorrects" };

    const session = {
      userId:      user.id,
      name:        user.name,
      role:        user.role,
      avatar:      user.avatar,
      email:       user.email,
      permissions: user.permissions || [],
      clientId:    user.client_id || null,
      loginAt:     new Date().toISOString()
    };

    localStorage.setItem("simpact_session", JSON.stringify(session));
    return { success: true, user: session, redirect: this.ROLE_REDIRECT[user.role] };
  },

  // ── Session courante ─────────────────────────────────────────
  getSession() {
    try {
      const raw = localStorage.getItem("simpact_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // ── Vérifier auth (sync — lit le localStorage) ───────────────
  requireAuth(allowedRoles = []) {
    const session = this.getSession();
    if (!session) {
      window.location.href = "index.html";
      return null;
    }
    if (allowedRoles.length && !allowedRoles.includes(session.role)) {
      this.redirectToHome(session.role);
      return null;
    }
    return session;
  },

  logout() {
    localStorage.removeItem("simpact_session");
    window.location.href = "index.html";
  },

  redirectToHome(role) {
    window.location.href = this.ROLE_REDIRECT[role] || "index.html";
  },

  renderUserChip(session) {
    const chip = document.getElementById("user-chip");
    if (!chip || !session) return;
    const roleLabels = { superadmin:"Super Admin", team:"Équipe Interne", client:"Client" };
    chip.innerHTML = `
      <div class="user-avatar">${session.avatar || session.name[0]}</div>
      <div class="user-info">
        <div class="user-name">${session.name}</div>
        <div class="user-role">${roleLabels[session.role] || session.role}</div>
      </div>`;
    chip.onclick = () => { if (confirm("Se déconnecter ?")) this.logout(); };
  },

  setActiveNav(pageId) {
    document.querySelectorAll(".nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.page === pageId);
    });
  }
};

// ── Toast ─────────────────────────────────────────────────────────
function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const icons  = { success:"✓", error:"✕", warning:"⚠", info:"ℹ" };
  const colors = { success:"var(--success)", error:"var(--danger)", warning:"var(--warning)", info:"var(--info)" };
  const toast  = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="font-size:16px;color:${colors[type]}">${icons[type]}</span>
    <span style="font-size:13px;color:var(--text-primary)">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function openModal(htmlContent) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${htmlContent}</div>`;
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal(overlay) {
  overlay.style.animation = "fadeIn 0.15s ease reverse";
  setTimeout(() => overlay.remove(), 150);
}

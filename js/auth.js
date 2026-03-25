/* ═══════════════════════════════════════════════════════════════
   SIMPACT ERP v5.0 — Authentification Supabase
   ═══════════════════════════════════════════════════════════════ */

const SIMPACT_AUTH = {

  ROLE_REDIRECT: {
    superadmin: "dashboard.html",
    team:       "dashboard.html",
    client:     "client-portal.html"
  },

  async login(username, password) {
    const user = await DB.getUserByCredentials(username, password);
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

  getSession() {
    try {
      const raw = localStorage.getItem("simpact_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  requireAuth(allowedRoles = []) {
    const session = this.getSession();
    if (!session) { window.location.href = "index.html"; return null; }
    if (allowedRoles.length && !allowedRoles.includes(session.role)) {
      this.redirectToHome(session.role); return null;
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

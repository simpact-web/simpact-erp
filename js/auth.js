/* ═══════════════════════════════════════════════════════
   SIMPACT ERP v4.0 — Authentification & Gestion des rôles
   ═══════════════════════════════════════════════════════ */

const SIMPACT_AUTH = {

  // ── Comptes utilisateurs ────────────────────────────────
  USERS: [
    {
      id: "u001",
      username: "youssef",
      password: "simpact2024",
      name: "Youssef",
      role: "superadmin",
      avatar: "YB",
      email: "direction@simpact.tn",
      permissions: ["all"]
    },
    {
      id: "u002",
      username: "production",
      password: "prod2024",
      name: "Équipe Production",
      role: "team",
      avatar: "EP",
      email: "production@simpact.tn",
      permissions: ["orders", "stock", "dashboard"]
    },
    {
      id: "u003",
      username: "commercial",
      password: "com2024",
      name: "Commercial",
      role: "team",
      avatar: "CM",
      email: "commercial@simpact.tn",
      permissions: ["orders", "clients", "configurator", "dashboard"]
    },
    {
      id: "u004",
      username: "stb",
      password: "stb2024",
      name: "STB — Société Tunisienne de Banque",
      role: "client",
      avatar: "ST",
      email: "commandes@stb.tn",
      permissions: ["client-portal"],
      clientId: "c001"
    },
    {
      id: "u005",
      username: "biat",
      password: "biat2024",
      name: "BIAT",
      role: "client",
      avatar: "BI",
      email: "print@biat.com.tn",
      permissions: ["client-portal"],
      clientId: "c002"
    },
    {
      id: "u006",
      username: "star",
      password: "star2024",
      name: "STAR Assurances",
      role: "client",
      avatar: "SA",
      email: "print@star.com.tn",
      permissions: ["client-portal"],
      clientId: "c003"
    }
  ],

  // ── Redirections par rôle ───────────────────────────────
  ROLE_REDIRECT: {
    superadmin: "dashboard.html",
    team:       "dashboard.html",
    client:     "client-portal.html"
  },

  // ── Login ───────────────────────────────────────────────
  login(username, password) {
    const user = this.USERS.find(
      u => u.username === username.toLowerCase() && u.password === password
    );
    if (!user) return { success: false, error: "Identifiants incorrects" };

    const session = {
      userId:   user.id,
      name:     user.name,
      role:     user.role,
      avatar:   user.avatar,
      email:    user.email,
      permissions: user.permissions,
      clientId: user.clientId || null,
      loginAt:  new Date().toISOString()
    };

    localStorage.setItem("simpact_session", JSON.stringify(session));
    return { success: true, user: session, redirect: this.ROLE_REDIRECT[user.role] };
  },

  // ── Récupérer la session courante ───────────────────────
  getSession() {
    try {
      const raw = localStorage.getItem("simpact_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // ── Vérifier si connecté (avec redirect si non) ─────────
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

  // ── Déconnexion ─────────────────────────────────────────
  logout() {
    localStorage.removeItem("simpact_session");
    window.location.href = "index.html";
  },

  // ── Redirect selon rôle ─────────────────────────────────
  redirectToHome(role) {
    window.location.href = this.ROLE_REDIRECT[role] || "index.html";
  },

  // ── Injecter le profil user dans le topbar ──────────────
  renderUserChip(session) {
    const chip = document.getElementById("user-chip");
    if (!chip || !session) return;

    const roleLabels = { superadmin: "Super Admin", team: "Équipe Interne", client: "Client" };
    chip.innerHTML = `
      <div class="user-avatar">${session.avatar}</div>
      <div class="user-info">
        <div class="user-name">${session.name}</div>
        <div class="user-role">${roleLabels[session.role] || session.role}</div>
      </div>
    `;
    chip.onclick = () => {
      if (confirm("Se déconnecter ?")) SIMPACT_AUTH.logout();
    };
  },

  // ── Marquer le nav item actif ───────────────────────────
  setActiveNav(pageId) {
    document.querySelectorAll(".nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.page === pageId);
    });
  }
};

// ── Toast helper (disponible globalement) ───────────────────
function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
  const colors = { success: "var(--success)", error: "var(--danger)", warning: "var(--warning)", info: "var(--info)" };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="font-size:16px;color:${colors[type]}">${icons[type]}</span>
    <span style="font-size:13px;color:var(--text-primary)">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Modal helper ────────────────────────────────────────────
function openModal(htmlContent) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${htmlContent}</div>`;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal(overlay) {
  overlay.style.animation = "fadeIn 0.15s ease reverse";
  setTimeout(() => overlay.remove(), 150);
}

/* ═══════════════════════════════════════════════════════
   SIMPACT ERP v4.0 — Système de messagerie interne
   ═══════════════════════════════════════════════════════ */

const MSG = {

  KEY: "simpact_messages",

  // ── Lire tous les messages ──────────────────────────────
  getAll() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },

  // ── Sauvegarder ─────────────────────────────────────────
  save(messages) {
    localStorage.setItem(this.KEY, JSON.stringify(messages));
  },

  // ── Envoyer un message ──────────────────────────────────
  send({ fromId, fromName, fromRole, toId, toName, toRole, subject, body, attachment = null, type = "message" }) {
    const messages = this.getAll();
    const msg = {
      id:        "msg-" + Date.now(),
      fromId, fromName, fromRole,
      toId,   toName,   toRole,
      subject, body,
      attachment,       // { name, size, data (base64) }
      type,             // "message" | "auto"
      read:      false,
      createdAt: new Date().toISOString(),
    };
    messages.unshift(msg);
    this.save(messages);
    return msg;
  },

  // ── Messages reçus par un userId ────────────────────────
  getInbox(userId) {
    return this.getAll().filter(m => m.toId === userId);
  },

  // ── Messages envoyés par un userId ──────────────────────
  getSent(userId) {
    return this.getAll().filter(m => m.fromId === userId);
  },

  // ── Nb non lus pour un userId ───────────────────────────
  unreadCount(userId) {
    return this.getAll().filter(m => m.toId === userId && !m.read).length;
  },

  // ── Marquer comme lu ────────────────────────────────────
  markRead(msgId) {
    const messages = this.getAll();
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx !== -1) { messages[idx].read = true; this.save(messages); }
  },

  // ── Supprimer ───────────────────────────────────────────
  delete(msgId) {
    const messages = this.getAll().filter(m => m.id !== msgId);
    this.save(messages);
  },

  // ── Notification automatique livraison ─────────────────
  // Appelée quand une commande passe au statut "done"
  autoNotifyDelivery(order) {
    const stored = JSON.parse(localStorage.getItem("simpact_users_custom") || "null");
    const users  = (stored && stored.length) ? stored : (typeof SIMPACT_AUTH !== "undefined" ? SIMPACT_AUTH.USERS : []);
    const clientUser = users.find(u => u.clientId === order.clientId);
    if (!clientUser) return;
    const adminUser = users.find(u => u.role === "superadmin");

    this.send({
      fromId:   adminUser?.id   || "u001",
      fromName: adminUser?.name || "SIMPACT",
      fromRole: "superadmin",
      toId:     clientUser.id,
      toName:   clientUser.name,
      toRole:   "client",
      subject:  `✅ Votre commande ${order.id} est prête à être livrée`,
      body: `Bonjour,\n\nNous avons le plaisir de vous informer que votre commande est prête et disponible pour livraison.\n\n` +
            `📦 Référence : ${order.id}\n` +
            `🖨 Produit : ${order.product}\n` +
            `📊 Quantité : ${(order.qty||0).toLocaleString("fr-FR")} exemplaires\n` +
            `💰 Montant HT : ${(order.priceHT||0).toFixed(2)} DT\n\n` +
            `Notre équipe vous contactera sous peu pour organiser la livraison ou la mise à disposition.\n\n` +
            `Cordialement,\nL'équipe SIMPACT`,
      type: "auto",
    });
  },

  // ── Liste des destinataires disponibles selon le rôle ──
  getRecipientsFor(senderRole, senderId) {
    // Bug 6 fix : fallback sur SIMPACT_AUTH.USERS si le localStorage n'est pas encore initialisé
    const stored = JSON.parse(localStorage.getItem("simpact_users_custom") || "null");
    const users  = (stored && stored.length) ? stored : (typeof SIMPACT_AUTH !== "undefined" ? SIMPACT_AUTH.USERS : []);
    const base   = users.filter(u => u.id !== senderId);

    if (senderRole === "superadmin") return base;

    if (senderRole === "team") {
      return base.filter(u => u.role === "superadmin" || u.role === "client");
    }

    if (senderRole === "client") {
      return base.filter(u => u.role === "superadmin" || u.role === "team");
    }

    return [];
  },

  // ── Formatage date ───────────────────────────────────────
  fmtDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60)     return "À l'instant";
    if (diff < 3600)   return `Il y a ${Math.floor(diff/60)}min`;
    if (diff < 86400)  return `Il y a ${Math.floor(diff/3600)}h`;
    if (diff < 604800) return d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
    return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"});
  },

  // ── Données de démo ──────────────────────────────────────
  initDemoMessages() {
    if (this.getAll().length) return;
    const stored = JSON.parse(localStorage.getItem("simpact_users_custom") || "null");
    const users  = (stored && stored.length) ? stored : (typeof SIMPACT_AUTH !== "undefined" ? SIMPACT_AUTH.USERS : []);
    if (!users.length) return;

    const findId = role => users.find(u => u.role === role)?.id || "";
    const adminId = findId("superadmin");
    const teamId  = users.find(u => u.role === "team")?.id || "";
    const clientId= users.find(u => u.role === "client")?.id || "";
    const cName   = users.find(u => u.role === "client")?.name || "STB";

    if (!adminId) return;

    const demoMsgs = [
      {
        id:"msg-demo-1", fromId:clientId, fromName:cName, fromRole:"client",
        toId:adminId, toName:"Youssef", toRole:"superadmin",
        subject:"Question sur la commande CMD-0002", read:false, type:"message",
        body:"Bonjour,\n\nPourriez-vous me confirmer le délai de livraison pour la commande CMD-0002 ?\nNous en avons besoin pour le 20 du mois.\n\nCordialement",
        attachment:null, createdAt: new Date(Date.now()-7200000).toISOString(),
      },
      {
        id:"msg-demo-2", fromId:teamId, fromName:"Équipe Production", fromRole:"team",
        toId:adminId, toName:"Youssef", toRole:"superadmin",
        subject:"⚠ Stock couché brillant 350g en dessous du seuil",
        read:false, type:"message",
        body:"Bonjour,\n\nLe stock de couché brillant 350g est passé sous le seuil d'alerte (720 feuilles restantes, seuil : 1000).\n\nMerci de valider une commande fournisseur.\n\nÉquipe Production",
        attachment:null, createdAt: new Date(Date.now()-3600000).toISOString(),
      },
      {
        id:"msg-demo-3", fromId:adminId, fromName:"Youssef", fromRole:"superadmin",
        toId:clientId, toName:cName, toRole:"client",
        subject:"BAT disponible — CMD-0003 Brochures STAR", read:true, type:"message",
        body:"Bonjour,\n\nLe bon à tirer de votre commande CMD-0003 (Brochures A4 16 pages) est prêt.\nVeuillez le valider pour que nous puissions lancer l'impression.\n\nCordialement,\nYoussef — SIMPACT",
        attachment:null, createdAt: new Date(Date.now()-86400000).toISOString(),
      },
    ];

    this.save(demoMsgs);
  },
};

// Auto-init démo si nécessaire (appelé depuis chaque page)
document.addEventListener("DOMContentLoaded", () => {
  // Lancer après un tick pour laisser auth.js initialiser SIMPACT_AUTH
  setTimeout(() => MSG.initDemoMessages(), 50);
});

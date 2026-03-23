/* ═══════════════════════════════════════════════════════
   SIMPACT ERP v4.0 — Couche de données (localStorage)
   ═══════════════════════════════════════════════════════ */

const DB = {

  // ── Clés de stockage ────────────────────────────────────
  KEYS: {
    orders:   "simpact_orders",
    clients:  "simpact_clients",
    stock:    "simpact_stock",
    products: "simpact_products",
    pricing:  "simpact_pricing",
  },

  // ── Lecture / Écriture générique ─────────────────────────
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; }
    catch { return null; }
  },
  set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  },
  push(key, item) {
    const list = this.get(key) || [];
    list.push(item);
    this.set(key, list);
    return item;
  },
  update(key, id, changes) {
    const list = this.get(key) || [];
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...changes, updatedAt: new Date().toISOString() };
    this.set(key, list);
    return list[idx];
  },
  remove(key, id) {
    const list = this.get(key) || [];
    const filtered = list.filter(i => i.id !== id);
    this.set(key, filtered);
  },

  // ── ID auto-incrémenté ───────────────────────────────────
  nextId(prefix) {
    const counter = parseInt(localStorage.getItem(`simpact_id_${prefix}`) || "0") + 1;
    localStorage.setItem(`simpact_id_${prefix}`, counter);
    return `${prefix}-${String(counter).padStart(4, "0")}`;
  },

  // ════════════════════════════════════════════════════════
  // CLIENTS
  // ════════════════════════════════════════════════════════
  getClients()        { return this.get(this.KEYS.clients) || []; },
  getClient(id)       { return this.getClients().find(c => c.id === id) || null; },
  saveClient(client)  { return this.push(this.KEYS.clients, { ...client, createdAt: new Date().toISOString() }); },
  updateClient(id, c) { return this.update(this.KEYS.clients, id, c); },

  // ════════════════════════════════════════════════════════
  // COMMANDES
  // ════════════════════════════════════════════════════════
  getOrders(filters = {}) {
    let orders = this.get(this.KEYS.orders) || [];
    if (filters.clientId) orders = orders.filter(o => o.clientId === filters.clientId);
    if (filters.status)   orders = orders.filter(o => o.status === filters.status);
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  getOrder(id)        { return this.getOrders().find(o => o.id === id) || null; },
  createOrder(data)   {
    const order = {
      id: this.nextId("CMD"),
      ...data,
      status: "received",
      timeline: [{ status: "received", at: new Date().toISOString(), note: "Commande reçue" }],
      createdAt: new Date().toISOString(),
    };
    return this.push(this.KEYS.orders, order);
  },
  updateOrderStatus(id, status, note = "") {
    const order = this.getOrder(id);
    if (!order) return null;
    const timeline = order.timeline || [];
    timeline.push({ status, at: new Date().toISOString(), note });
    return this.update(this.KEYS.orders, id, { status, timeline });
  },

  // ════════════════════════════════════════════════════════
  // STOCKS PAPIER
  // ════════════════════════════════════════════════════════
  getStock()        { return this.get(this.KEYS.stock) || []; },
  getStockItem(id)  { return this.getStock().find(s => s.id === id) || null; },
  addStockMovement(stockId, type, qty, note = "") {
    const item = this.getStockItem(stockId);
    if (!item) return null;
    const newQty = type === "in" ? item.qty + qty : item.qty - qty;
    const movement = { type, qty, note, at: new Date().toISOString(), balanceAfter: newQty };
    const history = item.history || [];
    history.push(movement);
    return this.update(this.KEYS.stock, stockId, { qty: newQty, history });
  },

  // ════════════════════════════════════════════════════════
  // GRILLE TARIFAIRE (configurateur)
  // ════════════════════════════════════════════════════════
  getPricing()      { return this.get(this.KEYS.pricing) || null; },
  savePricing(data) { return this.set(this.KEYS.pricing, data); },

  // ════════════════════════════════════════════════════════
  // INITIALISATION DES DONNÉES DÉMO
  // ════════════════════════════════════════════════════════
  initDemoData() {
    if (this.get("simpact_initialized")) return;

    // Clients
    const clients = [
      { id: "c001", name: "STB — Société Tunisienne de Banque", sector: "Banque", contact: "Ahmed Mansour", email: "commandes@stb.tn", phone: "+216 71 340 477", address: "Rue Hedi Nouira, Tunis", tva: "TN123456A", remise: 5, userId: "u004" },
      { id: "c002", name: "BIAT", sector: "Banque", contact: "Sonia Trabelsi", email: "print@biat.com.tn", phone: "+216 71 340 000", address: "Avenue Habib Bourguiba, Tunis", tva: "TN654321B", remise: 8, userId: "u005" },
      { id: "c003", name: "STAR Assurances", sector: "Assurance", contact: "Karim Belhaj", email: "print@star.com.tn", phone: "+216 71 188 100", address: "Avenue de la Liberté, Tunis", tva: "TN789012C", remise: 5, userId: "u006" },
      { id: "c004", name: "Tunisie Assurance", sector: "Assurance", contact: "Nadia Ferchichi", email: "logistique@tunisie-assurance.com.tn", phone: "+216 71 340 900", address: "Avenue de Paris, Tunis", tva: "TN345678D", remise: 3, userId: null },
      { id: "c005", name: "BNA — Banque Nationale Agricole", sector: "Banque", contact: "Mehdi Gharbi", email: "bna.print@bna.com.tn", phone: "+216 71 831 000", address: "Rue Hedi Chaker, Tunis", tva: "TN901234E", remise: 6, userId: null },
    ];
    this.set(this.KEYS.clients, clients);

    // Stocks papier
    const stock = [
      { id: "s001", name: "Couché Mat 350g", format: "SRA3 (320×450mm)", supplier: "Europapier", qty: 4500, unit: "feuilles", minAlert: 1000, price: 0.085, color: "#7a9ab8" },
      { id: "s002", name: "Couché Brillant 350g", format: "SRA3 (320×450mm)", supplier: "Europapier", qty: 720, unit: "feuilles", minAlert: 1000, price: 0.082, color: "#c9a84c" },
      { id: "s003", name: "Couché Mat 135g", format: "SRA3 (320×450mm)", supplier: "Sappi", qty: 8200, unit: "feuilles", minAlert: 2000, price: 0.038, color: "#3dba78" },
      { id: "s004", name: "Couché Brillant 135g", format: "SRA3 (320×450mm)", supplier: "Sappi", qty: 6100, unit: "feuilles", minAlert: 2000, price: 0.036, color: "#3dba78" },
      { id: "s005", name: "Offset Blanc 90g", format: "A4 (210×297mm)", supplier: "Navigator", qty: 15000, unit: "feuilles", minAlert: 3000, price: 0.018, color: "#4a9fd4" },
      { id: "s006", name: "Soft Touch 400g", format: "SRA3 (320×450mm)", supplier: "Arjowiggins", qty: 280, unit: "feuilles", minAlert: 500, price: 0.21, color: "#e05050" },
    ];
    this.set(this.KEYS.stock, stock);

    // Commandes démo
    const now = new Date();
    const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

    const orders = [
      {
        id: "CMD-0001",
        clientId: "c001", clientName: "STB",
        product: "Cartes de visite", qty: 2000,
        specs: { format: "85×54mm", paper: "350g Couché Mat", color: "4/4", finitions: ["Pelliculage Mat"] },
        priceHT: 110, priceTTC: 130.9,
        status: "done",
        timeline: [
          { status: "received",   at: daysAgo(12), note: "Commande reçue par email" },
          { status: "bat",        at: daysAgo(11), note: "BAT envoyé au client" },
          { status: "production", at: daysAgo(10), note: "BAT validé — lancement production" },
          { status: "done",       at: daysAgo(8),  note: "Livraison effectuée" }
        ],
        createdAt: daysAgo(12)
      },
      {
        id: "CMD-0002",
        clientId: "c002", clientName: "BIAT",
        product: "Flyers A4", qty: 5000,
        specs: { format: "A4 210×297mm", paper: "135g Couché Brillant", color: "4/4", finitions: [] },
        priceHT: 260, priceTTC: 309.4,
        status: "production",
        timeline: [
          { status: "received",   at: daysAgo(5), note: "Commande reçue via portail" },
          { status: "bat",        at: daysAgo(4), note: "BAT envoyé au client" },
          { status: "production", at: daysAgo(2), note: "BAT validé — en cours d'impression" }
        ],
        createdAt: daysAgo(5)
      },
      {
        id: "CMD-0003",
        clientId: "c003", clientName: "STAR Assurances",
        product: "Brochures A4 16 pages", qty: 500,
        specs: { format: "A4 agrafé 16p", paper: "Couv 300g + Int 135g Mat", color: "4/4", finitions: ["Pelliculage Mat (couverture)"] },
        priceHT: 290, priceTTC: 345.1,
        status: "bat",
        timeline: [
          { status: "received", at: daysAgo(3), note: "Commande reçue" },
          { status: "bat",      at: daysAgo(1), note: "BAT en attente de validation client" }
        ],
        createdAt: daysAgo(3)
      },
      {
        id: "CMD-0004",
        clientId: "c004", clientName: "Tunisie Assurance",
        product: "Enveloppes DL", qty: 2500,
        specs: { format: "DL 110×220mm", paper: "90g Blanc offset", color: "4/0", finitions: [] },
        priceHT: 220, priceTTC: 261.8,
        status: "received",
        timeline: [
          { status: "received", at: daysAgo(1), note: "Nouvelle commande" }
        ],
        createdAt: daysAgo(1)
      },
      {
        id: "CMD-0005",
        clientId: "c001", clientName: "STB",
        product: "Affiches A2", qty: 100,
        specs: { format: "A2 420×594mm", paper: "170g Couché Mat", color: "4/0", finitions: ["Pelliculage Brillant"] },
        priceHT: 156, priceTTC: 185.6,
        status: "done",
        timeline: [
          { status: "received",   at: daysAgo(20), note: "Commande reçue" },
          { status: "bat",        at: daysAgo(19), note: "BAT envoyé" },
          { status: "production", at: daysAgo(18), note: "En production" },
          { status: "done",       at: daysAgo(16), note: "Livré" }
        ],
        createdAt: daysAgo(20)
      },
    ];
    this.set(this.KEYS.orders, orders);
    localStorage.setItem("simpact_id_CMD", "5");
    localStorage.setItem("simpact_initialized", "1");
  }
};

// Initialisation automatique au chargement
document.addEventListener("DOMContentLoaded", () => DB.initDemoData());

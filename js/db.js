/* ═══════════════════════════════════════════════════════════════
   SIMPACT ERP v5.0 — Couche de données Supabase (async)
   Remplace data.js — même interface, même nommage, 100% Supabase
   ═══════════════════════════════════════════════════════════════

   RÈGLES RLS SUPABASE — À activer dans le Dashboard Supabase
   (Authentication → Policies) pour chaque table :

   TABLE clients — Un client ne voit que ses propres données :
     ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
     CREATE POLICY "acces_client_propre" ON clients
       FOR ALL USING (
         auth.uid()::text = user_id
         OR (auth.jwt() ->> 'role') = 'service_role'
       );

   TABLE commandes — Un client ne voit que ses commandes :
     ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
     CREATE POLICY "acces_commandes_client" ON commandes
       FOR ALL USING (
         client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()::text)
         OR (auth.jwt() ->> 'role') = 'service_role'
       );

   TABLE utilisateurs — Accès réservé au rôle service_role :
     ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
     CREATE POLICY "admin_seulement_utilisateurs" ON utilisateurs
       FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

   TABLE params_couts — Accès réservé au rôle service_role :
     ALTER TABLE params_couts ENABLE ROW LEVEL SECURITY;
     CREATE POLICY "admin_seulement_params" ON params_couts
       FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role');

   Note : la messagerie (MSG) utilise localStorage — pas de table Supabase.
   Note : la clé anon (SIMPACT_CONFIG.supabaseKey) est publique par nature.
   Les politiques RLS sont la principale ligne de défense côté données.
   ═══════════════════════════════════════════════════════════════ */

const DB = {

  // ── Raccourci client ─────────────────────────────────────────
  get supa() { return getSupabaseClient(); },

  // ── Générer un ID commande CMD-XXXX ─────────────────────────
  async nextOrderId() {
    // Essayer la séquence RPC, replier sur le max existant
    try {
      const { data, error } = await this.supa
        .rpc('nextval', { seq_name: 'commandes_seq' })
        .single();
      if (!error && data) return `CMD-${String(data).padStart(4, '0')}`;
    } catch { /* RPC indisponible — on continue */ }

    // Repli : lire le dernier ID en base
    try {
      const { data: rows } = await this.supa
        .from('commandes')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);
      const lastNum = rows?.[0]?.id
        ? parseInt(rows[0].id.replace('CMD-', ''), 10) + 1
        : 1;
      return `CMD-${String(lastNum).padStart(4, '0')}`;
    } catch {
      return `CMD-${String(Date.now()).slice(-4)}`;
    }
  },

  // ════════════════════════════════════════════════════════════
  // UTILISATEURS
  // ════════════════════════════════════════════════════════════

  async getUsers() {
    const { data, error } = await this.supa.from('utilisateurs').select('*');
    if (error) { console.error('getUsers:', error); return []; }
    return data || [];
  },

  async getUserByCredentials(username, password) {
    const { data, error } = await this.supa
      .from('utilisateurs')
      .select('*')
      .eq('username', username.toLowerCase())
      .eq('password', password)
      .single();
    if (error) return null;
    return data || null;
  },

  async createUser(user) {
    const id = 'u' + Date.now();
    const { data, error } = await this.supa
      .from('utilisateurs')
      .insert({ ...user, id })
      .select()
      .single();
    if (error) { console.error('createUser:', error); return null; }
    return data;
  },

  async updateUser(id, changes) {
    const { data, error } = await this.supa
      .from('utilisateurs')
      .update(changes)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('updateUser:', error); return null; }
    return data;
  },

  async deleteUser(id) {
    const { error } = await this.supa.from('utilisateurs').delete().eq('id', id);
    if (error) { console.error('deleteUser:', error); return false; }
    return true;
  },

  // ════════════════════════════════════════════════════════════
  // CLIENTS
  // ════════════════════════════════════════════════════════════

  async getClients() {
    const { data, error } = await this.supa
      .from('clients')
      .select('*')
      .order('name');
    if (error) { console.error('getClients:', error); return []; }
    return data || [];
  },

  async getClient(id) {
    const { data, error } = await this.supa
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data || null;
  },

  async saveClient(client) {
    const id = client.id || ('c' + Date.now());
    const { data, error } = await this.supa
      .from('clients')
      .insert({ ...client, id })
      .select()
      .single();
    if (error) {
      console.error('saveClient error:', error);
      throw new Error(error.message || error.details || JSON.stringify(error));
    }
    return data;
  },

  async updateClient(id, changes) {
    const { data, error } = await this.supa
      .from('clients')
      .update(changes)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('updateClient:', error);
      throw new Error(error.message || error.details || JSON.stringify(error));
    }
    return data;
  },

  async deleteClient(id) {
    const { error } = await this.supa.from('clients').delete().eq('id', id);
    if (error) { console.error('deleteClient:', error); return false; }
    return true;
  },

  // ════════════════════════════════════════════════════════════
  // COMMANDES
  // ════════════════════════════════════════════════════════════

  async getOrders(filters = {}) {
    let query = this.supa
      .from('commandes')
      .select(`*, timeline:commande_timeline(*)`)
      .order('created_at', { ascending: false });

    if (filters.clientId) query = query.eq('client_id', filters.clientId);
    if (filters.status)   query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) { console.error('getOrders:', error); return []; }

    // Normaliser : timeline triée par date
    return (data || []).map(o => ({
      ...o,
      clientId: o.client_id,
      clientName: o.client_name,
      priceHT: o.price_ht,
      priceTTC: o.price_ttc,
      createdAt: o.created_at,
      timeline: (o.timeline || [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(t => ({ status: t.status, note: t.note, at: t.created_at }))
    }));
  },

  async getOrder(id) {
    const { data, error } = await this.supa
      .from('commandes')
      .select(`*, timeline:commande_timeline(*)`)
      .eq('id', id)
      .single();
    if (error) return null;
    if (!data) return null;
    return {
      ...data,
      clientId: data.client_id,
      clientName: data.client_name,
      priceHT: data.price_ht,
      priceTTC: data.price_ttc,
      createdAt: data.created_at,
      timeline: (data.timeline || [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(t => ({ status: t.status, note: t.note, at: t.created_at }))
    };
  },

  async createOrder(data) {
    try {
      const id = await this.nextOrderId();
      const row = {
        id,
        client_id:   data.clientId,
        client_name: data.clientName,
        product:     data.product,
        qty:         data.qty,
        specs:       data.specs || {},
        price_ht:    data.priceHT,
        price_ttc:   data.priceTTC,
        status:      'received',
        note:        data.note || '',
      };

      const { data: created, error } = await this.supa
        .from('commandes')
        .insert(row)
        .select()
        .single();
      if (error) throw error;

      // Insérer la première entrée timeline
      try {
        await this.supa.from('commande_timeline').insert({
          commande_id: id,
          status: 'received',
          note: 'Commande reçue'
        });
      } catch (tlErr) {
        console.warn('createOrder timeline:', tlErr);
      }

      return { ...created, clientId: created.client_id, clientName: created.client_name,
               priceHT: created.price_ht, priceTTC: created.price_ttc, createdAt: created.created_at,
               timeline: [{ status: 'received', note: 'Commande reçue', at: created.created_at }] };
    } catch (err) {
      console.error('createOrder:', err);
      return null;
    }
  },

  async updateOrderStatus(id, status, note = '') {
    // Mettre à jour le statut
    const { data: updated, error } = await this.supa
      .from('commandes')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('updateOrderStatus:', error); return null; }

    // Ajouter dans la timeline
    await this.supa.from('commande_timeline').insert({
      commande_id: id,
      status,
      note
    });

    return this.getOrder(id);
  },

  async updateOrder(id, changes) {
    const dbChanges = {};
    if (changes.status)   dbChanges.status    = changes.status;
    if (changes.note)     dbChanges.note      = changes.note;
    if (changes.specs)    dbChanges.specs     = changes.specs;
    if (changes.priceHT)  dbChanges.price_ht  = changes.priceHT;
    if (changes.priceTTC) dbChanges.price_ttc = changes.priceTTC;

    const { data, error } = await this.supa
      .from('commandes')
      .update(dbChanges)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('updateOrder:', error); return null; }
    return data;
  },

  async deleteOrder(id) {
    const { error } = await this.supa.from('commandes').delete().eq('id', id);
    if (error) { console.error('deleteOrder:', error); return false; }
    return true;
  },

  // ════════════════════════════════════════════════════════════
  // STOCKS
  // ════════════════════════════════════════════════════════════

  async getStock() {
    const { data, error } = await this.supa
      .from('stock')
      .select(`*, history:stock_mouvements(*)`)
      .order('name');
    if (error) { console.error('getStock:', error); return []; }
    return (data || []).map(s => ({
      ...s,
      minAlert: s.min_alert,
      history: (s.history || []).map(m => ({
        type: m.type, qty: m.qty, note: m.note,
        balanceAfter: m.balance_after, at: m.created_at
      }))
    }));
  },

  async getStockItem(id) {
    const { data, error } = await this.supa
      .from('stock')
      .select(`*, history:stock_mouvements(*)`)
      .eq('id', id)
      .single();
    if (error) return null;
    return {
      ...data,
      minAlert: data.min_alert,
      history: (data.history || []).map(m => ({
        type: m.type, qty: m.qty, note: m.note,
        balanceAfter: m.balance_after, at: m.created_at
      }))
    };
  },

  async saveStockItem(item) {
    const id = item.id || ('s' + Date.now());
    const { data, error } = await this.supa
      .from('stock')
      .insert({ ...item, id, min_alert: item.minAlert || 0 })
      .select()
      .single();
    if (error) { console.error('saveStockItem:', error); return null; }
    return data;
  },

  async updateStockItem(id, changes) {
    const dbChanges = { ...changes };
    if (changes.minAlert !== undefined) { dbChanges.min_alert = changes.minAlert; delete dbChanges.minAlert; }
    const { data, error } = await this.supa
      .from('stock')
      .update(dbChanges)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('updateStockItem:', error); return null; }
    return data;
  },

  async addStockMovement(stockId, type, qty, note = '') {
    const item = await this.getStockItem(stockId);
    if (!item) return null;
    const newQty = type === 'in' ? item.qty + qty : item.qty - qty;

    // Mettre à jour la quantité
    await this.supa.from('stock').update({ qty: newQty }).eq('id', stockId);

    // Enregistrer le mouvement
    await this.supa.from('stock_mouvements').insert({
      stock_id: stockId, type, qty, note, balance_after: newQty
    });

    return this.getStockItem(stockId);
  },

  async deleteStockItem(id) {
    const { error } = await this.supa.from('stock').delete().eq('id', id);
    if (error) { console.error('deleteStockItem:', error); return false; }
    return true;
  },

  // ════════════════════════════════════════════════════════════
  // MESSAGES
  // ════════════════════════════════════════════════════════════

  async getMessages(filters = {}) {
    let query = this.supa.from('messages').select('*').order('created_at', { ascending: false });
    if (filters.toId)   query = query.eq('to_id', filters.toId);
    if (filters.fromId) query = query.eq('from_id', filters.fromId);
    const { data, error } = await query;
    if (error) { console.error('getMessages:', error); return []; }
    return (data || []).map(m => ({
      ...m, fromId: m.from_id, fromName: m.from_name, fromRole: m.from_role,
      toId: m.to_id, toName: m.to_name, toRole: m.to_role, createdAt: m.created_at
    }));
  },

  async sendMessage({ fromId, fromName, fromRole, toId, toName, toRole, subject, body, attachment = null, type = 'message' }) {
    const id = 'msg-' + Date.now();
    const { data, error } = await this.supa
      .from('messages')
      .insert({ id, from_id: fromId, from_name: fromName, from_role: fromRole,
                to_id: toId, to_name: toName, to_role: toRole,
                subject, body, attachment, type, read: false })
      .select()
      .single();
    if (error) { console.error('sendMessage:', error); return null; }
    return data;
  },

  async markMessageRead(id) {
    const { error } = await this.supa.from('messages').update({ read: true }).eq('id', id);
    if (error) console.error('markMessageRead:', error);
  },

  async getMessage(id) {
    const { data, error } = await this.supa.from('messages').select('*').eq('id', id).single();
    if (error) return null;
    return { ...data, fromId: data.from_id, fromName: data.from_name, fromRole: data.from_role,
             toId: data.to_id, toName: data.to_name, toRole: data.to_role, createdAt: data.created_at };
  },

  async deleteMessage(id) {
    const { error } = await this.supa.from('messages').delete().eq('id', id);
    if (error) { console.error('deleteMessage:', error); return false; }
    return true;
  },

  async unreadCount(userId) {
    const { count, error } = await this.supa
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_id', userId)
      .eq('read', false);
    if (error) return 0;
    return count || 0;
  },

  // ════════════════════════════════════════════════════════════
  // PARAMÈTRES DE COÛTS
  // ════════════════════════════════════════════════════════════

  async getParams() {
    const { data, error } = await this.supa
      .from('params_couts')
      .select('*')
      .eq('id', 1)
      .single();
    if (error || !data) return null;
    return data.params;
  },

  async saveParams(params, updatedBy = 'Admin') {
    // Sauvegarder dans l'historique avant d'écraser
    const existing = await this.getParams();
    if (existing) {
      await this.supa.from('pricing_history').insert({
        params: existing, created_by: updatedBy, note: 'Sauvegarde automatique avant modification'
      });
    }

    const { data, error } = await this.supa
      .from('params_couts')
      .upsert({ id: 1, params, updated_by: updatedBy })
      .select()
      .single();
    if (error) { console.error('saveParams:', error); return null; }
    return data;
  },

  async getPricingHistory() {
    const { data, error } = await this.supa
      .from('pricing_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return [];
    return data || [];
  },

  // ════════════════════════════════════════════════════════════
  // STATISTIQUES (pour reporting)
  // ════════════════════════════════════════════════════════════

  async getStats() {
    const [orders, clients] = await Promise.all([
      this.getOrders(),
      this.getClients()
    ]);

    const ca = orders.reduce((s, o) => s + (o.priceHT || 0), 0);
    const caMonth = orders
      .filter(o => new Date(o.createdAt) > new Date(Date.now() - 30*86400000))
      .reduce((s, o) => s + (o.priceHT || 0), 0);

    const byStatus = {};
    orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

    const byProduct = {};
    orders.forEach(o => { byProduct[o.product] = (byProduct[o.product] || 0) + 1; });

    return { ca, caMonth, totalOrders: orders.length, byStatus, byProduct, totalClients: clients.length };
  },

};

// ── Compatibilité MSG (messaging) — wrapper async ──────────────
const MSG = {
  async send(opts)               { return DB.sendMessage(opts); },
  async get(id)                  { return DB.getMessage(id); },
  async getAll()                 { return DB.getMessages(); },
  async getInbox(userId)         { return DB.getMessages({ toId: userId }); },
  async getSent(userId)          { return DB.getMessages({ fromId: userId }); },
  async markRead(id)             { return DB.markMessageRead(id); },
  async delete(id)               { return DB.deleteMessage(id); },
  async unreadCount(userId)      { return DB.unreadCount(userId); },
  async getRecipientsFor(role, userId) {
    const users = await DB.getUsers();
    if (role === 'client') return users.filter(u => u.role === 'superadmin' || u.role === 'team');
    return users.filter(u => u.id !== userId);
  },
  fmtDate(iso) {
    return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
  },
  async autoNotifyDelivery(order) {
    const msg = {
      fromId: 'u001', fromName: 'SIMPACT', fromRole: 'superadmin',
      toId: order.clientId || order.client_id,
      toName: order.clientName || order.client_name,
      toRole: 'client',
      subject: `✅ Commande ${order.id} — Livrée`,
      body: `Votre commande ${order.id} (${order.product}, ${order.qty} ex.) a été livrée.\n\nMontant : ${order.priceHT || order.price_ht} DT HT — ${(order.priceHT || order.price_ht) * 1.19} DT TTC\n\nMerci pour votre confiance.\nSIMPACT`,
      type: 'auto'
    };
    return DB.sendMessage(msg);
  }
};

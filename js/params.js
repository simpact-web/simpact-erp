/* ═══════════════════════════════════════════════════════════════
   SIMPACT PARAMS v1.0  —  Paramètres de comptabilité analytique
   Utilisé par : pricing.js, configurator.html, couts.html
   Stockage    : localStorage → clé 'simpact_params'
   ═══════════════════════════════════════════════════════════════ */

const SIMPACT_PARAMS = (function () {

  /* ══════════════════════════════════════════════════
     VALEURS PAR DÉFAUT  (modifiables via couts.html)
     ══════════════════════════════════════════════════ */
  const DEFAULTS = {

    // ── Version / traçabilité ────────────────────────
    version:    '1.0',
    updatedAt:  '2026-03-24',
    updatedBy:  'Admin',

    // ── Main d'œuvre (commune aux 2 machines) ────────
    mo: {
      v1000: {
        operators:      2,          // nb opérateurs affectés V1000
        salaireGrut:    1100,       // DT brut mensuel/opérateur
        nbMois:         14,         // mois conventionnels (dont prime, congés)
        chargesPct:     26.25,      // % charges sociales patronales
        ppmMachine:     100,        // pages/min Canon V1000
        uptimePct:      65,         // % uptime annuel (exploitation réelle)
        heuresAn:       2000,       // heures travaillées / an
      },
      km2100: {
        operators:      1,          // opérateurs KM (partagé avec V1000)
        salaireGrut:    0,          // 0 car déjà compté dans V1000
        nbMois:         14,
        chargesPct:     26.25,
        ppmMachine:     160,        // pages/min KM AccurioPrint 2100
        uptimePct:      60,
        heuresAn:       1500,
      },
    },

    // ── Énergie (commune aux 2 machines) ─────────────
    energie: {
      dtParClickA4:   0.002,        // DT/click A4 — tarif STEG réel
    },

    // ── Coefficient terrain ───────────────────────────
    terrain: {
      v1000:          0.90,         // -10% rendement constructeur vs terrain
      km2100:         0.90,
    },

    // ── Consommables V1000 (source Azur Colors 05/03/2026)
    // Base DT/click A4 AVANT énergie et MO
    consoV1000: {
      cdv:    0.2281,   // cartes de visite — couverture toner ~30%
      fly:    0.2069,   // flyers — couverture ~20-25%
      bro:    0.1706,   // brochures — couverture ~15-20%
      aff:    0.2939,   // affiches — couverture ~40-50%
      dep:    0.1905,   // dépliants — couverture ~20%
      ent_cl: 0.1247,   // en-tête couleur — couverture ~12%
    },

    // ── Consommables KM AccurioPrint 2100 ────────────
    consoKM: {
      nb:     0.011,    // N&B — source SIMPACT terrain
    },

    // ── Prix papier DT/kg — fiches LPCT + CSP mars 2026
    papier: {
      coated: {
         90:  3.48,   // CSP 14/03 (assimilé 130g)
        115:  3.48,   // CSP 14/03
        135:  3.48,   // CSP 14/03
        170:  3.65,   // LPCT 24/03
        200:  3.48,   // CSP 14/03
        250:  3.65,   // LPCT 23/03
        300:  3.63,   // LPCT 12/03
        350:  3.75,   // LPCT 23/03 + 24/03
        400:  3.90,   // confirmé
      },
      offset: {
         80:  3.50,   // CSP 14/03
         90:  3.55,   // interpolé
        100:  3.60,   // interpolé
      },
    },

    // ── Finitions — DT/unité ─────────────────────────
    // t:"ps" = par feuille SRA3 nette  |  t:"pp" = par exemplaire  |  t:"pc" = par feuille couverture
    finitions: {
      pelliculage_mat:       { dt: 0.10, t: 'face_sra3',  label: 'Pelliculage Mat' },
      pelliculage_brillant:  { dt: 0.10, t: 'face_sra3',  label: 'Pelliculage Brillant' },
      coins_arrondis:        { dt: 0.020, t: 'piece',     label: 'Coins arrondis' },
      vernis_uv:             { dt: 0.035, t: 'piece',     label: 'Vernis UV sélectif' },
      pliage:                { dt: 0.015, t: 'piece',     label: 'Pliage' },
      piqure_agrafes:        { dt: 0.08,  t: 'piece',     label: 'Piqûre agrafée' },
      reliure_spirale:       { dt: 0.45,  t: 'piece',     label: 'Reliure spirale' },
      dos_carre_colle:       { dt: 0.10,  t: 'piece',     label: 'Dos carré collé' },
      oeillet:               { dt: 0.050, t: 'piece',     label: 'Œillet (×4)' },
    },

    // ── Prépresse / Setup — DT fixe par job ──────────
    prepresse: {
      cdv:  12,   // cartes de visite
      fly:  10,   // flyers
      bro:  18,   // brochures
      aff:  15,   // affiches
      ent:   8,   // en-tête
      dep:  12,   // dépliants
      liv:  20,   // livres
    },

    // ── Marges commerciales ───────────────────────────
    marges: {
      cdv: {
        paliers:  [50,100,250,500,1000,2000],
        marges:   [0.40,0.42,0.45,0.47,0.48,0.48],
        defaut:   0.45,
      },
      fly: {
        paliers:  [50,100,250,500,1000,2000],
        marges:   [0.35,0.43,0.41,0.47,0.40,0.32],
        defaut:   0.41,
      },
      bro: {
        paliers:  [],
        marges:   [],
        defaut:   0.53,
      },
      aff: {
        paliers:  [],
        marges:   [],
        defaut:   0.64,
      },
      ent: {
        paliers:  [],
        marges:   [],
        defaut:   0.55,
      },
      dep: {
        paliers:  [25,50,100,200,500,1000,2000],
        marges:   [0.38,0.36,0.41,0.41,0.46,0.45,0.48],
        defaut:   0.41,
      },
      liv: {
        paliers:  [],
        marges:   [],
        defaut:   0.41,
      },
    },

    // ── Gâche ─────────────────────────────────────────
    gache: {
      // taux de gâche par tranche de quantité
      tranches: [
        { max: 499,  taux: 0.08 },   // < 500ex → 8%
        { max: 1999, taux: 0.05 },   // 500–1999ex → 5%
        { max: Infinity, taux: 0.03 }, // ≥ 2000ex → 3%
      ],
      minimum: 10,  // feuilles minimum
    },

  }; // fin DEFAULTS

  /* ══════════════════════════════════════════════════
     FONCTIONS UTILITAIRES
     ══════════════════════════════════════════════════ */

  function deepMerge(base, override) {
    if (typeof override !== 'object' || override === null) return base;
    const result = { ...base };
    for (const key in override) {
      if (key in base && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        result[key] = deepMerge(base[key], override[key]);
      } else if (override[key] !== undefined) {
        result[key] = override[key];
      }
    }
    return result;
  }

  function load() {
    try {
      const raw = localStorage.getItem('simpact_params');
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      const saved = JSON.parse(raw);
      return deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), saved);
    } catch (e) {
      console.warn('SIMPACT_PARAMS: erreur chargement, retour aux valeurs par défaut', e);
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function save(params, who) {
    const toSave = { ...params, updatedAt: new Date().toISOString().slice(0,10), updatedBy: who || 'Admin' };
    localStorage.setItem('simpact_params', JSON.stringify(toSave));
    return toSave;
  }

  function reset() {
    localStorage.removeItem('simpact_params');
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  /* ══════════════════════════════════════════════════
     CALCULS DÉRIVÉS (CPC calculé depuis les paramètres)
     ══════════════════════════════════════════════════ */

  function computeCPC(p) {
    const moV1000 = computeMO(p.mo.v1000);
    const moKM    = computeMO(p.mo.km2100);
    const E       = p.energie.dtParClickA4;
    const TV      = p.terrain.v1000;
    const TK      = p.terrain.km2100;
    const c       = p.consoV1000;
    const km      = p.consoKM;
    const cpc = {
      cdv:    +((c.cdv    + E + moV1000) * TV).toFixed(4),
      fly:    +((c.fly    + E + moV1000) * TV).toFixed(4),
      bro:    +((c.bro    + E + moV1000) * TV).toFixed(4),
      aff:    +((c.aff    + E + moV1000) * TV).toFixed(4),
      dep:    +((c.dep    + E + moV1000) * TV).toFixed(4),
      ent_cl: +((c.ent_cl + E + moV1000) * TV).toFixed(4),
      ent_nb: +((km.nb    + E + moKM   ) * TK).toFixed(4),
      liv_nb: +((km.nb    + E + moKM   ) * TK).toFixed(4),
    };
    return cpc;
  }

  function computeMO(mo_params) {
    const { operators, salaireGrut, nbMois, chargesPct, ppmMachine, uptimePct, heuresAn } = mo_params;
    if (operators === 0 || ppmMachine === 0) return 0;
    const masseSalariale = operators * salaireGrut * nbMois * (1 + chargesPct/100);
    const capaciteClicks = ppmMachine * (uptimePct/100) * heuresAn * 60; // clicks A4/an
    return masseSalariale / capaciteClicks;
  }

  function computeMODetails(mo_params) {
    const { operators, salaireGrut, nbMois, chargesPct, ppmMachine, uptimePct, heuresAn } = mo_params;
    const masseSalariale = operators * salaireGrut * nbMois * (1 + chargesPct/100);
    const capaciteClicks = ppmMachine * (uptimePct/100) * heuresAn * 60;
    const moPerClick = masseSalariale / capaciteClicks;
    return { masseSalariale, capaciteClicks, moPerClick };
  }

  /* ── Chargement initial ─────────────────────────── */
  const P = load();

  return {
    P,
    DEFAULTS,
    load,
    save,
    reset,
    deepMerge,
    computeCPC,
    computeMO,
    computeMODetails,
  };

})();

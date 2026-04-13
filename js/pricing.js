/* ═══════════════════════════════════════════════════════════════
   SIMPACT PRICING ENGINE v5.1
   Moteur de calcul — lit ses paramètres depuis SIMPACT_PARAMS
   Utilisé par : configurator.html, client-portal.html
   ═══════════════════════════════════════════════════════════════ */

const SIMPACT_PRICING = (function () {

  /* ── Paramètres dynamiques depuis SIMPACT_PARAMS ── */
  const P   = SIMPACT_PARAMS.P;
  const CPC = SIMPACT_PARAMS.computeCPC(P);
  const PKG = P.papier;
  const A4A = 0.210 * 0.297;

  const kp = (g, t) => (PKG[t] || PKG.coated)[g] || 3.50;

  /* ── Imposition ──────────────────────────────────── */
  function poses(pw, ph, sw, sh) {
    const B = 0.003, G = 0.002;
    const fw = pw + B*2 + G, fh = ph + B*2 + G;
    const p1 = Math.floor((sw+G)/fw) * Math.floor((sh+G)/fh);
    const p2 = Math.floor((sh+G)/fw) * Math.floor((sw+G)/fh);
    return { n: Math.max(p1, p2, 1), o: p1 >= p2 ? "normale" : "pivotée" };
  }

  /* ── Gâche ──────────────────────────────────────── */
  function waste(sNet, qty) {
    const tr = P.gache.tranches;
    const taux = (tr.find(t => qty <= t.max) || tr[tr.length-1]).taux;
    return Math.max(P.gache.minimum, Math.ceil(sNet * taux));
  }

  /* ── Arrondi HT ────────────────────────────────── */
  function roundHT(x) {
    if (x <= 0)   return 0;
    if (x < 10)   return Math.ceil(x);
    if (x < 100)  return Math.ceil(x / 2) * 2;
    if (x < 1000) return Math.ceil(x / 5) * 5;
    return Math.ceil(x / 10) * 10;
  }

  /* ── Marge par quantité ─────────────────────────── */
  function getMargin(p, qty) {
    const mp = P.marges[p.id];
    if (!mp || !mp.paliers.length) {
      // Repli sur la marge directe du produit
      if (!p.margins) return mp ? mp.defaut : p.margin;
      let idx = p.qty.length - 1;
      for (let i = 0; i < p.qty.length; i++) { if (qty <= p.qty[i]) { idx = i; break; } }
      return p.margins[idx];
    }
    let idx = mp.paliers.length - 1;
    for (let i = 0; i < mp.paliers.length; i++) { if (qty <= mp.paliers[i]) { idx = i; break; } }
    return mp.marges[idx] !== undefined ? mp.marges[idx] : mp.defaut;
  }

  function getSetup(p) {
    return P.prepresse[p.id] !== undefined ? P.prepresse[p.id] : p.setup;
  }

  /* ── Taux finitions depuis params ───────────────── */
  function finRate(finId) {
    const fin = P.finitions;
    const map = {
      pm: fin.pelliculage_mat.dt,
      pb: fin.pelliculage_brillant.dt,
      co: fin.coins_arrondis.dt,
      vu: fin.vernis_uv.dt,
      pl: fin.pliage.dt,
      piqure:  fin.piqure_agrafes.dt,
      spirale: fin.reliure_spirale.dt,
      dos:     fin.dos_carre_colle.dt,
      oe:      fin.oeillet.dt,
    };
    return map[finId] !== undefined ? map[finId] : null;
  }

  /* ════════════════════════════════════════════════════
     CATALOGUE PRODUITS
     ════════════════════════════════════════════════════ */
  const PRODS = [

    /* ── CARTES DE VISITE ─────────────────────────── */
    {
      id:"cdv", name:"Cartes de visite", icon:"▪", type:"std",
      formats:[
        {label:"85×55mm Standard", w:.085, h:.055, sheet:{w:.320,h:.450}, psOverride:20, noWaste:true},
        {label:"90×50mm Slim",     w:.090, h:.050, sheet:{w:.320,h:.450}},
        {label:"85×85mm Carré",    w:.085, h:.085, sheet:{w:.320,h:.450}},
      ],
      papers:[
        {id:"350m",label:"350g Couché Mat",      g:350, type:"coated"},
        {id:"350b",label:"350g Couché Brillant",  g:350, type:"coated"},
        {id:"400s",label:"400g Soft Touch",        g:400, type:"coated"},
      ],
      colors:[
        {id:"44",label:"Quadri R/V (4/4)",  sides:2, cpc:CPC.cdv},
        {id:"40",label:"Quadri recto (4/0)",sides:1, cpc:CPC.cdv},
        {id:"nb",label:"Noir & Blanc R/V",  sides:2, cpc:CPC.ent_nb},
      ],
      fins:[
        {id:"pm",label:"Pelliculage Mat",     t:"ps"},
        {id:"pb",label:"Pelliculage Brillant", t:"ps"},
        {id:"co",label:"Coins arrondis",       t:"pp"},
        {id:"vu",label:"Vernis UV sélectif",   t:"pp"},
      ],
      qty:   [50,100,250,500,1000,2000], setup:12,
    },

    /* ── FLYERS ────────────────────────────────────── */
    {
      id:"fly", name:"Flyers", icon:"◈", type:"std",
      formats:[
        {label:"A5 — 15×21 cm",    w:.150, h:.210, sheet:{w:.320,h:.450}},
        {label:"16×23 cm",          w:.160, h:.230, sheet:{w:.340,h:.480}},
        {label:"A4 — 21×29,7 cm",  w:.210, h:.297, sheet:{w:.320,h:.450}},
        {label:"A3 — 29,7×42 cm",  w:.297, h:.420, sheet:{w:.320,h:.450}},
        {label:"A3+ — 32×45 cm",   w:.320, h:.450, sheet:{w:.340,h:.480}},
      ],
      papers:[
        {id:"115m",label:"115g Couché Mat",      g:115, type:"coated"},
        {id:"135m",label:"135g Couché Mat",       g:135, type:"coated"},
        {id:"135b",label:"135g Couché Brillant",  g:135, type:"coated"},
        {id:"170m",label:"170g Couché Mat",        g:170, type:"coated"},
        {id:"170b",label:"170g Couché Brillant",   g:170, type:"coated"},
      ],
      colors:[
        {id:"44",label:"Quadri R/V (4/4)",  sides:2, cpc:CPC.fly},
        {id:"40",label:"Quadri recto (4/0)",sides:1, cpc:CPC.fly},
        {id:"nb",label:"Noir & Blanc R/V",  sides:2, cpc:CPC.ent_nb},
      ],
      fins:[
        {id:"pm",label:"Pelliculage Mat",     t:"ps"},
        {id:"pb",label:"Pelliculage Brillant", t:"ps"},
      ],
      qty:[50,100,250,500,1000,2000], setup:10,
    },

    /* ── BROCHURES ─────────────────────────────────── */
    {
      id:"bro", name:"Brochures A4", icon:"⊟", type:"booklet",
      formats:[
        {label:"A4",      piece:{w:.210,h:.297}},
        {label:"A5",      piece:{w:.150,h:.210}},
        {label:"16×23 cm",piece:{w:.160,h:.230}, sheet:{w:.330,h:.480}, psOverride:4},
      ],
      sheet:{w:.320, h:.450},
      bindings:[
        {id:"piqure", label:"Piqûre (agrafé)"},
        {id:"spirale",label:"Reliure spirale"},
        {id:"dos",    label:"Dos carré collé"},
      ],
      cPapers:[
        {id:"300m",label:"300g Couché Mat",       g:300, type:"coated"},
        {id:"300b",label:"300g Couché Brillant",  g:300, type:"coated"},
        {id:"350m",label:"350g Couché Mat",        g:350, type:"coated"},
        {id:"350b",label:"350g Couché Brillant",   g:350, type:"coated"},
        {id:"250m",label:"250g Couché Mat (Éco)",  g:250, type:"coated"},
      ],
      iPapers:[
        {id:"80o", label:"80g Offset",           g:80,  type:"offset"},
        {id:"90o", label:"90g Couché Mat",        g:90,  type:"coated"},
        {id:"90b", label:"90g Couché Brillant",   g:90,  type:"coated"},
        {id:"100o",label:"100g Offset",           g:100, type:"offset"},
        {id:"115m",label:"115g Couché Mat",       g:115, type:"coated"},
        {id:"115b",label:"115g Couché Brillant",  g:115, type:"coated"},
        {id:"135m",label:"135g Couché Mat",       g:135, type:"coated"},
        {id:"135b",label:"135g Couché Brillant",  g:135, type:"coated"},
        {id:"170m",label:"170g Couché Mat",       g:170, type:"coated"},
        {id:"170b",label:"170g Couché Brillant",  g:170, type:"coated"},
      ],
      covTypes:[
        {id:"rv",label:"Couverture R/V",   sides:2},
        {id:"r", label:"Couverture Recto", sides:1},
      ],
      colors:[
        {id:"44", label:"Quadri complet (4/4)",   cSides:2,iSides:2, cpcCov:CPC.bro,   cpcInt:CPC.bro},
        {id:"4nb",label:"Couv couleur + Int N&B",  cSides:2,iSides:2, cpcCov:CPC.bro,   cpcInt:CPC.liv_nb},
        {id:"nb", label:"Noir & Blanc intégral",   cSides:2,iSides:2, cpcCov:CPC.ent_nb, cpcInt:CPC.ent_nb},
      ],
      fins:[],
      qty:[25,50,100,250,500,1000], setup:18,
    },

    /* ── AFFICHES ──────────────────────────────────── */
    {
      id:"aff", name:"Affiches", icon:"⬜", type:"std",
      formats:[
        {label:"A3 (297×420mm)",  w:.297, h:.420, sheet:{w:.320,h:.450}},
        {label:"A3+ (320×450mm)", w:.320, h:.450, sheet:{w:.340,h:.480}},
      ],
      papers:[
        {id:"135m",label:"135g Couché Mat",             g:135, type:"coated"},
        {id:"135b",label:"135g Couché Brillant",         g:135, type:"coated"},
        {id:"170m",label:"170g Couché Mat",               g:170, type:"coated"},
        {id:"170b",label:"170g Couché Brillant",          g:170, type:"coated"},
        {id:"200b",label:"200g Couché Brillant Premium",  g:200, type:"coated"},
      ],
      colors:[
        {id:"40",label:"Quadri recto (4/0)", sides:1, cpc:CPC.aff},
        {id:"nb",label:"Noir & Blanc recto", sides:1, cpc:CPC.ent_nb},
      ],
      fins:[
        {id:"pm",label:"Pelliculage Mat",     t:"ps"},
        {id:"pb",label:"Pelliculage Brillant", t:"ps"},
        {id:"oe",label:"Œillets ×4",          t:"pp"},
      ],
      qty:[5,10,25,50,100,250], setup:15,
    },

    /* ── PAPIER EN-TÊTE ────────────────────────────── */
    {
      id:"ent", name:"Papier en-tête", icon:"📄", type:"std",
      formats:[{label:"A4 (210×297mm)", w:.210, h:.297, sheet:{w:.320,h:.450}}],
      papers:[
        {id:"100o",label:"100g Offset Premium", g:100, type:"offset"},
        {id:"80o", label:"80g Offset Standard",  g:80,  type:"offset"},
      ],
      colors:[
        {id:"40",label:"Quadri recto (4/0)", sides:1, cpc:CPC.ent_cl},
        {id:"nb",label:"Noir & Blanc",       sides:1, cpc:CPC.ent_nb},
        {id:"1c",label:"1 couleur Pantone",  sides:1, cpc:CPC.ent_nb},
      ],
      fins:[],
      qty:[25,50,100,200,500,1000,2000], setup:8,
    },

    /* ── DÉPLIANTS ─────────────────────────────────── */
    {
      id:"dep", name:"Dépliants", icon:"◱", type:"std",
      formats:[
        {
          label:"A5 (15×21 cm) — Pli simple · 2 volets",
          w:.150, h:.210, sheet:{w:.320,h:.450},
          foldType:"pli2", foldVolets:2,
          foldDesc:"Ouvert : A4 (21×30 cm) · 1 pli central · 4 faces",
        },
        {
          label:"A5 (15×21 cm) — Pli roulé · 3 volets",
          w:.150, h:.210, sheet:{w:.320,h:.450},
          foldType:"pli3r", foldVolets:3,
          foldDesc:"Ouvert : 21×45 cm · 2 plis, volet intérieur rentrant · 6 faces",
        },
        {
          label:"A5 (15×21 cm) — Pli accordéon · 3 volets",
          w:.150, h:.210, sheet:{w:.320,h:.450},
          foldType:"pli3a", foldVolets:3,
          foldDesc:"Ouvert : 21×45 cm · 2 plis alternés en Z · 6 faces",
        },
        {
          label:"16×23 cm — Pli roulé · 3 volets",
          w:.160, h:.230, sheet:{w:.340,h:.480},
          foldType:"pli3r", foldVolets:3,
          foldDesc:"Ouvert : 48×23 cm · 2 plis, format large · 6 faces",
        },
        {
          label:"A4 (21×29,7 cm) — Pli accordéon · 3 volets",
          w:.210, h:.297, sheet:{w:.320,h:.450},
          foldType:"pli3a", foldVolets:3,
          foldDesc:"Ouvert : A3 (63×29,7 cm) · 2 plis alternés · 6 faces",
        },
        {
          label:"A4 (21×29,7 cm) — Pli portefeuille · 4 volets",
          w:.210, h:.297, sheet:{w:.320,h:.450},
          foldType:"pli4", foldVolets:4,
          foldDesc:"Ouvert : 42×29,7 cm · 3 plis parallèles · 8 faces",
        },
      ],
      papers:[
        {id:"135m",label:"135g Couché Mat",      g:135, type:"coated"},
        {id:"135b",label:"135g Couché Brillant",  g:135, type:"coated"},
        {id:"170m",label:"170g Couché Mat",        g:170, type:"coated"},
        {id:"170b",label:"170g Couché Brillant",   g:170, type:"coated"},
        {id:"200m",label:"200g Couché Mat",         g:200, type:"coated"},
        {id:"250m",label:"250g Couché Mat",          g:250, type:"coated"},
      ],
      colors:[
        {id:"44",label:"Quadri R/V (4/4)",  sides:2, cpc:CPC.dep},
        {id:"40",label:"Quadri recto (4/0)",sides:1, cpc:CPC.dep},
      ],
      fins:[
        {id:"pm",label:"Pelliculage Mat",     t:"ps"},
        {id:"pb",label:"Pelliculage Brillant", t:"ps"},
        {id:"pl",label:"Pliage",              t:"pp"},
      ],
      qty:[25,50,100,200,500,1000,2000], setup:12,
    },

    /* ── CARTES ROUTIÈRES ─────────────────────────── */
    {
      id:"map", name:"Cartes routières", icon:"🗺", type:"std",
      formats:[
        {
          label:"A4 (21×29,7 cm) — 6 volets",
          w:.210, h:.297, sheet:{w:.320,h:.450},
          foldType:"pli3a", foldVolets:6,
          foldDesc:"Ouvert : A4 (21×30 cm) · 2 plis · format poche 7×21 cm · 6 faces",
        },
        {
          label:"A3 (29,7×42 cm) — 8 volets",
          w:.297, h:.420, sheet:{w:.320,h:.450},
          foldType:"pli4", foldVolets:8,
          foldDesc:"Ouvert : A3 (30×42 cm) · 3 plis · format poche 10,5×15 cm · 8 faces",
        },
        {
          label:"A3+ (32×45 cm) — 12 volets",
          w:.320, h:.450, sheet:{w:.340,h:.480},
          foldType:"pli4", foldVolets:12,
          foldDesc:"Ouvert : A3+ (32×45 cm) · 3 plis × 2 · format poche 10×11 cm · 12 faces",
        },
      ],
      papers:[
        {id:"80o", label:"80g Offset (recommandé)",  g:80,  type:"offset"},
        {id:"90o", label:"90g Offset",                g:90,  type:"offset"},
        {id:"115m",label:"115g Couché Mat",            g:115, type:"coated"},
        {id:"135m",label:"135g Couché Mat",            g:135, type:"coated"},
      ],
      colors:[
        {id:"44",label:"Quadri R/V (4/4)",  sides:2, cpc:CPC.dep},
        {id:"40",label:"Quadri recto (4/0)",sides:1, cpc:CPC.dep},
      ],
      fins:[
        {id:"pm",label:"Pelliculage Mat",  t:"ps"},
        {id:"pl",label:"Pliage",           t:"pp"},
      ],
      qty:[25,50,100,250,500,1000,2000], setup:15,
    },

    /* ── LIVRES N&B ────────────────────────────────── */
    {
      id:"liv", name:"Livres N&B", icon:"📚", type:"book",
      formats:[
        {label:"A5", pd:{w:.148,h:.210}},
        {label:"A4", pd:{w:.210,h:.297}},
      ],
      sheet:{w:.320, h:.450},
      cPapers:[
        {id:"250m",label:"250g Mat",       g:250, type:"coated"},
        {id:"300m",label:"300g Mat",       g:300, type:"coated"},
        {id:"300b",label:"300g Brillant",  g:300, type:"coated"},
        {id:"350m",label:"350g Mat",       g:350, type:"coated"},
        {id:"350b",label:"350g Brillant",  g:350, type:"coated"},
      ],
      covTypes:[
        {id:"r", label:"Couv Recto",       sides:1},
        {id:"rv",label:"Couv Recto/Verso", sides:2},
      ],
      papers:[
        {id:"80o", label:"80g Offset blanc",    g:80,  type:"offset"},
        {id:"90o", label:"90g Offset ivory",    g:90,  type:"offset"},
        {id:"100o",label:"100g Offset Premium", g:100, type:"offset"},
      ],
      colors:[{id:"nb",label:"N&B int. + Couv quadri"}],
      bindings:[
        {id:"piqure", label:"Piqûre (agrafé)"},
        {id:"spirale",label:"Reliure spirale"},
        {id:"dos",    label:"Dos carré collé"},
      ],
      fins:[],
      qty:[10,25,50,100,250,500], setup:20,
      cpcNb:CPC.liv_nb, cpcCov:CPC.bro,
    },

    /* ── IMPRESSION OFFSET ─────────────────────────── */
    {
      id:"off", name:"Impression Offset", icon:"⊞", type:"offset",
      machines:[
        {id:"cd102", label:"Heidelberg CD102-5 (max 700×1000mm)", key:"cd102", sheet:{w:.700,h:1.000}},
        {id:"sm74",  label:"Heidelberg SM74-4 (max 520×740mm)",   key:"sm74",  sheet:{w:.520,h:.740}},
      ],
      formats:[
        {label:"A5 (148×210mm)",   w:.148, h:.210},
        {label:"A4 (210×297mm)",   w:.210, h:.297},
        {label:"A3 (297×420mm)",   w:.297, h:.420},
        {label:"A3+ (320×450mm)",  w:.320, h:.450},
        {label:"A2 (420×594mm)",   w:.420, h:.594},
        {label:"40×60 cm",         w:.400, h:.600},
        {label:"50×70 cm",         w:.500, h:.700},
        {label:"70×100 cm",        w:.700, h:1.000},
      ],
      papers:[
        {id:"90o",  label:"90g Offset",              g:90,  type:"offset"},
        {id:"115m", label:"115g Couché Mat",          g:115, type:"coated"},
        {id:"135m", label:"135g Couché Mat",          g:135, type:"coated"},
        {id:"135b", label:"135g Couché Brillant",     g:135, type:"coated"},
        {id:"170m", label:"170g Couché Mat",          g:170, type:"coated"},
        {id:"170b", label:"170g Couché Brillant",     g:170, type:"coated"},
        {id:"200m", label:"200g Couché Mat",          g:200, type:"coated"},
        {id:"250m", label:"250g Couché Mat",          g:250, type:"coated"},
        {id:"300m", label:"300g Couché Mat",          g:300, type:"coated"},
      ],
      colors:[
        {id:"1r",  label:"1 couleur Pantone recto (1/0)",   nc:1, sides:1},
        {id:"1rv", label:"1 couleur Pantone R/V (1/1)",     nc:1, sides:2},
        {id:"4r",  label:"Quadri CMYK recto (4/0)",         nc:4, sides:1},
        {id:"4rv", label:"Quadri CMYK R/V (4/4)",           nc:4, sides:2},
        {id:"5r",  label:"CMYK + Pantone recto (5/0)",      nc:5, sides:1},
      ],
      fins:[
        {id:"pm",label:"Pelliculage Mat",      t:"ps"},
        {id:"pb",label:"Pelliculage Brillant", t:"ps"},
        {id:"oe",label:"Œillets ×4",           t:"pp"},
      ],
      qty:[500,1000,2000,5000,10000], setup:25,
    },
  ];

  /* ════════════════════════════════════════════════════
     MOTEUR DE CALCUL
     ════════════════════════════════════════════════════ */

  function calcFins(defs, ids, sNet, q) {
    let fc = 0; const fr = [];
    for (const id of ids) {
      const f = defs.find(x => x.id === id); if (!f) continue;
      const r = finRate(id) !== null ? finRate(id) : (f.r || 0);
      const c = f.t === "ps" ? sNet*r : f.t === "pp" ? q*r : r;
      fc += c; fr.push({l:f.label, c, t:f.t, r});
    }
    return {fc, fr};
  }

  function calcFinsBooklet(defs, ids, cT, q) {
    let fc = 0; const fr = [];
    for (const id of ids) {
      const f = defs.find(x => x.id === id); if (!f) continue;
      const r = finRate(id) !== null ? finRate(id) : (f.r || 0);
      const c = f.t === "pc" ? cT*r : f.t === "pp" ? q*r : r;
      fc += c; fr.push({l:f.label, c});
    }
    return {fc, fr};
  }

  function calcStd(p, state) {
    const fi=state.fi||0, pai=state.pa||0, ci=state.co||0;
    const q=state.qty, fins=state.fins||[], disc=state.disc||0;
    const fmt=p.formats[fi], pap=p.papers[pai], col=p.colors[ci];
    if (!fmt||!pap||!col) return null;
    const sh=fmt.sheet, sa=sh.w*sh.h, a4e=sa/A4A;
    const {n:ps_calc, o:or}=poses(fmt.w, fmt.h, sh.w, sh.h);
    const ps = fmt.psOverride || ps_calc;
    const sNet=Math.ceil(q/ps);
    const sw = fmt.noWaste ? 0 : waste(sNet,q);
    const sT=sNet+sw;
    const kps=(pap.g/1000)*sa, kprice=kp(pap.g, pap.type);
    const paperCost=sT*kps*kprice;
    const cpcUsed=col.cpc;
    const machineCost=sT*a4e*col.sides*cpcUsed;
    const {fc, fr}=calcFins(p.fins, fins, sNet, q);
    const setup=getSetup(p), tot=paperCost+machineCost+setup+fc;
    const margin=getMargin(p, q);
    const rawHT=tot/(1-margin);
    const finalHT=roundHT(rawHT*(1-disc/100));
    return {
      ps,or,sNet,sw,sT,sa,a4e,kps,kprice,cpcUsed,
      paperCost,machineCost,setup,fc,fr,tot,
      finalHT, finalTTC:finalHT*1.19, unit:finalHT/q, margin, disc,
      info:`${ps} pose${ps>1?"s":""}/feuille (${or})`,
      sheetInfo:`${sNet}+${sw}=${sT} feuilles`,
      pap, fmt, col,
    };
  }

  function calcBooklet(p, state) {
    const fi=state.fi||0, ci=state.co||0;
    const q=state.qty, fins=state.fins||[], disc=state.disc||0;
    const pa2=state.pa2||0, pa=state.pa||0;
    const bi=state.bi||0, cov=state.cov||0;
    const pages=state.pages||16;
    const cp=p.cPapers[pa2]||p.cPapers[0];
    const ip=p.iPapers[pa]||p.iPapers[0];
    const col=p.colors[ci]||p.colors[0];
    const bindingId=(p.bindings[bi]||p.bindings[0]).id;
    const bindingLabel=(p.bindings[bi]||p.bindings[0]).label;
    const bindingCostRate = finRate(bindingId) !== null ? finRate(bindingId) : (P.finitions[{piqure:'piqure_agrafes',spirale:'reliure_spirale',dos:'dos_carre_colle'}[bindingId]]?.dt || 0.08);
    const covType=p.covTypes[cov]||p.covTypes[0];
    const fmt=p.formats[fi];
    // Le format peut définir sa propre feuille (ex: 16×23 sur 33×48) sinon feuille du produit
    const sh=fmt.sheet||p.sheet, sa=sh.w*sh.h, a4e=sa/A4A;
    const {n:psCalc}=poses(fmt.piece.w, fmt.piece.h, sh.w, sh.h);
    const ps=fmt.psOverride||psCalc;
    const pps=ps*2;
    const iSpc=pages/pps;
    const iNet=Math.ceil(q*pages/pps);
    const cNet=Math.ceil(q*4/pps);
    const cW=waste(cNet,q), iW=waste(iNet,q);
    const cT=cNet+cW, iT=iNet+iW;
    const cpCost=cT*(cp.g/1000)*sa*kp(cp.g, cp.type);
    const ipCost=iT*(ip.g/1000)*sa*kp(ip.g, ip.type);
    const cmCost=cT*a4e*covType.sides*col.cpcCov;
    const imCost=iT*a4e*col.iSides*col.cpcInt;
    const bindingCost=q*bindingCostRate;
    const {fc, fr}=calcFinsBooklet(p.fins, fins, cT, q);
    const pellId=state.pell||null;
    const pellRate=pellId ? (finRate(pellId)||0) : 0;
    const pellCost=pellId ? cT*pellRate : 0;
    const pellLabel=pellId==="pm"?"Pelliculage Mat":pellId==="pb"?"Pelliculage Brillant":null;
    const setup=getSetup(p);
    const tot=cpCost+ipCost+cmCost+imCost+bindingCost+pellCost+setup+fc;
    const margin=getMargin(p, q);
    const rawHT=tot/(1-margin);
    const finalHT=roundHT(rawHT*(1-disc/100));
    return {
      ps,sNet:cNet+iNet,sw:cW+iW,sT:cT+iT,sa,a4e,cT,iT,
      paperCost:cpCost+ipCost, machineCost:cmCost+imCost, bindingCost, pellCost, setup, fc, fr, tot,
      cpCost,ipCost,cmCost,imCost,
      finalHT, finalTTC:finalHT*1.19, unit:finalHT/q, margin, disc,
      info:`${ps} poses/feuille (${sh.w*100|0}×${sh.h*100|0}cm) — ${iSpc}int+1couv/ex`,
      sheetInfo:`${pages+4}p total · Couv:${cT}f Int:${iT}f`,
      isBooklet:true, cp, ip, pages:pages+4, bindingLabel, pellLabel,
    };
  }

  function calcBook(p, state) {
    const fi=state.fi||0;
    const q=state.qty, fins=state.fins||[], disc=state.disc||0;
    const pa=state.pa||0, pa2=state.pa2||0, cov=state.cov||0;
    const pages=state.pages||48;
    const pap=p.papers[pa]||p.papers[0];
    const cp=p.cPapers[pa2]||p.cPapers[0];
    const covType=p.covTypes[cov]||p.covTypes[0];
    const fmt=p.formats[fi];
    const sh=p.sheet, sa=sh.w*sh.h, a4e=sa/A4A;
    const {n:ps}=poses(fmt.pd.w, fmt.pd.h, sh.w, sh.h);
    const pps=ps*2;
    const iSpc=pages/pps;
    const iNet=Math.ceil(q*pages/pps), iW=waste(iNet,q), iT=iNet+iW;
    const cNet=Math.ceil(q*4/pps), cW=Math.max(5,Math.ceil(cNet*.05)), cT=cNet+cW;
    const ipCost=iT*(pap.g/1000)*sa*kp(pap.g, pap.type);
    const cpCost=cT*(cp.g/1000)*sa*kp(cp.g, cp.type);
    const imCost=iT*a4e*2*p.cpcNb;
    const cmCost=cT*a4e*covType.sides*p.cpcCov;
    const {fc, fr}=calcFins(p.fins, fins, cNet, q);
    const bi=state.bi||0;
    const binding=p.bindings ? (p.bindings[bi]||p.bindings[0]) : null;
    const bindingRate=binding ? (finRate(binding.id)||0) : 0;
    const bindingCost=binding ? q*bindingRate : 0;
    const bindingLabel=binding ? binding.label : null;
    const pellId=state.pell||null;
    const pellRate=pellId ? (finRate(pellId)||0) : 0;
    const pellCost=pellId ? cNet*pellRate : 0;
    const pellLabel=pellId==="pm"?"Pelliculage Mat (couv)":pellId==="pb"?"Pelliculage Brillant (couv)":null;
    const setup=getSetup(p);
    const tot=ipCost+cpCost+imCost+cmCost+bindingCost+pellCost+setup+fc;
    const margin=getMargin(p, q);
    const rawHT=tot/(1-margin);
    const finalHT=roundHT(rawHT*(1-disc/100));
    return {
      ps,sNet:iNet+cNet,sw:iW+cW,sT:iT+cT,sa,a4e,cT,
      paperCost:ipCost+cpCost, machineCost:imCost+cmCost, bindingCost, pellCost, setup, fc, fr, tot,
      ipCost,cpCost,imCost,cmCost,
      finalHT, finalTTC:finalHT*1.19, unit:finalHT/q, margin, disc,
      info:`${ps} poses/${fmt.label} — ${iSpc}int+1couv/ex`,
      sheetInfo:`${pages}p int · Int:${iT}f Couv:${cT}f`,
      isBook:true, pages, cpLabel:cp.label, pap, bindingLabel, pellLabel,
    };
  }

  function calcOffset(p, state) {
    const mi=state.mi||0, fi=state.fi||0, pai=state.pa||0, ci=state.co||0;
    const q=state.qty, fins=state.fins||[], disc=state.disc||0;
    const machine=p.machines[mi]||p.machines[0];
    const fmt=p.formats[fi];
    const pap=p.papers[pai];
    const col=p.colors[ci];
    if (!machine||!fmt||!pap||!col) return null;
    const off=P.offset;
    const offM=off[machine.key];
    if (!offM) return null;
    const prixPlaque=offM.prix_plaque;
    const gachePct=off.gache_pct;
    const coutCalage=off.cout_calage;
    const sh=machine.sheet, sa=sh.w*sh.h, a4e=sa/A4A;
    const {n:ps,o:or}=poses(fmt.w, fmt.h, sh.w, sh.h);
    const sNet=Math.ceil(q/ps);
    const sw=Math.max(P.gache.minimum, Math.ceil(sNet*gachePct));
    const sT=sNet+sw;
    const nbPlaques=col.nc*col.sides;
    const plaqueCost=nbPlaques*prixPlaque;
    const calCost=coutCalage;
    const kps=(pap.g/1000)*sa, kprice=kp(pap.g, pap.type);
    const paperCost=sT*kps*kprice;
    const {fc, fr}=calcFins(p.fins, fins, sNet, q);
    const setup=getSetup(p);
    const tot=plaqueCost+calCost+paperCost+setup+fc;
    const margin=getMargin(p, q);
    const rawHT=tot/(1-margin);
    const finalHT=roundHT(rawHT*(1-disc/100));
    return {
      ps,or,sNet,sw,sT,sa,a4e,kps,kprice,
      plaqueCost,calCost,paperCost,setup,fc,fr,tot,
      nbPlaques,prixPlaque,
      finalHT, finalTTC:finalHT*1.19, unit:finalHT/q, margin, disc,
      info:`${ps} pose${ps>1?"s":""}/feuille (${or}) · ${nbPlaques} plaque${nbPlaques>1?"s":""}`,
      sheetInfo:`${sNet}+${sw}=${sT} feuilles · ${machine.label.split("(")[0].trim()}`,
      isOffset:true, pap, fmt, col, machine,
    };
  }

  function compute(p, state) {
    if (!state || !state.qty || state.qty < 1) return null;
    try {
      if (p.type === "booklet") return calcBooklet(p, state);
      if (p.type === "book")    return calcBook(p, state);
      if (p.type === "offset")  return calcOffset(p, state);
      return calcStd(p, state);
    } catch(e) {
      console.error("SIMPACT_PRICING error:", p.id, e);
      return null;
    }
  }

  function computeAllTiers(p, state) {
    return p.qty.map(qty => compute(p, {...state, qty}));
  }

  /* ── Mise à jour CPC après modification des paramètres ── */
  function refreshCPC(nc) {
    if (!nc) nc = SIMPACT_PARAMS.computeCPC(SIMPACT_PARAMS.P);
    Object.assign(CPC, nc);
    const cm = {
      cdv: { '44':'cdv',    '40':'cdv',    'nb':'ent_nb' },
      fly: { '44':'fly',    '40':'fly',    'nb':'ent_nb' },
      aff: { '40':'aff',    'nb':'ent_nb' },
      ent: { '40':'ent_cl', 'nb':'ent_nb', '1c':'ent_nb' },
      dep: { '44':'dep',    '40':'dep',    'nb':'ent_nb' },
    };
    const bm = {
      bro: {
        '44':  { cpcCov:'bro',    cpcInt:'bro'    },
        '4nb': { cpcCov:'bro',    cpcInt:'liv_nb' },
        'nb':  { cpcCov:'ent_nb', cpcInt:'ent_nb' },
      },
    };
    PRODS.forEach(p => {
      if (cm[p.id]) p.colors.forEach(c => {
        if (cm[p.id][c.id] !== undefined) c.cpc = nc[cm[p.id][c.id]];
      });
      if (bm[p.id]) p.colors.forEach(c => {
        const k = bm[p.id][c.id];
        if (k) { c.cpcCov = nc[k.cpcCov]; c.cpcInt = nc[k.cpcInt]; }
      });
      if (p.id === 'liv') { p.cpcNb = nc.liv_nb; p.cpcCov = nc.bro; }
    });
  }

  return { PRODS, compute, computeAllTiers, roundHT, CPC, poses, waste, kp, refreshCPC };

})();

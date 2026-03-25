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
      // Fallback sur la marge directe du produit
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
        {label:"A5 — 15×21 cm",   w:.150, h:.210, sheet:{w:.320,h:.450}},
        {label:"16×23 cm",         w:.160, h:.230, sheet:{w:.340,h:.480}},
        {label:"A4 — 21×29,7 cm", w:.210, h:.297, sheet:{w:.320,h:.450}},
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
        {label:"A4", piece:{w:.210,h:.297}},
        {label:"A5", piece:{w:.150,h:.210}},
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
      fins:[
        {id:"pm",label:"Pelliculage Mat couv.",      t:"pc"},
        {id:"pb",label:"Pelliculage Brillant couv.", t:"pc"},
      ],
      qty:[25,50,100,250,500,1000], setup:18,
    },

    /* ── AFFICHES ──────────────────────────────────── */
    {
      id:"aff", name:"Affiches", icon:"⬜", type:"std",
      formats:[
        {label:"A3 (297×420mm)",  w:.297, h:.420, sheet:{w:.320,h:.450}},
        {label:"A3+ (320×450mm)", w:.320, h:.450, sheet:{w:.340,h:.480}},
        {label:"A2 (420×594mm)",  w:.420, h:.594, sheet:{w:.450,h:.640}},
        {label:"A1 (594×841mm)",  w:.594, h:.841, sheet:{w:.640,h:.900}},
        {label:"40×60 cm",        w:.400, h:.600, sheet:{w:.450,h:.640}},
        {label:"50×70 cm",        w:.500, h:.700, sheet:{w:.540,h:.750}},
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
        {label:"A5 — 15×21 cm (pli 2)",    w:.150, h:.210, sheet:{w:.320,h:.450}},
        {label:"16×23 cm (pli 2)",          w:.160, h:.230, sheet:{w:.340,h:.480}},
        {label:"A4 — 21×29,7 cm (pli 3)",  w:.210, h:.297, sheet:{w:.320,h:.450}},
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
      fins:[
        {id:"piqure", label:"Agrafé (piqûre)",           t:"pp"},
        {id:"spirale",label:"Reliure spirale",            t:"pp"},
        {id:"dos",    label:"Dos carré collé",            t:"pp"},
        {id:"pm",     label:"Pelliculage Mat (couv)",     t:"ps"},
        {id:"pb",     label:"Pelliculage Brillant (couv)",t:"ps"},
      ],
      qty:[10,25,50,100,250,500], setup:20,
      cpcNb:CPC.liv_nb, cpcCov:CPC.bro,
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
    const sh=p.sheet, sa=sh.w*sh.h, a4e=sa/A4A;
    const {n:ps}=poses(fmt.piece.w, fmt.piece.h, sh.w, sh.h);
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
    const setup=getSetup(p);
    const tot=cpCost+ipCost+cmCost+imCost+bindingCost+setup+fc;
    const margin=getMargin(p, q);
    const rawHT=tot/(1-margin);
    const finalHT=roundHT(rawHT*(1-disc/100));
    return {
      ps,sNet:cNet+iNet,sw:cW+iW,sT:cT+iT,sa,a4e,cT,iT,
      paperCost:cpCost+ipCost, machineCost:cmCost+imCost, bindingCost, setup, fc, fr, tot,
      cpCost,ipCost,cmCost,imCost,
      finalHT, finalTTC:finalHT*1.19, unit:finalHT/q, margin, disc,
      info:`${ps} poses/${fmt.label} — ${iSpc}int+1couv/ex`,
      sheetInfo:`${pages+4}p total · Couv:${cT}f Int:${iT}f`,
      isBooklet:true, cp, ip, pages:pages+4, bindingLabel,
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
    const setup=getSetup(p);
    const tot=ipCost+cpCost+imCost+cmCost+setup+fc;
    const margin=getMargin(p, q);
    const rawHT=tot/(1-margin);
    const finalHT=roundHT(rawHT*(1-disc/100));
    return {
      ps,sNet:iNet+cNet,sw:iW+cW,sT:iT+cT,sa,a4e,cT,
      paperCost:ipCost+cpCost, machineCost:imCost+cmCost, setup, fc, fr, tot,
      ipCost,cpCost,imCost,cmCost,
      finalHT, finalTTC:finalHT*1.19, unit:finalHT/q, margin, disc,
      info:`${ps} poses/${fmt.label} — ${iSpc}int+1couv/ex`,
      sheetInfo:`${pages}p int · Int:${iT}f Couv:${cT}f`,
      isBook:true, pages, cpLabel:cp.label, pap,
    };
  }

  function compute(p, state) {
    if (!state || !state.qty || state.qty < 1) return null;
    try {
      if (p.type === "booklet") return calcBooklet(p, state);
      if (p.type === "book")    return calcBook(p, state);
      return calcStd(p, state);
    } catch(e) {
      console.error("SIMPACT_PRICING error:", p.id, e);
      return null;
    }
  }

  function computeAllTiers(p, state) {
    return p.qty.map(qty => compute(p, {...state, qty}));
  }

  return { PRODS, compute, computeAllTiers, roundHT, CPC, poses, waste, kp };

})();

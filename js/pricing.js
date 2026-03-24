/* ═══════════════════════════════════════════════════════
   SIMPACT PRICING ENGINE v5.0 — Source unique de vérité
   Utilisé par : configurator.html ET client-portal.html
   Tous les prix HT sont des entiers arrondis au sup.
   ═══════════════════════════════════════════════════════ */

const SIMPACT_PRICING = (function () {

  /* ── CPC Canon V1000 — Source Azur Colors 05/03/2026 ── */
  const E  = 0.042;                    // énergie DT/click
  const T  = 0.90;                     // -10% terrain
  const MO = 38885 / 7800000;          // main-d'oeuvre DT/click

  const CPC = {
    cdv:    +((0.2281 + E + MO) * T).toFixed(4),
    fly:    +((0.2069 + E + MO) * T).toFixed(4),
    bro:    +((0.1706 + E + MO) * T).toFixed(4),
    aff:    +((0.2939 + E + MO) * T).toFixed(4),
    dep:    +((0.1905 + E + MO) * T).toFixed(4),
    ent_nb: +((0.0308 + E + MO) * T).toFixed(4),
    ent_cl: +((0.1247 + E + MO) * T).toFixed(4),
    liv_nb: +((0.0356 + E + MO) * T).toFixed(4),
  };

  const A4A = 0.210 * 0.297;   // surface A4 en m²

  /* ── Prix papier DT/kg ─────────────────────────────── */
  const PKG = {
    coated: { 115:3.6, 135:3.6, 170:3.6, 200:3.6, 250:3.6, 300:3.9, 350:3.9, 400:3.9 },
    offset: { 80:3.7, 90:3.9, 100:3.7 },
  };
  const kp = (g, t) => (PKG[t] || PKG.coated)[g] || 3.6;

  /* ── Imposition ───────────────────────────────────── */
  function poses(pw, ph, sw, sh) {
    const B = 0.003, G = 0.002;
    const fw = pw + B*2 + G, fh = ph + B*2 + G;
    const p1 = Math.floor((sw+G)/fw) * Math.floor((sh+G)/fh);
    const p2 = Math.floor((sh+G)/fw) * Math.floor((sw+G)/fh);
    return { n: Math.max(p1, p2, 1), o: p1 >= p2 ? "normale" : "pivotée" };
  }

  /* ── Gâche ──────────────────────────────────────── */
  function waste(sNet, qty) {
    const r = qty < 500 ? 0.08 : qty < 2000 ? 0.05 : 0.03;
    return Math.max(10, Math.ceil(sNet * r));
  }

  /* ── Arrondi HT : entier, arrondi au sup par palier ─ */
  function roundHT(x) {
    if (x <= 0) return 0;
    if (x < 10)  return Math.ceil(x);
    if (x < 50)  return Math.ceil(x / 2) * 2;
    if (x < 200) return Math.ceil(x / 5) * 5;
    if (x < 500) return Math.ceil(x / 10) * 10;
    return Math.ceil(x / 20) * 20;
  }

  /* ── Marge par quantité ────────────────────────── */
  function getMargin(p, qty) {
    if (!p.margins) return p.margin;
    let idx = p.qty.length - 1;
    for (let i = 0; i < p.qty.length; i++) {
      if (qty <= p.qty[i]) { idx = i; break; }
    }
    return p.margins[idx];
  }

  /* ══════════════════════════════════════════════════
     CATALOGUE PRODUITS
     ══════════════════════════════════════════════════ */
  const PRODS = [

    /* ── CARTES DE VISITE ─────────────────────────── */
    {
      id:"cdv", name:"Cartes de visite", icon:"▪", type:"std",
      formats:[
        {label:"85×54mm Standard", w:.085, h:.054, sheet:{w:.320,h:.450}},
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
        {id:"pm",label:"Pelliculage Mat",      t:"pp", r:.022},
        {id:"pb",label:"Pelliculage Brillant",  t:"pp", r:.018},
        {id:"co",label:"Coins arrondis",        t:"pp", r:.020},
        {id:"vu",label:"Vernis UV sélectif",    t:"pp", r:.035},
      ],
      qty:[50,100,250,500,1000,2000],
      margins:[.40,.42,.45,.47,.48,.48],
      margin:.45, setup:12,
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
        {id:"pm",label:"Pelliculage Mat",      t:"ps", r:.28},
        {id:"pb",label:"Pelliculage Brillant",  t:"ps", r:.22},
      ],
      qty:[50,100,250,500,1000,2000],
      margins:[.35,.43,.41,.47,.40,.32],
      margin:.41, setup:10,
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
        {id:"piqure", label:"Piqûre (agrafé)", cost:.08},
        {id:"spirale",label:"Reliure spirale", cost:.45},
        {id:"dos",    label:"Dos carré collé", cost:.10},
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
        {id:"pm",label:"Pelliculage Mat couv.",      t:"pc", r:.28},
        {id:"pb",label:"Pelliculage Brillant couv.", t:"pc", r:.22},
      ],
      qty:[25,50,100,250,500,1000],
      margin:.64, setup:18,
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
        {id:"pm",label:"Pelliculage Mat",      t:"ps", r:.32},
        {id:"pb",label:"Pelliculage Brillant",  t:"ps", r:.25},
        {id:"oe",label:"Œillets ×4",           t:"pp", r:.050},
      ],
      qty:[5,10,25,50,100,250],
      margin:.64, setup:15,
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
      qty:[25,50,100,200,500,1000,2000],
      margin:.55, setup:8,
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
        {id:"pm",label:"Pelliculage Mat",      t:"ps", r:.28},
        {id:"pb",label:"Pelliculage Brillant",  t:"ps", r:.22},
        {id:"pl",label:"Pliage",               t:"pp", r:.015},
      ],
      qty:[25,50,100,200,500,1000,2000],
      margins:[.38,.36,.41,.41,.46,.45,.48],
      margin:.41, setup:12,
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
        {id:"piqure", label:"Agrafé (piqûre)",           t:"pp", r:.08},
        {id:"spirale",label:"Reliure spirale",            t:"pp", r:.12},
        {id:"dos",    label:"Dos carré collé",            t:"pp", r:.10},
        {id:"pm",     label:"Pelliculage Mat (couv)",     t:"pp", r:.18},
        {id:"pb",     label:"Pelliculage Brillant (couv)", t:"pp", r:.18},
      ],
      qty:[10,25,50,100,250,500],
      margin:.62, setup:20, cpcNb:CPC.liv_nb, cpcCov:CPC.bro,
    },
  ];

  /* ══════════════════════════════════════════════════
     MOTEUR DE CALCUL
     ══════════════════════════════════════════════════ */

  function calcFins(defs, ids, sNet, q) {
    let fc = 0; const fr = [];
    for (const id of ids) {
      const f = defs.find(x => x.id === id); if (!f) continue;
      const c = f.t === "ps" ? sNet*f.r : f.t === "pp" ? q*f.r : f.r;
      fc += c; fr.push({l:f.label, c, t:f.t});
    }
    return {fc, fr};
  }

  function calcFinsBooklet(defs, ids, cT, q) {
    let fc = 0; const fr = [];
    for (const id of ids) {
      const f = defs.find(x => x.id === id); if (!f) continue;
      const c = f.t === "pc" ? cT*f.r : f.t === "pp" ? q*f.r : f.r;
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
    const {n:ps, o:or}=poses(fmt.w, fmt.h, sh.w, sh.h);
    const sNet=Math.ceil(q/ps), sw=waste(sNet,q), sT=sNet+sw;
    const kps=(pap.g/1000)*sa, kprice=kp(pap.g, pap.type);
    const paperCost=sT*kps*kprice;
    const cpcUsed=col.cpc;
    const machineCost=sT*a4e*col.sides*cpcUsed;
    const {fc, fr}=calcFins(p.fins, fins, sNet, q);
    const setup=p.setup, tot=paperCost+machineCost+setup+fc;
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
    const binding=p.bindings[bi]||p.bindings[0];
    const covType=p.covTypes[cov]||p.covTypes[0];
    const fmt=p.formats[fi];
    const sh=p.sheet, sa=sh.w*sh.h, a4e=sa/A4A;
    const {n:ps}=poses(fmt.piece.w, fmt.piece.h, sh.w, sh.h);
    const iSpc=Math.ceil(pages/4);
    // ps (poses/feuille) réduit le nombre de feuilles : A5 (4 poses) = moitié vs A4 (2 poses)
    const cNet=Math.ceil(q/ps), iNet=Math.ceil((q*iSpc)/ps);
    const cW=waste(cNet,q), iW=waste(iNet,q);
    const cT=cNet+cW, iT=iNet+iW;
    const cpCost=cT*(cp.g/1000)*sa*kp(cp.g, cp.type);
    const ipCost=iT*(ip.g/1000)*sa*kp(ip.g, ip.type);
    const cmCost=cT*a4e*covType.sides*col.cpcCov;
    const imCost=iT*a4e*col.iSides*col.cpcInt;
    const bindingCost=q*binding.cost;
    const {fc, fr}=calcFinsBooklet(p.fins, fins, cT, q);
    const setup=p.setup;
    const tot=cpCost+ipCost+cmCost+imCost+bindingCost+setup+fc;
    const rawHT=tot/(1-p.margin);
    const finalHT=roundHT(rawHT*(1-disc/100));
    return {
      ps,sNet:cNet+iNet,sw:cW+iW,sT:cT+iT,sa,a4e,
      paperCost:cpCost+ipCost, machineCost:cmCost+imCost, bindingCost, setup, fc, fr, tot,
      cpCost,ipCost,cmCost,imCost,
      finalHT, finalTTC:finalHT*1.19, unit:finalHT/q, margin:p.margin, disc,
      info:`${ps} poses/${fmt.label} — ${iSpc}int+1couv/ex`,
      sheetInfo:`${pages+4}p total · Couv:${cT}f Int:${iT}f`,
      isBooklet:true, cp, ip, pages:pages+4, bindingLabel:binding.label,
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
    const iSpc=Math.ceil(pages/4);
    // ps réduit les feuilles intérieures (A5 = 4 poses = moitié de feuilles vs A4 = 2 poses)
    const iNet=Math.ceil((q*iSpc)/ps), iW=waste(iNet,q), iT=iNet+iW;
    // Couverture : 1 couverture par exemplaire (pliée), imposée avec ps
    const cNet=Math.ceil(q/ps), cW=Math.max(3,Math.ceil(cNet*.05)), cT=cNet+cW;
    const ipCost=iT*(pap.g/1000)*sa*kp(pap.g, pap.type);
    const cpCost=cT*(cp.g/1000)*sa*kp(cp.g, cp.type);
    const imCost=iT*a4e*2*p.cpcNb;
    const cmCost=cT*a4e*covType.sides*p.cpcCov;
    const {fc, fr}=calcFins(p.fins, fins, 0, q);
    const setup=p.setup;
    const tot=ipCost+cpCost+imCost+cmCost+setup+fc;
    const rawHT=tot/(1-p.margin);
    const finalHT=roundHT(rawHT*(1-disc/100));
    return {
      ps,sNet:iNet+cNet,sw:iW+cW,sT:iT+cT,sa,a4e,
      paperCost:ipCost+cpCost, machineCost:imCost+cmCost, setup, fc, fr, tot,
      ipCost,cpCost,imCost,cmCost,
      finalHT, finalTTC:finalHT*1.19, unit:finalHT/q, margin:p.margin, disc,
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

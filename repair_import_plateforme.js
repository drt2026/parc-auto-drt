/**
 * ============================================================
 *  REPAIR_IMPORT_PLATEFORME.JS — Import des "réparations exécutées"
 *  depuis les classeurs "Plateforme Parc Auto" (une feuille par véhicule) :
 *    - Plateforme_Parc_Auto_Professionnelle (.xlsx)
 *    - PLATFORME DE TRAVAIL 2024 (.xlsm)
 *
 *  Chaque bon de livraison (BL) devient UNE intervention dans
 *  parcAuto.data.repairs (même structure que le formulaire).
 *  + HISTORIQUE par véhicule (bloc "Entretiens" de chaque feuille) reporté sur la
 *    fiche véhicule : dernière vidange (date + km), prochaine vidange, batterie
 *    (date + km), prochaine chaîne, km, date pneus, et chauffeur / matricule agent
 *    s'ils sont vides. Règle : on ne remplace jamais une valeur plus récente.
 *
 *  Module 100% additif :
 *   - ne modifie AUCUNE fonction existante (handleRepairHistImport, saveRepair…)
 *   - ne touche PAS aux fiches véhicules (km, échéances, batterie, pneus)
 *   - ajoute son propre bouton à côté de "Importer Excel (historique)"
 *   - anti-doublon : un même BL ré-importé n'est jamais ajouté deux fois
 *
 *  À inclure dans admin.html APRÈS repair_rapport.js :
 *  <script src="repair_import_plateforme.js?v=1"></script>
 * ============================================================
 */
(function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window : globalThis;
  if (root.__repairImportPlateformeLoaded) return;
  root.__repairImportPlateformeLoaded = true;

  const FIELD_LABELS = {
    ancienneVidangeDate: 'Date dernière vidange', ancienneVidangeIndex: 'Km dernière vidange',
    prochaineVidange: 'Prochaine vidange (km)', prochaineChaine: 'Prochaine chaîne (km)',
    dateChangementBatterie: 'Date batterie', indiceBatterie: 'Km batterie',
    dateChangementPneus: 'Date pneus', km: 'Kilométrage', chauffeur: 'Chauffeur', matriculeAgent: 'Matricule agent'
  };
  const MAX_ROWS = 400;   // la feuille "Ford FIGO" du .xlsm déclare > 1 M de lignes : on plafonne
  const MAX_COLS = 16;

  /* ── Helpers ─────────────────────────────────────────────── */
  const pad = (n) => String(n).padStart(2, '0');

  function toIso(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date && !isNaN(v)) {
      // +12 h puis getters UTC : évite le décalage de fuseau de SheetJS
      const d = new Date(v.getTime() + 12 * 3600 * 1000);
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    if (typeof v === 'number' && v > 30000 && v < 60000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000) + 12 * 3600 * 1000);
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + pad(m[2]) + '-' + pad(m[1]);
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }

  function toNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    const n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }

  function normMat(s) { return String(s || '').toUpperCase().replace(/\s+/g, ''); }

  function extractMatricule(text) {
    const m = String(text || '').match(/(\d{2})\s*-{1,2}\s*(\d{3})(?:\s?(\d{2,3}))?(?!\d)/);
    return m ? m[1] + '-' + m[2] + (m[3] || '') : '';
  }

  function detectType(txt) {
    if (/VIDANGE|HUILE MOTEUR|FILTRE A HUILE|FILTRE HUILE/.test(txt)) return 'Vidange';
    if (/CHAINE|KIT DISTRIB|COURROIE DE DISTRIB/.test(txt)) return 'Kit Chaîne';
    if (/BATTERIE|BATRIE/.test(txt)) return 'Batterie';
    if (/PNEU|CHANG\s*PN|\bPN\b/.test(txt)) return 'Pneus';
    if (/VISITE TECH/.test(txt)) return 'Visite Technique';
    return 'Réparation';
  }

  function isLavageLine(des) { return /LAVAGE|^\s*LAV\s*$/i.test(des); }

  /* ── Historique "Entretiens" d'une feuille véhicule ──────── */
  function cellStr(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function parseHistory(rows) {
    let h = -1, lc = 1;   // lc = colonne des libellés (B dans la plupart des feuilles, A dans certaines)
    for (let i = 0; i < Math.min(rows.length, 40) && h < 0; i++) {
      for (let c = 0; c <= 2; c++) {
        if (/^entretiens$/i.test(cellStr(rows[i][c]))) { h = i; lc = c; break; }
      }
    }
    if (h < 0) return null;
    const head = rows[h].map(cellStr);
    let cD = head.findIndex((c, idx) => idx > lc && /^date$/i.test(c)); if (cD < 0) cD = lc + 1;
    let cK = head.findIndex((c, idx) => idx > lc && /^km$/i.test(c));   if (cK < 0) cK = lc + 2;
    const out = { vidange: null, prochaineVidange: null, batterie: null, prochaineChaine: null, chauffeur: '', matriculeAgent: '' };
    let nbChaine = 0;
    for (let i = h + 1; i < Math.min(rows.length, h + 14); i++) {
      const lab = cellStr(rows[i][lc]).toLowerCase();
      if (!lab) continue;
      const d = toIso(rows[i][cD]);
      const kmRaw = rows[i][cK];
      const km = (typeof kmRaw === 'number' && kmRaw > 0) ? Math.round(kmRaw) : 0;
      if (/^prochaine vidange b/.test(lab) || /^vidange b/.test(lab)) continue;       // boîte de vitesse : pas de champ dans l'application
      if (/^prochaine vidange/.test(lab)) { if (km) out.prochaineVidange = km; }
      else if (/^vidange/.test(lab)) { if (d && km) out.vidange = { date: d, km: km }; }
      else if (/^bat/.test(lab)) { if (d) out.batterie = { date: d, km: km }; }
      else if (/^chaine/.test(lab)) { nbChaine++; if (nbChaine === 2 && km) out.prochaineChaine = km; }
    }
    // fiche (haut de feuille) : ligne "Mise en SC" -> nom du chauffeur et matricule agent
    for (let i = 0; i < Math.min(rows.length, h); i++) {
      if (/^mise en sc/i.test(cellStr(rows[i][lc]))) {
        out.chauffeur = cellStr(rows[i][lc + 2]);
        const ag = cellStr(rows[i][lc + 3]); out.matriculeAgent = /^\d{3,6}$/.test(ag) ? ag : '';
        break;
      }
    }
    return out;
  }

  /* ── Feuille aux identifiants contradictoires (copier-coller dans le classeur source) ── */
  function detectConflict(rows, matricule, sheetName) {
    const tail = (m) => String(m || '').replace(/\D/g, '').slice(-6);
    const nameMat = extractMatricule(sheetName);
    if (nameMat && tail(nameMat) !== tail(matricule)) return 'nom de feuille ' + nameMat + ' ≠ cellule "VEHICULE N°" ' + matricule;
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      for (let c = 0; c < 4; c++) {
        if (/^immatriculation/i.test(cellStr(rows[i][c]))) {
          const v = cellStr(rows[i][c + 1]);
          const imm = /^(\d{2}\s*-+\s*)?\d{5,6}$/.test(v) ? v : '';   // seulement les numéros de type 17-345137 / 345137 (les plaques TU ne sont pas comparées)
          if (imm && tail(imm) !== tail(matricule)) return 'cellule "Immatriculation" ' + imm + ' ≠ "VEHICULE N°" ' + matricule;
          return '';
        }
      }
    }
    return '';
  }

  /* ── Lecture d'UNE feuille véhicule → liste de BL (groupes) ── */
  function parseSheet(ws, sheetName) {
    if (!ws || !ws['!ref']) return null;
    const rng = XLSX.utils.decode_range(ws['!ref']);
    if (rng.e.r > MAX_ROWS - 1) rng.e.r = MAX_ROWS - 1;
    if (rng.e.c > MAX_COLS - 1) rng.e.c = MAX_COLS - 1;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range: rng, blankrows: true });
    if (!rows.length) return null;

    let matricule = '';
    for (let i = 0; i < Math.min(rows.length, 10) && !matricule; i++) {
      for (let c = 0; c < 4 && !matricule; c++) {
        if (/^v[ée]hicule\s*n/i.test(cellStr(rows[i][c]))) matricule = extractMatricule(rows[i][c + 1]);
      }
    }
    if (!matricule) matricule = extractMatricule(rows[0] && rows[0][0]) || extractMatricule(sheetName);
    if (!matricule) return null;

    // Ligne d'en-tête du tableau des bons de livraison
    let h = -1;
    for (let i = 0; i < Math.min(rows.length, 80); i++) {
      const r = rows[i].map(c => String(c === null || c === undefined ? '' : c).trim());
      if (r.some(c => /b[\s.\-]*livraison|bon\s*livraison/i.test(c)) && r.some(c => /d[ée]signation/i.test(c))) { h = i; break; }
    }
    if (h < 0) return { matricule, groups: [], history: parseHistory(rows), conflict: detectConflict(rows, matricule, sheetName) };
    const head = rows[h].map(c => String(c === null || c === undefined ? '' : c).trim());
    const iBL   = head.findIndex(c => /b[\s.\-]*livraison|bon\s*livraison/i.test(c));
    const iDes  = head.findIndex(c => /d[ée]signation/i.test(c));
    const iDate = head.findIndex(c => /date\s*d.entr/i.test(c));
    const iMt   = head.findIndex(c => /montant/i.test(c));
    const iKm   = head.findIndex((c, idx) => idx > iBL && /^km$/i.test(c));   // présent seulement dans le .xlsm
    if (iDes < 0 || iDate < 0 || iMt < 0) return { matricule, groups: [], history: parseHistory(rows), conflict: detectConflict(rows, matricule, sheetName) };

    const groups = [];
    let cur = null;
    let lastDate = '';   // dernière date rencontrée : reportée sur les BL dont la date est vide (comme la colonne "Année (aide)")
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.some(c => typeof c === 'string' && /^\s*total\s*$/i.test(c))) break;   // ligne TOTAL de fin de tableau

      const des = String(r[iDes] === null || r[iDes] === undefined ? '' : r[iDes]).trim();
      const mt = toNum(r[iMt]);
      if (!/[A-Za-zÀ-ÿ]/.test(des) || isNaN(mt)) continue;                          // totaux, années isolées, lignes vides

      const bl = String(r[iBL] === null || r[iBL] === undefined ? '' : r[iBL]).trim();
      let dt = toIso(r[iDate]);
      if (bl || dt) {                                                               // nouveau bon de livraison
        let filled = false;
        if (dt) lastDate = dt;
        else if (lastDate) { dt = lastDate; filled = true; }                        // date vide -> date reportée
        const km = iKm >= 0 ? (parseInt(r[iKm]) || 0) : 0;
        cur = { bl, date: dt, dateFilled: filled, km, lines: [], montant: 0 };
        groups.push(cur);
      }
      if (!cur) continue;
      cur.lines.push(des);
      cur.montant += mt;
    }
    return { matricule, groups, history: parseHistory(rows), conflict: detectConflict(rows, matricule, sheetName) };
  }

  function mergeHistory(a, b) {
    if (!a) return b; if (!b) return a;
    const m = { vidange: a.vidange, prochaineVidange: a.prochaineVidange, batterie: a.batterie,
                prochaineChaine: a.prochaineChaine, chauffeur: a.chauffeur || b.chauffeur, matriculeAgent: a.matriculeAgent || b.matriculeAgent };
    if (b.vidange && (!m.vidange || b.vidange.date > m.vidange.date)) m.vidange = b.vidange;
    if (b.batterie && (!m.batterie || b.batterie.date > m.batterie.date)) m.batterie = b.batterie;
    if (b.prochaineVidange && (!m.prochaineVidange || b.prochaineVidange > m.prochaineVidange)) m.prochaineVidange = b.prochaineVidange;
    if (b.prochaineChaine && (!m.prochaineChaine || b.prochaineChaine > m.prochaineChaine)) m.prochaineChaine = b.prochaineChaine;
    return m;
  }

  /* ── Plan de mise à jour de la fiche véhicule (jamais de régression) ── */
  function planFiche(veh, hist, groups) {
    const ch = {};   // champ -> [ancienne valeur, nouvelle valeur]
    const set = (f, v) => { if (v !== undefined && v !== null && v !== '' && veh[f] !== v) ch[f] = [veh[f], v]; };

    // Dernière vidange : seulement si plus récente que celle de la fiche
    if (hist && hist.vidange && (!veh.ancienneVidangeDate || hist.vidange.date > veh.ancienneVidangeDate)) {
      set('ancienneVidangeDate', hist.vidange.date);
      set('ancienneVidangeIndex', hist.vidange.km);
    }
    // Prochaines échéances (km) : seulement si elles augmentent (une échéance ne recule jamais)
    if (hist && hist.prochaineVidange && (!veh.prochaineVidange || hist.prochaineVidange > veh.prochaineVidange)) set('prochaineVidange', hist.prochaineVidange);
    if (hist && hist.prochaineChaine && (!veh.prochaineChaine || hist.prochaineChaine > veh.prochaineChaine)) set('prochaineChaine', hist.prochaineChaine);

    // Batterie / Pneus : date la plus récente entre le bloc "Entretiens" et les BL
    let batt = hist && hist.batterie ? { date: hist.batterie.date, km: hist.batterie.km } : null;
    let pneus = '', kmMax = hist && hist.vidange ? hist.vidange.km : 0;
    (groups || []).forEach(g => {
      if (g.km > kmMax) kmMax = g.km;
      if (!g.date) return;
      const t = detectType(g.lines.join(' | ').toUpperCase());
      if (t === 'Batterie' && (!batt || g.date > batt.date)) batt = { date: g.date, km: g.km || 0 };
      if (t === 'Pneus' && g.date > pneus) pneus = g.date;
    });
    if (batt && (!veh.dateChangementBatterie || batt.date > veh.dateChangementBatterie)) {
      set('dateChangementBatterie', batt.date);
      if (batt.km) set('indiceBatterie', String(batt.km));
    }
    if (pneus && (!veh.dateChangementPneus || pneus > veh.dateChangementPneus)) set('dateChangementPneus', pneus);

    // Kilométrage : seulement à la hausse
    if (kmMax && kmMax > (veh.km || 0)) set('km', kmMax);

    // Identité : seulement si vide dans l'application
    if (hist && hist.chauffeur && !veh.chauffeur) set('chauffeur', hist.chauffeur);
    if (hist && hist.matriculeAgent && !veh.matriculeAgent) set('matriculeAgent', hist.matriculeAgent);
    return ch;
  }

  /* ── Classeur complet → interventions à ajouter ─────────── */
  function buildRepairs(wb, opts) {
    opts = opts || {};
    const month = opts.month || null;               // 'AAAA-MM' (optionnel)
    const includeLavage = !!opts.includeLavage;
    const vehicles = opts.vehicles || [];
    const existing = opts.existing || [];

    const vehByMat = new Map();
    vehicles.forEach(v => vehByMat.set(normMat(v.matricule), v));

    const stats = { sheets: 0, blTotal: 0, added: 0, dup: 0, lavage: 0, month: 0, noDate: 0, noDateAmount: 0, noDateList: [], dateFilled: 0, unmatched: [], ambiguous: [], fiches: 0, fields: {} };
    const out = [];
    const fiches = [];
    const existingIds = new Set(existing.map(r => r.id));
    const baseCount = {};   // compteur par identifiant de base -> identifiants stables d'un import à l'autre

    // Lecture + fusion des feuilles d'un même véhicule (certains véhicules ont 2 feuilles)
    const byMat = new Map();
    wb.SheetNames.forEach(name => {
      const parsed = parseSheet(wb.Sheets[name], name);
      if (!parsed) return;
      stats.sheets++;
      if (parsed.conflict) { stats.ambiguous.push(name.trim() + ' — ' + parsed.conflict); return; }   // ni réparations ni historique : à corriger dans le classeur source
      let e = byMat.get(parsed.matricule);
      if (!e) { e = { matricule: parsed.matricule, names: [], groups: [], history: null, seen: new Set() }; byMat.set(parsed.matricule, e); }
      e.names.push(name.trim());
      parsed.groups.forEach(g => {
        const sig = (g.bl || '') + '|' + g.date + '|' + g.montant.toFixed(3);
        if (e.seen.has(sig)) return;                 // même BL présent sur deux feuilles du même véhicule
        e.seen.add(sig); e.groups.push(g);
      });
      e.history = mergeHistory(e.history, parsed.history);
    });

    byMat.forEach(parsed => {
      const veh = vehByMat.get(normMat(parsed.matricule));
      if (!veh) { stats.unmatched.push(parsed.matricule + ' (' + parsed.names.join(' + ') + ')'); return; }

      if (opts.history !== false) {
        const ch = planFiche(veh, parsed.history, parsed.groups);
        const keys = Object.keys(ch);
        if (keys.length) {
          fiches.push({ veh: veh, changes: ch });
          stats.fiches++;
          keys.forEach(k => { stats.fields[k] = (stats.fields[k] || 0) + 1; });
        }
      }

      parsed.groups.forEach(g => {
        stats.blTotal++;
        if (!g.date) {
          stats.noDate++; stats.noDateAmount += g.montant;
          stats.noDateList.push(parsed.matricule + ' BL ' + (g.bl || '?') + ' (' + g.montant.toFixed(2) + ' DT)');
          return;
        }
        if (month && g.date.slice(0, 7) !== month) { stats.month++; return; }
        if (!includeLavage && g.lines.every(isLavageLine)) { stats.lavage++; return; }

        const type = detectType(g.lines.join(' | ').toUpperCase());
        const montant = +g.montant.toFixed(3);
        const base = 'plat_' + parsed.matricule + '_' + (g.bl || 'x') + '_' + g.date;
        baseCount[base] = (baseCount[base] || 0) + 1;
        const id = baseCount[base] === 1 ? base : base + '_' + baseCount[base];

        const isDup = existingIds.has(id) || existing.some(ex =>
          ex.matricule === veh.matricule && ex.date === g.date && ex.type === type &&
          Math.abs((ex.montant || 0) - montant) < 0.01);
        if (isDup) { stats.dup++; return; }

        let des = (g.bl ? 'BL ' + g.bl + ' — ' : '') + g.lines.join(', ');
        if (des.length > 145) des = des.slice(0, 142) + '…';
        if (g.dateFilled) { des += ' (date reportée)'; stats.dateFilled++; }

        out.push({
          id: id,
          matricule: veh.matricule,
          chauffeur: veh.chauffeur || '',
          type: type,
          date: g.date,
          km: g.km || 0,
          montant: montant,
          designation: des
        });
        stats.added++;
      });
    });
    return { repairs: out, fiches: fiches, stats: stats };
  }

  /* ── Import depuis le navigateur ─────────────────────────── */
  function handlePlateformeImport(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const status = document.getElementById('repair-hist-import-status');
    const say = (t) => { if (status) status.textContent = t; };
    const toast = (m, t) => { if (root.parcAuto && root.parcAuto.showToast) root.parcAuto.showToast(m, t || 'info'); else alert(m); };

    const pa = root.parcAuto;
    if (!pa || !pa.data) { toast('❌ Application non initialisée, rafraîchissez la page.', 'error'); evt.target.value = ''; return; }
    if (typeof XLSX === 'undefined') { toast('❌ Librairie Excel non chargée. Rafraîchissez la page.', 'error'); evt.target.value = ''; return; }

    say('⏳ Lecture du fichier...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true, sheetRows: MAX_ROWS });
        const includeLavage = confirm(
          'Inclure aussi les lignes de LAVAGE comme interventions ?\n\n' +
          'OK = oui, inclure les lavages\nAnnuler = non, ignorer les lavages');

        const month = root.repairHistImportMonth || null;   // sélecteur de mois existant (optionnel)
        const res = buildRepairs(wb, {
          month: month,
          includeLavage: includeLavage,
          vehicles: pa.data.vehicles || [],
          existing: pa.data.repairs || []
        });
        const s = res.stats;

        if (!s.sheets) { say('❌ Format non reconnu (aucune feuille véhicule avec tableau "Bon Livraison")'); return; }
        if (!res.repairs.length && !res.fiches.length) {
          say('ℹ️ Rien à ajouter — ' + s.dup + ' déjà présent(s), ' + s.month + ' hors mois, ' + s.lavage + ' lavage(s) ignoré(s), fiches véhicules déjà à jour');
          return;
        }

        const nbVeh = new Set(res.repairs.map(r => r.matricule)).size;
        const msg =
          res.repairs.length + ' intervention(s) à ajouter pour ' + nbVeh + ' véhicule(s)' +
          (month ? ' (mois ' + month + ')' : ' (toutes années)') + '.\n\n' +
          '• Déjà présentes (ignorées) : ' + s.dup + '\n' +
          '• Lavages ignorés : ' + s.lavage + '\n' +
          (month ? '• Hors du mois choisi : ' + s.month + '\n' : '') +
          '• Date vide dans le fichier, reportée depuis la ligne précédente : ' + s.dateFilled + '\n' +
          '• Sans aucune date dans le fichier (NON importées, à saisir à la main) : ' + s.noDate +
          (s.noDate ? ' — ' + s.noDateAmount.toFixed(2) + ' DT\n   ' + s.noDateList.slice(0, 6).join('\n   ') + (s.noDate > 6 ? '\n   …' : '') : '') + '\n' +
          '• Feuilles IGNORÉES (identifiants contradictoires dans le fichier, à corriger) : ' + s.ambiguous.length +
          (s.ambiguous.length ? '\n   ' + s.ambiguous.slice(0, 5).join('\n   ') + (s.ambiguous.length > 5 ? '\n   …' : '') : '') + '\n' +
          '• Feuilles sans véhicule correspondant dans l\'application : ' + s.unmatched.length +
          (s.unmatched.length ? '\n   ' + s.unmatched.slice(0, 8).join('\n   ') + (s.unmatched.length > 8 ? '\n   …' : '') : '') +
          '\n\nHISTORIQUE DES VÉHICULES : ' + res.fiches.length + ' fiche(s) à mettre à jour' +
          (res.fiches.length ? ' —\n   ' + Object.keys(s.fields).map(k => (FIELD_LABELS[k] || k) + ' : ' + s.fields[k]).join('\n   ') : '') +
          '\n(une valeur plus récente déjà dans l\'application n\'est jamais remplacée)\n\nContinuer ?';
        if (!confirm(msg)) { say('Import annulé'); return; }

        pa.data.repairs = (pa.data.repairs || []).concat(res.repairs);
        res.fiches.forEach(f => { Object.keys(f.changes).forEach(k => { f.veh[k] = f.changes[k][1]; }); });
        await pa.saveData();
        if (pa.renderAll) pa.renderAll();
        const bilan = res.repairs.length + ' intervention(s) ajoutée(s), ' + res.fiches.length + ' fiche(s) véhicule mise(s) à jour';
        say('✅ ' + bilan);
        toast('✅ ' + bilan, 'success');
      } catch (err) {
        console.error(err);
        say('❌ Erreur de lecture — ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    evt.target.value = '';
  }

  /* ── Bouton (injecté à côté de "Importer Excel (historique)") ── */
  function injectButton() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('repair-plat-file-input')) return;
    const anchor = document.querySelector('button[onclick*="repair-hist-file-input"]');
    if (!anchor) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'repair-plat-file-input';
    input.accept = '.xlsx,.xls,.xlsm';
    input.style.display = 'none';
    input.addEventListener('change', handlePlateformeImport);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-success';
    btn.id = 'btn-repair-plat-import';
    btn.textContent = '📥 Importer réparations exécutées (Plateforme)';
    btn.title = 'Fichier "Plateforme Parc Auto" (.xlsx / .xlsm) — une feuille par véhicule';
    btn.addEventListener('click', () => input.click());

    anchor.insertAdjacentElement('afterend', btn);
    anchor.insertAdjacentElement('afterend', input);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectButton);
    else injectButton();
  }

  root.handlePlateformeImport = handlePlateformeImport;
  root.__repairImportPlateforme = { parseSheet: parseSheet, planFiche: planFiche, buildRepairs: buildRepairs, detectType: detectType, toIso: toIso };
})();

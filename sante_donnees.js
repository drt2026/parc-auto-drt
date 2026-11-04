/**
 * ============================================================
 *  SANTE_DONNEES.JS — Alerte "volume de données" (admin.html)
 *  DRT Sfax — Parc Auto
 *
 *  Pourquoi : toute la base (pa.data) est stockée dans UN seul fichier Gist et dans
 *  localStorage (~5 Mo max). Les photos de sinistres (base64) la font grossir vite.
 *  Au-delà de ~1 Mo, l'API GitHub tronque le contenu du Gist ; au-delà de ~5 Mo,
 *  localStorage refuse l'écriture (échec silencieux).
 *
 *  Ce module n'écrit rien : il mesure et affiche un bandeau d'avertissement
 *  (fermable) quand le volume approche des limites.
 *  Module 100% additif — à inclure dans admin.html après app.js.
 * ============================================================
 */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  if (root.__santeDonneesLoaded) return;
  root.__santeDonneesLoaded = true;

  var WARN_BYTES = 700 * 1024;          // alerte avant la troncature Gist (~1 Mo)
  var DANGER_BYTES = 950 * 1024;
  var DISMISS_KEY = 'parcAutoSanteDismissed';

  function mo(n) { return (n / 1048576).toFixed(2).replace('.', ',') + ' Mo'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function measure() {
    var pa = root.parcAuto;
    if (!pa || !pa.data) return null;
    var total = 0, parts = [];
    Object.keys(pa.data).forEach(function (k) {
      var n = 0;
      try { n = JSON.stringify(pa.data[k]).length; } catch (e) {}
      total += n; parts.push({ key: k, bytes: n });
    });
    parts.sort(function (a, b) { return b.bytes - a.bytes; });
    return { total: total, parts: parts.slice(0, 3) };
  }

  function show(m) {
    if (document.getElementById('sante-donnees-banner')) return;
    var danger = m.total >= DANGER_BYTES;
    var el = document.createElement('div');
    el.id = 'sante-donnees-banner';
    el.style.cssText = 'position:fixed;left:16px;bottom:16px;max-width:380px;z-index:9998;padding:12px 14px;border-radius:12px;font:13px/1.45 "Segoe UI",sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.2);' +
      (danger ? 'background:#FEE2E2;border:1px solid #FCA5A5;color:#7F1D1D;' : 'background:#FFF7ED;border:1px solid #FDBA74;color:#7C2D12;');
    el.innerHTML = '<div style="display:flex;justify-content:space-between;gap:10px;"><strong>' + (danger ? '🚨' : '⚠️') + ' Volume de données : ' + mo(m.total) + '</strong>' +
      '<button type="button" aria-label="Fermer" style="background:none;border:none;cursor:pointer;font-size:16px;color:inherit;">✕</button></div>' +
      '<div style="margin-top:4px;">La base est synchronisée dans un seul fichier cloud : au-delà d\'environ 1 Mo, la lecture peut être tronquée. Plus grosses rubriques : ' +
      m.parts.map(function (p) { return '<strong>' + esc(p.key) + '</strong> (' + mo(p.bytes) + ')'; }).join(', ') + '.</div>' +
      '<div style="margin-top:4px;">Conseil : exporter puis purger les anciennes photos de sinistres.</div>';
    el.querySelector('button').onclick = function () {
      try { sessionStorage.setItem(DISMISS_KEY, String(Math.round(m.total / 51200))); } catch (e) {}
      el.remove();
    };
    document.body.appendChild(el);
  }

  function check() {
    var m = measure();
    if (!m || m.total < WARN_BYTES) return;
    try { if (sessionStorage.getItem(DISMISS_KEY) === String(Math.round(m.total / 51200))) return; } catch (e) {}
    show(m);
  }

  function start() { setTimeout(check, 4000); setInterval(check, 5 * 60 * 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  root.santeDonnees = { check: check, measure: measure };
})();

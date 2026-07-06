/* ============================================
   CLOUDFLARE WORKER — PARC AUTO DRT SFAX v3
   OTP serveur (KV) + Resend + GitHub Gist
   🔒 Sécurisé : clé d'application (X-App-Key) + CORS verrouillé par origine
   ============================================ */

const GIST_ID    = '1d608fe6f5619b50672de8bf7415f3b6';
const FILENAME   = 'parc-data.json';
const OTP_EMAIL  = 'drtsfaxparauto@gmail.com';
const OTP_TTL    = 600; // 10 minutes en secondes

// Origine(s) autorisée(s) par défaut (surchargeable via la variable ALLOWED_ORIGIN)
const DEFAULT_ALLOWED_ORIGIN = 'https://drt2026.github.io';

// ═══════════════════════════════════════════════════════
// BLOC ADDITIF — Destinataires Demande de Travaux
// ═══════════════════════════════════════════════════════
const TRAVAUX_RECIPIENTS = ['drtsfaxparauto@gmail.com'];
// FIN BLOC ADDITIF

// ═══════════════════════════════════════════════════════
// BLOC ADDITIF — Cache lecture Gist (anti rate-limit GitHub)
// Chaque appareil (demandeur/validateur/chef garage/admin) sonde le Worker
// toutes les 15-30s. Sans cache, ça fait autant d'appels à l'API GitHub, ce
// qui peut déclencher un rate-limit / ralentissement GitHub et casser la
// synchro entre appareils (chaque appareil ne voit alors que ses propres
// données locales). On met en cache la lecture quelques secondes au niveau
// du Worker (indépendant du paramètre anti-cache _nc utilisé côté client),
// et on invalide ce cache dès qu'une écriture a lieu.
// ═══════════════════════════════════════════════════════
const READ_CACHE_KEY = 'https://parc-auto-cache.internal/gist-data';
const READ_CACHE_TTL = 8; // secondes

async function getCachedGist() {
  try {
    const cache = caches.default;
    const hit = await cache.match(READ_CACHE_KEY);
    if (hit) return await hit.text();
  } catch (e) {
    console.error('Cache read error:', e);
  }
  return null;
}

async function setCachedGist(content) {
  try {
    const cache = caches.default;
    const resp = new Response(content, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${READ_CACHE_TTL}`
      }
    });
    await cache.put(READ_CACHE_KEY, resp);
  } catch (e) {
    console.error('Cache write error:', e);
  }
}

async function purgeCachedGist() {
  try {
    const cache = caches.default;
    await cache.delete(READ_CACHE_KEY);
  } catch (e) {
    console.error('Cache purge error:', e);
  }
}
// FIN BLOC ADDITIF — Cache lecture Gist

export default {
  async fetch(request, env) {

    // Origines autorisées (liste séparée par des virgules)
    const allowed = String(env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
      .split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, allowed);

    // Préflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ═══════════════════════════════════════════════════════
    // 🔒 CONTRÔLE D'ACCÈS (toutes les routes)
    // ═══════════════════════════════════════════════════════
    if (env.APP_KEY) {
      const key = request.headers.get('X-App-Key');
      if (key !== env.APP_KEY) {
        return json({ error: 'Non autorisé' }, 401, cors);
      }
    }
    if (origin && !allowed.includes(origin)) {
      return json({ error: 'Origine non autorisée' }, 403, cors);
    }

    const { pathname } = new URL(request.url);

    // ═══════════════════════════════════════════════════════
    // 1. ROUTE OTP — Génération (POST /send-otp)
    // ═══════════════════════════════════════════════════════
    if (pathname === '/send-otp' && request.method === 'POST') {
      const resendToken = env.RESEND_TOKEN;
      if (!resendToken) return json({ error: 'RESEND_TOKEN non configuré' }, 500, cors);

      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400, cors); }

      const { matricule, chauffeur } = body;
      if (!matricule) return json({ error: 'Paramètre matricule manquant' }, 400, cors);

      // 🔐 Génération OTP côté serveur (6 chiffres)
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const now = Date.now();
      const expiry = now + (OTP_TTL * 1000);

      // 💾 Stockage dans KV avec TTL
      const kvKey = `otp_${matricule}_${now}`;
      try {
        await env.OTP_KV.put(kvKey, JSON.stringify({
          code: otp,
          matricule: matricule,
          expiry: expiry,
          attempts: 0
        }), { expirationTtl: OTP_TTL });
      } catch (e) {
        console.error('KV store error:', e);
        return json({ error: 'Erreur stockage OTP' }, 500, cors);
      }

      // 📧 Envoi email via Resend
      const emailBody = {
        from: 'Parc Auto DRT Sfax <onboarding@resend.dev>',
        to: [OTP_EMAIL],
        subject: `🔐 Code OTP — Connexion véhicule ${matricule}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="font-size:48px;">🔐</div>
              <h1 style="color:#1e293b;font-size:20px;margin:8px 0;">Code de vérification</h1>
              <p style="color:#64748b;font-size:13px;">Parc Auto DRT Sfax — Tunisie Telecom</p>
            </div>
            <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #e2e8f0;">
              <p style="color:#64748b;font-size:13px;margin:0 0 8px;">Véhicule : <strong>${matricule}</strong></p>
              <p style="color:#64748b;font-size:13px;margin:0 0 20px;">Chauffeur : <strong>${chauffeur || 'N/A'}</strong></p>
              <div style="text-align:center;background:#eff6ff;border-radius:12px;padding:20px;">
                <p style="color:#64748b;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Votre code OTP</p>
                <div style="font-size:40px;font-weight:800;color:#1d4ed8;letter-spacing:12px;">${otp}</div>
              </div>
              <p style="color:#94a3b8;font-size:12px;text-align:center;margin:12px 0 0;">⏱ Valable 10 minutes</p>
            </div>
            <p style="color:#94a3b8;font-size:11px;text-align:center;">
              Ce code a été demandé pour la connexion à l'application Parc Auto.<br>
              Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
            </p>
          </div>
        `
      };

      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailBody)
      });

      if (!resendResp.ok) {
        const err = await resendResp.text();
        console.error('Resend error:', err);
        await env.OTP_KV.delete(kvKey).catch(() => {});
        return json({ error: 'Erreur envoi email', detail: err }, 500, cors);
      }

      return json({
        ok: true,
        sessionToken: kvKey,
        message: 'Code envoyé par email'
      }, 200, cors);
    }

    // ═══════════════════════════════════════════════════════
    // 2. ROUTE OTP — Vérification (POST /verify-otp)
    // ═══════════════════════════════════════════════════════
    if (pathname === '/verify-otp' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400, cors); }

      const { sessionToken, code } = body;
      if (!sessionToken || !code) return json({ error: 'Paramètres manquants' }, 400, cors);

      let stored;
      try {
        const raw = await env.OTP_KV.get(sessionToken);
        if (!raw) return json({ error: 'Session invalide ou expirée' }, 400, cors);
        stored = JSON.parse(raw);
      } catch (e) {
        return json({ error: 'Session invalide' }, 400, cors);
      }

      if (Date.now() > stored.expiry) {
        await env.OTP_KV.delete(sessionToken).catch(() => {});
        return json({ error: 'Code expiré. Recommencez.' }, 400, cors);
      }

      if (stored.attempts >= 3) {
        await env.OTP_KV.delete(sessionToken).catch(() => {});
        return json({ error: 'Trop de tentatives. Reconnectez-vous.' }, 400, cors);
      }

      if (code.trim() !== stored.code) {
        stored.attempts++;
        await env.OTP_KV.put(sessionToken, JSON.stringify(stored), { expirationTtl: OTP_TTL });
        const left = 3 - stored.attempts;
        return json({ error: `Code incorrect. ${left} essai(s) restant(s).`, attempts: stored.attempts }, 400, cors);
      }

      await env.OTP_KV.delete(sessionToken).catch(() => {});
      return json({
        ok: true,
        matricule: stored.matricule,
        message: 'Authentification réussie'
      }, 200, cors);
    }

    // ═══════════════════════════════════════════════════════
    // BLOC ADDITIF — ROUTE Demande de Travaux (POST /send-travaux)
    // Envoie un email formaté aux 4 collaborateurs via Resend
    // ═══════════════════════════════════════════════════════
    if (pathname === '/send-travaux' && request.method === 'POST') {
      const resendToken = env.RESEND_TOKEN;
      if (!resendToken) return json({ error: 'RESEND_TOKEN non configuré' }, 500, cors);

      let body;
      try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400, cors); }

      const { nomDemandeur, matricule, marque, division, natureIntervention, dateDemande, indexKm } = body;

      // Validation champs obligatoires
      const missing = [];
      if (!nomDemandeur)       missing.push('Nom du demandeur');
      if (!matricule)          missing.push('Matricule');
      if (!marque)             missing.push('Marque');
      if (!division)           missing.push('Division');
      if (!natureIntervention) missing.push('Nature de l\'intervention');
      if (!dateDemande)        missing.push('Date de la demande');
      if (!indexKm)            missing.push('Index kilométrique');

      if (missing.length > 0) {
        return json({ error: 'Champs obligatoires manquants', fields: missing }, 400, cors);
      }

      // Numéro de demande séquentiel stocké dans KV (DT-2026-001, DT-2026-002…)
      const year = new Date().getFullYear();
      const counterKey = `travaux_counter_${year}`;
      let seq = 1;
      try {
        const stored = await env.OTP_KV.get(counterKey);
        if (stored) seq = parseInt(stored, 10) + 1;
        await env.OTP_KV.put(counterKey, String(seq)); // pas de TTL = permanent
      } catch (e) {
        console.error('KV counter error:', e);
        // Fallback timestamp si KV indisponible
        seq = parseInt(Date.now().toString().slice(-4), 10);
      }
      const numDemande = `DT-${year}-${String(seq).padStart(3, '0')}`;

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:0;border-radius:16px;overflow:hidden;">
          <!-- En-tête -->
          <div style="background:linear-gradient(135deg,#1A1A2E 0%,#16213E 100%);padding:28px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🔧</div>
            <h1 style="color:#ffffff;font-size:20px;margin:0 0 4px;font-weight:700;">Demande de Travaux</h1>
            <p style="color:#94a3b8;font-size:13px;margin:0;">Parc Auto DRT Sfax — Tunisie Telecom</p>
            <div style="display:inline-block;background:#E67E22;color:#fff;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:700;margin-top:12px;">
              N° ${numDemande}
            </div>
          </div>

          <!-- Corps -->
          <div style="padding:28px 32px;background:#ffffff;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;width:45%;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Demandeur</span><br>
                  <strong style="color:#1e293b;font-size:15px;">${nomDemandeur}</strong>
                </td>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;width:55%;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Division</span><br>
                  <strong style="color:#1e293b;font-size:15px;">${division}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Matricule</span><br>
                  <strong style="color:#1e293b;font-size:15px;">${matricule}</strong>
                </td>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Marque</span><br>
                  <strong style="color:#1e293b;font-size:15px;">${marque}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Date de la demande</span><br>
                  <strong style="color:#1e293b;font-size:15px;">${dateDemande}</strong>
                </td>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Index kilométrique</span><br>
                  <strong style="color:#1e293b;font-size:15px;">${parseInt(indexKm).toLocaleString('fr-FR')} km</strong>
                </td>
              </tr>
            </table>

            <!-- Nature intervention -->
            <div style="margin-top:20px;background:#FEF3E2;border-left:4px solid #E67E22;border-radius:0 8px 8px 0;padding:16px 20px;">
              <span style="color:#92400e;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Nature de l'intervention demandée</span>
              <p style="color:#1e293b;font-size:15px;margin:8px 0 0;line-height:1.6;">${natureIntervention}</p>
            </div>
          </div>

          <!-- Pied -->
          <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">
              Demande générée automatiquement par l'application Parc Auto DRT Sfax<br>
              Tunisie Telecom — Direction Régionale de Sfax
            </p>
          </div>
        </div>
      `;

      const emailPayload = {
        from: 'Parc Auto DRT Sfax <onboarding@resend.dev>',
        to: TRAVAUX_RECIPIENTS,
        subject: `🔧 Demande de Travaux N°${numDemande} — ${matricule} (${marque})`,
        html: emailHtml
      };

      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      });

      if (!resendResp.ok) {
        const err = await resendResp.text();
        console.error('Resend travaux error:', err);
        return json({ error: 'Erreur envoi email', detail: err }, 500, cors);
      }

      return json({ ok: true, numDemande, message: 'Demande envoyée avec succès' }, 200, cors);
    }
    // FIN BLOC ADDITIF — /send-travaux

    // ═══════════════════════════════════════════════════════
    // 3. ROUTES GIST (GET / PATCH) — Données
    // ═══════════════════════════════════════════════════════
    const token = env.GITHUB_TOKEN;
    if (!token) return json({ error: 'GITHUB_TOKEN non configuré' }, 500, cors);

    const url = `https://api.github.com/gists/${GIST_ID}`;
    const gh = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'ParcAutoDRTSfax/3.0'
    };

    try {
      if (request.method === 'GET') {
        // BLOC ADDITIF — servir depuis le cache Worker si disponible (anti rate-limit GitHub)
        const cached = await getCachedGist();
        if (cached !== null) {
          return new Response(cached, {
            status: 200,
            headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Served-From': 'worker-cache' }
          });
        }
        // FIN BLOC ADDITIF

        const resp = await fetch(url, { method: 'GET', headers: gh });
        if (!resp.ok) {
          // BLOC ADDITIF — log explicite (visible dans wrangler tail) pour diagnostiquer
          // un éventuel rate-limit / erreur GitHub (ex: 403, 429, 401)
          console.error(`Erreur lecture GitHub: status=${resp.status}`);
          // FIN BLOC ADDITIF
          return json({ error: 'Erreur GitHub', status: resp.status }, resp.status, cors);
        }

        const gist = await resp.json();
        const file = gist.files?.[FILENAME];
        const content = file?.content || '{}';

        // BLOC ADDITIF — mettre en cache la réponse pour les prochaines lectures (quelques secondes)
        await setCachedGist(content);
        // FIN BLOC ADDITIF

        return new Response(content, {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });
      }

      if (request.method === 'PATCH' || request.method === 'POST') {
        const body = await request.text();
        try { JSON.parse(body); } catch { return json({ error: 'JSON invalide' }, 400, cors); }

        // BLOC ADDITIF — invalider le cache lecture tout de suite (avant même la
        // confirmation GitHub) pour qu'aucun appareil ne reste bloqué sur une
        // ancienne version pendant que l'écriture est en cours
        await purgeCachedGist();
        // FIN BLOC ADDITIF

        const writeToGithub = fetch(url, {
          method: 'PATCH',
          headers: gh,
          body: JSON.stringify({ files: { [FILENAME]: { content: body } } })
        });

        // BLOC ADDITIF — logger le résultat réel de l'écriture GitHub même si on
        // répond au client avant qu'elle soit terminée (voir race plus bas).
        // Sans ce log, une écriture qui échoue après le timeout de 5s était
        // invisible : le client affichait "synchronisé" alors que rien n'était
        // écrit sur GitHub, et les autres appareils ne recevaient jamais la donnée.
        writeToGithub
          .then(r => {
            if (!r.ok) console.error(`❌ Écriture GitHub échouée après réponse client: status=${r.status}`);
            else console.log('✅ Écriture GitHub confirmée');
          })
          .catch(e => console.error('❌ Écriture GitHub échouée (exception) après réponse client:', e.message));
        // FIN BLOC ADDITIF

        const raceResult = await Promise.race([
          writeToGithub.then(r => ({ ok: r.ok, status: r.status })),
          new Promise(resolve => setTimeout(() => resolve({ ok: true, timedout: true }), 5000))
        ]);

        if (!raceResult.ok && !raceResult.timedout) {
          return json({ error: 'Erreur écriture GitHub', status: raceResult.status }, raceResult.status, cors);
        }

        return json({ ok: true }, 200, cors);
      }

      return json({ error: 'Méthode non supportée' }, 405, cors);

    } catch (e) {
      return json({ error: e.message }, 500, cors);
    }
  }
};

function json(obj, status = 200, cors = null) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: cors || {
      'Access-Control-Allow-Origin': DEFAULT_ALLOWED_ORIGIN,
      'Content-Type': 'application/json'
    }
  });
}

function corsHeaders(origin, allowed) {
  const allowOrigin = (origin && allowed.includes(origin)) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Action, X-App-Key',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}

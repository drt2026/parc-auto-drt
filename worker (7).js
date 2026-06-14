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
    // 1) Clé d'application obligatoire (si APP_KEY est configurée)
    // 2) Origine navigateur restreinte à la liste autorisée
    // ═══════════════════════════════════════════════════════
    if (env.APP_KEY) {
      const key = request.headers.get('X-App-Key');
      if (key !== env.APP_KEY) {
        return json({ error: 'Non autorisé' }, 401, cors);
      }
    }
    // Si la requête provient d'un navigateur, l'origine doit être autorisée
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
        // Nettoyer le KV en cas d'échec d'envoi
        await env.OTP_KV.delete(kvKey).catch(() => {});
        return json({ error: 'Erreur envoi email', detail: err }, 500, cors);
      }

      // 🔑 Retourner un token de session (pas le code !)
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

      // Récupérer depuis KV
      let stored;
      try {
        const raw = await env.OTP_KV.get(sessionToken);
        if (!raw) return json({ error: 'Session invalide ou expirée' }, 400, cors);
        stored = JSON.parse(raw);
      } catch (e) {
        return json({ error: 'Session invalide' }, 400, cors);
      }

      // Vérifier expiration
      if (Date.now() > stored.expiry) {
        await env.OTP_KV.delete(sessionToken).catch(() => {});
        return json({ error: 'Code expiré. Recommencez.' }, 400, cors);
      }

      // Vérifier tentatives
      if (stored.attempts >= 3) {
        await env.OTP_KV.delete(sessionToken).catch(() => {});
        return json({ error: 'Trop de tentatives. Reconnectez-vous.' }, 400, cors);
      }

      // Vérifier le code
      if (code.trim() !== stored.code) {
        stored.attempts++;
        await env.OTP_KV.put(sessionToken, JSON.stringify(stored), { expirationTtl: OTP_TTL });
        const left = 3 - stored.attempts;
        return json({ error: `Code incorrect. ${left} essai(s) restant(s).`, attempts: stored.attempts }, 400, cors);
      }

      // ✅ Code valide — supprimer le KV et retourner succès
      await env.OTP_KV.delete(sessionToken).catch(() => {});

      return json({
        ok: true,
        matricule: stored.matricule,
        message: 'Authentification réussie'
      }, 200, cors);
    }

    // ═══════════════════════════════════════════════════════
    // 3. ROUTES GIST (GET / PATCH) — Données inchangées
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
        const resp = await fetch(url, { method: 'GET', headers: gh });
        if (!resp.ok) return json({ error: 'Erreur GitHub', status: resp.status }, resp.status, cors);

        const gist = await resp.json();
        const file = gist.files?.[FILENAME];
        const content = file?.content || '{}';

        return new Response(content, {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });
      }

      if (request.method === 'PATCH' || request.method === 'POST') {
        const body = await request.text();
        try { JSON.parse(body); } catch { return json({ error: 'JSON invalide' }, 400, cors); }

        const resp = await fetch(url, {
          method: 'PATCH',
          headers: gh,
          body: JSON.stringify({ files: { [FILENAME]: { content: body } } })
        });

        if (!resp.ok) return json({ error: 'Erreur écriture', status: resp.status }, resp.status, cors);
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
  // Renvoyer l'origine demandée si elle est autorisée, sinon la première de la liste
  const allowOrigin = (origin && allowed.includes(origin)) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Action, X-App-Key',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}

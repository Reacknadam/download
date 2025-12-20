/*
 * Cloudflare Worker sécurisé pour la gestion des dépôts et paiements via PawaPay + Firestore
 *
 * Attentes côté Cloudflare (Variables d'environnement):
 * - PAWAPAY_API_TOKEN        : Token API PawaPay
 * - FIREBASE_SERVICE_ACCOUNT : JSON du service account Firebase (stringifié)
 * - ADMIN_API_KEY            : Clé secrète pour les endpoints admin
 * - CRON_SECRET              : Clé secrète pour l'endpoint d'auto-crédit (appelé par cron ou backend)
 * - ALLOWED_ORIGINS          : Liste d'origines autorisées séparées par des virgules (optionnel)
 */

const BUNNY_CONFIG = {
  LIBRARY_ID: '544980',
  API_KEY: 'b5a41a84-2627-426f-aa22e9a687f0-fed4-45c2',
  PLAYBACK_HOST: 'vz-1e9ce12d-959.b-cdn.net',
  SIGNING_KEY: 'c4ef6f57-84a4-4e68-b095-4cf973657847',
};

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // max 60 req/min par IP
const ROUTE_LIMITS = {
  '/deposits/create': { windowMs: 60_000, max: 20 },
  '/wallet/auto-credit': { windowMs: 60_000, max: 10 },
  '/error/report': { windowMs: 60_000, max: 30 },
  '/payouts/request': { windowMs: 60_000, max: 10 },
  '/send-notification': { windowMs: 60_000, max: 60 },
  '/bunny/import': { windowMs: 60_000, max: 15 },
  '/bunny/create': { windowMs: 60_000, max: 30 },
  '/bunny/upload': { windowMs: 60_000, max: 10 },
  '/browser-upload/session': { windowMs: 60_000, max: 30 },
  '/browser-upload/validate': { windowMs: 60_000, max: 60 },
  '/browser-upload/register-video': { windowMs: 60_000, max: 60 },
  '/browser-upload/pending': { windowMs: 60_000, max: 60 },
};

// In-memory rate limit store (par instance de Worker)
const rateLimitStore = new Map();

function getClientIp(request) {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

async function signBunnyUrl(videoId) {
  const expires = Math.floor(Date.now() / 1000) + 3600; // 1h
  const path = `/${videoId}`;
  const payload = `${BUNNY_CONFIG.SIGNING_KEY}${path}${expires}`;
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  const token = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `https://${BUNNY_CONFIG.PLAYBACK_HOST}${path}?token=${token}&expires=${expires}`;
}

async function handleBunnyPlayback(request, env, corsHeaders, videoId) {
  if (!videoId) {
    return errorResponse('videoId manquant', 400, {}, corsHeaders);
  }

  try {
    const playbackUrl = await signBunnyUrl(videoId);
    if (!playbackUrl) {
      return errorResponse('Configuration Bunny manquante', 500, {}, corsHeaders);
    }

    return jsonResponse({ playbackUrl, expiresIn: 3600 }, { status: 200, headers: corsHeaders });
  } catch (e) {
    await logAdminEvent(env, {
      type: 'bunny_playback_error',
      severity: 'error',
      message: e.message || 'Erreur signature playback Bunny',
      context: { videoId },
    });
    return errorResponse('Erreur interne', 500, { details: e.message }, corsHeaders);
  }
}

async function handleGetPendingBrowserUpload(request, env, corsHeaders) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const courseId = url.searchParams.get('courseId');

  if (!userId || !courseId) {
    return errorResponse('Paramètres manquants (userId, courseId)', 400, {}, corsHeaders);
  }

  try {
    const sa = getServiceAccount(env);
    const token = await getAccessToken(sa);
    const projectId = sa.project_id;

    const qRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'browserUploads' }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  {
                    fieldFilter: {
                      field: { fieldPath: 'userId' },
                      op: 'EQUAL',
                      value: { stringValue: String(userId) },
                    },
                  },
                  {
                    fieldFilter: {
                      field: { fieldPath: 'courseId' },
                      op: 'EQUAL',
                      value: { stringValue: String(courseId) },
                    },
                  },
                ],
              },
            },
            orderBy: [
              {
                field: { fieldPath: 'createdAt' },
                direction: 'DESCENDING',
              },
            ],
            limit: 1,
          },
        }),
      },
    );

    if (!qRes.ok) {
      const txt = await qRes.text();
      throw new Error(`Query browserUploads error: ${txt}`);
    }

    const docs = await qRes.json();
    const first = docs.find((d) => d.document)?.document;

    if (!first) {
      return jsonResponse({ success: true, upload: null }, { status: 200, headers: corsHeaders });
    }

    const f = first.fields || {};
    const upload = {
      id: first.name.split('/').pop(),
      userId: f.userId?.stringValue || null,
      courseId: f.courseId?.stringValue || null,
      videoId: f.videoId?.stringValue || null,
      title: f.title?.stringValue || null,
      lessonId: f.lessonId?.stringValue || null,
      fileSize: f.fileSize?.integerValue ? Number(f.fileSize.integerValue) : null,
      createdAt: f.createdAt?.timestampValue || null,
    };

    return jsonResponse({ success: true, upload }, { status: 200, headers: corsHeaders });
  } catch (e) {
    return errorResponse('Erreur récupération upload', 500, { details: e.message }, corsHeaders);
  }
}

async function handleRegisterBrowserUploadVideo(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  const body = await parseJsonSafe(request);
  if (!body) return errorResponse('JSON invalide', 400, {}, corsHeaders);

  const { userId, courseId, lessonId, videoId, title, fileSize, token } = body;

  if (!userId || !courseId || !videoId) {
    return errorResponse('Paramètres manquants (userId, courseId, videoId)', 400, {}, corsHeaders);
  }

  try {
    const sa = getServiceAccount(env);
    const access = await getAccessToken(sa);

    const nowIso = new Date().toISOString();
    const payload = {
      fields: {
        userId: { stringValue: String(userId) },
        courseId: { stringValue: String(courseId) },
        videoId: { stringValue: String(videoId) },
        title: title ? { stringValue: String(title) } : { nullValue: null },
        lessonId: lessonId ? { stringValue: String(lessonId) } : { nullValue: null },
        fileSize: typeof fileSize === 'number'
          ? { integerValue: String(Math.max(0, Math.floor(fileSize))) }
          : { nullValue: null },
        createdAt: { timestampValue: nowIso },
      },
    };

    // 1. Enregistrer l'upload dans browserUploads
    await firestoreRequest(sa, access, 'documents/browserUploads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // 2. Marquer le token comme utilisé si fourni
    if (token) {
      try {
        await firestoreRequest(sa, access, `documents/uploadSessions/${token}?updateMask.fieldPaths=used`, {
          method: 'PATCH',
          body: JSON.stringify({
            fields: { used: { booleanValue: true } }
          })
        });
      } catch (ignore) {
        // On ne bloque pas si l'invalidation échoue, mais c'est noté
        console.error('Erreur invalidation token:', ignore);
      }
    }

    return jsonResponse({ success: true }, { status: 200, headers: corsHeaders });
  } catch (e) {
    return errorResponse('Erreur enregistrement upload', 500, { details: e.message }, corsHeaders);
  }
}

async function handleBunnyCreate(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  const body = await parseJsonSafe(request);
  if (!body) return errorResponse('JSON invalide', 400, {}, corsHeaders);

  const { title, courseId, teacherId } = body;

  try {
    const payload = {
      title: title || `Upload ${new Date().toISOString()}`,
    };

    const res = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_CONFIG.LIBRARY_ID}/videos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          AccessKey: BUNNY_CONFIG.API_KEY,
        },
        body: JSON.stringify(payload),
      },
    );

    const text = await res.text();
    if (!res.ok) {
      await logAdminEvent(env, {
        type: 'bunny_create_error',
        severity: 'error',
        message: 'Erreur création vidéo Bunny (direct)',
        context: { status: res.status, body: text, courseId, teacherId },
      });
      // Propager les détails de l\'erreur Bunny jusqu\'au client pour debug
      const message = `Erreur création Bunny (status ${res.status}): ${text}`;
      return errorResponse(message, 502, { status: res.status, rawBody: text }, corsHeaders);
    }

    const created = text ? JSON.parse(text) : {};
    const videoId =
      created?.guid ||
      created?.videoGuid ||
      created?.videoId ||
      created?.id;

    if (!videoId) {
      return errorResponse('videoId manquant dans la réponse Bunny', 500, {}, corsHeaders);
    }

    return jsonResponse({ success: true, videoId }, { status: 200, headers: corsHeaders });
  } catch (e) {
    await logAdminEvent(env, {
      type: 'bunny_create_error',
      severity: 'error',
      message: e.message || 'Erreur interne Bunny (create)',
      context: { courseId, teacherId },
    });
    return errorResponse('Erreur interne', 500, { details: e.message }, corsHeaders);
  }
}

async function handleBunnyUpload(request, env, corsHeaders) {
  if (request.method !== 'PUT') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  const url = new URL(request.url);
  const videoId = url.searchParams.get('videoId');
  if (!videoId) {
    return errorResponse('videoId requis', 400, {}, corsHeaders);
  }

  try {
    const upstream = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_CONFIG.LIBRARY_ID}/videos/${videoId}`,
      {
        method: 'PUT',
        headers: {
          AccessKey: BUNNY_CONFIG.API_KEY,
          'Content-Type': request.headers.get('Content-Type') || 'application/octet-stream',
        },
        body: request.body,
      },
    );

    const txt = await upstream.text();
    if (!upstream.ok) {
      await logAdminEvent(env, {
        type: 'bunny_upload_error',
        severity: 'error',
        message: 'Erreur upload vidéo Bunny',
        context: { status: upstream.status, body: txt, videoId },
      });
      return errorResponse('Erreur upload Bunny', 502, { details: txt }, corsHeaders);
    }

    return jsonResponse({ success: true }, { status: 200, headers: corsHeaders });
  } catch (e) {
    await logAdminEvent(env, {
      type: 'bunny_upload_error',
      severity: 'error',
      message: e.message || 'Erreur interne upload Bunny',
      context: { videoId },
    });
    return errorResponse('Erreur interne', 500, { details: e.message }, corsHeaders);
  }
}

async function sha256Hex(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const pad = str.length % 4 === 2 ? '==' : str.length % 4 === 3 ? '=' : '';
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return atob(normalized);
}

function generateShortCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function handleCreateBrowserUploadSession(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  const body = await parseJsonSafe(request);
  if (!body) return errorResponse('JSON invalide', 400, {}, corsHeaders);

  const { userId, courseId, lessonId, returnUrl } = body;

  if (!userId || !courseId) {
    return errorResponse('Paramètres manquants (userId, courseId)', 400, {}, corsHeaders);
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = 30 * 60; // 30 minutes
  const exp = now + expiresInSeconds;

  // Génération d'un code court sécurisé (6 caractères)
  const token = generateShortCode(6);

  try {
    // Stockage de la session en base de données (Firestore)
    const sa = getServiceAccount(env);
    const access = await getAccessToken(sa);

    const payload = {
      fields: {
        userId: { stringValue: String(userId) },
        courseId: { stringValue: String(courseId) },
        lessonId: lessonId ? { stringValue: String(lessonId) } : { nullValue: null },
        exp: { integerValue: String(exp) },
        createdAt: { timestampValue: new Date().toISOString() },
        used: { booleanValue: false }
      }
    };

    // On utilise create (POST) avec un ID spécifique ou set (PATCH) ?
    // Firestore create document with ID: POST ...?documentId=ID
    await firestoreRequest(sa, access, `documents/uploadSessions?documentId=${token}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // URL de la page d'upload servie par ce même worker
    const origin = new URL(request.url).origin;
    const frontendBase = env.BROWSER_UPLOAD_BASE_URL || origin;
    const url = new URL(frontendBase);
    url.pathname = '/browser-upload';
    url.searchParams.set('token', token);
    if (returnUrl) {
      url.searchParams.set('returnUrl', returnUrl);
    }

    return jsonResponse(
      {
        success: true,
        uploadUrl: url.toString(),
        token,
        expiresAt: new Date(exp * 1000).toISOString(),
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    await logAdminEvent(env, {
      type: 'create_session_error',
      severity: 'error',
      message: e.message || 'Erreur création session upload',
      context: { userId, courseId }
    });
    return errorResponse('Erreur serveur lors de la création du lien', 500, { details: e.message }, corsHeaders);
  }
}

function renderBrowserUploadHtml() {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Upload Jimmy School</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #0f172a;
        color: #e5e7eb;
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        background: #020617;
        border-radius: 16px;
        padding: 24px 20px;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.9);
        max-width: 460px;
        width: 100%;
        border: 1px solid rgba(148, 163, 184, 0.2);
      }
      h1 {
        font-size: 1.4rem;
        margin: 0 0 4px;
        color: #e5e7eb;
      }
      p {
        margin: 4px 0;
        font-size: 0.9rem;
        color: #9ca3af;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.7rem;
        background: rgba(56, 189, 248, 0.12);
        color: #7dd3fc;
        border: 1px solid rgba(56, 189, 248, 0.3);
        margin-bottom: 8px;
      }
      .field {
        margin-top: 16px;
      }
      label {
        display: block;
        font-size: 0.8rem;
        margin-bottom: 4px;
        color: #e5e7eb;
      }
      input[type='file'] {
        width: 100%;
        padding: 8px 0;
        color: #e5e7eb;
      }
      input[type='text'] {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #1f2937;
        background: #020617;
        color: #e5e7eb;
        font-size: 0.85rem;
      }
      button {
        margin-top: 18px;
        width: 100%;
        padding: 10px 12px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: white;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .status {
        margin-top: 12px;
        font-size: 0.8rem;
      }
      .status.error {
        color: #fca5a5;
      }
      .status.success {
        color: #bbf7d0;
      }
      .meta {
        margin-top: 12px;
        font-size: 0.75rem;
        color: #9ca3af;
      }
      .progress {
        margin-top: 10px;
        height: 6px;
        border-radius: 999px;
        background: #111827;
        overflow: hidden;
      }
      .progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #22c55e, #a3e635);
        transition: width 0.2s ease-out;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <span class="badge">Upload via navigateur Jimmy School</span>
      <h1>Envoi de vidéo</h1>
      <p id="info">Initialisation en cours...</p>

      <div id="form" style="display:none;">
        <div class="field">
          <label for="title">Titre de la vidéo (optionnel)</label>
          <input id="title" type="text" placeholder="Ex: Introduction au module" />
        </div>

        <div class="field">
          <label for="file">Fichier vidéo</label>
          <input id="file" type="file" accept="video/*" />
        </div>

        <button id="uploadBtn" disabled>Envoyer la vidéo</button>

        <div class="progress" id="progress" style="display:none;">
          <div class="progress-bar" id="progressBar"></div>
        </div>

        <div class="status" id="status"></div>
        <div class="meta" id="meta"></div>
      </div>

      <div class="status error" id="error" style="display:none;"></div>
    </div>

    <script>
      const WORKER_BASE = window.location.origin;

      function getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
      }

      async function validateToken(token) {
        const res = await fetch(\`${'${'}WORKER_BASE}/browser-upload/validate?token=\${encodeURIComponent(token)}\`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          const msg = data.error || 'Token invalide';
          throw new Error(msg);
        }
        return data;
      }

      async function createBunnyVideo(payload) {
        const res = await fetch(\`${'${'}WORKER_BASE}/bunny/create\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !data.videoId) {
          const msg = data.error || 'Erreur création vidéo';
          throw new Error(msg);
        }
        return data.videoId;
      }

      async function uploadVideoFile(videoId, file, onProgress) {
        const url = \`${'${'}WORKER_BASE}/bunny/upload?videoId=\${encodeURIComponent(videoId)}\`;
        onProgress(10);
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Erreur upload');
        }
        onProgress(100);
      }

      async function registerBrowserUploadVideo(payload) {
        const res = await fetch(WORKER_BASE + '/browser-upload/register-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          const msg = data.error || "Erreur d'enregistrement";
          throw new Error(msg);
        }
      }

      (async function init() {
        const infoEl = document.getElementById('info');
        const errorEl = document.getElementById('error');
        const formEl = document.getElementById('form');
        const statusEl = document.getElementById('status');
        const metaEl = document.getElementById('meta');
        const progressEl = document.getElementById('progress');
        const progressBarEl = document.getElementById('progressBar');
        const uploadBtn = document.getElementById('uploadBtn');
        const titleInput = document.getElementById('title');
        const fileInput = document.getElementById('file');

        function setProgress(p) {
          progressEl.style.display = 'block';
          progressBarEl.style.width = \`${'${'}Math.max(5, Math.min(100, p))}%\`;
        }

        try {
          const token = getQueryParam('token');
          if (!token) {
            throw new Error("Lien invalide: token manquant. Retournez sur l'application Jimmy.");
          }

          infoEl.textContent = 'Vérification du lien sécurisé...';

          const payload = await validateToken(token);
          const { userId, courseId, lessonId, exp } = payload;

          if (!userId || !courseId) {
            throw new Error('Données incomplètes dans le token.');
          }

          const expDate = new Date(exp * 1000);
          formEl.style.display = 'block';
          uploadBtn.disabled = false;

          infoEl.textContent = 'Sélectionnez une vidéo à envoyer pour ce cours.';
          metaEl.textContent = \`Cours: \${courseId} · Formateur: \${userId} · Expire: \${expDate.toLocaleString()}\`;

          uploadBtn.addEventListener('click', async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) {
              statusEl.textContent = 'Veuillez choisir un fichier vidéo.';
              statusEl.className = 'status error';
              return;
            }

            statusEl.textContent = '';
            statusEl.className = 'status';
            uploadBtn.disabled = true;
            fileInput.disabled = true;
            titleInput.disabled = true;

            try {
              statusEl.textContent = 'Création de la vidéo distante...';
              setProgress(5);

              const videoTitle = titleInput.value || 'Video Jimmy';
              const videoId = await createBunnyVideo({
                title: videoTitle,
                courseId,
                teacherId: userId,
              });

              statusEl.textContent = 'Upload de la vidéo en cours...';
              await uploadVideoFile(videoId, file, (p) => setProgress(p));

              statusEl.textContent = 'Enregistrement des informations de la vidéo...';
              await registerBrowserUploadVideo({
                userId,
                courseId,
                lessonId,
                videoId,
                title: videoTitle,
                fileSize: file.size || null,
                token: getQueryParam('token')
              });

              statusEl.textContent = 'Vidéo envoyée avec succès. Le traitement peut prendre quelques minutes.';
              statusEl.className = 'status success';

              const returnUrl = getQueryParam('returnUrl');
              if (returnUrl) {
                metaEl.innerHTML += \` · <a href="\${returnUrl}" style="color:#60a5fa" target="_blank">Revenir à l'application</a>\`;
              }
            } catch (e) {
              console.error(e);
              statusEl.textContent = e.message || "Erreur pendant l'upload.";
              statusEl.className = 'status error';
              uploadBtn.disabled = false;
              fileInput.disabled = false;
              titleInput.disabled = false;
            }
          });
        } catch (e) {
          console.error(e);
          formEl.style.display = 'none';
          infoEl.textContent = '';
          errorEl.style.display = 'block';
          errorEl.textContent = e.message || 'Lien invalide ou expiré.';
        }
      })();
    </script>
  </body>
</html>`;
}

async function handleValidateBrowserUploadToken(request, env, corsHeaders) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  
  if (!token) {
    return errorResponse('Code manquant', 400, {}, corsHeaders);
  }

  try {
    const sa = getServiceAccount(env);
    const access = await getAccessToken(sa);

    // Récupération de la session
    const doc = await firestoreRequest(sa, access, `documents/uploadSessions/${token}`);
    
    if (!doc || !doc.fields) {
      return errorResponse('Code invalide ou introuvable', 404, {}, corsHeaders);
    }

    const f = doc.fields;
    const exp = f.exp?.integerValue ? parseInt(f.exp.integerValue) : 0;
    const now = Math.floor(Date.now() / 1000);

    if (exp < now) {
      return errorResponse('Le lien a expiré', 401, {}, corsHeaders);
    }

    if (f.used?.booleanValue) {
      return errorResponse('Ce lien a déjà été utilisé', 410, {}, corsHeaders);
    }

    return jsonResponse(
      {
        success: true,
        userId: f.userId?.stringValue || null,
        courseId: f.courseId?.stringValue || null,
        lessonId: f.lessonId?.stringValue || null,
        exp: exp,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    // Si le document n'existe pas, Firestore renvoie une erreur (404 souvent)
    return errorResponse('Code invalide ou erreur système', 400, { details: e.message }, corsHeaders);
  }
}

function isRateLimited(ip, pathname) {
  const now = Date.now();
  const key = `${ip}`;
  const routeKey = `${ip}:${pathname}`;

  const globalCfg = { windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX_REQUESTS };
  const routeCfg = ROUTE_LIMITS[pathname] || globalCfg;

  const entry = rateLimitStore.get(key) || { global: [], routes: new Map() };
  const globalTimestamps = entry.global.filter((t) => now - t < globalCfg.windowMs);
  globalTimestamps.push(now);

  const routeTimestamps = (entry.routes.get(pathname) || []).filter(
    (t) => now - t < routeCfg.windowMs,
  );
  routeTimestamps.push(now);

  entry.global = globalTimestamps;
  entry.routes.set(pathname, routeTimestamps);
  rateLimitStore.set(key, entry);

  if (globalTimestamps.length > globalCfg.max) return true;
  if (routeTimestamps.length > routeCfg.max) return true;
  return false;
}

function buildCorsHeaders(env, request) {
  const origin = request.headers.get('Origin') || '*';
  const allowed = env.ALLOWED_ORIGINS;

  let allowOrigin = '*';
  if (allowed && allowed !== '*') {
    const list = allowed
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (origin && list.includes(origin)) {
      allowOrigin = origin;
    } else {
      allowOrigin = list[0] || '*';
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key, X-Cron-Key',
  };
}

function jsonResponse(data, init = {}) {
  const headers = init.headers || {};
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function errorResponse(message, status = 400, extra = {}, headers = {}) {
  return jsonResponse({ error: message, ...extra }, { status, headers });
}

async function parseJsonSafe(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

async function handleRequestPayout(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  if (!env.PAWAPAY_API_TOKEN) {
    return errorResponse('PAWAPAY_API_TOKEN manquant', 500, {}, corsHeaders);
  }

  const body = await parseJsonSafe(request);
  if (!body) return errorResponse('JSON invalide', 400, {}, corsHeaders);

  const { teacherId, amount, phoneNumber, currency, provider, clientReferenceId } = body;

  if (!teacherId || !amount || !phoneNumber) {
    return errorResponse('Champs manquants (teacherId, amount, phoneNumber)', 400, {}, corsHeaders);
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return errorResponse('Montant invalide', 400, {}, corsHeaders);
  }

  // Validation du montant minimum : 1 USD
  if (numericAmount < 1) {
    return errorResponse('Le montant minimum de retrait est de 1 USD', 400, {}, corsHeaders);
  }

  // Validation du montant maximum : 500 USD par retrait pour plus de sécurité
  if (numericAmount > 500) {
    return errorResponse('Le montant maximum de retrait est de 500 USD', 400, {}, corsHeaders);
  }

  // Validation du format de numéro RDC (doit commencer par 243)
  const cleanPhone = String(phoneNumber).trim().replace(/\s+/g, '').replace(/[^\d]/g, '');
  if (!cleanPhone.startsWith('243') || cleanPhone.length !== 12) {
    return errorResponse('Le numéro de téléphone doit être au format RDC: 243XXXXXXXXX (12 chiffres)', 400, {}, corsHeaders);
  }

  // Vérification du solde disponible du teacher avant d'effectuer le retrait
  try {
    const sa = getServiceAccount(env);
    const token = await getAccessToken(sa);
    const projectId = sa.project_id;

    // Récupérer le wallet du teacher
    const walletRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/wallets/${teacherId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!walletRes.ok) {
      return errorResponse('Wallet introuvable', 404, {}, corsHeaders);
    }

    const walletData = await walletRes.json();
    const balance = walletData.fields?.balance?.doubleValue || 0;

    // Vérifier si le solde est suffisant
    if (balance < numericAmount) {
      return errorResponse('Solde insuffisant pour ce retrait', 400, { 
        currentBalance: balance, 
        requestedAmount: numericAmount 
      }, corsHeaders);
    }

  } catch (balanceError) {
    console.error('Erreur vérification solde:', balanceError);
    return errorResponse('Erreur lors de la vérification du solde', 500, { details: balanceError.message }, corsHeaders);
  }

  const payoutId = crypto.randomUUID();
  const payoutCurrency = (currency || 'USD').toUpperCase();

  // Providers disponibles en RDC avec validation stricte
  const allowedProviders = ['VODACOM_MPESA_COD', 'AIRTEL_COD', 'ORANGE_COD'];
  let finalProvider = typeof provider === 'string' ? provider.toUpperCase() : 'VODACOM_MPESA_COD';
  if (!allowedProviders.includes(finalProvider)) {
    finalProvider = 'VODACOM_MPESA_COD';
  }

  // Montant au format string avec 2 décimales max (ex: "1", "10.50")
  const amountString = numericAmount.toFixed(2).replace(/\.00$/, '');

  try {
    const res = await fetch('https://api.pawapay.io/v2/payouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAWAPAY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payoutId,
        amount: amountString,
        currency: payoutCurrency,
        recipient: {
          type: 'MMO',
          accountDetails: {
            phoneNumber: cleanPhone, // Utiliser le numéro nettoyé
            provider: finalProvider,
          },
        },
        clientReferenceId: clientReferenceId || `${teacherId}_${Date.now()}`,
        customerMessage: `Retrait Jimmy School - ${numericAmount} ${payoutCurrency}`,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      await logAdminEvent(env, {
        type: 'pawapay_payout_error',
        severity: 'error',
        message: 'Erreur PawaPay lors du retrait',
        context: { status: res.status, body: txt, teacherId, payoutId },
      });
      return errorResponse('Payout erreur', res.status, { details: txt }, corsHeaders);
    }

    const data = await res.json();

    // Déduire le montant du wallet après un retrait réussi
    try {
      const sa = getServiceAccount(env);
      const token = await getAccessToken(sa);
      const projectId = sa.project_id;
      
      // Récupérer le solde actuel
      const walletRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/wallets/${teacherId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (walletRes.ok) {
        const walletData = await walletRes.json();
        const currentBalance = walletData.fields?.balance?.doubleValue || 0;
        const newBalance = currentBalance - numericAmount;

        // Mettre à jour le wallet avec le nouveau solde
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/wallets/${teacherId}?updateMask.fieldPaths=balance`,
          {
            method: 'PATCH',
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fields: {
                balance: { doubleValue: newBalance }
              }
            })
          }
        );

        // Enregistrer la transaction
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/transactions`,
          {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fields: {
                userId: { stringValue: teacherId },
                type: { stringValue: 'payout' },
                amount: { doubleValue: numericAmount },
                currency: { stringValue: payoutCurrency },
                status: { stringValue: 'pending' },
                payoutId: { stringValue: payoutId },
                phoneNumber: { stringValue: cleanPhone },
                provider: { stringValue: finalProvider },
                createdAt: { timestampValue: new Date().toISOString() }
              }
            })
          }
        );
      }
    } catch (walletError) {
      console.error('Erreur mise à jour wallet:', walletError);
      // On ne bloque pas le retrait si la mise à jour du wallet échoue
      await logAdminEvent(env, {
        type: 'wallet_update_error',
        severity: 'warning',
        message: 'Erreur mise à jour wallet après retrait',
        context: { teacherId, payoutId, error: walletError.message },
      });
    }

    await logAdminEvent(env, {
      type: 'payout_requested',
      severity: 'info',
      message: 'Retrait demandé avec succès',
      context: { teacherId, payoutId, externalId: data.payoutId },
    });

    return jsonResponse(
      { success: true, payoutId, externalId: data.payoutId },
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    await logAdminEvent(env, {
      type: 'payout_internal_error',
      severity: 'error',
      message: e.message || 'Erreur interne lors du retrait',
      context: { teacherId, payoutId },
    });
    return errorResponse('Erreur interne', 500, { details: e.message }, corsHeaders);
  }
}

function getServiceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT non configuré');
  }
  try {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT invalide (JSON attendu)');
  }
}

function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) bufView[i] = str.charCodeAt(i);
  return buf;
}

async function getAccessToken(serviceAccount) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=+$/, '');
  const encodedClaim = btoa(JSON.stringify(claim)).replace(/=+$/, '');

  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(`${encodedHeader}.${encodedClaim}`);

  const key = await crypto.subtle.importKey(
    'pkcs8',
    str2ab(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=+$/, '');

  const jwt = `${encodedHeader}.${encodedClaim}.${encodedSignature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`Échec récupération access_token: ${txt}`);
  }

  const { access_token } = await tokenRes.json();
  if (!access_token) throw new Error('access_token manquant dans la réponse Google');
  return access_token;
}

async function firestoreRequest(serviceAccount, accessToken, path, options = {}) {
  const projectId = serviceAccount.project_id;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firestore error [${res.status}]: ${txt}`);
  }

  return res.json();
}

async function logAdminEvent(env, { type, severity = 'info', message, context = null }) {
  try {
    const sa = getServiceAccount(env);
    const token = await getAccessToken(sa);

    const nowIso = new Date().toISOString();
    const body = {
      fields: {
        type: { stringValue: type || 'generic' },
        severity: { stringValue: severity },
        message: { stringValue: message || '' },
        createdAt: { timestampValue: nowIso },
        context: context
          ? { mapValue: { fields: Object.fromEntries(
              Object.entries(context).map(([k, v]) => [k, { stringValue: String(v) }]),
            ) } }
          : { nullValue: null },
      },
    };

    await firestoreRequest(sa, token, 'documents/adminEvents', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    // En dernier recours, on ne bloque pas la requête principale pour un log raté.
  }
}

async function handleCreateDeposit(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  if (!env.PAWAPAY_API_TOKEN) {
    return errorResponse('PAWAPAY_API_TOKEN manquant', 500, {}, corsHeaders);
  }

  const body = await parseJsonSafe(request);
  if (!body) return errorResponse('JSON invalide', 400, {}, corsHeaders);

  const { userId, courseId, amount, currency, returnUrl } = body;

  if (!userId || !courseId || !amount || !currency || !returnUrl) {
    return errorResponse('Paramètres manquants (userId, courseId, amount, currency, returnUrl)', 400, {}, corsHeaders);
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return errorResponse('Montant invalide', 400, {}, corsHeaders);
  }

  if (numericAmount > 1_000_000) {
    return errorResponse('Montant trop élevé', 400, {}, corsHeaders);
  }

  const depositId = crypto.randomUUID();
  const finalReturnUrl = `${returnUrl}?depositId=${depositId}`;

  try {
    const ppRes = await fetch('https://api.pawapay.io/v2/paymentpage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAWAPAY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        depositId,
        returnUrl: finalReturnUrl,
        amountDetails: { amount: numericAmount.toString(), currency },
        country: 'COD',
        reason: 'Achat cours',
        customerMessage: 'Paiement cours',
      }),
    });

    if (!ppRes.ok) {
      const txt = await ppRes.text();
      await logAdminEvent(env, {
        type: 'pawapay_error',
        severity: 'error',
        message: 'Erreur création paymentpage',
        context: { status: ppRes.status, body: txt, depositId },
      });

      // On renvoie le texte brut de PawaPay dans le message d'erreur pour le client
      const baseMessage = 'PawaPay erreur de paiement';
      const fullMessage = txt ? `${baseMessage}: ${txt}` : baseMessage;

      return errorResponse(fullMessage, ppRes.status, { details: txt }, corsHeaders);
    }

    const { redirectUrl } = await ppRes.json();

    return jsonResponse(
      { success: true, paymentUrl: redirectUrl, depositId },
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    await logAdminEvent(env, {
      type: 'create_deposit_error',
      severity: 'error',
      message: e.message || 'Erreur inconnue',
      context: { userId, courseId, depositId },
    });
    return errorResponse('Erreur serveur', 500, {}, corsHeaders);
  }
}

async function handleCheckDepositStatus(request, env, corsHeaders, depositId) {
  if (!depositId) {
    return errorResponse('depositId manquant', 400, {}, corsHeaders);
  }
  if (!env.PAWAPAY_API_TOKEN) {
    return errorResponse('PAWAPAY_API_TOKEN manquant', 500, {}, corsHeaders);
  }

  try {
    const st = await fetch(`https://api.pawapay.io/v2/deposits/${depositId}`, {
      headers: { Authorization: `Bearer ${env.PAWAPAY_API_TOKEN}` },
    });

    if (!st.ok) {
      const txt = await st.text();
      await logAdminEvent(env, {
        type: 'pawapay_status_error',
        severity: 'warning',
        message: 'Erreur récupération statut dépôt',
        context: { depositId, status: st.status, body: txt },
      });
      return errorResponse('Status erreur', st.status, { details: txt }, corsHeaders);
    }

    const { data } = await st.json();
    const status = data?.status || 'UNKNOWN';

    return jsonResponse({ status }, { status: 200, headers: corsHeaders });
  } catch (e) {
    await logAdminEvent(env, {
      type: 'check_deposit_error',
      severity: 'error',
      message: e.message || 'Erreur inconnue',
      context: { depositId },
    });
    return errorResponse('Erreur serveur', 500, {}, corsHeaders);
  }
}

async function handleAutoCreditWallet(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  const cronKey = request.headers.get('X-Cron-Key') || request.headers.get('x-cron-key');
  if (!cronKey || cronKey !== env.CRON_SECRET) {
    return errorResponse('Non autorisé', 401, {}, corsHeaders);
  }

  let processedCount = 0;

  try {
    const serviceAccount = getServiceAccount(env);
    const token = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const qRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'purchases' }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  {
                    fieldFilter: {
                      field: { fieldPath: 'status' },
                      op: 'EQUAL',
                      value: { stringValue: 'completed' },
                    },
                  },
                  {
                    fieldFilter: {
                      field: { fieldPath: 'processed' },
                      op: 'EQUAL',
                      value: { nullValue: null },
                    },
                  },
                ],
              },
            },
            limit: 50,
          },
        }),
      },
    );

    if (!qRes.ok) {
      const txt = await qRes.text();
      throw new Error(`Query purchases error: ${txt}`);
    }

    const docs = await qRes.json();

    for (const d of docs) {
      if (!d.document) continue;
      const doc = d.document;
      const fields = doc.fields || {};
      const purchaseId = doc.name.split('/').pop();

      if (!fields.amount || !fields.courseId) continue;

      const amountCents = parseInt(fields.amount.integerValue || '0', 10);
      if (!Number.isFinite(amountCents) || amountCents <= 0) continue;

      const amount = amountCents / 100;
      const courseId = fields.courseId.stringValue;

      const courseRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/courses/${courseId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!courseRes.ok) {
        const txt = await courseRes.text();
        await logAdminEvent(env, {
          type: 'course_fetch_error',
          severity: 'error',
          message: 'Erreur récupération cours pour crédit wallet',
          context: { courseId, purchaseId, details: txt },
        });
        continue;
      }

      const course = await courseRes.json();
      const teacherId = course?.fields?.teacherId?.stringValue;
      if (!teacherId) {
        await logAdminEvent(env, {
          type: 'missing_teacher_id',
          severity: 'warning',
          message: 'teacherId manquant sur le cours',
          context: { courseId, purchaseId },
        });
        continue;
      }

      const credit = amount * 0.8;
      const walletUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/wallet/${teacherId}?updateMask.fieldPaths=balance&updateMask.fieldPaths=totalEarned&updateMask.fieldPaths=updatedAt`;

      await fetch(walletUrl, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            balance: { integerValue: Math.round(credit * 100) },
            totalEarned: { integerValue: Math.round(credit * 100) },
            updatedAt: { timestampValue: new Date().toISOString() },
          },
        }),
      });

      await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/purchases/${purchaseId}?updateMask.fieldPaths=processed`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { processed: { booleanValue: true } } }),
        },
      );

      processedCount += 1;
    }

    await logAdminEvent(env, {
      type: 'auto_credit_wallet',
      severity: 'info',
      message: 'Auto crédit wallet exécuté',
      context: { processedCount },
    });

    return jsonResponse(
      { success: true, message: 'Wallet crédité', processedCount },
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    await logAdminEvent(env, {
      type: 'auto_credit_error',
      severity: 'error',
      message: e.message || 'Erreur interne',
      context: {},
    });
    return errorResponse('Erreur interne', 500, { details: e.message }, corsHeaders);
  }
}

async function handleReportError(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  const body = await parseJsonSafe(request);
  if (!body) return errorResponse('JSON invalide', 400, {}, corsHeaders);

  const { type, severity, message, context } = body;

  if (!message) return errorResponse('message requis', 400, {}, corsHeaders);

  await logAdminEvent(env, {
    type: type || 'client_error',
    severity: severity || 'warning',
    message,
    context: context || null,
  });

  return jsonResponse({ success: true }, { status: 200, headers: corsHeaders });
}

async function handleSendNotification(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  const body = await parseJsonSafe(request);
  if (!body) return errorResponse('JSON invalide', 400, {}, corsHeaders);

  const { token, title, body: notifBody, data } = body;

  if (!token || !title || !notifBody) {
    return errorResponse('Champs manquants (token, title, body)', 400, {}, corsHeaders);
  }

  const isExpoToken = token.startsWith('ExponentPushToken[');

  if (!isExpoToken && !env.FCM_SERVER_KEY) {
    return errorResponse('FCM_SERVER_KEY manquant', 500, {}, corsHeaders);
  }

  try {
    if (isExpoToken) {
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          title,
          body: notifBody,
          data: data || {},
        }),
      });

      const text = await expoRes.text();

      if (!expoRes.ok) {
        await logAdminEvent(env, {
          type: 'expo_send_error',
          severity: 'error',
          message: 'Erreur lors de l\'envoi Expo',
          context: { status: expoRes.status, response: text },
        });
        return errorResponse('Erreur Expo Push', 502, { details: text }, corsHeaders);
      }
    } else {
      const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${env.FCM_SERVER_KEY}`,
        },
        body: JSON.stringify({
          to: token,
          notification: {
            title,
            body: notifBody,
          },
          data: data || {},
        }),
      });

      const text = await fcmRes.text();

      if (!fcmRes.ok) {
        await logAdminEvent(env, {
          type: 'fcm_send_error',
          severity: 'error',
          message: 'Erreur lors de l\'envoi FCM',
          context: { status: fcmRes.status, response: text },
        });
        return errorResponse('Erreur FCM', 502, { details: text }, corsHeaders);
      }
    }

    await logAdminEvent(env, {
      type: 'notification_sent',
      severity: 'info',
      message: 'Notification envoyée avec succès',
      context: { token, title, provider: isExpoToken ? 'expo' : 'fcm' },
    });

    return jsonResponse({ success: true }, { status: 200, headers: corsHeaders });
  } catch (e) {
    await logAdminEvent(env, {
      type: 'notification_internal_error',
      severity: 'error',
      message: e.message || 'Erreur interne notification',
      context: {},
    });
    return errorResponse('Erreur interne', 500, { details: e.message }, corsHeaders);
  }
}

async function handleBunnyImport(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  const body = await parseJsonSafe(request);
  if (!body) return errorResponse('JSON invalide', 400, {}, corsHeaders);

  const { sourceUrl, title, courseId, teacherId } = body;

  if (!sourceUrl) {
    return errorResponse('sourceUrl requis', 400, {}, corsHeaders);
  }

  try {
    const createPayload = {
      title: title || `Upload ${new Date().toISOString()}`,
    };

    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_CONFIG.LIBRARY_ID}/videos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          AccessKey: BUNNY_CONFIG.API_KEY,
        },
        body: JSON.stringify(createPayload),
      },
    );

    const createText = await createRes.text();
    if (!createRes.ok) {
      await logAdminEvent(env, {
        type: 'bunny_create_error',
        severity: 'error',
        message: 'Erreur création vidéo Bunny',
        context: { status: createRes.status, body: createText, courseId, teacherId },
      });
      return errorResponse('Erreur création Bunny', 502, { details: createText }, corsHeaders);
    }

    const created = createText ? JSON.parse(createText) : {};
    const videoId =
      created?.guid ||
      created?.videoGuid ||
      created?.videoId ||
      created?.id;

    if (!videoId) {
      return errorResponse('videoId manquant dans la réponse Bunny', 500, {}, corsHeaders);
    }

    const ingestRes = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_CONFIG.LIBRARY_ID}/videos/${videoId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          AccessKey: BUNNY_CONFIG.API_KEY,
        },
        body: JSON.stringify({ url: sourceUrl }),
      },
    );

    const ingestText = await ingestRes.text();
    if (!ingestRes.ok) {
      await logAdminEvent(env, {
        type: 'bunny_ingest_error',
        severity: 'error',
        message: 'Erreur ingestion vidéo Bunny',
        context: { status: ingestRes.status, body: ingestText, videoId, courseId },
      });
      return errorResponse('Erreur ingestion Bunny', 502, { details: ingestText }, corsHeaders);
    }

    await logAdminEvent(env, {
      type: 'bunny_import_started',
      severity: 'info',
      message: 'Import Bunny déclenché',
      context: { videoId, courseId, teacherId },
    });

    return jsonResponse(
      { success: true, videoId },
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    await logAdminEvent(env, {
      type: 'bunny_import_error',
      severity: 'error',
      message: e.message || 'Erreur interne Bunny',
      context: { courseId, teacherId },
    });
    return errorResponse('Erreur interne', 500, { details: e.message }, corsHeaders);
  }
}

async function handleCreateCourseShareLink(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Méthode non autorisée', 405, {}, corsHeaders);
  }

  const body = await parseJsonSafe(request);
  if (!body) return errorResponse('JSON invalide', 400, {}, corsHeaders);

  const {
    courseId,
    title,
    description,
    thumbnailUrl,
    price,
    teacherName,
    duration,
    totalDuration,
    isPlaylist,
  } = body || {};

  if (!courseId || typeof courseId !== 'string') {
    return errorResponse('courseId requis', 400, {}, corsHeaders);
  }

  try {
    const sa = getServiceAccount(env);
    const token = await getAccessToken(sa);
    const projectId = sa.project_id;

    // Vérifier que le cours existe au moins dans "courses" ou "playlists"
    let courseExists = false;

    let checkRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/courses/${courseId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (checkRes.ok) {
      courseExists = true;
    } else if (checkRes.status === 404) {
      // Essayer dans playlists si pas trouvé dans courses
      checkRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/playlists/${courseId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (checkRes.ok) {
        courseExists = true;
      }
    }

    if (!courseExists) {
      const bodyText = await checkRes.text().catch(() => '');
      await logAdminEvent(env, {
        type: 'share_link_course_not_found',
        severity: 'warning',
        message: 'Cours introuvable pour generation de lien de partage',
        context: {
          courseId,
          status: checkRes.status,
          body: bodyText,
        },
      });

      return errorResponse('Cours introuvable pour ce courseId', 404, {
        status: checkRes.status,
        details: bodyText,
      }, corsHeaders);
    }

    const shortCode = generateShortCode(6);

    const fields = {
      courseId: { stringValue: String(courseId) },
      createdAt: { timestampValue: new Date().toISOString() },
    };

    if (title) fields.title = { stringValue: String(title) };
    if (description) fields.description = { stringValue: String(description) };
    if (thumbnailUrl) fields.thumbnailUrl = { stringValue: String(thumbnailUrl) };
    if (teacherName) fields.teacherName = { stringValue: String(teacherName) };

    if (typeof price === 'number' && Number.isFinite(price)) {
      fields.price = { doubleValue: price };
    } else if (typeof price === 'string' && price.trim() !== '') {
      fields.price = { stringValue: price };
    }

    const durationMinutes =
      typeof duration === 'number' && Number.isFinite(duration)
        ? Math.max(0, Math.floor(duration))
        : null;
    if (durationMinutes !== null) {
      fields.duration = { integerValue: String(durationMinutes) };
    }

    const totalDurationMinutes =
      typeof totalDuration === 'number' && Number.isFinite(totalDuration)
        ? Math.max(0, Math.floor(totalDuration))
        : null;
    if (totalDurationMinutes !== null) {
      fields.totalDuration = { integerValue: String(totalDurationMinutes) };
    }

    if (typeof isPlaylist === 'boolean') {
      fields.isPlaylist = { booleanValue: isPlaylist };
    }

    const payload = { fields };

    await firestoreRequest(sa, token, `documents/courseShareLinks?documentId=${shortCode}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const origin = new URL(request.url).origin;
    const shareUrl = `${origin}/course/${shortCode}`;

    return jsonResponse(
      { success: true, shareUrl, code: shortCode, courseId },
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    await logAdminEvent(env, {
      type: 'share_link_error',
      severity: 'error',
      message: e.message || 'Erreur création lien de partage',
      context: { courseId },
    });

    return errorResponse('Erreur création lien de partage', 500, { details: e.message }, corsHeaders);
  }
}

async function handleCourseShare(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const match = path.match(/^\/course\/([^\/]+)$/);
  
  if (!match) {
    return new Response('Course ID not found', { status: 404, headers: corsHeaders });
  }

  let courseId = match[1];
  
  // Valeurs par défaut améliorées avec fallbacks multiples
  let title = 'Cours sur Jimmy';
  let description = 'Apprenez de nouvelles compétences sur Jimmy';
  let thumbnailUrl = '';
  let price = '0';
  let teacherName = 'Formateur Jimmy';
  let duration = 0;
  let errorDetails = '';
  let isPlaylistContent = false;

  try {
    // Lecture Firestore via l'API publique en utilisant le firebaseConfig (apiKey + projectId)
    const projectId = 'jimmy-school';
    const apiKey = 'AIzaSyD_cJ0z0QysF-w4f0FsUXIQS4CHQndcM5Y';

    let snapshot = null;

    // 1. Essayer la collection 'courses' avec courseId direct
    let docRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/courses/${courseId}?key=${apiKey}`,
    );

    // 2. Si pas trouvé (404), essayer d'abord un snapshot de partage (courseShareLinks), puis playlists
    if (!docRes.ok) {
      const txt = await docRes.text();
      if (docRes.status === 404) {
        try {
          const shortRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/courseShareLinks/${courseId}?key=${apiKey}`,
          );

          if (shortRes.ok) {
            const shortDoc = await shortRes.json();
            const shortFields = shortDoc.fields || {};
            snapshot = shortFields;

            const mappedCourseId = shortFields.courseId?.stringValue;
            if (mappedCourseId) {
              courseId = mappedCourseId;
            }
          }
        } catch (e) {
          errorDetails = `Short code resolution error: ${e.message}`;
        }

        // Si on a un snapshot, on peut optionnellement recharger les données du cours,
        // mais si cela échoue on utilisera quand même le snapshot pour les méta.
        if (snapshot) {
          try {
            docRes = await fetch(
              `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/courses/${courseId}?key=${apiKey}`,
            );
          } catch (_) {
            // ignoré, on restera sur le snapshot
          }
        }

        if (!docRes.ok && !snapshot) {
          const txt2 = await docRes.text();
          docRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/playlists/${courseId}?key=${apiKey}`,
          );
          if (docRes.ok) {
            isPlaylistContent = true; // Marquer comme contenu playlist
          } else {
            const txt3 = await docRes.text();
            errorDetails = `Not found in courses (404) and playlists (${docRes.status}): ${txt3}`;
          }
        }
      } else {
        errorDetails = `Error fetching course (${docRes.status}): ${txt}`;
      }
    }

    // Appliquer le snapshot en priorité si disponible
    if (snapshot) {
      if (snapshot.title?.stringValue) title = snapshot.title.stringValue;
      if (snapshot.description?.stringValue) description = snapshot.description.stringValue;
      if (snapshot.thumbnailUrl?.stringValue) thumbnailUrl = snapshot.thumbnailUrl.stringValue;
      if (snapshot.teacherName?.stringValue) teacherName = snapshot.teacherName.stringValue;

      if (snapshot.price) {
        if (snapshot.price.integerValue) price = snapshot.price.integerValue;
        else if (snapshot.price.doubleValue) price = String(snapshot.price.doubleValue);
        else if (snapshot.price.stringValue) price = snapshot.price.stringValue;
      }

      if (snapshot.duration?.integerValue) {
        duration = parseInt(snapshot.duration.integerValue, 10) || 0;
      } else if (snapshot.totalDuration?.integerValue) {
        duration = parseInt(snapshot.totalDuration.integerValue, 10) || 0;
      }
    }

    // Puis, si on a réussi à charger le document Firestore du cours/playlist, compléter/écraser avec les données live
    if (docRes.ok) {
      const docData = await docRes.json();
      const fields = docData.fields || {};
      
      // Extraction des champs Firestore
      if (fields.title?.stringValue) title = fields.title.stringValue;
      if (fields.description?.stringValue) description = fields.description.stringValue;
      if (fields.thumbnailUrl?.stringValue) thumbnailUrl = fields.thumbnailUrl.stringValue;
      if (fields.teacherName?.stringValue) teacherName = fields.teacherName.stringValue;
      
      // Gestion du prix (peut être integer, double ou string)
      if (fields.price) {
        if (fields.price.integerValue) price = fields.price.integerValue;
        else if (fields.price.doubleValue) price = String(fields.price.doubleValue);
        else if (fields.price.stringValue) price = fields.price.stringValue;
      }

      // Gestion de la durée (optionnel, pour affichage)
      if (fields.duration) {
        if (fields.duration.integerValue) duration = parseInt(fields.duration.integerValue);
        else if (fields.duration.doubleValue) duration = Math.round(parseFloat(fields.duration.doubleValue));
      } else if (fields.totalDuration) {
        // Pour les playlists
        if (fields.totalDuration.integerValue) duration = parseInt(fields.totalDuration.integerValue);
        isPlaylistContent = true; // Marquer comme playlist si totalDuration existe
      }
    }
  } catch (e) {
    console.error('Erreur lors de la récupération des données Firestore:', e);
    errorDetails = `Exception: ${e.message}`;
    // On continue avec les valeurs par défaut si la BDD échoue
  }

  // Formatage pour l'affichage
  const numericPrice = parseFloat(price);
  const displayPrice = numericPrice === 0 ? 'Gratuit' : `$${numericPrice}`;
  const durationText = duration > 0 
    ? `${Math.floor(duration / 60)}h ${duration % 60}min`
    : '';

  const deepLink = `jimmy://course-preview/${courseId}`;
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.jimmyschool.cd';
  const webUrl = `https://jimmyschool.com/course/${courseId}`; // Lien vers le site web

  // Amélioration des thumbnails avec fallbacks multiples
  if (!thumbnailUrl) {
    // Thumbnail par défaut selon le type de contenu
    thumbnailUrl = isPlaylistContent 
      ? 'https://via.placeholder.com/1200x630/6C63FF/FFFFFF?text=Playlist+Jimmy'
      : 'https://via.placeholder.com/1200x630/6C63FF/FFFFFF?text=Cours+Jimmy';
  }

  // Template HTML amélioré
  const html = `
<!DOCTYPE html>
<html lang="fr">
<!-- DEBUG INFO: ${errorDetails} -->
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Jimmy School</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Jimmy School">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${thumbnailUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${request.url}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${thumbnailUrl}">
  
  <!-- Additional SEO -->
  <meta name="description" content="${description}">
  <meta name="keywords" content="cours, formation, ${isPlaylistContent ? 'playlist' : 'apprentissage'}, jimmy school">
  <link rel="canonical" href="${request.url}">
  
  <meta name="theme-color" content="#6C63FF">


  
  <style>
    :root {
      --primary: #6C63FF;
      --surface: #ffffff;
      --background: #f3f4f6;
      --text: #1f2937;
      --text-secondary: #6b7280;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--background);
      color: var(--text);
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      width: 100%;
      max-width: 480px;
      background: var(--surface);
      min-height: 100vh;
      position: relative;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
    }
    @media (min-width: 480px) {
      .container {
        min-height: auto;
        border-radius: 16px;
        margin: 20px;
        overflow: hidden;
        display: block;
      }
    }
    .header {
      background: var(--primary);
      color: white;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-logo {
      font-weight: 800;
      font-size: 20px;
      text-decoration: none;
      color: white;
    }
    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .web-btn {
      background: rgba(255,255,255,0.15);
      color: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 13px;
      text-decoration: none;
      border: 1px solid rgba(255,255,255,0.3);
      transition: background 0.2s;
    }
    .web-btn:hover {
      background: rgba(255,255,255,0.25);
    }
    .open-btn {
      background: rgba(255,255,255,0.2);
      color: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 13px;
      text-decoration: none;
      border: 1px solid rgba(255,255,255,0.4);
    }
    .hero-image {
      width: 100%;
      aspect-ratio: 16/9;
      object-fit: cover;
      background-color: #e5e7eb;
    }
    .content {
      padding: 24px;
      flex: 1;
    }
    .meta-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      background: rgba(108, 99, 255, 0.1);
      color: var(--primary);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .duration-badge {
      display: inline-block;
      padding: 4px 10px;
      background: #f3f4f6;
      color: var(--text-secondary);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .title {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 800;
      line-height: 1.2;
      color: var(--text);
    }
    .teacher {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .price {
      font-size: 32px;
      font-weight: 800;
      color: var(--primary);
      margin-bottom: 24px;
    }
    .description {
      color: var(--text);
      line-height: 1.6;
      margin-bottom: 32px;
      font-size: 15px;
      opacity: 0.9;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: auto;
    }
    .primary-btn {
      display: block;
      background: var(--primary);
      color: white;
      text-align: center;
      padding: 16px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(108, 99, 255, 0.3);
      transition: transform 0.1s;
    }
    .primary-btn:active {
      transform: scale(0.98);
    }
    .secondary-btn {
      display: block;
      background: transparent;
      color: var(--text-secondary);
      text-align: center;
      padding: 12px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }
    .redirect-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.95);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 50;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    .redirect-overlay.active {
      opacity: 1;
      pointer-events: all;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(108, 99, 255, 0.2);
      border-radius: 50%;
      border-top-color: var(--primary);
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <a href="https://jimmyschool.com" class="header-logo" target="_blank">Jimmy School</a>
      <div class="header-actions">
        <a href="${webUrl}" class="web-btn" target="_blank">Voir sur web</a>
        <a href="${deepLink}" class="open-btn" onclick="handleDeepLink(event)">Ouvrir l'app</a>
      </div>
    </header>
    
    <img src="${thumbnailUrl}" alt="${title}" class="hero-image" onerror="this.style.display='none'">
    
    <div class="content">
      <div class="meta-row">
        <span class="badge">${isPlaylistContent ? 'Playlist' : 'Cours'}</span>
        ${durationText ? `<span class="duration-badge">⏱ ${durationText}</span>` : ''}
      </div>
      
      <h1 class="title">${title}</h1>
      <div class="teacher">👤 Par ${teacherName}</div>
      
      <div class="price">${displayPrice}</div>
      
      <div class="description">${description}</div>
      
      <div class="actions">
        <a href="${deepLink}" class="primary-btn" onclick="handleDeepLink(event)">Voir le cours</a>
        <a href="${webUrl}" class="secondary-btn" target="_blank">Voir sur le site web</a>
        <a href="${playStoreUrl}" class="secondary-btn">Télécharger l'application</a>
      </div>
    </div>
  </div>
  
  <div id="overlay" class="redirect-overlay">
    <div class="spinner"></div>
    <div style="color: #6C63FF; font-weight: 600;">Ouverture de Jimmy...</div>
  </div>

  <script>
    function handleDeepLink(e) {
      e.preventDefault();
      const deepLink = "${deepLink}";
      const storeLink = "${playStoreUrl}";
      const overlay = document.getElementById('overlay');
      
      overlay.classList.add('active');
      window.location.href = deepLink;
      
      setTimeout(() => {
        // Si l'utilisateur est toujours là après 2.5s, c'est que le deep link n'a peut-être pas marché
        if (!document.hidden) {
          window.location.href = storeLink;
        }
        overlay.classList.remove('active');
      }, 2500);
    }
    
    // Auto-redirect intelligent
    window.onload = function() {
      const isBot = /bot|googlebot|crawler|spider|robot|crawling/i.test(navigator.userAgent);
      if (!isBot) {
        // Optionnel: Décommenter pour rediriger automatiquement
        // handleDeepLink({ preventDefault: () => {} });
      }
    };
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function renderNotFoundPage() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page non trouvée | Jimmy School</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #ffffff;
      color: #333;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .header {
      background: #6C63FF;
      color: white;
      padding: 16px 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      text-align: center;
    }
    .error-code {
      font-size: 120px;
      font-weight: 700;
      color: #6C63FF;
      margin: 0;
      line-height: 1;
    }
    .error-title {
      font-size: 24px;
      font-weight: 600;
      margin: 16px 0 8px;
      color: #333;
    }
    .error-description {
      font-size: 16px;
      color: #666;
      margin: 0 0 32px;
      max-width: 500px;
      line-height: 1.5;
    }
    .suggestions {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 24px;
      max-width: 500px;
      width: 100%;
      text-align: left;
    }
    .suggestions h3 {
      margin: 0 0 16px;
      font-size: 18px;
      color: #333;
    }
    .suggestions ul {
      margin: 0;
      padding-left: 20px;
      color: #666;
    }
    .suggestions li {
      margin-bottom: 8px;
    }
    .home-link {
      display: inline-block;
      background: #6C63FF;
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 500;
      margin-top: 24px;
      transition: background 0.2s;
    }
    .home-link:hover {
      background: #5a52d5;
    }
    .dino-container {
      position: relative;
      width: 200px;
      height: 100px;
      margin: 20px 0;
    }
    .dino {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 60px;
      height: 60px;
      background: #333;
      border-radius: 10px 10px 0 0;
    }
    .dino::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
    }
    .dino::after {
      content: '';
      position: absolute;
      top: 20px;
      right: 10px;
      width: 30px;
      height: 5px;
      background: #333;
      border-radius: 2px;
    }
    .cactus {
      position: absolute;
      bottom: 0;
      right: 20px;
      width: 20px;
      height: 40px;
      background: #228B22;
      border-radius: 2px;
    }
    .cactus::before,
    .cactus::after {
      content: '';
      position: absolute;
      width: 15px;
      height: 15px;
      background: #228B22;
      border-radius: 2px;
    }
    .cactus::before {
      top: 5px;
      left: -10px;
    }
    .cactus::after {
      top: 15px;
      right: -10px;
    }
    .ground {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: #ccc;
    }
    @media (max-width: 600px) {
      .error-code {
        font-size: 80px;
      }
      .error-title {
        font-size: 20px;
      }
      .suggestions {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <h1>Jimmy School</h1>
  </header>
  
  <main class="main">
    <div class="dino-container">
      <div class="dino"></div>
      <div class="cactus"></div>
      <div class="ground"></div>
    </div>
    
    <div class="error-code">404</div>
    <h2 class="error-title">Page non trouvée</h2>
    <p class="error-description">
      Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
    </p>
    
    <div class="suggestions">
      <h3>Ce que vous pouvez faire :</h3>
      <ul>
        <li>Vérifier l'URL saisie pour les erreurs de frappe</li>
        <li>Retourner à la page d'accueil de Jimmy School</li>
        <li>Utiliser le lien de partage que vous avez reçu</li>
        <li>Contacter le support si le problème persiste</li>
      </ul>
    </div>
    
    <a href="https://jimmyschool.com" class="home-link">Accueil Jimmy School</a>
  </main>
</body>
</html>`;
}

async function handleAdminEventsList(request, env, corsHeaders) {
  const adminKey = request.headers.get('X-Admin-Key') || request.headers.get('x-admin-key');
  if (!adminKey || adminKey !== env.ADMIN_API_KEY) {
    return errorResponse('Non autorisé', 401, {}, corsHeaders);
  }

  const limitParam = new URL(request.url).searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);

  try {
    const sa = getServiceAccount(env);
    const token = await getAccessToken(sa);
    const projectId = sa.project_id;

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'adminEvents' }],
            orderBy: [
              {
                field: { fieldPath: 'createdAt' },
                direction: 'DESCENDING',
              },
            ],
            limit,
          },
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Query adminEvents error: ${txt}`);
    }

    const docs = await res.json();

    const events = docs
      .filter((d) => d.document)
      .map((d) => {
        const doc = d.document;
        const fields = doc.fields || {};
        return {
          id: doc.name.split('/').pop(),
          type: fields.type?.stringValue || null,
          severity: fields.severity?.stringValue || null,
          message: fields.message?.stringValue || null,
          createdAt: fields.createdAt?.timestampValue || null,
        };
      });

    return jsonResponse({ events }, { status: 200, headers: corsHeaders });
  } catch (e) {
    return errorResponse('Erreur interne', 500, { details: e.message }, corsHeaders);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const corsHeaders = buildCorsHeaders(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const ip = getClientIp(request);
    if (isRateLimited(ip, pathname)) {
      return errorResponse('Trop de requêtes, réessayez plus tard', 429, {}, corsHeaders);
    }

    if (pathname === '/deposits/create') {
      return handleCreateDeposit(request, env, corsHeaders);
    }

    if (pathname.startsWith('/deposits/status/')) {
      const depositId = pathname.split('/').pop();
      return handleCheckDepositStatus(request, env, corsHeaders, depositId);
    }

    if (pathname === '/wallet/auto-credit') {
      return handleAutoCreditWallet(request, env, corsHeaders);
    }

    if (pathname === '/error/report') {
      return handleReportError(request, env, corsHeaders);
    }

    if (pathname === '/payouts/request') {
      return handleRequestPayout(request, env, corsHeaders);
    }

    if (pathname === '/course/share-link') {
      return handleCreateCourseShareLink(request, env, corsHeaders);
    }

    if (pathname === '/send-notification') {
      return handleSendNotification(request, env, corsHeaders);
    }

    if (pathname === '/bunny/import') {
      return handleBunnyImport(request, env, corsHeaders);
    }

    if (pathname === '/bunny/create') {
      return handleBunnyCreate(request, env, corsHeaders);
    }

    if (pathname === '/bunny/upload') {
      return handleBunnyUpload(request, env, corsHeaders);
    }

    if (pathname === '/admin/events') {
      return handleAdminEventsList(request, env, corsHeaders);
    }

    if (pathname === '/browser-upload/session') {
      return handleCreateBrowserUploadSession(request, env, corsHeaders);
    }

    if (pathname === '/browser-upload/validate') {
      return handleValidateBrowserUploadToken(request, env, corsHeaders);
    }

    if (pathname === '/browser-upload/register-video') {
      return handleRegisterBrowserUploadVideo(request, env, corsHeaders);
    }

    if (pathname === '/browser-upload/pending') {
      return handleGetPendingBrowserUpload(request, env, corsHeaders);
    }

    if (pathname === '/browser-upload') {
      return new Response(renderBrowserUploadHtml(), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    if (pathname.startsWith('/course/')) {
      return handleCourseShare(request, env, corsHeaders);
    }

    if (pathname.startsWith('/bunny/playback/')) {
      const videoId = pathname.split('/').pop();
      return handleBunnyPlayback(request, env, corsHeaders, videoId);
    }

    if (pathname === '/debug/pawapay') {
      const hasToken = !!env.PAWAPAY_API_TOKEN;
      const tokenLength = env.PAWAPAY_API_TOKEN ? env.PAWAPAY_API_TOKEN.length : 0;
    
      return jsonResponse(
        {
          ok: true,
          hasToken,
          tokenLength,
        },
        { status: 200, headers: corsHeaders },
      );
    }

    return new Response(renderNotFoundPage(), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};

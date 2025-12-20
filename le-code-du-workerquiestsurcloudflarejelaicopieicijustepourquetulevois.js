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

// ... (previous worker code remains the same)

async function handleAdminRequest(request, env, corsHeaders) {
    const adminKey = request.headers.get('X-Admin-Key');
    if (!adminKey || adminKey !== env.ADMIN_API_KEY) {
        return errorResponse('Non autorisé', 401, {}, corsHeaders);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace('/admin', '');

    if (path.startsWith('/users')) {
        return handleAdminUsers(request, env, path);
    }
    if (path.startsWith('/courses')) {
        return handleAdminCourses(request, env, path);
    }
    if (path.startsWith('/transactions')) {
        return handleAdminTransactions(request, env);
    }

    return errorResponse('Route admin non trouvée', 404, {}, corsHeaders);
}

async function handleAdminUsers(request, env, path) {
    const serviceAccount = getServiceAccount(env);
    const token = await getAccessToken(serviceAccount);
    const parts = path.split('/');
    const userId = parts[2];

    if (request.method === 'GET' && userId && parts[3] === 'purchases') {
        const purchases = await firestoreRequest(serviceAccount, token, `documents/purchases:runQuery`, {
            method: 'POST',
            body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'purchases' }], where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: userId } } } } })
        });
        return jsonResponse(purchases.map(p => p.document.fields));
    }

    if (request.method === 'GET') {
        const users = await firestoreRequest(serviceAccount, token, 'documents/users');
        return jsonResponse(users.documents.map(doc => ({ id: doc.name.split('/').pop(), ...doc.fields })));
    }

    if (request.method === 'PATCH' && userId) {
        const body = await parseJsonSafe(request);
        await firestoreRequest(serviceAccount, token, `documents/users/${userId}?updateMask.fieldPaths=role`, {
            method: 'PATCH',
            body: JSON.stringify({ fields: { role: { stringValue: body.role } } })
        });
        return jsonResponse({ success: true });
    }

    return errorResponse('Méthode non supportée', 405);
}

async function handleAdminCourses(request, env, path) {
    const serviceAccount = getServiceAccount(env);
    const token = await getAccessToken(serviceAccount);
    const courseId = path.split('/')[2];

    if (request.method === 'GET') {
        const courses = await firestoreRequest(serviceAccount, token, 'documents/courses');
        return jsonResponse(courses.documents.map(doc => ({ id: doc.name.split('/').pop(), ...doc.fields })));
    }

    if (request.method === 'PATCH' && courseId) {
        const body = await parseJsonSafe(request);
        await firestoreRequest(serviceAccount, token, `documents/courses/${courseId}?updateMask.fieldPaths=title&updateMask.fieldPaths=price&updateMask.fieldPaths=thumbnailUrl`, {
            method: 'PATCH',
            body: JSON.stringify({ fields: { title: { stringValue: body.title }, price: { doubleValue: body.price }, thumbnailUrl: { stringValue: body.thumbnailUrl } } })
        });
        return jsonResponse({ success: true });
    }

    if (request.method === 'DELETE' && courseId) {
        await firestoreRequest(serviceAccount, token, `documents/courses/${courseId}`, { method: 'DELETE' });
        return jsonResponse({ success: true });
    }

    return errorResponse('Méthode non supportée', 405);
}

async function handleAdminTransactions(request, env) {
    const serviceAccount = getServiceAccount(env);
    const token = await getAccessToken(serviceAccount);
    const transactions = await firestoreRequest(serviceAccount, token, 'documents/purchases');
    return jsonResponse(transactions.documents.map(doc => ({ id: doc.name.split('/').pop(), ...doc.fields })));
}


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const corsHeaders = buildCorsHeaders(env, request);

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (pathname.startsWith('/admin')) {
        return handleAdminRequest(request, env, corsHeaders);
    }

    // ... (le reste du code du worker reste identique)

    if (pathname === '/deposits/create') {
      return handleCreateDeposit(request, env, corsHeaders);
    }
    // ... etc
  },
};
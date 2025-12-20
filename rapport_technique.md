# Rapport Technique Complet : Jimmy School

## 1. Introduction

Jimmy School est une plateforme d'e-learning moderne et complète, conçue pour faciliter la création, la vente et la consommation de contenu éducatif en ligne. L'application offre une expérience utilisateur riche et intuitive, tant pour les étudiants qui cherchent à acquérir de nouvelles compétences que pour les formateurs qui souhaitent partager leur savoir et monétiser leur expertise.

L'objectif principal de la plateforme est de fournir un écosystème robuste et évolutif pour l'apprentissage en ligne, en mettant l'accent sur la facilité d'utilisation, la sécurité des transactions et une diffusion vidéo performante.

L'architecture du projet repose sur une stack technologique moderne et découplée, qui combine un frontend réactif avec un backend serverless puissant. Les technologies clés utilisées sont :

*   **Frontend :** React avec TypeScript et Vite, pour une interface utilisateur rapide, typée et maintenable.
*   **Backend :** Cloudflare Workers, pour une logique métier serverless, performante et sécurisée.
*   **Base de données :** Firebase Firestore, pour une base de données NoSQL flexible et en temps réel.
*   **Stockage de fichiers :** Firebase Storage, pour le stockage des miniatures de cours et des documents de vérification.
*   **Traitement et diffusion vidéo :** Bunny.net, pour un streaming vidéo optimisé et sécurisé.
*   **Paiements :** PawaPay, pour la gestion des transactions financières.
*   **Gestion de l'état :** Zustand et React Query, pour une gestion d'état efficace et prédictible.
*   **Routage :** React Router, pour la navigation au sein de l'application.

## 2. Architecture Frontend

Le frontend de Jimmy School est une application monopage (SPA) développée avec React, TypeScript et Vite. Cette combinaison offre un environnement de développement moderne, performant et robuste.

*   **React (v19)** : Utilisé pour construire une interface utilisateur déclarative et basée sur les composants, ce qui favorise la réutilisabilité et la maintenabilité du code.
*   **TypeScript** : Ajoute un typage statique au JavaScript, ce qui permet de détecter les erreurs en amont du cycle de développement, d'améliorer l'autocomplétion et de rendre le code plus lisible et plus sûr.
*   **Vite** : Sert d'outil de build et de serveur de développement. Il offre un démarrage quasi instantané et un rechargement à chaud (HMR) extrêmement rapide, ce qui améliore considérablement l'expérience de développement.

### Plongée dans la Gestion de l'État : Zustand et React Query en Action

Pour bien comprendre comment l'application fonctionne, il est essentiel d'analyser en détail comment l'état et les données sont gérés.

#### Zustand pour l'État Global d'Authentification

Le store Zustand, défini dans `stores/auth.ts`, est le cerveau de la session utilisateur. Il expose un hook `useAuth` qui permet à n'importe quel composant d'accéder à l'état de l'utilisateur et de le modifier.

**Exemple d'utilisation dans `AppLayout.tsx` :**
Le composant `AppLayout` utilise `useAuth` pour sécuriser les routes et afficher conditionnellement l'interface :

```typescript
// Dans AppLayout.tsx
const { user } = useAuth();

if (!user) {
  // Si aucun utilisateur n'est connecté dans le store Zustand,
  // on redirige immédiatement vers la page de connexion.
  return <Navigate to="/auth/login" replace />;
}

// L'interface (Sidebar, etc.) est ensuite rendue en utilisant les
// informations de `user` (par exemple, pour afficher le nom ou le rôle).
```

#### React Query pour les Données Serveur

React Query est utilisé pour toutes les interactions avec des données distantes (Firestore et l'API du Worker). Chaque requête est associée à une clé de requête unique.

**Exemple d'utilisation dans `CourseDetail.tsx` :**
Ce composant est un excellent exemple de la puissance de React Query.

1.  **Récupération des détails du cours :**
    ```typescript
    // Dans CourseDetail.tsx
    const { id } = useParams(); // Récupère l'ID du cours depuis l'URL.

    const { data: course } = useQuery({
      queryKey: ['course', id], // Clé unique pour cette requête.
      queryFn: async () => {
        // La fonction qui récupère les données.
        const docSnap = await getDoc(doc(db, 'courses', id!));
        return { id: docSnap.id, ...docSnap.data() } as Course;
      },
      enabled: !!id // La requête ne s'exécute que si l'ID existe.
    });
    ```
    React Query gère automatiquement l'état de chargement (`isLoading`), les erreurs (`isError`), et met en cache le résultat. Si l'utilisateur navigue vers une autre page puis revient, les données du cours seront servies instantanément depuis le cache avant d'être rafraîchies en arrière-plan.

2.  **Récupération du statut d'achat de l'utilisateur :**
    ```typescript
    // Dans CourseDetail.tsx, en utilisant le `user` de Zustand.
    const { user } = useAuth();

    const { data: purchaseStatus } = useQuery({
      // La clé inclut l'ID de l'utilisateur pour que la requête soit unique par utilisateur.
      queryKey: ['purchase', id, user?.uid],
      queryFn: async () => {
        const q = query(collection(db, 'purchases'), where('userId', '==', user?.uid), where('courseId', '==', id));
        const snap = await getDocs(q);
        return !snap.empty; // Retourne true si un document d'achat existe.
      },
      enabled: !!user && !!id // Ne s'exécute que si l'utilisateur est connecté.
    });
    ```
    Ce hook détermine si l'utilisateur a déjà acheté le cours. Le résultat (`purchaseStatus`) est ensuite utilisé pour afficher conditionnellement le bouton "Acheter le cours" ou "Regarder maintenant".

Cette combinaison permet de séparer clairement la logique de l'état global de l'interface (Zustand) de la logique de gestion des données du serveur (React Query), ce qui rend le code plus modulaire, plus facile à tester et moins sujet aux bugs.

### Structure des Composants

L'application est structurée de manière logique en composants réutilisables, situés dans le répertoire `components/`. On distingue plusieurs types de composants :

*   **Composants de Page** : Des composants de haut niveau qui représentent des pages entières de l'application (ex: `StudentDashboard`, `CourseDetail`, `TeacherDashboard`). Ils sont responsables de la composition de la page et de la récupération des données nécessaires.
*   **Composants Partagés** : Des composants plus petits et génériques utilisés à travers l'application (ex: `SidebarItem`, `CourseCard`, `PlaylistCard`). Ils sont conçus pour être réutilisables et ne dépendent généralement pas du contexte spécifique de la page.
*   **Composants de Layout** : Le composant `AppLayout` est un exemple de composant de mise en page qui fournit une structure commune à plusieurs pages, comme la barre latérale de navigation et l'en-tête.

### Système de Routage

La navigation au sein de l'application est gérée par `react-router-dom` (v7). Le fichier `App.tsx` définit l'ensemble des routes de l'application à l'aide du composant `<Routes>`.

La configuration du routage est divisée en plusieurs sections logiques :

*   **Routes Publiques** : Accessibles à tous les utilisateurs (ex: `/`, la page d'accueil).
*   **Routes d'Authentification** : Pour la connexion et l'inscription (ex: `/auth/login`, `/auth/signup`).
*   **Routes Protégées (Étudiant)** : Nécessitent une authentification et sont encapsulées dans le `AppLayout` (ex: `/app`, `/app/my-courses`).
*   **Routes Protégées (Formateur)** : Également protégées, elles sont dédiées à l'interface de gestion des formateurs (ex: `/teacher`, `/teacher/create`).

### Gestion de l'État

L'application adopte une stratégie de gestion de l'état hybride, utilisant deux bibliothèques complémentaires pour des besoins différents :

*   **Zustand** : Utilisé pour la gestion de l'état global côté client. Il est particulièrement adapté pour les états qui doivent être accessibles depuis n'importe quel composant de l'application, comme les informations de l'utilisateur authentifié et son token. Le hook `useAuth` est l'implémentation de ce store. Zustand est apprécié pour sa simplicité et son API minimaliste.

*   **React Query (`@tanstack/react-query`)** : Utilisé pour la gestion de l'état du serveur. Il simplifie la récupération, la mise en cache, la synchronisation et la mise à jour des données provenant de Firebase et du Cloudflare Worker. React Query gère automatiquement les états de chargement et d'erreur, la mise en cache intelligente, la re-validation des données en arrière-plan, et bien plus encore. Cela permet de réduire considérablement la quantité de code manuel nécessaire pour interagir avec les API et la base de données.

## 3. Architecture Backend

Le backend de Jimmy School est entièrement construit sur une architecture serverless utilisant les **Cloudflare Workers**. Cette approche offre de nombreux avantages, notamment une scalabilité automatique, une haute disponibilité, des performances élevées grâce à l'exécution au plus près de l'utilisateur (Edge computing), et des coûts optimisés.

Le Worker est responsable de toute la logique métier qui ne peut pas être exécutée côté client pour des raisons de sécurité ou de complexité. Il agit comme une API sécurisée qui s'interface avec des services tiers (PawaPay, Bunny.net) et la base de données Firebase.

### Analyse d'un Flux API Critique : La Création d'un Paiement

Pour illustrer le fonctionnement du backend, examinons en détail le processus d'achat d'un cours.

1.  **Déclenchement Côté Client (`CourseDetail.tsx`)**
    *   L'utilisateur clique sur le bouton "Acheter le cours".
    *   La fonction `handleBuy` est appelée.
    *   Cette fonction appelle `workerApi.createDeposit`, une fonction du service `worker.ts` qui encapsule l'appel à l'API du Worker.
    *   Les informations nécessaires (`userId`, `courseId`, `price`) sont envoyées dans le corps de la requête POST vers l'endpoint `/deposits/create` du Worker.

2.  **Traitement par le Cloudflare Worker (`handleCreateDeposit`)**
    *   Le Worker reçoit la requête. Il vérifie d'abord que la méthode est bien `POST`.
    *   Il valide la présence et la validité des paramètres (`userId`, `courseId`, `amount`).
    *   Il génère un `depositId` unique (un UUID) pour cette transaction.
    *   Il prépare un appel à l'API de PawaPay (`/v2/paymentpage`) en utilisant le `PAWAPAY_API_TOKEN` stocké dans les secrets. Le corps de cette requête contient le `depositId`, le montant, la devise, et une `returnUrl` qui ramènera l'utilisateur vers l'application après le paiement.
    *   Le Worker envoie la requête à PawaPay.

3.  **Réponse de PawaPay et Finalisation**
    *   Si la requête à PawaPay réussit, PawaPay renvoie une `redirectUrl`, qui est l'URL de la page de paiement sécurisée.
    *   Le Worker reçoit cette `redirectUrl` et la renvoie au client frontend dans sa réponse, avec le `depositId`.
    *   Côté client, le `CourseDetail.tsx` reçoit la réponse. Il met à jour son état pour afficher une modale contenant un `iframe` qui charge la `paymentUrl`. L'utilisateur peut alors procéder au paiement directement dans l'interface de l'application.
    *   Pendant ce temps, le client commence à "poller" l'endpoint `/deposits/status/{depositId}` du Worker à intervalle régulier pour vérifier l'état de la transaction. Une fois que PawaPay confirme le paiement, le Worker renvoie un statut `completed`, le client accorde l'accès au cours, et ferme la modale de paiement.

### Flux de Mise en Ligne d'une Vidéo

Le processus de création d'un cours et de mise en ligne d'une vidéo est un autre exemple pertinent.

1.  **Déclenchement Côté Client (`CreateCourse.tsx`)**
    *   Le formateur remplit le formulaire (titre, prix, etc.) et sélectionne un fichier vidéo et une miniature.
    *   La miniature est directement uploadée vers Firebase Storage depuis le client.
    *   La fonction `handleCreate` est appelée. Elle ne télécharge pas directement la vidéo.

2.  **Création de la Vidéo via le Worker**
    *   Le client appelle d'abord l'endpoint `/bunny/create` du Worker, en envoyant le titre de la vidéo.
    *   Le Worker contacte l'API de Bunny.net pour créer une "coquille" de vidéo vide et obtient en retour un `videoId`. Ce `videoId` est renvoyé au client.

3.  **Upload Direct de la Vidéo**
    *   Avec ce `videoId`, le client appelle maintenant l'endpoint `/bunny/upload?videoId={videoId}` du Worker, mais cette fois-ci avec la méthode `PUT` et le fichier vidéo binaire dans le corps de la requête.
    *   Le Worker agit comme un proxy sécurisé : il reçoit le flux binaire et le transfère directement à l'API d'upload de Bunny.net, en y joignant la clé d'API secrète de Bunny.net. Cela évite d'exposer la clé d'API au client.

4.  **Finalisation dans Firestore**
    *   Une fois l'upload terminé, le client crée le document du cours dans la collection `courses` de Firestore. Il y enregistre toutes les informations du cours, y compris l'URL de la miniature obtenue de Firebase Storage et le `videoId` de Bunny.net.
    *   Un champ `videoStatus` est initialisé à `processing`. Bunny.net prendra ensuite quelques minutes pour traiter et encoder la vidéo. Des webhooks (non implémentés ici, mais une amélioration possible) pourraient être utilisés pour mettre à jour ce statut automatiquement à `ready`.

### Points d'Accès (Endpoints) Principaux

Le Worker expose plusieurs points d'accès pour gérer les différentes fonctionnalités de l'application :

*   **/deposits/create** : Gère la création d'une session de paiement avec PawaPay. Il prend en entrée les informations de la transaction (ID de l'utilisateur, ID du cours, montant) et retourne une URL de paiement sécurisée.
*   **/deposits/status/{depositId}** : Vérifie le statut d'une transaction de dépôt auprès de PawaPay.
*   **/payouts/request** : Gère les demandes de retrait des formateurs. Il valide le solde du formateur, initie le transfert d'argent via PawaPay et met à jour le portefeuille du formateur.
*   **/bunny/create** : Crée une nouvelle vidéo sur Bunny.net et retourne un ID de vidéo.
*   **/bunny/upload?videoId={videoId}** : Gère l'upload direct d'un fichier vidéo vers Bunny.net.
*   **/bunny/playback/{videoId}** : Génère une URL de lecture sécurisée et signée pour une vidéo Bunny.net, avec une durée de validité limitée.
*   **/course/share-link** : Crée un lien de partage unique pour un cours ou une playlist.
*   **/admin/events** : (Protégé) Récupère les logs d'événements administratifs pour le suivi et le débogage.

### Intégrations avec les Services Tiers

*   **PawaPay** : Toute la logique de paiement, y compris la création de dépôts et la gestion des retraits, est encapsulée dans le Worker. Cela permet de garder les clés d'API de PawaPay sécurisées et de ne jamais les exposer au client.
*   **Bunny.net** : Le Worker gère l'ensemble du cycle de vie des vidéos. Il crée les vidéos, gère les uploads et génère des URL de lecture signées à la volée. Cette approche empêche le hotlinking et garantit que seules les utilisateurs autorisés peuvent accéder au contenu vidéo.
*   **Firebase** : Le Worker interagit avec Firebase (Firestore) en utilisant un compte de service sécurisé pour les opérations qui nécessitent des privilèges élevés, comme la validation des soldes des portefeuilles ou la journalisation d'événements administratifs.

### Sécurité

La sécurité est un aspect central de l'architecture du Worker :

*   **Variables d'Environnement** : Toutes les clés d'API et les secrets (PawaPay, Firebase, etc.) sont stockés en tant que variables d'environnement sécurisées dans Cloudflare, et ne sont jamais exposées côté client.
*   **CORS (Cross-Origin Resource Sharing)** : Les en-têtes CORS sont configurés pour n'autoriser que les requêtes provenant des domaines autorisés, empêchant ainsi l'utilisation de l'API par des sites tiers non autorisés.
*   **Rate Limiting** : Un système de limitation de débit en mémoire est implémenté pour prévenir les abus et les attaques par déni de service. Il limite le nombre de requêtes qu'une même adresse IP peut effectuer sur une période donnée, avec des limites spécifiques pour les routes les plus sensibles.
*   **Clés d'API pour les Endpoints Sensibles** : Les points d'accès administratifs (comme `/admin/events`) sont protégés par une clé d'API secrète (`ADMIN_API_KEY`) qui doit être fournie dans les en-têtes de la requête.

## 4. Base de Données et Stockage

Firebase joue un rôle crucial dans l'architecture de Jimmy School, en fournissant à la fois la base de données principale et la solution de stockage de fichiers.

### Firebase Firestore

Firestore est utilisée comme base de données NoSQL pour stocker toutes les données de l'application. Sa nature flexible et son modèle de données basé sur les documents et les collections conviennent parfaitement aux besoins d'une application comme Jimmy School.

Les collections principales dans Firestore sont :

*   **users** : Stocke les informations des utilisateurs, y compris leur rôle (étudiant, formateur, admin), leur statut de vérification, et leurs informations de profil.
*   **courses** : Contient tous les détails sur les cours individuels, tels que le titre, la description, le prix, l'ID du formateur, et les métadonnées (nombre de vues, de ventes).
*   **playlists** : Similaire à `courses`, mais pour les séries de vidéos. Contient les métadonnées de la playlist et un tableau des vidéos incluses.
*   **purchases** : Enregistre chaque transaction d'achat de cours, liant un utilisateur à un cours et stockant le statut du paiement.
*   **comments** : Stocke les commentaires et les évaluations laissés par les utilisateurs sur les cours.
*   **wallets** : Gère le solde financier de chaque formateur, en suivant les gains totaux et le solde disponible pour le retrait.
*   **kyc** : Stocke les informations relatives aux soumissions de documents de vérification d'identité (Know Your Customer) pour les formateurs.
*   **adminEvents** : Une collection utilisée pour la journalisation des événements importants ou des erreurs survenant dans le backend, à des fins de débogage et de surveillance.

### Firebase Storage

Firebase Storage est utilisé pour le stockage et la gestion des fichiers uploadés par les utilisateurs. Il offre une solution simple et sécurisée pour gérer les contenus binaires.

Dans Jimmy School, Firebase Storage est utilisé pour :

*   **Miniatures de Cours** : Les formateurs uploadent les images de miniature pour leurs cours et playlists. Ces images sont stockées dans le bucket de Firebase Storage et leurs URL sont ensuite référencées dans les documents Firestore correspondants.
*   **Documents KYC** : Lors du processus de vérification pour devenir formateur, les utilisateurs uploadent leurs pièces d'identité. Ces documents sensibles sont stockés dans un répertoire sécurisé sur Firebase Storage, avec des règles de sécurité strictes pour garantir que seuls les administrateurs autorisés peuvent y accéder.

### Analyse de la Sécurité de la Base de Données

Un aspect crucial de la sécurité de Firebase réside dans la définition de règles de sécurité (`Security Rules`) pour Firestore et Storage. Ces règles sont définies côté serveur et permettent de contrôler précisément qui peut lire, écrire ou supprimer des données.

**Absence de Fichiers de Règles**

Une recherche dans le dépôt de code n'a pas permis de trouver les fichiers `firestore.rules` ou `storage.rules`. Cela suggère l'un des deux scénarios suivants :

1.  **Règles par Défaut ou Gérées via la Console** : Les règles sont peut-être gérées directement depuis la console Firebase. Souvent, les projets commencent avec des règles de développement très permissives (par exemple, `allow read, write: if true;`), ce qui représente un risque de sécurité majeur en production.
2.  **Accès via un Backend Sécurisé** : L'architecture peut intentionnellement restreindre tout accès direct de la part des clients à la base de données, en forçant toutes les interactions à passer par le Cloudflare Worker, qui, lui, utilise un compte de service avec des privilèges élevés. C'est une approche de sécurité valide, mais elle doit être complétée par des règles qui bloquent effectivement les accès directs.

**Recommandations de Sécurité**

Il est impératif de définir des règles de sécurité granulaires. Voici un exemple de ce à quoi pourraient ressembler des règles de sécurité pour la collection `courses` :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Les cours publiés sont lisibles par tout le monde.
    match /courses/{courseId} {
      allow read: if resource.data.isPublished == true;
      // Seul le formateur propriétaire du cours peut le modifier.
      // L'utilisateur doit être authentifié et son UID doit correspondre
      // au `teacherId` du cours.
      allow write: if request.auth != null && request.auth.uid == resource.data.teacherId;
    }
  }
}
```

Sans la présence de ces fichiers de règles dans le projet, il est impossible de vérifier la posture de sécurité de la base de données, ce qui constitue un point d'attention critique à adresser.

## 5. Modèles de Données

L'utilisation de TypeScript dans l'ensemble du projet permet de définir des modèles de données clairs et cohérents, qui sont partagés entre le frontend et (conceptuellement) le backend. Ces modèles sont définis dans le fichier `types.ts`.

### User

L'interface `User` représente un utilisateur de la plateforme.

*   `uid`: L'identifiant unique de l'utilisateur (généralement fourni par Firebase Authentication).
*   `email`: L'adresse e-mail de l'utilisateur.
*   `displayName`: Le nom d'affichage de l'utilisateur.
*   `role`: Le rôle de l'utilisateur (`student`, `teacher`, `admin`), qui détermine ses permissions.
*   `isTeacherVerified`: Un booléen indiquant si un formateur a été vérifié.
*   `photoURL`: L'URL de l'avatar de l'utilisateur.
*   `teacherStatus`: Le statut du processus de vérification pour les formateurs (`pending`, `approved`, `rejected`).

### Course

L'interface `Course` représente un cours individuel.

*   `id`: L'identifiant unique du cours.
*   `title`: Le titre du cours.
*   `description`: La description du cours.
*   `teacherId`: L'ID de l'utilisateur (formateur) qui a créé le cours.
*   `teacherName`: Le nom du formateur.
*   `thumbnailUrl`: L'URL de l'image de miniature du cours.
*   `videoUrl`: L'ID de la vidéo sur Bunny.net.
*   `price`: Le prix du cours.
*   `viewCount`, `saleCount`: Des compteurs pour le nombre de vues et de ventes.
*   `isPublished`: Un booléen pour contrôler la visibilité du cours.
*   `videoStatus`: Indique l'état du traitement de la vidéo (`processing`, `ready`, `failed`).

### Playlist

L'interface `Playlist` représente une série de cours.

*   Elle partage de nombreuses propriétés avec `Course` (id, title, teacherId, etc.).
*   `courseCount`: Le nombre de vidéos dans la playlist.
*   `totalDuration`: La durée totale de toutes les vidéos de la playlist.
*   `videos`: Un tableau d'objets représentant chaque vidéo de la série, avec ses propres métadonnées (titre, URL, durée, etc.).

### Purchase

L'interface `Purchase` représente une transaction d'achat.

*   `id`: L'identifiant unique de la transaction.
*   `courseId`: L'ID du cours ou de la playlist acheté.
*   `userId`: L'ID de l'utilisateur qui a effectué l'achat.
*   `teacherId`: L'ID du formateur qui reçoit les revenus de la vente.
*   `amount`: Le montant de la transaction.
*   `status`: Le statut du paiement (`pending`, `completed`, `failed`).

## 6. Authentification et Autorisation

La gestion des utilisateurs, de leur authentification et de leurs permissions est un aspect fondamental de la plateforme Jimmy School. Le système repose sur une combinaison de Firebase Authentication et d'une logique de rôles gérée dans Firestore.

### Flux d'Authentification

1.  **Inscription (`Sign Up`)** : Un nouvel utilisateur s'inscrit via un formulaire qui collecte son nom, son adresse e-mail et son mot de passe. Le service `authService` utilise Firebase Authentication pour créer un nouvel utilisateur. Simultanément, un document est créé dans la collection `users` de Firestore, avec le `uid` de l'utilisateur comme identifiant de document, pour stocker les informations de profil supplémentaires (comme le rôle, initialisé à `student`).
2.  **Connexion (`Login`)** : Un utilisateur existant se connecte avec son e-mail et son mot de passe. Firebase Authentication valide les informations d'identification.
3.  **Gestion de la Session** : Une fois l'utilisateur authentifié, l'état de la session est géré globalement à l'aide du store Zustand (`useAuth`). Ce store conserve les informations de l'utilisateur et un token d'authentification. L'état de l'utilisateur est persisté, de sorte que l'utilisateur reste connecté même après avoir rechargé la page.
4.  **Déconnexion (`Sign Out`)** : Le service `authService` invalide la session de l'utilisateur, et l'état global est vidé.

### Autorisation Basée sur les Rôles

L'application implémente un système d'autorisation basé sur les rôles pour contrôler l'accès aux différentes fonctionnalités et sections de l'application. Le rôle de chaque utilisateur est stocké dans son document Firestore.

*   **Student** (Étudiant) : Le rôle par défaut pour tout nouvel utilisateur. Les étudiants peuvent parcourir les cours, les acheter, les visionner, et interagir avec la plateforme du point de vue d'un consommateur de contenu.
*   **Teacher** (Formateur) : Les utilisateurs peuvent demander à devenir formateurs. Une fois leur demande approuvée par un administrateur (après un processus de KYC), leur rôle est changé en `teacher`. Les formateurs ont accès à un tableau de bord dédié où ils peuvent créer, gérer et publier leurs cours, suivre leurs revenus et demander des retraits.
*   **Admin** (Administrateur) : Ce rôle dispose des permissions les plus élevées. Les administrateurs peuvent gérer les utilisateurs, valider les demandes des formateurs, gérer le contenu de la plateforme et superviser l'ensemble de l'application.

La logique de contrôle d'accès est implémentée côté client au niveau du routage (dans `App.tsx`) et de l'affichage conditionnel des composants, en se basant sur le rôle de l'utilisateur stocké dans l'état `useAuth`.

## 7. Workflows Détaillés : Le Carnet de Route de l'Application

Cette section remplace la précédente vue d'ensemble des fonctionnalités par une analyse séquentielle et technique des processus clés, créant un véritable "carnet de route" du fonctionnement interne de l'application.

### Workflow 1 : Achat d'un Cours par un Étudiant

Ce workflow décrit chaque étape, de la décision d'achat à l'accès au contenu vidéo.

| Étape | Acteur | Action | Fonctions / Endpoints Clés | Interactions Base de Données / Services |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Utilisateur** | Clique sur "Acheter le cours" sur la page de détail. | `CourseDetail.tsx` -> `handleBuy()` | - |
| 2 | **Frontend** | Prépare et envoie une requête au backend. | `workerApi.createDeposit(userId, courseId, price)` | Appel `POST` à `/deposits/create` du Worker. |
| 3 | **Backend (Worker)** | Reçoit la requête, la valide, génère un `depositId`. | `handleCreateDeposit` | - |
| 4 | **Backend (Worker)** | Construit et envoie une requête à l'API PawaPay. | `fetch('https://api.pawapay.io/v2/paymentpage')` | Communication sécurisée avec l'API PawaPay. |
| 5 | **PawaPay** | Crée une session de paiement et retourne une `redirectUrl`. | - | - |
| 6 | **Backend (Worker)** | Renvoie la `redirectUrl` et le `depositId` au frontend. | `jsonResponse({ paymentUrl, depositId })` | - |
| 7 | **Frontend** | Affiche un `iframe` avec l'URL de PawaPay. | `useState` pour `setShowPayment(true)` | L'utilisateur interagit avec l'interface de PawaPay. |
| 8 | **Frontend** | Démarre le polling pour vérifier le statut du paiement. | `pollStatus(depositId)` -> `workerApi.getDepositStatus(id)` | Appels `GET` périodiques à `/deposits/status/{depositId}`. |
| 9 | **Backend (Worker)** | Interroge PawaPay pour le statut de la transaction. | `handleCheckDepositStatus` | Appel `GET` à `https://api.pawapay.io/v2/deposits/{depositId}`. |
| 10 | **Frontend** | Reçoit le statut `completed`. | `grantAccess(depositId)` | - |
| 11 | **Frontend** | Crée un document dans la collection `purchases`. | `addDoc(collection(db, 'purchases'), ...)` | **ÉCRITURE** sur Firestore : `purchases/{purchaseId}`. |
| 12 | **Frontend** | Met à jour le compteur de ventes sur le document du cours. | `updateDoc(doc(db, 'courses', course.id), ...)` | **MISE À JOUR** sur Firestore : `courses/{courseId}`. |
| 13 | **Frontend** | L'interface se met à jour, affichant "Regarder maintenant". | Le hook `useQuery` pour `purchaseStatus` est invalidé et se met à jour. | - |

### Workflow 2 : Création d'un Cours par un Formateur

Ce workflow détaille le processus en plusieurs étapes pour la création de contenu vidéo.

| Étape | Acteur | Action | Fonctions / Endpoints Clés | Interactions Base de Données / Services |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Formateur** | Remplit le formulaire et sélectionne les fichiers. | `CreateCourse.tsx` | - |
| 2 | **Frontend** | Gère la soumission du formulaire. | `handleCreate(e)` | - |
| 3 | **Frontend** | **Upload de la miniature** directement sur Firebase Storage. | `uploadBytes(thumbRef, thumbFile)` -> `getDownloadURL(thumbRef)` | **ÉCRITURE** sur Firebase Storage : `/thumbnails/{fileName}`. |
| 4 | **Frontend** | Demande la création d'une vidéo "vide" au backend. | `workerApi.createBunnyVideo(title, ...)` | Appel `POST` à `/bunny/create` du Worker. |
| 5 | **Backend (Worker)** | Relaye la demande de création à Bunny.net. | `handleBunnyCreate` | Appel `POST` à `https://video.bunnycdn.com/library/{id}/videos`. |
| 6 | **Bunny.net** | Crée la vidéo et retourne un `videoId`. | - | - |
| 7 | **Backend (Worker)** | Renvoie le `videoId` au frontend. | `jsonResponse({ videoId })` | - |
| 8 | **Frontend** | **Upload de la vidéo** en utilisant le `videoId` obtenu. | `workerApi.uploadVideo(videoId, videoFile, ...)` | Appel `PUT` à `/bunny/upload?videoId={videoId}` du Worker. |
| 9 | **Backend (Worker)** | Agit comme un proxy et transfère le fichier vidéo. | `handleBunnyUpload` | Appel `PUT` à `https://video.bunnycdn.com/library/{id}/videos/{videoId}`. |
| 10 | **Frontend** | Une fois l'upload terminé, crée le document du cours. | `addDoc(collection(db, 'courses'), ...)` | **ÉCRITURE** sur Firestore : `courses/{newCourseId}`. |
| 11 | **Formateur** | Est notifié du succès et redirigé. | `alert(...)` -> `navigate('/teacher')` | - |
| 12 | **Bunny.net** | En arrière-plan, encode et traite la vidéo. | - | Le statut de la vidéo passe de `processing` à `ready`. |

## 8. Déploiement et Environnement

### Déploiement du Frontend

Le frontend de l'application, construit avec Vite, est déployé en tant que site statique. Le processus de déploiement est le suivant :

1.  **Build** : La commande `npm run build` est exécutée pour compiler le code TypeScript et React, et pour créer un ensemble optimisé de fichiers statiques (HTML, CSS, JavaScript) dans le répertoire `dist/`.
2.  **Hébergement** : Ces fichiers statiques peuvent être hébergés sur n'importe quel service d'hébergement statique, tel que Vercel, Netlify, ou Firebase Hosting.

### Déploiement du Backend

Le backend, étant un Cloudflare Worker, est déployé sur l'infrastructure de Cloudflare. Le déploiement se fait généralement via l'outil en ligne de commande `wrangler`.

1.  **Configuration** : Le fichier `wrangler.toml` (non présent dans le projet mais conceptuellement nécessaire) contiendrait la configuration du Worker, y compris son nom, les routes qu'il doit gérer, et les liaisons avec les variables d'environnement.
2.  **Déploiement** : La commande `wrangler publish` déploie le script du Worker sur le réseau de Cloudflare.

### Variables d'Environnement

Pour que l'application fonctionne correctement, plusieurs variables d'environnement doivent être configurées.

#### Côté Frontend (fichier `.env`)

*   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc. : Ces variables contiennent la configuration du projet Firebase et sont nécessaires pour que le client Firebase puisse s'initialiser correctement. Elles sont préfixées par `VITE_` pour être exposées au client par Vite.

#### Côté Backend (Cloudflare Worker Secrets)

Ces variables sont stockées de manière sécurisée dans les secrets du Cloudflare Worker et ne sont jamais exposées au client.

*   `PAWAPAY_API_TOKEN` : Le token d'API secret pour s'authentifier auprès de PawaPay.
*   `FIREBASE_SERVICE_ACCOUNT` : Le JSON du compte de service Firebase (sous forme de chaîne de caractères), qui permet au Worker d'effectuer des opérations d'administration sur Firestore.
*   `ADMIN_API_KEY` : Une clé secrète personnalisée pour protéger les endpoints administratifs du Worker.
*   `CRON_SECRET` : Une clé secrète pour sécuriser les tâches planifiées (CRON) qui pourraient être appelées.
*   `BUNNY_API_KEY`, `BUNNY_LIBRARY_ID`, etc. : Les clés et identifiants nécessaires pour interagir avec l'API de Bunny.net.

## 9. Conclusion

L'architecture de Jimmy School est un excellent exemple de la manière dont les technologies modernes peuvent être combinées pour créer une application web robuste, performante et scalable.

### Points Forts de l'Architecture

*   **Découplage** : La séparation claire entre le frontend (React SPA) et le backend (Cloudflare Worker) permet un développement et un déploiement indépendants des deux parties, ce qui facilite la maintenance et l'évolution de l'application.
*   **Scalabilité** : L'utilisation de services managés et serverless (Firebase, Cloudflare Workers, Bunny.net) signifie que l'application peut gérer une charge d'utilisateurs croissante sans nécessiter une gestion manuelle de l'infrastructure.
*   **Sécurité** : La logique métier sensible et les clés d'API sont isolées dans le Cloudflare Worker, ce qui réduit considérablement la surface d'attaque. Des mesures de sécurité supplémentaires comme les URL signées et le rate limiting renforcent la protection de la plateforme.
*   **Performance** : Le frontend, servi statiquement, et le backend, exécuté sur le réseau Edge de Cloudflare, garantissent des temps de chargement et de réponse rapides pour les utilisateurs du monde entier.
*   **Expérience de Développement** : L'utilisation de technologies comme Vite, TypeScript et React Query améliore la productivité et la qualité du code.

### Axes d'Amélioration Potentiels

*   **Tests Automatisés** : Le projet pourrait bénéficier de l'ajout d'une suite de tests automatisés (tests unitaires, tests d'intégration, tests de bout en bout) pour garantir la stabilité et la non-régression des fonctionnalités au fil des évolutions.
*   **Observabilité** : Mettre en place des outils de monitoring et de logging plus avancés (en plus des `adminEvents`) pour suivre les performances et l'état de santé de l'application en production.
*   **Internationalisation (i18n)** : Préparer l'application pour une expansion future en intégrant une bibliothèque d'internationalisation pour gérer les traductions.
*   **CI/CD (Intégration et Déploiement Continus)** : Automatiser les processus de build et de déploiement à l'aide d'un pipeline CI/CD (par exemple, avec GitHub Actions) pour accélérer et sécuriser les mises en production.

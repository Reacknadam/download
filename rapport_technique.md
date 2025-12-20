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

## 7. Fonctionnalités Clés et Workflows

Cette section décrit les parcours utilisateurs principaux et les fonctionnalités clés de l'application.

### Workflow du Formateur : De la Création à la Monétisation

1.  **Devenir Formateur** : Un utilisateur avec un rôle `student` peut demander à devenir formateur via la page "Devenir Formateur". Cette action met à jour son statut en `pending` et le redirige vers un processus de vérification (KYC).
2.  **KYC (Know Your Customer)** : Le futur formateur doit soumettre une pièce d'identité. Le fichier est uploadé sur Firebase Storage et un document est créé dans la collection `kyc`. Un administrateur doit ensuite valider manuellement ces informations.
3.  **Création de Cours** : Une fois approuvé, le formateur accède à son tableau de bord et peut commencer à créer du contenu. Le processus de création de cours implique de fournir un titre, un prix, une miniature (uploadée sur Firebase Storage) et une vidéo (uploadée sur Bunny.net via le Cloudflare Worker).
4.  **Publication** : Après la création, le cours est initialement non publié. Le formateur peut le prévisualiser et le publier lorsqu'il est prêt. La publication le rend visible pour tous les étudiants sur la plateforme.
5.  **Gestion des Revenus** : Chaque vente de cours crédite le portefeuille (`wallet`) du formateur (après déduction de la commission de la plateforme). Le formateur peut consulter son solde et l'historique de ses gains depuis son tableau de bord.
6.  **Retrait des Gains (Payout)** : Le formateur peut demander un retrait de son solde. La demande est traitée par le Cloudflare Worker, qui interagit avec PawaPay pour effectuer le virement sur le numéro de téléphone mobile money du formateur.

### Workflow de l'Étudiant : De la Découverte à l'Apprentissage

1.  **Découverte de Cours** : L'étudiant peut parcourir les cours et les playlists depuis le tableau de bord principal, utiliser la fonction de recherche, et consulter les détails de chaque cours.
2.  **Achat de Cours** : Pour acheter un cours, l'étudiant clique sur le bouton d'achat, ce qui déclenche une requête vers le Cloudflare Worker. Le Worker crée une page de paiement PawaPay et l'étudiant est redirigé pour finaliser la transaction.
3.  **Accès au Contenu** : Une fois le paiement confirmé, un document est créé dans la collection `purchases`, ce qui accorde à l'étudiant l'accès au cours. Il peut alors visionner la vidéo du cours.
4.  **Visionnage** : La lecture de la vidéo se fait via un lecteur sécurisé qui charge la vidéo depuis Bunny.net. L'URL de la vidéo est signée et à durée de vie limitée pour empêcher le partage non autorisé.
5.  **Interaction** : L'étudiant peut laisser des commentaires et des évaluations sur les cours qu'il a achetés, contribuant ainsi à la communauté et fournissant un retour d'information précieux au formateur.

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
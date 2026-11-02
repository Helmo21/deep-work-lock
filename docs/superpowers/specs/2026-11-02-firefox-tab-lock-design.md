# Deep Work Lock pour Firefox — document de conception

Date : 2026-11-02
Statut : brouillon, en attente de validation
Prolonge : `docs/superpowers/specs/2026-11-01-deep-work-lock-design.md` (la V1, Chrome). Tout ce que ce document ne change pas reste valable.

## 1. Intention

La V1 verrouille un onglet Chrome. L'utilisateur se sert aussi de Firefox et veut exactement le même verrou : dans le menu **◉ Focus**, les fenêtres Firefox se déplient pour proposer leurs onglets, et choisir un onglet le verrouille comme un onglet Chrome. Rien d'autre ne change dans l'expérience.

Pour l'instant, l'outil sert à l'utilisateur seul. Il envisage de le partager plus tard : le travail fait maintenant ne doit pas fermer cette porte.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**

- Verrouiller un onglet Firefox avec le même comportement que pour Chrome (section 5).
- Verrouiller une fenêtre Firefox entière, comme pour une fenêtre Chrome.
- Chrome et Firefox peuvent être ouverts en même temps. Chacun propose ses onglets dans le menu. Les deux extensions sont connectées en parallèle.
- Une extension Firefox **signée par Mozilla, non publiée** (canal « unlisted »), installée de façon permanente depuis un fichier `.xpi`.
- Préparer la publication future sur le catalogue Mozilla sans réécriture : identifiant d'extension stable, déclaration de collecte de données (« aucune »), icône.

**Non-objectifs**

- Publication sur le catalogue public Mozilla, le Chrome Web Store ou extensions.gnome.org.
- Un installeur grand public (binaire, `.deb`, Flatpak), ou une installation de la passerelle par l'extension GNOME elle-même (modèle GSConnect). Ce sera un projet séparé, au moment du partage.
- Les autres navigateurs (Chromium, Brave, Edge, Firefox ESR ou Developer Edition) et Firefox installé hors snap. Le code ne doit pas les rendre impossibles, mais rien n'est testé.
- Wayland, toujours.

**Anti-objectifs**

- **Une issue propre à Firefox.** Si Firefox offre une sortie que Chrome n'offre pas (fermer et rouvrir le navigateur, une page `about:` qui désactive l'extension), l'outil est raté pour Firefox.
- **Casser Chrome.** Le verrou Chrome qui marche aujourd'hui doit continuer de marcher à l'identique, sans que l'utilisateur ait à recharger quoi que ce soit côté Chrome (sauf mise à jour de l'extension, signalée).
- **Tous les anti-objectifs de la V1** : pas de sortie anticipée, réglages restaurés, la cible reste utilisable.

## 3. Contraintes

- **Firefox 156.0.1 en snap** (`/snap/bin/firefox`), seul Firefox installé. Le paquet `firefox` du système est un paquet de transition vers le snap.
- **Messagerie native depuis le snap** : elle passe par le portail `org.freedesktop.portal.WebExtensions` de `xdg-desktop-portal` 1.18.4, présent et actif sur la machine. Le portail lit les manifestes d'hôtes natifs dans `~/.mozilla/native-messaging-hosts/` et lance l'hôte hors du bac à sable. Au premier lancement, il peut demander une autorisation à l'utilisateur.
- **Fenêtres Firefox en X11** : `WM_CLASS` = `"Navigator", "firefox_firefox"` ; titre = `<titre de l'onglet actif> — Mozilla Firefox` (tiret cadratin U+2014 entouré d'espaces). Chrome reste `… - Google Chrome` (tiret simple).
- **Firefox exige une signature Mozilla** pour installer une extension de façon permanente. L'utilisateur crée un compte Mozilla et génère des clés API (développeur : addons.mozilla.org → Outils → Gérer les clés API). Les clés ne doivent jamais être écrites dans le dépôt.
- Machine, GNOME, Python, Node : inchangés depuis la V1.

## 4. Décisions prises avec l'utilisateur

1. **Même comportement que Chrome** pour un onglet Firefox verrouillé.
2. **Pendant un verrou Firefox, Chrome est caché comme toute autre fenêtre**, et inversement. Pas de comportement particulier entre navigateurs.
3. **Extension signée, non publiée**, avec un compte Mozilla que l'utilisateur crée.
4. **Le partage public est un projet séparé**, plus tard. La piste retenue pour ce jour-là est le modèle GSConnect (extension GNOME sur extensions.gnome.org qui installe elle-même la passerelle, extensions navigateur sur les catalogues officiels) ; elle n'est pas à construire maintenant.

## 5. Comportement attendu

### 5.1 Menu

- Les fenêtres Firefox apparaissent dans la liste des cibles comme les fenêtres Chrome : elles se déplient sur « Toute la fenêtre » puis la liste de leurs onglets.
- Fenêtres Firefox au titre identique : même règle que Chrome, pas de sous-menu d'onglets, verrouillables comme fenêtres.
- Si l'extension Firefox n'est pas joignable alors qu'une fenêtre Firefox est ouverte : message « Extension Firefox non connectée : onglets indisponibles », sur le modèle du message Chrome. Si les deux navigateurs sont injoignables, les deux messages s'affichent.
- L'échec d'un navigateur n'empêche pas l'autre de proposer ses onglets.

### 5.2 Pendant un verrou d'onglet Firefox

Identique à Chrome (V1, section 5.2 et README) :

- nouvel onglet dans n'importe quelle fenêtre : fermé ;
- activation d'un autre onglet : retour à l'onglet verrouillé ;
- nouvelle fenêtre : fermée, sauf les popups ouvertes par l'onglet (connexion), confinées aux mêmes sites ;
- navigation limitée à l'hôte de l'onglet et ses sous-domaines, plus les pages de connexion Google, Microsoft et Apple ;
- onglet fermé : rouvert sur sa dernière adresse ;
- onglet glissé hors de sa fenêtre : remis à sa place.

**Pages internes de Firefox** : tout ce qui n'est pas http(s) est bloqué dans l'onglet verrouillé, sauf `about:blank` et équivalents inoffensifs (règle `isInternalUrl` actuelle). Cela couvre `about:addons`, `about:debugging`, `about:config`, `about:preferences`, `about:newtab`, `about:reader`, `moz-extension:`, `view-source:`. Les raccourcis qui ouvrent ces pages dans un nouvel onglet (Ctrl+Maj+A, menu ☰) tombent sous la règle « nouvel onglet fermé ».

**Côté bureau** : rien de nouveau. Les autres fenêtres, dont Chrome, sont minimisées. Les nouvelles fenêtres Firefox ne sont autorisées que si l'extension Firefox les a annoncées (popup de connexion, onglet rouvert dans une nouvelle fenêtre), exactement comme pour Chrome aujourd'hui.

### 5.3 Robustesse

- **Firefox fermé par l'utilisateur (Ctrl+Q, dernière fenêtre fermée)** : même règle que Chrome en V1, le bureau reste vide jusqu'à la fin. GNOME ne relance pas Firefox. Chrome garde exactement son comportement actuel. *(Choix du concepteur, aligné sur la V1.)*
- **Firefox qui redémarre de lui-même** (mise à jour, « Redémarrer » après une modification) : ses nouvelles fenêtres restent cachées tant que l'extension ne les a pas annoncées. Une fois reconnectée, l'extension récupère le verrou auprès de GNOME (`GetLock`), retrouve ou rouvre l'onglet verrouillé (les identifiants d'onglets changent d'une exécution à l'autre ; méthode au choix du builder, par exemple rouvrir la dernière adresse et adopter ce nouvel onglet) et annonce sa fenêtre. Si cela ne marche pas, le bureau reste vide, ce qui n'est pas une sortie. *(Choix du concepteur.)*
- **Mode de dépannage de Firefox** (☰ → Aide, ou Maj au démarrage) : Firefox redémarre sans extension. Pour un verrou d'onglet, ses fenêtres ne sont jamais annoncées et restent cachées : bureau vide, pas de sortie. Pour un verrou de **fenêtre** de navigateur, la règle V1 « fenêtre de la même application ouverte après le verrouillage » ne doit **pas** s'appliquer : une nouvelle fenêtre de navigateur ne devient la cible que si l'extension l'a annoncée. Cette règle plus stricte vaut pour Chrome comme pour Firefox. Pas de politique d'entreprise système, pas de sudo : l'installation reste par utilisateur. *(Choix du concepteur.)*
- **Redémarrage de GNOME Shell pendant un verrou Firefox** : reprise comme pour Chrome.
- **Session commencée avec l'ancienne version** (fichier d'état écrit par la V1 avec un champ Chrome) : doit reprendre correctement après mise à jour.

## 6. Architecture technique

Les quatre morceaux de la V1 restent. Ce qui change :

### 6.1 Extension navigateur

- Une seule base de code pour Chrome et Firefox : `lock.js` (décisions pures) et la logique du `background.js` sont partagés. L'API `chrome.*` est disponible dans Firefox ; le builder vérifie chaque appel utilisé (`declarativeNetRequest` règles de session avec `tabIds` et `excludedRequestDomains`, `storage.session`, `webNavigation`, `windows`, `tabs.move`, `runtime.connectNative`).
- Manifeste Firefox : MV3, `background.scripts` (page d'événements, Firefox n'a pas de service worker d'extension), `browser_specific_settings.gecko.id` stable, `strict_min_version` compatible avec la déclaration `data_collection_permissions: {required: ["none"]}`, pas de champ `key`.
- **Garder la page d'événements en vie** : Firefox peut suspendre une page d'événements inactive. La connexion à l'hôte natif doit tenir pendant toute une session et se rétablir sinon. Le builder vérifie le comportement réel de Firefox 156 avec un port natif ouvert et adapte (réveil sur `runtime.onStartup`, reconnexion, etc.).
- Le dossier `chrome-extension/` reste chargeable tel quel par Chrome au même chemin (l'utilisateur l'a chargé depuis là). L'organisation des fichiers partagés et la façon de produire l'extension Firefox (dossier séparé, script de construction, liens) sont laissées au builder, sous cette contrainte.
- Signature : le builder ne dispose pas du compte Mozilla. Il teste avec une installation temporaire (`about:debugging`) ; l'utilisateur crée son compte et lance lui-même la signature à la fin. L'identifiant gecko est donc définitif avant toute soumission (une soumission le lie au compte pour toujours). Un script (par exemple `scripts/sign-firefox.sh`) qui construit l'extension Firefox et la fait signer en « unlisted » avec `web-ext sign`, les clés étant lues dans des variables d'environnement. Il produit un `.xpi` à installer. Le `.xpi` et les clés ne sont pas versionnés.

### 6.2 Hôte natif

- Un seul script Python pour les deux navigateurs. Il reconnaît le navigateur qui l'a lancé à ses arguments (Chrome passe l'origine `chrome-extension://…/` ; Firefox passe le chemin du manifeste puis l'identifiant de l'extension).
- Chaque instance prend un nom D-Bus propre à son navigateur, pour que les deux tournent ensemble : `org.deepworklock.ChromeBridge` (inchangé) et `org.deepworklock.FirefoxBridge`, avec la même interface `ListWindows` / `Lock` / `Unlock`.
- Les annonces de fenêtres attendues vers GNOME indiquent le navigateur concerné.
- Nouveau manifeste d'hôte pour Firefox : `~/.mozilla/native-messaging-hosts/org.deepworklock.host.json` avec `allowed_extensions: ["<id gecko>"]`. Le manifeste Chrome ne change pas.

### 6.3 Extension GNOME

- Ce qui est propre à Chrome devient une table de navigateurs : pour chacun, comment reconnaître ses fenêtres (`WM_CLASS`), le suffixe de titre pour la correspondance fenêtre X11 ↔ fenêtre du navigateur, le nom D-Bus de sa passerelle, son icône et son nom affiché. Chrome et Firefox au départ.
- La correspondance par titre (`matchChromeWindows`) devient générique, paramétrée par le suffixe.
- La cible d'une session indique le navigateur (`browser: 'chrome' | 'firefox'`) en plus de l'onglet et de la fenêtre. Le verrou est envoyé à la bonne passerelle et levé sur la bonne passerelle.
- Les fenêtres annoncées par une extension ne valent que pour les fenêtres de ce navigateur.
- Service D-Bus `org.deepworklock.Shell` : `GetLock` reste ; l'annonce de fenêtre attendue porte le navigateur. La passerelle Chrome déjà installée doit continuer de fonctionner pendant la mise à jour (méthode existante gardée ou version compatible), au choix du builder.

### 6.4 Installation

- `install.sh` installe aussi le manifeste d'hôte Firefox et explique comment installer le `.xpi` signé (et, en attendant la signature, comment le charger temporairement par `about:debugging` pour tester).
- `uninstall.sh` retire aussi le manifeste Firefox et rappelle de retirer l'extension dans `about:addons`.
- README mis à jour : Firefox, création du compte et des clés Mozilla, commande de signature.

## 7. Laissé au builder

- Organisation des fichiers partagés entre Chrome et Firefox, outillage de construction (`web-ext` via `npx` est acceptable).
- L'identifiant gecko exact (format courriel, stable pour toujours une fois signé).
- Comment retrouver l'onglet verrouillé après une fermeture et réouverture de Firefox (section 5.3).
- Comment garder la connexion native vivante dans la page d'événements Firefox.
- Compatibilité D-Bus pendant la mise à jour.
- Tests : la logique pure (table des navigateurs, correspondance par titre avec le tiret cadratin, détection du navigateur par l'hôte, manifeste Firefox) a des tests automatiques ; le reste est vérifié en vrai dans Firefox, avec une liste de vérifications manuelles à remettre à l'utilisateur.

**À vérifier en premier**, avant de bâtir le reste : depuis le Firefox snap de la machine, une extension temporaire atteint-elle l'hôte natif Python via le portail, et ce dernier peut-il parler au bus de session ? Si non, s'arrêter et revenir vers l'utilisateur.

## 8. Limites connues et acceptées

- **La barre latérale de Firefox** (marque-pages, historique, assistant IA intégré) n'est pas un onglet : une extension ne peut pas la fermer. Même famille que le panneau latéral de Chrome et les outils de développement ancrés, déjà acceptés en V1.
- Fenêtres de navigation privée : l'extension n'y a pas accès par défaut ; le verrou bureau les minimise (comme Chrome).
- Désactiver l'extension depuis `about:addons` est impossible pendant une session (page interne bloquée), possible entre deux sessions.
- Entre deux sessions, l'utilisateur peut désinstaller l'extension : accepté, comme pour Chrome.

# Deep Work Lock — document de conception

Date : 2026-11-01
Statut : brouillon, en attente de validation

## 1. Intention

Un verrou de concentration pour le bureau Linux. L'utilisateur choisit une durée, puis une seule cible à l'écran : une fenêtre, un onglet Chrome précis, ou une application entière. Pendant la durée choisie, cette cible est la seule chose qu'il peut voir et manipuler. Rien ne permet de sortir avant la fin du compte à rebours.

**Pourquoi.** L'utilisateur s'éparpille de deux façons :

- **Chercher de l'aide trop tôt** : ouvrir Claude dans le navigateur pour écrire un article avant d'avoir poussé sa propre réflexion assez loin.
- **La distraction classique** : messages, divertissement.

L'outil le garde seul avec sa tâche. Une friction contournable ne suffit pas : l'utilisateur veut un vrai mur et accepte d'être coincé jusqu'à la fin du minuteur.

**Exemples de cibles** : un onglet Google Docs ou Word en ligne pour écrire un article, Photoshop pour éditer une image, une fenêtre VS Code.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**

- Lancer une session en quelques clics : durée, cible, verrouiller.
- Pendant la session, empêcher toute sortie de la cible : changement de fenêtre, changement d'onglet, raccourcis clavier, dock, barre du haut, vue d'ensemble, nouvelles fenêtres, nouveaux onglets, navigation vers un autre site.
- Couper les notifications pendant la session.
- Afficher le temps restant.
- Tout rendre à l'identique à la fin.

**Non-objectifs (première version)**

- Firefox et les autres navigateurs. Firefox viendra dans un second temps ; il est installé en snap sur la machine cible, ce qui complique la messagerie native.
- Wayland. La machine tourne en X11. Le choix d'une extension GNOME Shell garde la porte ouverte à Wayland plus tard, mais rien n'est testé ni garanti en Wayland pour la V1.
- Distribution publique, multi-utilisateur, autres environnements de bureau que GNOME.
- Statistiques, historique, objectifs, intégration agenda.
- Bloquer des sites dans une liste noire. L'outil fonctionne en liste blanche d'un seul élément.

**Anti-objectifs (échec même si « ça marche »)**

- **Une porte de sortie facile.** Pas de bouton « arrêter », pas de pause, pas de mot de passe d'urgence, pas de prolongation, pas de délai de grâce. Si l'utilisateur peut sortir en deux secondes, l'outil est raté.
- **Laisser la machine dans un état cassé.** Raccourcis, dock, notifications doivent revenir exactement comme avant, y compris après un plantage ou un redémarrage.
- **Bloquer la cible elle-même.** Les boîtes de dialogue de la cible (Enregistrer sous, Ouvrir, Imprimer, menus contextuels, popups d'autocomplétion) doivent fonctionner. Sinon Photoshop ou Google Docs deviennent inutilisables.

## 3. Contraintes

- **Machine cible** : Ubuntu 24.04.4 LTS (l'utilisateur pensait à Ubuntu 22, la machine est en 24.04), GNOME Shell 46, session X11.
- **Navigateur** : Google Chrome 151, installé en .deb (pas en snap).
- **Outils disponibles** : Python 3.12, Node 24.
- **Extensions GNOME déjà actives** : `ubuntu-dock@ubuntu.com`, `ding@rastersoft.com`, `tiling-assistant@ubuntu.com`, `ubuntu-appindicators@ubuntu.com`.

## 4. Décisions prises avec l'utilisateur

1. **Aucune sortie anticipée.** Le minuteur fait loi.
2. **Le redémarrage coupe le verrou.** C'est la seule issue tolérée. Une session n'est pas reprise au démarrage suivant.
3. **Architecture en deux parties** : une partie bureau et une extension navigateur.
4. **Chrome seul** pour la première version, Firefox ensuite.
5. **Le panneau de commande vit dans la barre du haut de GNOME** (maquette A) : une icône « Focus » à droite de la barre, un clic ouvre un menu avec la durée, la liste des cibles et un bouton « Verrouiller N min ».
6. **Pendant la session, le bureau reste visible mais éteint** (maquette A) : barre du haut et dock affichés mais grisés et inertes, compte à rebours en orange dans la barre, et un message bref « 🔒 Verrouillé · mm:ss restantes » à chaque tentative de sortie.

Les maquettes sont dans `.superpowers/brainstorm/*/content/` (`panneau-commande.html`, `pendant-session.html`).

## 5. Comportement attendu

### 5.1 Lancement

- Clic sur l'icône Focus : menu déroulant.
- **Durée** : presets 25, 30, 45, 60, 90 minutes, plus une valeur libre. 30 par défaut.
- **Cible** : liste des fenêtres ouvertes, avec icône et titre, et un libellé du type de cible.
  - Une fenêtre quelconque : cible de type « fenêtre ».
  - Une application : possibilité de choisir l'application entière (toutes ses fenêtres) plutôt qu'une fenêtre.
  - Une fenêtre Chrome : se déplie pour lister ses onglets ; choisir un onglet donne une cible de type « onglet ».
- Bouton « Verrouiller N min ». Pas de confirmation : le verrou s'applique immédiatement et la cible passe au premier plan.

### 5.2 Pendant la session

**Côté bureau**

- Si une autre fenêtre prend le focus, la cible est réactivée immédiatement et le message de verrouillage s'affiche.
- Neutralisés : Alt+Tab et variantes, touche Super, vue d'ensemble et coin actif, changement d'espace de travail, dock, menu des applications, lancement d'applications par raccourci.
- Toute nouvelle fenêtre qui n'appartient pas à la cible est minimisée ou cachée dès sa création.
- Les fenêtres transitoires et modales de la cible restent autorisées.
- Si la cible est minimisée, elle est restaurée.
- Notifications coupées (mode Ne pas déranger).
- La barre du haut est grisée et inerte, sauf l'affichage du compte à rebours.

**Côté Chrome (cible de type onglet)**

- Nouvel onglet créé dans n'importe quelle fenêtre : fermé.
- Activation d'un autre onglet : retour à l'onglet verrouillé.
- Nouvelle fenêtre Chrome : fermée. Les popups nécessaires à la cible, par exemple une fenêtre d'authentification ouverte par la page, sont un cas à traiter par le builder.
- Navigation de l'onglet verrouillé vers un autre site : bloquée. Le site autorisé est l'origine de l'onglet au moment du verrouillage. Les navigations internes au même site restent libres.
- Pages internes de Chrome (`chrome://`, extensions, outils de développement) : bloquées.

**Cible de type fenêtre Chrome entière** : les onglets existants de cette fenêtre restent accessibles, les autres fenêtres Chrome sont bloquées par le verrou bureau.

**Écran verrouillé** : Super+L reste possible. Au déverrouillage, la session reprend, le temps continue de s'écouler.

### 5.3 Fin de session

- À zéro : un son discret, la barre redevient normale, tous les réglages modifiés sont restaurés.
- Pas de bouton « +5 min ». Pour continuer, l'utilisateur relance une session.

### 5.4 Robustesse

- **Si la cible est fermée pendant la session** : décision de builder, voir section 7.
- **Redémarrage** : met fin à la session. Au démarrage suivant, l'extension doit restaurer tout réglage resté modifié (raccourcis, notifications, dock). L'état d'origine doit donc être sauvegardé sur disque au moment du verrouillage.
- **Redémarrage de GNOME Shell (Alt+F2 puis r en X11)** : c'est une issue au même rang qu'un redémarrage. Le comportement exact est laissé au builder, mais l'état doit rester restaurable.

## 6. Architecture technique

Quatre morceaux. Le verrou ne repose pas sur des commandes bash : seul du code exécuté dans GNOME Shell et dans Chrome peut réellement interdire quelque chose.

### 6.1 Extension GNOME Shell (GJS, ESM, GNOME 46)

Le cœur du verrou. Responsabilités :

- Bouton et menu dans la barre du haut (PanelMenu.Button).
- Liste des fenêtres et applications ouvertes (Shell.WindowTracker, Shell.AppSystem, global.display).
- Pendant la session :
  - écoute de `notify::focus-window` sur `global.display` et réactivation de la cible ;
  - écoute de `window-created` pour filtrer les nouvelles fenêtres (transient-for, application, type de fenêtre) ;
  - désactivation temporaire des raccourcis (Main.wm, réglages `org.gnome.desktop.wm.keybindings`, `org.gnome.shell.keybindings`, `org.gnome.mutter`) avec sauvegarde des valeurs d'origine ;
  - blocage de la vue d'ensemble et du coin actif ;
  - neutralisation du dock Ubuntu ;
  - coupure des notifications (`org.gnome.desktop.notifications show-banners`) ;
  - affichage du compte à rebours et des messages.
- Interface D-Bus sur le bus de session pour dialoguer avec Chrome via le pont : obtenir la liste des onglets, ordonner le verrouillage d'un onglet, signaler la fin de session.
- Sauvegarde de l'état d'origine sur disque et restauration au chargement si une session précédente ne s'est pas terminée proprement.

### 6.2 Extension Chrome (Manifest V3)

- Service worker qui écoute `chrome.tabs` et `chrome.windows` (création, activation), et `chrome.webNavigation` ou `declarativeNetRequest` pour bloquer la navigation hors origine.
- Connexion persistante à l'hôte de messagerie native.
- Répond aux demandes de liste des onglets (id, titre, URL, fenêtre).
- Applique et lève le verrou d'onglet sur ordre.
- Doit identifier quelle fenêtre X11 correspond à quelle fenêtre Chrome, pour que le menu GNOME puisse proposer les onglets sous la bonne fenêtre. La méthode de correspondance est laissée au builder.

### 6.3 Hôte de messagerie native (Python 3)

- Programme lancé par Chrome, dialogue en JSON préfixé par la longueur sur stdin et stdout.
- Traduit dans les deux sens entre Chrome et l'interface D-Bus de l'extension GNOME.
- Déclaré par un manifeste dans `~/.config/google-chrome/NativeMessagingHosts/`.

### 6.4 Installation (bash)

- Script qui installe l'extension GNOME dans `~/.local/share/gnome-shell/extensions/`, l'active, installe l'hôte natif et son manifeste, et explique comment charger l'extension Chrome en mode développeur.
- Script de désinstallation qui restaure tous les réglages.

## 7. Laissé au builder

- Organisation du code, nommage, tests.
- Stratégie exacte pour neutraliser chaque raccourci et le dock, tant que le résultat de la section 5.2 est atteint et que tout est restauré.
- Correspondance fenêtre X11 et fenêtre Chrome.
- Comportement si la cible est fermée pendant la session (proposition : la session continue avec un écran vide de distractions, ou se termine ; à trancher et signaler).
- Gestion des popups légitimes ouvertes par l'onglet verrouillé.
- Le son de fin.
- Le nom définitif du projet ; « Deep Work Lock » est provisoire.

## 8. Limites connues et acceptées

- **Ctrl+Alt+F3** ouvre une console texte hors de GNOME, d'où on peut désactiver l'extension. Toléré au même rang que le redémarrage, pas facilité.
- Désactiver l'extension Chrome depuis `chrome://extensions` est impossible pendant la session puisque les pages internes sont bloquées, mais possible entre deux sessions. C'est accepté.
- L'outil protège contre l'impulsion, pas contre une volonté déterminée de le contourner.

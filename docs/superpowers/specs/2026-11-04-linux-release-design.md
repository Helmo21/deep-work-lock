# Deep Work Lock — première sortie publique Linux — document de conception

Date : 2026-11-04
Statut : brouillon, en attente de validation
Prolonge : `2026-11-01-deep-work-lock-design.md` (V1 Chrome) et `2026-11-02-firefox-tab-lock-design.md` (Firefox). Tout ce que ce document ne change pas reste valable.

## 1. Intention

Deep Work Lock fonctionne chez son auteur, sur Ubuntu 24.04, GNOME 46, X11, avec Chrome et Firefox. Il veut maintenant le rendre installable par n'importe qui sous GNOME, depuis une page web, à la manière de la page de téléchargement de Cursor.

L'ambition à long terme est multi-plateforme : Windows avec Chrome et Firefox, puis macOS avec Safari (l'auteur a un compte Apple Developer). Ces deux plateformes exigent chacune un **nouveau verrou de bureau** écrit pour le système, pas seulement un empaquetage ; elles feront l'objet de leurs propres documents. **Ce document couvre uniquement la première sortie Linux**, et ne doit pas fermer la porte aux suivantes : le site et l'extension navigateur serviront aussi pour Windows et macOS.

### Ce qui a été constaté pendant la conception

- **Le pont Python n'est ni un bloqueur ni à remplacer.** Toute extension de navigateur qui parle au bureau en a un (KeePassXC, 1Password, GSConnect, gnome-browser-connector). Aucun catalogue ne peut l'installer. C'est un script, sans architecture à prévoir (pas de variante x64 / ARM 64), qui tourne tel quel sur toute distribution avec Python 3.
- **GNOME Shell 46 ne surveille pas le dossier des extensions** (vérifié dans `extensionSystem.js` du Shell installé). Une extension copiée à la main n'est vue qu'à la session suivante. **La seule voie de chargement à chaud est l'installation depuis extensions.gnome.org** par la méthode D-Bus `org.gnome.Shell.Extensions.InstallRemoteExtension`, qui affiche une boîte de confirmation GNOME puis charge et active l'extension immédiatement.
- **Wayland est à portée.** Vérification faite dans un GNOME imbriqué (compositeur Wayland) avec Chrome en Wayland natif et Firefox snap : les classes de fenêtre (`google-chrome`, `firefox_firefox`) et les formats de titre (`… - Google Chrome`, `… — Mozilla Firefox`) sont identiques à X11. Seule différence : la description Mutter d'une fenêtre Wayland est `W<n>` et ne contient pas d'identifiant hexadécimal, donc `windowId()` dans `windowGuard.js` renvoie `null` pour toutes les fenêtres Wayland. Chrome sous XWayland n'a pas pu être testé dans l'imbriqué ; il emprunte le chemin X11 existant.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**

- Une personne sous GNOME installe tout Deep Work Lock avec **une seule commande** copiée depuis le site. Pendant l'installation : **aucune manipulation dans un navigateur, aucune déconnexion / reconnexion**. Un clic dans une boîte de confirmation GNOME et un mot de passe `sudo` sont acceptés.
- Une commande de désinstallation symétrique, qui remet la machine dans son état d'origine.
- Fonctionnement en **X11 et en Wayland**, sur **GNOME 46 à 49**.
- L'extension GNOME publiée sur **extensions.gnome.org** ; l'extension navigateur sur le **Chrome Web Store** ; l'extension Firefox signée, hébergée par le projet.
- Un **site en anglais**, bâti sur le template Next.js `modern-cli-tool-landing-page/`, hébergé sur **Railway**, qui présente le produit, donne la commande, documente l'usage et sert les fichiers d'installation.
- Les mises à jour arrivent toutes seules : extension GNOME par extensions.gnome.org, extension Chrome par le Web Store, extension Firefox par le mécanisme de mise à jour auto-hébergé de Firefox.

**Non-objectifs**

- Windows, macOS, Safari, Edge, Samsung Internet (ce dernier n'accepte pas d'extensions générales et n'a pas de bureau à verrouiller ; il est abandonné).
- Un bouton unique sans terminal (`.deb` à double-clic, Flatpak, AppImage). Les paquets par distribution ne sont pas nécessaires : rien n'est compilé. C'est une sortie suivante possible, sur la base de ce qui est construit ici.
- Chromium, Brave, Edge sous Linux, et les navigateurs installés en **Flatpak**. Le code ne doit pas les rendre impossibles (table de navigateurs), mais rien n'est testé ni annoncé.
- Les autres bureaux que GNOME.
- Une version française du site.

**Anti-objectifs** (ce qui ferait de cette sortie un échec même si tout « marche »)

- **Une première impression ratée en Wayland** : la page dit « Linux », la personne qui clique depuis un Ubuntu ou un Fedora récent est en Wayland sans le savoir. Si le verrou n'y fait rien, ou fait n'importe quoi, c'est perdu.
- **Une installation qui laisse la personne dans un état intermédiaire** sans lui dire quoi faire : extension GNOME présente mais pas active, extension navigateur absente, pont injoignable. Chaque étape doit vérifier son résultat et, en cas d'échec, afficher la marche à suivre.
- **Une désinstallation incomplète** : politiques navigateur ou réglages GNOME restants, surtout si une session de verrou était en cours.
- **Une régression sur ce qui marche aujourd'hui** : le comportement décrit dans le README (menu, verrou, cas limites) reste la référence.

## 3. Contraintes

- **extensions.gnome.org** : revue humaine, une à trois semaines, parfois plus. Points sensibles connus : le mode de session `unlock-dialog` (justifié ici : le verrou doit survivre à l'écran de verrouillage), l'inclusion d'un script Python dans l'extension (précédent accepté : GSConnect embarque et installe lui-même son hôte de messagerie native), et l'obligation d'un champ `url` dans `metadata.json` pointant vers le dépôt. Pas de code minifié, pas de binaire.
- **Chrome Web Store** : compte développeur à 5 $ une fois (à ouvrir par l'auteur), icône 128 px obligatoire, captures d'écran 1280×800, justification des permissions et URL d'une politique de confidentialité. Le `key` du manifeste garantit que l'identifiant d'extension reste celui d'aujourd'hui.
- **Firefox** : le `.xpi` doit être signé par Mozilla (canal non listé, déjà en place avec `scripts/sign-firefox.sh`). Pour que Firefox se mette à jour depuis un `.xpi` auto-hébergé, le manifeste doit contenir `browser_specific_settings.gecko.update_url` **avant** la signature, et le site doit servir le fichier `updates.json` correspondant.
- **Politiques navigateur** : Chrome lit `/etc/opt/chrome/policies/managed/*.json` (un fichier par politique, pas de fusion nécessaire) ; Firefox lit `/etc/firefox/policies/policies.json` (fichier unique : s'il existe déjà, il faut **fusionner** et non écraser). Les deux chemins exigent root. Le snap Firefox lit bien `/etc/firefox/policies/`. Chrome applique une politique à chaud en quelques minutes ou au redémarrage ; Firefox au redémarrage.
- **Firefox snap** : la messagerie native passe par le portail `org.freedesktop.portal.WebExtensions`, dont la boîte d'autorisation peut ne pas s'afficher ; un délai sans réponse compte comme un refus définitif. L'autorisation doit être pré-accordée (déjà fait par `install.sh` via `PermissionStore`).
- **Hébergement** : compte Railway de l'auteur, espace de travail « Antoine Pedretti's Projects », aucun projet existant pour ce site. **Le nom de domaine n'est pas encore choisi** : tout ce qui le référence (site, script, `update_url`, `updates.json`, politiques) doit être paramétré en un seul endroit.
- **Machine de l'auteur** : Ubuntu 24.04, GNOME 46, session X11 (une session Wayland est disponible à la connexion), Chrome 151 en `.deb`, Firefox 156 en snap, Python 3.12, Node 24, pnpm pour le template.
- **Le dépôt GitHub (`Helmo21/deep-work-lock`) est privé et sans licence** au moment d'écrire. extensions.gnome.org exige l'adresse publique du code et une licence compatible GPL ; le repli d'installation et `updates.json` s'appuient sur les GitHub Releases ; le site renvoie vers la source du script. Le passage en public est donc un jalon dur avant toute soumission.
- **Le produit est en français en dur** : menu ◉ Focus, messages d'erreur, notification de fin, descriptions des manifestes, scripts. Les tests vérifient certaines de ces chaînes.
- **Mozilla ne re-signe jamais un même numéro de version**, et la version 0.1.0 est déjà consommée. La première version publique porte un numéro supérieur.

## 4. Décisions prises avec l'utilisateur

1. **Linux d'abord**, Windows (Chrome et Firefox) ensuite, puis macOS avec Safari. Un document par plateforme.
2. **Une seule commande** plutôt que plusieurs boutons ; le bouton unique sans terminal viendra plus tard si possible.
3. **Pas de manipulation dans le navigateur ni de déconnexion** pendant l'installation.
4. **Politiques navigateur en mode « normal »** (`normal_installed`) : l'extension s'installe seule mais reste désactivable depuis la page des extensions du navigateur, y compris en pleine session. Le mode forcé est refusé.
5. **Wayland inclus** dans cette sortie.
6. **Page d'accueil : option B** (maquette validée) : la page s'ouvre sur le produit, avec la commande dans l'en-tête ; les fonctionnalités ; puis une section Installation qui détaille les trois étapes ; Windows et macOS sont des pastilles « coming soon ».
7. **Hébergement sur Railway**, nouveau projet.
8. **Site et documentation entièrement en anglais.**
9. **Licence GPL-3.0 pour tout le projet**, et **passage du dépôt en public avant la première soumission** à un catalogue.
10. **Le produit passe en anglais en dur** pour cette sortie : menu, messages, notification, descriptions des manifestes, sortie des scripts. Le français reviendra plus tard par le mécanisme de traduction standard de GNOME (gettext) ; il n'est pas installé maintenant. Le README passe en anglais lui aussi, puisque le dépôt devient public ; le site reste la référence utilisateur, le README la référence développeur.
11. **Le domaine est choisi maintenant** par l'auteur ; tant qu'il n'est pas transmis, tout avance sauf la signature du `.xpi`, la politique Firefox, et les soumissions aux catalogues (qui exigent l'adresse du site et de la politique de confidentialité). Pas de version intermédiaire signée avec l'adresse Railway par défaut.
12. **Lancement après approbation des deux catalogues** : soumettre tôt à extensions.gnome.org et au Chrome Web Store, construire le site et le reste pendant la revue, et ouvrir le site d'un coup quand la commande tient sa promesse. Le repli avec déconnexion reste dans le script pour les pannes, pas comme chemin de lancement.

## 5. Architecture de la sortie

### 5.1 Les morceaux et leur canal

| Morceau | Où il vit après installation | Canal d'installation | Mises à jour |
|---|---|---|---|
| Extension GNOME, **avec le pont Python à l'intérieur** | `~/.local/share/gnome-shell/extensions/deep-work-lock@deepwork.local/` | extensions.gnome.org, chargée à chaud par D-Bus depuis le script | extensions.gnome.org |
| Manifestes de messagerie native (Chrome, Firefox) et autorisation du portail snap | `~/.config/google-chrome/NativeMessagingHosts/`, `~/.mozilla/native-messaging-hosts/`, PermissionStore | **écrits par l'extension GNOME elle-même** à l'activation (modèle GSConnect) | suivent l'extension |
| Extension Chrome | profil Chrome | Chrome Web Store (non listé), déclenché par une politique `normal_installed` | Web Store |
| Extension Firefox | profil Firefox | `.xpi` signé servi par le site, déclenché par une politique `normal_installed` avec `install_url` | `update_url` + `updates.json` servis par le site |
| Script d'installation / désinstallation | nulle part (exécuté en flux) | `curl … | sh` depuis le site, source dans le dépôt | sans objet |
| Site | Railway | — | déploiement depuis le dépôt |

**Décision de conception (mienne) : le pont entre dans l'extension GNOME.** Le `install.sh` actuel copie le pont et écrit les manifestes ; dans cette sortie, l'extension GNOME le fait à son activation, de façon idempotente, en pointant les manifestes vers le script Python de son propre dossier. Conséquences : le pont et l'extension ont toujours la même version ; les mises à jour par extensions.gnome.org mettent le pont à jour ; le script d'installation n'a plus que deux étapes. C'est le modèle déjà désigné comme « piste retenue pour le jour du partage » dans le document Firefox. Si la revue extensions.gnome.org refuse ce point, le repli est de servir le pont séparément depuis le site et de le faire installer par le script, comme aujourd'hui.

### 5.2 La commande d'installation

Affichée sur le site, copiable d'un clic :

```
curl -fsSL https://<DOMAIN>/install.sh | sh
```

Ce qu'elle fait, dans l'ordre, en expliquant chaque étape à l'écran :

1. **Vérifications** : GNOME Shell présent et version 46 à 49, Python 3, `gdbus`, au moins un navigateur pris en charge (Chrome en `.deb`, Firefox snap ou Firefox des dépôts Mozilla). Si une vérification échoue, message clair et arrêt avant toute modification.
2. **Extension GNOME** : appel D-Bus `InstallRemoteExtension` sur `org.gnome.Shell.Extensions`. GNOME affiche sa boîte « Install extension? » ; la personne clique. Le script attend que l'extension soit à l'état activé (lecture de `GetExtensionInfo`) et vérifie que les manifestes de messagerie native ont été écrits. **Repli** si extensions.gnome.org ne répond pas ou ne connaît pas encore l'extension (période de revue) : téléchargement du zip de la GitHub Release correspondant à la version, installation par `gnome-extensions install`, activation inscrite dans les réglages, et message explicite : « log out and back in to finish ». Le repli est un mode dégradé assumé, pas le chemin nominal.
3. **Extensions navigateur** : une seule élévation `sudo`, annoncée avant. Écriture de `/etc/opt/chrome/policies/managed/deep-work-lock.json` si Chrome est installé ; fusion dans `/etc/firefox/policies/policies.json` si Firefox est installé. Puis le script dit quel navigateur doit être redémarré pour que l'extension apparaisse.
4. **Bilan** : récapitulatif de ce qui a été installé, et la phrase « click ◉ Focus in the top bar ».

Le script est **idempotent** (relançable sans dégât), lisible (il est dans le dépôt, et le site renvoie vers sa source), et ne télécharge que depuis le domaine du projet, GitHub et extensions.gnome.org.

### 5.3 La commande de désinstallation

```
curl -fsSL https://<DOMAIN>/uninstall.sh | sh
```

Dans l'ordre : si une session de verrou est en cours, restauration des réglages GNOME (comme `uninstall.sh` aujourd'hui) ; désinstallation de l'extension GNOME par D-Bus `UninstallExtension` (à chaud) ; suppression des manifestes de messagerie native et de l'autorisation du portail ; suppression des politiques navigateur (`sudo`, avec fusion inverse pour Firefox) ; message indiquant que l'extension navigateur disparaît au prochain redémarrage du navigateur.

### 5.4 L'extension GNOME sur extensions.gnome.org

- **Identifiant (UUID)** : extensions.gnome.org demande un espace de noms contrôlé par l'auteur ; `deepwork.local` ne l'est pas et risque un refus. L'UUID devient `deep-work-lock@helmo21.github.io` avant la première soumission (ma décision : un espace de noms que l'auteur contrôle déjà par son compte GitHub, indépendant de l'achat du domaine, pour ne pas bloquer la soumission ; un changement après publication équivaudrait à une nouvelle extension). Le nom D-Bus, le dossier de l'extension, le repli du script et la désinstallation suivent. L'identifiant Firefox `deep-work-lock@deepwork.local`, figé par la signature, reste tel quel : il n'a pas à coïncider avec l'UUID GNOME.
- `metadata.json` : `shell-version` `["46", "47", "48", "49"]`, `url` vers le dépôt GitHub, description en anglais qui justifie `unlock-dialog`.
- Après dézippage par le Shell, le bit exécutable du script Python n'est pas garanti : l'extension le pose à l'activation (comme GSConnect). L'étape « vérifications » du script d'installation contrôle aussi la présence des bindings GObject pour Python (`python3-gobject` / `python3-gi`) hors Ubuntu, dont le pont a besoin pour D-Bus.
- À l'activation, l'extension écrit (si absents ou différents) les deux manifestes de messagerie native pointant vers son `native-host/deep_work_lock_host.py`, et pré-accorde l'autorisation du portail pour le snap Firefox. À la désactivation, elle ne touche à rien (une désactivation temporaire ne doit pas casser la prochaine activation) ; c'est le script de désinstallation qui nettoie.
- Le code reste lisible, sans minification ; le script Python est inclus en source.
- Une capture d'écran du menu ◉ Focus pour la fiche.

### 5.5 Wayland

- Correction après lecture du code : `windowId()` dans `windowGuard.js` a déjà un repli, `seq-<n>` à partir de `get_stable_sequence()`, donc les fenêtres Wayland ont bien un identifiant unique pour la durée du processus Shell. Le vrai risque Wayland est ailleurs : ces numéros de séquence **repartent de 1 à chaque nouveau Shell**. Après une fin de session Wayland (plantage, déconnexion) suivie d'une reconnexion dans le même démarrage machine, le fichier de session dit « même démarrage, pas expiré » et `decideStartup` répond « reprendre » avec un `seq-3` qui désigne désormais une autre fenêtre. **Règle** : en Wayland, la reprise n'est permise que si le processus Shell est le même (identifiant d'instance du Shell enregistré dans le fichier de session) ; sinon c'est une restauration, comme après un redémarrage de la machine. En X11, la règle actuelle reste (les identifiants X11 survivent au redémarrage du Shell).
- Table des navigateurs : l'expression `/firefox/i` reconnaît déjà la classe `firefox` du Firefox des dépôts Mozilla ; un test le fige.
- Validation obligatoire dans une **vraie session Wayland** sur la machine de l'auteur (choix de la session à l'écran de connexion), en rejouant les scénarios du README : verrou de fenêtre, d'application, d'onglet Chrome et Firefox, cible fermée, nouvelles fenêtres, Super+L. Et sur un GNOME plus récent (48 ou 49) dans une machine virtuelle ou une distribution de test, au moins le parcours d'installation et un verrou d'onglet. Le GNOME imbriqué (`gnome-shell --nested` avec `GSETTINGS_BACKEND=memory`) sert de banc d'essai rapide, pas de validation finale.

### 5.6 L'extension navigateur

- Même code pour Chrome et Firefox qu'aujourd'hui. Ajouts : une icône (16, 48, 128 px) ; pour Firefox, `update_url` dans le manifeste construit par `scripts/build-firefox.mjs`.
- Chrome Web Store : paquet zip, fiche en anglais, non listé pour cette sortie (la fiche peut passer en listé plus tard sans changer l'identifiant). Permissions justifiées une par une. Politique de confidentialité : « no data collected », page du site.
- Firefox : `.xpi` signé non listé, servi à `https://<DOMAIN>/releases/deep-work-lock-<version>.xpi`, avec `https://<DOMAIN>/updates.json` pour les mises à jour. Publication listée sur addons.mozilla.org : non, pas dans cette sortie (ma décision ; elle imposerait une revue de code supplémentaire sans bénéfice pour l'installation par politique).

### 5.7 Le site

- Base : `modern-cli-tool-landing-page/` (Next.js, Tailwind, shadcn/ui, pnpm). Déplacé ou renommé en `site/` dans le dépôt ; le reste du template inutile (analytics Vercel, pages de démonstration) est retiré.
- **Page d'accueil (option B)** : barre de navigation (How it works · Install · Docs · GitHub) ; en-tête avec accroche, sous-titre, la commande à copier, une ligne « Linux · GNOME 46–49 · X11 and Wayland » et les pastilles « Windows soon », « macOS soon » ; section « During a session » (bureau figé, onglet verrouillé, pas d'issue) ; section « Install » avec les trois étapes que fait la commande et ce que la personne verra (boîte GNOME, mot de passe) ; pied de page avec lien vers la désinstallation et le dépôt.
- **Page Docs** : contenu du README traduit en anglais et réorganisé : How it works, Install, Using it, During a session, Behaviour choices, Known limits, Troubleshooting (extension GNOME non chargée → déconnexion ; Chrome n'a pas encore l'extension → redémarrer ; portail Firefox snap → relancer la commande), Uninstall.
- **Page Privacy** : une page courte, « no data collected, no network calls except updates », requise par le Chrome Web Store.
- La page Docs explique deux conséquences des politiques : Chrome affiche « managed by your organization » dans son menu tant que la politique existe, et les politiques dans `/etc` valent pour **tous les comptes de la machine** (l'extension navigateur s'installe chez chaque utilisateur ; le verrou GNOME, lui, n'est installé que pour celui qui a lancé la commande).
- **Fichiers servis** : `/install.sh`, `/uninstall.sh`, `/releases/*.xpi`, `/updates.json`. Ils doivent être servis tels quels, avec le bon type MIME, sans cache agressif pour les scripts.
- Le domaine est une variable d'environnement unique du site, et une constante unique des scripts et de la construction Firefox.
- Déploiement : nouveau projet Railway, service construit depuis le dépôt, domaine personnalisé ajouté quand il existera.

### 5.8 Versions et livraison

- Un **numéro de version unique** pour l'extension GNOME, le pont et l'extension navigateur, affiché dans le menu ◉ Focus (ou son « About »), pour que le dépannage puisse comparer les trois.
- Une **GitHub Release** par version, portant : le zip de l'extension GNOME (celui envoyé à extensions.gnome.org), le zip Chrome (celui envoyé au Web Store), le `.xpi` signé, et les notes de version. Le script d'installation en repli et la page `updates.json` s'y réfèrent par numéro de version.
- La soumission aux catalogues reste manuelle, faite par l'auteur avec ses comptes ; le dépôt fournit les paquets prêts et les textes de fiche.

## 6. Ce qui dépend de l'auteur

- Choisir et acheter le nom de domaine ; le transmettre. C'est la seule entrée qui bloque la signature Firefox et les soumissions.
- Ajouter la licence GPL-3.0 et passer le dépôt en public avant la première soumission.
- Ouvrir le compte développeur Chrome Web Store (5 $) et le compte extensions.gnome.org ; soumettre les paquets.
- Se connecter dans une session Wayland pour la validation, et fournir ou valider un environnement GNOME 48/49 (machine virtuelle).
- Valider les textes anglais du site et des fiches, et l'icône.

## 7. Laissé au builder

- Le langage du script (`sh` POSIX ou `bash`) et sa structure ; la façon exacte de fusionner `policies.json` ; la détection des navigateurs installés.
- La forme de l'icône (un ◉ suffit) et des captures d'écran.
- L'organisation du dépôt (dossier `site/`, scripts de construction, éventuelle intégration continue qui produit les paquets de la Release).
- La rédaction anglaise, à partir du README comme source de vérité.
- Le détail de l'écriture idempotente des manifestes par l'extension, et la gestion des erreurs du portail.
- L'ordre d'exécution du projet, sachant que la revue extensions.gnome.org est le chemin critique : soumettre tôt, et construire le repli pour ne pas en dépendre.
- Le numéro de la première version publique (supérieur à 0.1.0), et la conservation d'un chemin d'installation développeur (dépôt local, sans catalogues) à côté du script public.

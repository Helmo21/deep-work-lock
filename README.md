# Deep Work Lock

Un verrou de concentration pour GNOME (X11). Tu choisis une durée et une seule cible : une fenêtre, une application entière, ou un onglet Chrome ou Firefox. Jusqu'à la fin du minuteur, c'est la seule chose que tu peux voir et utiliser. Il n'y a pas de bouton « arrêter ».

## Installation

```bash
./install.sh
```

Puis :

1. Déconnecte-toi et reconnecte-toi (ou Alt+F2, `r`, Entrée en X11), puis `gnome-extensions enable deep-work-lock@deepwork.local`.
2. Dans Chrome : `chrome://extensions` → Mode développeur → « Charger l'extension non empaquetée » → dossier `chrome-extension/`.
3. Dans Firefox : installe le `.xpi` signé (voir ci-dessous) en le glissant dans une fenêtre Firefox. Pour tester avant la signature : `about:debugging#/runtime/this-firefox` → « Charger un module complémentaire temporaire » → `build/firefox/manifest.json` (retiré à la fermeture de Firefox).

`install.sh` installe aussi le manifeste d'hôte Firefox (`~/.mozilla/native-messaging-hosts/`) et, pour Firefox en snap, autorise le portail système à lancer l'hôte `org.deepworklock.host` (et lui seul). Sans cela, le portail pose la question une fois, et sa fenêtre peut ne pas s'afficher : un délai sans réponse compte comme un refus définitif.

### Firefox : signature de l'extension

Firefox n'installe de façon permanente qu'une extension signée par Mozilla. Elle est signée « non publiée » (unlisted) : rien n'apparaît sur le catalogue.

1. Crée un compte sur [addons.mozilla.org](https://addons.mozilla.org), puis Outils → **Gérer les clés API** → génère une clé (« JWT issuer ») et un secret.
2. Lance, sans écrire les clés dans un fichier du dépôt :
   ```bash
   WEB_EXT_API_KEY='user:…' WEB_EXT_API_SECRET='…' scripts/sign-firefox.sh
   ```
3. Le `.xpi` signé arrive dans `web-ext-artifacts/` (non versionné). Glisse-le dans Firefox.

L'identifiant de l'extension, `deep-work-lock@deepwork.local`, est lié au compte dès la première signature : il ne doit plus jamais changer.

Désinstallation : `./uninstall.sh` (restaure aussi les réglages si une session était en cours).

## Utilisation

Clique sur **◉ Focus** dans la barre du haut, choisis une durée (25, 30, 45, 60, 90 min ou une valeur libre), une cible, puis **Verrouiller N min**. Les fenêtres Chrome et Firefox se déplient pour proposer leurs onglets.

Pendant la session :

- la barre du haut et le dock sont grisés et inertes, le compte à rebours s'affiche en orange ;
- Alt+Tab, Super, la vue d'ensemble, le coin actif, les espaces de travail et les raccourcis de lancement sont coupés ;
- toute autre fenêtre est minimisée ; les dialogues de la cible restent utilisables ;
- les notifications sont coupées ;
- Super+L reste possible, le temps continue de s'écouler.

Pour un onglet Chrome ou Firefox : nouveaux onglets et fenêtres fermés, retour forcé sur l'onglet, pages internes bloquées (`chrome://`, `about:addons`, `about:config`, `about:debugging`…). La navigation reste sur l'hôte de l'onglet et ses sous-domaines : un verrou sur `docs.google.com` n'ouvre ni `mail.google.com` ni `gemini.google.com`. Seules exceptions : les pages de connexion Google, Microsoft et Apple (`accounts.google.com`, `login.microsoftonline.com`…). Les popups ouvertes par l'onglet (connexion) sont autorisées mais restent sur ces mêmes sites, sinon elles sont fermées.

## Choix de comportement

- **Cible fermée** : la session continue. Un onglet fermé est rouvert sur sa dernière adresse. Une fenêtre fermée laisse un bureau vide ; seule une fenêtre de la même application **ouverte après le verrouillage** peut devenir la nouvelle cible (les autres fenêtres déjà ouvertes restent cachées). Si c'était la dernière fenêtre du navigateur, il se ferme et le bureau reste vide jusqu'à la fin. Une nouvelle fenêtre de navigateur ne devient la cible que si l'extension l'annonce.
- **Firefox qui redémarre de lui-même** (mise à jour) : ses fenêtres restent cachées jusqu'à ce que l'extension se reconnecte, retrouve l'onglet verrouillé (ou le rouvre sur sa dernière adresse) et annonce sa fenêtre. En mode de dépannage, l'extension ne tourne pas : le bureau reste vide.
- **Fenêtres de navigateur au titre identique** : elles ne proposent pas leurs onglets dans le menu (impossible de savoir laquelle est laquelle) ; elles restent verrouillables comme fenêtres.
- **Redémarrage de GNOME Shell** : la session reprend avec le temps restant.
- **Redémarrage de la machine** : la session s'arrête, tous les réglages sont restaurés au démarrage.

## Limites connues

- Ctrl+Alt+F3 (console texte) et le redémarrage permettent de sortir. C'est voulu.
- Les outils de développement de Chrome **ancrés dans l'onglet** (F12) ne peuvent pas être bloqués par une extension. Détachés dans leur propre fenêtre, ils sont minimisés.
- Fenêtres incognito / navigation privée : l'extension n'y a pas accès, mais le verrou du bureau les minimise.
- La barre latérale de Firefox (marque-pages, historique, assistant IA) n'est pas un onglet : une extension ne peut pas la fermer.
- Si la cible est un terminal, `gnome-extensions disable` reste possible depuis ce terminal.
- Wayland, les autres bureaux et les autres navigateurs (Chromium, Brave, Firefox hors snap…) ne sont pas pris en charge.

## Développement

```bash
npm test   # politiques JS (node --test), réglages (gjs, GSettings en mémoire), hôte Python
```

Structure : `gnome-extension/` (verrou bureau, menu, service D-Bus `org.deepworklock.Shell`), `chrome-extension/` (verrou d'onglet MV3, partagé avec Firefox), `scripts/build-firefox.mjs` (construit `build/firefox/` avec le manifeste Firefox), `native-host/` (pont navigateur ⇄ D-Bus `org.deepworklock.ChromeBridge` ou `org.deepworklock.FirefoxBridge`, selon le navigateur qui le lance).

⚠️ Pour tester dans un `gnome-shell --nested`, exporte `GSETTINGS_BACKEND=memory` : sinon le verrou modifie les vrais réglages de ta session.
# deep-work-lock

# Deep Work Lock

Un verrou de concentration pour GNOME (X11). Tu choisis une durée et une seule cible : une fenêtre, une application entière ou un onglet Chrome. Jusqu'à la fin du minuteur, c'est la seule chose que tu peux voir et utiliser. Il n'y a pas de bouton « arrêter ».

## Installation

```bash
./install.sh
```

Puis :

1. Déconnecte-toi et reconnecte-toi (ou Alt+F2, `r`, Entrée en X11), puis `gnome-extensions enable deep-work-lock@deepwork.local`.
2. Dans Chrome : `chrome://extensions` → Mode développeur → « Charger l'extension non empaquetée » → dossier `chrome-extension/`.

Désinstallation : `./uninstall.sh` (restaure aussi les réglages si une session était en cours).

## Utilisation

Clique sur **◉ Focus** dans la barre du haut, choisis une durée (25, 30, 45, 60, 90 min ou une valeur libre), une cible, puis **Verrouiller N min**. Les fenêtres Chrome se déplient pour proposer leurs onglets.

Pendant la session :

- la barre du haut et le dock sont grisés et inertes, le compte à rebours s'affiche en orange ;
- Alt+Tab, Super, la vue d'ensemble, le coin actif, les espaces de travail et les raccourcis de lancement sont coupés ;
- toute autre fenêtre est minimisée ; les dialogues de la cible restent utilisables ;
- les notifications sont coupées ;
- Super+L reste possible, le temps continue de s'écouler.

Pour un onglet Chrome : nouveaux onglets et fenêtres fermés, retour forcé sur l'onglet, navigation limitée au même site (par exemple `docs.google.com` ↔ `accounts.google.com`), pages `chrome://` bloquées. Les popups ouvertes par l'onglet (connexion) sont autorisées.

## Choix de comportement

- **Cible fermée** : la session continue. Un onglet fermé est rouvert sur sa dernière adresse. Une fenêtre fermée laisse un bureau vide ; une nouvelle fenêtre de la même application devient la cible.
- **Redémarrage de GNOME Shell** : la session reprend avec le temps restant.
- **Redémarrage de la machine** : la session s'arrête, tous les réglages sont restaurés au démarrage.

## Limites connues

- Ctrl+Alt+F3 (console texte) et le redémarrage permettent de sortir. C'est voulu.
- Les outils de développement de Chrome **ancrés dans l'onglet** (F12) ne peuvent pas être bloqués par une extension. Détachés dans leur propre fenêtre, ils sont minimisés.
- Fenêtres incognito : l'extension Chrome n'y a pas accès, mais le verrou du bureau les minimise.
- Si la cible est un terminal, `gnome-extensions disable` reste possible depuis ce terminal.
- Wayland, Firefox et les autres bureaux ne sont pas pris en charge.

## Développement

```bash
npm test   # politiques JS (node --test), réglages (gjs, GSettings en mémoire), hôte Python
```

Structure : `gnome-extension/` (verrou bureau, menu, service D-Bus `org.deepworklock.Shell`), `chrome-extension/` (verrou d'onglet MV3), `native-host/` (pont Chrome ⇄ D-Bus `org.deepworklock.ChromeBridge`).

⚠️ Pour tester dans un `gnome-shell --nested`, exporte `GSETTINGS_BACKEND=memory` : sinon le verrou modifie les vrais réglages de ta session.

# Journal de publication — Deep Work Lock 0.2.0

Historique de la première sortie publique (5 novembre 2026). Il note tout ce qui a été fait, tous les champs remplis et les erreurs rencontrées, pour qu'une prochaine version se publie sans tâtonner.

La procédure courte et générale est dans [`../release.md`](../release.md). Les textes des fiches sont dans [`chrome-web-store.md`](chrome-web-store.md) et [`extensions-gnome-org.md`](extensions-gnome-org.md).

## Récapitulatif

| Étape | Où | Résultat |
|---|---|---|
| 1. Fusion de `linux-release` dans `main` | git local | fait, tests au vert |
| 2. Dépôt public | GitHub | fait (par l'auteur) |
| 3. Site | Railway | en ligne : https://deepwork-lock.up.railway.app |
| 4. Signature Firefox | addons.mozilla.org (non listé) | `.xpi` 0.2.0 signé, servi par le site |
| 5. Release GitHub `v0.2.0` | GitHub | publiée avec 3 fichiers |
| 6. Extension GNOME | extensions.gnome.org | envoyée, n° 11637, en attente de revue |
| 7. Extension Chrome | Chrome Web Store | soumise à la revue |
| 8. Identifiant Chrome dans le code | dépôt | **à faire** (voir plus bas) |

---

## 1. Fusion dans `main`

1. Retirer du checkout principal les copies non suivies du plan et de la spec. Elles étaient identiques à celles de la branche (vérifié avec `git diff --no-index`), et git aurait refusé la fusion à cause d'elles.
2. `git merge --ff-only linux-release` (avance rapide, 18 commits).
3. `npm test` sur le résultat : vert.
4. Suppression du worktree `../deep-work-controler-linux-release` et de la branche `linux-release`.

## 2. Dépôt public

Fait à la main par l'auteur sur GitHub : `Helmo21/deep-work-lock`, Settings, Change visibility, Public. Les deux catalogues veulent un code source public et une licence (GPL-3.0-or-later, fichier `LICENSE`).

## 3. Site sur Railway

Créé avec la CLI `railway` 5.71, déjà connectée au compte.

| Élément | Valeur |
|---|---|
| Workspace | Antoine Pedretti's Projects |
| Projet | `deep-work-lock` (`9ed0e84b-54be-4ae3-80b5-03d3309cbc70`) |
| Environnement | `production` (`f375f4b3-492d-4ebc-8abe-b61d790aff3e`) |
| Service | `site` (`c8eed719-f4c1-4489-b492-7c9aa32e28c8`) |
| Source | dépôt GitHub `Helmo21/deep-work-lock`, branche `main` |
| Root directory | `/site` |
| Variable | `PORT=8080` |
| Domaine | `deepwork-lock.up.railway.app` (port cible 8080) |

Commandes :

```bash
railway init --name deep-work-lock --workspace <workspace-id>
railway add --service site --repo Helmo21/deep-work-lock --branch main
# Root directory : pas d'option CLI, passé par l'API GraphQL
railway api 'mutation($s:String!,$e:String!,$i:ServiceInstanceUpdateInput!){serviceInstanceUpdate(serviceId:$s,environmentId:$e,input:$i)}' \
  --variables '{"s":"<service-id>","e":"<env-id>","i":{"rootDirectory":"/site"}}'
railway domain --service site --port 8080          # génère site-production-xxxx.up.railway.app
railway domain update site-production-xxxx.up.railway.app --domain deepwork-lock --service site
railway variable set PORT=8080 --service site --skip-deploys
```

Ensuite :

1. Dans `release.json`, remplacer `siteUrl` (`https://example.invalid`) par `https://deepwork-lock.up.railway.app`.
2. `npm run prepare-site` (régénère `site/public/install.sh`, `uninstall.sh`, `policies.py`, `updates.json`, `site/release.json`), puis `npm run build` et `npm test`.
3. Commit et push sur `main`.

**Problème rencontré.** Le tout premier déploiement est parti avant le réglage du root directory et a échoué. Le push suivant n'a pas déclenché de déploiement automatique, alors le dernier commit a été déployé à la main :

```bash
railway api 'mutation($s:String!,$e:String!){serviceInstanceDeployV2(serviceId:$s,environmentId:$e,commitSha:"<sha>")}' \
  --variables '{"s":"<service-id>","e":"<env-id>"}'
```

À vérifier au prochain push : Railway, service `site`, Settings. Le déploiement automatique sur `main` doit être activé et l'app GitHub de Railway doit avoir accès au dépôt.

Vérification après déploiement : `/`, `/docs`, `/privacy`, `/install.sh`, `/uninstall.sh`, `/policies.py`, `/updates.json` et `/releases/deep-work-lock-{0.2.0,latest}.xpi` répondent 200. `install.sh` et le `.xpi` servis sont identiques aux fichiers du dépôt.

## 4. Signature de l'extension Firefox

- Canal **unlisted** : le module n'est pas publié sur addons.mozilla.org, Mozilla le signe seulement.
- Clés API dans `.env`, exclu de git : `WEB_EXT_API_KEY` et `WEB_EXT_API_SECRET` (addons.mozilla.org, Tools, Manage API Keys).
- ID gecko : `deep-work-lock@deepwork.local`.
- `update_url` intégré au module : `https://deepwork-lock.up.railway.app/updates.json`. **Il faut donc fixer `siteUrl` avant de signer.** Le script refuse de signer avec le domaine provisoire.

```bash
set -a; . ./.env; set +a
scripts/sign-firefox.sh
```

Durée : quelques minutes (« Waiting for validation… », puis « Waiting for approval… »). Le script copie le résultat dans `site/public/releases/deep-work-lock-0.2.0.xpi` et `deep-work-lock-latest.xpi`. Ces deux fichiers sont commités (l'exception est dans `.gitignore`). Le `.xpi` contient bien `META-INF/cose.sig`.

Attention : Mozilla n'accepte chaque numéro de version qu'une seule fois. Pour re-signer, il faut une nouvelle version.

## 5. Release GitHub `v0.2.0`

```bash
git tag -a v0.2.0 -m "Deep Work Lock 0.2.0"
git push origin v0.2.0
gh release create v0.2.0 --title "Deep Work Lock 0.2.0" --notes-file notes.md \
  build/gnome/deep-work-lock@helmo21.github.io.shell-extension.zip \
  build/deep-work-lock-chrome-0.2.0.zip \
  site/public/releases/deep-work-lock-0.2.0.xpi
```

URL : https://github.com/Helmo21/deep-work-lock/releases/tag/v0.2.0

Notes de version : description en une phrase, commande d'installation, lien vers les Docs, points forts (GNOME 46–49, X11 et Wayland, hôte natif embarqué, Firefox signé avec mise à jour automatique, installeur, anglais, GPL), liste des fichiers.

Le zip GNOME de cette release est aussi la solution de secours de `install.sh` tant que l'extension n'est pas validée sur extensions.gnome.org (`https://github.com/Helmo21/deep-work-lock/releases/download/v0.2.0/deep-work-lock@helmo21.github.io.shell-extension.zip`, vérifié en 200).

## 6. extensions.gnome.org

URL de la fiche : https://extensions.gnome.org/extension/11637/deep-work-lock/

| Champ | Valeur |
|---|---|
| Fichier envoyé | `build/gnome/deep-work-lock@helmo21.github.io.shell-extension.zip` |
| Nom | Deep Work Lock (tiré de `metadata.json`) |
| Description affichée | celle de `metadata.json` : « Locks the screen on one window, app or browser tab until the timer runs out. Runs in the unlock dialog so the lock survives the lock screen. » |
| Extension Homepage | https://github.com/Helmo21/deep-work-lock |
| Version | 0.2.0, statut « Unreviewed » |
| Versions de GNOME Shell | 46, 47, 48, 49 |
| Capture | `docs/store/screenshot-menu.png` (bouton « Upload screenshot ») |

La description longue et les notes pour les relecteurs (`unlock-dialog`, script Python embarqué, autorisation pour Firefox en snap) sont dans [`extensions-gnome-org.md`](extensions-gnome-org.md). Elles servent à répondre si un relecteur pose une question.

**Bandeau rouge sans gravité :** « No such native application org.gnome.chrome_gnome_shell ». C'est le connecteur navigateur du site lui-même, qui manque sur la machine. Il n'a rien à voir avec l'extension. Pour l'enlever : `sudo apt install gnome-browser-connector`, puis le module « GNOME Shell integration ».

Conseil : ne pas renvoyer de zip pendant l'attente, car chaque envoi remet la version dans la file. Le résultat arrive par e-mail.

### Capture d'écran (comment elle a été faite)

Elle a été faite dans un GNOME Shell **sans écran** et isolé, pour ne pas toucher à la session réelle et ne pas montrer le bureau de l'auteur :

- HOME, `XDG_*` et `GSETTINGS_BACKEND=memory` pointent vers un dossier temporaire.
- `LANG=en_US.UTF-8`, pour avoir la date en anglais.
- `dbus-run-session gnome-shell --headless --wayland --no-x11 --virtual-monitor 1366x768`.
- Calculatrice, Moniteur système et Éditeur de texte sont ouverts pour remplir la liste « Target ».
- Une **copie temporaire** de l'extension ouvre son menu, puis se photographie avec `Shell.Screenshot`. Le dépôt n'est pas modifié.

Une première tentative en Shell imbriqué (`--nested`) avec `ffmpeg x11grab` avait capturé le bureau réel, car la fenêtre était cachée. Cette image a été supprimée. Le mode sans écran évite ce problème.

## 7. Chrome Web Store

Tableau de bord : https://chrome.google.com/webstore/devconsole. Compte développeur : 5 $ payés une seule fois.

### Paquet

- Fichier : `build/deep-work-lock-chrome-0.2.0.zip`, **construit avec `node scripts/build-chrome.mjs --store`**.
- **Erreur 1 :** « key field is not allowed in manifest ». Le build par défaut garde `key`, pour que les builds de développement aient le même identifiant. L'option `--store` retire ce champ.
- **Erreur 2 (avertissement) :** « Broad Host Permissions », avec revue approfondie possible. L'extension n'avait pas besoin de `"host_permissions": ["<all_urls>"]` :
  - les URL des onglets viennent de `tabs` et `webNavigation` ;
  - la seule règle `declarativeNetRequest` est un `block`, qui ne demande aucune permission d'hôte.

  La permission a été retirée (commit `9e1e771`) et le paquet renvoyé. Le `.xpi` Firefox 0.2.0, déjà signé, la garde encore, ce qui ne pose pas de problème.

### Store listing

| Champ | Valeur |
|---|---|
| Title | Deep Work Lock (tiré du paquet) |
| Summary | Locks one browser tab during a Deep Work Lock session started from the GNOME extension. (tiré du paquet) |
| Description | texte complet de [`chrome-web-store.md`](chrome-web-store.md), section Description |
| Category | Tools (la doc proposait Productivity, l'un ou l'autre convient) |
| Language | English |
| Store icon | `docs/store/chrome-store-icon-128.png` : 128×128, dessin de 96×96 avec une marge transparente de 16 px, comme le recommande Google |
| Screenshots | `docs/store/screenshot-menu.png` remis en 1280×800 (bandes sombres en haut et en bas) |

### Privacy

L'onglet s'appelle **« Privacy »** dans le menu de gauche (Build), et non « Privacy practices » comme le disent les messages d'erreur.

| Champ | Valeur |
|---|---|
| Single purpose | Keep the browser on one chosen tab for the duration of a focus session started from the Deep Work Lock desktop extension. |
| tabs | Read the URL and id of tabs to find the locked tab, close new tabs, and switch back to the locked tab during a session. |
| nativeMessaging | Talk to the local Deep Work Lock native host (org.deepworklock.host), which relays the session state from the GNOME extension. No data leaves the machine. |
| declarativeNetRequest | During a session, block main-frame requests of the locked tab that leave the locked site, so the restriction holds before the page loads. |
| webNavigation | Detect top-level navigations before they commit, so the tab can be returned to the locked page. |
| storage | Keep the session state in chrome.storage.session so the lock survives the service worker being suspended. Cleared when the browser closes. |
| Host permission | aucune depuis le retrait de `<all_urls>` (champ disparu) |
| Remote code | **No, I am not using remote code**. Vérifié : pas de `fetch`, `eval`, `new Function`, `importScripts`, d'import dynamique, d'`executeScript`, ni d'URL dans le code. |
| Data usage | aucune catégorie cochée, puis les trois certifications cochées |
| Privacy policy URL | https://deepwork-lock.up.railway.app/privacy |

### Distribution

- Visibility : **Unlisted**. Les utilisateurs l'obtiennent par `install.sh`, qui l'installe via une politique Chrome.

### Compte (Settings, hors de l'élément)

- Contact email renseigné, puis **vérifié** par le lien reçu par e-mail. Sans ça, impossible de soumettre.

### Soumission

« Submit for review », le 5 novembre 2026.

## 8. À faire : l'identifiant Chrome

Sans `key` dans le zip, le Chrome Web Store a attribué **un nouvel identifiant**. Sur la capture du tableau de bord, il se lit `llneijbapcdcjcbkecnkdmfaekhpimjl`, à confirmer par copier-coller. L'ancien était `jegdmipkacdhhlldnopafmjhakdmddik`.

Tant que le code garde l'ancien identifiant, la politique Chrome posée par `install.sh` désigne une extension qui n'existe pas, et l'hôte natif refuse l'origine du vrai module. Il faut donc :

1. Récupérer dans le tableau de bord l'identifiant exact et la **clé publique** (Package, « View public key »).
2. Mettre à jour :
   - `chromeExtensionId` dans `release.json` ;
   - `CHROME_EXTENSION_ID` dans `gnome-extension/deep-work-lock@helmo21.github.io/lib/constants.js` ;
   - `key` dans `chrome-extension/manifest.json`, avec la clé publique du store ;
   - l'identifiant attendu dans `tests/release.test.mjs`.
3. `npm test`, `npm run prepare-site`, commit et push : Railway redéploie `install.sh`.
4. Publier une nouvelle version GNOME (0.2.1) sur extensions.gnome.org et dans une release GitHub, pour que les hôtes installés acceptent la nouvelle origine.

## 9. Reste à valider en vrai

- `curl -fsSL https://deepwork-lock.up.railway.app/install.sh | bash` sur une machine propre, puis la désinstallation.
- Une vraie session Wayland, puis GNOME 48 et 49 dans une machine virtuelle.
- Le verrouillage d'un onglet Chrome **sans** `<all_urls>` : les sorties du site doivent bien être bloquées.
- Le déploiement automatique Railway au prochain push.

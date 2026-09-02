# SUIVI — Écran surf e-ink Lacanau

Fichier de reprise : où on en est, ce qui reste à faire. À lire en premier
avec `CONTEXT.md` quand on reprend le projet dans une nouvelle conversation.

## Objectif

Un écran e-ink qui affiche les conditions de surf à Lacanau et se met à jour
tout seul. Le **serveur** (GitHub Actions) fabrique l'image ; l'**appareil**
la télécharge et l'affiche. Deux cibles matérielles en lice :
- **Liseuse** (Kobo / Kindle) qui ouvre un **PDF** via KOReader.
- **Objet ESP32** + petit écran e-ink (firmware maison).

## État actuel — ce qui marche

- Rendu e-ink validé : **portrait 1072×1448** (liseuse) + **540×960** (ESP32).
- **Vue semaine paginée** 7 jours + **PDF navigable** (1 page = 1 jour).
- **Données réelles** Open-Meteo (houle, vent, météo, temp. eau) via `tools/fetch.mjs`.
- **Automatisation cloud** : GitHub Actions reconstruit toutes les heures (5h–22h)
  et publie sur GitHub Pages.
  - Dépôt : `github.com/Rmontagut/surf-poc` (public)
  - PDF en ligne : `https://rmontagut.github.io/surf-poc/lacanau-semaine.pdf`
- **Trait de côte** ajouté (repère offshore/onshore).
- **Rendu ESP32 540×960 en light ET dark** (bascule par un seul flag `theme`).
- **✅ BOÎTIER ESP32 EN SERVICE (1er sept)** : LilyGO T5 4.7″ S3 Touch flashé
  (`esp32/`, PlatformIO). Cycle : réveil → WiFi → télécharge
  `lacanau-esp32.bin` (framebuffer 4 bpp publié par le build) → affiche →
  veille profonde 2 h (re-essai 15 min si échec, repli image embarquée).
  Le workflow génère et publie `lacanau-esp32[-dark].bin` à chaque build.

## ✅ RÉSOLU (17 août) — marées par calcul harmonique local

- **WorldTides abandonné** (crédits épuisés). Les marées sont maintenant
  **calculées localement** par `tools/tide-harmonic.mjs` : 37 composantes
  harmoniques + corrections nodales, constantes figées dans
  `tools/tide-constants.json`. **Zéro API, zéro clé, zéro quota, valable des
  années** (la modulation nodale de 18,6 ans est calculée, pas figée).
- Constantes ajustées par moindres carrés sur 2 ans de hauteurs d'eau horaires
  au droit de Lacanau (Open-Meteo), puis calées sur le SHOM/surf-forecast
  (décalage de propagation large → plage : PM +25 min, BM +30 min).
- **Vérifié** : 13 août (réf surf-forecast) → PM 05:43 / BM 11:28 / PM 17:59
  (cible 05:43 / 11:30 / 17:58, hauteurs à ±3 cm). Semaine du 17-23 août
  (SHOM maree.info) → ±6 min. Test de non-régression dans `fetch.test.mjs`.
- Limite connue : en **mortes-eaux profondes** (coef < ~35), la courbe est
  plate et l'heure d'un extrême est mal définie — SHOM et surf-forecast
  divergent eux-mêmes de 10-20 min ; le modèle reste dans cette enveloppe.
- Le repli synthétique (`synthTideDay`) a été **supprimé** : plus aucun cas où
  l'écran affiche une marée inventée.

## À FAIRE (dans l'ordre)

### 1. Organiser en projet Cowork
- [ ] App Claude → **Projects** → **« + »** → **« Use an existing folder »** → dossier `surf-poc`.
- [ ] Nommer (« Surf e-ink Lacanau »), coller les instructions de projet.
- [ ] Repartir sur des **conversations focalisées** (une par sujet).

### 2. Réparer les marées (prioritaire) — ✅ FAIT (calcul harmonique local)
- [x] Calcul harmonique sans API (`tools/tide-harmonic.mjs` + `tide-constants.json`).
- [x] Repli synthétique supprimé : la marée est toujours calculée, jamais inventée.
- [x] `.github/workflows/build.yml` : env `WORLDTIDES_KEY` retirée (le secret
      GitHub peut être supprimé du dépôt, il ne sert plus).
- [x] Poussé sur GitHub, build vérifié : le PDF affiche les vraies marées.

### 3. Valider + intégrer le rendu ESP32
- [ ] Comparer le 540×960 (light/dark) à la maquette Figma, ajuster tailles/positions
      (l'espace avant le « m », taille de l'accroche, alignement des labels…).
- [x] `src/render-esp32.mjs` + `build-esp32.mjs` + `assets/theme/` sauvegardés sur le disque.
- [ ] Optionnel : ré-exporter les assets crayonnés **en noir** depuis le nouveau frame Figma
      (plus net que mes versions recolorées).
- [x] Profil ESP32 ajouté au workflow GitHub (`build-esp32.mjs` + `tools/pack-esp32.py`
      → `lacanau-esp32[-dark].bin` publiés sur Pages).

### 4. Choisir + commander le matériel
- [ ] **Liseuse** : Kobo **Glo HD** (300 ppi, aucun hack) — le plus simple. OU
      Kindle **Paperwhite 3/4** (même écran, jailbreak facile via Sanctuary/KOReader).
- [ ] **Objet** : **LilyGO T5-4.7″ S3 Touch** (option H716) + câble USB-C.
      Batterie LiPo 3,7 V connecteur **JST 2.0** optionnelle (⚠️ vérifier la polarité).

### 5. À la réception du matériel
- [ ] **Liseuse** : installer KOReader → ouvrir le PDF → régler le téléchargement au réveil
      (voir `HARDWARE.md`, étape 3).
- [x] **ESP32** : firmware écrit et flashé (`esp32/`, voir `esp32/README.md`) —
      le boîtier télécharge et affiche l'image du jour en autonomie. ⚠️ Le WiFi
      est dans `esp32/src/config.h`, gitignoré (jamais sur GitHub) ; pour
      reflasher après une veille profonde : maintenir STR_IO0 (BOOT), un coup
      de REST, relâcher, puis `pio run -t upload`.

### 5 bis. ESP32 — prochaines itérations
- [ ] **Tactile (étape 3)** : naviguer J+1/J-1 au toucher (dalle GT911). Demande
      les 7 jours en `.bin` publiés + réveil au toucher — à faire carte en main.
- [ ] Ajuster le rendu 540×960 sur le vrai écran si besoin (contraste, tailles).
- [ ] Thème dark automatique la nuit ? (`lacanau-esp32-dark.bin` déjà publié.)
- [ ] Batterie LiPo (JST 2.0, ⚠️ polarité) + mesure d'autonomie réelle.

### 6. Optionnel / plus tard
- [ ] Jeton **CANDHIS** (mail à `candhis@cerema.fr`) pour la houle **MESURÉE** (bouée Cap
      Ferret) → ajouter le secret `CANDHIS_TOKEN` sur le dépôt.
- [ ] Ajuster l'heure/la fréquence du build (`deploy/build.yml`, ligne `cron`).

## Infos clés

- **Marées** : calcul local, aucune clé. `node tools/tide-harmonic.mjs 2026-08-13 3`
  affiche les extrêmes de 3 jours. `node tools/tide-check.mjs` re-vérifie contre
  les références d'août 2026. Ne s'use pas, ne périme pas.
- **Commandes** :
  - `npm install`
  - `node tools/fetch.mjs` — récupère les vraies données (marées calculées localement)
  - `node build-week.mjs` — rendu liseuse (7 pages + PDF)
  - `node build-esp32.mjs` — rendu ESP32 (light + dark)
  - `./tools/refresh.sh` — fetch + build enchaînés
- **Docs du projet** : `CONTEXT.md` (décisions), `README.md` (build), `HARDWARE.md`
  (matériel + liseuse), `DEPLOY.md` (cloud GitHub), et ce `SUIVI.md`.

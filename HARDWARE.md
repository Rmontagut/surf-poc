# Du POC au Kobo — architecture et marche à suivre

Ce fichier explique comment on passe des rendus de ce dépôt à un écran de surf
posé sur une étagère. À lire quand la Kobo arrive.

## Le principe en une phrase

La liseuse est un afficheur bête : elle se réveille, télécharge un fichier,
l'affiche, se rendort. **Toute l'intelligence est sur un serveur** — la Kobo
n'exécute aucun calcul, ne parle à aucune API météo. C'est le schéma classique
des « Kindle/Kobo weather displays » : robuste, et une autonomie en semaines
parce que l'e-ink ne consomme rien tant que l'image ne change pas.

## Les trois pièces

1. **Le serveur** — n'importe quelle machine allumée en continu avec Internet.
   C'est lui qui a Internet, pas la Kobo au sens where-the-brains-are. Il tourne
   `tools/fetch.mjs` (récupère houle/vent/météo/marées/bouée) puis
   `build-week.mjs` (fabrique les 7 pages e-ink + le PDF), 3–4×/jour. Puis il
   **expose le fichier à une URL** (un petit serveur HTTP).

2. **Le fichier** — `out/lacanau-semaine.pdf` : 7 pages, une par jour, à la
   résolution exacte de l'écran (1072×1448, 300 ppi). C'est lui que la Kobo
   télécharge.

3. **La Kobo** — rejoint le WiFi sur un horaire, fait un simple téléchargement
   HTTP du PDF, l'ouvre dans un lecteur, coupe le WiFi. Fin.

```
  Internet (Open-Meteo, WorldTides, CANDHIS)
        │  fetch.mjs
        ▼
   ┌──────────┐   build-week.mjs   ┌─────────────────────┐   HTTP   ┌────────┐
   │  SERVEUR │ ─────────────────▶ │ lacanau-semaine.pdf │ ───────▶ │  KOBO  │
   │ (toujours│                    │  (servi à une URL)  │  wget    │ affiche│
   │   allumé)│                    └─────────────────────┘          └────────┘
   └──────────┘
```

## Pourquoi un PDF de 7 pages

Ton idée « tap à droite = jour suivant » est, sur une liseuse, exactement
**« page suivante »**. En livrant les 7 jours comme un PDF multipage, la
navigation tactile est **native** — aucun code à écrire sur l'appareil. Le
prototype `out/semaine.html` sert à valider le geste sur écran d'ordi ; le PDF
est ce qui va réellement sur la Kobo. (Le jour 0 = aujourd'hui est la première
page ; on tourne vers J+1, J+2…)

## Comment ça communique avec Internet

Deux liaisons, jamais la Kobo directement vers la météo :

- **Serveur → APIs** : le serveur appelle Open-Meteo / WorldTides / CANDHIS en
  HTTPS, à chaque rafraîchissement. C'est là que vivent les clés.
- **Kobo → serveur** : la Kobo fait un `GET` du PDF sur l'URL du serveur, via
  ton WiFi. Si le serveur est chez toi (Raspberry Pi, Mac), c'est une URL de ton
  réseau local (`http://192.168.x.x/lacanau-semaine.pdf`). Si tu veux que ça
  marche de partout, il faut une URL publique (VPS ou hébergement statique).

## Marche à suivre, par étapes

### Étape 0 — Valider l'image sur le vrai écran (30 min, manuel)

Le moment de vérité : un rendu qui passe en simulation peut décevoir sur l'e-ink
réel. Avant toute automatisation :

1. Sur ta machine : `npm install` puis `node build-week.mjs` (génère le PDF).
2. Branche la Kobo en USB — elle apparaît comme une clé USB.
3. Copie `out/lacanau-semaine.pdf` dessus (glisser-déposer).
4. Éjecte, ouvre le PDF dans le lecteur de la Kobo, **tape pour changer de
   jour**. Regarde le contraste, la finesse des traits, la lisibilité à 2–3 m.

C'est ici qu'on ajuste le rendu si besoin (gris des dividers, tailles…).

### Étape 1 — KOReader (meilleur lecteur, dithering, plein écran)

Le lecteur natif Kobo marche, mais **KOReader** donne le contrôle : marges à
zéro, rafraîchissement complet régulier (anti-ghosting), tramage. Installation
sur Clara HD (méthode NickelMenu) :

1. Télécharge le `KoboRoot.tgz` de **NickelMenu**, extrais-le à la racine de la
   Kobo (branchée en USB).
2. Télécharge la release **KOReader** `koreader-kobo-*.zip`, extrais le dossier
   `koreader` dans `.adds/` sur la Kobo.
3. Crée `.adds/nm/koreader` contenant :
   `menu_item:main:KOReader:cmd_spawn:quiet:exec /mnt/onboard/.adds/koreader/koreader.sh`
4. Éjecte, redémarre : « KOReader » apparaît dans le menu.

Dans KOReader, ouvre le PDF, règle « fit to screen » et un rafraîchissement
complet toutes les N pages.

### Étape 2 — Automatiser le serveur

Sur la machine-serveur, une tâche planifiée lance le pipeline 3–4×/jour :

```bash
# cron (Linux) ou launchd (Mac). Les clés en variables d'env, jamais en dur.
export WORLDTIDES_KEY=...      # marées
export CANDHIS_TOKEN=...       # bouée 03302 (compte Cerema)
cd /chemin/vers/surf-poc && ./tools/refresh.sh
```

Puis **servir le PDF**. Le plus simple : un petit serveur HTTP dans `out/`
(`python3 -m http.server 8080`, ou nginx qui pointe sur `out/`). L'URL devient
`http://<ip-serveur>:8080/lacanau-semaine.pdf`.

### Étape 3 — Automatiser le téléchargement côté Kobo (le dernier maillon)

C'est la partie la moins standard. Le but : la Kobo, à son réveil, fait un
`wget` du PDF puis (r)ouvre le lecteur. Recettes connues :

- **KOReader + script** : un plugin/patch Lua qui télécharge l'URL sur un timer
  et recharge le document.
- **cron busybox de la Kobo** : la Kobo tourne sous Linux ; on active `crond`
  via un hook de démarrage et on planifie un `wget`. Voir les projets
  `kobo-wget-sync` et les dashboards Kobo existants.

Honnêtement, ce maillon se règle **la Kobo en main**, par itérations. On peut
commencer semi-manuel (un tap sur « rafraîchir » qui relance le wget) et
automatiser ensuite.

## Où héberger le serveur — trois options

- **Raspberry Pi chez toi** (recommandé) : ~35 €, allumé en permanence, cron +
  nginx, la Kobo tire du réseau local. Autonome, rien dans le cloud.
- **Ton Mac** : possible s'il est souvent allumé (launchd + `http.server`). La
  Kobo doit être sur le même WiFi et le Mac réveillé au moment du fetch.
- **VPS ~4 €/mois ou hébergement statique** (Cloudflare R2, GitHub Pages,
  Netlify) : le build tourne quelque part, pousse le PDF sur une URL publique,
  la Kobo tire de n'importe où. Utile si l'écran n'est pas toujours sur ton
  réseau.

## Batterie & WiFi

E-ink : l'image reste affichée sans consommer. Le seul coût, c'est réveil +
WiFi + téléchargement. À 3–4 réveils/jour, WiFi coupé entre-temps, on vise des
**semaines** d'autonomie. Ne pas laisser le WiFi allumé en continu.

## Récap des commandes (côté serveur)

```bash
npm install
export WORLDTIDES_KEY=...    # marées
export CANDHIS_TOKEN=...     # bouée (optionnel — sans, repli sur le modèle)
./tools/refresh.sh          # fetch réel + rendus + PDF
# sortie : out/lacanau-semaine.pdf  (+ out/week/day-*-eink.png, out/semaine.html)
```

# POC — écran e-ink conditions de surf, Lacanau

Chaîne complète : données JSON → HTML 1072×1448 → PNG → simulation e-ink.
Aucun matériel requis. La liseuse n'est qu'un afficheur de PNG : ce qui est
validé ici est ce qui s'affichera sur le Kobo.

## Lancer

```bash
npm install
node build.mjs                 # tous les scénarios (vue principale)
node build.mjs 01              # un seul
python3 eink.py out/01-nominal.png

node build-week.mjs            # vue semaine : 7 pages-jour + prototype tactile
```

Sortie dans `out/` : `<scénario>.html`, `<scénario>.png`, `<scénario>-eink.png`.
C'est le fichier `-eink.png` qui fait foi.

La vue semaine sort dans `out/week/` (`day-0..6`) et le prototype navigable dans
`out/semaine.html` (moitié droite = jour suivant, gauche = précédent, ← →).

## Données réelles

`tools/fetch.mjs` remplace les données factices de `data/week/` par du réel.
**À lancer sur une machine avec accès Internet** (pas dans le sandbox Cowork,
réseau verrouillé) — la même qui héberge les PNG que le Kobo télécharge.

```bash
export WORLDTIDES_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # marées (worldtides.info)
export CANDHIS_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx     # bouée 03302 (compte Cerema)

node tools/fetch.mjs        # -> écrit data/week/day-0..6.json (vraies données)
node build-week.mjs         # -> régénère les PNG + le prototype
# ou tout d'un coup :
./tools/refresh.sh
```

Sources : Open-Meteo Marine + Forecast (houle, vent, météo, temp. eau — gratuit,
sans clé), WorldTides (marées), CANDHIS/Cerema (houle mesurée du jour, bouée Cap
Ferret 03302). Sans les clés, `fetch.mjs` tourne quand même : marées en repli
synthétique, bouée ignorée (repli sur le modèle). Ne **jamais** committer les
clés — elles restent dans l'environnement. `node tools/fetch.test.mjs` valide le
transform hors-réseau.

À rafraîchir 3–4×/jour (cron / launchd) ; couper le Wi-Fi du Kobo entre-temps.

## Arborescence

```
src/physics.mjs    Komar & Gaughan, classification du vent, marées
src/verdict.mjs    templates conditionnels de la phrase d'accroche
src/glyphs.mjs     tracés crayonnés (rough.js), générés côté Node
src/render.mjs     mise en page absolue, coordonnées issues de Figma
build.mjs          données → HTML → PNG
eink.py            16 niveaux de gris + tramage Floyd-Steinberg
calibration.json   position mesurée de la ligne de base par police
data/*.json        six jeux de données, dont les états dégradés
```

## Scénarios

| Fichier | Ce qu'il teste |
|---|---|
| `01-nominal` | reproduction fidèle de la maquette Figma |
| `02-flat` | mer plate, pas de vent, phrase courte |
| `03-gros` | grosse houle, vent onshore fort, pluie |
| `04-bouee-hs` | bouée indisponible, repli sur le modèle, phrase longue |
| `05-perime` | données vieilles de 52 h |
| `06-mortes-eaux` | faible marnage — la courbe de marée s'aplatit |

## Points d'implémentation

**Tracés crayonnés.** Générés par rough.js côté Node, puis figés dans le SVG.
Aucun JavaScript n'est exécuté au rendu. Les graines sont fixes : un tracé qui
changerait à chaque rafraîchissement aggraverait la rémanence e-ink.

**Flèches.** Elles pivotent selon la direction réelle de propagation
(direction d'origine + 180°). Elles ne peuvent donc pas rester des exports
statiques.

**Courbe de marée.** L'amplitude est proportionnelle au marnage du jour,
plafonnée à un marnage de vive-eau de 5 m. Comparer `01` et `06`.

**Calibration typographique.** `tools/calibrate.mjs` mesure la position réelle
de la ligne de base pour chaque police plutôt que de la déduire des métriques
déclarées. À relancer si les polices changent.

**Coupure de ligne.** La phrase d'accroche est de longueur variable. Le corps
s'ajuste et le bloc se recentre. La mesure utilise les largeurs `hmtx` réelles
d'Aujournuit, avec coupure possible après un trait d'union.

## Constante k

`k = 0,39` est la valeur publiée par Komar & Gaughan (1972). Appliquée à une
hauteur significative, elle donne des vagues plus hautes que la houle du large —
contraire à ce que lit un surfeur. Les jeux de données utilisent `k = 0,227`,
qui reproduit la maquette (1,8 m / 11 s → 1,2–1,8 m). C'est une valeur à
recalibrer sur une saison d'observations réelles.

## Ensuite

1. ~~Vue semaine (tactile)~~ — faite (`build-week.mjs`, `out/semaine.html`).
   Reste à trancher côté matériel comment le tap charge la page voisine
   (KOReader / kiosque).
2. Câblage des API : bouée Cap Ferret, Open-Meteo (dont la prévision 7 j qui
   alimentera `data/week/`), Marea
3. Icônes météo (8) à assembler
4. Cible matérielle : Kobo Clara HD, KOReader ou mode kiosque

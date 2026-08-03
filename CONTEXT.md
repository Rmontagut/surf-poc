# Contexte du projet — à lire en premier

Écran e-ink affichant les conditions de surf à Lacanau. Ce fichier récapitule
les décisions prises, pour reprendre le travail sans repartir de zéro.

## Matériel visé

Kobo Clara HD d'occasion : 1072 × 1448, 6", 300 ppi, 16 niveaux de gris.
Pas encore acheté. Le Kobo est un Linux ouvert, aucun jailbreak nécessaire —
contrairement au Kindle, dont l'enregistrement est bloqué depuis mai 2026.

Alternative écartée : ESP32 (LilyGO T5, Inkplate). Meilleure autonomie, mais
écran moins dense et pas de tactile.

Fonctionnement : la liseuse n'exécute rien. Un serveur génère un PNG, la
liseuse le télécharge et l'affiche. Rafraîchissement 3-4 fois par jour, WiFi
coupé entre-temps.

## Décisions de design

- **Format vertical**, registre éditorial. Pas de schéma de côte : la phrase
  d'accroche fait le travail d'interprétation.
- **Pas de curseur « maintenant »** sur la courbe de marée. Le lecteur connaît
  l'heure et lit la pente. Décision assumée, réversible.
- **Pas de label** distinguant la vague estimée de la houle mesurée : la
  hiérarchie typographique (gros / petit) suffit.
- **Phrase d'accroche par templates conditionnels**, jamais par LLM.
  Déterministe, testable, gratuit, et sans état de panne.
- **Effet crayonné conservé** partout. Validé au rendu e-ink : la texture se
  comporte comme une trame et passe bien au tramage.
- **Cadrage sur le cycle de marée de 12 h 25**, pas sur la journée. Les
  extrêmes tombent toujours à 10 / 50 / 90 % de la largeur, donc les heures
  sont à des positions fixes et les courbes dessinées sont réutilisables.
- **Hauteur toujours en fourchette**, jamais en valeur unique.

## Assets

Tout ce qui est dessiné vient de Figma (fichier « Kookbook »), exporté en PNG.
Le SVG a été écarté : le grain de crayon vectorisé pèse 400 Ko à 1 Mo par
élément, pour aucun gain visible sur un écran 16 niveaux de gris.

| Asset | État |
|---|---|
| Flèche de houle | fournie en 2x — `assets/arrow-swell.png` |
| Flèches de vent (light / medium / hard) | fournies en 2x |
| Courbes de marée (4 amplitudes) | fournies |
| Dividers (horizontal + vertical) | fournis — `assets/divider-h.png`, `divider-v.png` |
| Icônes météo (8) | à faire |

Les flèches sont dessinées pointant vers le nord et pivotées par le code selon
la direction de propagation (direction d'origine + 180°).

**Icônes météo — méthode retenue :** ne pas redessiner huit icônes. L'icône
existante contient déjà un nuage, un soleil et des rayons, tous séparables. En
les recombinant, il ne reste que deux dessins à produire : un trait de pluie et
un éclair. Voir le tableau d'assemblage dans le brief de design.

## Points ouverts

1. ~~**Pointillés des courbes de marée trop clairs**~~ — RÉSOLU (par suppression).
   Les pointillés de repère baked dans le PNG étaient invisibles au tramage. J'ai
   d'abord ajouté de courtes graduations côté code, jugées inutiles à l'usage :
   supprimées. On s'appuie sur l'alignement — les labels PM/BM tombent sous les
   pics/creux (positions fixes 10/50/90 %), ça se lit sans repère dessiné.
2. ~~**Pointillé décalé de 7,85 px dans `Vives-eaux.svg`**~~ — SANS OBJET. Les
   repères sont désormais tracés par le code, plus par l'asset ; le décalage du
   pointillé baked n'a plus d'effet. Le décalage vertical du bloc vives-eaux
   reste compensé par `blockTop` dans `tide-meta.json`.
3. ~~**PNG des flèches en 1x**~~ — RÉSOLU. Flèches ré-exportées en 2x
   (≈428 px pour un affichage à 214 px). La rotation résample maintenant vers le
   bas, le trait reste net.
4. ~~**État « données périmées »**~~ — RÉSOLU (tirets). Quand les données sont
   périmées, hauteur / période / houle / vent passent en tiret « — » (gris
   moyen, placeholder discret) et les flèches sont masquées : aucun chiffre du
   moment n'est affiché, la phrase d'accroche porte seule l'état hors ligne. La
   marée (cache annuel) et la météo restent à l'encre.
5. ~~**Vue semaine tactile**~~ — FAITE (paginée façon liseuse). Pages jour par
   jour au même gabarit riche que la vue principale, alimentées par la prévision
   du jour. Navigation : moitié droite = jour +1, moitié gauche = jour −1
   (clavier ← →). En-tête « ville + date du jour » à gauche (encre), « Màj : … »
   grisé à droite — date de maj jamais confondue avec la date affichée. 7 jours
   (J → J+6). Génération `tools/gen-week.mjs`, build `build-week.mjs`, prototype
   `out/semaine.html`. Données factices en attendant les API. À câbler ensuite :
   `data/week/*.json` doit venir d'Open-Meteo (prévision horaire agrégée/jour).
6. ~~**APIs pas câblées**~~ — CÂBLÉES dans `tools/fetch.mjs` (Open-Meteo Marine +
   Forecast pour houle/vent/météo/temp. eau, gratuit sans clé ; WorldTides pour
   les marées via `WORLDTIDES_KEY` ; CANDHIS bouée 03302 via `CANDHIS_TOKEN`).
   Transform validé hors-réseau (`tools/fetch.test.mjs`). **Ne s'exécute PAS dans
   le sandbox Cowork** (réseau verrouillé) : à lancer sur une machine avec accès
   Internet, d'où le Kobo tirera les PNG. Sans clés, tout se rend quand même
   (marées en repli synthétique, bouée ignorée). Reste à obtenir le jeton
   CANDHIS (compte Cerema, candhis@cerema.fr) ; clé WorldTides déjà en main.
7. **Dividers en gris ~50 %** (#808080, tels que dessinés dans Figma). Lisibles
   mais délicats ; à assombrir vers #404040 si on les veut plus porteurs.
8. **Icônes météo (8)** : toujours à assembler (voir Assets).

## Sources de données prévues

| Donnée | Source | Coût |
|---|---|---|
| Houle mesurée | Bouée Cap Ferret 03302 (CANDHIS / Cerema), maj 30 min | à vérifier |
| Houle prévue, vent, météo | Open-Meteo (Marine + Forecast) | gratuit |
| Marées | Marea API — 1 requête/an mise en cache | ~gratuit |
| Hauteur au déferlement | calculé, Komar & Gaughan (1972) | — |

## La constante k

`Hb = k · g^(1/5) · (T · H₀²)^(2/5)`

La valeur publiée, k = 0,39, donne pour 1,8 m à 11 s une vague de **2,6 m** —
plus haute que la houle du large. Physiquement correct, mais contraire à ce que
lit un surfeur. Les jeux de données utilisent **k = 0,227**, qui reproduit la
maquette. À recalibrer sur une saison d'observations réelles à Lacanau : c'est
le seul moyen d'être plus juste que Surfline sur ce spot.

## Limite de fond, à ne pas oublier

Lacanau est un beach break : les bancs de sable se redessinent à chaque houle.
C'est le terme d'erreur dominant, et aucun service ne le modélise. L'écran peut
être bon en relatif, jamais précis en absolu. D'où la fourchette et l'affichage
séparé du mesuré et du prédit.

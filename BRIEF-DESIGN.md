# Brief design — écran e-ink conditions de surf, Lacanau

## 1. Le support

**Cible : Kobo Clara HD** — 6", 1072 × 1448 px, 300 ppi, portrait.
Design à l'échelle 1:1. Artboard Figma : **1072 × 1448**.

### Le piège numéro un : l'échelle

À 300 ppi, **1 mm = 11,8 px**. Les réflexes de design écran (16 px pour du texte courant) donnent ici des caractères de 1,4 mm — illisibles.

Raisonne en millimètres, puis convertis :

| Rôle | Taille physique | Pixels |
|---|---|---|
| Chiffre héros (hauteur, période) | 25–40 mm | 300–470 px |
| Titre de section | 5–6 mm | 60–70 px |
| Texte courant | 3,5–4 mm | 42–48 px |
| Label / unité | 2,5–3 mm | 30–36 px |
| **Plancher absolu** | 2 mm | 24 px |

Rien en dessous de 24 px. En e-ink, ça ne devient pas juste petit : ça devient gris.

### Filet minimum

**2 px pour un trait plein, 3 px si le trait est gris.** Un hairline de 1 px disparaît au rendu.

## 2. La contrainte chromatique

Écran 16 niveaux de gris (4 bits). En pratique, n'en utilise que **5** :

| Rôle | Valeur | Usage |
|---|---|---|
| Encre | #000000 | Texte principal, traits porteurs |
| Gris fort | #404040 | Texte secondaire, traits d'appui |
| Gris moyen | #808080 | À manier avec précaution — jamais en grand aplat |
| Gris clair | #C0C0C0 | Trames, zones d'eau, fonds de section |
| Papier | #FFFFFF | Fond |

### Règles

- **Pas de dégradés.** Ils se transforment en bandes visibles.
- **Pas de grands aplats de gris moyen.** Ils marbrent et fantômisent. Pour remplir une surface, utilise une **trame** : hachures, pointillés, lignes. Le rendu est net et le vocabulaire graphique est plus riche.
- **Contraste minimum : 40 %.** En dessous, c'est de la bouillie sans rétroéclairage.
- **Rémanence (ghosting).** Le rafraîchissement partiel laisse une trace de l'image précédente. Cantonne les éléments qui changent dans des zones définies, et prévois un rafraîchissement complet une fois par jour.

### Direction esthétique suggérée

Le trait, la hachure et la trame de points fonctionnent bien mieux que les aplats — ce qui pousse naturellement vers un vocabulaire de **carte marine, de gravure ou de relevé hydrographique**. Ça sert le sujet plutôt que de le décorer. À exploiter ou à contredire, mais c'est le sens du support.

## 3. Vue principale — l'instant présent

Six zones, de haut en bas. Les proportions sont indicatives.

```
┌────────────────────────────┐
│ A · VERDICT            ~15%│  la réponse en un coup d'œil
├────────────────────────────┤
│                            │
│ B · LA CÔTE VUE DU DESSUS  │  élément signature
│                        ~40%│  vent · houle · bouée · trait d'eau
│                            │
├────────────────────────────┤
│ C · HAUTEUR × PÉRIODE  ~20%│  un seul objet, pas deux chiffres
├────────────────────────────┤
│ D · MÉTÉO              ~10%│  minimal
├────────────────────────────┤
│ E · AXE DE MARÉE       ~12%│  sinusoïde + curseur "maintenant"
├────────────────────────────┤
│ F · FRAÎCHEUR DONNÉE    ~3%│  non négociable
└────────────────────────────┘
```

### Zone A — Verdict

La seule zone lisible à trois mètres. Elle répond à « j'y vais ou pas », pas « quelles sont les données ».
Écris-la en langage humain, pas en jargon météo. Verbe actif, phrase courte, casse normale.

### Zone B — La côte vue du dessus (signature)

Vue schématique, la plage orientée **plein ouest (270°)**, l'océan à gauche ou en haut selon ta composition.

Ce que la vue porte :
- **Le vecteur vent** — sa valeur n'est pas sa direction absolue mais son **angle par rapport à la normale de la plage**. Vent d'est (90°) = offshore. Vent d'ouest = onshore. Le dessin doit rendre cette lecture immédiate, sans que le lecteur ait à faire le calcul.
- **Le vecteur houle** — direction d'où elle arrive, épaisseur ou longueur indexée sur l'énergie.
- **La bouée Cap Ferret**, positionnée au large avec son relevé attaché.
- **Le trait d'eau**, dont la position sur le sable varie avec la hauteur d'eau du moment. La marée devient une propriété du dessin, pas un widget séparé.

Une note d'échelle : la bouée est à ~30 km au sud-ouest. Le dessin est un schéma, pas une carte — assume la distorsion, mais reste cohérent.

### Zone C — Hauteur × période

**Ne les traite pas comme deux chiffres côte à côte.** Le couple est l'information ; séparés, ils induisent en erreur.

- Hauteur affichée en **fourchette**, jamais en valeur unique (voir §5).
- Envisage une silhouette humaine à l'échelle : la hauteur devient perceptible au lieu d'être lue.
- La période mérite un poids typographique au moins égal à celui de la hauteur.
- Optionnel : indicateur de **type de déferlement** (glissant / plongeant), dérivé du nombre d'Iribarren.

### Zone D — Météo

Le strict nécessaire : température de l'air, température de l'eau, état du ciel. C'est du contexte, pas le sujet. Doit rester graphiquement subordonné aux zones A à C.

### Zone E — Axe de marée

Sinusoïde sur l'axe X, avec :
- **Amplitude proportionnelle au marnage du jour** — courbe plate en mortes-eaux, ample en vives-eaux. Remplace avantageusement le coefficient, qui ne parle qu'aux initiés.
- **Curseur « maintenant »** sur la courbe.
- Sens de la marée lisible par la position du curseur sur la pente — montante ou descendante, sans avoir besoin d'une flèche.
- Heures des pleines et basses mers en labels.

### Zone F — Fraîcheur de la donnée

Sur un appareil qui se rafraîchit trois fois par jour, savoir **quand la donnée date** est vital. Un écran e-ink affiche toujours quelque chose, même déconnecté depuis deux jours — sans horodatage, il ment en silence.
Petit, discret, mais toujours présent. Prévois aussi un **état « données périmées »** visuellement distinct.

## 4. Vue semaine (tactile)

Registre différent, volontairement plus sobre. Sept lignes, une par jour.

Par jour, le minimum utile : hauteur (fourchette), période, angle du vent, marnage.
Pas de dessin de côte ici — la vue principale garde l'exclusivité de l'élément signature.

**Zones tactiles : 100 × 100 px minimum.** Le tactile Kobo est peu précis et le rafraîchissement lent : prévois un retour visuel immédiat au tap, sinon on tape trois fois.

## 5. Règles de vérité

Trois principes non négociables, parce que l'appareil doit rester honnête sur ce qu'il sait :

1. **Jamais de hauteur en valeur unique.** Toujours une fourchette. L'incertitude physique du modèle de déferlement dépasse largement les 20 cm.
2. **Sépare le mesuré du prédit.** La bouée mesure, le modèle prédit. Deux traitements graphiques distincts. Ne les fonds jamais dans un chiffre unique.
3. **Distingue la houle au large de la vague à la plage.** Ce sont deux grandeurs différentes ; les confondre est l'erreur la plus courante des dashboards surf.

## 6. Données et sources

| Donnée | Source | Rafraîchissement |
|---|---|---|
| Houle mesurée (Hs, période, direction, T° eau) | Bouée Cap Ferret 03302 (CANDHIS / Cerema) | 30 min |
| Houle prévue, vent, météo | Open-Meteo (Marine + Forecast) | horaire |
| Marées (hauteurs + extrêmes) | Marea API | 1×/an, mis en cache |
| Hauteur au déferlement | Calculé — Komar & Gaughan (1972) | dérivé |

Formule de déferlement : `Hb = k · g^(1/5) · (T · H₀²)^(2/5)`, avec **k = 0,39** en valeur de départ, à recalibrer sur une saison d'observations à Lacanau.

## 7. Pipeline de prototypage local

Aucun hardware requis pour les étapes 1 à 4.

1. **Figma** — maquette 1072 × 1448, palette 5 gris, échelle typo en mm.
2. **HTML/CSS** — traduction fidèle, ouverte dans Chrome à taille réelle.
3. **Données factices** — un fichier JSON avec les champs du §6, plusieurs jeux : petites conditions, grosse houle, données périmées, marée haute, marée basse. Teste la maquette contre les cas limites, pas contre le cas idéal.
4. **Simulation e-ink** — capture PNG via Puppeteer, puis conversion en 16 niveaux de gris avec tramage. C'est là que tu vois ce qui casse.
5. **Câblage des APIs** — une fois le rendu figé.
6. **Kobo** — en dernier.

### Cas limites à maquetter dès le départ

- Toutes les valeurs à zéro (flat, pas de houle)
- Valeurs à trois chiffres (rafales à 100 km/h)
- Données bouée indisponibles (elle tombe régulièrement)
- Données vieilles de 48 h
- Marée haute pleine et marée basse pleine — le trait d'eau aux deux extrêmes du dessin

Un dashboard se juge sur ses états dégradés, pas sur son état nominal.

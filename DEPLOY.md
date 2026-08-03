# Mise à jour automatique dans le cloud (gratuit, sans ordi allumé)

Objectif : chaque jour à une heure fixe, un serveur cloud gratuit récupère les
vraies données, fabrique le PDF, et le publie à une URL fixe. Rien d'allumé chez
toi à part la Kobo, qui va chercher ce PDF quand elle se réveille.

C'est le workflow GitHub Actions qui fait tout. Son contenu est fourni dans
`deploy/build.yml` (il doit vivre à `.github/workflows/build.yml` dans le dépôt —
voir l'étape 1).

## Mise en place (une seule fois, ~10 min)

1. **Créer un dépôt GitHub** (public — c'est plus simple pour que la Kobo puisse
   télécharger sans authentification ; tes clés, elles, ne sont PAS dans le code).
   Y pousser le contenu du dossier `surf-poc`, puis **déplacer `deploy/build.yml`
   vers `.github/workflows/build.yml`** (ou, plus simple, le recréer directement
   dans l'interface GitHub : onglet *Actions* → *New workflow* → *set up a
   workflow yourself*, et coller le contenu de `deploy/build.yml`).

2. **Ajouter tes clés en secrets** : dépôt → *Settings* → *Secrets and variables*
   → *Actions* → *New repository secret* :
   - `WORLDTIDES_KEY` → ta clé WorldTides.
   - `CANDHIS_TOKEN` → ton jeton Cerema (quand tu l'auras ; sans lui, ça tourne
     quand même, la bouée est juste ignorée).

3. **Activer GitHub Pages** : dépôt → *Settings* → *Pages* → *Source* :
   **GitHub Actions**.

4. C'est tout. Le workflow tourne chaque jour à l'heure fixée. Pour le tester
   tout de suite : onglet *Actions* → *build-surf* → *Run workflow*.

## L'URL du PDF

Une fois le premier run passé, le PDF est à :

```
https://<ton-pseudo>.github.io/<nom-du-repo>/lacanau-semaine.pdf
```

C'est **cette URL** que la Kobo télécharge (cf. `HARDWARE.md`, étape 3). Le
prototype navigable est aussi publié à la racine (`.../` → `index.html`), pratique
pour vérifier la semaine depuis un navigateur.

## Changer l'heure de mise à jour

Dans `.github/workflows/build.yml`, la ligne `cron: '0 5 * * *'` = 05:00 UTC.
Attention : le cron est en **UTC** et ne suit pas l'heure d'été.
- Été (Paris = UTC+2) : `0 5 * * *` → 07:00.
- Hiver (Paris = UTC+1) : `0 6 * * *` → 07:00.
Format : `minute heure * * *`. Pour deux mises à jour par jour :
`0 5,17 * * *` (07:00 et 19:00 l'été).

## Le maillon Kobo

Le cloud publie ; il reste à ce que la Kobo **aille chercher** le PDF (on ne peut
pas pousser vers une liseuse endormie). Idéalement, on programme son réveil peu
après l'heure de build. Ce réglage se fait l'appareil en main — voir
`HARDWARE.md`, étape 3.

## Bon à savoir

- GitHub Actions est gratuit largement dans les quotas pour un run/jour.
- Les runs planifiés peuvent démarrer avec quelques minutes de retard côté GitHub :
  pas grave ici, on n'est pas à la minute.
- Aucune clé n'apparaît jamais dans le code ni dans les logs : elles vivent
  uniquement dans les *Secrets* du dépôt.

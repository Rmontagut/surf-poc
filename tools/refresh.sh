#!/usr/bin/env bash
# Rafraichit les donnees reelles puis regenere les rendus.
# A lancer sur une machine avec Internet (pas le sandbox Cowork).
# Les cles se passent par l'environnement, jamais en dur :
#   export WORLDTIDES_KEY=...   # marees
#   export CANDHIS_TOKEN=...    # bouee 03302 (Cerema)
# Puis :  ./tools/refresh.sh   (ou via cron/launchd, 3-4x/jour)
set -euo pipefail
cd "$(dirname "$0")/.."

node tools/fetch.mjs
node build-week.mjs

echo "Rendu a jour : out/week/day-0..6-eink.png (aujourd'hui = day-0) + out/semaine.html"

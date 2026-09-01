# Firmware ESP32 — LilyGO T5 4.7" S3

Le boîtier est bête, le serveur est intelligent : la carte se réveille,
télécharge l'image du jour (GitHub Pages), l'affiche, se rendort.

## Étape 1 — valider l'écran (aucun WiFi requis)

`src/config.h` est livré avec `WIFI_SSID` vide : le firmware affiche l'image
embarquée (`src/surf_image.h`, générée par `tools/pack-esp32.py` depuis le
rendu du jour) puis s'endort.

```bash
cd esp32
pio run              # compile (long la 1re fois : télécharge le toolchain)
pio run -t upload    # flashe la carte branchée en USB-C
```

Si `upload` ne trouve pas le port : maintenir le bouton **BOOT**, presser
**RST**, relâcher BOOT, relancer la commande.

Si l'image apparaît à l'envers : régénérer le header avec `--rot 90`
(`python3 tools/pack-esp32.py out/esp32/day-0-light-eink.png esp32/src/surf_image.h --header surf_image --rot 90`).

## Étape 2 — mode autonome

1. Ajouter au workflow GitHub la génération de `lacanau-esp32.bin`
   (build-esp32 + pack-esp32.py) et sa copie dans `public/`.
2. Renseigner `WIFI_SSID` / `WIFI_PASS` dans `src/config.h`.
3. `pio run -t upload`. La carte se rafraîchit ensuite toutes les
   `REFRESH_MIN` minutes, WiFi coupé entre-temps.

## Logs

```bash
pio device monitor   # voir ce que raconte la carte (115200 bauds)
```

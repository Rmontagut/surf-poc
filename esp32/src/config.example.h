// Configuration du boitier surf e-ink.
//
// ETAPE 1 (validation ecran) : laisse WIFI_SSID vide ("") -> le firmware
// affiche l'image embarquee (surf_image.h) et s'endort. Aucun reseau.
//
// ETAPE 2 (autonome) : renseigne ton WiFi ci-dessous -> a chaque reveil la
// carte telecharge l'image du jour depuis GitHub Pages, l'affiche, se rendort.
// (Necessite d'avoir ajoute la generation de lacanau-esp32.bin au workflow
// GitHub - voir SUIVI.md.)
#pragma once

#define WIFI_SSID     ""            // ex. "Livebox-1234"
#define WIFI_PASS     ""            // mot de passe du WiFi

// Image publiee par GitHub Actions (framebuffer brut 4 bpp, 259 200 octets).
#define IMAGE_URL     "https://rmontagut.github.io/surf-poc/lacanau-esp32.bin"

// Frequence de rafraichissement en mode autonome.
#define REFRESH_MIN   120           // minutes entre deux reveils (2 h)
#define RETRY_MIN     15            // re-essai si le telechargement echoue

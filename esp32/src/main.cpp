// Firmware surf e-ink — LilyGO T5 4.7" S3.
//
// Cycle de vie (le meme schema que la Kobo : l'appareil est bete, le serveur
// est intelligent) :
//   reveil -> [WiFi -> telecharge le framebuffer du jour] -> affiche
//          -> veille profonde (quelques µA) -> re-reveil apres REFRESH_MIN.
//
// Sans WiFi configure (config.h), on affiche l'image embarquee surf_image.h :
// c'est le mode "validation de l'ecran", aucun reseau requis.
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "epd_driver.h"
#include "config.h"
#include "surf_image.h"

static const size_t FB_SIZE = EPD_WIDTH * EPD_HEIGHT / 2; // 960*540/2 = 259 200
RTC_DATA_ATTR int bootCount = 0;                          // survit a la veille

static uint8_t *framebuffer = nullptr;

// Telecharge IMAGE_URL (framebuffer brut 4 bpp) dans framebuffer.
// Renvoie true si les FB_SIZE octets ont ete recus.
static bool downloadImage()
{
    if (strlen(WIFI_SSID) == 0) return false;

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    Serial.print("WiFi");
    for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
        delay(500);
        Serial.print(".");
    }
    Serial.println();
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi : echec de connexion");
        return false;
    }
    Serial.println("WiFi OK, IP " + WiFi.localIP().toString());

    WiFiClientSecure client;
    client.setInsecure(); // GitHub Pages : on ne verifie pas le certificat
    HTTPClient http;
    http.setTimeout(20000);
    if (!http.begin(client, IMAGE_URL)) return false;
    int code = http.GET();
    Serial.printf("HTTP %d\n", code);
    if (code != HTTP_CODE_OK) { http.end(); return false; }

    WiFiClient *stream = http.getStreamPtr();
    size_t got = 0;
    uint32_t lastData = millis();
    while (got < FB_SIZE && millis() - lastData < 15000) {
        size_t avail = stream->available();
        if (avail) {
            got += stream->readBytes(framebuffer + got, min(avail, FB_SIZE - got));
            lastData = millis();
        } else {
            delay(20);
        }
    }
    http.end();
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    Serial.printf("recu %u / %u octets\n", (unsigned)got, (unsigned)FB_SIZE);
    return got == FB_SIZE;
}

void setup()
{
    Serial.begin(115200);
    delay(500);
    bootCount++;
    Serial.printf("\n== surf e-ink, reveil #%d ==\n", bootCount);

    framebuffer = (uint8_t *)heap_caps_malloc(FB_SIZE, MALLOC_CAP_SPIRAM);
    if (!framebuffer) {
        Serial.println("alloc framebuffer KO");
        esp_deep_sleep_start(); // rien d'affichable, on dort
    }

    const bool fromNet = downloadImage();
    if (!fromNet) {
        // Repli : image embarquee a la compilation (mode validation,
        // ou panne reseau -> au moins l'ecran montre quelque chose).
        memcpy(framebuffer, surf_image_data, FB_SIZE);
        Serial.println(strlen(WIFI_SSID) ? "repli image embarquee" : "mode validation : image embarquee");
    }

    epd_init();
    epd_poweron();
    epd_clear();
    epd_draw_grayscale_image(epd_full_screen(), framebuffer);
    epd_poweroff_all();
    Serial.println("affiche.");

    // Veille profonde. Sans WiFi configure : sommeil "infini" (24 h),
    // on re-affichera au prochain branchement/reset.
    uint64_t minutes = strlen(WIFI_SSID) == 0 ? 24 * 60
                     : (fromNet ? REFRESH_MIN : RETRY_MIN);
    Serial.printf("dodo %llu min\n", minutes);
    Serial.flush();
    esp_sleep_enable_timer_wakeup(minutes * 60ULL * 1000000ULL);
    esp_deep_sleep_start();
}

void loop() {} // jamais atteint (deep sleep a la fin du setup)

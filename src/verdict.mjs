// Moteur de templates conditionnels pour la phrase d'accroche.
// Deterministe, testable, gratuit. Aucun LLM dans la boucle.
//
// Structure : "<qualite>, <houle> et <vent>"
// Chaque fragment est choisi par des regles explicites sur les donnees.

import { windClass, cardinal } from './physics.mjs';

// --- Fragment 1 : la qualite generale -----------------------------------

function qualityFragment({ wc, period, hb, stale, buoyDown }) {
  if (stale) return 'Données hors ligne';
  if (hb !== null && hb < 0.4) return 'Mer plate';

  switch (wc) {
    case 'NUL':
      return period >= 10 ? 'Conditions lisses' : 'Sans vent, mer molle';
    case 'OFFSHORE':
      if (period >= 12) return 'Conditions parfaites';
      if (period >= 9) return 'Conditions propres';
      return 'Vent favorable, mer courte';
    case 'CROSS-OFFSHORE':
      return period >= 10 ? 'Conditions correctes' : 'Conditions moyennes';
    case 'CROSS-SHORE':
      return 'Conditions moyennes';
    case 'CROSS-ONSHORE':
      return 'Mer un peu hachée';
    case 'ONSHORE':
      return period >= 12 ? 'Mer désordonnée' : 'Conditions hachées';
    default:
      return 'Conditions incertaines';
  }
}

// --- Fragment 2 : la houle ----------------------------------------------

function swellFragment({ period, swellDir, buoyDown }) {
  let texture;
  if (period == null) texture = 'houle indéterminée';
  else if (period >= 13) texture = 'houle longue';
  else if (period >= 9) texture = 'houle régulière';
  else if (period >= 6) texture = 'houle courte';
  else texture = 'clapot';

  if (swellDir == null) return texture;
  const origin = cardinal(swellDir).toLowerCase();
  return `${texture} ${origin}`;
}

// --- Fragment 3 : le vent -----------------------------------------------

function windFragment({ wc, windDir, windSpeed }) {
  if (wc === 'NUL') return 'pas un souffle';
  const origin = cardinal(windDir);
  const strength = windSpeed >= 40 ? 'fort ' : windSpeed >= 25 ? 'bon ' : '';
  const prefix = /^[AEIOU]/.test(origin) ? "vent d'" : 'vent de ';
  return `${strength}${prefix}${origin}`;
}

// --- Assemblage ----------------------------------------------------------

export function buildVerdict(ctx) {
  const wc = windClass(ctx.windDir, ctx.windSpeed);
  const state = { ...ctx, wc };

  if (ctx.stale) {
    return `Données hors ligne depuis ${ctx.staleHours} h`;
  }

  const quality = qualityFragment(state);
  const swell = swellFragment(state);
  const wind = windFragment(state);

  // L'etat de la bouee est deja signale sous la fleche de houle :
  // le repeter ici allongerait la phrase sans rien apprendre.
  return `${quality}, ${swell} et ${wind}`;
}

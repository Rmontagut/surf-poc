// Physique de surface : conversion houle au large -> vague a la plage,
// classification du vent, interpolation de maree.

const G = 9.81;

// Orientation de la plage de Lacanau : la normale pointe vers le large a 270deg (plein ouest).
export const BEACH_NORMAL = 270;

/**
 * Komar & Gaughan (1972) : Hb = k * g^(1/5) * (T * H0^2)^(2/5)
 * k = 0.39 par defaut, a recalibrer sur une saison d'observations locales.
 */
export function breakingHeight(h0, period, k = 0.39) {
  if (!h0 || !period) return null;
  return k * Math.pow(G, 1 / 5) * Math.pow(period * h0 * h0, 2 / 5);
}

/**
 * Fourchette affichee. L'incertitude vient surtout des bancs de sable,
 * que le modele ne connait pas : +/- 20 % est deja optimiste.
 */
export function breakingRange(h0, period, k = 0.39, spread = 0.2) {
  const hb = breakingHeight(h0, period, k);
  if (hb === null) return null;
  return { low: hb * (1 - spread), high: hb * (1 + spread), mid: hb };
}

const norm = (deg) => ((deg % 360) + 360) % 360;

/** Direction de propagation a partir de la direction d'origine (convention meteo). */
export const travelBearing = (fromDeg) => norm(fromDeg + 180);

/** Ecart angulaire absolu, 0-180. */
export function angleDelta(a, b) {
  const d = Math.abs(norm(a) - norm(b));
  return d > 180 ? 360 - d : d;
}

/**
 * Classe le vent par rapport a la plage.
 * Offshore = le vent souffle de la terre vers la mer : il voyage vers 270deg.
 */
export function windClass(windFromDeg, speedKmh) {
  if (speedKmh != null && speedKmh < 4) return 'NUL';
  const delta = angleDelta(travelBearing(windFromDeg), BEACH_NORMAL);
  if (delta < 30) return 'OFFSHORE';
  if (delta < 75) return 'CROSS-OFFSHORE';
  if (delta < 105) return 'CROSS-SHORE';
  if (delta < 150) return 'CROSS-ONSHORE';
  return 'ONSHORE';
}

const CARDINALS = [
  [0, 'Nord'], [22.5, 'Nord-Est'], [67.5, 'Est'], [112.5, 'Sud-Est'],
  [157.5, 'Sud'], [202.5, 'Sud-Ouest'], [247.5, 'Ouest'], [292.5, 'Nord-Ouest'], [337.5, 'Nord'],
];

export function cardinal(deg) {
  const d = norm(deg);
  let label = 'Nord';
  for (const [start, name] of CARDINALS) if (d >= start) label = name;
  return label;
}

/** Marnage du jour : amplitude entre la plus haute et la plus basse eau. */
export function tidalRange(extremes) {
  if (!extremes || extremes.length < 2) return null;
  const heights = extremes.map((e) => e.height);
  return Math.max(...heights) - Math.min(...heights);
}

/** Interpolation sinusoidale entre deux extremes consecutifs. */
export function tideHeightAt(extremes, t) {
  if (!extremes || extremes.length < 2) return null;
  for (let i = 0; i < extremes.length - 1; i++) {
    const a = extremes[i];
    const b = extremes[i + 1];
    const ta = new Date(a.time).getTime();
    const tb = new Date(b.time).getTime();
    if (t >= ta && t <= tb) {
      const phase = (t - ta) / (tb - ta);
      const mean = (a.height + b.height) / 2;
      const amp = (a.height - b.height) / 2;
      return mean + amp * Math.cos(Math.PI * phase);
    }
  }
  return null;
}

/** Montante ou descendante a l'instant t. */
export function tideDirection(extremes, t) {
  if (!extremes || extremes.length < 2) return null;
  for (let i = 0; i < extremes.length - 1; i++) {
    const ta = new Date(extremes[i].time).getTime();
    const tb = new Date(extremes[i + 1].time).getTime();
    if (t >= ta && t <= tb) {
      return extremes[i + 1].height > extremes[i].height ? 'montante' : 'descendante';
    }
  }
  return null;
}

/**
 * Variante de fleche de vent selon la seule puissance.
 * 28 km/h est a peu pres le seuil ou un onshore devient sale a Lacanau.
 */
export const WIND_STEPS = { light: 12, medium: 28 };

export function windVariant(speedKmh) {
  if (speedKmh < WIND_STEPS.light) return 'light';
  if (speedKmh < WIND_STEPS.medium) return 'medium';
  return 'hard';
}

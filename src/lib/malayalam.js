// Malayalam Era (Kollavarsham) solar calendar.
//
// A Malayalam month begins when the Sun enters a sidereal zodiac sign (sankranti).
// Kerala rule: if the sankranti happens before 3/5 of the daytime (sunrise → sunset)
// has elapsed, that day is day 1 of the new month; otherwise the next day is.
// So a day's month = the sidereal sign the Sun is in at that day's 3/5-daytime mark.
//
// Nakshatram (lunar mansion) of a day: the one the Moon is in at sunrise, as printed
// in Kerala calendars, along with the time it ends.
//
// Sun position: Meeus, "Astronomical Algorithms" ch. 25 (≈0.01° ≈ 15 min of sankranti time).
// Moon position: Meeus ch. 47, full longitude series (≈0.003° ≈ 20 s of nakshatram time).
// Ayanamsa: Lahiri (Chitrapaksha). Sunrise/sunset: Thiruvananthapuram, IST.
// Dates whose sankranti falls within a few minutes of the cut-off may differ by a day
// from printed panchangams.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const LAT = 8.5241;  // Thiruvananthapuram
const LON = 76.9366;
const IST_MIN = 330; // UTC+5:30
const DAY_MS = 86400000;
const DELTA_T_DAYS = 69 / 86400; // TT − UT, close enough for this century

export const MONTHS_EN = [
  'Chingam', 'Kanni', 'Thulam', 'Vrischikam', 'Dhanu', 'Makaram',
  'Kumbham', 'Meenam', 'Medam', 'Edavam', 'Mithunam', 'Karkidakam',
];
export const MONTHS_ML = [
  'ചിങ്ങം', 'കന്നി', 'തുലാം', 'വൃശ്ചികം', 'ധനു', 'മകരം',
  'കുംഭം', 'മീനം', 'മേടം', 'ഇടവം', 'മിഥുനം', 'കർക്കടകം',
];

const norm360 = (x) => ((x % 360) + 360) % 360;

// Julian centuries since J2000.0 (TT) for a UTC timestamp
const centuries = (msUTC) => (msUTC / DAY_MS + 2440587.5 + DELTA_T_DAYS - 2451545) / 36525;

// Lahiri ayanamsa (mean), ~50.29"/yr from 23°51'11" at J2000
const ayanamsa = (T) => 23.85306 + 1.396971 * T + 0.000308 * T * T;

function sun(msUTC) {
  const T = centuries(msUTC);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * D2R;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * D2R;
  const trueLon = L0 + C;
  const apparentLon = trueLon - 0.00569 - 0.00478 * Math.sin(omega);
  const eps = (23.439291 - 0.0130042 * T + 0.00256 * Math.cos(omega)) * D2R;

  // Equation of time in minutes (NOAA approximation)
  const y = Math.tan(eps / 2) ** 2;
  const e = 0.016708634 - 0.000042037 * T;
  const L0r = norm360(L0) * D2R;
  const eqTime =
    4 * R2D *
    (y * Math.sin(2 * L0r) -
      2 * e * Math.sin(M) +
      4 * e * y * Math.sin(M) * Math.cos(2 * L0r) -
      0.5 * y * y * Math.sin(4 * L0r) -
      1.25 * e * e * Math.sin(2 * M));

  return {
    sidereal: norm360(trueLon - 0.00569 - ayanamsa(T)),
    decl: Math.asin(Math.sin(eps) * Math.sin(apparentLon * D2R)),
    eqTime,
  };
}

// Sunrise and sunset (UTC timestamps) for a civil (IST) day, given as days since 1970-01-01
function sunTimes(dayNum) {
  const midnightIST = dayNum * DAY_MS - IST_MIN * 60000;
  const { decl, eqTime } = sun(midnightIST + 12 * 3600000);
  const noonMin = 720 - 4 * LON - eqTime + IST_MIN; // minutes after IST midnight
  const cosH =
    (Math.sin(-0.833 * D2R) - Math.sin(LAT * D2R) * Math.sin(decl)) /
    (Math.cos(LAT * D2R) * Math.cos(decl));
  const halfDayMin = 4 * Math.acos(cosH) * R2D;
  return {
    sunrise: midnightIST + (noonMin - halfDayMin) * 60000,
    sunset: midnightIST + (noonMin + halfDayMin) * 60000,
  };
}

// UTC timestamp of the 3/5-daytime mark for a civil (IST) day
function cutoffMs(dayNum) {
  const { sunrise, sunset } = sunTimes(dayNum);
  return sunrise + 0.6 * (sunset - sunrise);
}

// Meeus table 47.A: multiples of D, M, M', F and the sine coefficient (1e-6 degree)
// for the Moon's longitude
const MOON_LON_TERMS = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390], [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700],
  [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381],
  [1, 1, 1, 0, 351], [3, 0, -2, 0, -340], [4, 0, -3, 0, 330], [2, -1, 2, 0, 327],
  [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
];

// Geocentric tropical longitude of the Moon in degrees (Meeus ch. 47)
export function moonLongitude(msUTC) {
  const T = centuries(msUTC);
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000) * D2R;
  const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000) * D2R;
  const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000) * D2R;
  const F = (93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000) * D2R;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const A1 = (119.75 + 131.849 * T) * D2R;
  const A2 = (53.09 + 479264.29 * T) * D2R;

  let sum = 0;
  for (const [d, m, mp, f, coeff] of MOON_LON_TERMS) {
    const eFactor = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sum += coeff * eFactor * Math.sin(d * D + m * M + mp * Mp + f * F);
  }
  sum += 3958 * Math.sin(A1) + 1962 * Math.sin(Lp * D2R - F) + 318 * Math.sin(A2);

  return norm360(Lp + sum / 1e6);
}

const moonSidereal = (msUTC) => norm360(moonLongitude(msUTC) - ayanamsa(centuries(msUTC)));

const signCache = new Map();
function signOn(dayNum) {
  let s = signCache.get(dayNum);
  if (s === undefined) {
    s = Math.floor(sun(cutoffMs(dayNum)).sidereal / 30);
    signCache.set(dayNum, s);
  }
  return s;
}

export const toDayNum = (date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
export const fromDayNum = (n) => {
  const d = new Date(n * DAY_MS);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const resultCache = new Map();

/**
 * Malayalam Era date for a local calendar date.
 * @returns {{ year, month, day, monthLength, monthStart: Date, nextMonthStart: Date, nextMonth }}
 *   month / nextMonth are indexes into MONTHS_EN / MONTHS_ML (0 = Chingam).
 */
export function toMalayalamDate(date) {
  const n = toDayNum(date);
  const cached = resultCache.get(n);
  if (cached) return cached;

  const sign = signOn(n);
  let start = n;
  while (signOn(start - 1) === sign) start--;
  let next = n + 1;
  while (signOn(next) === sign) next++;

  const month = (sign + 8) % 12; // Simha (sign 4) → Chingam (0)
  const gMonth = date.getMonth();
  // Year turns over on Chingam 1 (mid-August)
  const afterNewYear = gMonth > 7 || (gMonth === 7 && month !== 11);
  const year = date.getFullYear() - (afterNewYear ? 824 : 825);

  const result = {
    year,
    month,
    day: n - start + 1,
    monthLength: next - start,
    monthStart: fromDayNum(start),
    nextMonthStart: fromDayNum(next),
    nextMonth: (month + 1) % 12,
  };
  resultCache.set(n, result);
  return result;
}

export const monthName = (index, lang) => (lang === 'mal' ? MONTHS_ML : MONTHS_EN)[index];

// ── Nakshatram ──────────────────────────────────────────

export const NAKSHATRAS_EN = [
  'Ashwathi', 'Bharani', 'Karthika', 'Rohini', 'Makayiram', 'Thiruvathira', 'Punartham',
  'Pooyam', 'Ayilyam', 'Makam', 'Pooram', 'Uthram', 'Atham', 'Chithira', 'Chothi',
  'Vishakham', 'Anizham', 'Thrikketta', 'Moolam', 'Pooradam', 'Uthradam', 'Thiruvonam',
  'Avittam', 'Chathayam', 'Pooruruttathi', 'Uthrattathi', 'Revathi',
];
export const NAKSHATRAS_ML = [
  'അശ്വതി', 'ഭരണി', 'കാർത്തിക', 'രോഹിണി', 'മകയിരം', 'തിരുവാതിര', 'പുണർതം',
  'പൂയം', 'ആയില്യം', 'മകം', 'പൂരം', 'ഉത്രം', 'അത്തം', 'ചിത്തിര', 'ചോതി',
  'വിശാഖം', 'അനിഴം', 'തൃക്കേട്ട', 'മൂലം', 'പൂരാടം', 'ഉത്രാടം', 'തിരുവോണം',
  'അവിട്ടം', 'ചതയം', 'പൂരുരുട്ടാതി', 'ഉത്രട്ടാതി', 'രേവതി',
];
const NAK_SPAN = 360 / 27;

export const nakshatraName = (index, lang) => (lang === 'mal' ? NAKSHATRAS_ML : NAKSHATRAS_EN)[index];

// When the Moon's sidereal longitude next reaches `target` degrees after `fromMs` (Newton steps)
function moonReaches(target, fromMs) {
  let t = fromMs;
  for (let i = 0; i < 6; i++) {
    const lon = moonSidereal(t);
    const ahead = norm360(target - lon);
    const remaining = ahead > 359 ? ahead - 360 : ahead; // overshoot by a hair → step back
    const speed = norm360(moonSidereal(t + 3600000) - lon) * 24; // degrees per day
    t += (remaining / speed) * DAY_MS;
    if (Math.abs(remaining) < 1e-6) break;
  }
  return t;
}

const nakCache = new Map();

/**
 * Nakshatram for a local calendar date, Kerala style: the one prevailing at sunrise.
 * @returns {{ index, next, endsAt: Date, sunrise: Date }} index / next are 0-based (0 = Ashwathi).
 */
export function nakshatraOn(date) {
  const n = toDayNum(date);
  const cached = nakCache.get(n);
  if (cached) return cached;

  const { sunrise } = sunTimes(n);
  const index = Math.floor(moonSidereal(sunrise) / NAK_SPAN);
  const endsAt = moonReaches(((index + 1) % 27) * NAK_SPAN, sunrise);

  const result = { index, next: (index + 1) % 27, endsAt: new Date(endsAt), sunrise: new Date(sunrise) };
  nakCache.set(n, result);
  return result;
}

// Step a Malayalam month by `delta` months; the year turns over at Chingam (index 0).
export function addMalMonths({ year, month }, delta) {
  const ord = year * 12 + month + delta;
  const y = Math.floor(ord / 12);
  return { year: y, month: ord - y * 12 };
}

/** Gregorian date of day 1 of a Malayalam month (month: 0 = Chingam). */
export function malMonthStart(year, month) {
  const target = year * 12 + month;
  // Chingam 1 is ~17 Aug of (ME year + 824); months average ~30.44 days
  let probe = new Date(year + 824, 7, 17 + Math.round(month * 30.44));
  for (let i = 0; i < 4; i++) {
    const r = toMalayalamDate(probe);
    const ord = r.year * 12 + r.month;
    if (ord === target) return r.monthStart;
    probe = ord < target
      ? r.nextMonthStart
      : new Date(r.monthStart.getFullYear(), r.monthStart.getMonth(), r.monthStart.getDate() - 1);
  }
  throw new Error(`Could not locate Malayalam month ${year}/${month}`);
}

// ── Rahu Kalam, Gulika Kalam, Yamakandakam ──────────────
// Daytime (sunrise → sunset) is split into 8 equal parts; each period occupies one part,
// fixed per weekday. Indexes below are 0-based parts for Sunday … Saturday.
const RAHU_PART = [7, 1, 6, 4, 5, 3, 2];
const GULIKA_PART = [6, 5, 4, 3, 2, 1, 0];
const YAMA_PART = [4, 3, 2, 1, 0, 6, 5];

/**
 * Sunrise, sunset and the inauspicious periods of a local calendar date (Thiruvananthapuram).
 * @returns {{ sunrise: Date, sunset: Date, rahu, gulika, yama }} each period is { start: Date, end: Date }.
 */
export function dayPeriods(date) {
  const { sunrise, sunset } = sunTimes(toDayNum(date));
  const part = (sunset - sunrise) / 8;
  const weekday = date.getDay();
  const period = (i) => ({ start: new Date(sunrise + i * part), end: new Date(sunrise + (i + 1) * part) });
  return {
    sunrise: new Date(sunrise),
    sunset: new Date(sunset),
    rahu: period(RAHU_PART[weekday]),
    gulika: period(GULIKA_PART[weekday]),
    yama: period(YAMA_PART[weekday]),
  };
}

// ── Tithi and Hindu lunar (amanta) months ───────────────
// Tithi = Moon–Sun elongation / 12°, 30 per lunar month:
// 0–14 Shukla Prathama … Pournami, 15–29 Krishna Prathama … Amavasya.
// An amanta month runs new moon → new moon and is named after the sidereal sign the Sun
// enters during it (Mesha → Chaitra … Meena → Phalguna); a month with no sign change is adhika.

export const LUNAR_MONTHS = [
  'Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada',
  'Ashwina', 'Kartika', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna',
];
export const TITHIS_EN = [
  'Prathama', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami',
  'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Pournami',
  'Prathama', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami',
  'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Amavasya',
];

const SYNODIC_DAYS = 29.530588;

// Moon–Sun elongation in degrees (0 = new moon, 180 = full moon)
export const elongation = (msUTC) => norm360(moonSidereal(msUTC) - sun(msUTC).sidereal);

export const tithiAt = (msUTC) => Math.floor(elongation(msUTC) / 12);

// Sun's sidereal (Lahiri) longitude in degrees
export const sunSidereal = (msUTC) => sun(msUTC).sidereal;

// Instant of the new moon nearest to `guessMs`
function refineNewMoon(guessMs) {
  let t = guessMs;
  for (let i = 0; i < 8; i++) {
    let e = elongation(t);
    if (e > 180) e -= 360;
    t -= (e / (360 / SYNODIC_DAYS)) * DAY_MS;
    if (Math.abs(e) < 1e-6) break;
  }
  return t;
}

const lunationCache = new Map();

/**
 * Amanta lunar months overlapping a Gregorian year (with a margin either side).
 * @returns {Array<{ start: number, end: number, month: number, adhika: boolean }>}
 *   start/end are UTC ms of the bounding new moons; month indexes LUNAR_MONTHS.
 */
export function lunarMonthsForYear(year) {
  const cached = lunationCache.get(year);
  if (cached) return cached;

  const from = Date.UTC(year - 1, 10, 1);
  const to = Date.UTC(year + 1, 2, 1);
  let nm = refineNewMoon(from - (elongation(from) / 360) * SYNODIC_DAYS * DAY_MS);
  const moons = [nm];
  while (nm < to) {
    nm = refineNewMoon(nm + SYNODIC_DAYS * DAY_MS);
    moons.push(nm);
  }

  const months = [];
  for (let i = 0; i < moons.length - 1; i++) {
    const startSign = Math.floor(sun(moons[i]).sidereal / 30);
    const endSign = Math.floor(sun(moons[i + 1]).sidereal / 30);
    const adhika = startSign === endSign;
    // Named after the sign entered during the month; an adhika month borrows the next month's name
    const month = adhika ? (startSign + 1) % 12 : endSign % 12;
    months.push({ start: moons[i], end: moons[i + 1], month, adhika });
  }
  lunationCache.set(year, months);
  return months;
}

// IST civil day (days since epoch) containing a UTC instant
export const istDayOf = (msUTC) => Math.floor((msUTC + IST_MIN * 60000) / DAY_MS);

/**
 * Key instants of a civil (IST) day, for deciding which tithi a festival is observed in.
 * sunrise; noon (midday between sunrise and sunset); sunset; midnight (middle of the following night).
 */
export function dayInstants(dayNum) {
  const { sunrise, sunset } = sunTimes(dayNum);
  const nextSunrise = sunTimes(dayNum + 1).sunrise;
  return {
    sunrise,
    noon: (sunrise + sunset) / 2,
    sunset,
    midnight: (sunset + nextSunrise) / 2,
  };
}

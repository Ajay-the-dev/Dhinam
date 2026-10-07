// Festival date engine: turns the rule-based definitions in src/data/festivals.json into
// concrete dates, applying yearly official dates from src/data/festival-overrides.json.
// No UI code here.

import festivalData from '@/data/festivals.json';
import overrides from '@/data/festival-overrides.json';
import {
  MONTHS_EN, MONTHS_ML, NAKSHATRAS_EN, NAKSHATRAS_ML, LUNAR_MONTHS,
  toMalayalamDate, malMonthStart, nakshatraOn, tithiAt, dayInstants, lunarMonthsForYear, sunSidereal,
  istDayOf, toDayNum, fromDayNum,
} from '@/lib/malayalam.js';

export const CATEGORIES = festivalData.categories;
export const FESTIVALS = festivalData.festivals;

const byId = new Map(FESTIVALS.map((f) => [f.id, f]));
const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
export const categoryOf = (id) => categoryById.get(id);
export const festivalById = (id) => byId.get(id);

const IMPORTANCE_RANK = { very_high: 0, high: 1, medium: 2, low: 3 };

// ── Rule vocabulary ─────────────────────────────────────

const LUNAR_MONTHS_ML = [
  'ചൈത്രം', 'വൈശാഖം', 'ജ്യേഷ്ഠം', 'ആഷാഢം', 'ശ്രാവണം', 'ഭാദ്രപദം',
  'ആശ്വിനം', 'കാർത്തികം', 'മാർഗശീർഷം', 'പൗഷം', 'മാഘം', 'ഫാൽഗുനം',
];
const TITHI_BASE = [
  'prathama', 'dwitiya', 'tritiya', 'chaturthi', 'panchami', 'shashthi', 'saptami',
  'ashtami', 'navami', 'dashami', 'ekadashi', 'dwadashi', 'trayodashi', 'chaturdashi',
];
const TITHI_BASE_EN = [
  'Prathama', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami',
  'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi',
];
const TITHI_BASE_ML = [
  'പ്രഥമ', 'ദ്വിതീയ', 'തൃതീയ', 'ചതുർഥി', 'പഞ്ചമി', 'ഷഷ്ഠി', 'സപ്തമി',
  'അഷ്ടമി', 'നവമി', 'ദശമി', 'ഏകാദശി', 'ദ്വാദശി', 'ത്രയോദശി', 'ചതുർദശി',
];
const HIJRI_MONTHS = {
  muharram: 1, safar: 2, 'rabi al-awwal': 3, 'rabi al-thani': 4, 'jumada al-awwal': 5,
  'jumada al-thani': 6, rajab: 7, shaban: 8, ramadan: 9, shawwal: 10, 'dhul qadah': 11, 'dhul hijjah': 12,
};
const HIJRI_MONTHS_ML = {
  1: 'മുഹറം', 3: 'റബീഉൽ അവ്വൽ', 9: 'റമദാൻ', 10: 'ശവ്വാൽ', 12: 'ദുൽ ഹിജ്ജ',
};

const norm = (s) => s.toLowerCase().replace(/ekadasi/, 'ekadashi').trim();
const malMonthIndex = (name) => MONTHS_EN.findIndex((m) => m.toLowerCase() === norm(name));
const lunarMonthIndex = (name) => LUNAR_MONTHS.findIndex((m) => m.toLowerCase() === norm(name));
const nakIndex = (name) => {
  const n = norm(name).replace('vishakam', 'vishakham');
  return NAKSHATRAS_EN.findIndex((x) => x.toLowerCase() === n);
};

// "Krishna Chaturdashi" → 28, "Amavasya" → 29, "Shukla Navami" → 8; bare names use `paksha`
function tithiIndex(name, paksha = 'Shukla') {
  const parts = norm(name).split(/\s+/);
  const base = parts[parts.length - 1];
  if (base === 'amavasya') return 29;
  if (base === 'pournami' || base === 'purnima') return 14;
  const p = parts.length > 1 ? parts[0] : norm(paksha);
  const i = TITHI_BASE.indexOf(base);
  if (i < 0) throw new Error(`Unknown tithi "${name}"`);
  return (p === 'krishna' ? 15 : 0) + i;
}

// ── Date helpers (day numbers = days since 1970-01-01 of the civil date) ──

const DAY_MS = 86400000;
const ymdToDayNum = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
};
const yearOfDayNum = (n) => new Date(n * DAY_MS).getUTCFullYear();

function malMonthDays(meYear, month) {
  const start = toDayNum(malMonthStart(meYear, month));
  return { start, end: start + toMalayalamDate(fromDayNum(start)).monthLength - 1 };
}

function easterDayNum(y) {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher)
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Math.floor(Date.UTC(y, month - 1, day) / DAY_MS);
}

const hijriFormat = (() => {
  for (const ca of ['islamic-umalqura', 'islamic-civil', 'islamic']) {
    try {
      const fmt = new Intl.DateTimeFormat(`en-u-ca-${ca}`, { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
      if (fmt.resolvedOptions().calendar.startsWith('islamic')) return fmt;
    } catch {
      // try the next calendar
    }
  }
  return null;
})();

const hijriCache = new Map();
function hijriOf(dayNum) {
  let h = hijriCache.get(dayNum);
  if (!h && hijriFormat) {
    const parts = Object.fromEntries(hijriFormat.formatToParts(new Date(dayNum * DAY_MS)).map((p) => [p.type, p.value]));
    h = { month: Number(parts.month), day: Number(parts.day) };
    hijriCache.set(dayNum, h);
  }
  return h;
}

const tithiOnDay = (dayNum, observe = 'sunrise') => tithiAt(dayInstants(dayNum)[observe]);

// ── Rule evaluation ─────────────────────────────────────
// Each rule yields occurrences { start, end } (day numbers) within a window around `year`.

function windowFor(year) {
  return { from: Math.floor(Date.UTC(year, 0, 1) / DAY_MS) - 45, to: Math.floor(Date.UTC(year, 11, 31) / DAY_MS) + 45 };
}

const meYearsFor = (year) => [year - 826, year - 825, year - 824, year - 823];

// First day in [from, to] whose tithi at `observe` is `target`. `bounds` (UTC ms) limits the
// instants considered to one lunar month, since its first/last civil days straddle the next.
function findTithiInDays(from, to, target, observe, preferNak, bounds) {
  const inBounds = (d, when) => {
    const t = dayInstants(d)[when];
    return !bounds || (t >= bounds.start && t < bounds.end);
  };
  let first = null;
  for (let d = from; d <= to; d++) {
    if (!inBounds(d, observe) || tithiOnDay(d, observe) !== target) continue;
    if (preferNak == null || nakshatraOn(fromDayNum(d)).index === preferNak) return d;
    first ??= d;
  }
  if (first != null) return first;
  // The tithi may skip the observance instant on every day (kshaya); take the day it falls in
  for (let d = from; d <= to; d++) {
    if (inBounds(d, 'sunset') && tithiOnDay(d, 'sunset') === target) return d;
  }
  return null;
}

function evaluate(def, year, resolve) {
  const r = def.date_rule;
  const out = [];
  const point = (d) => out.push({ start: d, end: d });

  switch (r.type) {
    case 'gregorian_fixed':
      for (const y of [year - 1, year, year + 1]) point(Math.floor(Date.UTC(y, r.month - 1, r.day) / DAY_MS));
      break;

    case 'gregorian_calculation': // western_easter
      for (const y of [year - 1, year, year + 1]) point(easterDayNum(y));
      break;

    case 'easter_relative':
      for (const y of [year - 1, year, year + 1]) point(easterDayNum(y) - r.days_before_easter);
      break;

    case 'malayalam_calendar': {
      const m = malMonthIndex(r.month);
      for (const me of meYearsFor(year)) {
        const { start, end } = malMonthDays(me, m);
        if (r.observe === 'first_sunrise_in_sign') {
          // Vishu: the first sunrise after the Sun enters the month's sign (may be Medam 2)
          const sign = (m + 4) % 12;
          let d = start - 1;
          while (Math.floor(sunSidereal(dayInstants(d).sunrise) / 30) !== sign) d++;
          point(d);
        } else if (r.day) point(start + r.day - 1);
        else out.push({ start, end, kind: 'month' }); // month known, day not
      }
      break;
    }

    case 'nakshatra':
    case 'lunar_nakshatra': {
      const target = nakIndex(r.nakshatra);
      if (r.relative_to) {
        // e.g. Atham: the Atham day in the run-up to Thiruvonam
        for (const base of resolve(r.relative_to)) {
          const step = r.direction === 'after' ? 1 : -1;
          for (let i = 1; i <= 15; i++) {
            const d = base.start + step * i;
            if (nakshatraOn(fromDayNum(d)).index === target) { point(d); break; }
          }
        }
        break;
      }
      const m = malMonthIndex(r.month);
      for (const me of meYearsFor(year)) {
        const { start, end } = malMonthDays(me, m);
        for (let d = start; d <= end; d++) {
          if (nakshatraOn(fromDayNum(d)).index === target) { point(d); break; }
        }
      }
      break;
    }

    case 'lunar':
    case 'ekadashi': {
      const target = r.type === 'ekadashi' ? tithiIndex('Ekadashi', r.paksha) : tithiIndex(r.tithi, r.paksha);
      const observe = r.observe || 'sunrise';
      const prefer = r.nakshatra_preference ? nakIndex(r.nakshatra_preference) : null;
      const malM = malMonthIndex(r.month);
      if (malM >= 0) {
        for (const me of meYearsFor(year)) {
          const { start, end } = malMonthDays(me, malM);
          const d = findTithiInDays(start, end, target, observe, prefer);
          if (d != null) point(d);
        }
      } else {
        const lunarM = lunarMonthIndex(r.month);
        for (const lm of lunarMonthsForYear(year)) {
          if (lm.month !== lunarM || lm.adhika) continue;
          const d = findTithiInDays(istDayOf(lm.start), istDayOf(lm.end), target, observe, prefer, lm);
          if (d != null) point(d);
        }
      }
      if (r.range_days) for (const o of out) o.end = o.start + r.range_days - 1;
      break;
    }

    case 'islamic': {
      const month = HIJRI_MONTHS[norm(r.month)];
      const { from, to } = windowFor(year);
      for (let d = from; d <= to; d++) {
        const h = hijriOf(d);
        if (h && h.month === month && h.day === r.day) point(d);
      }
      break;
    }

    case 'range': {
      const [monthName, day] = r.start.split(' ');
      for (const me of meYearsFor(year)) {
        const start = malMonthDays(me, malMonthIndex(monthName)).start + Number(day) - 1;
        out.push({ start, end: start + r.duration_days - 1 });
      }
      break;
    }

    case 'season':
      for (const me of meYearsFor(year)) {
        out.push({
          start: malMonthDays(me, malMonthIndex(r.start_month)).start,
          end: malMonthDays(me, malMonthIndex(r.end_month)).end,
        });
      }
      break;

    case 'onam_related':
      for (const base of resolve(r.relative_to)) point(base.start + (r.offset_days || 0));
      break;

    default:
      // temple_calendar, annual_event, … — dates come only from festival-overrides.json
      if (r.same_as) for (const o of resolve(r.same_as)) point(o.start);
  }

  if (r.type === 'navaratri' || r.type === 'vijayadashami') {
    out.length = 0;
    for (const o of resolve(r.same_as)) point(o.start);
  }

  // A range that ends on this rule's date and starts at another festival (Onam: Atham → Thiruvonam)
  if (r.range_from) {
    const starts = resolve(r.range_from);
    for (const o of out) {
      const s = starts.filter((x) => x.start <= o.end && o.end - x.start <= 15).pop();
      if (s) o.start = s.start;
    }
  }
  return out;
}

// Official yearly dates replace calculated ones falling in the same Gregorian year
function applyOverrides(id, occurrences) {
  const result = [...occurrences];
  for (const [yearKey, dates] of Object.entries(overrides)) {
    if (yearKey.startsWith('$') || !dates[id]) continue;
    const y = Number(yearKey);
    const official = ymdToDayNum(dates[id]);
    const idx = result.findIndex((o) => yearOfDayNum(o.end) === y);
    if (idx >= 0) {
      const o = result[idx];
      // keep a range's length; move its end (the main day) to the official date
      result[idx] = { ...o, start: official - (o.end - o.start), end: official, source: 'override' };
    } else {
      result.push({ start: official, end: official, source: 'override' });
    }
  }
  return result;
}

const yearCache = new Map();

/** All festival occurrences whose span touches the given Gregorian year. */
export function festivalsForYear(year) {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const memo = new Map();
  const resolve = (id) => {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, []); // guard against cycles
    const def = byId.get(id);
    const occ = def ? applyOverrides(id, evaluate(def, year, resolve)) : [];
    memo.set(id, occ);
    return occ;
  };

  const yStart = Math.floor(Date.UTC(year, 0, 1) / DAY_MS);
  const yEnd = Math.floor(Date.UTC(year, 11, 31) / DAY_MS);
  const list = [];
  for (const def of FESTIVALS) {
    for (const o of resolve(def.id)) {
      if (o.end < yStart || o.start > yEnd) continue;
      const kind = o.kind || (o.end > o.start ? 'range' : 'day');
      list.push({
        key: `${def.id}:${o.start}`,
        id: def.id,
        def,
        category: categoryById.get(def.category),
        start: o.start,
        end: o.end,
        kind,
        source: o.source || 'calculated',
      });
    }
  }
  // de-duplicate (windows overlap across years)
  const unique = [...new Map(list.map((o) => [o.key, o])).values()];
  unique.sort((a, b) => a.start - b.start || IMPORTANCE_RANK[a.def.importance] - IMPORTANCE_RANK[b.def.importance]);
  yearCache.set(year, unique);
  return unique;
}

const yearsAround = (dayNum) => {
  const y = yearOfDayNum(dayNum);
  return [...new Set([y - 1, y, y + 1])];
};

const sortByImportance = (a, b) => IMPORTANCE_RANK[a.def.importance] - IMPORTANCE_RANK[b.def.importance];

/** Single-day festivals on a date, most important first. */
export function festivalsOn(date) {
  const n = toDayNum(date);
  return festivalsForYear(yearOfDayNum(n)).filter((o) => o.kind === 'day' && o.start === n).sort(sortByImportance);
}

/** Multi-day festivals, seasons and month-long events in progress on a date. */
export function ongoingOn(date) {
  const n = toDayNum(date);
  const seen = new Set();
  const out = [];
  for (const y of yearsAround(n)) {
    for (const o of festivalsForYear(y)) {
      if (o.kind !== 'day' && o.start <= n && o.end >= n && !seen.has(o.key)) {
        seen.add(o.key);
        out.push(o);
      }
    }
  }
  return out.sort(sortByImportance);
}

/** The next `count` single-day festivals on or after a date. */
export function upcomingFrom(date, count = 5) {
  const n = toDayNum(date);
  const y = yearOfDayNum(n);
  return [...festivalsForYear(y), ...festivalsForYear(y + 1)]
    .filter((o) => o.kind === 'day' && o.start >= n)
    .filter((o, i, arr) => arr.findIndex((x) => x.key === o.key) === i)
    .slice(0, count);
}

export const occurrenceDate = (o, which = 'start') => fromDayNum(o[which]);

// ── Presentation helpers (text only) ────────────────────

export const festivalName = (def, lang) => (lang === 'mal' ? def.name_ml : def.name_en);
export const categoryName = (cat, lang) => (lang === 'mal' ? cat.name_ml : cat.name_en);

/** Whether a date is calculated (and so may differ regionally) rather than fixed or official. */
export function dateNote(o, lang) {
  const ml = lang === 'mal';
  if (o.source === 'override') return ml ? 'ഈ വർഷത്തെ ഔദ്യോഗിക തീയതി.' : 'Official date configured for this year.';
  const t = o.def.date_rule.type;
  if (['gregorian_fixed', 'gregorian_calculation', 'easter_relative'].includes(t)) return '';
  if (t === 'islamic') {
    return ml
      ? 'ഉമ്മുൽ ഖുറാ കലണ്ടർ പ്രകാരം; ചന്ദ്രദർശനമനുസരിച്ച് ഒരു ദിവസം മാറാം.'
      : `${o.def.date_note || 'May vary by moon sighting.'} Calculated with the Umm al-Qura calendar.`;
  }
  const base = ml
    ? 'തിരുവനന്തപുരത്തേക്ക് കണക്കാക്കിയത്; പ്രാദേശിക/ക്ഷേത്ര കലണ്ടറുകളിൽ ഒരു ദിവസം വ്യത്യാസമുണ്ടാകാം.'
    : 'Calculated for Thiruvananthapuram; regional and temple calendars may differ by a day.';
  return !ml && o.def.date_note ? `${o.def.date_note} ${base}` : base;
}

const tithiLabel = (index, lang) => {
  const ml = lang === 'mal';
  if (index === 29) return ml ? 'അമാവാസി' : 'Amavasya';
  if (index === 14) return ml ? 'പൗർണമി' : 'Pournami';
  const paksha = index < 15 ? (ml ? 'ശുക്ലപക്ഷ' : 'Shukla') : (ml ? 'കൃഷ്ണപക്ഷ' : 'Krishna');
  return `${paksha} ${(ml ? TITHI_BASE_ML : TITHI_BASE_EN)[index % 15]}`;
};

/** Plain-language description of how a festival's date is determined. */
export function describeRule(def, lang) {
  const ml = lang === 'mal';
  const r = def.date_rule;
  const malMonth = (name) => (ml ? MONTHS_ML : MONTHS_EN)[malMonthIndex(name)];
  const nak = (name) => (ml ? NAKSHATRAS_ML : NAKSHATRAS_EN)[nakIndex(name)];
  const ref = (id) => (ml ? byId.get(id)?.name_ml : byId.get(id)?.name_en) ?? id;
  const when = { noon: ml ? 'ഉച്ചയ്ക്ക്' : 'at midday', sunset: ml ? 'സന്ധ്യയ്ക്ക്' : 'at sunset', midnight: ml ? 'അർധരാത്രിയിൽ' : 'at midnight' }[r.observe];

  switch (r.type) {
    case 'gregorian_fixed': {
      const d = new Date(2000, r.month - 1, r.day).toLocaleDateString(ml ? 'ml' : 'en-GB', { day: 'numeric', month: 'long' });
      return ml ? `എല്ലാ വർഷവും ${d}` : `Every year on ${d}`;
    }
    case 'gregorian_calculation':
      return ml ? 'ഈസ്റ്റർ ഞായർ (പാശ്ചാത്യ കണക്ക്)' : 'Easter Sunday (Western computus)';
    case 'easter_relative':
      return ml ? `ഈസ്റ്ററിന് ${r.days_before_easter} ദിവസം മുമ്പ്` : `${r.days_before_easter} days before Easter`;
    case 'malayalam_calendar':
      if (r.observe === 'first_sunrise_in_sign') {
        return ml ? `സൂര്യൻ ${malMonth(r.month)} രാശിയിൽ പ്രവേശിച്ച ശേഷമുള്ള ആദ്യ സൂര്യോദയം` : `First sunrise after the Sun enters ${malMonth(r.month)} (Mesha)`;
      }
      return r.day
        ? (ml ? `${malMonth(r.month)} ${r.day} (മലയാള മാസം)` : `${malMonth(r.month)} ${r.day} (Malayalam calendar)`)
        : (ml ? `${malMonth(r.month)} മാസത്തിൽ; തീയതി പ്രാദേശികമായി നിശ്ചയിക്കുന്നു` : `During ${malMonth(r.month)}; exact day set locally`);
    case 'nakshatra':
    case 'lunar_nakshatra':
      if (r.relative_to) {
        const dir = r.direction === 'after' ? (ml ? 'ശേഷമുള്ള' : 'after') : (ml ? 'മുമ്പുള്ള' : 'before');
        return ml ? `${ref(r.relative_to)}ത്തിന് ${dir} ${nak(r.nakshatra)} നക്ഷത്രം` : `${nak(r.nakshatra)} nakshatram ${dir} ${ref(r.relative_to)}`;
      }
      return ml ? `${malMonth(r.month)} മാസത്തിലെ ${nak(r.nakshatra)} നക്ഷത്രം` : `${nak(r.nakshatra)} nakshatram in ${malMonth(r.month)}`;
    case 'lunar':
    case 'ekadashi': {
      const t = tithiLabel(r.type === 'ekadashi' ? tithiIndex('Ekadashi', r.paksha) : tithiIndex(r.tithi, r.paksha), lang);
      const isMal = malMonthIndex(r.month) >= 0;
      const month = isMal ? malMonth(r.month) : (ml ? LUNAR_MONTHS_ML : LUNAR_MONTHS)[lunarMonthIndex(r.month)];
      let text = ml ? `${month} മാസത്തിലെ ${t}` : `${t} in ${month}${isMal ? '' : ' (lunar month)'}`;
      if (when) text += ml ? ` (${when})` : ` (${when})`;
      if (r.nakshatra_preference) text += ml ? `, ${nak(r.nakshatra_preference)} നക്ഷത്രത്തോടെ` : `, preferring ${nak(r.nakshatra_preference)} nakshatram`;
      if (r.range_days) text += ml ? ` മുതൽ ${r.range_days} ദിവസം` : `, for ${r.range_days} days`;
      return text;
    }
    case 'islamic': {
      const m = HIJRI_MONTHS[norm(r.month)];
      return ml ? `ഹിജ്റ ${HIJRI_MONTHS_ML[m] ?? r.month} ${r.day}` : `${r.day} ${r.month} (Hijri)`;
    }
    case 'range': {
      const [m, d] = r.start.split(' ');
      return ml ? `${malMonth(m)} ${d} മുതൽ ${r.duration_days} ദിവസം` : `${r.duration_days} days from ${malMonth(m)} ${d}`;
    }
    case 'season':
      return ml ? `${malMonth(r.start_month)} മുതൽ ${malMonth(r.end_month)} വരെ` : `${malMonth(r.start_month)} to ${malMonth(r.end_month)}`;
    case 'onam_related':
      return ml ? `${ref(r.relative_to)}ത്തിന് ${r.offset_days} ദിവസം ശേഷം (സാധാരണയായി)` : `Usually ${r.offset_days} days after ${ref(r.relative_to)}`;
    default:
      if (r.same_as) return ml ? `${ref(r.same_as)} ദിവസം` : `Same day as ${ref(r.same_as)}`;
      return ml ? 'ഓരോ വർഷവും ക്ഷേത്രം/സംഘാടകർ പ്രഖ്യാപിക്കുന്നു' : 'Announced each year by the temple or organisers';
  }
}

/** Short tithi label for a day (for details panels). */
export const tithiLabelOn = (date, lang) => tithiLabel(tithiOnDay(toDayNum(date)), lang);

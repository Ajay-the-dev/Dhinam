<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { festivalName, categoryName, occurrenceDate } from '@/lib/festivals.js';
import { useCalendarStore } from '@/stores/calenderStore.js';
import { monthName, MONTHS_EN, MONTHS_ML, nakshatraName, nakshatraNames, dayPeriods, toMalayalamDate } from '@/lib/malayalam.js';
import { useIsDesktop } from '@/composables/useIsDesktop.js';

const store = useCalendarStore();

const isMal = computed(() => store.lang === 'mal');
const locale = computed(() => (isMal.value ? 'ml' : 'default'));

const weekday = computed(() =>
  store.selectedDate.toLocaleDateString(locale.value, { weekday: 'long' })
);
const gregFullDate = computed(() =>
  store.selectedDate.toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
);
const fullDate = computed(() =>
  store.selectedDate.toLocaleDateString(locale.value, { month: 'long', year: 'numeric' })
);

const utcDay = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

// Whole days between today and the selected date (negative = in the past)
const offsetDays = computed(() => Math.round((utcDay(store.selectedDate) - utcDay(store.today)) / 86400000));

const relative = computed(() => {
  const n = offsetDays.value;
  if (isMal.value) {
    if (n === 0) return 'ഇന്ന്';
    if (n === 1) return 'നാളെ';
    if (n === -1) return 'ഇന്നലെ';
    return n > 0 ? `${n} ദിവസം കഴിഞ്ഞ്` : `${-n} ദിവസം മുമ്പ്`;
  }
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
});

const dayOfYear = computed(() => {
  const d = store.selectedDate;
  return Math.round((utcDay(d) - Date.UTC(d.getFullYear(), 0, 1)) / 86400000) + 1;
});

const daysInYear = computed(() => {
  const y = store.selectedDate.getFullYear();
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
});

// ISO-8601 week number
const weekNumber = computed(() => {
  const d = new Date(utcDay(store.selectedDate));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
});


const mal = computed(() => store.selectedMal);
const malMonth = computed(() => monthName(mal.value.month, store.lang));
// The month name in the other script, shown as a secondary label
const malMonthAlt = computed(() => (isMal.value ? MONTHS_EN : MONTHS_ML)[mal.value.month]);
const malProgress = computed(() => Math.round((mal.value.day / mal.value.monthLength) * 100));
const isDesktop = useIsDesktop();
const nextMonthStart = computed(() =>
  mal.value.nextMonthStart.toLocaleDateString(locale.value, {
    day: 'numeric',
    month: isDesktop.value ? 'long' : 'short',
  })
);

// Nakshatram at sunrise; its end time is shown in IST since it's computed for Kerala
const nak = computed(() => store.selectedNak);
// Every star of the day, e.g. "Pooram – Uthram" when Uthram begins before midnight
const nakName = computed(() => nakshatraNames(nak.value, store.lang));
const nakNameAlt = computed(() => nakshatraNames(nak.value, isMal.value ? 'en' : 'mal'));
const endInfo = (end) => {
  const time = end.toLocaleTimeString(locale.value, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const d = store.selectedDate;
  const selectedYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const nextDay = end.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) !== selectedYmd;
  return { time, nextDay };
};
// "Pooram until 21:19 IST, then Uthram": each of the day's stars with its end time, then the last one.
// A one-star day goes on to the star that follows it.
const nakTimeline = (lang) => {
  const stars = [{ index: nak.value.index, endsAt: nak.value.endsAt }, ...nak.value.later];
  if (stars.length === 1) stars.push({ index: nak.value.next });
  return stars
    .map((s, i) => {
      const name = nakshatraName(s.index, lang);
      if (i === stars.length - 1) return name;
      const { time, nextDay } = endInfo(s.endsAt);
      return lang === 'mal'
        ? `${name} ${nextDay ? 'നാളെ ' : ''}${time} IST വരെ`
        : `${name} until ${time} IST${nextDay ? ' (next day)' : ''}`;
    })
    .join(lang === 'mal' ? ', തുടർന്ന് ' : ', then ');
};

const scrollToCalendar = () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('calendar')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

// Rahu Kalam, Gulika Kalam, Yamakandakam for the selected day (IST, Thiruvananthapuram)
const now = ref(Date.now());
let clock;
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 60000);
});
onBeforeUnmount(() => clearInterval(clock));

const formatRange = (start, end) => {
  const fmt = new Intl.DateTimeFormat(locale.value, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return fmt.formatRange ? fmt.formatRange(start, end) : `${fmt.format(start)} – ${fmt.format(end)}`;
};

const periods = computed(() => {
  const p = dayPeriods(store.selectedDate);
  const names = isMal.value
    ? { rahu: 'രാഹുകാലം', gulika: 'ഗുളികകാലം', yama: 'യമകണ്ഠകം' }
    : { rahu: 'Rahu Kalam', gulika: 'Gulika Kalam', yama: 'Yamakandakam' };
  return ['rahu', 'gulika', 'yama'].map((key) => ({
    key,
    name: names[key],
    range: formatRange(p[key].start, p[key].end),
    active: now.value >= p[key].start.getTime() && now.value < p[key].end.getTime(),
  }));
});

// Festivals: the selected day's, ongoing seasons, and the next few
const router = useRouter();
const openDay = (items, key) => store.openFestival(items, key);
const ongoingText = (o) => {
  const n = toDayNumLocal(store.selectedDate) - o.start + 1;
  const total = o.end - o.start + 1;
  return isMal.value ? `${total} ദിവസത്തിൽ ${n}-ാം ദിവസം` : `Day ${n} of ${total}`;
};
const toDayNumLocal = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
const upcomingDate = (o) => occurrenceDate(o).toLocaleDateString(locale.value, { day: 'numeric', month: isDesktop.value ? 'long' : 'short' });

// Select a date and bring the calendar to its month (in the active system)
const showDate = (date) => {
  store.selectDate(date);
  if (store.isInView(date)) return;
  if (store.system === 'mal') {
    const m = toMalayalamDate(date);
    router.push({ name: 'MalCalendar', params: { year: m.year, month: m.month + 1 } });
  } else {
    router.push({ name: 'Calendar', params: { year: date.getFullYear(), month: date.getMonth() + 1 } });
  }
};

// Previous / next day from the hero card
const stepDay = (delta) => {
  const d = store.selectedDate;
  showDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta));
};

// Jump the calendar to an upcoming festival, select it and show its details
const goToFestival = (o) => {
  showDate(occurrenceDate(o));
  store.openFestival([o]);
};

const labels = computed(() =>
  isMal.value
    ? {
        day: 'ദിവസം', week: 'ആഴ്ച',
        malMonth: 'മലയാള മാസം', era: 'കൊല്ലവർഷം', nakshatram: 'നക്ഷത്രം', now: 'ഇപ്പോൾ',
        festivals: 'ആഘോഷങ്ങൾ', toCalendar: 'കലണ്ടർ കാണുക', prevDay: 'മുൻ ദിവസം', nextDay: 'അടുത്ത ദിവസം', upcoming: 'വരാനിരിക്കുന്നവ',
        periodsNote: 'IST · തിരുവനന്തപുരം',
        nakUntil: nakTimeline('mal'),
        dayOf: `${mal.value.day} / ${mal.value.monthLength} ദിവസം`,
        next: `${monthName(mal.value.nextMonth, 'mal')} ആരംഭം: ${nextMonthStart.value}`,
      }
    : {
        day: 'Day', week: 'Week',
        malMonth: 'Malayalam month', era: 'Kollavarsham', nakshatram: 'Nakshatram', now: 'Now',
        festivals: 'Festivals', toCalendar: 'View calendar', prevDay: 'Previous day', nextDay: 'Next day', upcoming: 'Upcoming',
        periodsNote: 'IST · Thiruvananthapuram',
        nakUntil: nakTimeline('en'),
        dayOf: `Day ${mal.value.day} of ${mal.value.monthLength}`,
        next: `${monthName(mal.value.nextMonth, 'en')} begins ${nextMonthStart.value}`,
      }
);
</script>

<template>
  <div class="details">
    <article class="day-card">
      <Transition name="fade" mode="out-in">
        <div :key="store.selectedDate.getTime() + store.lang + store.system" class="day-card-body">
          <span class="relative">{{ relative }}</span>
          <div class="weekday" :class="{ sunday: store.selectedDate.getDay() === 0 }">{{ weekday }}</div>
          <!-- The active calendar system gets the big number; the other one sits below the divider -->
          <template v-if="store.system === 'mal'">
            <div class="num">{{ mal.day }}</div>
            <div class="date">{{ malMonth }} · {{ labels.era }} {{ mal.year }}</div>
            <div class="mal-date">
              <span class="mal-date-main">{{ gregFullDate }}</span>
              <span class="nak-line">★ {{ nakName }}</span>
              <span v-if="store.selectedFestivals.length" class="hero-fests">
                <button
                  v-for="o in store.selectedFestivals"
                  :key="o.key"
                  class="hero-fest"
                  @click="openDay(store.selectedFestivals, o.key)"
                >
                  <i :class="`bi bi-${o.category.icon}`" aria-hidden="true"></i>
                  {{ festivalName(o.def, store.lang) }}
                </button>
              </span>
            </div>
          </template>
          <template v-else>
            <div class="num">{{ store.selectedDate.getDate() }}</div>
            <div class="date">{{ fullDate }}</div>
            <div class="mal-date">
              <span class="mal-date-main">{{ malMonth }} {{ mal.day }}</span>
              <span class="mal-date-era">{{ labels.era }} {{ mal.year }}</span>
              <span class="nak-line">★ {{ nakName }}</span>
              <span v-if="store.selectedFestivals.length" class="hero-fests">
                <button
                  v-for="o in store.selectedFestivals"
                  :key="o.key"
                  class="hero-fest"
                  @click="openDay(store.selectedFestivals, o.key)"
                >
                  <i :class="`bi bi-${o.category.icon}`" aria-hidden="true"></i>
                  {{ festivalName(o.def, store.lang) }}
                </button>
              </span>
            </div>
          </template>

          <ul class="periods">
            <li v-for="p in periods" :key="p.key" class="period" :class="{ active: p.active }">
              <span class="period-name">{{ p.name }}</span>
              <span class="period-time">
                <span v-if="p.active" class="now-badge">{{ labels.now }}</span>
                {{ p.range }}
              </span>
            </li>
          </ul>
          <div class="periods-note">{{ labels.periodsNote }}</div>
        </div>
      </Transition>
      <div class="day-nav">
        <button class="day-step" :aria-label="labels.prevDay" :title="labels.prevDay" @click="stepDay(-1)">
          <i class="bi bi-chevron-left" aria-hidden="true"></i>
        </button>
        <!-- Phones/tablets: the calendar sits below this card -->
        <button class="to-calendar" @click="scrollToCalendar">
          {{ labels.toCalendar }}
          <i class="bi bi-arrow-down" aria-hidden="true"></i>
        </button>
        <button class="day-step" :aria-label="labels.nextDay" :title="labels.nextDay" @click="stepDay(1)">
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </article>

    <!-- One card: nakshatram, Malayalam month, then day-of-year and week side by side -->
    <dl class="info-card">
      <div v-if="store.selectedFestivals.length || store.selectedOngoing.length" class="info-section">
        <dt>{{ labels.festivals }}</dt>
        <dd>
          <ul class="fest-list">
            <li v-for="o in store.selectedFestivals" :key="o.key">
              <button class="fest-item" :style="{ '--cat': `var(--mc-cat-${o.def.category})` }" @click="openDay(store.selectedFestivals, o.key)">
                <i :class="`bi bi-${o.category.icon}`" aria-hidden="true"></i>
                <span class="fest-text">
                  <span class="fest-title">{{ festivalName(o.def, store.lang) }}</span>
                  <span class="fest-sub">{{ categoryName(o.category, store.lang) }}</span>
                </span>
                <i class="bi bi-chevron-right fest-go" aria-hidden="true"></i>
              </button>
            </li>
            <li v-for="o in store.selectedOngoing" :key="o.key">
              <button class="fest-item ongoing" :style="{ '--cat': `var(--mc-cat-${o.def.category})` }" @click="openDay([o])">
                <i :class="`bi bi-${o.category.icon}`" aria-hidden="true"></i>
                <span class="fest-text">
                  <span class="fest-title">{{ festivalName(o.def, store.lang) }}</span>
                  <span class="fest-sub">{{ ongoingText(o) }}</span>
                </span>
                <i class="bi bi-chevron-right fest-go" aria-hidden="true"></i>
              </button>
            </li>
          </ul>
        </dd>
      </div>
      <div class="info-section">
        <dt>{{ labels.nakshatram }}</dt>
        <dd>
          <div class="info-title">{{ nakName }} <small>{{ nakNameAlt }}</small></div>
          <div class="info-note">{{ labels.nakUntil }}</div>
        </dd>
      </div>
      <div class="info-section">
        <dt>{{ labels.malMonth }}</dt>
        <dd>
          <div class="info-title">{{ malMonth }} <small>{{ malMonthAlt }} · {{ mal.year }}</small></div>
          <div class="progress-row">
            <span class="progress" role="progressbar" :aria-valuenow="malProgress" aria-valuemin="0" aria-valuemax="100">
              <span class="bar" :style="{ width: `${malProgress}%` }"></span>
            </span>
            <span class="pct">{{ labels.dayOf }}</span>
          </div>
          <div class="info-note">{{ labels.next }}</div>
        </dd>
      </div>
      <div class="info-section half">
        <dt>{{ labels.day }}</dt>
        <dd class="info-number">{{ dayOfYear }}<small>/{{ daysInYear }}</small></dd>
      </div>
      <div class="info-section half">
        <dt>{{ labels.week }}</dt>
        <dd class="info-number">{{ weekNumber }}</dd>
      </div>
      <div v-if="store.upcomingFestivals.length" class="info-section">
        <dt>{{ labels.upcoming }}</dt>
        <dd>
          <ul class="fest-list">
            <li v-for="o in store.upcomingFestivals" :key="o.key">
              <button class="fest-item" :style="{ '--cat': `var(--mc-cat-${o.def.category})` }" @click="goToFestival(o)">
                <i :class="`bi bi-${o.category.icon}`" aria-hidden="true"></i>
                <span class="fest-text">
                  <span class="fest-title">{{ festivalName(o.def, store.lang) }}</span>
                  <span class="fest-sub">{{ upcomingDate(o) }}</span>
                </span>
                <i class="bi bi-chevron-right fest-go" aria-hidden="true"></i>
              </button>
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  </div>
</template>

<style lang="scss" scoped>
.details {
  display: grid;
  gap: 1rem;

  // Phones/tablets: unwrap so each card can sit on its own side of the calendar
  @include down('lg') {
    display: contents;
  }
}

@include down('lg') {
  .day-card {
    order: -1;
  }

  .info-card {
    order: 1;
  }
}

// ── Hero card with a kasavu (gold-bordered) hem ────────
.day-card {
  position: relative;
  overflow: hidden;
  padding: 2rem 1.5rem 2.5rem;
  border-radius: radius('lg');
  color: #fff;
  text-align: center;
  background:
    radial-gradient(circle at 100% 0%, token(accent-glow), transparent 55%),
    linear-gradient(160deg, token(hero-start), token(hero-end));
  box-shadow: token(shadow);

  &::after {
    content: '';
    position: absolute;
    inset: auto 0 0;
    height: 0.9rem;
    background: linear-gradient(
      to bottom,
      transparent 0 20%,
      token(accent) 20% 45%,
      transparent 45% 60%,
      token(accent) 60% 72%,
      transparent 72%
    );
  }
}

.relative {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: radius('pill');
  background: rgba(255, 255, 255, 0.16);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.weekday {
  margin-top: 1rem;
  font-size: 1.15rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.9;

  &.sunday {
    color: #ffd2c8;
  }
}

.num {
  font-size: clamp(4.5rem, 12vw, 6.5rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.date {
  margin-top: 0.25rem;
  font-size: 1.05rem;
  opacity: 0.85;
}

.mal-date {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin: 1.1rem auto 0;
  padding-top: 1rem;
  max-width: 14rem;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}

.mal-date-main {
  font-size: 1.35rem;
  font-weight: 600;
  color: token(accent);
}

.nak-line {
  margin-top: 0.35rem;
  font-size: 0.95rem;
  font-weight: 600;
  opacity: 0.9;
}

.periods {
  display: grid;
  gap: 0.15rem;
  margin: 1.1rem 0 0;
  padding: 0.6rem 0.75rem;
  list-style: none;
  border-radius: radius('md');
  background: rgba(0, 0, 0, 0.18);
  text-align: left;
}

.period {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.3rem 0.25rem;
  font-size: 0.85rem;

  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  &.active .period-name,
  &.active .period-time {
    color: token(accent);
    font-weight: 700;
  }
}

.period-name {
  opacity: 0.85;
}

.period-time {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.now-badge {
  padding: 0.05rem 0.4rem;
  border-radius: radius('pill');
  background: token(accent);
  color: token(hero-end);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.periods-note {
  margin-top: 0.4rem;
  font-size: 0.68rem;
  opacity: 0.6;
}

.day-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 1.25rem;
}

.day-step {
  @include reset-button;
  @include focus-ring;
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transition: background 0.2s, transform 0.2s $ease-out;

  &:hover {
    background: rgba(255, 255, 255, 0.22);
  }

  &:active {
    transform: scale(0.92);
  }
}

.to-calendar {
  @include reset-button;
  @include focus-ring;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.2rem;
  border-radius: radius('pill');
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
  transition: background 0.2s;

  .bi {
    color: token(accent);
  }

  &:hover {
    background: rgba(255, 255, 255, 0.22);
  }

  // Desktop: the calendar is already beside this card
  @include up('lg') {
    display: none;
  }
}

.mal-date-era {
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  opacity: 0.75;
}

// Festival pills on the green Today card
.hero-fests {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 0.6rem;
}

.hero-fest {
  @include reset-button;
  @include focus-ring;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.8rem;
  border-radius: radius('pill');
  background: token(accent);
  color: token(hero-end);
  font-size: 0.85rem;
  font-weight: 700;
  transition: transform 0.15s $ease-out;

  &:hover {
    transform: translateY(-1px);
  }
}

// ── Info card ──────────────────────────────────────────
.info-card {
  @include card;
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0;
  padding: 0 1.25rem;

  dt {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: token(muted);
  }

  dd {
    margin: 0.3rem 0 0;
    color: token(text);
  }

  small {
    font-size: 0.85rem;
    font-weight: 400;
    color: token(muted);
  }
}

.info-section {
  grid-column: 1 / -1;
  padding: 1rem 0;

  & + & {
    border-top: 1px solid token(border);
  }

  // Day and Week share the last row, split by a vertical rule
  &.half {
    grid-column: auto;
  }

  &.half + &.half {
    padding-left: 1.25rem;
    border-left: 1px solid token(border);
  }
}

.fest-list {
  display: grid;
  gap: 0.3rem;
  margin: 0.2rem 0 0;
  padding: 0;
  list-style: none;
}

.fest-item {
  @include reset-button;
  @include focus-ring;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border-radius: radius('md');
  text-align: left;
  transition: background 0.15s;

  > .bi:first-child {
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--cat) 14%, transparent);
    color: var(--cat);
  }

  &:hover {
    background: token(surface-2);
  }

  &.ongoing > .bi:first-child {
    background: none;
    border: 1.5px dashed var(--cat);
  }
}

.fest-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.fest-title {
  font-weight: 700;
  color: token(text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.fest-sub {
  font-size: 0.78rem;
  color: token(muted);
}

.fest-go {
  color: token(muted);
  font-size: 0.8rem;
}

.info-title {
  font-size: 1.35rem;
  font-weight: 700;
}

.info-number {
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.info-note {
  margin-top: 0.4rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: token(muted);
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.6rem;
}

.progress {
  flex: 1;
  height: 0.5rem;
  border-radius: radius('pill');
  background: token(surface-2);
  overflow: hidden;
}

.bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, token(primary), token(accent));
  transition: width 0.4s $ease-out;
}

.pct {
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  color: token(muted);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s $ease-out;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@include reduced-motion {
  .bar,
  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }
}
</style>

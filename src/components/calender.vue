<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCalendarStore } from '@/stores/calenderStore.js';
import { monthName as malMonthName, toMalayalamDate, addMalMonths, nakshatraName } from '@/lib/malayalam.js';
import MonthPicker from '@/components/MonthPicker.vue';
import { festivalName } from '@/lib/festivals.js';
import { useIsDesktop } from '@/composables/useIsDesktop.js';

const store = useCalendarStore();
const router = useRouter();
const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekDaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const malWeekDays = ['ഞായർ', 'തിങ്കൾ', 'ചൊവ്വ', 'ബുധൻ', 'വ്യാഴം', 'വെള്ളി', 'ശനി'];
const malWeekDaysShort = ['ഞാ', 'തി', 'ചൊ', 'ബു', 'വ്യാ', 'വെ', 'ശ'];

const isMal = computed(() => store.lang === 'mal');
const isMalSystem = computed(() => store.system === 'mal');
const locale = computed(() => (isMal.value ? 'ml' : 'default'));
// Desktop has room for full names; smaller screens use abbreviations
const isDesktop = useIsDesktop();
const monthFormat = computed(() => (isDesktop.value ? 'long' : 'short'));
const era = computed(() => (isMal.value ? (isDesktop.value ? 'കൊല്ലവർഷം' : 'കൊ.വ.') : 'Kollavarsham'));

const displayedWeekDays = computed(() => {
  const long = isMal.value ? malWeekDays : weekDays;
  const short = isMal.value ? malWeekDaysShort : weekDaysShort;
  return long.map((name, i) => ({ long: name, short: short[i] }));
});

const monthName = computed(() =>
  isMalSystem.value
    ? malMonthName(store.viewMal.month, store.lang)
    : store.viewDate.toLocaleString(locale.value, { month: 'long' })
);
const yearLabel = computed(() =>
  isMalSystem.value ? `${era.value} ${store.viewMal.year}` : store.viewDate.getFullYear()
);
const monthKey = computed(() => `${store.system}-${store.viewOrdinal}`);

// Slide the grid in from the side we're navigating towards
const direction = ref('next');
watch(
  () => [store.system, store.viewOrdinal],
  ([system, now], [prevSystem, before]) => {
    if (system === prevSystem) direction.value = now > before ? 'next' : 'prev';
  }
);

// The URL is the source of truth for the displayed month; Home.vue syncs it into the store.
const goToView = (system, year, month) => {
  router.push({
    name: system === 'mal' ? 'MalCalendar' : 'Calendar',
    params: { year, month: month + 1 },
  });
};

// Show the month (in `system`) that contains `date`
const goToDateMonth = (date, system = store.system) => {
  if (system === 'mal') {
    const m = toMalayalamDate(date);
    goToView('mal', m.year, m.month);
  } else {
    goToView('greg', date.getFullYear(), date.getMonth());
  }
};

const step = (delta) => {
  if (isMalSystem.value) {
    const { year, month } = addMalMonths(store.viewMal, delta);
    goToView('mal', year, month);
  } else {
    const d = new Date(store.viewDate.getFullYear(), store.viewDate.getMonth() + delta, 1);
    goToView('greg', d.getFullYear(), d.getMonth());
  }
};
const prev = () => step(-1);
const next = () => step(1);

const goToday = () => {
  store.goToToday();
  goToDateMonth(store.today);
};

// Year/month currently shown, and today's, in the active system (for the month picker)
const pickerView = computed(() =>
  isMalSystem.value
    ? { year: store.viewMal.year, month: store.viewMal.month }
    : { year: store.viewDate.getFullYear(), month: store.viewDate.getMonth() }
);
const pickerToday = computed(() => {
  if (isMalSystem.value) {
    const m = toMalayalamDate(store.today);
    return { year: m.year, month: m.month };
  }
  return { year: store.today.getFullYear(), month: store.today.getMonth() };
});
const onPick = (year, month) => goToView(store.system, year, month);

const switchSystem = (system) => {
  if (system !== store.system) goToDateMonth(store.anchorDate, system);
};

const onDayClick = (item) => {
  store.selectDate(item.date);
  if (!item.currentMonth) goToDateMonth(item.date);
};

const onFestivalClick = (item) => {
  onDayClick(item);
  store.openFestival(item.festivals);
};

const festLabel = (item) =>
  `${item.festivals.map((o) => festivalName(o.def, store.lang)).join(', ')} — ${store.lang === 'mal' ? 'വിവരങ്ങൾ' : 'details'}`;

// Subtitle: the other calendar's months covered by this view
// Gregorian view → "Kanni – Thulam, Kollavarsham 1202" (or "Karkidakam, Kollavarsham 1201 – Chingam, Kollavarsham 1202")
// Malayalam view → "Sep – Oct 2026" (or "Dec 2026 – Jan 2027")
const subtitle = computed(() => {
  if (isMalSystem.value) {
    const { first, last } = store.viewGregRange;
    const fmt = (d) => d.toLocaleString(locale.value, { month: monthFormat.value });
    if (first.getFullYear() !== last.getFullYear()) {
      return `${fmt(first)} ${first.getFullYear()} – ${fmt(last)} ${last.getFullYear()}`;
    }
    return `${fmt(first)} – ${fmt(last)} ${last.getFullYear()}`;
  }
  const { first, last } = store.viewMalRange;
  const a = malMonthName(first.month, store.lang);
  const b = malMonthName(last.month, store.lang);
  if (first.year !== last.year) return `${a}, ${era.value} ${first.year} – ${b}, ${era.value} ${last.year}`;
  return `${a} – ${b}, ${era.value} ${last.year}`;
});

// The small corner number is the date in the *other* calendar; its month name shows on that month's 1st
const sub = (item) => {
  if (isMalSystem.value) {
    const day = item.date.getDate();
    return { day, start: day === 1, month: item.date.toLocaleString(locale.value, { month: monthFormat.value }) };
  }
  return { day: item.mal.day, start: item.mal.day === 1, month: malMonthName(item.mal.month, store.lang) };
};

const dayLabel = (item) =>
  `${item.date.toLocaleDateString(locale.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ` +
  `${malMonthName(item.mal.month, store.lang)} ${item.mal.day}, ${nakshatraName(item.nak.index, store.lang)}`;

// Language names are always shown in their own script
const languages = [
  { value: 'en', short: 'EN', name: 'English' },
  { value: 'mal', short: 'മല', name: 'മലയാളം' },
];

const systemLabels = computed(() =>
  isMal.value
    ? { greg: 'ഗ്രിഗോറിയൻ', mal: 'കൊല്ലവർഷം', group: 'കലണ്ടർ' }
    : { greg: 'Gregorian', mal: 'Malayalam', group: 'Calendar' }
);
</script>

<template>
  <div class="calendar-wrap">
    <section class="calendar">
      <header class="cal-header">
        <div class="title-block">
          <h1 class="visually-hidden">{{ monthName }} {{ yearLabel }}</h1>
          <MonthPicker
            :system="store.system"
            :lang="store.lang"
            :year="pickerView.year"
            :month="pickerView.month"
            :today-year="pickerToday.year"
            :today-month="pickerToday.month"
            @select="onPick"
          >
            <span class="title" aria-hidden="true">
              <span class="month">{{ monthName }}</span>
              <span class="year">{{ yearLabel }}</span>
            </span>
          </MonthPicker>
          <div class="subtitle">{{ subtitle }}</div>
        </div>

        <div class="controls">
          <div class="segmented" role="group" :aria-label="systemLabels.group">
            <button :class="{ active: !isMalSystem }" :aria-pressed="!isMalSystem" @click="switchSystem('greg')">
              {{ systemLabels.greg }}
            </button>
            <button :class="{ active: isMalSystem }" :aria-pressed="isMalSystem" @click="switchSystem('mal')">
              {{ systemLabels.mal }}
            </button>
          </div>

          <button class="pill" @click="goToday">{{ isMal ? 'ഇന്ന്' : 'Today' }}</button>

          <div class="nav">
            <button class="icon-btn" @click="prev" aria-label="Previous month">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button class="icon-btn" @click="next" aria-label="Next month">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      </header>

      <div class="weekdays">
        <div
          v-for="(day, index) in displayedWeekDays"
          :key="day.long"
          class="weekday"
          :class="{ sunday: index === 0 }"
        >
          <span class="long">{{ day.long }}</span>
          <span class="short">{{ day.short }}</span>
        </div>
      </div>

      <div class="days-viewport">
        <Transition :name="`slide-${direction}`" mode="out-in">
          <div class="days" :key="monthKey">
            <!-- A tile holds two buttons side by side (buttons can't nest):
                 the whole tile selects the day; the festival chip opens its details -->
            <div
              v-for="(item, index) in store.daysInGrid"
              :key="index"
              class="day"
              :class="{
                inactive: !item.currentMonth,
                sunday: item.date.getDay() === 0,
                today: store.isToday(item.date),
                selected: store.isSelected(item.date),
                'sub-start': sub(item).start,
                'has-fest': item.festivals.length,
                major: item.festivals[0]?.def.importance === 'very_high',
              }"
              :style="item.festivals.length ? { '--cat': `var(--mc-cat-${item.festivals[0].def.category})` } : undefined"
            >
              <button
                class="day-hit"
                :aria-label="dayLabel(item)"
                :aria-pressed="store.isSelected(item.date)"
                :aria-current="store.isToday(item.date) ? 'date' : undefined"
                @click="onDayClick(item)"
              ></button>
              <span class="num" aria-hidden="true">{{ item.day }}</span>
              <span class="sub-day" aria-hidden="true">{{ sub(item).day }}</span>
              <span v-if="sub(item).start" class="sub-month" aria-hidden="true">{{ sub(item).month }}</span>
              <button
                v-if="item.festivals.length"
                class="fest-chip"
                :aria-label="festLabel(item)"
                :title="festLabel(item)"
                @click="onFestivalClick(item)"
              >
                <span class="fest-dot" aria-hidden="true"></span>
                <span class="fest-name">{{ festivalName(item.festivals[0].def, store.lang) }}</span>
                <span v-if="item.festivals.length > 1" class="fest-more">+{{ item.festivals.length - 1 }}</span>
              </button>
              <span v-else class="nak" aria-hidden="true">{{ nakshatraName(item.nak.index, store.lang) }}</span>
            </div>
          </div>
        </Transition>
      </div>
    </section>

    <!-- Language switch: folder tabs on the top-right edge of the card -->
    <div class="bookmarks" role="radiogroup" aria-label="Language / ഭാഷ">
      <button
        v-for="l in languages"
        :key="l.value"
        class="bookmark"
        :class="{ active: store.lang === l.value }"
        role="radio"
        :aria-checked="store.lang === l.value"
        :aria-label="l.name"
        :title="l.name"
        @click="store.setLang(l.value)"
      >
        <span class="tab-label" :lang="l.value === 'mal' ? 'ml' : 'en'">{{ l.name }}</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$gap: 0.5rem;

// ── Folder tabs (language) ─────────────────────────────
$tab-radius: 0.75rem;
$tab-flare: 0.75rem;     // concave curve where the active tab meets the card
$tab-tucked: 0.4rem;     // how far inactive tabs sit down behind the card

.calendar-wrap {
  position: relative;
  isolation: isolate;

  // On phones/tablets the details cards sit above; leave room for the tabs
  @include down('lg') {
    margin-top: 1.25rem;
  }
}

.calendar {
  position: relative;
  z-index: 1;
}

// No z-index here, so each tab can sit in front of or behind the card
.bookmarks {
  position: absolute;
  bottom: calc(100% - 1px);
  right: 2.5rem;
  display: flex;
  align-items: flex-end;
  gap: 0.15rem;

  @include down('md') {
    right: 1.5rem;
  }
}

.bookmark {
  @include reset-button;
  @include focus-ring;
  position: relative;
  z-index: 0;
  padding: 0.35rem 0.8rem 0.4rem;
  border-radius: $tab-radius $tab-radius 0 0;
  background: token(surface-2);
  color: token(muted);
  box-shadow: inset 0 1px 0 token(border), inset 1px 0 0 token(border), inset -1px 0 0 token(border);
  transform: translateY($tab-tucked);
  transition:
    transform 0.25s $ease-out,
    background 0.2s,
    color 0.2s;

  &:hover:not(.active) {
    transform: translateY($tab-tucked * 0.25);
    color: token(text);
  }

  // The open tab: same surface as the card, in front of it, flaring into its edge
  &.active {
    z-index: 2;
    transform: none;
    background: token(surface);
    color: token(primary);
    box-shadow: 0 -6px 14px -8px rgba(0, 0, 0, 0.18);
    cursor: default;

    // kasavu-gold accent along the top of the open tab
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: $tab-radius;
      right: $tab-radius;
      height: 3px;
      border-radius: 0 0 3px 3px;
      background: token(accent);
    }

    .tab-label::before,
    .tab-label::after {
      content: '';
      position: absolute;
      bottom: 0;
      width: $tab-flare;
      height: $tab-flare;
    }

    .tab-label::before {
      left: -$tab-flare;
      background: radial-gradient(circle at 0 0, transparent $tab-flare, token(surface) $tab-flare);
    }

    .tab-label::after {
      right: -$tab-flare;
      background: radial-gradient(circle at 100% 0, transparent $tab-flare, token(surface) $tab-flare);
    }
  }
}

.tab-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

@include reduced-motion {
  .bookmark {
    transition: none;
  }
}

.calendar {
  @include card;
  padding: 1.25rem;

  @include up('md') {
    padding: 2rem;
  }
}

// ── Header ─────────────────────────────────────────────
.cal-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.subtitle {
  margin-top: 0.35rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: token(accent-strong);
}

.title {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.month {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: token(text);
}

.year {
  font-size: clamp(1.1rem, 2.5vw, 1.5rem);
  font-weight: 300;
  color: token(muted);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.segmented {
  display: inline-flex;
  padding: 0.25rem;
  border-radius: radius('pill');
  background: token(surface-2);

  button {
    @include reset-button;
    @include focus-ring;
    padding: 0.35rem 0.85rem;
    border-radius: radius('pill');
    font-size: 0.875rem;
    font-weight: 600;
    color: token(muted);
    transition: background 0.2s, color 0.2s;

    &.active {
      background: token(surface);
      color: token(primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
  }
}

.pill {
  @include reset-button;
  @include focus-ring;
  padding: 0.5rem 1.1rem;
  border-radius: radius('pill');
  font-size: 0.875rem;
  font-weight: 600;
  color: token(primary);
  border: 1px solid token(primary-soft);
  background: token(primary-soft);
  transition: background 0.2s, color 0.2s;

  &:hover {
    background: token(primary);
    color: #fff;
  }
}

.nav {
  display: flex;
  gap: 0.35rem;
}

.icon-btn {
  @include reset-button;
  @include focus-ring;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: 1px solid token(border);
  background: token(surface);
  color: token(text);
  transition: background 0.2s, transform 0.2s $ease-out;

  svg {
    width: 1.25rem;
    height: 1.25rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.25;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    background: token(primary-soft);
  }

  &:active {
    transform: scale(0.92);
  }
}

// ── Grid ───────────────────────────────────────────────
%seven-cols {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: $gap;

  @include down('md') {
    gap: $gap * 0.5;
  }
}

.weekdays {
  @extend %seven-cols;
  margin-bottom: 0.75rem;
}

.weekday {
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: token(muted);

  &.sunday {
    color: token(danger);
  }

  .short {
    display: none;
  }

  @include down('lg') {
    .long { display: none; }
    .short { display: inline; }
  }
}

.days-viewport {
  overflow: hidden;
}

.days {
  @extend %seven-cols;
}

.day {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border-radius: radius('md');
  background: token(surface-2);
  color: token(text);
  font-size: clamp(1rem, 2.4vw, 1.6rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition:
    transform 0.2s $ease-out,
    background 0.2s,
    box-shadow 0.2s;

  @include up('lg') {
    aspect-ratio: 4 / 3;
  }

  &:hover {
    transform: translateY(-2px);
    background: token(primary-soft);
  }

  // Major festival days get a wash of their category colour
  &.has-fest.major:not(.today) {
    background: color-mix(in srgb, var(--cat) 13%, #{token(surface-2)});

    &:hover {
      background: color-mix(in srgb, var(--cat) 22%, #{token(surface-2)});
    }
  }

  &.sunday {
    color: token(danger);
  }

  // Invisible button covering the tile: selects the day
  .day-hit {
    @include reset-button;
    @include focus-ring;
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: inherit;
  }

  // Labels sit visually on top but let clicks through to .day-hit
  .num,
  .sub-day,
  .sub-month,
  .nak {
    pointer-events: none;
  }

  // Festival chip: opens the festival details
  .fest-chip {
    @include reset-button;
    @include focus-ring;
    position: absolute;
    left: 0.3rem;
    right: 0.3rem;
    bottom: 0.3rem;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    min-width: 0;
    padding: 0.1rem 0.35rem;
    border-radius: radius('pill');
    background: color-mix(in srgb, var(--cat) 14%, transparent);
    color: var(--cat);
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 1.4;
    transition: background 0.15s;

    &:hover {
      background: color-mix(in srgb, var(--cat) 26%, transparent);
    }

    // Phones/tablets: no room for names — a dot along the bottom of the tile
    @include down('lg') {
      left: 0;
      right: 0;
      bottom: 0;
      height: 40%;
      padding: 0 0 0.2rem;
      align-items: flex-end;
      background: none;

      &:hover {
        background: none;
      }

      .fest-name,
      .fest-more {
        display: none;
      }
    }
  }

  .fest-dot {
    flex: none;
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: var(--cat);
  }

  .fest-name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .fest-more {
    flex: none;
    opacity: 0.8;
  }

  &.inactive {
    background: transparent;
    opacity: 0.35;

    &:hover {
      opacity: 0.7;
    }
  }

  &.selected {
    box-shadow: inset 0 0 0 2px token(primary);
  }

  // Other calendar's date: small number top-right, its month name top-left on the 1st
  .sub-day {
    position: absolute;
    top: 0.35rem;
    right: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: token(muted);

    @include down('md') {
      top: 0.15rem;
      right: 0.3rem;
      font-size: 0.6rem;
    }
  }

  .sub-month {
    position: absolute;
    top: 0.35rem;
    left: 0.5rem;
    max-width: calc(100% - 2.5rem);
    overflow: hidden;
    font-size: 0.7rem;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: token(accent-strong);

    @include down('lg') {
      display: none;
    }
  }

  // Nakshatram at sunrise, along the bottom (desktop only — no room on small tiles)
  .nak {
    position: absolute;
    left: 0.35rem;
    right: 0.35rem;
    bottom: 0.35rem;
    overflow: hidden;
    font-size: 0.65rem;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: token(muted);

    @include down('lg') {
      display: none;
    }
  }

  &.sub-start .sub-day {
    color: token(accent-strong);
    font-weight: 700;
  }

  &.sub-start:not(.today)::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border-top: 3px solid token(accent);
    pointer-events: none;
  }

  &.today {
    color: #fff;
    background: linear-gradient(135deg, token(accent), token(accent-strong));
    box-shadow: 0 10px 24px -8px token(accent-glow);

    .sub-day {
      color: rgba(255, 255, 255, 0.85);
    }

    .sub-month {
      color: #fff;
    }

    .nak {
      color: rgba(255, 255, 255, 0.85);
    }

    .fest-chip {
      color: #fff;
      background: rgba(255, 255, 255, 0.2);

      @include down('lg') {
        background: none;
      }
    }

    .fest-dot {
      background: #fff;
    }

    &.selected {
      box-shadow:
        0 10px 24px -8px token(accent-glow),
        0 0 0 3px token(surface),
        0 0 0 5px token(accent);
    }
  }
}

// ── Month change animation ─────────────────────────────
$slide: 1.5rem;

@each $dir, $from, $to in (next, $slide, -$slide), (prev, -$slide, $slide) {
  .slide-#{$dir}-enter-active,
  .slide-#{$dir}-leave-active {
    transition: opacity 0.22s ease, transform 0.22s $ease-out;
  }

  .slide-#{$dir}-enter-from {
    opacity: 0;
    transform: translateX($from);
  }

  .slide-#{$dir}-leave-to {
    opacity: 0;
    transform: translateX($to);
  }
}

@include reduced-motion {
  .day,
  .icon-btn,
  [class*='slide-'] {
    transition: none !important;
  }

  .day:hover {
    transform: none;
  }
}
</style>

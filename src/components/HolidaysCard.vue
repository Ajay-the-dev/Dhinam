<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCalendarStore } from '@/stores/calenderStore.js';
import {
  CATEGORIES, festivalsForYear, festivalName, categoryName, occurrenceDate,
} from '@/lib/festivals.js';
import { toMalayalamDate, malMonthStart, monthName as malMonthName, toDayNum, fromDayNum } from '@/lib/malayalam.js';
import { useIsDesktop } from '@/composables/useIsDesktop.js';

const store = useCalendarStore();
const router = useRouter();
const isDesktop = useIsDesktop();

const isMal = computed(() => store.lang === 'mal');
const isMalSystem = computed(() => store.system === 'mal');
const locale = computed(() => (isMal.value ? 'ml' : 'default'));

const t = computed(() =>
  isMal.value
    ? {
        title: 'അവധികളും ആഘോഷങ്ങളും', search: 'ആഘോഷം തിരയുക…', clear: 'മായ്ക്കുക',
        total: 'ആകെ', inMonth: 'ഈ മാസം', remaining: 'ബാക്കി', allMonths: 'എല്ലാ മാസവും',
        all: 'എല്ലാം', thisYear: 'ഈ വർഷം', prevYear: 'മുൻ വർഷം', nextYear: 'അടുത്ത വർഷം',
        empty: 'ആഘോഷങ്ങളൊന്നും കണ്ടെത്തിയില്ല', next: 'അടുത്തത്', today: 'ഇന്ന്',
        days: 'ദിവസം', era: 'കൊല്ലവർഷം', months: 'മാസങ്ങൾ', categories: 'വിഭാഗങ്ങൾ',
        results: (n) => `${n} ആഘോഷങ്ങൾ`,
        inDays: (n) => (n === 1 ? 'നാളെ' : `${n} ദിവസം കഴിഞ്ഞ്`),
      }
    : {
        title: 'Holidays & Festivals', search: 'Search festivals…', clear: 'Clear',
        total: 'Total', inMonth: 'This month', remaining: 'Remaining', allMonths: 'All months',
        all: 'All', thisYear: 'This year', prevYear: 'Previous year', nextYear: 'Next year',
        empty: 'No festivals found', next: 'Next', today: 'Today',
        days: 'days', era: 'Kollavarsham', months: 'Months', categories: 'Categories',
        results: (n) => `${n} festival${n === 1 ? '' : 's'}`,
        inDays: (n) => (n === 1 ? 'Tomorrow' : `In ${n} days`),
      }
);

// ── Year being listed: follows the calendar's year, but can be browsed on its own ──
// The month shown in the calendar (today's month on first load) is selected by default
const calendarYear = computed(() => (isMalSystem.value ? store.viewMal.year : store.viewDate.getFullYear()));
const calendarMonth = computed(() => (isMalSystem.value ? store.viewMal.month : store.viewDate.getMonth()));
const year = ref(calendarYear.value);
const month = ref(calendarMonth.value); // null = all months
watch([() => store.system, calendarYear, calendarMonth], ([, y, m]) => {
  year.value = y;
  month.value = m;
});

const todayNum = computed(() => toDayNum(store.today));
const todayYear = computed(() => (isMalSystem.value ? toMalayalamDate(store.today).year : store.today.getFullYear()));
const todayMonth = computed(() => (isMalSystem.value ? toMalayalamDate(store.today).month : store.today.getMonth()));

// Keeps the selected month, so the same month can be compared across years
const stepYear = (delta) => {
  year.value += delta;
};
const goThisYear = () => {
  year.value = todayYear.value;
  month.value = todayMonth.value;
};

const yearLabel = computed(() => (isMalSystem.value ? `${t.value.era} ${year.value}` : String(year.value)));

// Day-number bounds of the listed year in the active system
const period = computed(() => {
  if (isMalSystem.value) {
    return {
      from: toDayNum(malMonthStart(year.value, 0)),
      to: toDayNum(malMonthStart(year.value + 1, 0)) - 1,
    };
  }
  return {
    from: toDayNum(new Date(year.value, 0, 1)),
    to: toDayNum(new Date(year.value, 11, 31)),
  };
});

// Month (0–11) of a day number in the active system
const monthOf = (dayNum) => {
  const d = fromDayNum(dayNum);
  return isMalSystem.value ? toMalayalamDate(d).month : d.getMonth();
};

const monthLabel = (m, format = 'long') =>
  isMalSystem.value
    ? malMonthName(m, store.lang)
    : new Date(2000, m, 1).toLocaleString(locale.value, { month: format });

// Every occurrence touching the listed year; spans that began earlier are filed under its first month
const yearItems = computed(() => {
  const { from, to } = period.value;
  const g1 = fromDayNum(from).getFullYear();
  const g2 = fromDayNum(to).getFullYear();
  const seen = new Set();
  const out = [];
  for (let g = g1; g <= g2; g++) {
    for (const o of festivalsForYear(g)) {
      if (seen.has(o.key) || o.end < from || o.start > to) continue;
      seen.add(o.key);
      const anchor = Math.max(o.start, from);
      out.push({ ...o, anchor, month: monthOf(anchor) });
    }
  }
  return out.sort((a, b) => a.anchor - b.anchor);
});

// ── Filters ──
const query = ref('');
const category = ref(null);

const norm = (s) => s.toLowerCase().normalize('NFC').trim();
const matchesQuery = (o) => {
  const q = norm(query.value);
  if (!q) return true;
  const hay = [
    o.def.name_en, o.def.name_ml, o.category?.name_en, o.category?.name_ml, ...(o.def.tags || []),
  ].filter(Boolean).map(norm);
  return hay.some((s) => s.includes(q));
};

// A search covers every month: starting one lifts the month filter, clearing it brings the month back
let monthBeforeSearch = null;
watch(
  () => Boolean(query.value.trim()),
  (searching) => {
    if (searching) {
      monthBeforeSearch = month.value;
      month.value = null;
    } else if (month.value == null) {
      month.value = monthBeforeSearch;
    }
  }
);

// Search applies to every count, so the month bars and category chips show where matches are
const searched = computed(() => yearItems.value.filter(matchesQuery));

const monthCounts = computed(() => {
  const counts = Array(12).fill(0);
  for (const o of searched.value) {
    if (!category.value || o.def.category === category.value) counts[o.month]++;
  }
  return counts;
});
const maxMonthCount = computed(() => Math.max(1, ...monthCounts.value));

const categoryCounts = computed(() => {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  for (const o of searched.value) {
    if (month.value == null || o.month === month.value) counts[o.def.category]++;
  }
  return CATEGORIES.map((c) => ({ ...c, count: counts[c.id] })).filter((c) => c.count || c.id === category.value);
});

const filtered = computed(() =>
  searched.value.filter(
    (o) => (month.value == null || o.month === month.value) && (!category.value || o.def.category === category.value)
  )
);

const toggleMonth = (m) => {
  month.value = month.value === m ? null : m;
};
const toggleCategory = (id) => {
  category.value = category.value === id ? null : id;
};

// ── Stats ──
const stats = computed(() => {
  const items = yearItems.value;
  const statMonth = month.value ?? (year.value === todayYear.value ? todayMonth.value : null);
  return {
    total: items.length,
    month: statMonth == null ? null : items.filter((o) => o.month === statMonth).length,
    monthName: statMonth == null ? '' : monthLabel(statMonth, isDesktop.value ? 'long' : 'short'),
    remaining: items.filter((o) => o.end >= todayNum.value).length,
  };
});

// The next single-day festival from today, highlighted in the list
const nextKey = computed(() => yearItems.value.find((o) => o.kind === 'day' && o.start >= todayNum.value)?.key);

// ── List, grouped by month ──
const groups = computed(() => {
  const out = [];
  for (const o of filtered.value) {
    let g = out[out.length - 1];
    if (!g || g.month !== o.month) out.push((g = { month: o.month, items: [] }));
    g.items.push(o);
  }
  return out;
});

const fmt = (dayNum, opts) => fromDayNum(dayNum).toLocaleDateString(locale.value, opts);

const tile = (o) => {
  const d = fromDayNum(o.anchor);
  return {
    day: isMalSystem.value ? toMalayalamDate(d).day : d.getDate(),
    weekday: d.toLocaleDateString(locale.value, { weekday: 'short' }),
    sunday: d.getDay() === 0,
  };
};

const whenText = (o) => {
  if (o.kind === 'day') {
    const d = fromDayNum(o.start);
    const m = toMalayalamDate(d);
    // Show the other calendar's date as the secondary line
    return isMalSystem.value
      ? fmt(o.start, { day: 'numeric', month: 'long', year: 'numeric' })
      : `${malMonthName(m.month, store.lang)} ${m.day}, ${t.value.era} ${m.year}`;
  }
  const span = `${fmt(o.start, { day: 'numeric', month: 'short' })} – ${fmt(o.end, { day: 'numeric', month: 'short' })}`;
  return `${span} · ${o.end - o.start + 1} ${t.value.days}`;
};

const relText = (o) => {
  const n = o.start - todayNum.value;
  if (n === 0 || (o.start <= todayNum.value && o.end >= todayNum.value)) return t.value.today;
  if (n > 0 && n <= 60) return t.value.inDays(n);
  return '';
};

// Select the festival's day, bring the calendar to it and show its details
const openItem = (o) => {
  const date = occurrenceDate({ start: o.anchor });
  store.selectDate(date);
  if (isMalSystem.value) {
    const m = toMalayalamDate(date);
    router.push({ name: 'MalCalendar', params: { year: m.year, month: m.month + 1 } });
  } else {
    router.push({ name: 'Calendar', params: { year: date.getFullYear(), month: date.getMonth() + 1 } });
  }
  store.openFestival([o]);
};

const resetFilters = () => {
  monthBeforeSearch = null; // "Clear" means all months, not the one from before the search
  query.value = '';
  category.value = null;
  month.value = null;
};
</script>

<template>
  <section class="holidays" :aria-label="t.title">
    <header class="h-header">
      <div class="title-block">
        <h2 class="title">{{ t.title }}</h2>
        <div class="subtitle">{{ t.results(filtered.length) }} · {{ yearLabel }}</div>
      </div>

      <div class="controls">
        <button class="pill" @click="goThisYear">{{ t.thisYear }}</button>
        <div class="year-nav">
          <button class="icon-btn" :aria-label="t.prevYear" @click="stepYear(-1)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span class="year" aria-live="polite">{{ year }}</span>
          <button class="icon-btn" :aria-label="t.nextYear" @click="stepYear(1)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Year / month / remaining counts -->
    <div class="stats">
      <div class="stat">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-label">{{ t.total }} · {{ year }}</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ stats.month ?? '—' }}</span>
        <span class="stat-label">{{ stats.monthName || t.inMonth }}</span>
      </div>
      <div class="stat accent">
        <span class="stat-num">{{ stats.remaining }}</span>
        <span class="stat-label">{{ t.remaining }}</span>
      </div>
    </div>

    <!-- Search -->
    <div class="search">
      <i class="bi bi-search" aria-hidden="true"></i>
      <input v-model="query" type="search" :placeholder="t.search" :aria-label="t.search" />
      <button v-if="query" class="clear-btn" :aria-label="t.clear" @click="query = ''">
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Festivals per month: bars double as a month filter -->
    <div class="months" role="group" :aria-label="t.months">
      <button
        v-for="(count, m) in monthCounts"
        :key="m"
        class="month-bar"
        :class="{ active: month === m, current: year === todayYear && m === todayMonth, empty: !count }"
        :aria-pressed="month === m"
        :aria-label="`${monthLabel(m)}: ${count}`"
        :title="`${monthLabel(m)}: ${count}`"
        @click="toggleMonth(m)"
      >
        <span class="mb-count">{{ count }}</span>
        <span class="mb-track"><span class="mb-fill" :style="{ height: `${(count / maxMonthCount) * 100}%` }"></span></span>
        <span class="mb-name">{{ monthLabel(m, 'short') }}</span>
      </button>
    </div>

    <!-- Category filter with counts -->
    <div class="cats" role="group" :aria-label="t.categories">
      <button class="cat" :class="{ active: !category }" :aria-pressed="!category" @click="category = null">
        {{ t.all }}
      </button>
      <button
        v-for="c in categoryCounts"
        :key="c.id"
        class="cat"
        :class="{ active: category === c.id }"
        :style="{ '--cat': `var(--mc-cat-${c.id})` }"
        :aria-pressed="category === c.id"
        @click="toggleCategory(c.id)"
      >
        <span class="cat-dot" aria-hidden="true"></span>
        {{ categoryName(c, store.lang) }}
        <span class="cat-count">{{ c.count }}</span>
      </button>
    </div>

    <div v-if="month != null || category || query" class="active-filters">
      <span>{{ t.results(filtered.length) }}{{ month != null ? ` · ${monthLabel(month)}` : '' }}</span>
      <button class="link-btn" @click="resetFilters">{{ t.clear }}</button>
    </div>

    <!-- Festival list -->
    <div class="list">
      <div v-if="!groups.length" class="empty">
        <p>{{ t.empty }}</p>
      </div>

      <section v-for="g in groups" :key="g.month" class="group">
        <h3 class="group-head">
          <span>{{ monthLabel(g.month) }}</span>
          <span class="group-count">{{ g.items.length }}</span>
        </h3>
        <ul class="items">
          <li v-for="o in g.items" :key="o.key">
            <button
              class="item"
              :class="{ past: o.end < todayNum, next: o.key === nextKey, major: o.def.importance === 'very_high' }"
              :style="{ '--cat': `var(--mc-cat-${o.def.category})` }"
              @click="openItem(o)"
            >
              <span class="date-tile" :class="{ sunday: tile(o).sunday, span: o.kind !== 'day' }">
                <span class="dt-num">{{ tile(o).day }}</span>
                <span class="dt-week">{{ tile(o).weekday }}</span>
              </span>
              <span class="item-text">
                <span class="item-title">
                  {{ festivalName(o.def, store.lang) }}
                </span>
                <span class="item-sub">{{ whenText(o) }}</span>
                <span class="item-cat">
                  {{ categoryName(o.category, store.lang) }}
                </span>
              </span>
              <span class="item-side">
                <span v-if="o.key === nextKey" class="badge next-badge">{{ t.next }}</span>
                <span v-else-if="relText(o)" class="badge">{{ relText(o) }}</span>
                <i class="bi bi-chevron-right" aria-hidden="true"></i>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.holidays {
  @include card;
  padding: 1.25rem;

  @include up('md') {
    padding: 2rem;
  }
}

// ── Header ─────────────────────────────────────────────
.h-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.title {
  margin: 0;
  font-size: clamp(1.5rem, 3.5vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.subtitle {
  margin-top: 0.35rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: token(accent-strong);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
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

.year-nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.year {
  min-width: 3.5rem;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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

// ── Stats ──────────────────────────────────────────────
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin-bottom: 1.25rem;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.85rem 1rem;
  border-radius: radius('md');
  background: token(surface-2);
  min-width: 0;

  &.accent {
    color: #fff;
    background: linear-gradient(160deg, token(hero-start), token(hero-end));
    box-shadow: inset 0 -3px 0 token(accent);

    .stat-label {
      color: rgba(255, 255, 255, 0.8);
    }
  }
}

.stat-num {
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  overflow: hidden;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: token(muted);
}

// ── Search ─────────────────────────────────────────────
.search {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 1.25rem;

  > .bi-search {
    position: absolute;
    left: 1rem;
    color: token(muted);
    pointer-events: none;
  }

  input {
    width: 100%;
    padding: 0.7rem 2.75rem;
    border: 1px solid token(border);
    border-radius: radius('pill');
    background: token(surface-2);
    color: token(text);
    font: inherit;
    font-size: 0.95rem;
    transition: border-color 0.2s, box-shadow 0.2s;

    &::placeholder {
      color: token(muted);
    }

    &::-webkit-search-cancel-button {
      display: none;
    }

    &:focus {
      outline: none;
      border-color: token(accent);
      box-shadow: 0 0 0 3px token(glow-2);
    }
  }
}

.clear-btn {
  @include reset-button;
  @include focus-ring;
  position: absolute;
  right: 0.5rem;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  color: token(muted);

  &:hover {
    background: token(surface);
    color: token(text);
  }
}

// ── Month bars ─────────────────────────────────────────
.months {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.35rem;
  margin-bottom: 1rem;

  @include down('md') {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

.month-bar {
  @include reset-button;
  @include focus-ring;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
  padding: 0.5rem 0.2rem;
  border-radius: radius('sm');
  background: token(surface-2);
  transition: background 0.2s, transform 0.2s $ease-out;

  &:hover {
    background: token(primary-soft);
    transform: translateY(-2px);
  }

  &.empty {
    opacity: 0.55;
  }

  &.current .mb-name {
    color: token(accent-strong);
  }

  &.active {
    background: token(primary);
    color: #fff;

    .mb-track {
      background: rgba(255, 255, 255, 0.2);
    }

    .mb-fill {
      background: token(accent);
    }

    .mb-name {
      color: #fff;
    }
  }
}

.mb-count {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.mb-track {
  position: relative;
  display: flex;
  align-items: flex-end;
  width: 0.6rem;
  height: 2.5rem;
  border-radius: radius('pill');
  background: token(border);
  overflow: hidden;
}

.mb-fill {
  width: 100%;
  border-radius: inherit;
  background: linear-gradient(to top, token(primary), token(accent));
  transition: height 0.3s $ease-out;
}

.mb-name {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: token(muted);
}

// ── Category chips ─────────────────────────────────────
.cats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.cat {
  --cat: #{token(primary)};
  @include reset-button;
  @include focus-ring;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.8rem;
  border-radius: radius('pill');
  border: 1px solid token(border);
  background: token(surface-2);
  font-size: 0.8rem;
  font-weight: 600;
  color: token(muted);
  transition: background 0.15s, color 0.15s, border-color 0.15s;

  &:hover {
    color: token(text);
  }

  &.active {
    border-color: var(--cat);
    background: color-mix(in srgb, var(--cat) 14%, #{token(surface)});
    color: var(--cat);
  }
}

.cat-dot {
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--cat);
}

.cat-count {
  min-width: 1.4rem;
  padding: 0 0.35rem;
  border-radius: radius('pill');
  background: token(surface);
  font-size: 0.7rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.active-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: token(muted);
}

.link-btn {
  @include reset-button;
  @include focus-ring;
  color: token(primary);
  font-weight: 700;

  &:hover {
    text-decoration: underline;
  }
}

// ── List ───────────────────────────────────────────────
.list {
  max-height: 34rem;
  margin: 0 -0.5rem;
  padding: 0 0.5rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.empty {
  display: grid;
  place-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: token(muted);

  p {
    margin: 0;
  }
}

.group + .group {
  margin-top: 1rem;
}

.group-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.5rem 0;
  background: token(surface);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: token(primary);

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: token(border);
  }
}

.group-count {
  padding: 0 0.45rem;
  border-radius: radius('pill');
  background: color-mix(in srgb, #{token(accent)} 18%, transparent);
  color: token(accent-strong);
  font-size: 0.7rem;
  letter-spacing: 0;
}

.items {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;

  @include up('xl') {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.item {
  @include reset-button;
  @include focus-ring;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  height: 100%;
  padding: 0.6rem 0.75rem 0.6rem 0.6rem;
  border-radius: radius('md');
  background: token(surface-2);
  text-align: left;
  transition: background 0.15s, transform 0.15s $ease-out;

  &:hover {
    background: color-mix(in srgb, var(--cat) 10%, #{token(surface-2)});
    transform: translateY(-1px);

    .bi-chevron-right {
      transform: translateX(2px);
    }
  }

  &.past {
    opacity: 0.6;
  }

  &.next {
    box-shadow: inset 0 0 0 2px token(accent);
  }
}

.date-tile {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 3.1rem;
  height: 3.1rem;
  border-radius: radius('sm');
  background: color-mix(in srgb, var(--cat) 16%, #{token(surface)});
  color: var(--cat);
  border-bottom: 3px solid var(--cat);

  &.span {
    border-bottom-style: dashed;
  }

  &.sunday .dt-week {
    color: token(danger);
  }
}

.dt-num {
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.dt-week {
  margin-top: 0.15rem;
  font-size: 0.62rem;
  font-weight: 600;
  text-transform: uppercase;
  color: token(muted);
}

.item-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.item-title {
  overflow: hidden;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.item-sub,
.item-cat {
  overflow: hidden;
  font-size: 0.78rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: token(muted);
}

.item-cat {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--cat);
}

.item-side {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.4rem;
  color: token(muted);

  .bi-chevron-right {
    transition: transform 0.15s $ease-out;
  }
}

.badge {
  padding: 0.15rem 0.55rem;
  border-radius: radius('pill');
  background: token(primary-soft);
  color: token(primary);
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.next-badge {
  background: linear-gradient(135deg, token(accent), token(accent-strong));
  color: #fff;
}

// Small phones: the name needs the room more than the "In N days" hint
@include down('sm') {
  .badge:not(.next-badge) {
    display: none;
  }
}

@include reduced-motion {
  .month-bar,
  .item,
  .icon-btn,
  .mb-fill {
    transition: none !important;
  }

  .month-bar:hover,
  .item:hover {
    transform: none;
  }
}
</style>

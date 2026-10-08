<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useCalendarStore } from '@/stores/calenderStore.js';
import {
  festivalName, categoryName, describeRule, dateNote, festivalsForYear, occurrenceDate,
} from '@/lib/festivals.js';
import { toMalayalamDate, monthName, nakshatraOn, nakshatraNames } from '@/lib/malayalam.js';

const store = useCalendarStore();
const dialog = ref(null);
const copied = ref(false);

const isMal = computed(() => store.lang === 'mal');
const locale = computed(() => (isMal.value ? 'ml' : 'default'));

const t = computed(() =>
  isMal.value
    ? {
        close: 'അടയ്ക്കുക', share: 'പങ്കിടുക', copied: 'പകർത്തി', rule: 'തീയതി നിശ്ചയിക്കുന്നത്',
        location: 'സ്ഥലം', days: 'ദിവസങ്ങൾ', related: 'അനുബന്ധ ദിനങ്ങൾ', calculated: 'കണക്കാക്കിയത്',
        official: 'ഔദ്യോഗികം', era: 'കൊല്ലവർഷം', india: 'ഇന്ത്യ', during: 'മാസം',
      }
    : {
        close: 'Close', share: 'Share', copied: 'Copied', rule: 'How the date is set',
        location: 'Location', days: 'days', related: 'Related days', calculated: 'Calculated',
        official: 'Official', era: 'Kollavarsham', india: 'India', during: 'month',
      }
);

const state = computed(() => store.festivalDialog);
const current = computed(() => state.value?.items.find((o) => o.key === state.value.key) ?? state.value?.items[0]);

// Open/close the native <dialog> as the store changes
watch(state, async (value) => {
  await nextTick();
  if (!dialog.value) return;
  if (value && !dialog.value.open) dialog.value.showModal();
  if (!value && dialog.value.open) dialog.value.close();
  copied.value = false;
});

const onClose = () => store.closeFestival();
// Clicking the dimmed backdrop (the <dialog> element itself, outside the panel) closes it
const onBackdrop = (e) => {
  if (e.target === dialog.value) dialog.value.close();
};

const fmtDate = (d, opts) => d.toLocaleDateString(locale.value, opts);

const dateText = computed(() => {
  const o = current.value;
  if (!o) return '';
  const start = occurrenceDate(o, 'start');
  const end = occurrenceDate(o, 'end');
  if (o.kind === 'day') return fmtDate(start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const span = `${fmtDate(start, { day: 'numeric', month: 'short' })} – ${fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  if (o.kind === 'month') {
    const m = toMalayalamDate(start);
    return `${monthName(m.month, store.lang)} ${t.value.during} · ${span}`;
  }
  return `${span} · ${o.end - o.start + 1} ${t.value.days}`;
});

const malText = computed(() => {
  const o = current.value;
  if (!o || o.kind !== 'day') return '';
  const d = occurrenceDate(o);
  const m = toMalayalamDate(d);
  const nak = nakshatraNames(nakshatraOn(d), store.lang);
  return `${monthName(m.month, store.lang)} ${m.day}, ${t.value.era} ${m.year} · ★ ${nak}`;
});

// Short spans (Onam, Navaratri) list each day with its nakshatram
const spanDays = computed(() => {
  const o = current.value;
  if (!o || o.kind !== 'range' || o.end - o.start > 15) return [];
  return Array.from({ length: o.end - o.start + 1 }, (_, i) => {
    const d = occurrenceDate({ start: o.start + i }, 'start');
    return {
      key: i,
      date: fmtDate(d, { day: 'numeric', month: 'short' }),
      weekday: fmtDate(d, { weekday: 'short' }),
      nak: nakshatraNames(nakshatraOn(d), store.lang),
    };
  });
});

// Related festivals (by id) from the same season, clickable
const related = computed(() => {
  const o = current.value;
  if (!o?.def.related_events) return [];
  const year = occurrenceDate(o).getFullYear();
  const pool = festivalsForYear(year);
  return o.def.related_events
    .map((id) => pool.find((x) => x.id === id && x.kind === 'day' && Math.abs(x.start - o.end) <= 20))
    .filter((x) => x && x.key !== o.key);
});

const locationText = computed(() => {
  const l = current.value?.def.location;
  if (!l) return '';
  const country = l.country === 'IN' ? t.value.india : l.country;
  return [l.name, l.city, l.district, l.districts?.join(', '), l.state, country].filter(Boolean).join(', ');
});

const share = async () => {
  const o = current.value;
  const text = [festivalName(o.def, store.lang), dateText.value, malText.value].filter(Boolean).join('\n');
  try {
    if (navigator.share) {
      await navigator.share({ title: festivalName(o.def, store.lang), text, url: location.href });
    } else {
      await navigator.clipboard.writeText(`${text}\n${location.href}`);
      copied.value = true;
    }
  } catch {
    // share sheet dismissed or clipboard blocked — nothing to do
  }
};

const show = (key) => {
  store.festivalDialog = { ...state.value, key };
};
const openRelated = (o) => store.openFestival([o]);
</script>

<template>
  <dialog
    ref="dialog"
    class="festival-dialog"
    :aria-label="current ? festivalName(current.def, store.lang) : undefined"
    @close="onClose"
    @click="onBackdrop"
  >
    <article v-if="current" class="panel" :style="{ '--cat': `var(--mc-cat-${current.def.category})` }">
      <!-- Hero header: same green + kasavu-gold treatment as the Today card -->
      <header class="hero">
        <div class="hero-top">
          <span class="category">
            <i :class="`bi bi-${current.category.icon}`" aria-hidden="true"></i>
            {{ categoryName(current.category, store.lang) }}
          </span>
          <button class="icon-btn" :aria-label="t.close" @click="dialog.close()">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>

        <h2 class="title">{{ festivalName(current.def, store.lang) }}</h2>
        <p class="alt-name" :lang="isMal ? 'en' : 'ml'">{{ isMal ? current.def.name_en : current.def.name_ml }}</p>

        <div class="when">
          <div class="when-main">
            <i class="bi bi-calendar-event" aria-hidden="true"></i>
            {{ dateText }}
          </div>
          <div v-if="malText" class="when-sub">{{ malText }}</div>
        </div>
      </header>

      <!-- Several festivals on one day: switch between them -->
      <div v-if="state.items.length > 1" class="tabs" role="tablist">
        <button
          v-for="o in state.items"
          :key="o.key"
          role="tab"
          class="tab"
          :aria-selected="o.key === current.key"
          :style="{ '--cat': `var(--mc-cat-${o.def.category})` }"
          @click="show(o.key)"
        >
          <span class="tab-dot" aria-hidden="true"></span>
          {{ festivalName(o.def, store.lang) }}
        </button>
      </div>

      <div class="body">
        <ul v-if="spanDays.length" class="span-days">
          <li v-for="d in spanDays" :key="d.key">
            <span class="sd-date">{{ d.date }}</span>
            <span class="sd-week">{{ d.weekday }}</span>
            <span class="sd-nak">{{ d.nak }}</span>
          </li>
        </ul>

        <section class="fact">
          <h3><i class="bi bi-compass" aria-hidden="true"></i>{{ t.rule }}</h3>
          <p>
            {{ describeRule(current.def, store.lang) }}
            <span class="source" :class="current.source">
              {{ current.source === 'override' ? t.official : t.calculated }}
            </span>
          </p>
          <p v-if="dateNote(current, store.lang)" class="note">
            <i class="bi bi-info-circle" aria-hidden="true"></i>
            {{ dateNote(current, store.lang) }}
          </p>
        </section>

        <section v-if="locationText" class="fact">
          <h3><i class="bi bi-geo-alt" aria-hidden="true"></i>{{ t.location }}</h3>
          <p>{{ locationText }}</p>
        </section>

        <section v-if="related.length" class="fact">
          <h3><i class="bi bi-link-45deg" aria-hidden="true"></i>{{ t.related }}</h3>
          <div class="chips">
            <button
              v-for="o in related"
              :key="o.key"
              class="chip"
              :style="{ '--cat': `var(--mc-cat-${o.def.category})` }"
              @click="openRelated(o)"
            >
              {{ festivalName(o.def, store.lang) }}
              <small>{{ fmtDate(occurrenceDate(o), { day: 'numeric', month: 'short' }) }}</small>
            </button>
          </div>
        </section>

        <div v-if="current.def.tags?.length" class="tags">
          <span v-for="tag in current.def.tags" :key="tag" class="tag">#{{ tag }}</span>
        </div>
      </div>

      <footer class="foot">
        <button class="btn-ghost" @click="share">
          <i class="bi bi-share" aria-hidden="true"></i>
          {{ copied ? t.copied : t.share }}
        </button>
        <button class="btn-solid" @click="dialog.close()">{{ t.close }}</button>
      </footer>
    </article>
  </dialog>
</template>

<style lang="scss" scoped>
.festival-dialog {
  width: min(32rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  padding: 0;
  border: none;
  border-radius: radius('lg');
  background: transparent;
  color: token(text);
  overflow: visible;

  &::backdrop {
    background: rgba(10, 20, 15, 0.55);
    backdrop-filter: blur(4px);
  }

  &[open] {
    animation: pop-in 0.25s $ease-out;
  }
}

.panel {
  @include card;
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 2rem);
  overflow: hidden;
}

// ── Hero header (mirrors the Today card in DayDetails) ──
.hero {
  position: relative;
  flex-shrink: 0;
  padding: 1rem 1.25rem 1.75rem;
  color: #fff;
  background:
    radial-gradient(circle at 100% 0%, token(accent-glow), transparent 55%),
    radial-gradient(circle at 0% 100%, color-mix(in srgb, var(--cat) 35%, transparent), transparent 60%),
    linear-gradient(160deg, token(hero-start), token(hero-end));

  // kasavu hem: double gold stripe
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

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.9rem;
}

.category {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.8rem;
  border-radius: radius('pill');
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;

  .bi {
    color: token(accent);
  }
}

.icon-btn {
  @include reset-button;
  @include focus-ring;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  transition: background 0.15s, transform 0.15s $ease-out;

  &:hover {
    background: rgba(255, 255, 255, 0.22);
    color: #fff;
    transform: rotate(90deg);
  }
}

.title {
  margin: 0;
  font-size: clamp(1.6rem, 6vw, 2rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.01em;
}

.alt-name {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: token(accent);
}

.when {
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}

.when-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;

  .bi {
    color: token(accent);
  }
}

.when-sub {
  margin-top: 0.2rem;
  padding-left: 1.5rem;
  font-size: 0.85rem;
  opacity: 0.8;
}

// ── Festival switcher ──
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 1rem 1.25rem 0;
}

.tab {
  @include reset-button;
  @include focus-ring;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.8rem;
  border-radius: radius('pill');
  border: 1px solid token(border);
  background: token(surface-2);
  font-size: 0.8rem;
  font-weight: 600;
  color: token(muted);
  transition: all 0.15s;

  &:hover {
    color: token(text);
  }

  &[aria-selected='true'] {
    border-color: var(--cat);
    background: color-mix(in srgb, var(--cat) 14%, token(surface));
    color: var(--cat);
  }
}

.tab-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--cat);
}

// ── Body ──
.body {
  flex: 1;
  min-height: 0;
  padding: 0.5rem 1.25rem 0.5rem;
  overflow-y: auto;
}

.span-days {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
  gap: 0.4rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0.6rem;
    border-radius: radius('sm');
    background: token(surface-2);
    border-left: 3px solid token(accent);
    font-size: 0.75rem;
  }
}

.sd-date {
  font-weight: 700;
}

.sd-week {
  color: token(muted);
}

.sd-nak {
  color: token(primary);
  font-weight: 600;
}

.fact {
  margin-top: 1rem;
  padding: 0.85rem 1rem;
  border-radius: radius('md');
  background: token(surface-2);

  h3 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0 0 0.4rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: token(primary);

    .bi {
      font-size: 0.85rem;
      color: token(accent-strong);
    }
  }

  p {
    margin: 0;
    line-height: 1.5;
  }
}

.source {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0.05rem 0.5rem;
  border-radius: radius('pill');
  font-size: 0.68rem;
  font-weight: 700;
  vertical-align: middle;
  background: token(surface);
  color: token(muted);

  &.override {
    background: token(primary-soft);
    color: token(primary);
  }
}

.note {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.5rem !important;
  font-size: 0.8rem;
  color: token(muted);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  @include reset-button;
  @include focus-ring;
  padding: 0.35rem 0.8rem;
  border-radius: radius('pill');
  background: token(surface);
  border: 1px solid color-mix(in srgb, var(--cat) 35%, transparent);
  color: var(--cat);
  font-size: 0.8rem;
  font-weight: 600;
  transition: background 0.15s, transform 0.15s $ease-out;

  small {
    margin-left: 0.25rem;
    color: token(muted);
    font-weight: 500;
  }

  &:hover {
    background: color-mix(in srgb, var(--cat) 12%, token(surface));
    transform: translateY(-1px);
  }
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 1rem;
}

.tag {
  padding: 0.15rem 0.55rem;
  border-radius: radius('pill');
  background: color-mix(in srgb, token(accent) 14%, transparent);
  color: token(accent-strong);
  font-size: 0.72rem;
  font-weight: 600;
}

// ── Footer ──
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
  padding: 0.85rem 1.25rem 1.1rem;
  border-top: 1px solid token(border);
}

.btn-ghost,
.btn-solid {
  @include reset-button;
  @include focus-ring;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.1rem;
  border-radius: radius('pill');
  font-size: 0.875rem;
  font-weight: 600;
  transition: background 0.15s, box-shadow 0.15s;
}

.btn-ghost {
  color: token(primary);
  border: 1px solid token(primary-soft);

  &:hover {
    background: token(primary-soft);
  }
}

.btn-solid {
  background: linear-gradient(160deg, token(hero-start), token(hero-end));
  color: #fff;
  box-shadow: inset 0 -2px 0 token(accent);

  &:hover {
    box-shadow: inset 0 -2px 0 token(accent), 0 8px 20px -8px token(accent-glow);
  }
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
}

@include reduced-motion {
  .festival-dialog[open] {
    animation: none;
  }
}
</style>

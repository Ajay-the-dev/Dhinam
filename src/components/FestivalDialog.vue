<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useCalendarStore } from '@/stores/calenderStore.js';
import {
  festivalName, categoryName, describeRule, dateNote, festivalsForYear, occurrenceDate,
} from '@/lib/festivals.js';
import { toMalayalamDate, monthName, nakshatraOn, nakshatraName } from '@/lib/malayalam.js';

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
  const nak = nakshatraName(nakshatraOn(d).index, store.lang);
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
      nak: nakshatraName(nakshatraOn(d).index, store.lang),
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
      <header class="head">
        <span class="category">
          <i :class="`bi bi-${current.category.icon}`" aria-hidden="true"></i>
          {{ categoryName(current.category, store.lang) }}
        </span>
        <button class="icon-btn" :aria-label="t.close" @click="dialog.close()">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
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
          {{ festivalName(o.def, store.lang) }}
        </button>
      </div>

      <div class="body">
        <h2 class="title">{{ festivalName(current.def, store.lang) }}</h2>
        <p class="alt-name" :lang="isMal ? 'en' : 'ml'">{{ isMal ? current.def.name_en : current.def.name_ml }}</p>

        <div class="when">
          <i class="bi bi-calendar-event" aria-hidden="true"></i>
          <div>
            <div class="when-main">{{ dateText }}</div>
            <div v-if="malText" class="when-sub">{{ malText }}</div>
          </div>
        </div>

        <ul v-if="spanDays.length" class="span-days">
          <li v-for="d in spanDays" :key="d.key">
            <span class="sd-date">{{ d.date }}</span>
            <span class="sd-week">{{ d.weekday }}</span>
            <span class="sd-nak">{{ d.nak }}</span>
          </li>
        </ul>

        <section class="fact">
          <h3>{{ t.rule }}</h3>
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
          <h3>{{ t.location }}</h3>
          <p><i class="bi bi-geo-alt" aria-hidden="true"></i> {{ locationText }}</p>
        </section>

        <section v-if="related.length" class="fact">
          <h3>{{ t.related }}</h3>
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

  &::backdrop {
    background: rgba(10, 20, 15, 0.5);
    backdrop-filter: blur(3px);
  }

  &[open] {
    animation: pop-in 0.2s $ease-out;
  }
}

.panel {
  @include card;
  overflow: hidden;
  // category colour band across the top
  border-top: 6px solid var(--cat);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0;
}

.category {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.7rem;
  border-radius: radius('pill');
  background: color-mix(in srgb, var(--cat) 14%, transparent);
  color: var(--cat);
  font-size: 0.78rem;
  font-weight: 700;
}

.icon-btn {
  @include reset-button;
  @include focus-ring;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  color: token(muted);

  &:hover {
    background: token(surface-2);
    color: token(text);
  }
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.75rem 1.25rem 0;
}

.tab {
  @include reset-button;
  @include focus-ring;
  padding: 0.3rem 0.75rem;
  border-radius: radius('pill');
  border: 1px solid token(border);
  font-size: 0.8rem;
  font-weight: 600;
  color: token(muted);

  &[aria-selected='true'] {
    border-color: var(--cat);
    background: color-mix(in srgb, var(--cat) 14%, transparent);
    color: var(--cat);
  }
}

.body {
  padding: 0.75rem 1.25rem 0.5rem;
  max-height: calc(100dvh - 12rem);
  overflow-y: auto;
}

.title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.alt-name {
  margin: 0.1rem 0 1rem;
  color: token(muted);
}

.when {
  display: flex;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: radius('md');
  background: token(surface-2);

  > .bi {
    color: var(--cat);
    font-size: 1.2rem;
  }
}

.when-main {
  font-weight: 700;
}

.when-sub {
  margin-top: 0.15rem;
  font-size: 0.85rem;
  color: token(muted);
}

.span-days {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
  gap: 0.35rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    flex-direction: column;
    padding: 0.4rem 0.55rem;
    border-radius: radius('sm');
    border: 1px solid token(border);
    font-size: 0.75rem;
  }
}

.sd-date {
  font-weight: 700;
}

.sd-week,
.sd-nak {
  color: token(muted);
}

.sd-nak {
  color: var(--cat);
  font-weight: 600;
}

.fact {
  margin-top: 1.1rem;

  h3 {
    margin: 0 0 0.3rem;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: token(muted);
  }

  p {
    margin: 0;
  }
}

.source {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0 0.45rem;
  border-radius: radius('pill');
  font-size: 0.7rem;
  font-weight: 700;
  vertical-align: middle;
  background: token(surface-2);
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
  gap: 0.35rem;
}

.chip {
  @include reset-button;
  @include focus-ring;
  padding: 0.3rem 0.7rem;
  border-radius: radius('pill');
  background: color-mix(in srgb, var(--cat) 12%, transparent);
  color: var(--cat);
  font-size: 0.8rem;
  font-weight: 600;

  small {
    margin-left: 0.25rem;
    color: token(muted);
    font-weight: 500;
  }

  &:hover {
    background: color-mix(in srgb, var(--cat) 22%, transparent);
  }
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 1rem;
}

.tag {
  font-size: 0.75rem;
  color: token(muted);
}

.foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem 1.1rem;
}

.btn-ghost,
.btn-solid {
  @include reset-button;
  @include focus-ring;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: radius('pill');
  font-size: 0.875rem;
  font-weight: 600;
}

.btn-ghost {
  color: token(primary);

  &:hover {
    background: token(primary-soft);
  }
}

.btn-solid {
  background: token(primary);
  color: #fff;

  &:hover {
    background: token(primary-strong);
  }
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

@include reduced-motion {
  .festival-dialog[open] {
    animation: none;
  }
}
</style>

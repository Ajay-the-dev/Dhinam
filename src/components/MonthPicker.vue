<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { MONTHS_EN, MONTHS_ML } from '@/lib/malayalam.js';
import { useIsDesktop } from '@/composables/useIsDesktop.js';

const props = defineProps({
  system: { type: String, required: true }, // 'greg' | 'mal'
  lang: { type: String, required: true },   // 'en' | 'mal'
  year: { type: Number, required: true },
  month: { type: Number, required: true },  // 0-based (Malayalam: 0 = Chingam)
  todayYear: { type: Number, required: true },
  todayMonth: { type: Number, required: true },
});
const emit = defineEmits(['select']);

// Supported range; the Malayalam range is the same span shifted by the era offset
const GREG_MIN = 1800;
const GREG_MAX = 2200;
const bounds = computed(() =>
  props.system === 'mal'
    ? { min: GREG_MIN - 825, max: GREG_MAX - 825 }
    : { min: GREG_MIN, max: GREG_MAX }
);

const isMal = computed(() => props.lang === 'mal');
const isDesktop = useIsDesktop();
const open = ref(false);
const pickerYear = ref(props.year);
const yearInput = ref(String(props.year));
const root = ref(null);
const trigger = ref(null);

const monthNames = computed(() => {
  if (props.system === 'mal') return isMal.value ? MONTHS_ML : MONTHS_EN;
  const locale = isMal.value ? 'ml' : 'default';
  const month = isDesktop.value ? 'long' : 'short';
  return Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(locale, { month }));
});

const labels = computed(() =>
  isMal.value
    ? { prev: 'മുൻ വർഷം', next: 'അടുത്ത വർഷം', year: 'വർഷം', choose: 'മാസവും വർഷവും തിരഞ്ഞെടുക്കുക', thisMonth: 'ഈ മാസം' }
    : { prev: 'Previous year', next: 'Next year', year: 'Year', choose: 'Choose month and year', thisMonth: 'This month' }
);

const clamp = (y) => Math.min(bounds.value.max, Math.max(bounds.value.min, y));

const setYear = (y) => {
  pickerYear.value = clamp(y);
  yearInput.value = String(pickerYear.value);
};

const commitInput = () => {
  const y = parseInt(yearInput.value, 10);
  setYear(Number.isInteger(y) ? y : pickerYear.value);
};

const toggle = () => {
  open.value = !open.value;
};

const close = (refocus = false) => {
  open.value = false;
  if (refocus) trigger.value?.focus();
};

const choose = (month) => {
  emit('select', pickerYear.value, month);
  close(true);
};

const goThisMonth = () => {
  emit('select', props.todayYear, props.todayMonth);
  close(true);
};

const onPointerDown = (e) => {
  if (root.value && !root.value.contains(e.target)) close();
};

watch(open, async (isOpen) => {
  if (isOpen) {
    setYear(props.year);
    document.addEventListener('pointerdown', onPointerDown);
    await nextTick();
    root.value?.querySelector('.month-btn.current')?.focus();
  } else {
    document.removeEventListener('pointerdown', onPointerDown);
  }
});

// Switching calendar system while open would mix up year scales; just close
watch(() => props.system, () => close());

onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown));
</script>

<template>
  <div ref="root" class="month-picker" @keydown.esc.stop="close(true)">
    <button
      ref="trigger"
      class="trigger"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="labels.choose"
      @click="toggle"
    >
      <slot />
      <svg class="caret" :class="{ open }" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <Transition name="pop">
      <div v-if="open" class="panel" role="dialog" :aria-label="labels.choose">
        <div class="year-row">
          <button class="step" :aria-label="labels.prev" :disabled="pickerYear <= bounds.min" @click="setYear(pickerYear - 1)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <input
            v-model="yearInput"
            class="year-input"
            type="number"
            inputmode="numeric"
            :min="bounds.min"
            :max="bounds.max"
            :aria-label="labels.year"
            @change="commitInput"
            @keydown.enter.prevent="commitInput"
          />
          <button class="step" :aria-label="labels.next" :disabled="pickerYear >= bounds.max" @click="setYear(pickerYear + 1)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>

        <div class="months" :class="{ wide: system === 'mal' || isDesktop }">
          <button
            v-for="(name, i) in monthNames"
            :key="i"
            class="month-btn"
            :class="{
              current: pickerYear === year && i === month,
              'is-today': pickerYear === todayYear && i === todayMonth,
            }"
            :aria-current="pickerYear === year && i === month ? 'true' : undefined"
            @click="choose(i)"
          >
            {{ name }}
          </button>
        </div>

        <button class="this-month" @click="goThisMonth">{{ labels.thisMonth }}</button>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.month-picker {
  position: relative;
}

.trigger {
  @include reset-button;
  @include focus-ring;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: -0.25rem -0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: radius('md');
  text-align: left;
  transition: background 0.2s;

  &:hover {
    background: token(surface-2);
  }
}

.caret {
  flex: none;
  width: 1.4rem;
  height: 1.4rem;
  fill: none;
  stroke: token(muted);
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.2s $ease-out;

  &.open {
    transform: rotate(180deg);
  }
}

.panel {
  @include card;
  position: absolute;
  top: calc(100% + 0.6rem);
  left: 0;
  z-index: 20;
  width: min(21rem, calc(100vw - 2rem));
  padding: 1rem;
}

.year-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}

.step {
  @include reset-button;
  @include focus-ring;
  display: grid;
  place-items: center;
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 1px solid token(border);
  color: token(text);
  transition: background 0.2s;

  svg {
    width: 1.1rem;
    height: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.25;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover:not(:disabled) {
    background: token(primary-soft);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.year-input {
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.5rem;
  border: 1px solid token(border);
  border-radius: radius('sm');
  background: token(surface-2);
  color: token(text);
  font: inherit;
  font-size: 1.25rem;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &:focus-visible {
    outline: 2px solid token(accent);
    outline-offset: 1px;
  }
}

.months {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;

  // Full / Malayalam month names are long; give them more room
  &.wide {
    grid-template-columns: repeat(3, 1fr);
  }
}

.month-btn {
  @include reset-button;
  @include focus-ring;
  position: relative;
  padding: 0.6rem 0.25rem;
  border-radius: radius('sm');
  font-size: 0.875rem;
  font-weight: 600;
  color: token(text);
  background: token(surface-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: token(primary-soft);
  }

  &.is-today {
    box-shadow: inset 0 0 0 2px token(accent);
  }

  &.current {
    background: token(primary);
    color: #fff;
  }
}

.this-month {
  @include reset-button;
  @include focus-ring;
  display: block;
  width: 100%;
  margin-top: 0.85rem;
  padding: 0.5rem;
  border-radius: radius('pill');
  font-size: 0.85rem;
  font-weight: 600;
  color: token(primary);
  background: token(primary-soft);

  &:hover {
    background: token(primary);
    color: #fff;
  }
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.16s ease, transform 0.16s $ease-out;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

@include reduced-motion {
  .pop-enter-active,
  .pop-leave-active,
  .caret {
    transition: none;
  }
}
</style>

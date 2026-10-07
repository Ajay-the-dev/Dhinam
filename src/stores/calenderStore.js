// stores/calenderStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { toMalayalamDate, malMonthStart, nakshatraOn } from '@/lib/malayalam.js';
import { festivalsOn, ongoingOn, upcomingFrom } from '@/lib/festivals.js';

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

export const useCalendarStore = defineStore('calendar', () => {
  const today = ref(new Date());
  const selectedDate = ref(new Date(today.value));
  const lang = ref('en');

  // Which calendar the grid is laid out in: 'greg' (Gregorian) or 'mal' (Kollavarsham)
  const system = ref('greg');
  // Displayed Gregorian month (always the 1st) and displayed Malayalam month
  const viewDate = ref(new Date(today.value.getFullYear(), today.value.getMonth(), 1));
  const todayMal = toMalayalamDate(today.value);
  const viewMal = ref({ year: todayMal.year, month: todayMal.month });

  // Navigation actions
  const setMonth = (year, month) => {
    viewDate.value = new Date(year, month, 1);
  };

  const setMalMonth = (year, month) => {
    viewMal.value = { year, month };
  };

  const setSystem = (value) => {
    system.value = value;
  };

  const nextMonth = () => {
    setMonth(viewDate.value.getFullYear(), viewDate.value.getMonth() + 1);
  };

  const prevMonth = () => {
    setMonth(viewDate.value.getFullYear(), viewDate.value.getMonth() - 1);
  };

  // Point both calendars at the month containing today, without touching the selection
  const showTodayMonth = () => {
    today.value = new Date();
    setMonth(today.value.getFullYear(), today.value.getMonth());
    const m = toMalayalamDate(today.value);
    setMalMonth(m.year, m.month);
  };

  const goToToday = () => {
    showTodayMonth();
    selectedDate.value = new Date(today.value);
  };

  const selectDate = (date) => {
    selectedDate.value = new Date(date);
  };

  const setLang = (value) => {
    lang.value = value;
  };

  const toggleLang = () => {
    lang.value = lang.value === 'mal' ? 'en' : 'mal';
  };

  const isToday = (date) => sameDay(date, today.value);
  const isSelected = (date) => sameDay(date, selectedDate.value);

  // First day and length of the displayed month, in whichever system is active
  const viewRange = computed(() => {
    if (system.value === 'mal') {
      const start = malMonthStart(viewMal.value.year, viewMal.value.month);
      return { start, length: toMalayalamDate(start).monthLength };
    }
    const y = viewDate.value.getFullYear();
    const m = viewDate.value.getMonth();
    return { start: new Date(y, m, 1), length: new Date(y, m + 1, 0).getDate() };
  });

  // Monotonic month number in the active system; used for slide direction
  const viewOrdinal = computed(() =>
    system.value === 'mal'
      ? viewMal.value.year * 12 + viewMal.value.month
      : viewDate.value.getFullYear() * 12 + viewDate.value.getMonth()
  );

  // Logic to generate the grid (6 weeks to cover all overlaps)
  const daysInGrid = computed(() => {
    const { start, length } = viewRange.value;
    const lead = start.getDay();
    const grid = [];

    for (let i = 0; i < 42; i++) {
      const date = addDays(start, i - lead);
      const mal = toMalayalamDate(date);
      grid.push({
        date,
        mal,
        nak: nakshatraOn(date),
        festivals: festivalsOn(date),
        // `day` is the big number in the cell: the date in the active system
        day: system.value === 'mal' ? mal.day : date.getDate(),
        currentMonth: i >= lead && i < lead + length,
      });
    }

    return grid;
  });

  const isInView = (date) => {
    const { start, length } = viewRange.value;
    return date >= start && date < addDays(start, length);
  };

  // A date to keep in view when switching systems: the selection if visible, else mid-month
  const anchorDate = computed(() =>
    isInView(selectedDate.value) ? selectedDate.value : addDays(viewRange.value.start, 14)
  );

  const selectedMal = computed(() => toMalayalamDate(selectedDate.value));
  const selectedNak = computed(() => nakshatraOn(selectedDate.value));
  const selectedFestivals = computed(() => festivalsOn(selectedDate.value));
  const selectedOngoing = computed(() => ongoingOn(selectedDate.value));
  const upcomingFestivals = computed(() => upcomingFrom(addDays(selectedDate.value, 1), 4));

  // Festival details dialog: the festivals of one day, with one of them shown
  const festivalDialog = ref(null); // { items: occurrence[], key }
  const openFestival = (items, key = items[0]?.key) => {
    if (items.length) festivalDialog.value = { items, key };
  };
  const closeFestival = () => {
    festivalDialog.value = null;
  };

  // Malayalam months overlapping the displayed Gregorian month
  const viewMalRange = computed(() => {
    const y = viewDate.value.getFullYear();
    const m = viewDate.value.getMonth();
    return {
      first: toMalayalamDate(new Date(y, m, 1)),
      last: toMalayalamDate(new Date(y, m + 1, 0)),
    };
  });

  // Gregorian dates spanned by the displayed Malayalam month
  const viewGregRange = computed(() => {
    const { start, length } = viewRange.value;
    return { first: start, last: addDays(start, length - 1) };
  });

  return {
    selectedMal, selectedNak, selectedFestivals, selectedOngoing, upcomingFestivals,
    festivalDialog, openFestival, closeFestival,
    viewMalRange, viewGregRange, viewRange, viewOrdinal, anchorDate,
    today, viewDate, viewMal, selectedDate, lang, system,
    setMonth, setMalMonth, setSystem, nextMonth, prevMonth, showTodayMonth, goToToday,
    selectDate, setLang, toggleLang,
    isToday, isSelected, isInView, daysInGrid,
  };
});

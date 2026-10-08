<template>
    <MainView>
        <template #primary>
            <div class="primary-content">
                <Cal />
                <HolidaysCard />
            </div>
        </template>
        <template #secondary>
            <div class="secondary-content">
                <DayDetails />
            </div>
        </template>
    </MainView>
    <FestivalDialog />
</template>

<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import MainView from '../views/main.vue'
import Cal from "@/components/calender.vue";
import DayDetails from "@/components/DayDetails.vue";
import FestivalDialog from "@/components/FestivalDialog.vue";
import HolidaysCard from "@/components/HolidaysCard.vue";
import { useCalendarStore } from '@/stores/calenderStore.js';

const props = defineProps({
    year: String,
    month: String,
})

const store = useCalendarStore();
const route = useRoute();

// Keep the store's calendar system and displayed month in sync with
// /calendar/:year/:month (Gregorian) and /kollavarsham/:year/:month (Malayalam)
watch(
    () => [route.name, props.year, props.month],
    ([name, year, month]) => {
        if (name === 'Calendar' || name === 'MalCalendar') {
            store.setSystem(name === 'MalCalendar' ? 'mal' : 'greg');
        }

        const y = parseInt(year);
        const m = parseInt(month);
        if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
            if (name === 'MalCalendar') store.setMalMonth(y, m - 1);
            else store.setMonth(y, m - 1);
        } else if (year === undefined) {
            store.showTodayMonth();
        }
    },
    { immediate: true }
)
</script>

<style lang="scss" scoped>
.primary-content {
    display: grid;
    // minmax(0, …) so long unwrapped text can't stretch the column past the screen
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
    min-width: 0;
}

// Phones/tablets: unwrap so DayDetails' cards can be ordered around the calendar
.secondary-content {
    @include down('lg') {
        display: contents;
    }
}
</style>

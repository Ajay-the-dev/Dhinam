<template>
    <main class="main-layout">
        <div class="slot-primary">
            <slot name="primary" />
        </div>
        <aside class="slot-secondary">
            <slot name="secondary" />
        </aside>
    </main>
</template>

<script setup>

</script>

<style lang="scss" scoped>
.main-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
    padding: 0 1rem 2rem;

    @include up('lg') {
        grid-template-columns: minmax(0, 1fr) 340px;
        align-items: start;
        padding: 0 2rem 2rem;
    }
}

.slot-secondary {
    // Phones/tablets: unwrap so the sidebar's cards become grid items that
    // DayDetails can order around the calendar (Today card → calendar → info card)
    @include down('lg') {
        display: contents;
    }

    @include up('lg') {
        position: sticky;
        top: 1.5rem;
    }
}
</style>

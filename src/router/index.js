const routes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('@/components/Home.vue')
    },
    {
        path: '/calendar/:year?/:month?',
        name: 'Calendar',
        component: () => import('@/components/Home.vue'),
        props: true
    },
    {
        // Malayalam Era year, month 1 = Chingam … 12 = Karkidakam
        path: '/kollavarsham/:year?/:month?',
        name: 'MalCalendar',
        component: () => import('@/components/Home.vue'),
        props: true
    }
];

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router  ;

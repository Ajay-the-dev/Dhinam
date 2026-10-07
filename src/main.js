import { createApp } from 'vue'
// import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/main.scss'
const pinia = createPinia()
createApp(App).use(pinia).use(router).mount('#app')

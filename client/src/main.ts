import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth';
import { setUnauthorizedHandler } from './api';
import './assets/main.css';

const app = createApp(App).use(createPinia()).use(router);

// A rejected token ends the session and sends the user to log in again,
// returning them to the page they were on.
setUnauthorizedHandler(() => {
  const auth = useAuthStore();
  if (!auth.isLoggedIn) return;
  auth.logout();
  router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath, expired: '1' } });
});

app.mount('#app');

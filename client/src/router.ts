import { createRouter, createWebHistory } from 'vue-router';
import LandingView from './views/LandingView.vue';
import JoinView from './views/JoinView.vue';
import LoginView from './views/LoginView.vue';
import SignupView from './views/SignupView.vue';
import DashboardView from './views/DashboardView.vue';
import EditView from './views/EditView.vue';
import PresentView from './views/PresentView.vue';
import AudienceView from './views/AudienceView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: LandingView },
    { path: '/join', name: 'join', component: JoinView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/signup', name: 'signup', component: SignupView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/edit/:id', name: 'edit', component: EditView, meta: { requiresAuth: true } },
    { path: '/present/:code', name: 'present', component: PresentView, meta: { bare: true } },
    { path: '/p/:code', name: 'audience', component: AudienceView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !localStorage.getItem('livepoll.token')) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

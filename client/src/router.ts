import { createRouter, createWebHistory } from 'vue-router';
import LandingView from './views/LandingView.vue';
import JoinView from './views/JoinView.vue';
import LoginView from './views/LoginView.vue';
import SignupView from './views/SignupView.vue';
import DashboardView from './views/DashboardView.vue';
import EditView from './views/EditView.vue';
import PresentView from './views/PresentView.vue';
import AudienceView from './views/AudienceView.vue';
import NotFoundView from './views/NotFoundView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: LandingView, meta: { title: 'CrowdFlow - real-time audience polling' } },
    { path: '/join', name: 'join', component: JoinView, meta: { title: 'Join a presentation' } },
    { path: '/login', name: 'login', component: LoginView, meta: { title: 'Log in' } },
    { path: '/signup', name: 'signup', component: SignupView, meta: { title: 'Sign up' } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { title: 'My presentations', requiresAuth: true } },
    { path: '/edit/:id', name: 'edit', component: EditView, meta: { title: 'Edit presentation', requiresAuth: true } },
    { path: '/present/:code', name: 'present', component: PresentView, meta: { title: 'Presenting', bare: true } },
    { path: '/p/:code', name: 'audience', component: AudienceView, meta: { title: 'Live presentation', bare: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView, meta: { title: 'Page not found' } },
  ],
});

const APP_NAME = 'CrowdFlow';

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : APP_NAME;
  document.title = to.name === 'home' || title.startsWith(APP_NAME) ? title : `${title} - ${APP_NAME}`;
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !localStorage.getItem('livepoll.token')) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

import { createRouter, createWebHistory } from 'vue-router';
import LandingView from './views/LandingView.vue';
import JoinView from './views/JoinView.vue';
import LoginView from './views/LoginView.vue';
import SignupView from './views/SignupView.vue';
import ForgotPasswordView from './views/ForgotPasswordView.vue';
import FinishSetupView from './views/FinishSetupView.vue';
import MoveAccountView from './views/MoveAccountView.vue';
import { useAuthStore } from './stores/auth';
import DashboardView from './views/DashboardView.vue';
import EditView from './views/EditView.vue';
import PresentView from './views/PresentView.vue';
import AudienceView from './views/AudienceView.vue';
import NotFoundView from './views/NotFoundView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: LandingView, meta: { title: 'CrowdFlow - interactive real-time presentations' } },
    { path: '/join', name: 'join', component: JoinView, meta: { title: 'Join a presentation' } },
    { path: '/login', name: 'login', component: LoginView, meta: { title: 'Log in' } },
    { path: '/signup', name: 'signup', component: SignupView, meta: { title: 'Sign up' } },
    { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView, meta: { title: 'Reset your password' } },
    { path: '/finish-setup', name: 'finish-setup', component: FinishSetupView, meta: { title: 'Finish setting up' } },
    { path: '/move-account', name: 'move-account', component: MoveAccountView, meta: { title: 'Move your account' } },
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

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;
  // With Firebase the saved session is restored asynchronously, so wait for it first.
  const auth = useAuthStore();
  await auth.init();
  if (auth.pendingProfile) return { name: 'finish-setup' };
  if (!auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

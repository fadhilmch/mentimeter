import { defineConfig } from '@playwright/test'

// Critical-flow browser tests. They boot the in-memory server (it also serves client/dist),
// so build the client first: `npm run build && npm run test:e2e`.
const PORT = Number(process.env.E2E_PORT ?? 3199)

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Set E2E_CHROME=/path/to/chrome to use an installed browser instead of `playwright install chromium`.
    launchOptions: process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME, args: ['--no-sandbox'] } : {},
  },
  webServer: {
    command: 'npm --prefix server run dev:memory',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})

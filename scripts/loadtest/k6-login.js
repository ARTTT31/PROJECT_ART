/**
 * k6 load test — health + login (ART Workspace).
 *
 * RUN IT AGAINST STAGING ONLY. A load test against production is an outage
 * generator: the login endpoint writes session rows and the rate limiter will
 * (correctly) start answering 429 for everyone else.
 *
 * Usage:
 *   k6 run -e BASE_URL=https://staging-backend.example.com \
 *          -e TEST_EMAIL=loadtest@example.com \
 *          -e TEST_PASSWORD='...' \
 *          scripts/loadtest/k6-login.js
 *
 * Without TEST_EMAIL/TEST_PASSWORD the script only exercises the health
 * endpoints — still useful to size the read path and check the readiness probe
 * under load.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    login: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 }, // ramp up
        { duration: '1m', target: 10 }, // steady state
        { duration: '15s', target: 0 }, // ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // A healthy staging box at this load: <1% failures, p95 under 800 ms.
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const EMAIL = __ENV.TEST_EMAIL;
const PASSWORD = __ENV.TEST_PASSWORD;

export default function () {
  const ready = http.get(`${BASE_URL}/health/ready`, { tags: { endpoint: 'health' } });
  check(ready, {
    'readiness is 200': (r) => r.status === 200,
    'readiness reports database ok': (r) => {
      try {
        return r.json('database.status') === 'ok';
      } catch (error) {
        return false;
      }
    },
  });

  if (EMAIL && PASSWORD) {
    const login = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email: EMAIL, password: PASSWORD }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'login' },
      },
    );
    check(login, {
      // 429 is a legitimate answer from the rate limiter; it must not be
      // counted as a crash, but a surge of them means the limit is sized wrong
      // for your real traffic.
      'login answered (200 or 429)': (r) => r.status === 200 || r.status === 429,
    });
  }

  sleep(1);
}

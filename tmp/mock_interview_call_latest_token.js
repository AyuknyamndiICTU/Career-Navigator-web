const fs = require('fs');

const login = JSON.parse(fs.readFileSync('tmp/login_response_latest.json', 'utf8'));
const token =
  login.accessToken ||
  (login.body && login.body.accessToken) ||
  login.access_token ||
  login.accessToken;

if (!token) {
  console.error('Missing accessToken in tmp/login_response_latest.json');
  process.exit(1);
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new Error(`timeout_after_${ms}ms`)), ms);
  return { signal: controller.signal, cleanup: () => clearTimeout(id) };
}

(async () => {
  const { signal, cleanup } = timeoutSignal(20000);

  try {
    const res = await fetch('http://localhost:3001/ai/mock-interview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: 'Gardening manager',
        allowedSkills: ['node', 'typescript'],
        difficulty: 'beginner',
      }),
      signal,
    });

    const text = await res.text();
    console.log('HTTP', res.status);
    console.log(text);
  } catch (e) {
    console.log('FETCH_ERROR', String(e && e.message ? e.message : e));
  } finally {
    cleanup();
  }
})();

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

(async () => {
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
  });

  const text = await res.text();
  console.log('HTTP', res.status);
  console.log(text);
})();

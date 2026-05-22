import fs from 'node:fs';

const API_BASE = 'http://localhost:3000';

const loginBody = JSON.parse(fs.readFileSync('/tmp/login_body.json', 'utf8'));
const mockBodyValid = {
  role: 'Gardening manager',
  allowedSkills: ['node', 'typescript'],
  difficulty: 'beginner',
};

async function postJson(url, token, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

const loginRes = await postJson(`${API_BASE}/auth/login`, null, loginBody);
const token = loginRes.json?.accessToken;

if (!token) {
  console.log('LOGIN_FAILED', { status: loginRes.status, body: loginRes.json ?? loginRes.text });
  process.exit(1);
}

const mockRes = await postJson(`${API_BASE}/ai/mock-interview`, token, mockBodyValid);

console.log(JSON.stringify({ mockInterview: { status: mockRes.status, body: mockRes.json ?? mockRes.text } }, null, 2));
if (mockRes.status !== 200) process.exit(1);

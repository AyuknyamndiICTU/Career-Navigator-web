import fs from 'node:fs';

const loginBody = JSON.parse(fs.readFileSync('/tmp/login_body.json', 'utf8'));
const chatBody = JSON.parse(fs.readFileSync('/tmp/ai_chat_body.json', 'utf8'));

const API_BASE = 'http://localhost:3000';

const loginRes = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(loginBody),
});

const loginText = await loginRes.text();
let loginJson;
try {
  loginJson = JSON.parse(loginText);
} catch {
  throw new Error(`Login response was not JSON. status=${loginRes.status} body=${loginText}`);
}

const token = loginJson?.accessToken;
if (!token) throw new Error(`Missing accessToken in login response: ${loginText}`);

const chatRes = await fetch(`${API_BASE}/ai/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(chatBody),
});

const chatText = await chatRes.text();

console.log(JSON.stringify({ status: chatRes.status, body: chatText }, null, 2));

if (!chatRes.ok) process.exit(1);

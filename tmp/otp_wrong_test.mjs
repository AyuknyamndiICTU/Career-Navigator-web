import fs from 'node:fs';

const body = JSON.parse(fs.readFileSync('/tmp/otp_wrong_body.json', 'utf8'));

const res = await fetch('http://localhost:3000/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(JSON.stringify({ status: res.status, body: text }, null, 2));

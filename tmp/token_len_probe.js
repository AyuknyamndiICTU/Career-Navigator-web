const fs = require('fs');

const j = JSON.parse(fs.readFileSync('tmp/login_response_latest.json', 'utf8'));
const t =
  j.accessToken ||
  (j.body && j.body.accessToken) ||
  j.access_token ||
  j.accessToken;

console.log('token_len', (t || '').length);

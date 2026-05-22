import fs from 'node:fs';

const API_BASE = 'http://localhost:3000';

const loginBody = JSON.parse(fs.readFileSync('/tmp/login_body.json', 'utf8'));
const mockBodyValid = {
  role: 'Gardening manager', // intentionally unrelated
  allowedSkills: ['node', 'typescript'],
  difficulty: 'beginner',
};
const courseBodyValid = {
  allowedSkills: ['node', 'typescript'],
  studentGoal: 'Become a chef', // intentionally unrelated
};

// Also test invalid allowedSkills (should be rejected by resolveAllowedSkills)
const mockBodyInvalidSkills = {
  role: 'Frontend dev',
  allowedSkills: ['quantum-cooking'], // not in career skills
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
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  return { status: res.status, text, json };
}

const loginRes = await postJson(`${API_BASE}/auth/login`, null, loginBody);
const token = loginRes.json?.accessToken;

if (!token) {
  console.log('LOGIN_FAILED', { status: loginRes.status, text: loginRes.text });
  process.exit(1);
}

const mockRes = await postJson(`${API_BASE}/ai/mock-interview`, token, mockBodyValid);
const courseRes = await postJson(`${API_BASE}/ai/course-recommendations`, token, courseBodyValid);
const mockInvalidRes = await postJson(`${API_BASE}/ai/mock-interview`, token, mockBodyInvalidSkills);

console.log(JSON.stringify({
  mockInterview: { status: mockRes.status, body: mockRes.json ?? mockRes.text },
  courseRecommendations: { status: courseRes.status, body: courseRes.json ?? courseRes.text },
  mockInterviewInvalidAllowedSkills: { status: mockInvalidRes.status, body: mockInvalidRes.json ?? mockInvalidRes.text },
}, null, 2));

if (mockRes.status !== 200 || courseRes.status !== 200) process.exit(1);

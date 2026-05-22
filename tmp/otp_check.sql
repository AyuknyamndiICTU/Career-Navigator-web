-- Latest OTP row for test user (include createdAt to check freshness)
select
  ev.id,
  ev."createdAt",
  ev."expiresAt",
  ev."usedAt",
  ev.attempts
from public."EmailVerificationOtp" ev
join public."User" u on u.id = ev."userId"
where u.email = 'test_otp@example.com'
  and ev.purpose = 'REGISTER'
order by ev."createdAt" desc
limit 1;

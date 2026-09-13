# Auth Testing Playbook (Emergent Google OAuth)

Backend stores sessions in `user_sessions` collection with fields: `user_id`, `session_token`, `expires_at`, `created_at`.
Users stored in `users` with custom `user_id` (UUID). MongoDB `_id` always excluded via `{"_id": 0}`.

## Step 1: Create Test User & Session
```
mongosh --eval "
use('test_database');
var userId = 'user_testadmin001';
var sessionToken = 'test_session_' + Date.now();
db.users.updateOne({user_id:userId},{ \$set:{
  user_id: userId,
  email: 'admin@globetrotter.app',
  name: 'Demo Admin',
  first_name:'Demo', last_name:'Admin',
  picture: 'https://i.pravatar.cc/150?img=12',
  city:'Ahmedabad', country:'India', phone:'', additional_info:'',
  is_admin: true, profile_complete:true,
  created_at: new Date().toISOString()
}}, {upsert:true});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
"
```

## Step 2: Test Backend API
```
curl -s "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE/api/trips" -H "Authorization: Bearer $TOKEN"
```

## Step 3: Browser Testing (set cookie)
```
await page.context.add_cookies([{ "name":"session_token","value": TOKEN,
  "domain":"<host>","path":"/","httpOnly":true,"secure":true,"sameSite":"None"}])
```

## Notes
- No password-based creds (Google OAuth).
- Admin account: admin@globetrotter.app (is_admin=true).
- Demo user: traveler@globetrotter.app.

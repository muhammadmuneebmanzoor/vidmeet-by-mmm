import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function runTests() {
  console.log('--- STARTING HOST-CONTROL AUTHORIZATION TESTS ---');
  const baseUrl = 'http://localhost:3000';

  // 1. Setup Host & Non-host Users
  const hostId = 'fd7d72c1-616f-4b11-8991-ab95130ce9a9';
  const nonHostId = '6498c8ce-58cd-4f35-a369-e7cee9b8ee78';

  await admin.auth.admin.updateUserById(hostId, { password: 'SecureHostPassword123!' });
  await admin.auth.admin.updateUserById(nonHostId, { password: 'SecureNonHostPassword123!' });

  const client1 = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: hostAuth } = await client1.auth.signInWithPassword({
    email: 'user_rls_test@gmail.com',
    password: 'SecureHostPassword123!'
  });

  const client2 = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: nonHostAuth } = await client2.auth.signInWithPassword({
    email: 'muneebtest8897@gmail.com',
    password: 'SecureNonHostPassword123!'
  });

  const hostToken = hostAuth!.session!.access_token;
  const nonHostToken = nonHostAuth!.session!.access_token;

  // 2. Create a clean test meeting owned by the Host
  const testRoomId = `test-auth-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: testMeeting, error: meetErr } = await admin
    .from('meetings')
    .insert({
      title: 'Host Control Auth Verification Room',
      room_id: testRoomId,
      host_id: hostId,
      status: 'active'
    })
    .select()
    .single();

  if (meetErr || !testMeeting) {
    throw new Error('Failed to create test meeting in Supabase: ' + JSON.stringify(meetErr));
  }

  console.log(`Created test meeting ${testMeeting.id} with room_id: ${testRoomId}, host_id: ${testMeeting.host_id}`);

  // Endpoints to test
  const endpoints = [
    {
      name: 'mute participant',
      path: `/api/meetings/${testRoomId}/host/mute`,
      payload: { participantIdentity: 'p-user-dummy', trackSid: 'TR_dummy' }
    },
    {
      name: 'mute all',
      path: `/api/meetings/${testRoomId}/host/mute-all`,
      payload: {}
    },
    {
      name: 'remove participant',
      path: `/api/meetings/${testRoomId}/host/remove`,
      payload: { participantIdentity: 'p-user-dummy' }
    },
    {
      name: 'lock meeting',
      path: `/api/meetings/${testRoomId}/host/lock`,
      payload: { isLocked: true }
    },
    {
      name: 'end meeting',
      path: `/api/meetings/${testRoomId}/host/end`,
      payload: {}
    }
  ];

  let passedAll = true;

  for (const ep of endpoints) {
    console.log(`\nTesting endpoint [${ep.name}]: ${ep.path}`);

    // TEST A: Unauthenticated request (no header) -> 401
    const resUnauth = await fetch(`${baseUrl}${ep.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ep.payload)
    });
    const statusUnauth = resUnauth.status;
    const isUnauthOk = statusUnauth === 401;
    console.log(`  - Unauthenticated (no token): HTTP ${statusUnauth} (Expected: 401) => ${isUnauthOk ? 'PASS' : 'FAIL'}`);
    if (!isUnauthOk) passedAll = false;

    // TEST B: Unauthenticated request (invalid token) -> 401
    const resInvalidToken = await fetch(`${baseUrl}${ep.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token-12345'
      },
      body: JSON.stringify(ep.payload)
    });
    const statusInvalid = resInvalidToken.status;
    const isInvalidOk = statusInvalid === 401;
    console.log(`  - Unauthenticated (invalid token): HTTP ${statusInvalid} (Expected: 401) => ${isInvalidOk ? 'PASS' : 'FAIL'}`);
    if (!isInvalidOk) passedAll = false;

    // TEST C: Authenticated non-host request -> 403
    const resNonHost = await fetch(`${baseUrl}${ep.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nonHostToken}`
      },
      body: JSON.stringify(ep.payload)
    });
    const statusNonHost = resNonHost.status;
    const isNonHostOk = statusNonHost === 403;
    console.log(`  - Authenticated non-host: HTTP ${statusNonHost} (Expected: 403) => ${isNonHostOk ? 'PASS' : 'FAIL'}`);
    if (!isNonHostOk) passedAll = false;

    // TEST D: Authenticated non-host attempting privilege escalation (forged role/host_id in body/header) -> 403
    const resSpoofed = await fetch(`${baseUrl}${ep.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nonHostToken}`,
        'X-Role': 'host',
        'X-Host-Id': hostId
      },
      body: JSON.stringify({
        ...ep.payload,
        isHost: true,
        role: 'host',
        host_id: hostId,
        userId: hostId
      })
    });
    const statusSpoofed = resSpoofed.status;
    const isSpoofedOk = statusSpoofed === 403;
    console.log(`  - Non-host with spoofed host credentials/body: HTTP ${statusSpoofed} (Expected: 403) => ${isSpoofedOk ? 'PASS' : 'FAIL'}`);
    if (!isSpoofedOk) passedAll = false;

    // TEST E: Authenticated meeting host -> 200
    const resHost = await fetch(`${baseUrl}${ep.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify(ep.payload)
    });
    const statusHost = resHost.status;
    const isHostOk = statusHost === 200;
    const hostJson = await resHost.json();
    console.log(`  - Authenticated meeting host: HTTP ${statusHost} (Expected: 200) => ${isHostOk ? 'PASS' : 'FAIL'}`);
    if (!isHostOk) {
      console.log('    Response was:', hostJson);
      passedAll = false;
    }
  }

  // Cleanup test meeting
  await admin.from('meetings').delete().eq('id', testMeeting.id);
  console.log('\n--- CLEANUP COMPLETE ---');

  if (passedAll) {
    console.log('\n>>> ALL HOST-CONTROL AUTHORIZATION TESTS PASSED SUCCESSFULLY! <<<');
  } else {
    console.error('\n>>> SOME TESTS FAILED! Check logs above. <<<');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

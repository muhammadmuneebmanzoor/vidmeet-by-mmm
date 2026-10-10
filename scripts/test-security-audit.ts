import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function runSecurityTests() {
  console.log('--- STARTING SECURITY AUDIT & ACCESS CONTROL TESTS ---');
  const baseUrl = 'http://localhost:3000';

  const hostId = 'fd7d72c1-616f-4b11-8991-ab95130ce9a9';
  const nonHostId = '6498c8ce-58cd-4f35-a369-e7cee9b8ee78';

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

  // Create a password-protected test meeting
  const testRoomId = `sec-test-${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = '_videomeet_secure_salt_2026_'; // dummy or let's use API to create

  const createRes = await fetch(`${baseUrl}/api/meetings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hostToken}`
    },
    body: JSON.stringify({
      title: 'Security Audit Password Protected Room',
      password: 'SecretPassword99!',
      isScheduled: false
    })
  });

  const meetingCreated = await createRes.json();
  const protectedRoomCode = meetingCreated.code;
  console.log(`Created password protected room: ${protectedRoomCode}`);

  let passed = true;

  // 1. Test Chat Access on Password Protected Room without password
  const resChatNoPass = await fetch(`${baseUrl}/api/meetings/${protectedRoomCode}/messages`);
  const statusChatNoPass = resChatNoPass.status;
  console.log(`- Chat read without password: HTTP ${statusChatNoPass} (Expected: 401) => ${statusChatNoPass === 401 ? 'PASS' : 'FAIL'}`);
  if (statusChatNoPass !== 401) passed = false;

  // 2. Test Chat Post without password
  const resChatPostNoPass = await fetch(`${baseUrl}/api/meetings/${protectedRoomCode}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello spy', displayName: 'Attacker' })
  });
  console.log(`- Chat write without password: HTTP ${resChatPostNoPass.status} (Expected: 401) => ${resChatPostNoPass.status === 401 ? 'PASS' : 'FAIL'}`);
  if (resChatPostNoPass.status !== 401) passed = false;

  // 3. Test Host Chat Read (Host has automatic verified access)
  const resChatHost = await fetch(`${baseUrl}/api/meetings/${protectedRoomCode}/messages`, {
    headers: { 'Authorization': `Bearer ${hostToken}` }
  });
  console.log(`- Host chat read: HTTP ${resChatHost.status} (Expected: 200) => ${resChatHost.status === 200 ? 'PASS' : 'FAIL'}`);
  if (resChatHost.status !== 200) passed = false;

  // 4. Test Participant with valid password
  const resChatWithPass = await fetch(`${baseUrl}/api/meetings/${protectedRoomCode}/messages`, {
    headers: { 'x-meeting-password': 'SecretPassword99!' }
  });
  console.log(`- Participant chat read with valid password: HTTP ${resChatWithPass.status} (Expected: 200) => ${resChatWithPass.status === 200 ? 'PASS' : 'FAIL'}`);
  if (resChatWithPass.status !== 200) passed = false;

  // 5. Test Chat Post with valid password
  const resChatPostWithPass = await fetch(`${baseUrl}/api/meetings/${protectedRoomCode}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-meeting-password': 'SecretPassword99!'
    },
    body: JSON.stringify({ message: 'Hello team!', displayName: 'Auditor' })
  });
  console.log(`- Participant chat write with valid password: HTTP ${resChatPostWithPass.status} (Expected: 201) => ${resChatPostWithPass.status === 201 ? 'PASS' : 'FAIL'}`);
  if (resChatPostWithPass.status !== 201) passed = false;

  // 6. Test Invalid Room Code Format (Prevent PostgREST injection)
  const resInject = await fetch(`${baseUrl}/api/meetings/verify/foo'OR'1'='1`);
  console.log(`- PostgREST injection attempt blocked: HTTP ${resInject.status} (Expected: 400) => ${resInject.status === 400 ? 'PASS' : 'FAIL'}`);
  if (resInject.status !== 400) passed = false;

  // 7. Test Security Headers
  const resHeaders = await fetch(`${baseUrl}/api/health`);
  const nosniff = resHeaders.headers.get('x-content-type-options');
  const frameOptions = resHeaders.headers.get('x-frame-options');
  const hasHeaders = nosniff === 'nosniff' && frameOptions === 'SAMEORIGIN';
  console.log(`- Security headers present (X-Content-Type-Options, X-Frame-Options): => ${hasHeaders ? 'PASS' : 'FAIL'}`);
  if (!hasHeaders) passed = false;

  // Cleanup
  await fetch(`${baseUrl}/api/meetings/${meetingCreated.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${hostToken}` }
  });
  console.log('--- CLEANUP COMPLETE ---');

  if (passed) {
    console.log('\n>>> ALL SECURITY AUDIT TESTS PASSED! <<<');
  } else {
    console.error('\n>>> SECURITY AUDIT TESTS FAILED! <<<');
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Error during security tests:', err);
  process.exit(1);
});

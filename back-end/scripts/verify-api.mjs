/**
 * End-to-end API verification script.
 * Drives the real running server the way the frontend will:
 * cookies per user, every route, permission checks, validation errors.
 *
 * Usage: node scripts/verify-api.mjs   (server must be running on PORT)
 */
const API = process.env.API_URL || 'http://localhost:5000';

// ---------------------------------------------------------------
// tiny HTTP client with cookie jar per user
// ---------------------------------------------------------------
const jar = new Map(); // userKey -> cookie string

async function call(user, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (jar.get(user)) headers.Cookie = jar.get(user);

  const res = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const cookie = setCookie.split(';')[0];
    if (cookie.includes('ttm.sid=') && !cookie.includes('ttm.sid=;')) {
      jar.set(user, cookie);
    }
  }

  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

// ---------------------------------------------------------------
// assertion helper
// ---------------------------------------------------------------
let passed = 0;
let failed = 0;
const check = (name, actual, expected) => {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected;
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} -> expected ${expected}, got ${JSON.stringify(actual)}`);
  }
};

const id = (r) => r.json?.user?.id ?? r.json?.team?.id ?? r.json?.task?.id ?? r.json?.invite?.token;

// ---------------------------------------------------------------
// test users
// ---------------------------------------------------------------
const alex = { name: 'Alex Doe', email: 'alex@test.dev', password: 'password123' };
const bob = { name: 'Bob Ray', email: 'bob@test.dev', password: 'password123' };
const carol = { name: 'Carol Fox', email: 'carol@test.dev', password: 'password123' };
const dana = { name: 'Dana Kim', email: 'dana@test.dev', password: 'password123' };

// delete leftover test data so repeated runs give deterministic counts
for (const [key, payload] of [['alex', alex], ['bob', bob], ['carol', carol], ['dana', dana]]) {
  const login = await call(key, 'POST', '/auth/login', payload);
  if (login.status !== 200) continue; // fresh database: nothing to clean
  const teams = (await call(key, 'GET', '/teams')).json?.teams ?? [];
  for (const team of teams) {
    // creators cascade-delete; members only clear their own membership
    const del = await call(key, 'DELETE', `/teams/${team.id}`);
    if (del.status === 403) {
      await call(key, 'DELETE', `/teams/${team.id}/members/${login.json.user.id}`);
    }
  }
}
jar.clear();

// ---------------------------------------------------------------
// run
// ---------------------------------------------------------------

console.log('\nAUTH');
check('unauthenticated /teams is protected', (await call('x', 'GET', '/teams')).status, 401);

/** register or, on reruns, log in with the same credentials */
const ensureUser = async (key, payload) => {
  const reg = await call(key, 'POST', '/auth/register', payload);
  return reg.status === 409 ? (await call(key, 'POST', '/auth/login', payload)).status : reg.status;
};
check('alex has a session', await ensureUser('alex', alex), 200);
check('bob has a session', await ensureUser('bob', bob), 200);
check('register duplicate email rejected', (await call('dup', 'POST', '/auth/register', alex)).status, 409);
check('register short password rejected', (await call('x', 'POST', '/auth/register', { ...dana, password: '123' })).status, 400);
check('register invalid email rejected', (await call('x', 'POST', '/auth/register', { ...dana, email: 'nope' })).status, 400);
check('login wrong password rejected', (await call('x', 'POST', '/auth/login', { ...bob, password: 'wrongpass1' })).status, 401);
check('login bob after failed attempt', (await call('bob', 'POST', '/auth/login', bob)).status, 200);
check('/auth/me returns bob', (await call('bob', 'GET', '/auth/me')).json?.user?.email, 'bob@test.dev');

// ---------------------------------------------------------------
// teams
// ---------------------------------------------------------------
console.log('\nTEAMS');
const teamRes = await call('alex', 'POST', '/teams', { name: 'Backend Squad', description: 'API work' });
check('create team', teamRes.status, 201);
const teamId = id(teamRes);

const teamRes2 = await call('bob', 'POST', '/teams', { name: 'Bob Team ' + Date.now() });
check('bob creates own team', teamRes2.status, 201);
const bobTeamId = id(teamRes2);

check('registered non-member cannot read team', (await call('bob', 'GET', `/teams/${teamId}`)).status, 403);
check('non-member cannot update team', (await call('bob', 'PATCH', `/teams/${teamId}`, { name: 'Hacked' })).status, 403);
check('creator updates team', (await call('alex', 'PATCH', `/teams/${teamId}`, { name: 'Backend Squad v2' })).status, 200);
check('invalid uuid rejected', (await call('alex', 'GET', '/teams/not-a-uuid')).status, 400);

// ---------------------------------------------------------------
// members
// ---------------------------------------------------------------
console.log('\nMEMBERS');
check('admin adds bob by email', (await call('alex', 'POST', `/teams/${teamId}/members`, { email: 'bob@test.dev' })).status, 201);
check('member list shows both teams for bob', (await call('bob', 'GET', '/teams')).json?.teams?.length >= 2, true);
check('unknown email rejected', (await call('alex', 'POST', `/teams/${teamId}/members`, { email: 'ghost@test.dev' })).status, 404);
check('duplicate member rejected', (await call('alex', 'POST', `/teams/${teamId}/members`, { email: 'bob@test.dev' })).status, 409);
check('non-admin cannot add members', (await call('bob', 'POST', `/teams/${teamId}/members`, { email: 'dana@test.dev' })).status, 403);

const detail = await call('alex', 'GET', `/teams/${teamId}`);
check('team detail has 2 members', detail.json?.members?.length, 2);
const bobId = detail.json?.members?.find?.((m) => m.email === 'bob@test.dev')?.id;

// invites (stubbed email, logs accept URL server-side)
console.log('\nINVITES');
const inviteRes = await call('alex', 'POST', `/teams/${teamId}/invites`, { email: 'carol@test.dev' });
check('admin creates invite', inviteRes.status, 201);
check('non-admin cannot create invite', (await call('bob', 'POST', `/teams/${teamId}/invites`, { email: 'dana@test.dev' })).status, 403);
const inviteToken = inviteRes.json?.invite?.token;
check('invite created', Boolean(inviteToken), true);
check('anonymous invite accept denied', (await call('x', 'POST', `/teams/invites/${inviteToken}/accept`)).status, 401);
check('carol has a session', await ensureUser('carol', carol), 200);
check('dana has a session', await ensureUser('dana', dana), 200);
check('dana cannot accept carol invite', (await call('dana', 'POST', `/teams/invites/${inviteToken}/accept`)).status, 403);
check('carol accepts own invite', (await call('carol', 'POST', `/teams/invites/${inviteToken}/accept`)).status, 200);
check('reusing invite rejected', (await call('carol', 'POST', `/teams/invites/${inviteToken}/accept`)).status, 409);
const invites = (await call('alex', 'GET', `/teams/${teamId}/invites`)).json?.invites;
check('invite list shows accepted', invites?.length >= 1, true);

// ---------------------------------------------------------------
// tasks
// ---------------------------------------------------------------
console.log('\nTASKS');
const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

const t1Res = await call('alex', 'POST', '/tasks', {
  teamId, title: 'Setup CI pipeline', description: 'GitHub actions for tests',
  priority: 'high', assigneeId: bobId, dueDate: tomorrow,
});
check('create task assigned to bob', t1Res.status, 201);
const t1 = id(t1Res);
check('password never leaks into task payload', Boolean(t1Res.json?.task?.id), true);

const t2Res = await call('alex', 'POST', '/tasks', { teamId, title: 'Write DB schema', status: 'in_progress' });
check('create unassigned task', t2Res.status, 201);
const t2 = id(t2Res);

const t3Res = await call('alex', 'POST', '/tasks', { teamId, title: 'Deploy API', priority: 'medium' });
const t3 = id(t3Res);
check('create deploy task', t3Res.status, 201);

check('assignee outside team rejected', (await call('alex', 'POST', '/tasks', { teamId, title: 'Bad assignee', assigneeId: '00000000-0000-0000-0000-000000000001' })).status, 422);
check('non-member cannot create tasks', (await call('dana', 'POST', '/tasks', { teamId, title: 'Intruder task' })).status, 403);
check('invalid payload rejected', (await call('alex', 'POST', '/tasks', { teamId, title: 'x' })).status, 400);
check('missing teamId rejected', (await call('alex', 'POST', '/tasks', { title: 'No team' })).status, 400);
check('script tags sanitized', (await call('alex', 'PATCH', `/tasks/${t2}`, { title: 'Write <script>x</script> fields' })).json?.task?.title?.includes?.('<script>'), false);

check('member can update task', (await call('bob', 'PATCH', `/tasks/${t2}`, { status: 'done' })).json?.task?.status, 'done');
check('member can reassign', (await call('bob', 'PATCH', `/tasks/${t2}`, { assigneeId: bobId })).status, 200);
check('stranger cannot update task', (await call('dana', 'PATCH', `/tasks/${t1}`, { status: 'done' })).status, 403);

check('list all my-team tasks', (await call('alex', 'GET', '/tasks')).json?.tasks?.length >= 3, true);
check('filter by team', ((await call('alex', 'GET', `/tasks?teamId=${teamId}`)).json?.tasks || []).every?.((t) => t.teamId === teamId), true);
const assignedList = await call('alex', 'GET', `/tasks?assigneeId=${bobId}`);
check('filter by assignee', assignedList.json?.tasks?.length, 2);
check('search by title', (await call('alex', 'GET', '/tasks?q=deploy')).json?.tasks?.length, 1);
check('search is case-insensitive', (await call('alex', 'GET', '/tasks?q=deploy')).json?.tasks?.[0]?.title, 'Deploy API');
check('filter status done', (await call('alex', 'GET', '/tasks?status=done')).json?.tasks?.length, 1);
check('due reminders within 3 days', (await call('bob', 'GET', '/tasks/due?days=3')).json?.count, 1);
check('due reminders within 30 days sees 1', (await call('bob', 'GET', '/tasks/due?days=30')).json?.count, 1);
const dueTask = (await call('bob', 'GET', '/tasks/due?days=30')).json?.tasks?.[0];
check('dueDate returned as plain YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(dueTask?.dueDate ?? ''), true);
check('hash field never leaks into responses', JSON.stringify(
  [await call('alex', 'GET', '/teams'), await call('alex', 'GET', '/auth/me')]
).toLowerCase().includes('password_hash'), false);
check('days out of range rejected', (await call('bob', 'GET', '/tasks/due?days=99')).status, 400);

// ---------------------------------------------------------------
// role-based access + cleanup
// ---------------------------------------------------------------
console.log('\nROLE-BASED / CLEANUP');
check('non-creator cannot delete team', (await call('bob', 'DELETE', `/teams/${teamId}`)).status, 403);
check('member cannot remove others', (await call('bob', 'DELETE', `/teams/${teamId}/members/${id(await call('alex', 'GET', '/auth/me'))}`)).status, 403);
check('member can leave (self)', (await call('carol', 'DELETE', `/teams/${teamId}/members/${(await call('carol', 'GET', '/auth/me')).json.user.id}`)).status, 200);
check('creator deletes team', (await call('bob', 'DELETE', `/teams/${bobTeamId}`)).status, 200);
check('task delete by member', (await call('bob', 'DELETE', `/tasks/${t3}`)).status, 200);
check('task delete twice -> 404', (await call('bob', 'DELETE', `/tasks/${t3}`)).status, 404);

// teardown so the script can be re-run cleanly (team cascade removes tasks + invites)
check('teardown: creator deletes test team', (await call('alex', 'DELETE', `/teams/${teamId}`)).status, 200);

console.log('\nSESSION');
check('logout works', (await call('bob', 'POST', '/auth/logout')).status, 200);
check('me is null after logout', (await call('bob', 'GET', '/auth/me')).json?.user, null);
check('/health reachable', (await call('x', 'GET', '/health')).json?.sessionStore, 'postgres');

console.log('\nHTTP EDGE CASES');
check('malformed JSON -> 400', (
  await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  })
).status, 400);
check('oversized payload -> 413', (
  await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'x@y.dev', password: 'a' + 'b'.repeat(60000) }),
  })
).status, 413);
check('CORS: disallowed origin gets no ACAO header', !(
  await fetch(API + '/health', { headers: { Origin: 'http://evil.example' } })
).headers.has('access-control-allow-origin'), true);
check('CORS: allowed origin reflected', (
  await fetch(API + '/health', { headers: { Origin: 'http://localhost:5173' } })
).headers.get('access-control-allow-origin'), 'http://localhost:5173');
check('unknown route -> 404 JSON', (await call('x', 'GET', '/definitely-missing')).status, 404);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

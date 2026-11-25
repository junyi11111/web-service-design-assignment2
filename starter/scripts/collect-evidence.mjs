// [학생 작성] T01~T32 증거 수집 스크립트.
// tests/assignment.test.js의 각 시나리오를 시나리오마다 새 임시 DB + 실제 HTTP 서버로 재현하고,
// 요청마다 응답·신청 상태·행사별 승인 인원·이력 변화를 docs/evidence/t-details.md에 기록합니다.
// 테스트 파일과 구현 코드(src/)는 읽기만 하고 바꾸지 않습니다. 토큰·서명 키는 출력하지 않습니다.
// 실행: node scripts/collect-evidence.mjs   (Node.js 24.x)
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

const outPath = fileURLToPath(new URL('../docs/evidence/t-details.md', import.meta.url));
const USERS = { 1: 'alice', 2: 'bob', 3: 'manager1', 4: 'manager2', 5: 'charlie' };
const NAMES = ['alice', 'bob', 'charlie', 'manager1', 'manager2'];
const REASON = '운영 사정으로 승인 취소';
const secrets = [];            // 출력물에 섞이지 않았는지 마지막에 검사할 비밀 값(서명 키·토큰)
let serverLog = [];            // app.js가 500일 때 console.error로 남기는 메시지 수집
const realConsoleError = console.error;
console.error = (...a) => { serverLog.push(a.join(' ')); };

// ---------- 실행 환경: tests/helpers.js의 fixture와 같은 방식(임시 파일 DB + 임의 포트) ----------
async function createEnv() {
  const dir = mkdtempSync(join(tmpdir(), 'assignment2-evidence-'));
  const path = join(dir, 'evidence.sqlite');
  const secret = randomBytes(48).toString('hex'); secrets.push(secret);
  let db = openDb(path);
  const server = createApp({ db, secret }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const e = { path, tokens: {}, running: true, get db() { return db; } };
  e.http = async (method, p, { token, body } = {}) => {
    const headers = { ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
    const r = await fetch(base + p, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json(), location: r.headers.get('location') };
  };
  e.stop = async () => { if (!e.running) return; e.running = false; await new Promise(r => server.close(r)); db.close(); };
  e.reopen = () => { db = openDb(path); };
  e.cleanup = async () => { await e.stop(); try { db.close(); } catch {} rmSync(dir, { recursive: true, force: true }); };
  for (const name of NAMES) {
    const r = await e.http('POST', '/api/auth/login', { body: { username: name, password: 'Classroom123!' } });
    e.tokens[name] = r.data.accessToken; secrets.push(r.data.accessToken);
  }
  return e;
}

// ---------- DB 상태 스냅숏 ----------
function state(db) {
  const rawApps = db.prepare('SELECT * FROM applications ORDER BY id').all();
  const history = db.prepare('SELECT * FROM application_history ORDER BY id').all();
  const approved = {};
  for (const { id } of db.prepare('SELECT id FROM events ORDER BY id').all())
    approved[id] = db.prepare("SELECT COUNT(*) AS n FROM applications WHERE event_id=? AND status='APPROVED'").get(id).n;
  return { apps: rawApps, history, approved, raw: JSON.stringify({ rawApps, history }) };
}

// ---------- 기록 ----------
const results = [];
let cur;
async function scenario(id, title, fn) {
  cur = { id, title, steps: [], checks: [], injections: [], error: null };
  const e = await createEnv();
  try { await fn(e); } catch (err) { cur.error = err.stack || String(err); }
  finally { await e.cleanup(); }
  results.push(cur);
}
function check(desc, cond, actual) { cur.checks.push({ desc, ok: !!cond, actual: String(actual) }); }

function actorLabel(actor, tokenMode) {
  if (tokenMode === 'none') return '토큰 없음';
  if (tokenMode === 'forged') return '위조 토큰(`invalid`)';
  const id = Object.keys(USERS).find(k => USERS[k] === actor);
  return `${actor}(id ${id})`;
}

// HTTP 요청 단계. expect/code는 assignment.test.js의 expect(...) 값을 그대로 옮긴 것입니다.
// unchanged=true는 테스트가 그 요청 전후로 assert.deepEqual(snapshot/full, before)를 검사하는 단계입니다.
async function call(e, { actor, tokenMode, method = 'POST', path, body, expect, code, unchanged = false, note, extra = false }) {
  const token = tokenMode === 'none' ? undefined : tokenMode === 'forged' ? 'invalid' : e.tokens[actor];
  const before = state(e.db); serverLog = [];
  const r = await e.http(method, path, { token, body });
  const after = state(e.db);
  const same = before.raw === after.raw;
  const statusOk = r.status === expect && (!code || r.data?.code === code);
  cur.steps.push({ kind: 'http', method, path, body, actor: actorLabel(actor, tokenMode), expect, code, res: r, statusOk,
    before, after, same, unchanged, unchangedOk: !unchanged || same, log: [...serverLog], note, extra });
  return r;
}
function dbStep(e, desc, sql, run) {
  const before = state(e.db);
  run ? run() : e.db.exec(sql);
  const after = state(e.db);
  cur.steps.push({ kind: 'db', desc, sql, before, after, same: before.raw === after.raw, statusOk: true, unchangedOk: true });
}
async function reconnect(e) {
  const before = state(e.db);
  await e.stop(); e.reopen();
  const after = state(e.db);
  const same = before.raw === after.raw;
  cur.steps.push({ kind: 'reconnect', desc: '서버·DB 연결 종료 후 같은 DB 파일을 openDb로 다시 열기', before, after, same, statusOk: true, unchanged: true, unchangedOk: same });
  return { before, after };
}

// ---------- 테스트와 같은 보조 동작 ----------
const apply = (e, name, event = 1, o = {}) => call(e, { actor: name, path: `/api/events/${event}/applications`, body: {}, ...o });
const action = (e, name, id, act, o = {}) => call(e, { actor: name, path: `/api/applications/${id}/${act}`, body: {}, ...o });
const getApp = (e, name, id, o = {}) => call(e, { actor: name, method: 'GET', path: `/api/applications/${id}`, expect: 200, ...o });
const revoke = (e, name, id, o = {}) => call(e, { actor: name, tokenMode: name === 'nobody' ? 'none' : undefined, path: `/api/applications/${id}/revoke`, body: { reason: o.reason ?? REASON }, ...o });
const historyOf = (e, id, name = 'manager1', o = {}) => call(e, { actor: name, method: 'GET', path: `/api/applications/${id}/history`, expect: 200, ...o });
const events = e => call(e, { actor: 'alice', tokenMode: 'none', method: 'GET', path: '/api/events', expect: 200 });
async function created(e, name = 'alice', event = 1) { return (await apply(e, name, event, { expect: 201 })).data; }
async function approved(e, name = 'alice', event = 1) {
  const a = await created(e, name, event);
  await action(e, event === 1 ? 'manager1' : 'manager2', a.id, 'approve', { expect: 200 });
  return a;
}
const trigger = (e, name, act) => dbStep(e, `실패 주입: 트리거 ${name} 설치 — application_history INSERT 중 action='${act}'인 행을 RAISE(ABORT)`,
  `CREATE TRIGGER ${name} BEFORE INSERT ON application_history WHEN NEW.action='${act}' BEGIN SELECT RAISE(ABORT,'TEST_INJECTED_FAILURE'); END`);
const dropTrigger = (e, name) => dbStep(e, `트리거 ${name} 제거`, `DROP TRIGGER ${name}`);
const lastStep = () => cur.steps.at(-1);
function injection(act, failStep, retryStep, retryNote) {
  cur.injections.push({ act, failStep, retryStep, retryNote });
}

// ================= T01~T32 (tests/assignment.test.js와 같은 순서·같은 단계) =================
await scenario('T01', '정상 신청은 본인 ID와 PENDING으로 저장', async e => {
  const r = await apply(e, 'alice', 1, { expect: 201 });
  check('응답 userId === 1', r.data.userId === 1, r.data.userId);
  check("응답 status === 'PENDING'", r.data.status === 'PENDING', r.data.status);
  check('Location === /api/applications/{id}', r.location === `/api/applications/${r.data.id}`, r.location);
  check('applications 행 수 === 1', state(e.db).apps.length === 1, state(e.db).apps.length);
});
await scenario('T02', '비로그인·위조 토큰의 변경은 401, 데이터 불변', async e => {
  await apply(e, 'alice', 1, { tokenMode: 'none', expect: 401 });
  await apply(e, 'alice', 1, { tokenMode: 'forged', expect: 401 });
  check('applications 행 수 === 0', state(e.db).apps.length === 0, state(e.db).apps.length);
});
await scenario('T03', 'userId·role·status 위조는 400, 데이터 불변', async e => {
  for (const body of [{ userId: 2 }, { role: 'MANAGER' }, { status: 'APPROVED' }]) await apply(e, 'alice', 1, { body, expect: 400, code: 'BAD_INPUT' });
  check('applications 행 수 === 0', state(e.db).apps.length === 0, state(e.db).apps.length);
});
await scenario('T04', '대기·취소·승인 상태의 기존 신청은 모두 중복', async e => {
  const a = await created(e);
  await apply(e, 'alice', 1, { expect: 409, code: 'ALREADY_APPLIED', unchanged: true });
  await action(e, 'alice', a.id, 'cancel', { expect: 200 });
  await apply(e, 'alice', 1, { expect: 409, code: 'ALREADY_APPLIED', unchanged: true });
  const b = await created(e, 'bob');
  await action(e, 'manager1', b.id, 'approve', { expect: 200 });
  await apply(e, 'bob', 1, { expect: 409, code: 'ALREADY_APPLIED', unchanged: true });
});
await scenario('T05', '같은 학생이 다른 행사에 신청 가능', async e => {
  await created(e); await created(e, 'alice', 2);
  check('applications 행 수 === 2', state(e.db).apps.length === 2, state(e.db).apps.length);
});
await scenario('T06', '본인의 대기 신청 취소 성공', async e => {
  const a = await created(e);
  await action(e, 'alice', a.id, 'cancel', { expect: 200 });
  const g = await getApp(e, 'alice', a.id);
  check("재조회 status === 'CANCELLED'", g.data.status === 'CANCELLED', g.data.status);
});
await scenario('T07', '타인·운영자의 학생 신청 취소는 403', async e => {
  const a = await created(e);
  for (const u of ['bob', 'manager1']) await action(e, u, a.id, 'cancel', { expect: 403, code: 'FORBIDDEN', unchanged: true });
});
await scenario('T08', '담당 운영자의 대기 신청 승인 성공', async e => {
  const a = await created(e);
  await action(e, 'manager1', a.id, 'approve', { expect: 200 });
  const g = await getApp(e, 'alice', a.id);
  check("재조회 status === 'APPROVED'", g.data.status === 'APPROVED', g.data.status);
  const ev = await events(e);
  check('행사 1 approvedCount === 1', ev.data[0].approvedCount === 1, ev.data[0].approvedCount);
});
await scenario('T09', '학생·다른 행사 운영자의 승인은 403', async e => {
  const a = await created(e);
  for (const u of ['alice', 'manager2']) await action(e, u, a.id, 'approve', { expect: 403, code: 'FORBIDDEN', unchanged: true });
});
await scenario('T10', '취소 후 오래된 화면의 승인은 409, 취소 유지', async e => {
  const a = await created(e);
  await action(e, 'alice', a.id, 'cancel', { expect: 200 });
  await action(e, 'manager1', a.id, 'approve', { expect: 409, code: 'INVALID_STATE', unchanged: true });
});
await scenario('T11', '승인 후 재승인·본인 취소는 409, 승인 유지', async e => {
  const a = await created(e);
  await action(e, 'manager1', a.id, 'approve', { expect: 200 });
  await action(e, 'manager1', a.id, 'approve', { expect: 409, code: 'INVALID_STATE', unchanged: true });
  await action(e, 'alice', a.id, 'cancel', { expect: 409, code: 'INVALID_STATE', unchanged: true });
});
await scenario('T12', '취소 후 다시 취소는 409, 데이터 불변', async e => {
  const a = await created(e);
  await action(e, 'alice', a.id, 'cancel', { expect: 200 });
  await action(e, 'alice', a.id, 'cancel', { expect: 409, code: 'INVALID_STATE', unchanged: true });
});
await scenario('T13', '정원은 승인 인원 기준, 초과 요청은 대기 유지', async e => {
  const a = await created(e), b = await created(e, 'bob'), c = await created(e, 'charlie');
  await action(e, 'manager1', a.id, 'approve', { expect: 200 });
  await action(e, 'manager1', b.id, 'approve', { expect: 200 });
  await action(e, 'manager1', c.id, 'approve', { expect: 409, code: 'CAPACITY_FULL', unchanged: true });
  const ev = await events(e);
  check('행사 1 approvedCount === 2', ev.data[0].approvedCount === 2, ev.data[0].approvedCount);
  const g = await getApp(e, 'charlie', c.id);
  check("charlie 신청 status === 'PENDING'", g.data.status === 'PENDING', g.data.status);
});
await scenario('T14', '역할·대상·상태 검사 순서', async e => {
  await apply(e, 'manager1', 1, { expect: 403, code: 'FORBIDDEN' });
  await apply(e, 'alice', 9999, { expect: 404, code: 'NOT_FOUND' });
  await action(e, 'manager1', 9999, 'approve', { expect: 404, code: 'NOT_FOUND' });
  await action(e, 'alice', 9999, 'cancel', { expect: 404, code: 'NOT_FOUND' });
  const a = await created(e);
  await action(e, 'alice', a.id, 'cancel', { expect: 200 });
  await action(e, 'manager2', a.id, 'approve', { expect: 403, code: 'FORBIDDEN' });
});
await scenario('T15', '잘못된 ID, 다른 사람의 상세 조회 거부', async e => {
  await call(e, { actor: 'alice', path: '/api/events/abc/applications', body: {}, expect: 400, code: 'BAD_INPUT' });
  const a = await created(e);
  await getApp(e, 'bob', a.id, { expect: 403, code: 'FORBIDDEN' });
  await getApp(e, 'manager2', a.id, { expect: 403, code: 'FORBIDDEN' });
});
await scenario('T16', 'DB 재연결 후 신청과 상태 유지', async e => {
  const a = await created(e);
  await action(e, 'manager1', a.id, 'approve', { expect: 200 });
  await reconnect(e);
  const r = e.db.prepare('SELECT user_id,status FROM applications WHERE id=?').get(a.id);
  check('재연결 후 user_id === 1', r.user_id === 1, r.user_id);
  check("재연결 후 status === 'APPROVED'", r.status === 'APPROVED', r.status);
});
await scenario('T17', '승인 취소: 대기자가 없으면 REVOKED, promoted=null', async e => {
  const a = await approved(e);
  const r = await revoke(e, 'manager1', a.id, { expect: 200 });
  check("revoked.status === 'REVOKED'", r.data.revoked?.status === 'REVOKED', r.data.revoked?.status);
  check('promoted === null', r.data.promoted === null, JSON.stringify(r.data.promoted));
  const g = await getApp(e, 'alice', a.id);
  check("재조회 status === 'REVOKED'", g.data.status === 'REVOKED', g.data.status);
  const ev = await events(e);
  check('행사 1 approvedCount === 0', ev.data[0].approvedCount === 0, ev.data[0].approvedCount);
  await apply(e, 'alice', 1, { expect: 409, code: 'ALREADY_APPLIED' });
});
await scenario('T18', '자동 승급: 같은 행사 created_at이 가장 이른 대기자', async e => {
  const a = await approved(e, 'alice', 2), b = await created(e, 'bob', 2), c = await created(e, 'charlie', 2);
  dbStep(e, `테스트 준비: bob 신청 #${b.id} created_at=2026-11-02, charlie 신청 #${c.id} created_at=2026-11-01로 직접 수정`, 'UPDATE applications SET created_at=? WHERE id=?  (2회)', () => {
    e.db.prepare('UPDATE applications SET created_at=? WHERE id=?').run('2026-11-02T00:00:00.000Z', b.id);
    e.db.prepare('UPDATE applications SET created_at=? WHERE id=?').run('2026-11-01T00:00:00.000Z', c.id);
  });
  const r = await revoke(e, 'manager2', a.id, { expect: 200 });
  check(`promoted.id === charlie 신청 #${c.id}`, r.data.promoted?.id === c.id, r.data.promoted?.id);
  check("promoted.status === 'APPROVED'", r.data.promoted?.status === 'APPROVED', r.data.promoted?.status);
  const g = await getApp(e, 'bob', b.id);
  check("bob 신청 status === 'PENDING'", g.data.status === 'PENDING', g.data.status);
  const ev = await events(e);
  check('행사 2 approvedCount === 1', ev.data[1].approvedCount === 1, ev.data[1].approvedCount);
});
await scenario('T19', '자동 승급: 시각이 같으면 ID 오름차순', async e => {
  const a = await approved(e, 'alice', 2), b = await created(e, 'bob', 2), c = await created(e, 'charlie', 2);
  dbStep(e, "테스트 준비: PENDING 신청 전부 created_at='2026-11-01T00:00:00.000Z'로 동일하게 수정", "UPDATE applications SET created_at='2026-11-01T00:00:00.000Z' WHERE status='PENDING'");
  const r = await revoke(e, 'manager2', a.id, { expect: 200 });
  check(`promoted.id === bob 신청 #${b.id} (더 작은 ID)`, r.data.promoted?.id === b.id, r.data.promoted?.id);
  const g = await getApp(e, 'charlie', c.id);
  check("charlie 신청 status === 'PENDING'", g.data.status === 'PENDING', g.data.status);
});
await scenario('T20', '자동 승급 대상에서 취소자·다른 행사를 제외', async e => {
  const a = await approved(e, 'alice', 2), b = await created(e, 'bob', 2), c = await created(e, 'charlie', 1);
  await action(e, 'bob', b.id, 'cancel', { expect: 200 });
  const r = await revoke(e, 'manager2', a.id, { expect: 200 });
  check('promoted === null', r.data.promoted === null, JSON.stringify(r.data.promoted));
  const gb = await getApp(e, 'bob', b.id);
  check("bob 신청 status === 'CANCELLED'", gb.data.status === 'CANCELLED', gb.data.status);
  const gc = await getApp(e, 'charlie', c.id);
  check("charlie(행사 1) 신청 status === 'PENDING'", gc.data.status === 'PENDING', gc.data.status);
});
await scenario('T21', '승인 취소 권한: 학생·다른 운영자·토큰 누락 거부', async e => {
  const a = await approved(e);
  for (const n of ['alice', 'bob', 'manager2']) await revoke(e, n, a.id, { expect: 403, code: 'FORBIDDEN', unchanged: true });
  await revoke(e, 'nobody', a.id, { expect: 401, unchanged: true });
});
await scenario('T22', '승인 취소 상태: 대기·대기 취소·승인 취소 상태 거부', async e => {
  const a = await created(e);
  await revoke(e, 'manager1', a.id, { expect: 409, code: 'INVALID_STATE', unchanged: true });
  await action(e, 'alice', a.id, 'cancel', { expect: 200 });
  await revoke(e, 'manager1', a.id, { expect: 409, code: 'INVALID_STATE', unchanged: true });
  const b = await approved(e, 'bob');
  await revoke(e, 'manager1', b.id, { expect: 200 });
  await revoke(e, 'manager1', b.id, { expect: 409, code: 'INVALID_STATE', unchanged: true });
  await action(e, 'manager1', b.id, 'approve', { expect: 409, code: 'INVALID_STATE', unchanged: true });
  await action(e, 'bob', b.id, 'cancel', { expect: 409, code: 'INVALID_STATE', unchanged: true });
});
await scenario('T23', '승인 취소 사유: trim 후 5~200자, 추가 필드 거부', async e => {
  const a = await approved(e);
  for (const body of [{}, { reason: 12 }, { reason: '    ' }, { reason: 'abcd' }, { reason: 'x'.repeat(201) }, { reason: '유효한 취소 사유', actorId: 4 }])
    await call(e, { actor: 'manager1', path: `/api/applications/${a.id}/revoke`, body, expect: 400, code: 'BAD_INPUT', unchanged: true });
  await revoke(e, 'manager1', a.id, { reason: '  운영 사정으로 취소  ', expect: 200 });
  const h = (await historyOf(e, a.id)).data.at(-1);
  check("마지막 이력 reason === '운영 사정으로 취소' (trim됨)", h.reason === '운영 사정으로 취소', JSON.stringify(h.reason));
});
await scenario('T24', '신청·취소·승인 이력의 행위자·전후 상태·순서', async e => {
  const a = await created(e), b = await created(e, 'bob');
  await action(e, 'alice', a.id, 'cancel', { expect: 200 });
  await action(e, 'manager1', b.id, 'approve', { expect: 200 });
  const ah = (await historyOf(e, a.id)).data, bh = (await historyOf(e, b.id)).data;
  check('alice 이력 2건, bob 이력 2건', ah.length === 2 && bh.length === 2, `${ah.length}, ${bh.length}`);
  for (const [h, actor, act, from, to, id, who] of [[ah[0], 1, 'APPLY', null, 'PENDING', a.id, 'alice[0]'], [ah[1], 1, 'CANCEL', 'PENDING', 'CANCELLED', a.id, 'alice[1]'], [bh[0], 2, 'APPLY', null, 'PENDING', b.id, 'bob[0]'], [bh[1], 3, 'APPROVE', 'PENDING', 'APPROVED', b.id, 'bob[1]']]) {
    const ok = h && h.actorId === actor && h.action === act && h.fromStatus === from && h.toStatus === to && h.applicationId === id && h.reason === null && h.causeHistoryId === null && Number.isFinite(Date.parse(h.createdAt));
    check(`${who}: actor=${actor} ${act} ${from}→${to}, reason·cause=null, createdAt 파싱 가능`, ok, h ? `actor=${h.actorId} ${h.action} ${h.fromStatus}→${h.toStatus} reason=${h.reason} cause=${h.causeHistoryId} createdAt=${h.createdAt}` : '없음');
  }
  check('이력 ID 오름차순', ah[0].id < ah[1].id && bh[0].id < bh[1].id, `alice ${ah[0].id}<${ah[1].id}, bob ${bh[0].id}<${bh[1].id}`);
});
await scenario('T25', '승인 취소와 자동 승급 이력을 원인 ID로 연결', async e => {
  const a = await approved(e), b = await created(e, 'bob');
  await revoke(e, 'manager1', a.id, { expect: 200 });
  const ahAll = (await historyOf(e, a.id)).data, bhAll = (await historyOf(e, b.id)).data;
  const h = ahAll.at(-1), p = bhAll.at(-1);
  check('REVOKE 이력: APPROVED→REVOKED, actor 3, cause null, reason 저장', h.action === 'REVOKE' && h.fromStatus === 'APPROVED' && h.toStatus === 'REVOKED' && h.actorId === 3 && h.causeHistoryId === null && h.reason === REASON, `h${h.id} ${h.action} ${h.fromStatus}→${h.toStatus} actor=${h.actorId} cause=${h.causeHistoryId} reason=${h.reason}`);
  check('AUTO_APPROVE 이력: PENDING→APPROVED, actor 3, cause = REVOKE 이력 ID, reason null', p.action === 'AUTO_APPROVE' && p.fromStatus === 'PENDING' && p.toStatus === 'APPROVED' && p.actorId === 3 && p.causeHistoryId === h.id && p.reason === null, `h${p.id} ${p.action} ${p.fromStatus}→${p.toStatus} actor=${p.actorId} cause=${p.causeHistoryId} reason=${p.reason}`);
  check('AUTO_APPROVE 이력 ID > REVOKE 이력 ID', p.id > h.id, `${p.id} > ${h.id}`);
  check('alice 이력 3건, bob 이력 2건', ahAll.length === 3 && bhAll.length === 2, `${ahAll.length}, ${bhAll.length}`);
});
await scenario('T26', '거부된 요청은 상태와 성공 이력을 모두 변경하지 않음', async e => {
  const a = await approved(e, 'alice', 2), b = await created(e, 'bob', 2);
  const before = state(e.db).raw;
  await action(e, 'manager2', b.id, 'approve', { expect: 409, code: 'CAPACITY_FULL', unchanged: true });
  await apply(e, 'alice', 2, { expect: 409, code: 'ALREADY_APPLIED', unchanged: true });
  await action(e, 'alice', a.id, 'cancel', { expect: 409, code: 'INVALID_STATE', unchanged: true });
  await revoke(e, 'manager1', a.id, { expect: 403, code: 'FORBIDDEN', unchanged: true });
  check('거부 4건 이후 applications·application_history 전체가 처음과 동일', state(e.db).raw === before, state(e.db).raw === before ? '동일' : '다름');
});
await scenario('T27', '변경 이력 조회: 본인·담당 운영자만 허용', async e => {
  const a = await created(e);
  for (const n of ['alice', 'manager1']) await historyOf(e, a.id, n, { expect: 200 });
  for (const n of ['bob', 'manager2']) await historyOf(e, a.id, n, { expect: 403, code: 'FORBIDDEN' });
  await historyOf(e, a.id, 'alice', { tokenMode: 'none', expect: 401 });
  await historyOf(e, 9999, 'alice', { expect: 404, code: 'NOT_FOUND' });
});
await scenario('T28', '신청 이력 저장 실패 시 신청 저장도 롤백', async e => {
  trigger(e, 'fail_apply', 'APPLY');
  await apply(e, 'alice', 1, { expect: 500, code: 'INTERNAL_ERROR', unchanged: true }); const failStep = lastStep();
  dropTrigger(e, 'fail_apply');
  await apply(e, 'alice', 1, { expect: 201 });
  injection('APPLY', failStep, lastStep(), '테스트 단계');
});
await scenario('T29', '자동 승급 이력 저장 실패 시 두 상태와 두 이력 모두 롤백', async e => {
  const a = await approved(e), b = await created(e, 'bob');
  trigger(e, 'fail_auto', 'AUTO_APPROVE');
  await revoke(e, 'manager1', a.id, { expect: 500, code: 'INTERNAL_ERROR', unchanged: true }); const failStep = lastStep();
  dropTrigger(e, 'fail_auto');
  const r = await revoke(e, 'manager1', a.id, { expect: 200 });
  check(`재시도 promoted.id === bob 신청 #${b.id}`, r.data.promoted?.id === b.id, r.data.promoted?.id);
  injection('AUTO_APPROVE', failStep, lastStep(), '테스트 단계');
});
await scenario('T30', '승인·대기 취소·승인 취소 이력 실패도 롤백', async e => {
  const a = await created(e), b = await created(e, 'bob');
  trigger(e, 'fail_change', 'APPROVE');
  await action(e, 'manager1', a.id, 'approve', { expect: 500, code: 'INTERNAL_ERROR', unchanged: true }); const f1 = lastStep();
  dropTrigger(e, 'fail_change');
  trigger(e, 'fail_change', 'CANCEL');
  await action(e, 'bob', b.id, 'cancel', { expect: 500, code: 'INTERNAL_ERROR', unchanged: true }); const f2 = lastStep();
  dropTrigger(e, 'fail_change');
  await action(e, 'manager1', a.id, 'approve', { expect: 200 }); const r1 = lastStep();
  trigger(e, 'fail_revoke', 'REVOKE');
  await revoke(e, 'manager1', a.id, { expect: 500, code: 'INTERNAL_ERROR', unchanged: true }); const f3 = lastStep();
  // ↓ 여기부터는 테스트에 없는 추가 확인입니다(트리거 제거 후 재시도 결과 기록용). 테스트 판정에는 포함하지 않습니다.
  dropTrigger(e, 'fail_revoke'); lastStep().extra = true;
  await action(e, 'bob', b.id, 'cancel', { expect: 200, extra: true }); const r2 = lastStep();
  await revoke(e, 'manager1', a.id, { expect: 200, extra: true }); const r3 = lastStep();
  injection('APPROVE', f1, r1, '테스트 단계');
  injection('CANCEL', f2, r2, '추가 확인(테스트 외)');
  injection('REVOKE', f3, r3, '추가 확인(테스트 외)');
});
await scenario('T31', 'DB 재연결 후 승인 취소·승급 상태와 원인 이력 유지', async e => {
  const a = await approved(e); await created(e, 'bob');
  await revoke(e, 'manager1', a.id, { expect: 200 });
  const { before, after } = await reconnect(e);
  check('재연결 후 applications 전체 행 동일', JSON.stringify(before.apps) === JSON.stringify(after.apps), `${after.apps.length}행`);
  check('재연결 후 application_history 전체 행 동일(원인 ID 포함)', JSON.stringify(before.history) === JSON.stringify(after.history), `${after.history.length}행`);
});
await scenario('T32', '연속 승인 취소: 요청당 최대 한 명 승급, 정원·중복 이력 보호', async e => {
  const a = await approved(e), b = await approved(e, 'bob'), c = await created(e, 'charlie');
  const first = await revoke(e, 'manager1', a.id, { expect: 200 });
  check(`첫 승인 취소 promoted.id === charlie 신청 #${c.id}`, first.data.promoted?.id === c.id, first.data.promoted?.id);
  const second = await revoke(e, 'manager1', b.id, { expect: 200 });
  check('두 번째 승인 취소 promoted === null', second.data.promoted === null, JSON.stringify(second.data.promoted));
  const ev = await events(e);
  check('행사 1 approvedCount === 1', ev.data[0].approvedCount === 1, ev.data[0].approvedCount);
  await revoke(e, 'manager1', a.id, { expect: 409, code: 'INVALID_STATE', unchanged: true });
  const autos = state(e.db).history.filter(h => h.action === 'AUTO_APPROVE').length;
  check('AUTO_APPROVE 이력 정확히 1건', autos === 1, autos);
});

console.error = realConsoleError;

// ================= Markdown 작성 =================
const esc = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const appTxt = a => `#${a.id} ${USERS[a.user_id]}·E${a.event_id} ${a.status}`;
function appsCell(list, ref) {
  if (!list.length) return '(없음)';
  return list.map(a => {
    const old = ref?.find(x => x.id === a.id);
    const changed = ref && (!old || old.status !== a.status);
    return changed ? `**${appTxt(a)}**` : appTxt(a);
  }).join('<br>');
}
const approvedCell = (b, a) => Object.keys(a.approved).map(k => b.approved[k] === a.approved[k] ? `E${k} ${a.approved[k]}` : `**E${k} ${b.approved[k]}→${a.approved[k]}**`).join('<br>');
function newHistCell(b, a) {
  const maxId = b.history.reduce((m, h) => Math.max(m, h.id), 0);
  const rows = a.history.filter(h => h.id > maxId);
  if (!rows.length) return '—';
  return rows.map(h => `h${h.id} 신청#${h.application_id} ${USERS[h.actor_id]}(${h.actor_id}) ${h.action} ${h.from_status ?? '∅'}→${h.to_status} cause=${h.cause_history_id ?? 'null'}${h.reason !== null ? ` reason="${h.reason}"` : ''}`).join('<br>');
}
function resCell(s) {
  const r = s.res, d = r.data; let t = `**${r.status}**`;
  if (d?.code) t += ` ${d.code}`;
  else if (d?.revoked) t += ` revoked=#${d.revoked.id} ${d.revoked.status}, promoted=${d.promoted ? `#${d.promoted.id} ${d.promoted.status}` : 'null'}`;
  else if (Array.isArray(d)) t += ` 배열 ${d.length}건`;
  else if (d?.status && d?.id) t += ` #${d.id} ${d.status}`;
  if (r.location) t += `<br>Location ${r.location}`;
  if (s.log?.length) t += `<br>서버 로그: ${s.log.join('; ')}`;
  return t;
}
function reqCell(s) {
  if (s.kind !== 'http') return `*${s.desc}*${s.sql ? `<br>\`${s.sql}\`` : ''}`;
  let t = `\`${s.method} ${s.path}\`<br>행위자: ${s.actor}`;
  if (s.body !== undefined && !(s.method === 'POST' && JSON.stringify(s.body) === '{}')) t += `<br>본문: \`${JSON.stringify(s.body).slice(0, 80)}${JSON.stringify(s.body).length > 80 ? '…' : ''}\``;
  if (s.extra) t += '<br>*(테스트 외 추가 확인)*';
  return t;
}
function verdictCell(s) {
  if (s.kind === 'db') return s.extra ? '설정 (추가)' : '설정';
  if (s.kind === 'reconnect') return s.same ? '✔ 동일' : '✖ 달라짐';
  const parts = [];
  parts.push(s.statusOk ? '✔' : `✖ 기대 ${s.expect}${s.code ? ' ' + s.code : ''}`);
  if (s.unchanged) parts.push(s.same ? '불변 ✔' : '✖ 변경됨');
  return parts.join('<br>');
}
const expectCell = s => s.kind === 'http' ? `${s.expect}${s.code ? ' ' + s.code : ''}${s.unchanged ? '<br>+DB 불변' : ''}` : '—';
const stepOk = s => s.statusOk && s.unchangedOk;
const scenOk = r => !r.error && r.steps.every(stepOk) && r.checks.every(c => c.ok);

const node = process.version;
const now = new Date().toISOString();
const passCount = results.filter(scenOk).length;
let md = `# T01~T32 실제 실행 증거

- 생성: \`node scripts/collect-evidence.mjs\` (${node}), ${now}
- 방법: \`tests/assignment.test.js\`의 각 시나리오를 **시나리오마다 새 임시 SQLite 파일 + 실제 HTTP 서버**(127.0.0.1, 임의 포트)로 같은 순서대로 다시 실행했습니다. 테스트 파일·기대값·구현 코드(\`src/\`)는 바꾸지 않았습니다.
- 각 행은 요청 1건입니다. "전/후"는 그 요청 **직전·직후**에 DB(applications, application_history)를 직접 조회한 값입니다. **굵게** 표시한 값은 그 요청으로 바뀐 값입니다.
- 신청 표기: \`#신청ID 학생·E행사ID 상태\`. 이력 표기: \`h이력ID 신청#ID 행위자(ID) 행위 전→후 cause=원인이력ID\`. ∅는 이전 상태 없음(null)입니다.
- "기대"는 테스트의 \`expect(status, code)\` 값입니다. "+DB 불변"은 테스트가 그 요청 전후로 \`deepEqual\`을 검사하는 단계입니다. 불변 판정은 applications·application_history의 **모든 행·모든 컬럼**을 비교했습니다(테스트가 applications만 비교하는 T04·T07·T09~T13보다 엄격합니다).
- 비밀 값: 로그인 토큰은 \`Authorization: Bearer ***\`로만 다루고 문서에 기록하지 않았습니다. 서명 키는 실행마다 임의로 만든 임시 값이며 기록하지 않았습니다. 파일을 쓰기 전에 출력물에 토큰·키 문자열이 없는지 검사했습니다.
- 계정 ID: alice 1, bob 2, manager1 3(행사 1 담당, 정원 2), manager2 4(행사 2 담당, 정원 1), charlie 5.

## 요약: ${passCount}/${results.length} 시나리오가 기대와 일치

| T | 시나리오 | 요청 수 | 추가 확인 | 결과 |
|---|---|---|---|---|
`;
for (const r of results) {
  const reqs = r.steps.filter(s => s.kind === 'http').length;
  md += `| [${r.id}](#${r.id.toLowerCase()}) | ${esc(r.title)} | ${reqs} | ${r.checks.filter(c => c.ok).length}/${r.checks.length} | ${scenOk(r) ? '✔ 일치' : '✖ **불일치**'} |\n`;
}

md += `\n## T28~T30 실패 주입·롤백 요약\n\n| T | 주입한 실패 (실패하는 INSERT) | 실패 요청 → 응답 | 롤백 후 상태 (요청 전과 비교) | 트리거 제거 후 재시도 |\n|---|---|---|---|---|\n`;
for (const r of results) for (const inj of r.injections) {
  const f = inj.failStep, t = inj.retryStep;
  md += `| ${r.id} | \`application_history\` INSERT, action='${inj.act}' → \`RAISE(ABORT,'TEST_INJECTED_FAILURE')\` | \`${f.method} ${f.path}\` (${f.actor}) → ${resCell(f)} | ${f.same ? '✔ applications·이력 전체 불변' : '✖ 변경 남음'}<br>신청: ${appsCell(f.after.apps)}<br>이력 ${f.before.history.length}→${f.after.history.length}건 | [${inj.retryNote}] \`${t.method} ${t.path}\` (${t.actor}) → ${resCell(t)}<br>새 이력: ${newHistCell(t.before, t.after)} |\n`;
}

for (const r of results) {
  md += `\n## ${r.id}\n\n**${esc(r.title)}** — ${scenOk(r) ? '✔ 기대와 일치' : '✖ **기대와 불일치**'}\n\n`;
  md += '| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |\n|---|---|---|---|---|---|---|---|---|---|\n';
  r.steps.forEach((s, i) => {
    md += `| ${i + 1} | ${reqCell(s)} | ${expectCell(s)} | ${s.kind === 'http' ? resCell(s) : '—'} | ${verdictCell(s)} | ${appsCell(s.before.apps)} | ${appsCell(s.after.apps, s.before.apps)} | ${approvedCell(s.before, s.after)} | ${s.before.history.length}→${s.after.history.length} | ${newHistCell(s.before, s.after)} |\n`;
  });
  if (r.checks.length) {
    md += '\n추가 확인 (테스트의 assert):\n\n| 확인 | 실제 값 | 결과 |\n|---|---|---|\n';
    for (const c of r.checks) md += `| ${esc(c.desc)} | ${esc(c.actual)} | ${c.ok ? '✔' : '✖'} |\n`;
  }
  if (r.error) md += `\n**스크립트 오류:**\n\n\`\`\`\n${r.error}\n\`\`\`\n`;
}

// 비밀 값 누출 검사: 토큰·서명 키가 하나라도 섞였으면 파일을 쓰지 않습니다.
for (const s of secrets) if (s && md.includes(s)) { console.error('비밀 값이 출력물에 포함되어 중단합니다.'); process.exit(2); }
if (/eyJ[A-Za-z0-9_-]{10,}\./.test(md)) { console.error('JWT 형태 문자열이 출력물에 포함되어 중단합니다.'); process.exit(2); }

writeFileSync(outPath, md);
console.log(`기록: ${outPath}`);
for (const r of results) console.log(`${scenOk(r) ? '✔' : '✖'} ${r.id} ${r.title}`);
console.log(`일치 ${passCount}/${results.length}`);
const bad = results.filter(r => !scenOk(r));
for (const r of bad) {
  for (const s of r.steps.filter(s => !stepOk(s))) console.log(`  ${r.id} 단계 불일치: ${s.method ?? ''} ${s.path ?? s.desc} → ${s.res?.status} ${s.res?.data?.code ?? ''} (기대 ${s.expect} ${s.code ?? ''}, 불변 ${s.same})`);
  for (const c of r.checks.filter(c => !c.ok)) console.log(`  ${r.id} 확인 실패: ${c.desc} (실제 ${c.actual})`);
  if (r.error) console.log(`  ${r.id} 오류: ${r.error}`);
}
if (bad.length) process.exitCode = 1;

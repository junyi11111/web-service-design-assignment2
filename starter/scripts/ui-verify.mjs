// [학생 작성] 화면 검증 U01~U05 자동 수행 스크립트 (결과: docs/evidence/screens/, docs/evidence/ui-verification.md)
// public/ 기본 화면을 headless Chromium으로 열고 버튼을 실제로 클릭해 U01→U02→U04→U05→U03 순서로 수행하며 단계별 스크린샷을 저장합니다.
// 상태 변경은 모두 화면 클릭으로 하며 API를 직접 호출하지 않습니다. 화면 외 확인은 /api/health 확인과 DB 읽기 전용 조회만 합니다.
// 계정마다 별도 브라우저 컨텍스트를 사용해 로그인이 섞이지 않게 합니다. 스크린샷 직전에 토큰·서명 키 노출 여부를 검사합니다.
//
// ■ Playwright는 저장소에 포함하지 않습니다(package.json·package-lock.json 미변경). 저장소 밖 폴더에 설치해 실행합니다.
//   1) mkdir -p /tmp/ui-check && cd /tmp/ui-check && npm init -y && npm i playwright@1.49.1 && npx playwright install chromium
//   2) cp <저장소>/starter/scripts/ui-verify.mjs /tmp/ui-check/
//   3) 서버를 모두 종료한 뒤 starter/ 폴더에서:  node /tmp/ui-check/ui-verify.mjs      (Node.js 24.x)
//   스크립트 파일이 /tmp/ui-check에 있어야 그 폴더의 node_modules에서 playwright를 찾습니다. starter 경로는 현재 폴더(또는 UI_ROOT)입니다.
//
// ■ 주의: 시작 시 `echo RESET | npm run db:reset`으로 data/app.sqlite를 초기화하고, `PORT=3000 npm start`로 서버를 직접 띄웠다가 종료합니다.
//   포트가 이미 사용 중이면 아무것도 바꾸지 않고 중단합니다. 기존 docs/evidence/screens/는 지우고 새로 만듭니다.
// ■ 포트: 3000 (UI_PORT로 변경 가능). 계정: alice·bob·charlie(학생), manager1(행사 1, 정원 2), manager2(행사 2, 정원 1), 비밀번호 Classroom123!
// ■ 환경변수: UI_ROOT(starter 경로, 기본 현재 폴더), UI_PORT(기본 3000), UI_DB_PATH(기본 starter/data/app.sqlite),
//   UI_SHOTS(기본 starter/docs/evidence/screens), UI_RESULT(결과 JSON, 기본 /tmp/ui-check/result.json)
//   시험 실행 예: UI_PORT=3101 UI_DB_PATH=/tmp/ui-dry.sqlite UI_SHOTS=/tmp/ui-dry-screens node /tmp/ui-check/ui-verify.mjs
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = resolve(process.env.UI_ROOT || process.cwd());
if (!existsSync(`${ROOT}/src/server.js`) || !existsSync(`${ROOT}/public/app.js`)) { console.error(`starter 폴더에서 실행하거나 UI_ROOT를 지정하세요: ${ROOT}`); process.exit(1); }
const PORT = process.env.UI_PORT || '3000';
const BASE = `http://127.0.0.1:${PORT}`;
const DB = process.env.UI_DB_PATH || `${ROOT}/data/app.sqlite`;
const KEY = `${ROOT}/data/jwt-secret.txt`;
const SHOTS = process.env.UI_SHOTS || `${ROOT}/docs/evidence/screens`;
const RESULT = process.env.UI_RESULT || '/tmp/ui-check/result.json';
const ENV = { ...process.env, PATH: '/usr/local/bin:' + process.env.PATH, PORT, ...(process.env.UI_DB_PATH ? { DB_PATH: DB } : {}) };
const REASON = '운영 사정으로 승인 취소';
const NAME = { alice: '민지', bob: '준호', charlie: '서연', manager1: '운영자 A', manager2: '운영자 B' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const result = { startedAt: new Date().toISOString(), base: BASE, steps: [], server: [], secretsChecked: 0, shots: [] };
const secrets = [];
const rec = (u, text, extra = {}) => { result.steps.push({ u, text, ...extra }); console.log(`[${u}] ${text}`); };

// ---------- 서버 제어 ----------
async function healthy() { try { return (await fetch(BASE + '/api/health')).ok; } catch { return false; } }
const serverPids = () => { try { return execFileSync('pgrep', ['-f', 'node src/server.js']).toString().trim().split('\n').filter(Boolean); } catch { return []; } };
const listeners = () => { try { return execFileSync('lsof', ['-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN', '-t']).toString().trim().split('\n').filter(Boolean); } catch { return []; } };
let server = null;
async function startServer(label) {
  server = spawn('npm', ['start'], { cwd: ROOT, env: ENV, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; server.stdout.on('data', d => out += d); server.stderr.on('data', d => out += d);
  for (let i = 0; i < 60 && !(await healthy()); i++) await sleep(250);
  if (!(await healthy())) throw new Error(`서버 시작 실패: ${out}`);
  const entry = { label, at: new Date().toISOString(), npmPid: server.pid, listenPids: listeners(), health: 'ok', log: out.trim() };
  result.server.push(entry); console.log(`[server] ${label}: npm pid ${server.pid}, listen pid ${entry.listenPids}`);
  return entry;
}
async function stopServer(label) {
  const pidsBefore = listeners();
  const exited = new Promise(r => server.once('exit', (code, signal) => r({ code, signal })));
  process.kill(-server.pid, 'SIGTERM');                 // npm과 node 서버가 같은 프로세스 그룹: 둘 다 SIGTERM
  let how = 'SIGTERM';
  const ex = await Promise.race([exited, sleep(8000).then(() => null)]);
  if (!ex) { process.kill(-server.pid, 'SIGKILL'); how = 'SIGTERM 응답 없음 → SIGKILL'; await exited; }
  for (let i = 0; i < 20 && listeners().length; i++) await sleep(250);
  const entry = { label, at: new Date().toISOString(), killed: pidsBefore, how, exit: ex, listenAfter: listeners(), healthAfter: await healthy() ? 'ok' : '응답 없음(연결 실패)' };
  result.server.push(entry); console.log(`[server] ${label}: ${JSON.stringify(entry)}`);
  server = null; return entry;
}

// ---------- DB 읽기 전용 확인(화면 외 확인) ----------
function dbState() {
  const d = new DatabaseSync(DB, { readOnly: true });
  try {
    const apps = d.prepare('SELECT a.id,u.username,a.event_id AS eventId,a.status FROM applications a JOIN users u ON u.id=a.user_id ORDER BY a.id').all().map(r => ({ ...r }));
    const approved = d.prepare("SELECT e.id, (SELECT COUNT(*) FROM applications a WHERE a.event_id=e.id AND a.status='APPROVED') AS n FROM events e ORDER BY e.id").all().map(r => `E${r.id}=${r.n}`).join(', ');
    const history = d.prepare('SELECT id,application_id AS app,actor_id AS actor,action,from_status AS fromS,to_status AS toS,reason,cause_history_id AS cause FROM application_history ORDER BY id').all().map(r => ({ ...r }));
    return { apps: apps.map(a => `#${a.id} ${a.username}·E${a.eventId} ${a.status}`), approved, historyCount: history.length, history };
  } finally { d.close(); }
}

// ---------- 브라우저 ----------
const browser = await chromium.launch();
const pages = {}, contexts = {};
async function waitIdle(p) { await p.waitForLoadState('networkidle'); await sleep(150); }
async function login(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const p = await ctx.newPage();
  p.on('response', async r => { if (r.url().endsWith('/api/auth/login')) { try { const j = await r.json(); if (j.accessToken) secrets.push(j.accessToken); } catch {} } });
  await p.goto(BASE); await waitIdle(p);
  await p.click(`button[data-user="${name}"]`);
  await p.click('#login-form button[type=submit]');
  await p.waitForFunction(() => document.getElementById('identity').textContent !== '로그인 전');
  await waitIdle(p);
  contexts[name] = ctx; pages[name] = p; return p;
}
async function selectEvent(p, id) {
  const btn = p.locator('article.event').nth(id - 1).getByRole('button');
  if ((await btn.textContent()) !== '선택됨') { await btn.click(); await waitIdle(p); }
}
async function refresh(p) { await p.getByRole('button', { name: '최신 정보 새로고침', exact: true }).click(); await waitIdle(p); }
const row = (p, who) => p.locator('article.app-row', { hasText: NAME[who] + ' ·' });
async function clickAndWait(p, locator, urlPart) {
  const resP = p.waitForResponse(r => r.url().includes(urlPart) && r.request().method() === 'POST');
  await locator.click(); const res = await resP; await waitIdle(p);
  return { status: res.status(), notice: await p.locator('#notice').textContent() };
}
async function applyUI(p) { return clickAndWait(p, p.getByRole('button', { name: '참가 신청', exact: true }), '/applications'); }
async function cancelUI(p, who) { return clickAndWait(p, row(p, who).getByRole('button', { name: '신청 취소', exact: true }), '/cancel'); }
async function approveUI(p, who) { return clickAndWait(p, row(p, who).getByRole('button', { name: '참가 승인', exact: true }), '/approve'); }
async function revokeUI(p, who, reason) {
  await row(p, who).locator('input[type=text]').fill(reason);
  return clickAndWait(p, row(p, who).getByRole('button', { name: '승인 취소 및 다음 대기자 승급', exact: true }), '/revoke');
}
async function openHistory(p, who) {
  await row(p, who).getByRole('button', { name: '변경 이력 보기', exact: true }).click();
  await row(p, who).locator('.history p').first().waitFor(); await waitIdle(p);
  return (await row(p, who).locator('.history p').allTextContents());
}
async function screenText(p) {
  return {
    identity: await p.locator('#identity').textContent(),
    notice: await p.locator('#notice').textContent(),
    capacity: await p.locator('article.event').evaluateAll(es => es.map(e => `${e.querySelector('h3').textContent}: ${e.querySelector('.capacity').textContent}`)),
    rows: await p.locator('article.app-row').evaluateAll(es => es.map(e => ({ head: e.querySelector('.row').innerText.replace(/\s+/g, ' '), history: [...e.querySelectorAll('.history p')].map(x => x.textContent) }))),
    title: await p.locator('#selected-title').textContent(),
  };
}
// 스크린샷 직전 비밀 값 검사: 페이지 HTML·보이는 텍스트·입력값에 토큰·서명 키·JWT 형태 문자열이 없는지 확인합니다.
async function shot(u, file, desc, p, { openResponse = false } = {}) {
  if (openResponse) await p.evaluate(() => { document.querySelector('details.response').open = true; });
  const html = await p.content(), text = await p.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('input')].map(i => i.value).join('\n'));
  let key = ''; try { key = readFileSync(KEY, 'utf8').trim(); } catch {}
  const hay = html + '\n' + text;
  const leaks = [...secrets, key].filter(s => s && hay.includes(s)).length + (/eyJ[A-Za-z0-9_-]{10,}\./.test(hay) ? 1 : 0);
  const responseOpen = await p.evaluate(() => document.querySelector('details.response').open);
  const storage = await p.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
  mkdirSync(SHOTS, { recursive: true });
  await p.screenshot({ path: `${SHOTS}/${file}`, fullPage: true });
  if (openResponse) await p.evaluate(() => { document.querySelector('details.response').open = false; });
  const st = await screenText(p);
  result.shots.push({ u, file, desc, leaks, responseOpen, storage, screen: st, db: dbState() });
  result.secretsChecked++;
  console.log(`  📷 ${file} (leaks=${leaks}) ${st.notice}`);
  if (leaks) throw new Error(`${file}: 화면에 비밀 값 발견 → 중단`);
}

try {
  if (await healthy() || listeners().length) throw new Error(`포트 ${PORT}에서 이미 서버가 실행 중입니다. 먼저 종료하세요.`);
  rmSync(SHOTS, { recursive: true, force: true });
  const reset = execFileSync('npm', ['run', 'db:reset'], { cwd: ROOT, env: ENV, input: 'RESET\n' }).toString();
  result.reset = reset.trim().split('\n').slice(-2).join(' / ');
  rec('준비', `echo RESET | npm run db:reset → ${result.reset}; DB: ${JSON.stringify(dbState().apps)}`);
  await startServer('최초 시작 (PORT=' + PORT + ' npm start)');

  // ===== U01 =====
  const alice = await login('alice');
  let r = await applyUI(alice); rec('U01', `alice 행사1 [참가 신청] → HTTP ${r.status}, 알림 "${r.notice}"`);
  await shot('U01', 'U01-1_alice-행사1-신청직후-PENDING.png', 'alice 화면: 행사 1 신청 직후 상태 "승인 대기"(PENDING)', alice);
  const m1 = await login('manager1');
  r = await approveUI(m1, 'alice'); rec('U01', `manager1 민지 [참가 승인] → HTTP ${r.status}, 알림 "${r.notice}"`);
  await shot('U01', 'U01-2_manager1-alice-승인후-APPROVED-승인1.png', 'manager1 화면: 민지 "참가 승인"(APPROVED), 행사 1 "승인 1 / 정원 2명"', m1);
  await refresh(alice); rec('U01', 'alice [최신 정보 새로고침]');
  await shot('U01', 'U01-3_alice-새로고침-APPROVED.png', 'alice 화면: 새로고침 후 본인 신청 "참가 승인"(APPROVED) 확인', alice);

  // ===== U02 =====
  const bob = await login('bob');
  await selectEvent(bob, 2); r = await applyUI(bob); rec('U02', `bob 행사2 [참가 신청] → HTTP ${r.status}`);
  await shot('U02', 'U02-1_bob-행사2-신청-PENDING.png', 'bob 화면: 행사 2 신청 "승인 대기"(PENDING)', bob);
  const m2 = await login('manager2');
  await selectEvent(m2, 2); rec('U02', 'manager2 행사2 선택 → bob PENDING 목록 열어 둠(이후 새로고침 안 함)');
  await shot('U02', 'U02-2_manager2-오래된화면-bob-PENDING.png', 'manager2 화면: bob "승인 대기"와 [참가 승인] 버튼이 보이는 상태(이 화면을 새로고침하지 않고 유지)', m2);
  r = await cancelUI(bob, 'bob'); rec('U02', `bob [신청 취소] → HTTP ${r.status}, 알림 "${r.notice}"`);
  await shot('U02', 'U02-3_bob-대기취소-CANCELLED.png', 'bob 화면: 대기 취소 후 "대기 취소"(CANCELLED)', bob);
  r = await approveUI(m2, 'bob'); rec('U02', `manager2 오래된 화면에서 준호 [참가 승인] → HTTP ${r.status}, 알림 "${r.notice}"`, { approveStale: r });
  await shot('U02', 'U02-4_manager2-오래된화면-승인거부-409.png', 'manager2 화면: 오래된 화면에서 승인 클릭 → 상단 알림 "409 INVALID_STATE" 거부 메시지', m2);
  await refresh(m2); rec('U02', 'manager2 [최신 정보 새로고침]');
  await shot('U02', 'U02-5_manager2-새로고침-CANCELLED-승인0.png', 'manager2 화면: 새로고침 후 bob "대기 취소"(CANCELLED), 행사 2 "승인 0 / 정원 1명"', m2);

  // ===== U04 =====
  const charlie = await login('charlie');
  r = await applyUI(charlie); rec('U04', `charlie 행사1 [참가 신청] → HTTP ${r.status}`);
  await shot('U04', 'U04-1_charlie-행사1-신청-PENDING.png', 'charlie 화면: 행사 1 신청 "승인 대기"', charlie);
  await refresh(m1); r = await approveUI(m1, 'charlie'); rec('U04', `manager1 서연 [참가 승인] → HTTP ${r.status}`);
  await shot('U04', 'U04-2_manager1-charlie-승인-정원2of2.png', 'manager1 화면: 민지·서연 승인, 행사 1 "승인 2 / 정원 2명"', m1);
  await selectEvent(bob, 1); r = await applyUI(bob); rec('U04', `bob 행사1 [참가 신청] → HTTP ${r.status}`);
  await shot('U04', 'U04-3_bob-행사1-대기-PENDING.png', 'bob 화면: 행사 1 신청 "승인 대기"(대기자)', bob);
  await refresh(m1); rec('U04', 'manager1 [최신 정보 새로고침]');
  await shot('U04', 'U04-4_manager1-승인취소전-대기자bob.png', 'manager1 화면(승인 취소 전): 민지·서연 승인, 준호 대기, 승인 2/2', m1);
  r = await revokeUI(m1, 'alice', REASON); rec('U04', `manager1 민지 사유 "${REASON}" 입력 후 [승인 취소 및 다음 대기자 승급] → HTTP ${r.status}, 알림 "${r.notice}"`);
  await shot('U04', 'U04-5_manager1-승인취소후-alice-REVOKED-bob-APPROVED-승인2.png', 'manager1 화면: 민지 "승인 취소"(REVOKED), 준호 자동 승급 "참가 승인"(APPROVED), 행사 1 "승인 2 / 정원 2명"', m1);
  const ha = await openHistory(m1, 'alice'), hb = await openHistory(m1, 'bob');
  rec('U04', `manager1 [변경 이력 보기] 민지: ${JSON.stringify(ha)} / 준호: ${JSON.stringify(hb)}`, { historyAlice: ha, historyBob: hb });
  await shot('U04', 'U04-6_manager1-이력-alice-REVOKE사유-bob-AUTO_APPROVE원인.png', 'manager1 화면: 민지 이력(REVOKE 사유)과 준호 이력(AUTO_APPROVE, 행위자 #3, 원인 이력 = 민지 REVOKE 이력 ID)', m1);

  // ===== U05 =====
  await refresh(m1);
  r = await revokeUI(m1, 'charlie', REASON); rec('U05', `manager1 서연 사유 "${REASON}" 입력 후 [승인 취소 및 다음 대기자 승급] → HTTP ${r.status}, 알림 "${r.notice}"`);
  await shot('U05', 'U05-1_manager1-charlie-REVOKED-승인1-빈자리1.png', 'manager1 화면: 서연 "승인 취소"(REVOKED), 대기자 없음 → 자동 승급 없음, 행사 1 "승인 1 / 정원 2명"', m1);
  await shot('U05', 'U05-2_manager1-최근응답-promoted-null.png', 'manager1 화면 하단 "최근 API 응답 확인" 패널(앱 기본 UI, 토큰 제거 표시): revoke 응답 promoted: null', m1, { openResponse: true });
  const hc = await openHistory(m1, 'charlie'); rec('U05', `서연 이력: ${JSON.stringify(hc)}`, { historyCharlie: hc });
  await shot('U05', 'U05-3_manager1-charlie-이력-REVOKE.png', 'manager1 화면: 서연 이력(APPLY → APPROVE → REVOKE, 자동 승급 이력 없음)', m1);

  // ===== U03 =====
  await refresh(m1);
  const preB = await openHistory(m1, 'bob'), preC = await openHistory(m1, 'charlie');
  const before = await screenText(m1), dbBefore = dbState(), dbStat = statSync(DB);
  rec('U03', `재시작 전 manager1 행사1 목록·준호/서연 이력 열기`, { before, dbBefore });
  await shot('U03', 'U03-1_재시작전-manager1-행사1목록-이력.png', '서버 종료 전 manager1 화면: 행사 1 목록과 준호·서연 변경 이력', m1);
  const stop = await stopServer('U03 서버 종료(kill)');
  rec('U03', `서버 종료: 종료 PID ${stop.killed.join(',')} (${stop.how}), exit ${JSON.stringify(stop.exit)}, 종료 후 LISTEN 프로세스 ${stop.listenAfter.length}개, health ${stop.healthAfter}`);
  await refresh(m1).catch(() => {});
  await shot('U03', 'U03-2_서버종료후-새로고침-응답없음.png', '서버 종료 직후 같은 manager1 화면에서 [최신 정보 새로고침] → "응답을 받지 못했습니다" 알림(서버가 내려간 것 확인)', m1);
  for (const c of Object.values(contexts)) await c.close();
  const restart = await startServer('U03 재실행 (db:reset 없이 npm start)');
  rec('U03', `db:reset 없이 npm start 재실행 → health ok, LISTEN PID ${restart.listenPids.join(',')} (새 프로세스)`);
  const m1b = await login('manager1'); rec('U03', '새 브라우저 컨텍스트에서 manager1 다시 로그인');
  const postB = await openHistory(m1b, 'bob'), postC = await openHistory(m1b, 'charlie');
  const after = await screenText(m1b), dbAfter = dbState();
  const sameScreen = JSON.stringify(before.rows) === JSON.stringify(after.rows) && JSON.stringify(before.capacity) === JSON.stringify(after.capacity);
  const sameDb = JSON.stringify(dbBefore) === JSON.stringify(dbAfter);
  rec('U03', `재시작 전후 화면 목록·이력 텍스트 동일: ${sameScreen}, DB 신청·이력 동일: ${sameDb}`, { after, dbAfter, sameScreen, sameDb, preB, preC, postB, postC });
  await shot('U03', 'U03-3_재시작후-재로그인-manager1-행사1목록-이력.png', '서버 재실행·재로그인 후 manager1 화면: 같은 행사 1 목록과 준호·서연 변경 이력', m1b);
  await stopServer('검증 종료 후 서버 종료');
  result.ok = true;
} catch (e) {
  result.ok = false; result.error = e.stack || String(e); console.error(result.error);
  if (server) await stopServer('오류로 인한 서버 종료').catch(() => {});
} finally {
  await browser.close();
  result.secretCount = secrets.length;
  writeFileSync(RESULT, JSON.stringify(result, null, 2));
  console.log(`결과: ${RESULT}`);
}

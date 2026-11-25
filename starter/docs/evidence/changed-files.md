# 변경 파일 목록 (제공 코드 vs 직접 변경)

기준: 배포본 `과제2_학생배포.zip`의 `starter/`와 현재 `starter/`를 `diff -rq`로 비교했습니다(`node_modules`, `data/`, `.DS_Store` 제외).

## 직접 변경한 파일

| 파일 | 변경 내용 |
|---|---|
| `src/application-service.js` | TODO-01~04(`apply`, `cancel`, `approve`, `revoke`) 구현. 트랜잭션 헬퍼 `inTransaction`, 오류 헬퍼 `alreadyApplied`·`capacityFull`, 공통 함수 `loadApplication`·`isManagerOf`를 추가했습니다. 1행 import와 `createApplicationService(repo)` 시그니처는 제공 코드 그대로입니다. |
| `src/repository.js` | 20–21행 `nextPending(eventId)`(대기자 선택 SQL) **추가만** 했습니다. 기존 함수는 수정하지 않았습니다. |

## 새로 추가한 파일

| 파일 | 내용 |
|---|---|
| `scripts/collect-evidence.mjs` | T01~T32 시나리오를 임시 DB + 실제 HTTP로 재현해 `t-details.md`를 만드는 증거 수집 스크립트(`node scripts/collect-evidence.mjs`). 테스트·구현 코드는 읽기만 합니다 |
| `docs/evidence/t-details.md` | T별 요청·응답·전후 상태·승인 인원·이력 변화 기록, T28~T30 실패 주입·롤백 요약 |
| `docs/evidence/test-output.txt` | `npm test`, `npm run test:assignment` 전체 출력 |
| `docs/evidence/code-excerpts.md` | 구현 코드 발췌(줄번호 포함) |
| `docs/evidence/design-notes.md` | 대기자 SQL·트랜잭션 경계·이력 순서 설명 |
| `docs/evidence/changed-files.md` | 이 문서 |
| `docs/evidence/reproduce.md` | 실행 재현 명령 |

## 변경하지 않은 제공 코드

`src/app.js`, `src/auth.js`, `src/db.js`, `src/errors.js`, `src/server.js`, `public/*`, `scripts/check-version.js`, `scripts/reset-db.js`, `tests/*`(기대값·검사 변경 없음), `docs/API.md`, `package.json`, `package-lock.json`, `.gitignore`, `.npmrc`, `.nvmrc`, `README.md`

## 제출에서 제외되는 파일(.gitignore로 제외됨)

`node_modules/`, `data/app.sqlite`, `data/jwt-secret.txt`(서명 키), `.env`

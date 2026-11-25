# 설계 노트: 대기자 선택·트랜잭션 경계·이력 저장 순서

줄번호는 `starter/` 기준입니다(`code-excerpts.md`와 같음).

## 1. 대기자 선택 SQL

`src/repository.js` L21 `nextPending(eventId)`:

```sql
SELECT a.id, a.event_id AS eventId, a.user_id AS userId, a.status, a.created_at AS createdAt, ...
FROM applications a JOIN users u ON u.id=a.user_id JOIN events e ON e.id=a.event_id
WHERE a.event_id = ? AND a.status = 'PENDING'
ORDER BY a.created_at ASC, a.id ASC
LIMIT 1
```

- `a.event_id = ?`: 승인 취소된 신청과 **같은 행사**만 대상입니다. 다른 행사는 제외됩니다(T20).
- `a.status = 'PENDING'`: CANCELLED·REVOKED·APPROVED는 제외됩니다(T20).
- `ORDER BY a.created_at ASC, a.id ASC`: 신청 시각이 이른 순서이고, 시각이 같으면 ID가 작은 순서입니다. 두 키를 함께 정렬하므로 결과가 항상 하나로 정해집니다(T18, T19). `created_at`은 `strftime('%Y-%m-%dT%H:%M:%fZ')` 형식의 ISO 문자열이라 문자열 비교가 곧 시각 비교입니다.
- `LIMIT 1`: 요청 한 번에 **최대 한 명**만 승급합니다. 기존 빈자리가 더 있어도 더 채우지 않습니다(T32).
- 결과가 없으면 `undefined`를 반환하고, 서비스는 `promoted=null`로 응답합니다(T17).
- 이 조회는 `revoke`의 트랜잭션 **안에서**, 대상 신청을 REVOKED로 바꾼 **뒤에** 실행합니다. 따라서 선택 결과는 같은 트랜잭션이 보는 최신 DB 상태를 기준으로 합니다.

## 2. 트랜잭션 시작 / COMMIT / ROLLBACK 지점

헬퍼 `inTransaction(db, fn)`은 `src/application-service.js` L15–L25에 있습니다.

| 지점 | 위치 | 설명 |
|---|---|---|
| 시작 | L16 `db.exec('BEGIN IMMEDIATE')` | 서비스 함수 맨 앞, DB 조회 전에 시작합니다. IMMEDIATE는 시작 시점에 쓰기 잠금(RESERVED)을 잡습니다. 그래서 같은 파일을 쓰는 다른 연결은 이 트랜잭션이 끝날 때까지 쓰기를 시작하지 못하고(`busy_timeout=5000`으로 대기), "검사 시점과 저장 시점 사이의 변경"이 생기지 않습니다. |
| COMMIT | L19 `db.exec('COMMIT')` | `fn()`이 예외 없이 반환된 뒤에만 실행합니다. 상태 변경과 이력이 함께 영구 저장됩니다. |
| ROLLBACK | L22 `if(db.isTransaction) db.exec('ROLLBACK')` | `fn()` 안에서 어떤 예외가 나도(업무 거부 `AppError`, SQLite 저장 오류) 실행한 뒤 예외를 다시 던집니다. `app.js`의 오류 처리기는 AppError면 4xx를, 그 밖의 오류면 500 INTERNAL_ERROR를 응답합니다. |

ROLLBACK을 직접 해야 하는 이유: T28–T30의 트리거 `RAISE(ABORT, ...)`는 **실패한 INSERT 한 문장만** 취소하고 트랜잭션은 열어 둡니다. 그 전에 실행된 `UPDATE applications`는 남아 있으므로, 명시적으로 ROLLBACK하지 않으면 부분 저장이 됩니다. `isTransaction`을 확인하는 것은 SQLite가 이미 트랜잭션을 자동 종료한 경우에 ROLLBACK을 다시 실행하다 원래 오류가 다른 오류로 가려지는 일을 막기 위해서입니다.

네 함수 모두 `tx(() => { 재조회 → 검사 → 저장 })` 형태입니다(L40, L55, L67, L81). 검사도 트랜잭션 안에서 하므로, 거부된 요청은 아무것도 쓰지 않은 채 ROLLBACK되어 상태와 이력이 그대로입니다(R8, T26).

## 3. 함수별 처리 순서와 이력 저장 순서

모두 **최신 DB 재조회 → 존재(404) → 권한(403) → 상태·중복(409) → 정원(409) → 상태 저장 → 이력 저장** 순서입니다. 인증(401)과 ID·본문 형식(400)은 제공된 `app.js`가 서비스 호출 전에 처리합니다.

| 함수 | 검사 | 저장 순서(같은 트랜잭션) |
|---|---|---|
| apply L39–L51 | `repo.event` 없음→404, STUDENT 아님→403, `repo.existing`(모든 상태 포함)→409 ALREADY_APPLIED | ① `repo.insert` PENDING (UNIQUE 위반 errcode 2067도 409로 변환) ② `addHistory` APPLY(null→PENDING) |
| cancel L54–L63 | 신청 없음→404, 본인 학생 아님→403, PENDING 아님→409 | ① `setStatus` CANCELLED ② `addHistory` CANCEL. 자동 승급하지 않음 |
| approve L66–L76 | 신청 없음→404, 담당 MANAGER 아님→403, PENDING 아님→409, `approvedCount ≥ capacity`→409 CAPACITY_FULL | ① `setStatus` APPROVED ② `addHistory` APPROVE |
| revoke L80–L96 | 신청 없음→404, 담당 MANAGER 아님→403, APPROVED 아님→409 (반복 승인 취소 거부) | ① `setStatus` REVOKED ② `addHistory` REVOKE(reason) → **ID 반환값 저장** ③ `nextPending` 조회 ④ 있으면 `setStatus` APPROVED ⑤ `addHistory` AUTO_APPROVE(actorId=요청 운영자, causeHistoryId=②의 ID) |

revoke에서 REVOKE 이력을 AUTO_APPROVE보다 **먼저** 저장하는 이유는 `cause_history_id`가 REVOKE 이력 ID를 참조하는 외래키이기 때문입니다. 그래서 AUTO_APPROVE 이력 ID는 항상 REVOKE 이력 ID보다 큽니다(T25 `p.id > h.id`). reason은 `app.js`가 이미 trim하고 5~200자를 검사한 값을 그대로 저장합니다(T23).

## 4. 자동 승급 이력 저장이 실패하면 롤백되는 범위

`revoke` 트랜잭션 안에서 ⑤ `addHistory(AUTO_APPROVE)`가 실패하면(T29 트리거):

1. ⑤ INSERT 문장이 SQLite에서 취소되고 예외가 발생합니다.
2. `inTransaction`의 catch(L21–L23)가 ROLLBACK을 실행합니다. 이때 ①(대상 REVOKED), ②(REVOKE 이력), ④(대기자 APPROVED)가 **모두** 되돌아갑니다.
3. 500 INTERNAL_ERROR를 응답합니다. DB에는 요청 전 상태가 그대로 남습니다: 대상은 APPROVED, 대기자는 PENDING, 이력은 추가되지 않음.
4. 트리거를 제거하고 다시 요청하면 정상적으로 승급됩니다(T29 후반부).

②(T30 REVOKE 실패)나 APPLY·APPROVE·CANCEL 이력이 실패할 때도 같은 경로로 처리됩니다(T28, T30).

## 5. 선택 심화(test:advanced) 관련 메모

별도 구현은 하지 않았습니다. 기존 구현 그대로 실행한 결과는 1/1 통과입니다. 통과한 이유는 `BEGIN IMMEDIATE`로 두 서버 프로세스의 쓰기 트랜잭션이 직렬화되고, 두 번째 요청은 잠금을 얻은 뒤 정원을 다시 조회하기 때문입니다. 한계: SQLite 단일 파일과 로컬 파일 잠금을 전제로 합니다. 반복 실행에서 통과했다고 모든 경쟁 상황이 없다는 것이 증명되지는 않습니다.

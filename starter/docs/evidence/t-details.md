# T01~T32 실제 실행 증거

- 생성: `node scripts/collect-evidence.mjs` (v24.22.0), 2026-11-25T10:18:31.862Z
- 방법: `tests/assignment.test.js`의 각 시나리오를 **시나리오마다 새 임시 SQLite 파일 + 실제 HTTP 서버**(127.0.0.1, 임의 포트)로 같은 순서대로 다시 실행했습니다. 테스트 파일·기대값·구현 코드(`src/`)는 바꾸지 않았습니다.
- 각 행은 요청 1건입니다. "전/후"는 그 요청 **직전·직후**에 DB(applications, application_history)를 직접 조회한 값입니다. **굵게** 표시한 값은 그 요청으로 바뀐 값입니다.
- 신청 표기: `#신청ID 학생·E행사ID 상태`. 이력 표기: `h이력ID 신청#ID 행위자(ID) 행위 전→후 cause=원인이력ID`. ∅는 이전 상태 없음(null)입니다.
- "기대"는 테스트의 `expect(status, code)` 값입니다. "+DB 불변"은 테스트가 그 요청 전후로 `deepEqual`을 검사하는 단계입니다. 불변 판정은 applications·application_history의 **모든 행·모든 컬럼**을 비교했습니다(테스트가 applications만 비교하는 T04·T07·T09~T13보다 엄격합니다).
- 비밀 값: 로그인 토큰은 `Authorization: Bearer ***`로만 다루고 문서에 기록하지 않았습니다. 서명 키는 실행마다 임의로 만든 임시 값이며 기록하지 않았습니다. 파일을 쓰기 전에 출력물에 토큰·키 문자열이 없는지 검사했습니다.
- 계정 ID: alice 1, bob 2, manager1 3(행사 1 담당, 정원 2), manager2 4(행사 2 담당, 정원 1), charlie 5.

## 요약: 32/32 시나리오가 기대와 일치

| T | 시나리오 | 요청 수 | 추가 확인 | 결과 |
|---|---|---|---|---|
| [T01](#t01) | 정상 신청은 본인 ID와 PENDING으로 저장 | 1 | 4/4 | ✔ 일치 |
| [T02](#t02) | 비로그인·위조 토큰의 변경은 401, 데이터 불변 | 2 | 1/1 | ✔ 일치 |
| [T03](#t03) | userId·role·status 위조는 400, 데이터 불변 | 3 | 1/1 | ✔ 일치 |
| [T04](#t04) | 대기·취소·승인 상태의 기존 신청은 모두 중복 | 7 | 0/0 | ✔ 일치 |
| [T05](#t05) | 같은 학생이 다른 행사에 신청 가능 | 2 | 1/1 | ✔ 일치 |
| [T06](#t06) | 본인의 대기 신청 취소 성공 | 3 | 1/1 | ✔ 일치 |
| [T07](#t07) | 타인·운영자의 학생 신청 취소는 403 | 3 | 0/0 | ✔ 일치 |
| [T08](#t08) | 담당 운영자의 대기 신청 승인 성공 | 4 | 2/2 | ✔ 일치 |
| [T09](#t09) | 학생·다른 행사 운영자의 승인은 403 | 3 | 0/0 | ✔ 일치 |
| [T10](#t10) | 취소 후 오래된 화면의 승인은 409, 취소 유지 | 3 | 0/0 | ✔ 일치 |
| [T11](#t11) | 승인 후 재승인·본인 취소는 409, 승인 유지 | 4 | 0/0 | ✔ 일치 |
| [T12](#t12) | 취소 후 다시 취소는 409, 데이터 불변 | 3 | 0/0 | ✔ 일치 |
| [T13](#t13) | 정원은 승인 인원 기준, 초과 요청은 대기 유지 | 8 | 2/2 | ✔ 일치 |
| [T14](#t14) | 역할·대상·상태 검사 순서 | 7 | 0/0 | ✔ 일치 |
| [T15](#t15) | 잘못된 ID, 다른 사람의 상세 조회 거부 | 4 | 0/0 | ✔ 일치 |
| [T16](#t16) | DB 재연결 후 신청과 상태 유지 | 2 | 2/2 | ✔ 일치 |
| [T17](#t17) | 승인 취소: 대기자가 없으면 REVOKED, promoted=null | 6 | 4/4 | ✔ 일치 |
| [T18](#t18) | 자동 승급: 같은 행사 created_at이 가장 이른 대기자 | 7 | 4/4 | ✔ 일치 |
| [T19](#t19) | 자동 승급: 시각이 같으면 ID 오름차순 | 6 | 2/2 | ✔ 일치 |
| [T20](#t20) | 자동 승급 대상에서 취소자·다른 행사를 제외 | 8 | 3/3 | ✔ 일치 |
| [T21](#t21) | 승인 취소 권한: 학생·다른 운영자·토큰 누락 거부 | 6 | 0/0 | ✔ 일치 |
| [T22](#t22) | 승인 취소 상태: 대기·대기 취소·승인 취소 상태 거부 | 10 | 0/0 | ✔ 일치 |
| [T23](#t23) | 승인 취소 사유: trim 후 5~200자, 추가 필드 거부 | 10 | 1/1 | ✔ 일치 |
| [T24](#t24) | 신청·취소·승인 이력의 행위자·전후 상태·순서 | 6 | 6/6 | ✔ 일치 |
| [T25](#t25) | 승인 취소와 자동 승급 이력을 원인 ID로 연결 | 6 | 4/4 | ✔ 일치 |
| [T26](#t26) | 거부된 요청은 상태와 성공 이력을 모두 변경하지 않음 | 7 | 1/1 | ✔ 일치 |
| [T27](#t27) | 변경 이력 조회: 본인·담당 운영자만 허용 | 7 | 0/0 | ✔ 일치 |
| [T28](#t28) | 신청 이력 저장 실패 시 신청 저장도 롤백 | 2 | 0/0 | ✔ 일치 |
| [T29](#t29) | 자동 승급 이력 저장 실패 시 두 상태와 두 이력 모두 롤백 | 5 | 1/1 | ✔ 일치 |
| [T30](#t30) | 승인·대기 취소·승인 취소 이력 실패도 롤백 | 8 | 0/0 | ✔ 일치 |
| [T31](#t31) | DB 재연결 후 승인 취소·승급 상태와 원인 이력 유지 | 4 | 2/2 | ✔ 일치 |
| [T32](#t32) | 연속 승인 취소: 요청당 최대 한 명 승급, 정원·중복 이력 보호 | 9 | 4/4 | ✔ 일치 |

## T28~T30 실패 주입·롤백 요약

| T | 주입한 실패 (실패하는 INSERT) | 실패 요청 → 응답 | 롤백 후 상태 (요청 전과 비교) | 트리거 제거 후 재시도 |
|---|---|---|---|---|
| T28 | `application_history` INSERT, action='APPLY' → `RAISE(ABORT,'TEST_INJECTED_FAILURE')` | `POST /api/events/1/applications` (alice(id 1)) → **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔ applications·이력 전체 불변<br>신청: (없음)<br>이력 0→0건 | [테스트 단계] `POST /api/events/1/applications` (alice(id 1)) → **201** #1 PENDING<br>Location /api/applications/1<br>새 이력: h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| T29 | `application_history` INSERT, action='AUTO_APPROVE' → `RAISE(ABORT,'TEST_INJECTED_FAILURE')` | `POST /api/applications/1/revoke` (manager1(id 3)) → **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔ applications·이력 전체 불변<br>신청: #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING<br>이력 3→3건 | [테스트 단계] `POST /api/applications/1/revoke` (manager1(id 3)) → **200** revoked=#1 REVOKED, promoted=#2 APPROVED<br>새 이력: h4 신청#1 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소"<br>h5 신청#2 manager1(3) AUTO_APPROVE PENDING→APPROVED cause=4 |
| T30 | `application_history` INSERT, action='APPROVE' → `RAISE(ABORT,'TEST_INJECTED_FAILURE')` | `POST /api/applications/1/approve` (manager1(id 3)) → **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔ applications·이력 전체 불변<br>신청: #1 alice·E1 PENDING<br>#2 bob·E1 PENDING<br>이력 2→2건 | [테스트 단계] `POST /api/applications/1/approve` (manager1(id 3)) → **200** #1 APPROVED<br>새 이력: h3 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| T30 | `application_history` INSERT, action='CANCEL' → `RAISE(ABORT,'TEST_INJECTED_FAILURE')` | `POST /api/applications/2/cancel` (bob(id 2)) → **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔ applications·이력 전체 불변<br>신청: #1 alice·E1 PENDING<br>#2 bob·E1 PENDING<br>이력 2→2건 | [추가 확인(테스트 외)] `POST /api/applications/2/cancel` (bob(id 2)) → **200** #2 CANCELLED<br>새 이력: h4 신청#2 bob(2) CANCEL PENDING→CANCELLED cause=null |
| T30 | `application_history` INSERT, action='REVOKE' → `RAISE(ABORT,'TEST_INJECTED_FAILURE')` | `POST /api/applications/1/revoke` (manager1(id 3)) → **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔ applications·이력 전체 불변<br>신청: #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING<br>이력 3→3건 | [추가 확인(테스트 외)] `POST /api/applications/1/revoke` (manager1(id 3)) → **200** revoked=#1 REVOKED, promoted=null<br>새 이력: h5 신청#1 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소" |

## T01

**정상 신청은 본인 ID와 PENDING으로 저장** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 응답 userId === 1 | 1 | ✔ |
| 응답 status === 'PENDING' | PENDING | ✔ |
| Location === /api/applications/{id} | /api/applications/1 | ✔ |
| applications 행 수 === 1 | 1 | ✔ |

## T02

**비로그인·위조 토큰의 변경은 401, 데이터 불변** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: 토큰 없음 | 401 | **401** TOKEN_REQUIRED | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 2 | `POST /api/events/1/applications`<br>행위자: 위조 토큰(`invalid`) | 401 | **401** INVALID_TOKEN | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| applications 행 수 === 0 | 0 | ✔ |

## T03

**userId·role·status 위조는 400, 데이터 불변** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1)<br>본문: `{"userId":2}` | 400 BAD_INPUT | **400** BAD_INPUT | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 2 | `POST /api/events/1/applications`<br>행위자: alice(id 1)<br>본문: `{"role":"MANAGER"}` | 400 BAD_INPUT | **400** BAD_INPUT | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 3 | `POST /api/events/1/applications`<br>행위자: alice(id 1)<br>본문: `{"status":"APPROVED"}` | 400 BAD_INPUT | **400** BAD_INPUT | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| applications 행 수 === 0 | 0 | ✔ |

## T04

**대기·취소·승인 상태의 기존 신청은 모두 중복** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 409 ALREADY_APPLIED<br>+DB 불변 | **409** ALREADY_APPLIED | ✔<br>불변 ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 3 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 200 | **200** #1 CANCELLED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 CANCELLED** | E1 0<br>E2 0 | 1→2 | h2 신청#1 alice(1) CANCEL PENDING→CANCELLED cause=null |
| 4 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 409 ALREADY_APPLIED<br>+DB 불변 | **409** ALREADY_APPLIED | ✔<br>불변 ✔ | #1 alice·E1 CANCELLED | #1 alice·E1 CANCELLED | E1 0<br>E2 0 | 2→2 | — |
| 5 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 CANCELLED | #1 alice·E1 CANCELLED<br>**#2 bob·E1 PENDING** | E1 0<br>E2 0 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 6 | `POST /api/applications/2/approve`<br>행위자: manager1(id 3) | 200 | **200** #2 APPROVED | ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 PENDING | #1 alice·E1 CANCELLED<br>**#2 bob·E1 APPROVED** | **E1 0→1**<br>E2 0 | 3→4 | h4 신청#2 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 7 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 409 ALREADY_APPLIED<br>+DB 불변 | **409** ALREADY_APPLIED | ✔<br>불변 ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 APPROVED | #1 alice·E1 CANCELLED<br>#2 bob·E1 APPROVED | E1 1<br>E2 0 | 4→4 | — |

## T05

**같은 학생이 다른 행사에 신청 가능** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/events/2/applications`<br>행위자: alice(id 1) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING<br>**#2 alice·E2 PENDING** | E1 0<br>E2 0 | 1→2 | h2 신청#2 alice(1) APPLY ∅→PENDING cause=null |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| applications 행 수 === 2 | 2 | ✔ |

## T06

**본인의 대기 신청 취소 성공** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 200 | **200** #1 CANCELLED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 CANCELLED** | E1 0<br>E2 0 | 1→2 | h2 신청#1 alice(1) CANCEL PENDING→CANCELLED cause=null |
| 3 | `GET /api/applications/1`<br>행위자: alice(id 1) | 200 | **200** #1 CANCELLED | ✔ | #1 alice·E1 CANCELLED | #1 alice·E1 CANCELLED | E1 0<br>E2 0 | 2→2 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 재조회 status === 'CANCELLED' | CANCELLED | ✔ |

## T07

**타인·운영자의 학생 신청 취소는 403** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/cancel`<br>행위자: bob(id 2) | 403 FORBIDDEN<br>+DB 불변 | **403** FORBIDDEN | ✔<br>불변 ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 3 | `POST /api/applications/1/cancel`<br>행위자: manager1(id 3) | 403 FORBIDDEN<br>+DB 불변 | **403** FORBIDDEN | ✔<br>불변 ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |

## T08

**담당 운영자의 대기 신청 승인 성공** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | `GET /api/applications/1`<br>행위자: alice(id 1) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 4 | `GET /api/events`<br>행위자: 토큰 없음 | 200 | **200** 배열 2건 | ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 재조회 status === 'APPROVED' | APPROVED | ✔ |
| 행사 1 approvedCount === 1 | 1 | ✔ |

## T09

**학생·다른 행사 운영자의 승인은 403** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: alice(id 1) | 403 FORBIDDEN<br>+DB 불변 | **403** FORBIDDEN | ✔<br>불변 ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 3 | `POST /api/applications/1/approve`<br>행위자: manager2(id 4) | 403 FORBIDDEN<br>+DB 불변 | **403** FORBIDDEN | ✔<br>불변 ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |

## T10

**취소 후 오래된 화면의 승인은 409, 취소 유지** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 200 | **200** #1 CANCELLED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 CANCELLED** | E1 0<br>E2 0 | 1→2 | h2 신청#1 alice(1) CANCEL PENDING→CANCELLED cause=null |
| 3 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 CANCELLED | #1 alice·E1 CANCELLED | E1 0<br>E2 0 | 2→2 | — |

## T11

**승인 후 재승인·본인 취소는 409, 승인 유지** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 4 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |

## T12

**취소 후 다시 취소는 409, 데이터 불변** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 200 | **200** #1 CANCELLED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 CANCELLED** | E1 0<br>E2 0 | 1→2 | h2 신청#1 alice(1) CANCEL PENDING→CANCELLED cause=null |
| 3 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 CANCELLED | #1 alice·E1 CANCELLED | E1 0<br>E2 0 | 2→2 | — |

## T13

**정원은 승인 인원 기준, 초과 요청은 대기 유지** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING<br>**#2 bob·E1 PENDING** | E1 0<br>E2 0 | 1→2 | h2 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 3 | `POST /api/events/1/applications`<br>행위자: charlie(id 5) | 201 | **201** #3 PENDING<br>Location /api/applications/3 | ✔ | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING<br>**#3 charlie·E1 PENDING** | E1 0<br>E2 0 | 2→3 | h3 신청#3 charlie(5) APPLY ∅→PENDING cause=null |
| 4 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING<br>#3 charlie·E1 PENDING | **#1 alice·E1 APPROVED**<br>#2 bob·E1 PENDING<br>#3 charlie·E1 PENDING | **E1 0→1**<br>E2 0 | 3→4 | h4 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 5 | `POST /api/applications/2/approve`<br>행위자: manager1(id 3) | 200 | **200** #2 APPROVED | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING<br>#3 charlie·E1 PENDING | #1 alice·E1 APPROVED<br>**#2 bob·E1 APPROVED**<br>#3 charlie·E1 PENDING | **E1 1→2**<br>E2 0 | 4→5 | h5 신청#2 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 6 | `POST /api/applications/3/approve`<br>행위자: manager1(id 3) | 409 CAPACITY_FULL<br>+DB 불변 | **409** CAPACITY_FULL | ✔<br>불변 ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 APPROVED<br>#3 charlie·E1 PENDING | #1 alice·E1 APPROVED<br>#2 bob·E1 APPROVED<br>#3 charlie·E1 PENDING | E1 2<br>E2 0 | 5→5 | — |
| 7 | `GET /api/events`<br>행위자: 토큰 없음 | 200 | **200** 배열 2건 | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 APPROVED<br>#3 charlie·E1 PENDING | #1 alice·E1 APPROVED<br>#2 bob·E1 APPROVED<br>#3 charlie·E1 PENDING | E1 2<br>E2 0 | 5→5 | — |
| 8 | `GET /api/applications/3`<br>행위자: charlie(id 5) | 200 | **200** #3 PENDING | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 APPROVED<br>#3 charlie·E1 PENDING | #1 alice·E1 APPROVED<br>#2 bob·E1 APPROVED<br>#3 charlie·E1 PENDING | E1 2<br>E2 0 | 5→5 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 행사 1 approvedCount === 2 | 2 | ✔ |
| charlie 신청 status === 'PENDING' | PENDING | ✔ |

## T14

**역할·대상·상태 검사 순서** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: manager1(id 3) | 403 FORBIDDEN | **403** FORBIDDEN | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 2 | `POST /api/events/9999/applications`<br>행위자: alice(id 1) | 404 NOT_FOUND | **404** NOT_FOUND | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 3 | `POST /api/applications/9999/approve`<br>행위자: manager1(id 3) | 404 NOT_FOUND | **404** NOT_FOUND | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 4 | `POST /api/applications/9999/cancel`<br>행위자: alice(id 1) | 404 NOT_FOUND | **404** NOT_FOUND | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 5 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 6 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 200 | **200** #1 CANCELLED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 CANCELLED** | E1 0<br>E2 0 | 1→2 | h2 신청#1 alice(1) CANCEL PENDING→CANCELLED cause=null |
| 7 | `POST /api/applications/1/approve`<br>행위자: manager2(id 4) | 403 FORBIDDEN | **403** FORBIDDEN | ✔ | #1 alice·E1 CANCELLED | #1 alice·E1 CANCELLED | E1 0<br>E2 0 | 2→2 | — |

## T15

**잘못된 ID, 다른 사람의 상세 조회 거부** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/abc/applications`<br>행위자: alice(id 1) | 400 BAD_INPUT | **400** BAD_INPUT | ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 2 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 3 | `GET /api/applications/1`<br>행위자: bob(id 2) | 403 FORBIDDEN | **403** FORBIDDEN | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 4 | `GET /api/applications/1`<br>행위자: manager2(id 4) | 403 FORBIDDEN | **403** FORBIDDEN | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |

## T16

**DB 재연결 후 신청과 상태 유지** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | *서버·DB 연결 종료 후 같은 DB 파일을 openDb로 다시 열기* | — | — | ✔ 동일 | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 재연결 후 user_id === 1 | 1 | ✔ |
| 재연결 후 status === 'APPROVED' | APPROVED | ✔ |

## T17

**승인 취소: 대기자가 없으면 REVOKED, promoted=null** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#1 REVOKED, promoted=null | ✔ | #1 alice·E1 APPROVED | **#1 alice·E1 REVOKED** | **E1 1→0**<br>E2 0 | 2→3 | h3 신청#1 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소" |
| 4 | `GET /api/applications/1`<br>행위자: alice(id 1) | 200 | **200** #1 REVOKED | ✔ | #1 alice·E1 REVOKED | #1 alice·E1 REVOKED | E1 0<br>E2 0 | 3→3 | — |
| 5 | `GET /api/events`<br>행위자: 토큰 없음 | 200 | **200** 배열 2건 | ✔ | #1 alice·E1 REVOKED | #1 alice·E1 REVOKED | E1 0<br>E2 0 | 3→3 | — |
| 6 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 409 ALREADY_APPLIED | **409** ALREADY_APPLIED | ✔ | #1 alice·E1 REVOKED | #1 alice·E1 REVOKED | E1 0<br>E2 0 | 3→3 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| revoked.status === 'REVOKED' | REVOKED | ✔ |
| promoted === null | null | ✔ |
| 재조회 status === 'REVOKED' | REVOKED | ✔ |
| 행사 1 approvedCount === 0 | 0 | ✔ |

## T18

**자동 승급: 같은 행사 created_at이 가장 이른 대기자** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/2/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E2 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager2(id 4) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E2 PENDING | **#1 alice·E2 APPROVED** | E1 0<br>**E2 0→1** | 1→2 | h2 신청#1 manager2(4) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/events/2/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E2 APPROVED | #1 alice·E2 APPROVED<br>**#2 bob·E2 PENDING** | E1 0<br>E2 1 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 4 | `POST /api/events/2/applications`<br>행위자: charlie(id 5) | 201 | **201** #3 PENDING<br>Location /api/applications/3 | ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>**#3 charlie·E2 PENDING** | E1 0<br>E2 1 | 3→4 | h4 신청#3 charlie(5) APPLY ∅→PENDING cause=null |
| 5 | *테스트 준비: bob 신청 #2 created_at=2026-11-02, charlie 신청 #3 created_at=2026-11-01로 직접 수정*<br>`UPDATE applications SET created_at=? WHERE id=?  (2회)` | — | — | 설정 | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 PENDING | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 PENDING | E1 0<br>E2 1 | 4→4 | — |
| 6 | `POST /api/applications/1/revoke`<br>행위자: manager2(id 4)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#1 REVOKED, promoted=#3 APPROVED | ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 PENDING | **#1 alice·E2 REVOKED**<br>#2 bob·E2 PENDING<br>**#3 charlie·E2 APPROVED** | E1 0<br>E2 1 | 4→6 | h5 신청#1 manager2(4) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소"<br>h6 신청#3 manager2(4) AUTO_APPROVE PENDING→APPROVED cause=5 |
| 7 | `GET /api/applications/2`<br>행위자: bob(id 2) | 200 | **200** #2 PENDING | ✔ | #1 alice·E2 REVOKED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 APPROVED | #1 alice·E2 REVOKED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 APPROVED | E1 0<br>E2 1 | 6→6 | — |
| 8 | `GET /api/events`<br>행위자: 토큰 없음 | 200 | **200** 배열 2건 | ✔ | #1 alice·E2 REVOKED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 APPROVED | #1 alice·E2 REVOKED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 APPROVED | E1 0<br>E2 1 | 6→6 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| promoted.id === charlie 신청 #3 | 3 | ✔ |
| promoted.status === 'APPROVED' | APPROVED | ✔ |
| bob 신청 status === 'PENDING' | PENDING | ✔ |
| 행사 2 approvedCount === 1 | 1 | ✔ |

## T19

**자동 승급: 시각이 같으면 ID 오름차순** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/2/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E2 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager2(id 4) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E2 PENDING | **#1 alice·E2 APPROVED** | E1 0<br>**E2 0→1** | 1→2 | h2 신청#1 manager2(4) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/events/2/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E2 APPROVED | #1 alice·E2 APPROVED<br>**#2 bob·E2 PENDING** | E1 0<br>E2 1 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 4 | `POST /api/events/2/applications`<br>행위자: charlie(id 5) | 201 | **201** #3 PENDING<br>Location /api/applications/3 | ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>**#3 charlie·E2 PENDING** | E1 0<br>E2 1 | 3→4 | h4 신청#3 charlie(5) APPLY ∅→PENDING cause=null |
| 5 | *테스트 준비: PENDING 신청 전부 created_at='2026-11-01T00:00:00.000Z'로 동일하게 수정*<br>`UPDATE applications SET created_at='2026-11-01T00:00:00.000Z' WHERE status='PENDING'` | — | — | 설정 | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 PENDING | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 PENDING | E1 0<br>E2 1 | 4→4 | — |
| 6 | `POST /api/applications/1/revoke`<br>행위자: manager2(id 4)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#1 REVOKED, promoted=#2 APPROVED | ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>#3 charlie·E2 PENDING | **#1 alice·E2 REVOKED**<br>**#2 bob·E2 APPROVED**<br>#3 charlie·E2 PENDING | E1 0<br>E2 1 | 4→6 | h5 신청#1 manager2(4) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소"<br>h6 신청#2 manager2(4) AUTO_APPROVE PENDING→APPROVED cause=5 |
| 7 | `GET /api/applications/3`<br>행위자: charlie(id 5) | 200 | **200** #3 PENDING | ✔ | #1 alice·E2 REVOKED<br>#2 bob·E2 APPROVED<br>#3 charlie·E2 PENDING | #1 alice·E2 REVOKED<br>#2 bob·E2 APPROVED<br>#3 charlie·E2 PENDING | E1 0<br>E2 1 | 6→6 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| promoted.id === bob 신청 #2 (더 작은 ID) | 2 | ✔ |
| charlie 신청 status === 'PENDING' | PENDING | ✔ |

## T20

**자동 승급 대상에서 취소자·다른 행사를 제외** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/2/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E2 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager2(id 4) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E2 PENDING | **#1 alice·E2 APPROVED** | E1 0<br>**E2 0→1** | 1→2 | h2 신청#1 manager2(4) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/events/2/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E2 APPROVED | #1 alice·E2 APPROVED<br>**#2 bob·E2 PENDING** | E1 0<br>E2 1 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 4 | `POST /api/events/1/applications`<br>행위자: charlie(id 5) | 201 | **201** #3 PENDING<br>Location /api/applications/3 | ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>**#3 charlie·E1 PENDING** | E1 0<br>E2 1 | 3→4 | h4 신청#3 charlie(5) APPLY ∅→PENDING cause=null |
| 5 | `POST /api/applications/2/cancel`<br>행위자: bob(id 2) | 200 | **200** #2 CANCELLED | ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING<br>#3 charlie·E1 PENDING | #1 alice·E2 APPROVED<br>**#2 bob·E2 CANCELLED**<br>#3 charlie·E1 PENDING | E1 0<br>E2 1 | 4→5 | h5 신청#2 bob(2) CANCEL PENDING→CANCELLED cause=null |
| 6 | `POST /api/applications/1/revoke`<br>행위자: manager2(id 4)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#1 REVOKED, promoted=null | ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 CANCELLED<br>#3 charlie·E1 PENDING | **#1 alice·E2 REVOKED**<br>#2 bob·E2 CANCELLED<br>#3 charlie·E1 PENDING | E1 0<br>**E2 1→0** | 5→6 | h6 신청#1 manager2(4) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소" |
| 7 | `GET /api/applications/2`<br>행위자: bob(id 2) | 200 | **200** #2 CANCELLED | ✔ | #1 alice·E2 REVOKED<br>#2 bob·E2 CANCELLED<br>#3 charlie·E1 PENDING | #1 alice·E2 REVOKED<br>#2 bob·E2 CANCELLED<br>#3 charlie·E1 PENDING | E1 0<br>E2 0 | 6→6 | — |
| 8 | `GET /api/applications/3`<br>행위자: charlie(id 5) | 200 | **200** #3 PENDING | ✔ | #1 alice·E2 REVOKED<br>#2 bob·E2 CANCELLED<br>#3 charlie·E1 PENDING | #1 alice·E2 REVOKED<br>#2 bob·E2 CANCELLED<br>#3 charlie·E1 PENDING | E1 0<br>E2 0 | 6→6 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| promoted === null | null | ✔ |
| bob 신청 status === 'CANCELLED' | CANCELLED | ✔ |
| charlie(행사 1) 신청 status === 'PENDING' | PENDING | ✔ |

## T21

**승인 취소 권한: 학생·다른 운영자·토큰 누락 거부** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/applications/1/revoke`<br>행위자: alice(id 1)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 403 FORBIDDEN<br>+DB 불변 | **403** FORBIDDEN | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 4 | `POST /api/applications/1/revoke`<br>행위자: bob(id 2)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 403 FORBIDDEN<br>+DB 불변 | **403** FORBIDDEN | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 5 | `POST /api/applications/1/revoke`<br>행위자: manager2(id 4)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 403 FORBIDDEN<br>+DB 불변 | **403** FORBIDDEN | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 6 | `POST /api/applications/1/revoke`<br>행위자: 토큰 없음<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 401<br>+DB 불변 | **401** TOKEN_REQUIRED | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |

## T22

**승인 취소 상태: 대기·대기 취소·승인 취소 상태 거부** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 3 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 200 | **200** #1 CANCELLED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 CANCELLED** | E1 0<br>E2 0 | 1→2 | h2 신청#1 alice(1) CANCEL PENDING→CANCELLED cause=null |
| 4 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 CANCELLED | #1 alice·E1 CANCELLED | E1 0<br>E2 0 | 2→2 | — |
| 5 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 CANCELLED | #1 alice·E1 CANCELLED<br>**#2 bob·E1 PENDING** | E1 0<br>E2 0 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 6 | `POST /api/applications/2/approve`<br>행위자: manager1(id 3) | 200 | **200** #2 APPROVED | ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 PENDING | #1 alice·E1 CANCELLED<br>**#2 bob·E1 APPROVED** | **E1 0→1**<br>E2 0 | 3→4 | h4 신청#2 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 7 | `POST /api/applications/2/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#2 REVOKED, promoted=null | ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 APPROVED | #1 alice·E1 CANCELLED<br>**#2 bob·E1 REVOKED** | **E1 1→0**<br>E2 0 | 4→5 | h5 신청#2 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소" |
| 8 | `POST /api/applications/2/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 REVOKED | #1 alice·E1 CANCELLED<br>#2 bob·E1 REVOKED | E1 0<br>E2 0 | 5→5 | — |
| 9 | `POST /api/applications/2/approve`<br>행위자: manager1(id 3) | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 REVOKED | #1 alice·E1 CANCELLED<br>#2 bob·E1 REVOKED | E1 0<br>E2 0 | 5→5 | — |
| 10 | `POST /api/applications/2/cancel`<br>행위자: bob(id 2) | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 REVOKED | #1 alice·E1 CANCELLED<br>#2 bob·E1 REVOKED | E1 0<br>E2 0 | 5→5 | — |

## T23

**승인 취소 사유: trim 후 5~200자, 추가 필드 거부** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3) | 400 BAD_INPUT<br>+DB 불변 | **400** BAD_INPUT | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 4 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":12}` | 400 BAD_INPUT<br>+DB 불변 | **400** BAD_INPUT | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 5 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"    "}` | 400 BAD_INPUT<br>+DB 불변 | **400** BAD_INPUT | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 6 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"abcd"}` | 400 BAD_INPUT<br>+DB 불변 | **400** BAD_INPUT | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 7 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx…` | 400 BAD_INPUT<br>+DB 불변 | **400** BAD_INPUT | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 8 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"유효한 취소 사유","actorId":4}` | 400 BAD_INPUT<br>+DB 불변 | **400** BAD_INPUT | ✔<br>불변 ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED | E1 1<br>E2 0 | 2→2 | — |
| 9 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"  운영 사정으로 취소  "}` | 200 | **200** revoked=#1 REVOKED, promoted=null | ✔ | #1 alice·E1 APPROVED | **#1 alice·E1 REVOKED** | **E1 1→0**<br>E2 0 | 2→3 | h3 신청#1 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 취소" |
| 10 | `GET /api/applications/1/history`<br>행위자: manager1(id 3) | 200 | **200** 배열 3건 | ✔ | #1 alice·E1 REVOKED | #1 alice·E1 REVOKED | E1 0<br>E2 0 | 3→3 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 마지막 이력 reason === '운영 사정으로 취소' (trim됨) | "운영 사정으로 취소" | ✔ |

## T24

**신청·취소·승인 이력의 행위자·전후 상태·순서** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING<br>**#2 bob·E1 PENDING** | E1 0<br>E2 0 | 1→2 | h2 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 3 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 200 | **200** #1 CANCELLED | ✔ | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | **#1 alice·E1 CANCELLED**<br>#2 bob·E1 PENDING | E1 0<br>E2 0 | 2→3 | h3 신청#1 alice(1) CANCEL PENDING→CANCELLED cause=null |
| 4 | `POST /api/applications/2/approve`<br>행위자: manager1(id 3) | 200 | **200** #2 APPROVED | ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 PENDING | #1 alice·E1 CANCELLED<br>**#2 bob·E1 APPROVED** | **E1 0→1**<br>E2 0 | 3→4 | h4 신청#2 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 5 | `GET /api/applications/1/history`<br>행위자: manager1(id 3) | 200 | **200** 배열 2건 | ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 APPROVED | #1 alice·E1 CANCELLED<br>#2 bob·E1 APPROVED | E1 1<br>E2 0 | 4→4 | — |
| 6 | `GET /api/applications/2/history`<br>행위자: manager1(id 3) | 200 | **200** 배열 2건 | ✔ | #1 alice·E1 CANCELLED<br>#2 bob·E1 APPROVED | #1 alice·E1 CANCELLED<br>#2 bob·E1 APPROVED | E1 1<br>E2 0 | 4→4 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| alice 이력 2건, bob 이력 2건 | 2, 2 | ✔ |
| alice[0]: actor=1 APPLY null→PENDING, reason·cause=null, createdAt 파싱 가능 | actor=1 APPLY null→PENDING reason=null cause=null createdAt=2026-11-25T10:18:30.378Z | ✔ |
| alice[1]: actor=1 CANCEL PENDING→CANCELLED, reason·cause=null, createdAt 파싱 가능 | actor=1 CANCEL PENDING→CANCELLED reason=null cause=null createdAt=2026-11-25T10:18:30.380Z | ✔ |
| bob[0]: actor=2 APPLY null→PENDING, reason·cause=null, createdAt 파싱 가능 | actor=2 APPLY null→PENDING reason=null cause=null createdAt=2026-11-25T10:18:30.379Z | ✔ |
| bob[1]: actor=3 APPROVE PENDING→APPROVED, reason·cause=null, createdAt 파싱 가능 | actor=3 APPROVE PENDING→APPROVED reason=null cause=null createdAt=2026-11-25T10:18:30.380Z | ✔ |
| 이력 ID 오름차순 | alice 1<3, bob 2<4 | ✔ |

## T25

**승인 취소와 자동 승급 이력을 원인 ID로 연결** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED<br>**#2 bob·E1 PENDING** | E1 1<br>E2 0 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 4 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#1 REVOKED, promoted=#2 APPROVED | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | **#1 alice·E1 REVOKED**<br>**#2 bob·E1 APPROVED** | E1 1<br>E2 0 | 3→5 | h4 신청#1 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소"<br>h5 신청#2 manager1(3) AUTO_APPROVE PENDING→APPROVED cause=4 |
| 5 | `GET /api/applications/1/history`<br>행위자: manager1(id 3) | 200 | **200** 배열 3건 | ✔ | #1 alice·E1 REVOKED<br>#2 bob·E1 APPROVED | #1 alice·E1 REVOKED<br>#2 bob·E1 APPROVED | E1 1<br>E2 0 | 5→5 | — |
| 6 | `GET /api/applications/2/history`<br>행위자: manager1(id 3) | 200 | **200** 배열 2건 | ✔ | #1 alice·E1 REVOKED<br>#2 bob·E1 APPROVED | #1 alice·E1 REVOKED<br>#2 bob·E1 APPROVED | E1 1<br>E2 0 | 5→5 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| REVOKE 이력: APPROVED→REVOKED, actor 3, cause null, reason 저장 | h4 REVOKE APPROVED→REVOKED actor=3 cause=null reason=운영 사정으로 승인 취소 | ✔ |
| AUTO_APPROVE 이력: PENDING→APPROVED, actor 3, cause = REVOKE 이력 ID, reason null | h5 AUTO_APPROVE PENDING→APPROVED actor=3 cause=4 reason=null | ✔ |
| AUTO_APPROVE 이력 ID > REVOKE 이력 ID | 5 > 4 | ✔ |
| alice 이력 3건, bob 이력 2건 | 3, 2 | ✔ |

## T26

**거부된 요청은 상태와 성공 이력을 모두 변경하지 않음** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/2/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E2 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager2(id 4) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E2 PENDING | **#1 alice·E2 APPROVED** | E1 0<br>**E2 0→1** | 1→2 | h2 신청#1 manager2(4) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/events/2/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E2 APPROVED | #1 alice·E2 APPROVED<br>**#2 bob·E2 PENDING** | E1 0<br>E2 1 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 4 | `POST /api/applications/2/approve`<br>행위자: manager2(id 4) | 409 CAPACITY_FULL<br>+DB 불변 | **409** CAPACITY_FULL | ✔<br>불변 ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | E1 0<br>E2 1 | 3→3 | — |
| 5 | `POST /api/events/2/applications`<br>행위자: alice(id 1) | 409 ALREADY_APPLIED<br>+DB 불변 | **409** ALREADY_APPLIED | ✔<br>불변 ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | E1 0<br>E2 1 | 3→3 | — |
| 6 | `POST /api/applications/1/cancel`<br>행위자: alice(id 1) | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | E1 0<br>E2 1 | 3→3 | — |
| 7 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 403 FORBIDDEN<br>+DB 불변 | **403** FORBIDDEN | ✔<br>불변 ✔ | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | #1 alice·E2 APPROVED<br>#2 bob·E2 PENDING | E1 0<br>E2 1 | 3→3 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 거부 4건 이후 applications·application_history 전체가 처음과 동일 | 동일 | ✔ |

## T27

**변경 이력 조회: 본인·담당 운영자만 허용** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `GET /api/applications/1/history`<br>행위자: alice(id 1) | 200 | **200** 배열 1건 | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 3 | `GET /api/applications/1/history`<br>행위자: manager1(id 3) | 200 | **200** 배열 1건 | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 4 | `GET /api/applications/1/history`<br>행위자: bob(id 2) | 403 FORBIDDEN | **403** FORBIDDEN | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 5 | `GET /api/applications/1/history`<br>행위자: manager2(id 4) | 403 FORBIDDEN | **403** FORBIDDEN | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 6 | `GET /api/applications/1/history`<br>행위자: 토큰 없음 | 401 | **401** TOKEN_REQUIRED | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |
| 7 | `GET /api/applications/9999/history`<br>행위자: alice(id 1) | 404 NOT_FOUND | **404** NOT_FOUND | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING | E1 0<br>E2 0 | 1→1 | — |

## T28

**신청 이력 저장 실패 시 신청 저장도 롤백** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | *실패 주입: 트리거 fail_apply 설치 — application_history INSERT 중 action='APPLY'인 행을 RAISE(ABORT)*<br>`CREATE TRIGGER fail_apply BEFORE INSERT ON application_history WHEN NEW.action='APPLY' BEGIN SELECT RAISE(ABORT,'TEST_INJECTED_FAILURE'); END` | — | — | 설정 | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 2 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 500 INTERNAL_ERROR<br>+DB 불변 | **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔<br>불변 ✔ | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 3 | *트리거 fail_apply 제거*<br>`DROP TRIGGER fail_apply` | — | — | 설정 | (없음) | (없음) | E1 0<br>E2 0 | 0→0 | — |
| 4 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |

## T29

**자동 승급 이력 저장 실패 시 두 상태와 두 이력 모두 롤백** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED<br>**#2 bob·E1 PENDING** | E1 1<br>E2 0 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 4 | *실패 주입: 트리거 fail_auto 설치 — application_history INSERT 중 action='AUTO_APPROVE'인 행을 RAISE(ABORT)*<br>`CREATE TRIGGER fail_auto BEFORE INSERT ON application_history WHEN NEW.action='AUTO_APPROVE' BEGIN SELECT RAISE(ABORT,'TEST_INJECTED_FAILURE'); END` | — | — | 설정 | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | E1 1<br>E2 0 | 3→3 | — |
| 5 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 500 INTERNAL_ERROR<br>+DB 불변 | **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔<br>불변 ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | E1 1<br>E2 0 | 3→3 | — |
| 6 | *트리거 fail_auto 제거*<br>`DROP TRIGGER fail_auto` | — | — | 설정 | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | E1 1<br>E2 0 | 3→3 | — |
| 7 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#1 REVOKED, promoted=#2 APPROVED | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | **#1 alice·E1 REVOKED**<br>**#2 bob·E1 APPROVED** | E1 1<br>E2 0 | 3→5 | h4 신청#1 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소"<br>h5 신청#2 manager1(3) AUTO_APPROVE PENDING→APPROVED cause=4 |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 재시도 promoted.id === bob 신청 #2 | 2 | ✔ |

## T30

**승인·대기 취소·승인 취소 이력 실패도 롤백** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 PENDING | #1 alice·E1 PENDING<br>**#2 bob·E1 PENDING** | E1 0<br>E2 0 | 1→2 | h2 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 3 | *실패 주입: 트리거 fail_change 설치 — application_history INSERT 중 action='APPROVE'인 행을 RAISE(ABORT)*<br>`CREATE TRIGGER fail_change BEFORE INSERT ON application_history WHEN NEW.action='APPROVE' BEGIN SELECT RAISE(ABORT,'TEST_INJECTED_FAILURE'); END` | — | — | 설정 | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | E1 0<br>E2 0 | 2→2 | — |
| 4 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 500 INTERNAL_ERROR<br>+DB 불변 | **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔<br>불변 ✔ | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | E1 0<br>E2 0 | 2→2 | — |
| 5 | *트리거 fail_change 제거*<br>`DROP TRIGGER fail_change` | — | — | 설정 | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | E1 0<br>E2 0 | 2→2 | — |
| 6 | *실패 주입: 트리거 fail_change 설치 — application_history INSERT 중 action='CANCEL'인 행을 RAISE(ABORT)*<br>`CREATE TRIGGER fail_change BEFORE INSERT ON application_history WHEN NEW.action='CANCEL' BEGIN SELECT RAISE(ABORT,'TEST_INJECTED_FAILURE'); END` | — | — | 설정 | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | E1 0<br>E2 0 | 2→2 | — |
| 7 | `POST /api/applications/2/cancel`<br>행위자: bob(id 2) | 500 INTERNAL_ERROR<br>+DB 불변 | **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔<br>불변 ✔ | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | E1 0<br>E2 0 | 2→2 | — |
| 8 | *트리거 fail_change 제거*<br>`DROP TRIGGER fail_change` | — | — | 설정 | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | E1 0<br>E2 0 | 2→2 | — |
| 9 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING<br>#2 bob·E1 PENDING | **#1 alice·E1 APPROVED**<br>#2 bob·E1 PENDING | **E1 0→1**<br>E2 0 | 2→3 | h3 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 10 | *실패 주입: 트리거 fail_revoke 설치 — application_history INSERT 중 action='REVOKE'인 행을 RAISE(ABORT)*<br>`CREATE TRIGGER fail_revoke BEFORE INSERT ON application_history WHEN NEW.action='REVOKE' BEGIN SELECT RAISE(ABORT,'TEST_INJECTED_FAILURE'); END` | — | — | 설정 | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | E1 1<br>E2 0 | 3→3 | — |
| 11 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 500 INTERNAL_ERROR<br>+DB 불변 | **500** INTERNAL_ERROR<br>서버 로그: TEST_INJECTED_FAILURE | ✔<br>불변 ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | E1 1<br>E2 0 | 3→3 | — |
| 12 | *트리거 fail_revoke 제거*<br>`DROP TRIGGER fail_revoke` | — | — | 설정 (추가) | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | E1 1<br>E2 0 | 3→3 | — |
| 13 | `POST /api/applications/2/cancel`<br>행위자: bob(id 2)<br>*(테스트 외 추가 확인)* | 200 | **200** #2 CANCELLED | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | #1 alice·E1 APPROVED<br>**#2 bob·E1 CANCELLED** | E1 1<br>E2 0 | 3→4 | h4 신청#2 bob(2) CANCEL PENDING→CANCELLED cause=null |
| 14 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}`<br>*(테스트 외 추가 확인)* | 200 | **200** revoked=#1 REVOKED, promoted=null | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 CANCELLED | **#1 alice·E1 REVOKED**<br>#2 bob·E1 CANCELLED | **E1 1→0**<br>E2 0 | 4→5 | h5 신청#1 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소" |

## T31

**DB 재연결 후 승인 취소·승급 상태와 원인 이력 유지** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED<br>**#2 bob·E1 PENDING** | E1 1<br>E2 0 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 4 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#1 REVOKED, promoted=#2 APPROVED | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | **#1 alice·E1 REVOKED**<br>**#2 bob·E1 APPROVED** | E1 1<br>E2 0 | 3→5 | h4 신청#1 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소"<br>h5 신청#2 manager1(3) AUTO_APPROVE PENDING→APPROVED cause=4 |
| 5 | *서버·DB 연결 종료 후 같은 DB 파일을 openDb로 다시 열기* | — | — | ✔ 동일 | #1 alice·E1 REVOKED<br>#2 bob·E1 APPROVED | #1 alice·E1 REVOKED<br>#2 bob·E1 APPROVED | E1 1<br>E2 0 | 5→5 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 재연결 후 applications 전체 행 동일 | 2행 | ✔ |
| 재연결 후 application_history 전체 행 동일(원인 ID 포함) | 5행 | ✔ |

## T32

**연속 승인 취소: 요청당 최대 한 명 승급, 정원·중복 이력 보호** — ✔ 기대와 일치

| # | 요청 | 기대 | 응답 | 판정 | 신청 상태 (전) | 신청 상태 (후) | APPROVED 인원 | 이력 건수 | 새 이력 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `POST /api/events/1/applications`<br>행위자: alice(id 1) | 201 | **201** #1 PENDING<br>Location /api/applications/1 | ✔ | (없음) | **#1 alice·E1 PENDING** | E1 0<br>E2 0 | 0→1 | h1 신청#1 alice(1) APPLY ∅→PENDING cause=null |
| 2 | `POST /api/applications/1/approve`<br>행위자: manager1(id 3) | 200 | **200** #1 APPROVED | ✔ | #1 alice·E1 PENDING | **#1 alice·E1 APPROVED** | **E1 0→1**<br>E2 0 | 1→2 | h2 신청#1 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 3 | `POST /api/events/1/applications`<br>행위자: bob(id 2) | 201 | **201** #2 PENDING<br>Location /api/applications/2 | ✔ | #1 alice·E1 APPROVED | #1 alice·E1 APPROVED<br>**#2 bob·E1 PENDING** | E1 1<br>E2 0 | 2→3 | h3 신청#2 bob(2) APPLY ∅→PENDING cause=null |
| 4 | `POST /api/applications/2/approve`<br>행위자: manager1(id 3) | 200 | **200** #2 APPROVED | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 PENDING | #1 alice·E1 APPROVED<br>**#2 bob·E1 APPROVED** | **E1 1→2**<br>E2 0 | 3→4 | h4 신청#2 manager1(3) APPROVE PENDING→APPROVED cause=null |
| 5 | `POST /api/events/1/applications`<br>행위자: charlie(id 5) | 201 | **201** #3 PENDING<br>Location /api/applications/3 | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 APPROVED | #1 alice·E1 APPROVED<br>#2 bob·E1 APPROVED<br>**#3 charlie·E1 PENDING** | E1 2<br>E2 0 | 4→5 | h5 신청#3 charlie(5) APPLY ∅→PENDING cause=null |
| 6 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#1 REVOKED, promoted=#3 APPROVED | ✔ | #1 alice·E1 APPROVED<br>#2 bob·E1 APPROVED<br>#3 charlie·E1 PENDING | **#1 alice·E1 REVOKED**<br>#2 bob·E1 APPROVED<br>**#3 charlie·E1 APPROVED** | E1 2<br>E2 0 | 5→7 | h6 신청#1 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소"<br>h7 신청#3 manager1(3) AUTO_APPROVE PENDING→APPROVED cause=6 |
| 7 | `POST /api/applications/2/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 200 | **200** revoked=#2 REVOKED, promoted=null | ✔ | #1 alice·E1 REVOKED<br>#2 bob·E1 APPROVED<br>#3 charlie·E1 APPROVED | #1 alice·E1 REVOKED<br>**#2 bob·E1 REVOKED**<br>#3 charlie·E1 APPROVED | **E1 2→1**<br>E2 0 | 7→8 | h8 신청#2 manager1(3) REVOKE APPROVED→REVOKED cause=null reason="운영 사정으로 승인 취소" |
| 8 | `GET /api/events`<br>행위자: 토큰 없음 | 200 | **200** 배열 2건 | ✔ | #1 alice·E1 REVOKED<br>#2 bob·E1 REVOKED<br>#3 charlie·E1 APPROVED | #1 alice·E1 REVOKED<br>#2 bob·E1 REVOKED<br>#3 charlie·E1 APPROVED | E1 1<br>E2 0 | 8→8 | — |
| 9 | `POST /api/applications/1/revoke`<br>행위자: manager1(id 3)<br>본문: `{"reason":"운영 사정으로 승인 취소"}` | 409 INVALID_STATE<br>+DB 불변 | **409** INVALID_STATE | ✔<br>불변 ✔ | #1 alice·E1 REVOKED<br>#2 bob·E1 REVOKED<br>#3 charlie·E1 APPROVED | #1 alice·E1 REVOKED<br>#2 bob·E1 REVOKED<br>#3 charlie·E1 APPROVED | E1 1<br>E2 0 | 8→8 | — |

추가 확인 (테스트의 assert):

| 확인 | 실제 값 | 결과 |
|---|---|---|
| 첫 승인 취소 promoted.id === charlie 신청 #3 | 3 | ✔ |
| 두 번째 승인 취소 promoted === null | null | ✔ |
| 행사 1 approvedCount === 1 | 1 | ✔ |
| AUTO_APPROVE 이력 정확히 1건 | 1 | ✔ |

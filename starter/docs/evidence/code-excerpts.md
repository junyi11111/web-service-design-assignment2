# 직접 구현한 코드 발췌

모든 줄번호는 `starter/` 기준 실제 파일 줄번호입니다. 아래 범위 밖의 `src/application-service.js` 1행(import)은 제공 코드 그대로이고, 나머지 줄은 모두 이번에 작성했습니다. 발췌는 `awk`로 실제 파일에서 그대로 잘라 생성했습니다.

## 오류 헬퍼·상수

`src/application-service.js` L7–L10

```js
  7 | const alreadyApplied = () => new AppError(409,'ALREADY_APPLIED','이미 이 행사에 신청한 기록이 있습니다.');
  8 | const capacityFull = () => new AppError(409,'CAPACITY_FULL','승인 정원이 모두 찼습니다.');
  9 | // SQLITE_CONSTRAINT_UNIQUE 확장 오류 코드. UNIQUE(event_id,user_id) 최종 방어선 위반만 409로 바꿉니다.
 10 | const SQLITE_CONSTRAINT_UNIQUE = 2067;
```

## 트랜잭션 헬퍼 inTransaction

`src/application-service.js` L12–L25

```js
 12 | // 트랜잭션 헬퍼: fn 안의 조회·검사·저장을 하나의 트랜잭션으로 실행합니다.
 13 | // BEGIN IMMEDIATE로 시작 시점에 쓰기 잠금을 잡아, 검사 시점과 저장 시점 사이에 다른 연결이 끼어들지 못하게 합니다.
 14 | // fn이 정상 반환하면 COMMIT, 어떤 예외든(업무 규칙 거부·저장 오류) 발생하면 ROLLBACK 후 예외를 그대로 전달합니다.
 15 | export function inTransaction(db,fn) {
 16 |   db.exec('BEGIN IMMEDIATE');
 17 |   try {
 18 |     const result=fn();
 19 |     db.exec('COMMIT');
 20 |     return result;
 21 |   } catch(e) {
 22 |     if(db.isTransaction) db.exec('ROLLBACK');
 23 |     throw e;
 24 |   }
 25 | }
```

## 공통: 최신 상태 재조회·담당자 판정

`src/application-service.js` L27–L35

```js
 27 | export function createApplicationService(repo) {
 28 |   const tx = fn => inTransaction(repo.db,fn);
 29 |   // 매 요청마다 DB에서 최신 신청과 행사를 다시 읽습니다(R8). 화면·클라이언트 값은 사용하지 않습니다.
 30 |   const loadApplication = id => {
 31 |     const application=repo.application(id);
 32 |     if(!application) throw missing('신청');
 33 |     return {application,event:repo.event(application.eventId)};
 34 |   };
 35 |   const isManagerOf = (actor,event) => actor.role==='MANAGER' && event.managerId===actor.id;
```

## TODO-01 apply

`src/application-service.js` L38–L51

```js
 38 |     // TODO-01: 행사 존재 → 학생 역할 → 중복(종료 상태 포함) → PENDING 저장 + APPLY 이력.
 39 |     apply(actor,eventId) {
 40 |       return tx(() => {
 41 |         const event=repo.event(eventId);
 42 |         if(!event) throw missing('행사');
 43 |         if(actor.role!=='STUDENT') throw forbidden();
 44 |         if(repo.existing(event.id,actor.id)) throw alreadyApplied(); // CANCELLED·REVOKED도 중복(R2)
 45 |         let application;
 46 |         try { application=repo.insert(event.id,actor.id); }
 47 |         catch(e) { if(e.errcode===SQLITE_CONSTRAINT_UNIQUE) throw alreadyApplied(); throw e; }
 48 |         repo.addHistory({applicationId:application.id,actorId:actor.id,action:'APPLY',fromStatus:null,toStatus:'PENDING'});
 49 |         return application;
 50 |       });
 51 |     },
```

## TODO-02 cancel

`src/application-service.js` L53–L63

```js
 53 |     // TODO-02: 신청 존재 → 본인 → PENDING → CANCELLED 저장 + CANCEL 이력. 자동 승급하지 않습니다.
 54 |     cancel(actor,applicationId) {
 55 |       return tx(() => {
 56 |         const {application}=loadApplication(applicationId);
 57 |         if(actor.role!=='STUDENT' || application.userId!==actor.id) throw forbidden();
 58 |         if(application.status!=='PENDING') throw invalidState();
 59 |         const updated=repo.setStatus(application.id,'CANCELLED');
 60 |         repo.addHistory({applicationId:application.id,actorId:actor.id,action:'CANCEL',fromStatus:'PENDING',toStatus:'CANCELLED'});
 61 |         return updated;
 62 |       });
 63 |     },
```

## TODO-03 approve

`src/application-service.js` L65–L76

```js
 65 |     // TODO-03: 신청 존재 → 담당 운영자 → PENDING → 정원(APPROVED 수) → APPROVED 저장 + APPROVE 이력.
 66 |     approve(actor,applicationId) {
 67 |       return tx(() => {
 68 |         const {application,event}=loadApplication(applicationId);
 69 |         if(!isManagerOf(actor,event)) throw forbidden();
 70 |         if(application.status!=='PENDING') throw invalidState();
 71 |         if(repo.approvedCount(event.id)>=event.capacity) throw capacityFull(); // R4
 72 |         const updated=repo.setStatus(application.id,'APPROVED');
 73 |         repo.addHistory({applicationId:application.id,actorId:actor.id,action:'APPROVE',fromStatus:'PENDING',toStatus:'APPROVED'});
 74 |         return updated;
 75 |       });
 76 |     },
```

## TODO-04 revoke

`src/application-service.js` L78–L96

```js
 78 |     // TODO-04: 신청 존재 → 담당 운영자 → APPROVED → REVOKED + REVOKE 이력
 79 |     //          → 같은 행사 대기자 1명 AUTO_APPROVE + 원인 이력 연결. 전체가 한 트랜잭션입니다(R5~R7).
 80 |     revoke(actor,applicationId,reason) {
 81 |       return tx(() => {
 82 |         const {application,event}=loadApplication(applicationId);
 83 |         if(!isManagerOf(actor,event)) throw forbidden();
 84 |         if(application.status!=='APPROVED') throw invalidState(); // 반복 승인 취소도 여기서 거부(R8)
 85 |         const revoked=repo.setStatus(application.id,'REVOKED');
 86 |         const revokeHistoryId=repo.addHistory({applicationId:application.id,actorId:actor.id,action:'REVOKE',fromStatus:'APPROVED',toStatus:'REVOKED',reason});
 87 |         // 이 요청으로 생긴 한 자리만 채웁니다. 기존 빈자리가 더 있어도 최대 1명.
 88 |         const next=repo.nextPending(event.id);
 89 |         let promoted=null;
 90 |         if(next) {
 91 |           promoted=repo.setStatus(next.id,'APPROVED');
 92 |           repo.addHistory({applicationId:next.id,actorId:actor.id,action:'AUTO_APPROVE',fromStatus:'PENDING',toStatus:'APPROVED',causeHistoryId:revokeHistoryId});
 93 |         }
 94 |         return {revoked,promoted};
 95 |       });
 96 |     }
```

## repository 확장: 대기자 선택 nextPending (20–21행 추가)

`src/repository.js` L19–L21

```js
 19 |     // 대기 순서와 이력 저장 시점, 트랜잭션 경계는 서비스에서 결정합니다.
 20 |     // [학생 추가] 자동 승급 대상: 같은 행사 PENDING 중 created_at ASC, id ASC 첫 1건. 없으면 undefined.
 21 |     nextPending(eventId) { return db.prepare(selection+" WHERE a.event_id=? AND a.status='PENDING' ORDER BY a.created_at ASC, a.id ASC LIMIT 1").get(eventId); },
```


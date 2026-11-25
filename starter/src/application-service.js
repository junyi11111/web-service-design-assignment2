import { AppError, missing, forbidden, invalidState } from './errors.js';

// 업무 규칙과 트랜잭션 구현 (TODO-01~04). 규칙은 docs/API.md를 따릅니다.
// actor는 검증된 로그인 사용자입니다. repo의 저장 함수는 권한을 검사하지 않으므로 여기서 검사합니다.
// 검사 순서: (인증·ID·본문 형식은 app.js) → 대상 존재 404 → 권한 403 → 현재 상태 409 → 정원 409.

const alreadyApplied = () => new AppError(409,'ALREADY_APPLIED','이미 이 행사에 신청한 기록이 있습니다.');
const capacityFull = () => new AppError(409,'CAPACITY_FULL','승인 정원이 모두 찼습니다.');
// SQLITE_CONSTRAINT_UNIQUE 확장 오류 코드. UNIQUE(event_id,user_id) 최종 방어선 위반만 409로 바꿉니다.
const SQLITE_CONSTRAINT_UNIQUE = 2067;

// 트랜잭션 헬퍼: fn 안의 조회·검사·저장을 하나의 트랜잭션으로 실행합니다.
// BEGIN IMMEDIATE로 시작 시점에 쓰기 잠금을 잡아, 검사 시점과 저장 시점 사이에 다른 연결이 끼어들지 못하게 합니다.
// fn이 정상 반환하면 COMMIT, 어떤 예외든(업무 규칙 거부·저장 오류) 발생하면 ROLLBACK 후 예외를 그대로 전달합니다.
export function inTransaction(db,fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result=fn();
    db.exec('COMMIT');
    return result;
  } catch(e) {
    if(db.isTransaction) db.exec('ROLLBACK');
    throw e;
  }
}

export function createApplicationService(repo) {
  const tx = fn => inTransaction(repo.db,fn);
  // 매 요청마다 DB에서 최신 신청과 행사를 다시 읽습니다(R8). 화면·클라이언트 값은 사용하지 않습니다.
  const loadApplication = id => {
    const application=repo.application(id);
    if(!application) throw missing('신청');
    return {application,event:repo.event(application.eventId)};
  };
  const isManagerOf = (actor,event) => actor.role==='MANAGER' && event.managerId===actor.id;

  return {
    // TODO-01: 행사 존재 → 학생 역할 → 중복(종료 상태 포함) → PENDING 저장 + APPLY 이력.
    apply(actor,eventId) {
      return tx(() => {
        const event=repo.event(eventId);
        if(!event) throw missing('행사');
        if(actor.role!=='STUDENT') throw forbidden();
        if(repo.existing(event.id,actor.id)) throw alreadyApplied(); // CANCELLED·REVOKED도 중복(R2)
        let application;
        try { application=repo.insert(event.id,actor.id); }
        catch(e) { if(e.errcode===SQLITE_CONSTRAINT_UNIQUE) throw alreadyApplied(); throw e; }
        repo.addHistory({applicationId:application.id,actorId:actor.id,action:'APPLY',fromStatus:null,toStatus:'PENDING'});
        return application;
      });
    },

    // TODO-02: 신청 존재 → 본인 → PENDING → CANCELLED 저장 + CANCEL 이력. 자동 승급하지 않습니다.
    cancel(actor,applicationId) {
      return tx(() => {
        const {application}=loadApplication(applicationId);
        if(actor.role!=='STUDENT' || application.userId!==actor.id) throw forbidden();
        if(application.status!=='PENDING') throw invalidState();
        const updated=repo.setStatus(application.id,'CANCELLED');
        repo.addHistory({applicationId:application.id,actorId:actor.id,action:'CANCEL',fromStatus:'PENDING',toStatus:'CANCELLED'});
        return updated;
      });
    },

    // TODO-03: 신청 존재 → 담당 운영자 → PENDING → 정원(APPROVED 수) → APPROVED 저장 + APPROVE 이력.
    approve(actor,applicationId) {
      return tx(() => {
        const {application,event}=loadApplication(applicationId);
        if(!isManagerOf(actor,event)) throw forbidden();
        if(application.status!=='PENDING') throw invalidState();
        if(repo.approvedCount(event.id)>=event.capacity) throw capacityFull(); // R4
        const updated=repo.setStatus(application.id,'APPROVED');
        repo.addHistory({applicationId:application.id,actorId:actor.id,action:'APPROVE',fromStatus:'PENDING',toStatus:'APPROVED'});
        return updated;
      });
    },

    // TODO-04: 신청 존재 → 담당 운영자 → APPROVED → REVOKED + REVOKE 이력
    //          → 같은 행사 대기자 1명 AUTO_APPROVE + 원인 이력 연결. 전체가 한 트랜잭션입니다(R5~R7).
    revoke(actor,applicationId,reason) {
      return tx(() => {
        const {application,event}=loadApplication(applicationId);
        if(!isManagerOf(actor,event)) throw forbidden();
        if(application.status!=='APPROVED') throw invalidState(); // 반복 승인 취소도 여기서 거부(R8)
        const revoked=repo.setStatus(application.id,'REVOKED');
        const revokeHistoryId=repo.addHistory({applicationId:application.id,actorId:actor.id,action:'REVOKE',fromStatus:'APPROVED',toStatus:'REVOKED',reason});
        // 이 요청으로 생긴 한 자리만 채웁니다. 기존 빈자리가 더 있어도 최대 1명.
        const next=repo.nextPending(event.id);
        let promoted=null;
        if(next) {
          promoted=repo.setStatus(next.id,'APPROVED');
          repo.addHistory({applicationId:next.id,actorId:actor.id,action:'AUTO_APPROVE',fromStatus:'PENDING',toStatus:'APPROVED',causeHistoryId:revokeHistoryId});
        }
        return {revoked,promoted};
      });
    }
  };
}

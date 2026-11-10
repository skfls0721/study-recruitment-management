import { bad, conflict, forbidden, missing } from '../errors.js';
const STUDY_TRANSITIONS = {RECRUITING:['CLOSED','CANCELLED'],CLOSED:['ACTIVE'],ACTIVE:['FINISHED'],FINISHED:[],CANCELLED:[]};
const TASK_NEXT = {todo:'doing',doing:'done',done:null};
const validDate = (value) => { if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const d=new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10)===value; };
export function createStudyService(repo) {
  const db=repo.db;
  const tx=(fn)=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}};
  const owner=(user,study)=>{if(study.owner_id!==user.id)throw forbidden();};
  const member=(user,studyId)=>{const s=repo.study(studyId);if(!s||(s.owner_id!==user.id&&!repo.isMember(studyId,user.id)))throw forbidden();};
  return {
    createStudy(user,input) {
      const title=String(input?.title||'').trim(), description=String(input?.description||'').trim(), capacity=Number(input?.capacity), deadline=String(input?.deadline||'');
      if(!title||title.length>100||!Number.isSafeInteger(capacity)||capacity<1||!validDate(deadline))throw bad('제목, 정원(1 이상), 마감일을 확인해 주세요.');
      const r=db.prepare('INSERT INTO studies(owner_id,title,description,capacity,deadline) VALUES(?,?,?,?,?)').run(user.id,title,description,capacity,deadline);
      return repo.study(Number(r.lastInsertRowid));
    },
    apply(user,studyId) { return tx(()=>{
      const s=repo.study(studyId);if(!s)throw missing('모집글');if(s.owner_id===user.id)throw forbidden();if(s.status!=='RECRUITING'||s.deadline < new Date().toISOString().slice(0,10))throw conflict('모집 중인 스터디에만 지원할 수 있습니다.');
      try {const r=db.prepare("INSERT INTO applications(study_id,user_id,status) VALUES(?,?,'PENDING')").run(studyId,user.id);return repo.application(Number(r.lastInsertRowid));}
      catch(e){if(String(e.message).includes('UNIQUE'))throw conflict('이미 지원한 스터디입니다.');throw e;}
    });},
    decide(user,applicationId,decision) { return tx(()=>{
      const a=repo.application(applicationId);if(!a)throw missing('지원서');const s=repo.study(a.study_id);owner(user,s);
      if(a.status!=='PENDING')throw conflict('대기 상태 지원서만 처리할 수 있습니다.');
      if(decision==='approve') {if(repo.memberCount(s.id)>=s.capacity)throw conflict('정원이 가득 찼습니다.');db.prepare("UPDATE applications SET status='APPROVED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'").run(a.id);db.prepare('INSERT INTO study_members(study_id,user_id) VALUES(?,?)').run(s.id,a.user_id);}
      else db.prepare("UPDATE applications SET status='REJECTED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'").run(a.id);
      return repo.application(a.id);
    });},
    cancelApplication(user,id) {const a=repo.application(id);if(!a)throw missing('지원서');if(a.user_id!==user.id)throw forbidden();if(a.status!=='PENDING')throw conflict('대기 상태 지원서만 취소할 수 있습니다.');db.prepare("UPDATE applications SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);return repo.application(id);},
    withdraw(user,id) {return tx(()=>{const a=repo.application(id);if(!a)throw missing('지원서');if(a.user_id!==user.id)throw forbidden();const s=repo.study(a.study_id);if(a.status!=='APPROVED'||['FINISHED','CANCELLED'].includes(s.status))throw conflict('종료 전 승인된 멤버만 탈퇴할 수 있습니다.');db.prepare("UPDATE applications SET status='WITHDRAWN',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);db.prepare('DELETE FROM study_members WHERE study_id=? AND user_id=?').run(s.id,user.id);return repo.application(id);});},
    changeStudyStatus(user,id,status) {return tx(()=>{const s=repo.study(id);if(!s)throw missing('모집글');owner(user,s);if(!STUDY_TRANSITIONS[s.status]?.includes(status))throw conflict('허용되지 않은 모집글 상태 변경입니다.');if(status==='CANCELLED'&&repo.memberCount(id)>0)throw conflict('승인된 멤버가 있으면 취소할 수 없습니다.');db.prepare('UPDATE studies SET status=? WHERE id=?').run(status,id);return repo.study(id);});},
    deleteStudy(user,id) {return tx(()=>{const s=repo.study(id);if(!s)throw missing('모집글');owner(user,s);const activity=db.prepare('SELECT (SELECT COUNT(*) FROM applications WHERE study_id=?) +(SELECT COUNT(*) FROM study_members WHERE study_id=?) AS n').get(id,id).n;if(activity)throw conflict('지원·멤버 이력이 있는 모집글은 삭제할 수 없습니다.');db.prepare('DELETE FROM studies WHERE id=?').run(id);return {deleted:true};});},
    createTask(user,studyId,input) {const s=repo.study(studyId);if(!s)throw missing('스터디');member(user,studyId);if(['FINISHED','CANCELLED'].includes(s.status))throw conflict();const title=String(input?.title||'').trim(),assigneeId=Number(input?.assigneeId||user.id),due=input?.dueDate||null;if(!title||title.length>120||(assigneeId!==s.owner_id&&!repo.isMember(studyId,assigneeId))|| (due&&!validDate(due)))throw bad('작업 제목, 담당 멤버, 마감일을 확인해 주세요.');const r=db.prepare("INSERT INTO tasks(study_id,title,assignee_id,due_date) VALUES(?,?,?,?)").run(studyId,title,assigneeId,due);return repo.task(Number(r.lastInsertRowid));},
    updateTask(user,id,status) {const t=repo.task(id);if(!t)throw missing('작업');const s=repo.study(t.study_id);member(user,s.id);if(user.id!==t.assignee_id&&user.id!==s.owner_id)throw forbidden();if(['FINISHED','CANCELLED'].includes(s.status))throw conflict('종료된 스터디에서는 작업을 변경할 수 없습니다.');if(TASK_NEXT[t.status]!==status)throw conflict('작업 상태는 todo → doing → done 순서로만 변경할 수 있습니다.');db.prepare('UPDATE tasks SET status=? WHERE id=?').run(status,id);return repo.task(id);},
    deleteTask(user,id) {const t=repo.task(id);if(!t)throw missing('작업');member(user,t.study_id);if(t.status==='todo')db.prepare('DELETE FROM tasks WHERE id=?').run(id);else db.prepare('UPDATE tasks SET archived=1 WHERE id=?').run(id);return {deleted:t.status==='todo',archived:t.status!=='todo'};},
    progress(studyId) {if(!repo.study(studyId))throw missing('스터디');const row=db.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done FROM tasks WHERE study_id=?").get(studyId);return {studyId,total:row.total,done:row.done||0,percentage:row.total?Math.round((row.done/row.total)*100):0};}
  };
}

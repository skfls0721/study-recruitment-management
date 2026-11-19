import { bad, conflict, forbidden, missing } from '../errors.js';
const STUDY_TRANSITIONS = {RECRUITING:['CLOSED','CANCELLED'],CLOSED:['ACTIVE'],ACTIVE:['FINISHED'],FINISHED:[],CANCELLED:[]};
const TASK_NEXT = {todo:'doing',doing:'done',done:null};
const validDate = (value) => { if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const d=new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10)===value; };
export function createStudyService(repo) {
  const db=repo.db;
  const tx=(fn)=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){try{db.exec('ROLLBACK')}catch{}throw e;}};
  const owner=(user,study)=>{if(study.owner_id!==user.id)throw forbidden();};
  const member=(user,studyId)=>{const s=repo.study(studyId);if(!s||(s.owner_id!==user.id&&!repo.isMember(studyId,user.id)))throw forbidden();};
  const withdrawApplication=(user,a)=>{if(!a)throw missing('지원서');if(a.user_id!==user.id)throw forbidden();const s=repo.study(a.study_id);if(a.status!=='APPROVED'||['FINISHED','CANCELLED'].includes(s.status))throw conflict('종료 전 승인된 멤버만 탈퇴할 수 있습니다.');db.prepare("UPDATE applications SET status='WITHDRAWN',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(a.id);db.prepare('UPDATE tasks SET assignee_id=NULL WHERE study_id=? AND assignee_id=?').run(s.id,user.id);db.prepare('DELETE FROM study_members WHERE study_id=? AND user_id=?').run(s.id,user.id);return repo.application(a.id);};
  return {
    createStudy(user,input) {
      const title=String(input?.title||'').trim(), description=String(input?.description||'').trim(), capacity=Number(input?.capacity), deadline=String(input?.deadline||'');
      if(!title||title.length>100||description.length>1000||!Number.isSafeInteger(capacity)||capacity<1||capacity>100||!validDate(deadline)||deadline<new Date().toISOString().slice(0,10))throw bad('제목(100자 이하), 소개(1000자 이하), 정원(1~100명), 미래 마감일을 확인해 주세요.');
      const r=db.prepare('INSERT INTO studies(owner_id,title,description,capacity,deadline) VALUES(?,?,?,?,?)').run(user.id,title,description,capacity,deadline);
      return repo.study(Number(r.lastInsertRowid));
    },
    updateStudy(user,id,input) { return tx(()=>{
      const s=repo.study(id);if(!s)throw missing('모집글');owner(user,s);
      if(s.status!=='RECRUITING')throw conflict('모집 중인 글만 수정할 수 있습니다.');
      const title=String(input?.title||'').trim(),description=String(input?.description||'').trim(),capacity=Number(input?.capacity),deadline=String(input?.deadline||'');
      if(!title||title.length>100||description.length>1000||!Number.isSafeInteger(capacity)||capacity<1||capacity>100||!validDate(deadline)||deadline<new Date().toISOString().slice(0,10))throw bad('제목(100자 이하), 소개(1000자 이하), 정원(1~100명), 미래 마감일을 확인해 주세요.');
      if(capacity<repo.memberCount(id))throw conflict('현재 승인된 멤버 수보다 정원을 작게 설정할 수 없습니다.');
      db.prepare('UPDATE studies SET title=?,description=?,capacity=?,deadline=? WHERE id=?').run(title,description,capacity,deadline,id);
      return repo.study(id);
    });},
    apply(user,studyId,input={}) { return tx(()=>{
      const s=repo.study(studyId);if(!s)throw missing('모집글');if(s.owner_id===user.id)throw forbidden();if(s.status!=='RECRUITING'||s.deadline < new Date().toISOString().slice(0,10))throw conflict('모집 중인 스터디에만 지원할 수 있습니다.');
      const message=String(input?.message||'').trim();if(message.length>500)throw bad('지원 메시지는 500자 이내로 입력해 주세요.');
      const previous=repo.applicationForUserStudy(studyId,user.id);
      if(previous){if(previous.status!=='CANCELLED')throw conflict('이미 지원한 스터디입니다.');db.prepare("UPDATE applications SET status='PENDING',message=?,decided_by=NULL,decided_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='CANCELLED'").run(message,previous.id);return repo.application(previous.id);}
      try {const r=db.prepare("INSERT INTO applications(study_id,user_id,status,message) VALUES(?,?,'PENDING',?)").run(studyId,user.id,message);return repo.application(Number(r.lastInsertRowid));}
      catch(e){if(String(e.message).includes('UNIQUE'))throw conflict('이미 지원한 스터디입니다.');throw e;}
    });},
    decide(user,applicationId,decision) { return tx(()=>{
      const a=repo.application(applicationId);if(!a)throw missing('지원서');const s=repo.study(a.study_id);owner(user,s);
      if(a.status!=='PENDING')throw conflict('대기 상태 지원서만 처리할 수 있습니다.');
      if(decision==='approve') {if(!['RECRUITING','CLOSED'].includes(s.status))throw conflict('모집 중 또는 마감 상태에서만 승인할 수 있습니다.');if(s.deadline<new Date().toISOString().slice(0,10))throw conflict('마감일이 지난 지원서는 승인할 수 없습니다.');if(repo.memberCount(s.id)>=s.capacity)throw conflict('정원이 모두 찼습니다. 더 이상 승인할 수 없습니다.');db.prepare("UPDATE applications SET status='APPROVED',decided_by=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'").run(user.id,a.id);db.prepare('INSERT INTO study_members(study_id,user_id) VALUES(?,?)').run(s.id,a.user_id);}
      else db.prepare("UPDATE applications SET status='REJECTED',decided_by=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'").run(user.id,a.id);
      return repo.application(a.id);
    });},
    cancelApplication(user,id) {const a=repo.application(id);if(!a)throw missing('지원서');if(a.user_id!==user.id)throw forbidden();if(a.status!=='PENDING')throw conflict('대기 상태 지원서만 취소할 수 있습니다.');const s=repo.study(a.study_id);if(s.status!=='RECRUITING'||s.deadline<new Date().toISOString().slice(0,10))throw conflict('모집 기간 중인 대기 지원서만 취소할 수 있습니다.');db.prepare("UPDATE applications SET status='CANCELLED',decided_by=NULL,decided_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);return repo.application(id);},
    withdraw(user,id) {return tx(()=>withdrawApplication(user,repo.application(id)));},
    leaveStudy(user,studyId) {return tx(()=>{if(!repo.study(studyId))throw missing('스터디');return withdrawApplication(user,repo.applicationForUserStudy(studyId,user.id));});},
    changeStudyStatus(user,id,status) {return tx(()=>{const s=repo.study(id);if(!s)throw missing('모집글');owner(user,s);if(!STUDY_TRANSITIONS[s.status]?.includes(status))throw conflict('허용되지 않은 모집글 상태 변경입니다.');if(status==='CANCELLED'&&repo.memberCount(id)>0)throw conflict('승인된 멤버가 있으면 취소할 수 없습니다.');if(status==='ACTIVE'&&repo.memberCount(id)<1)throw conflict('승인된 멤버가 한 명 이상 있어야 스터디를 시작할 수 있습니다.');if(status==='CANCELLED')db.prepare("UPDATE applications SET status='REJECTED',decided_by=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE study_id=? AND status='PENDING'").run(user.id,id);db.prepare('UPDATE studies SET status=? WHERE id=?').run(status,id);return repo.study(id);});},
    deleteStudy(user,id) {return tx(()=>{const s=repo.study(id);if(!s)throw missing('모집글');owner(user,s);const activity=db.prepare('SELECT (SELECT COUNT(*) FROM applications WHERE study_id=?) +(SELECT COUNT(*) FROM study_members WHERE study_id=?) AS n').get(id,id).n;if(activity)throw conflict('지원·멤버 이력이 있는 모집글은 삭제할 수 없습니다.');db.prepare('DELETE FROM studies WHERE id=?').run(id);return {deleted:true};});},
    createTask(user,studyId,input) {const s=repo.study(studyId);if(!s)throw missing('스터디');member(user,studyId);if(['FINISHED','CANCELLED'].includes(s.status))throw conflict();const title=String(input?.title||'').trim(),assigneeId=Number(input?.assigneeId||user.id),due=input?.dueDate||null;if(!title||title.length>120||(assigneeId!==s.owner_id&&!repo.isMember(studyId,assigneeId))|| (due&&!validDate(due)))throw bad('작업 제목, 담당 멤버, 마감일을 확인해 주세요.');const r=db.prepare("INSERT INTO tasks(study_id,title,assignee_id,due_date) VALUES(?,?,?,?)").run(studyId,title,assigneeId,due);return repo.task(Number(r.lastInsertRowid));},
    updateTask(user,id,status) {const t=repo.task(id);if(!t)throw missing('작업');const s=repo.study(t.study_id);member(user,s.id);if(user.id!==t.assignee_id&&user.id!==s.owner_id)throw forbidden();if(['FINISHED','CANCELLED'].includes(s.status))throw conflict('종료된 스터디에서는 작업을 변경할 수 없습니다.');if(TASK_NEXT[t.status]!==status)throw conflict('작업 상태는 todo → doing → done 순서로만 변경할 수 있습니다.');db.prepare('UPDATE tasks SET status=? WHERE id=?').run(status,id);return repo.task(id);},
    deleteTask(user,id) {const t=repo.task(id);if(!t)throw missing('작업');member(user,t.study_id);const s=repo.study(t.study_id);if(['FINISHED','CANCELLED'].includes(s.status))throw conflict('종료·취소된 스터디에서는 작업을 삭제하거나 보관할 수 없습니다.');if(t.status==='todo')db.prepare('DELETE FROM tasks WHERE id=?').run(id);else db.prepare('UPDATE tasks SET archived=1 WHERE id=?').run(id);return {deleted:t.status==='todo',archived:t.status!=='todo'};},
    progress(studyId) {if(!repo.study(studyId))throw missing('스터디');const row=db.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done FROM tasks WHERE study_id=?").get(studyId);return {studyId,total:row.total,done:row.done||0,percentage:row.total?Math.round((row.done/row.total)*100):0};}
  };
}

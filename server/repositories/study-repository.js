import { kstDate } from '../kst-date.js';

export function createStudyRepository(db) {
  return {
    db,
    closeExpiredStudies() {
      return db.prepare("UPDATE studies SET status='CLOSED',close_reason='DEADLINE' WHERE status='RECRUITING' AND deadline < ?").run(kstDate()).changes;
    },
    closeExpiredStudy(studyId) {
      return db.prepare("UPDATE studies SET status='CLOSED',close_reason='DEADLINE' WHERE id=? AND status='RECRUITING' AND deadline < ?").run(studyId,kstDate()).changes;
    },
    study(id) { return db.prepare(`SELECT s.*,u.display_name AS owner_name,
      (SELECT COUNT(*) FROM study_members m WHERE m.study_id=s.id) AS member_count
      FROM studies s JOIN users u ON u.id=s.owner_id WHERE s.id=?`).get(id); },
    studies({search='',sort='latest'}={}) {
      const order = {latest:'s.created_at DESC,s.id DESC', deadline:'s.deadline ASC,s.id ASC', title:'s.title COLLATE NOCASE ASC,s.id ASC'}[sort] || 's.created_at DESC,s.id DESC';
      return db.prepare(`SELECT s.*,u.display_name AS owner_name,
        (SELECT COUNT(*) FROM study_members m WHERE m.study_id=s.id) AS member_count
        FROM studies s JOIN users u ON u.id=s.owner_id
        WHERE (?='' OR s.title LIKE '%'||?||'%' OR s.description LIKE '%'||?||'%') ORDER BY ${order}`).all(search,search,search);
    },
    myStudies(userId) { return db.prepare(`SELECT s.*,u.display_name AS owner_name,
      (SELECT COUNT(*) FROM study_members m WHERE m.study_id=s.id) AS member_count
      FROM studies s JOIN users u ON u.id=s.owner_id
      WHERE s.owner_id=? OR EXISTS(SELECT 1 FROM study_members m WHERE m.study_id=s.id AND m.user_id=?)
      ORDER BY s.created_at DESC,s.id DESC`).all(userId,userId); },
    members(studyId) { return db.prepare(`SELECT u.id,u.username,u.display_name,m.joined_at,'MEMBER' AS role,
      (SELECT COUNT(*) FROM tasks t WHERE t.study_id=m.study_id AND t.assignee_id=m.user_id AND t.archived=0) AS assigned_task_count
      FROM study_members m JOIN users u ON u.id=m.user_id WHERE m.study_id=? ORDER BY m.joined_at,u.id`).all(studyId); },
    participants(studyId) {
      const study = this.study(studyId);
      if (!study) return [];
      const owner = db.prepare(`SELECT u.id,u.username,u.display_name,NULL AS joined_at,'OWNER' AS role,
        (SELECT COUNT(*) FROM tasks t WHERE t.study_id=? AND t.assignee_id=u.id AND t.archived=0) AS assigned_task_count
        FROM users u WHERE u.id=?`).get(studyId,study.owner_id);
      return [owner,...this.members(studyId)];
    },
    application(id) { return db.prepare('SELECT * FROM applications WHERE id=?').get(id); },
    applicationForUserStudy(studyId,userId) { return db.prepare('SELECT * FROM applications WHERE study_id=? AND user_id=?').get(studyId,userId); },
    forStudy(studyId) { return db.prepare(`SELECT a.*,u.display_name,d.display_name AS decided_by_name FROM applications a JOIN users u ON u.id=a.user_id LEFT JOIN users d ON d.id=a.decided_by WHERE a.study_id=? ORDER BY a.id`).all(studyId); },
    myApplications(userId) { return db.prepare(`SELECT a.*,s.title AS study_title,s.status AS study_status,s.close_reason AS study_close_reason,s.deadline AS study_deadline FROM applications a JOIN studies s ON s.id=a.study_id WHERE a.user_id=? ORDER BY a.id DESC`).all(userId); },
    isMember(studyId,userId) { return !!db.prepare('SELECT 1 FROM study_members WHERE study_id=? AND user_id=?').get(studyId,userId); },
    memberCount(studyId) { return db.prepare('SELECT COUNT(*) AS n FROM study_members WHERE study_id=?').get(studyId).n; },
    tasks(studyId) { return db.prepare('SELECT t.*,u.display_name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.study_id=? ORDER BY t.id').all(studyId); },
    task(id) { return db.prepare('SELECT * FROM tasks WHERE id=?').get(id); }
  };
}

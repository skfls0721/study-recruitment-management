export function createStudyRepository(db) {
  return {
    db,
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
    application(id) { return db.prepare('SELECT * FROM applications WHERE id=?').get(id); },
    forStudy(studyId) { return db.prepare(`SELECT a.*,u.display_name FROM applications a JOIN users u ON u.id=a.user_id WHERE a.study_id=? ORDER BY a.id`).all(studyId); },
    myApplications(userId) { return db.prepare(`SELECT a.*,s.title AS study_title,s.status AS study_status,s.deadline AS study_deadline FROM applications a JOIN studies s ON s.id=a.study_id WHERE a.user_id=? ORDER BY a.id DESC`).all(userId); },
    isMember(studyId,userId) { return !!db.prepare('SELECT 1 FROM study_members WHERE study_id=? AND user_id=?').get(studyId,userId); },
    memberCount(studyId) { return db.prepare('SELECT COUNT(*) AS n FROM study_members WHERE study_id=?').get(studyId).n; },
    tasks(studyId) { return db.prepare('SELECT t.*,u.display_name AS assignee_name FROM tasks t JOIN users u ON u.id=t.assignee_id WHERE t.study_id=? ORDER BY t.id').all(studyId); },
    task(id) { return db.prepare('SELECT * FROM tasks WHERE id=?').get(id); }
  };
}

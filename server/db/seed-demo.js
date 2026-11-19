import { existsSync } from 'node:fs';
import { openDb } from './index.js';

if (process.env.NODE_ENV !== 'test' && existsSync('.env')) process.loadEnvFile('.env');

const db = openDb();
const findUser = db.prepare('SELECT id FROM users WHERE username=?');
const leader = findUser.get('leaderA');
const memberB = findUser.get('leaderB');
const memberC = findUser.get('memberC');

if (!leader || !memberB || !memberC) {
  db.close();
  throw new Error('데모 계정 leaderA, leaderB, memberC가 필요합니다. 데모 계정이 없는 DB에는 먼저 초기 데이터를 준비하세요.');
}

const deadline = new Date();
deadline.setDate(deadline.getDate() + 28);
const deadlineText = deadline.toISOString().slice(0, 10);
const reservedStudies = [
  {
    title: '알고리즘 스터디',
    description: '주 1회 함께 알고리즘 문제를 풀이하고 풀이 방법을 나누는 스터디입니다.',
    capacity: 2,
    members: [{ userId: memberB.id, status: 'APPROVED', message: '알고리즘 문제 풀이에 꾸준히 참여하고 싶습니다.' }],
  },
  {
    title: '정원 초과 시연 스터디',
    description: '정원 1명인 모집입니다. 지원자 한 명을 승인하면 남은 대기 지원자의 승인이 거절되는 흐름을 확인할 수 있습니다.',
    capacity: 1,
    members: [
      { userId: memberC.id, status: 'PENDING', message: '자료구조와 알고리즘을 함께 공부하고 싶습니다.' },
      { userId: memberB.id, status: 'PENDING', message: '매주 문제를 풀고 풀이를 공유하고 싶습니다.' },
    ],
  },
  {
    title: '라이브 지원 시연 스터디',
    description: '모집글 상세에서 새 회원이 직접 지원하는 흐름을 시연할 수 있는 모집입니다.',
    capacity: 3,
    members: [],
  },
];

try {
  db.exec('BEGIN IMMEDIATE');
  for (const [username, displayName] of [['leaderA', '지훈'], ['leaderB', '민수'], ['memberC', '서연']]) {
    db.prepare('UPDATE users SET display_name=? WHERE username=?').run(displayName, username);
  }
  const findStudy = db.prepare('SELECT id FROM studies WHERE owner_id=? AND title=?');
  const insertStudy = db.prepare(`INSERT INTO studies(owner_id,title,description,capacity,deadline,status)
    VALUES(?,?,?,?,?,'RECRUITING')`);
  const updateStudy = db.prepare(`UPDATE studies SET description=?,capacity=?,deadline=?,status='RECRUITING'
    WHERE id=?`);
  for (const studySpec of reservedStudies) {
    const existing = findStudy.get(leader.id, studySpec.title);
    const studyId = existing
      ? Number(existing.id)
      : Number(insertStudy.run(leader.id, studySpec.title, studySpec.description, studySpec.capacity, deadlineText).lastInsertRowid);
    if (existing) updateStudy.run(studySpec.description, studySpec.capacity, deadlineText, studyId);

    // Only the three explicitly reserved demo studies are refreshed. Other users,
    // studies, applications, memberships, and task records are left untouched.
    db.prepare('DELETE FROM study_members WHERE study_id=?').run(studyId);
    db.prepare('DELETE FROM applications WHERE study_id=?').run(studyId);
    const insertApplication = db.prepare(`INSERT INTO applications(study_id,user_id,status,message,decided_by,decided_at)
      VALUES(?,?,?,?,?,CASE WHEN ?='APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END)`);
    for (const application of studySpec.members) {
      insertApplication.run(
        studyId,
        application.userId,
        application.status,
        application.message,
        application.status === 'PENDING' ? null : leader.id,
        application.status,
      );
      if (application.status === 'APPROVED') {
        db.prepare('INSERT INTO study_members(study_id,user_id) VALUES(?,?)').run(studyId, application.userId);
      }
    }
  }
  db.exec('COMMIT');
  console.log(`시연 데이터 준비 완료. 마감일 ${deadlineText}; 정원 초과 시연은 B·C 모두 대기 상태입니다.`);
} catch (error) {
  try { db.exec('ROLLBACK'); } catch {}
  throw error;
} finally {
  db.close();
}

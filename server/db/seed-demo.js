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

function ensureStudy(title, description, capacity, ownerId) {
  const existing = db.prepare('SELECT id FROM studies WHERE owner_id=? AND title=?').get(ownerId, title);
  if (existing) return Number(existing.id);
  return Number(db.prepare(`INSERT INTO studies(owner_id,title,description,capacity,deadline)
    VALUES(?,?,?,?,?)`).run(ownerId, title, description, capacity, '2099-12-31').lastInsertRowid);
}

db.exec('BEGIN IMMEDIATE');
try {
  const overflowId = ensureStudy(
    '정원 초과 시연 스터디',
    '정원 1명 · 대기 지원 2건. C 승인 후 B 승인은 정원 초과로 거절됩니다.',
    1,
    leader.id,
  );
  const insertApplication = db.prepare(`INSERT INTO applications(study_id,user_id,status)
    SELECT ?,?,'PENDING' WHERE NOT EXISTS (SELECT 1 FROM applications WHERE study_id=? AND user_id=?)`);
  insertApplication.run(overflowId, memberB.id, overflowId, memberB.id);
  insertApplication.run(overflowId, memberC.id, overflowId, memberC.id);

  const liveId = ensureStudy(
    '라이브 지원 시연 스터디',
    '영상 시연 중 회원 C가 지원할 모집중 스터디',
    3,
    leader.id,
  );
  db.exec('COMMIT');
  console.log(`시연 데이터 준비 완료. 정원 초과 스터디 ID ${overflowId}, 라이브 지원 스터디 ID ${liveId}`);
} catch (error) {
  try { db.exec('ROLLBACK'); } catch {}
  throw error;
} finally {
  db.close();
}

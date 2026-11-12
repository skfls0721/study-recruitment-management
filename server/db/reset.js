import { rmSync, existsSync } from 'node:fs';
import { openDb } from './index.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) process.loadEnvFile('.env');
const path=process.env.DB_PATH||'./data/studyboard.sqlite';
try{rmSync(path,{force:true});}catch{}
const db=openDb(path);
const password=process.env.DEMO_PASSWORD||randomBytes(12).toString('base64url');
if(password.length<8||password.length>100)throw new Error('DEMO_PASSWORD must be 8 to 100 characters.');
const users=[['leaderA','스터디장 A'],['leaderB','스터디장 B'],['memberC','회원 C']];
for(const [username,name] of users)db.prepare('INSERT INTO users(username,display_name,password_hash) VALUES(?,?,?)').run(username,name,bcrypt.hashSync(password,12));
const study=db.prepare(`INSERT INTO studies(owner_id,title,description,capacity,deadline) VALUES
  ((SELECT id FROM users WHERE username='leaderA'),'알고리즘 스터디','데모용 · 정원 2명 중 1명 승인되어 한 자리 남음',2,'2099-12-31')`).run();
const studyId=Number(study.lastInsertRowid),leaderBId=db.prepare("SELECT id FROM users WHERE username='leaderB'").get().id;
db.prepare("INSERT INTO applications(study_id,user_id,status) VALUES(?,?,'APPROVED')").run(studyId,leaderBId);
db.prepare('INSERT INTO study_members(study_id,user_id) VALUES(?,?)').run(studyId,leaderBId);
const memberCId=db.prepare("SELECT id FROM users WHERE username='memberC'").get().id;
const capacityStudyId=Number(db.prepare(`INSERT INTO studies(owner_id,title,description,capacity,deadline) VALUES
  ((SELECT id FROM users WHERE username='leaderA'),'정원 초과 시연 스터디','정원 1명 · 대기 지원 2건. C 승인 후 B 승인은 정원 초과로 거절됩니다.',1,'2099-12-31')`).run().lastInsertRowid);
db.prepare("INSERT INTO applications(study_id,user_id,status) VALUES(?,?,'PENDING'),(?,?,'PENDING')").run(capacityStudyId,leaderBId,capacityStudyId,memberCId);
const liveStudyId=Number(db.prepare(`INSERT INTO studies(owner_id,title,description,capacity,deadline) VALUES
  ((SELECT id FROM users WHERE username='leaderA'),'라이브 지원 시연 스터디','영상 시연 중 회원 C가 지원할 모집중 스터디',3,'2099-12-31')`).run().lastInsertRowid);
console.log(`DB 초기화 완료. 데모 계정: leaderA, leaderB, memberC / 공통 비밀번호: ${password}`);
console.log(`데모 모집글 ID ${studyId}: 정원 2명 중 한 자리 남음.`);
console.log(`정원 초과 시연 ID ${capacityStudyId}: B와 C가 대기 중입니다.`);
console.log(`라이브 지원 시연 ID ${liveStudyId}: 모집중입니다.`);
db.close();

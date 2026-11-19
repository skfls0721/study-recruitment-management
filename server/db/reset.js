import { rmSync, existsSync } from 'node:fs';
import { openDb } from './index.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { passwordPolicyError } from '../password-policy.js';
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) process.loadEnvFile('.env');
const path=process.env.DB_PATH||'./data/studyboard.sqlite';
const password=process.env.DEMO_PASSWORD||randomBytes(12).toString('base64url');
const passwordError=passwordPolicyError('',password);
if(passwordError)throw new Error(`DEMO_PASSWORD is invalid: ${passwordError}`);
try{rmSync(path,{force:true});}catch{}
const db=openDb(path);
const users=[['leaderA','지훈'],['leaderB','민수'],['memberC','서연']];
const deadline=new Date();deadline.setDate(deadline.getDate()+28);const deadlineText=deadline.toISOString().slice(0,10);
for(const [username,name] of users)db.prepare('INSERT INTO users(username,display_name,password_hash) VALUES(?,?,?)').run(username,name,bcrypt.hashSync(password,12));
const study=db.prepare(`INSERT INTO studies(owner_id,title,description,capacity,deadline) VALUES
  ((SELECT id FROM users WHERE username='leaderA'),'알고리즘 스터디','주 1회 함께 알고리즘 문제를 풀이하고 풀이 방법을 나누는 스터디입니다.',2,'${deadlineText}')`).run();
const studyId=Number(study.lastInsertRowid),leaderBId=db.prepare("SELECT id FROM users WHERE username='leaderB'").get().id;
db.prepare("INSERT INTO applications(study_id,user_id,status,message,decided_by,decided_at) VALUES(?,?,'APPROVED','알고리즘 문제 풀이에 꾸준히 참여하고 싶습니다.',?,CURRENT_TIMESTAMP)").run(studyId,leaderBId,db.prepare("SELECT id FROM users WHERE username='leaderA'").get().id);
db.prepare('INSERT INTO study_members(study_id,user_id) VALUES(?,?)').run(studyId,leaderBId);
const memberCId=db.prepare("SELECT id FROM users WHERE username='memberC'").get().id;
const capacityStudyId=Number(db.prepare(`INSERT INTO studies(owner_id,title,description,capacity,deadline) VALUES
  ((SELECT id FROM users WHERE username='leaderA'),'정원 초과 시연 스터디','정원 1명인 모집입니다. 지원자 한 명을 승인하면 남은 대기 지원자의 승인이 거절되는 흐름을 확인할 수 있습니다.',1,'${deadlineText}')`).run().lastInsertRowid);
db.prepare("INSERT INTO applications(study_id,user_id,status,message) VALUES(?,?,'PENDING','매주 문제를 풀고 풀이를 공유하고 싶습니다.'),(?,?,'PENDING','자료구조와 알고리즘을 함께 공부하고 싶습니다.')").run(capacityStudyId,leaderBId,capacityStudyId,memberCId);
const liveStudyId=Number(db.prepare(`INSERT INTO studies(owner_id,title,description,capacity,deadline) VALUES
  ((SELECT id FROM users WHERE username='leaderA'),'라이브 지원 시연 스터디','모집글 상세에서 새 회원이 직접 지원하는 흐름을 시연할 수 있는 모집입니다.',3,'${deadlineText}')`).run().lastInsertRowid);
console.log(`DB 초기화 완료. 데모 계정: leaderA, leaderB, memberC / 공통 비밀번호: ${password}`);
console.log(`데모 모집글 ID ${studyId}: 정원 2명 중 한 자리 남음.`);
console.log(`정원 초과 시연 ID ${capacityStudyId}: B와 C가 대기 중입니다.`);
console.log(`라이브 지원 시연 ID ${liveStudyId}: 모집중입니다.`);
db.close();

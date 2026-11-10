import { rmSync } from 'node:fs';
import { openDb } from './index.js';
import bcrypt from 'bcryptjs';
const path=process.env.DB_PATH||'./data/studyboard.sqlite';
try{rmSync(path,{force:true});}catch{}
const db=openDb(path);
const users=[['leaderA','스터디장 A'],['leaderB','스터디장 B'],['memberC','회원 C']];
for(const [username,name] of users)db.prepare('INSERT INTO users(username,display_name,password_hash) VALUES(?,?,?)').run(username,name,bcrypt.hashSync('StudyBoard!2026',12));
console.log('DB 초기화 완료. 데모 계정: leaderA, leaderB, memberC / 공통 비밀번호 StudyBoard!2026');
db.close();

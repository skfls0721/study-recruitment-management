import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { bad, AppError } from './errors.js';
export function createAuth(db,secret) {
  const publicUser=(u)=>({id:u.id,username:u.username,displayName:u.display_name});
  return {
    signup(input) {
      const username=String(input?.username||'').trim(),displayName=String(input?.displayName||'').trim(),password=String(input?.password||'');
      if(!/^[a-zA-Z0-9_]{3,30}$/.test(username)||!displayName||displayName.length>40||password.length<8||password.length>100)throw bad('아이디(3~30자), 이름, 비밀번호(8자 이상)를 확인해 주세요.');
      try {const r=db.prepare('INSERT INTO users(username,display_name,password_hash) VALUES(?,?,?)').run(username,displayName,bcrypt.hashSync(password,12));return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(Number(r.lastInsertRowid)));}
      catch(e){if(String(e.message).includes('UNIQUE'))throw new AppError(409,'USERNAME_TAKEN','이미 사용 중인 아이디입니다.');throw e;}
    },
    login(input) {
      const username=String(input?.username||''),password=String(input?.password||''),u=db.prepare('SELECT * FROM users WHERE username=?').get(username);
      if(!u||!bcrypt.compareSync(password,u.password_hash))throw new AppError(401,'INVALID_CREDENTIALS','아이디 또는 비밀번호가 올바르지 않습니다.');
      return {accessToken:jwt.sign({},secret,{algorithm:'HS256',subject:String(u.id),issuer:'studyboard',audience:'studyboard-users',expiresIn:'2h'}),user:publicUser(u)};
    },
    middleware(req,res,next) {
      const h=req.get('Authorization')||'';if(!h.startsWith('Bearer '))return next(new AppError(401,'TOKEN_REQUIRED','로그인이 필요합니다.'));
      try {const p=jwt.verify(h.slice(7),secret,{algorithms:['HS256'],issuer:'studyboard',audience:'studyboard-users'});const u=db.prepare('SELECT * FROM users WHERE id=?').get(Number(p.sub));if(!u)throw Error('missing');req.user=publicUser(u);}
      catch {return next(new AppError(401,'INVALID_TOKEN','로그인이 만료되었거나 유효하지 않습니다.'));}
      next();
    }
  };
}

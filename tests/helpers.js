import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { initialize } from '../server/db/schema.js';
import { createApp } from '../server/app.js';
export function setup(){const db=new DatabaseSync(':memory:');initialize(db);for(const [id,username,name] of [[1,'leaderA','장 A'],[2,'leaderB','장 B'],[3,'memberC','회원 C'],[4,'memberD','회원 D']])db.prepare('INSERT INTO users(id,username,display_name,password_hash) VALUES(?,?,?,?)').run(id,username,name,bcrypt.hashSync('Password!2026',4));const app=createApp({db,secret:'test-secret'});const client=request(app);return {db,client,async login(username){const r=await client.post('/api/auth/login').send({username,password:'Password!2026'});return r.body.accessToken;}};}

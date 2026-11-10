import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { openDb } from './db/index.js';
import { createApp } from './app.js';
if (existsSync('.env')) process.loadEnvFile('.env');
const port=Number(process.env.PORT||3000),db=openDb();
if(process.env.NODE_ENV==='production'&&!process.env.JWT_SECRET)throw new Error('JWT_SECRET must be set in production.');
if(!process.env.JWT_SECRET)console.warn('JWT_SECRET is unset; using a local development key.');
createServer(createApp({db})).listen(port,'0.0.0.0',()=>console.log(`StudyBoard listening on ${port}`));

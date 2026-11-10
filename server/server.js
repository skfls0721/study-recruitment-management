import { createServer } from 'node:http';
import { openDb } from './db/index.js';
import { createApp } from './app.js';
const port=Number(process.env.PORT||3000),db=openDb();
if(!process.env.JWT_SECRET)console.warn('JWT_SECRET is unset; using a local development key.');
createServer(createApp({db})).listen(port,'0.0.0.0',()=>console.log(`StudyBoard listening on ${port}`));

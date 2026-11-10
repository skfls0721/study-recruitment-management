import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { initialize } from './schema.js';
export function openDb(path=process.env.DB_PATH || './data/studyboard.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), {recursive:true});
  const db = new DatabaseSync(path); initialize(db); return db;
}

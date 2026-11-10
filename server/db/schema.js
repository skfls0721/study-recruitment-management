export function initialize(db) {
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS studies (
      id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', capacity INTEGER NOT NULL CHECK(capacity > 0),
      deadline TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'RECRUITING'
        CHECK(status IN ('RECRUITING','CLOSED','ACTIVE','FINISHED','CANCELLED')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY, study_id INTEGER NOT NULL REFERENCES studies(id), user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CANCELLED','WITHDRAWN')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(study_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS study_members (
      study_id INTEGER NOT NULL REFERENCES studies(id), user_id INTEGER NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(study_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY, study_id INTEGER NOT NULL REFERENCES studies(id), title TEXT NOT NULL,
      assignee_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'todo'
        CHECK(status IN ('todo','doing','done')), due_date TEXT, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_studies_status ON studies(status);
    CREATE INDEX IF NOT EXISTS idx_applications_study ON applications(study_id,status);
    CREATE INDEX IF NOT EXISTS idx_tasks_study ON tasks(study_id,status);`);
}

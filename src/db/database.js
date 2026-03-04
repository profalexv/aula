const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

// O banco de dados fica em: ~/Library/Application Support/aula/aula.db (macOS)
//                           ~/.config/aula/aula.db (Linux)
//                           %APPDATA%\aula\aula.db (Windows)
const DB_PATH = path.join(app.getPath('userData'), 'aula.db');

let db;

/**
 * Retorna a instância do banco de dados (singleton).
 */
function getDb() {
  if (!db) {
    throw new Error('Banco de dados não inicializado. Chame setupDatabase() primeiro.');
  }
  return db;
}

/**
 * Hash simples de senha com SHA-256 + salt fixo.
 * Para produção, considere usar bcrypt — mas better-sqlite3 é síncrono,
 * então argon2/bcrypt exigem cuidado especial. SHA-256 é suficiente para uso local.
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'scholar_salt_2024').digest('hex');
}

/**
 * Inicializa o banco e cria as tabelas se não existirem.
 */
function setupDatabase() {
  db = new Database(DB_PATH);

  // Habilita WAL mode para melhor performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS superadmins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      acronym TEXT,
      address TEXT,
      cnpj TEXT,
      inep_code TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      registration TEXT,
      email TEXT,
      subjects TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      year INTEGER,
      semester INTEGER,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      capacity INTEGER,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      resource_id INTEGER,
      teacher_id INTEGER,
      weekday INTEGER NOT NULL,
      period INTEGER NOT NULL,
      subject TEXT NOT NULL,
      classroom TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS lesson_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      teacher_id INTEGER,
      subject TEXT NOT NULL,
      title TEXT NOT NULL,
      objectives TEXT,
      content TEXT,
      methodology TEXT,
      resources TEXT,
      evaluation TEXT,
      duration_minutes INTEGER,
      date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      year INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS curricula (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS time_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      period INTEGER NOT NULL,
      start_time TEXT,
      end_time TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS class_curricula (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      curricula_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (curricula_id) REFERENCES curricula(id) ON DELETE CASCADE,
      UNIQUE(class_id, curricula_id)
    );

    CREATE TABLE IF NOT EXISTS class_teacher_curricula (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      curricula_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (curricula_id) REFERENCES curricula(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      UNIQUE(class_id, curricula_id, teacher_id)
    );

    CREATE TABLE IF NOT EXISTS teacher_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      UNIQUE(teacher_id, weekday)
    );
  `);

  console.log(`[Aula DB] Banco inicializado em: ${DB_PATH}`);
  return db;
}

module.exports = { setupDatabase, getDb, hashPassword, DB_PATH };

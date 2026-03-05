const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const logger = require('../utils/logger');
const { hashPassword, verifyPassword } = require('../utils/password');

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
      active INTEGER DEFAULT 1,
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
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      admin_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
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

  // ─── Migrações (adiciona colunas que podem estar faltando) ──────────────────
  try {
    db.prepare("ALTER TABLE admins ADD COLUMN active INTEGER DEFAULT 1").run();
  } catch (e) {
    // Coluna já existe
  }
  try {
    db.prepare("ALTER TABLE teachers ADD COLUMN active INTEGER DEFAULT 1").run();
  } catch (e) {
    // Coluna já existe
  }

  // Cria índices para melhorar performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_admins_school_id ON admins(school_id);
    CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_school_id ON admin_sessions(school_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_schedules_school_id ON schedules(school_id);
    CREATE INDEX IF NOT EXISTS idx_resources_school_id ON resources(school_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_schedule_id ON lessons(schedule_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_teacher_id ON lessons(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_lesson_plans_school_id ON lesson_plans(school_id);
    CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher_id ON lesson_plans(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_school_id ON shifts(school_id);
    CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
    CREATE INDEX IF NOT EXISTS idx_classes_shift_id ON classes(shift_id);
    CREATE INDEX IF NOT EXISTS idx_curricula_school_id ON curricula(school_id);
    CREATE INDEX IF NOT EXISTS idx_time_slots_shift_id ON time_slots(shift_id);
    CREATE INDEX IF NOT EXISTS idx_class_curricula_class_id ON class_curricula(class_id);
    CREATE INDEX IF NOT EXISTS idx_class_curricula_curricula_id ON class_curricula(curricula_id);
    CREATE INDEX IF NOT EXISTS idx_class_teacher_curricula_class_id ON class_teacher_curricula(class_id);
    CREATE INDEX IF NOT EXISTS idx_class_teacher_curricula_teacher_id ON class_teacher_curricula(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_teacher_days_teacher_id ON teacher_days(teacher_id);
  `);

  logger.info(`Banco inicializado em: ${DB_PATH}`);
  return db;
}

module.exports = { setupDatabase, getDb, hashPassword, verifyPassword, DB_PATH };

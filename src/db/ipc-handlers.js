const { app } = require('electron');
const { getDb, hashPassword } = require('./database');
const { getModulesStatus, activateModule, deactivateModule } = require('./license-manager');

/**
 * Registra todos os handlers IPC para operações de banco de dados.
 * Cada handler retorna { success: true, data } ou { success: false, error: '...' }
 */
function registerIpcHandlers(ipcMain) {

  // ─── Utilitários ────────────────────────────────────────────────────────────

  ipcMain.handle('app:getDataPath', () => {
    return app.getPath('userData');
  });

  // ─── Licenças ────────────────────────────────────────────────────────────────

  ipcMain.handle('license:getModulesStatus', () => {
    try {
      const data = getModulesStatus();
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('license:activate', (_, { moduleId, licenseKey }) => {
    return activateModule(moduleId, licenseKey);
  });

  ipcMain.handle('license:deactivate', (_, moduleId) => {
    return deactivateModule(moduleId);
  });

  // ─── Superadmins ────────────────────────────────────────────────────────────

  ipcMain.handle('db:getSuperadmins', () => {
    try {
      const rows = getDb().prepare('SELECT id, name, username, created_at FROM superadmins').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createSuperadmin', (_, { name, username, password }) => {
    try {
      const hashed = hashPassword(password);
      const result = getDb()
        .prepare('INSERT INTO superadmins (name, username, password) VALUES (?, ?, ?)')
        .run(name, username, hashed);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      const msg = e.message.includes('UNIQUE') ? 'Nome de usuário já existe.' : e.message;
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('db:loginSuperadmin', (_, { username, password }) => {
    try {
      const hashed = hashPassword(password);
      const row = getDb()
        .prepare('SELECT id, name, username FROM superadmins WHERE username = ? AND password = ?')
        .get(username, hashed);
      if (row) return { success: true, data: row };
      return { success: false, error: 'Usuário ou senha incorretos.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteSuperadmin', (_, id) => {
    try {
      getDb().prepare('DELETE FROM superadmins WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Escolas ─────────────────────────────────────────────────────────────────

  ipcMain.handle('db:getSchools', () => {
    try {
      const rows = getDb().prepare('SELECT * FROM schools ORDER BY name').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createSchool', (_, data) => {
    try {
      const { name, acronym = '', address = '', cnpj = '', inep_code = '' } = data;
      const result = getDb()
        .prepare('INSERT INTO schools (name, acronym, address, cnpj, inep_code) VALUES (?, ?, ?, ?, ?)')
        .run(name, acronym, address, cnpj, inep_code);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateSchool', (_, id, data) => {
    try {
      const { name, acronym = '', address = '', cnpj = '', inep_code = '' } = data;
      getDb()
        .prepare('UPDATE schools SET name=?, acronym=?, address=?, cnpj=?, inep_code=? WHERE id=?')
        .run(name, acronym, address, cnpj, inep_code, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteSchool', (_, id) => {
    try {
      getDb().prepare('DELETE FROM schools WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Admins ──────────────────────────────────────────────────────────────────

  ipcMain.handle('db:getAdmins', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare('SELECT id, school_id, name, username, created_at FROM admins WHERE school_id = ?').all(schoolId)
        : getDb().prepare('SELECT id, school_id, name, username, created_at FROM admins').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createAdmin', (_, { school_id, name, username, password }) => {
    try {
      const hashed = hashPassword(password);
      const result = getDb()
        .prepare('INSERT INTO admins (school_id, name, username, password) VALUES (?, ?, ?, ?)')
        .run(school_id, name, username, hashed);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      const msg = e.message.includes('UNIQUE') ? 'Nome de usuário já existe.' : e.message;
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('db:deleteAdmin', (_, id) => {
    try {
      getDb().prepare('DELETE FROM admins WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:loginAdmin', (_, { username, password }) => {
    try {
      const hashed = hashPassword(password);
      const row = getDb()
        .prepare(`SELECT admins.id, admins.name, admins.username, admins.school_id,
                         schools.name as school_name
                  FROM admins
                  JOIN schools ON schools.id = admins.school_id
                  WHERE admins.username = ? AND admins.password = ?`)
        .get(username, hashed);
      if (row) return { success: true, data: row };
      return { success: false, error: 'Usuário ou senha incorretos.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Professores ─────────────────────────────────────────────────────────────

  ipcMain.handle('db:getTeachers', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare('SELECT * FROM teachers WHERE school_id = ? ORDER BY name').all(schoolId)
        : getDb().prepare('SELECT * FROM teachers ORDER BY name').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createTeacher', (_, data) => {
    try {
      const { school_id, name, registration = '', email = '', subjects = '' } = data;
      const result = getDb()
        .prepare('INSERT INTO teachers (school_id, name, registration, email, subjects) VALUES (?, ?, ?, ?, ?)')
        .run(school_id, name, registration, email, subjects);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateTeacher', (_, id, data) => {
    try {
      const { name, registration = '', email = '', subjects = '' } = data;
      getDb()
        .prepare('UPDATE teachers SET name=?, registration=?, email=?, subjects=? WHERE id=?')
        .run(name, registration, email, subjects, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteTeacher', (_, id) => {
    try {
      getDb().prepare('DELETE FROM teachers WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Cronograma ───────────────────────────────────────────────────────────────

  ipcMain.handle('db:getSchedules', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare('SELECT * FROM schedules WHERE school_id = ? ORDER BY year DESC, semester DESC').all(schoolId)
        : getDb().prepare('SELECT * FROM schedules ORDER BY year DESC, semester DESC').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createSchedule', (_, data) => {
    try {
      const { school_id, name, year, semester } = data;
      const result = getDb()
        .prepare('INSERT INTO schedules (school_id, name, year, semester) VALUES (?, ?, ?, ?)')
        .run(school_id, name, year, semester);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateSchedule', (_, id, data) => {
    try {
      const { name, year, semester, active } = data;
      getDb()
        .prepare('UPDATE schedules SET name=?, year=?, semester=?, active=? WHERE id=?')
        .run(name, year, semester, active ? 1 : 0, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteSchedule', (_, id) => {
    try {
      getDb().prepare('DELETE FROM schedules WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Aulas ────────────────────────────────────────────────────────────────────

  ipcMain.handle('db:getLessons', (_, scheduleId) => {
    try {
      const rows = getDb()
        .prepare(`SELECT lessons.*, teachers.name as teacher_name
                  FROM lessons
                  LEFT JOIN teachers ON teachers.id = lessons.teacher_id
                  WHERE lessons.schedule_id = ?
                  ORDER BY weekday, period`)
        .all(scheduleId);
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createLesson', (_, data) => {
    try {
      const { schedule_id, teacher_id = null, weekday, period, subject, classroom = '', notes = '' } = data;
      const result = getDb()
        .prepare('INSERT INTO lessons (schedule_id, teacher_id, weekday, period, subject, classroom, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(schedule_id, teacher_id, weekday, period, subject, classroom, notes);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateLesson', (_, id, data) => {
    try {
      const { teacher_id = null, weekday, period, subject, classroom = '', notes = '' } = data;
      getDb()
        .prepare('UPDATE lessons SET teacher_id=?, weekday=?, period=?, subject=?, classroom=?, notes=? WHERE id=?')
        .run(teacher_id, weekday, period, subject, classroom, notes, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteLesson', (_, id) => {
    try {
      getDb().prepare('DELETE FROM lessons WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Planos de Aula ───────────────────────────────────────────────────────────

  ipcMain.handle('db:getLessonPlans', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare(`SELECT lesson_plans.*, teachers.name as teacher_name
                           FROM lesson_plans
                           LEFT JOIN teachers ON teachers.id = lesson_plans.teacher_id
                           WHERE lesson_plans.school_id = ?
                           ORDER BY date DESC, title`).all(schoolId)
        : getDb().prepare(`SELECT lesson_plans.*, teachers.name as teacher_name
                           FROM lesson_plans
                           LEFT JOIN teachers ON teachers.id = lesson_plans.teacher_id
                           ORDER BY date DESC, title`).all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createLessonPlan', (_, data) => {
    try {
      const {
        school_id, teacher_id = null, subject, title,
        objectives = '', content = '', methodology = '',
        resources = '', evaluation = '', duration_minutes = null, date = null
      } = data;
      const result = getDb()
        .prepare(`INSERT INTO lesson_plans
                  (school_id, teacher_id, subject, title, objectives, content, methodology, resources, evaluation, duration_minutes, date)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(school_id, teacher_id, subject, title, objectives, content, methodology, resources, evaluation, duration_minutes, date);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateLessonPlan', (_, id, data) => {
    try {
      const {
        teacher_id = null, subject, title,
        objectives = '', content = '', methodology = '',
        resources = '', evaluation = '', duration_minutes = null, date = null
      } = data;
      getDb()
        .prepare(`UPDATE lesson_plans SET
                  teacher_id=?, subject=?, title=?, objectives=?, content=?,
                  methodology=?, resources=?, evaluation=?, duration_minutes=?, date=?
                  WHERE id=?`)
        .run(teacher_id, subject, title, objectives, content, methodology, resources, evaluation, duration_minutes, date, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteLessonPlan', (_, id) => {
    try {
      getDb().prepare('DELETE FROM lesson_plans WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Recursos (Salas, Laboratórios, etc.) ────────────────────────────────────

  ipcMain.handle('db:getResources', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare('SELECT * FROM resources WHERE school_id = ? ORDER BY type, name').all(schoolId)
        : getDb().prepare('SELECT * FROM resources ORDER BY type, name').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createResource', (_, data) => {
    try {
      const { school_id, name, type, capacity = null, description = '' } = data;
      const result = getDb()
        .prepare('INSERT INTO resources (school_id, name, type, capacity, description) VALUES (?, ?, ?, ?, ?)')
        .run(school_id, name, type, capacity, description);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateResource', (_, id, data) => {
    try {
      const { name, type, capacity = null, description = '' } = data;
      getDb()
        .prepare('UPDATE resources SET name=?, type=?, capacity=?, description=? WHERE id=?')
        .run(name, type, capacity, description, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteResource', (_, id) => {
    try {
      getDb().prepare('DELETE FROM resources WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Turnos (Shifts) ─────────────────────────────────────────────────────────

  ipcMain.handle('db:getShifts', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare('SELECT * FROM shifts WHERE school_id = ? ORDER BY name').all(schoolId)
        : getDb().prepare('SELECT * FROM shifts ORDER BY name').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createShift', (_, data) => {
    try {
      const { school_id, name } = data;
      const result = getDb()
        .prepare('INSERT INTO shifts (school_id, name) VALUES (?, ?)')
        .run(school_id, name);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateShift', (_, id, data) => {
    try {
      const { name } = data;
      getDb()
        .prepare('UPDATE shifts SET name=? WHERE id=?')
        .run(name, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteShift', (_, id) => {
    try {
      getDb().prepare('DELETE FROM shifts WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Turmas (Classes) ────────────────────────────────────────────────────────

  ipcMain.handle('db:getClasses', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare(`SELECT classes.*, shifts.name as shift_name 
                           FROM classes 
                           LEFT JOIN shifts ON shifts.id = classes.shift_id 
                           WHERE classes.school_id = ? ORDER BY classes.name`)
            .all(schoolId)
        : getDb().prepare(`SELECT classes.*, shifts.name as shift_name 
                           FROM classes 
                           LEFT JOIN shifts ON shifts.id = classes.shift_id 
                           ORDER BY classes.name`).all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createClass', (_, data) => {
    try {
      const { school_id, shift_id, name, year = null } = data;
      const result = getDb()
        .prepare('INSERT INTO classes (school_id, shift_id, name, year) VALUES (?, ?, ?, ?)')
        .run(school_id, shift_id, name, year);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateClass', (_, id, data) => {
    try {
      const { shift_id, name, year = null } = data;
      getDb()
        .prepare('UPDATE classes SET shift_id=?, name=?, year=? WHERE id=?')
        .run(shift_id, name, year, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteClass', (_, id) => {
    try {
      getDb().prepare('DELETE FROM classes WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Componentes Curriculares ───────────────────────────────────────────────

  ipcMain.handle('db:getCurricula', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare('SELECT * FROM curricula WHERE school_id = ? ORDER BY name').all(schoolId)
        : getDb().prepare('SELECT * FROM curricula ORDER BY name').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createCurricula', (_, data) => {
    try {
      const { school_id, name, code = '', description = '' } = data;
      const result = getDb()
        .prepare('INSERT INTO curricula (school_id, name, code, description) VALUES (?, ?, ?, ?)')
        .run(school_id, name, code, description);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateCurricula', (_, id, data) => {
    try {
      const { name, code = '', description = '' } = data;
      getDb()
        .prepare('UPDATE curricula SET name=?, code=?, description=? WHERE id=?')
        .run(name, code, description, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteCurricula', (_, id) => {
    try {
      getDb().prepare('DELETE FROM curricula WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Horários (Time Slots) ──────────────────────────────────────────────────

  ipcMain.handle('db:getTimeSlots', (_, shiftId) => {
    try {
      const rows = shiftId
        ? getDb().prepare('SELECT * FROM time_slots WHERE shift_id = ? ORDER BY period').all(shiftId)
        : getDb().prepare('SELECT * FROM time_slots ORDER BY period').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createTimeSlot', (_, data) => {
    try {
      const { shift_id, period, start_time = '', end_time = '' } = data;
      const result = getDb()
        .prepare('INSERT INTO time_slots (shift_id, period, start_time, end_time) VALUES (?, ?, ?, ?)')
        .run(shift_id, period, start_time, end_time);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:updateTimeSlot', (_, id, data) => {
    try {
      const { period, start_time = '', end_time = '' } = data;
      getDb()
        .prepare('UPDATE time_slots SET period=?, start_time=?, end_time=? WHERE id=?')
        .run(period, start_time, end_time, id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteTimeSlot', (_, id) => {
    try {
      getDb().prepare('DELETE FROM time_slots WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Grade: Componentes por Turma ───────────────────────────────────────────

  ipcMain.handle('db:getClassCurricula', (_, classId) => {
    try {
      const rows = classId
        ? getDb().prepare(`SELECT class_curricula.*, curricula.name as curricula_name 
                           FROM class_curricula 
                           LEFT JOIN curricula ON curricula.id = class_curricula.curricula_id 
                           WHERE class_curricula.class_id = ?`)
            .all(classId)
        : getDb().prepare(`SELECT class_curricula.*, curricula.name as curricula_name 
                           FROM class_curricula 
                           LEFT JOIN curricula ON curricula.id = class_curricula.curricula_id`).all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createClassCurricula', (_, data) => {
    try {
      const { class_id, curricula_id } = data;
      const result = getDb()
        .prepare('INSERT INTO class_curricula (class_id, curricula_id) VALUES (?, ?)')
        .run(class_id, curricula_id);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      const msg = e.message.includes('UNIQUE') ? 'Este componente já está associado a esta turma.' : e.message;
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('db:deleteClassCurricula', (_, id) => {
    try {
      getDb().prepare('DELETE FROM class_curricula WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Professor por Componente e Turma ───────────────────────────────────────

  ipcMain.handle('db:getClassTeacherCurricula', (_, classId) => {
    try {
      const rows = classId
        ? getDb().prepare(`SELECT class_teacher_curricula.*, 
                                  curricula.name as curricula_name, 
                                  teachers.name as teacher_name 
                           FROM class_teacher_curricula 
                           LEFT JOIN curricula ON curricula.id = class_teacher_curricula.curricula_id 
                           LEFT JOIN teachers ON teachers.id = class_teacher_curricula.teacher_id 
                           WHERE class_teacher_curricula.class_id = ?`)
            .all(classId)
        : getDb().prepare(`SELECT class_teacher_curricula.*, 
                                  curricula.name as curricula_name, 
                                  teachers.name as teacher_name 
                           FROM class_teacher_curricula 
                           LEFT JOIN curricula ON curricula.id = class_teacher_curricula.curricula_id 
                           LEFT JOIN teachers ON teachers.id = class_teacher_curricula.teacher_id`).all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createClassTeacherCurricula', (_, data) => {
    try {
      const { class_id, curricula_id, teacher_id } = data;
      const result = getDb()
        .prepare('INSERT INTO class_teacher_curricula (class_id, curricula_id, teacher_id) VALUES (?, ?, ?)')
        .run(class_id, curricula_id, teacher_id);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      const msg = e.message.includes('UNIQUE') ? 'Este professor já está atribuído a este componente nesta turma.' : e.message;
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('db:deleteClassTeacherCurricula', (_, id) => {
    try {
      getDb().prepare('DELETE FROM class_teacher_curricula WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Dias de Trabalho do Professor ──────────────────────────────────────────

  ipcMain.handle('db:getTeacherDays', (_, teacherId) => {
    try {
      const rows = teacherId
        ? getDb().prepare('SELECT * FROM teacher_days WHERE teacher_id = ? ORDER BY weekday').all(teacherId)
        : getDb().prepare('SELECT * FROM teacher_days ORDER BY weekday').all();
      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:createTeacherDay', (_, data) => {
    try {
      const { teacher_id, weekday } = data;
      const result = getDb()
        .prepare('INSERT INTO teacher_days (teacher_id, weekday) VALUES (?, ?)')
        .run(teacher_id, weekday);
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      const msg = e.message.includes('UNIQUE') ? 'Este dia já foi registrado para este professor.' : e.message;
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('db:deleteTeacherDay', (_, id) => {
    try {
      getDb().prepare('DELETE FROM teacher_days WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerIpcHandlers };

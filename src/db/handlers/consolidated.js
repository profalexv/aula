/**
 * Handlers consolidados para as demais entidades
 */

const { getDb, hashPassword, verifyPassword } = require('../database');
const { getFriendlyErrorMessage } = require('./utils');
const { isValidCredentials, isValidTeacherData, isValidPositiveInt } = require('../../utils/validators');
const logger = require('../../utils/logger');

function registerAdminHandlers(ipcMain) {
  ipcMain.handle('db:getAdmins', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare('SELECT id, school_id, name, username, created_at FROM admins WHERE school_id = ?').all(schoolId)
        : getDb().prepare('SELECT id, school_id, name, username, created_at FROM admins').all();
      return { success: true, data: rows };
    } catch (e) {
      logger.error('Failed to get admins', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:createAdmin', async (_, { school_id, name, username, password }) => {
    try {
      if (!isValidPositiveInt(school_id) || !name?.trim() || !isValidCredentials(username, password)) {
        throw new Error('Dados inválidos.');
      }

      const hashedPassword = await hashPassword(password);
      const result = getDb()
        .prepare('INSERT INTO admins (school_id, name, username, password) VALUES (?, ?, ?, ?)')
        .run(school_id, name.trim(), username.trim(), hashedPassword);
      
      logger.info('Admin created', { id: result.lastInsertRowid, school_id, username });
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      const msg = e.message.includes('UNIQUE') ? 'Nome de usuário já existe.' : e.message;
      logger.error('Failed to create admin', { error: msg });
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('db:deleteAdmin', (_, id) => {
    try {
      if (!isValidPositiveInt(id)) throw new Error('ID inválido.');
      
      getDb().prepare('DELETE FROM admins WHERE id = ?').run(id);
      logger.info('Admin deleted', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to delete admin', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:loginAdmin', async (_, { username, password }) => {
    try {
      if (!isValidCredentials(username, password)) throw new Error('Dados inválidos.');

      const row = getDb()
        .prepare(`SELECT admins.id, admins.name, admins.username, admins.school_id, admins.password,
                         schools.name as school_name
                  FROM admins
                  JOIN schools ON schools.id = admins.school_id
                  WHERE admins.username = ?`)
        .get(username.trim());
      
      if (!row) {
        logger.warn('Failed login attempt for admin', { username });
        return { success: false, error: 'Usuário ou senha incorretos.' };
      }

      const isValid = await verifyPassword(password, row.password);
      if (!isValid) {
        logger.warn('Failed login attempt for admin', { username });
        return { success: false, error: 'Usuário ou senha incorretos.' };
      }

      logger.info('Admin logged in', { id: row.id, username });
      const { password: _, ...safeRow } = row;
      return { success: true, data: safeRow };
    } catch (e) {
      logger.error('Admin login error', { error: e.message });
      return { success: false, error: e.message };
    }
  });
}

function registerTeacherHandlers(ipcMain) {
  ipcMain.handle('db:getTeachers', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare('SELECT * FROM teachers WHERE school_id = ? ORDER BY name').all(schoolId)
        : getDb().prepare('SELECT * FROM teachers ORDER BY name').all();
      return { success: true, data: rows };
    } catch (e) {
      logger.error('Failed to get teachers', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:createTeacher', (_, data) => {
    try {
      const { school_id, name, registration = '', email = '', subjects = '' } = data;
      if (!isValidPositiveInt(school_id) || !isValidTeacherData({ name, email, registration })) {
        throw new Error('Dados inválidos.');
      }

      const result = getDb()
        .prepare('INSERT INTO teachers (school_id, name, registration, email, subjects) VALUES (?, ?, ?, ?, ?)')
        .run(school_id, name.trim(), registration.trim(), email.trim(), subjects);
      
      logger.info('Teacher created', { id: result.lastInsertRowid, school_id });
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      logger.error('Failed to create teacher', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:updateTeacher', (_, id, data) => {
    try {
      if (!isValidPositiveInt(id) || !isValidTeacherData(data)) {
        throw new Error('Dados inválidos.');
      }

      const { name, registration = '', email = '', subjects = '' } = data;
      getDb()
        .prepare('UPDATE teachers SET name=?, registration=?, email=?, subjects=? WHERE id=?')
        .run(name.trim(), registration.trim(), email.trim(), subjects, id);
      
      logger.info('Teacher updated', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to update teacher', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:deleteTeacher', (_, id) => {
    try {
      if (!isValidPositiveInt(id)) throw new Error('ID inválido.');
      
      getDb().prepare('DELETE FROM teachers WHERE id = ?').run(id);
      logger.info('Teacher deleted', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to delete teacher', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });
}

function registerScheduleHandlers(ipcMain) {
  ipcMain.handle('db:getSchedules', (_, schoolId) => {
    try {
      const rows = schoolId
        ? getDb().prepare('SELECT * FROM schedules WHERE school_id = ? ORDER BY year DESC, semester DESC').all(schoolId)
        : getDb().prepare('SELECT * FROM schedules ORDER BY year DESC, semester DESC').all();
      return { success: true, data: rows };
    } catch (e) {
      logger.error('Failed to get schedules', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:createSchedule', (_, data) => {
    try {
      const { school_id, name, year, semester } = data;
      if (!isValidPositiveInt(school_id) || !name?.trim() || !isValidPositiveInt(year) || !isValidPositiveInt(semester)) {
        throw new Error('Dados inválidos.');
      }

      const result = getDb()
        .prepare('INSERT INTO schedules (school_id, name, year, semester) VALUES (?, ?, ?, ?)')
        .run(school_id, name.trim(), year, semester);
      
      logger.info('Schedule created', { id: result.lastInsertRowid, school_id });
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      logger.error('Failed to create schedule', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:updateSchedule', (_, id, data) => {
    try {
      if (!isValidPositiveInt(id)) throw new Error('ID inválido.');
      
      const { name, year, semester, active } = data;
      if (!name?.trim() || !isValidPositiveInt(year) || !isValidPositiveInt(semester)) {
        throw new Error('Dados inválidos.');
      }

      getDb()
        .prepare('UPDATE schedules SET name=?, year=?, semester=?, active=? WHERE id=?')
        .run(name.trim(), year, semester, active ? 1 : 0, id);
      
      logger.info('Schedule updated', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to update schedule', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:deleteSchedule', (_, id) => {
    try {
      if (!isValidPositiveInt(id)) throw new Error('ID inválido.');
      
      getDb().prepare('DELETE FROM schedules WHERE id = ?').run(id);
      logger.info('Schedule deleted', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to delete schedule', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });
}

function registerLessonHandlers(ipcMain) {
  ipcMain.handle('db:getLessons', (_, scheduleId) => {
    try {
      if (!isValidPositiveInt(scheduleId)) throw new Error('ID inválido.');
      
      const rows = getDb()
        .prepare(`SELECT lessons.*, teachers.name as teacher_name
                  FROM lessons
                  LEFT JOIN teachers ON teachers.id = lessons.teacher_id
                  WHERE lessons.schedule_id = ?
                  ORDER BY weekday, period`)
        .all(scheduleId);
      return { success: true, data: rows };
    } catch (e) {
      logger.error('Failed to get lessons', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:createLesson', (_, data) => {
    try {
      const { schedule_id, teacher_id = null, weekday, period, subject, classroom = '', notes = '' } = data;
      if (!isValidPositiveInt(schedule_id) || !isValidPositiveInt(weekday) || !isValidPositiveInt(period) || !subject?.trim()) {
        throw new Error('Dados inválidos.');
      }

      const result = getDb()
        .prepare('INSERT INTO lessons (schedule_id, teacher_id, weekday, period, subject, classroom, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(schedule_id, teacher_id, weekday, period, subject.trim(), classroom.trim(), notes);
      
      logger.info('Lesson created', { id: result.lastInsertRowid, schedule_id });
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      logger.error('Failed to create lesson', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:updateLesson', (_, id, data) => {
    try {
      if (!isValidPositiveInt(id)) throw new Error('ID inválido.');
      
      const { teacher_id = null, weekday, period, subject, classroom = '', notes = '' } = data;
      if (!isValidPositiveInt(weekday) || !isValidPositiveInt(period) || !subject?.trim()) {
        throw new Error('Dados inválidos.');
      }

      getDb()
        .prepare('UPDATE lessons SET teacher_id=?, weekday=?, period=?, subject=?, classroom=?, notes=? WHERE id=?')
        .run(teacher_id, weekday, period, subject.trim(), classroom.trim(), notes, id);
      
      logger.info('Lesson updated', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to update lesson', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:deleteLesson', (_, id) => {
    try {
      if (!isValidPositiveInt(id)) throw new Error('ID inválido.');
      
      getDb().prepare('DELETE FROM lessons WHERE id = ?').run(id);
      logger.info('Lesson deleted', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to delete lesson', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });
}

module.exports = { registerAdminHandlers, registerTeacherHandlers, registerScheduleHandlers, registerLessonHandlers };

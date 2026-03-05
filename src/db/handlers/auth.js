/**
 * Handlers de autenticação e gestão de usuários
 */

const { getDb, verifyPassword, hashPassword } = require('../database');
const { getFriendlyErrorMessage } = require('./utils');
const { isValidCredentials, isValidPositiveInt } = require('../../utils/validators');
const logger = require('../../utils/logger');
const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const SESSION_TTL_HOURS = 8;

function cleanExpiredSessions(db) {
  try {
    db.prepare(
      `DELETE FROM admin_sessions WHERE created_at < datetime('now', '-${SESSION_TTL_HOURS} hours')`
    ).run();
  } catch (_) { /* silencia para não bloquear */ }
}

function registerAuthHandlers(ipcMain) {
  // ─── Verificar se há algum admin na escola ──────────────────────────────────
  ipcMain.handle('auth:checkFirstAdmin', (_, schoolId) => {
    try {
      if (!isValidPositiveInt(schoolId)) throw new Error('School ID inválido.');
      
      const admin = getDb().prepare('SELECT id FROM admins WHERE school_id = ? LIMIT 1').get(schoolId);
      return { success: true, hasAdmin: !!admin };
    } catch (e) {
      logger.error('Failed to check first admin', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  // ─── Cadastrar primeiro admin ───────────────────────────────────────────────
  ipcMain.handle('auth:registerFirstAdmin', async (_, { schoolId, name, username, password }) => {
    try {
      if (!isValidPositiveInt(schoolId) || !name?.trim() || !isValidCredentials(username, password)) {
        throw new Error('Dados inválidos.');
      }

      // Verifica se já existe admin
      const existingAdmin = getDb().prepare('SELECT id FROM admins WHERE school_id = ? LIMIT 1').get(schoolId);
      if (existingAdmin) {
        throw new Error('Já existe um admin cadastrado para esta escola.');
      }

      const hashedPassword = await hashPassword(password);
      const result = getDb()
        .prepare('INSERT INTO admins (school_id, name, username, password, active) VALUES (?, ?, ?, ?, 1)')
        .run(schoolId, name.trim(), username.trim(), hashedPassword);
      
      logger.info('First admin created', { id: result.lastInsertRowid, schoolId, username });
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      const msg = e.message.includes('UNIQUE') ? 'Nome de usuário já existe.' : e.message;
      logger.error('Failed to register first admin', { error: msg });
      return { success: false, error: msg };
    }
  });

  // ─── Login ──────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async (_, { schoolId, username, password }) => {
    try {
      if (!isValidPositiveInt(schoolId) || !username?.trim() || !password?.trim()) {
        throw new Error('Credenciais inválidas.');
      }

      const admin = getDb().prepare(
        'SELECT id, name, username, active FROM admins WHERE school_id = ? AND username = ?'
      ).get(schoolId, username.trim());

      if (!admin) {
        throw new Error('Usuário ou senha incorretos.');
      }

      if (!admin.active) {
        throw new Error('Usuário inativo.');
      }

      // Verifica senha
      const adminWithPassword = getDb().prepare(
        'SELECT password FROM admins WHERE id = ?'
      ).get(admin.id);

      const isPasswordValid = await verifyPassword(password, adminWithPassword.password);
      if (!isPasswordValid) {
        throw new Error('Usuário ou senha incorretos.');
      }

      // Gera token de sessão
      const token = generateToken();
      getDb().prepare(
        'INSERT INTO admin_sessions (school_id, admin_id, token) VALUES (?, ?, ?)'
      ).run(schoolId, admin.id, token);

      logger.info('Admin logged in', { adminId: admin.id, schoolId });
      return {
        success: true,
        data: {
          token,
          admin: { id: admin.id, name: admin.name, username: admin.username, role: 'admin', schoolId }
        }
      };
    } catch (e) {
      logger.error('Login failed', { error: e.message });
      return { success: false, error: e.message };
    }
  });

  // ─── Verificar sessão ───────────────────────────────────────────────────────
  ipcMain.handle('auth:verifySession', (_, { schoolId, token }) => {
    try {
      if (!isValidPositiveInt(schoolId) || !token?.trim()) {
        throw new Error('Sessão inválida.');
      }

      cleanExpiredSessions(getDb());

      const session = getDb().prepare(
        `SELECT admin_id FROM admin_sessions
         WHERE school_id = ? AND token = ?
         AND created_at >= datetime('now', '-${SESSION_TTL_HOURS} hours')`
      ).get(schoolId, token);

      if (!session) {
        return { success: true, valid: false };
      }

      const admin = getDb().prepare(
        'SELECT id, name, username, active FROM admins WHERE id = ? AND active = 1'
      ).get(session.admin_id);

      if (!admin) {
        return { success: true, valid: false };
      }

      return {
        success: true,
        valid: true,
        admin: { id: admin.id, name: admin.name, username: admin.username, role: 'admin', schoolId }
      };
    } catch (e) {
      logger.error('Session verification failed', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  // ─── Logout ─────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:logout', (_, { token }) => {
    try {
      if (!token?.trim()) throw new Error('Token inválido.');

      getDb().prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
      logger.info('Admin logged out');
      return { success: true };
    } catch (e) {
      logger.error('Logout failed', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  // ─── Inativar admin ─────────────────────────────────────────────────────────
  ipcMain.handle('auth:deactivateAdmin', (_, { adminId }) => {
    try {
      if (!isValidPositiveInt(adminId)) throw new Error('ID inválido.');

      // Verifica se existe pelo menos outro admin ativo antes de desativar
      const admin = getDb().prepare('SELECT school_id FROM admins WHERE id = ?').get(adminId);
      if (!admin) throw new Error('Admin não encontrado.');

      const activeAdmins = getDb().prepare(
        'SELECT COUNT(*) as count FROM admins WHERE school_id = ? AND active = 1'
      ).get(admin.school_id);

      if (activeAdmins.count <= 1) {
        throw new Error('Não é possível desativar o único admin ativo da escola.');
      }

      getDb().prepare('UPDATE admins SET active = 0 WHERE id = ?').run(adminId);
      logger.info('Admin deactivated', { adminId });
      return { success: true };
    } catch (e) {
      logger.error('Failed to deactivate admin', { error: e.message });
      return { success: false, error: e.message };
    }
  });

  // ─── Reativar admin ─────────────────────────────────────────────────────────
  ipcMain.handle('auth:activateAdmin', (_, { adminId }) => {
    try {
      if (!isValidPositiveInt(adminId)) throw new Error('ID inválido.');

      getDb().prepare('UPDATE admins SET active = 1 WHERE id = ?').run(adminId);
      logger.info('Admin activated', { adminId });
      return { success: true };
    } catch (e) {
      logger.error('Failed to activate admin', { error: e.message });
      return { success: false, error: e.message };
    }
  });

  // ─── Inativar professor ─────────────────────────────────────────────────────
  ipcMain.handle('auth:deactivateTeacher', (_, { teacherId }) => {
    try {
      if (!isValidPositiveInt(teacherId)) throw new Error('ID inválido.');

      getDb().prepare('UPDATE teachers SET active = 0 WHERE id = ?').run(teacherId);
      logger.info('Teacher deactivated', { teacherId });
      return { success: true };
    } catch (e) {
      logger.error('Failed to deactivate teacher', { error: e.message });
      return { success: false, error: e.message };
    }
  });

  // ─── Reativar professor ─────────────────────────────────────────────────────
  ipcMain.handle('auth:activateTeacher', (_, { teacherId }) => {
    try {
      if (!isValidPositiveInt(teacherId)) throw new Error('ID inválido.');

      getDb().prepare('UPDATE teachers SET active = 1 WHERE id = ?').run(teacherId);
      logger.info('Teacher activated', { teacherId });
      return { success: true };
    } catch (e) {
      logger.error('Failed to activate teacher', { error: e.message });
      return { success: false, error: e.message };
    }
  });

  // ─── Promover professor a admin ─────────────────────────────────────────────
  ipcMain.handle('auth:promoteTeacherToAdmin', async (_, { teacherId, password }) => {
    try {
      if (!isValidPositiveInt(teacherId) || !password?.trim()) {
        throw new Error('Dados inválidos.');
      }

      const teacher = getDb().prepare('SELECT id, school_id, name, email FROM teachers WHERE id = ?').get(teacherId);
      if (!teacher) throw new Error('Professor não encontrado.');

      // Gera username a partir do email ou nome
      let username = teacher.email?.split('@')[0] || teacher.name.replace(/\s+/g, '').toLowerCase();
      
      // Garante unicidade
      let counter = 1;
      let baseUsername = username;
      while (getDb().prepare('SELECT id FROM admins WHERE username = ?').get(username)) {
        username = `${baseUsername}${counter++}`;
      }

      const hashedPassword = await hashPassword(password);
      const result = getDb()
        .prepare('INSERT INTO admins (school_id, name, username, password, active) VALUES (?, ?, ?, ?, 1)')
        .run(teacher.school_id, teacher.name, username, hashedPassword);

      logger.info('Teacher promoted to admin', { adminId: result.lastInsertRowid, teacherId });
      return { success: true, data: { adminId: result.lastInsertRowid, username } };
    } catch (e) {
      const msg = e.message.includes('UNIQUE') ? 'Nome de usuário já existe.' : e.message;
      logger.error('Failed to promote teacher', { error: msg });
      return { success: false, error: msg };
    }
  });
}

module.exports = { registerAuthHandlers };

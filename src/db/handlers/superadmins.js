/**
 * Handlers de Superadmin
 */

const { getDb, hashPassword, verifyPassword } = require('../database');
const { getFriendlyErrorMessage } = require('./utils');
const { isValidCredentials } = require('../../utils/validators');
const logger = require('../../utils/logger');

function registerSuperadminHandlers(ipcMain) {
  ipcMain.handle('db:getSuperadmins', () => {
    try {
      const rows = getDb()
        .prepare('SELECT id, name, username, created_at FROM superadmins')
        .all();
      logger.info('Superadmins retrieved', { count: rows.length });
      return { success: true, data: rows };
    } catch (e) {
      logger.error('Failed to get superadmins', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:createSuperadmin', async (_, { name, username, password }) => {
    try {
      // Validação
      if (!name?.trim() || !isValidCredentials(username, password)) {
        throw new Error('Nome, usuário e senha são obrigatórios. Senha deve ter pelo menos 6 caracteres.');
      }

      const hashedPassword = await hashPassword(password);
      const result = getDb()
        .prepare('INSERT INTO superadmins (name, username, password) VALUES (?, ?, ?)')
        .run(name.trim(), username.trim(), hashedPassword);
      
      logger.info('Superadmin created', { id: result.lastInsertRowid, username });
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      const msg = e.message.includes('UNIQUE') ? 'Nome de usuário já existe.' : e.message;
      logger.error('Failed to create superadmin', { error: msg });
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('db:loginSuperadmin', async (_, { username, password }) => {
    try {
      if (!isValidCredentials(username, password)) {
        throw new Error('Usuário e senha são obrigatórios.');
      }

      const row = getDb()
        .prepare('SELECT id, name, username FROM superadmins WHERE username = ?')
        .get(username.trim());
      
      if (!row) {
        logger.warn('Failed login attempt for superadmin', { username });
        return { success: false, error: 'Usuário ou senha incorretos.' };
      }

      const isValid = await verifyPassword(password, row.password);
      if (!isValid) {
        logger.warn('Failed login attempt for superadmin', { username });
        return { success: false, error: 'Usuário ou senha incorretos.' };
      }

      logger.info('Superadmin logged in', { id: row.id, username });
      return { success: true, data: { id: row.id, name: row.name, username: row.username } };
    } catch (e) {
      logger.error('Login error', { error: e.message });
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:deleteSuperadmin', (_, id) => {
    try {
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error('ID inválido.');
      }

      getDb().prepare('DELETE FROM superadmins WHERE id = ?').run(id);
      logger.info('Superadmin deleted', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to delete superadmin', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });
}

module.exports = { registerSuperadminHandlers };

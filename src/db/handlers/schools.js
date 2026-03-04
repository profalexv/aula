/**
 * Handlers de Escolas
 */

const { getDb } = require('../database');
const { getFriendlyErrorMessage } = require('./utils');
const { isValidSchoolData, isValidString } = require('../../utils/validators');
const logger = require('../../utils/logger');

function registerSchoolHandlers(ipcMain) {
  ipcMain.handle('db:getSchools', () => {
    try {
      const rows = getDb()
        .prepare('SELECT * FROM schools ORDER BY name')
        .all();
      return { success: true, data: rows };
    } catch (e) {
      logger.error('Failed to get schools', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:createSchool', (_, data) => {
    try {
      if (!isValidSchoolData(data)) {
        throw new Error('Dados da escola inválidos.');
      }

      const { name, acronym = '', address = '', cnpj = '', inep_code = '' } = data;
      const result = getDb()
        .prepare('INSERT INTO schools (name, acronym, address, cnpj, inep_code) VALUES (?, ?, ?, ?, ?)')
        .run(name.trim(), acronym.trim(), address.trim(), cnpj.trim(), inep_code.trim());
      
      logger.info('School created', { id: result.lastInsertRowid, name });
      return { success: true, data: { id: result.lastInsertRowid } };
    } catch (e) {
      logger.error('Failed to create school', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:updateSchool', (_, id, data) => {
    try {
      if (!Number.isInteger(id) || id <= 0 || !isValidSchoolData(data)) {
        throw new Error('Dados inválidos.');
      }

      const { name, acronym = '', address = '', cnpj = '', inep_code = '' } = data;
      getDb()
        .prepare('UPDATE schools SET name=?, acronym=?, address=?, cnpj=?, inep_code=? WHERE id=?')
        .run(name.trim(), acronym.trim(), address.trim(), cnpj.trim(), inep_code.trim(), id);
      
      logger.info('School updated', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to update school', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });

  ipcMain.handle('db:deleteSchool', (_, id) => {
    try {
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error('ID inválido.');
      }

      getDb().prepare('DELETE FROM schools WHERE id = ?').run(id);
      logger.info('School deleted', { id });
      return { success: true };
    } catch (e) {
      logger.error('Failed to delete school', { error: e.message });
      return { success: false, error: getFriendlyErrorMessage(e) };
    }
  });
}

module.exports = { registerSchoolHandlers };

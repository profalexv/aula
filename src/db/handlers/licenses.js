/**
 * Handlers de Licenças
 */

const { getModulesStatus, activateModule, deactivateModule } = require('../license-manager');
const logger = require('../../utils/logger');

function registerLicenseHandlers(ipcMain) {
  ipcMain.handle('license:getModulesStatus', () => {
    try {
      const data = getModulesStatus();
      return { success: true, data };
    } catch (e) {
      logger.error('Failed to get modules status', { error: e.message });
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('license:activate', (_, { moduleId, licenseKey }) => {
    try {
      logger.info('License activation attempt', { moduleId });
      const result = activateModule(moduleId, licenseKey);
      if (result.success) {
        logger.info('License activated', { moduleId });
      } else {
        logger.warn('License activation failed', { moduleId, error: result.error });
      }
      return result;
    } catch (e) {
      logger.error('License activation error', { moduleId, error: e.message });
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('license:deactivate', (_, moduleId) => {
    try {
      logger.info('License deactivation attempt', { moduleId });
      const result = deactivateModule(moduleId);
      if (result.success) {
        logger.info('License deactivated', { moduleId });
      } else {
        logger.warn('License deactivation failed', { moduleId });
      }
      return result;
    } catch (e) {
      logger.error('License deactivation error', { moduleId, error: e.message });
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerLicenseHandlers };

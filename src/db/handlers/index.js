/**
 * Registro centralizado de todos os handlers IPC
 */

const { app } = require('electron');
const logger = require('../../utils/logger');

// Sub-handlers
const { registerSuperadminHandlers } = require('./superadmins');
const { registerSchoolHandlers } = require('./schools');
const { registerAdminHandlers, registerTeacherHandlers, registerScheduleHandlers, registerLessonHandlers } = require('./consolidated');
const { registerLicenseHandlers } = require('./licenses');

/**
 * Registra todos os handlers IPC para operações de banco de dados.
 */
function registerIpcHandlers(ipcMain) {
  logger.info('Registering IPC handlers...');

  // ─── Utilitários ────────────────────────────────────────────────────────────
  ipcMain.handle('app:getDataPath', () => {
    return app.getPath('userData');
  });

  // ─── Registra handlers por entidade ────────────────────────────────────────
  registerLicenseHandlers(ipcMain);
  registerSuperadminHandlers(ipcMain);
  registerSchoolHandlers(ipcMain);
  registerAdminHandlers(ipcMain);
  registerTeacherHandlers(ipcMain);
  registerScheduleHandlers(ipcMain);
  registerLessonHandlers(ipcMain);

  // TODO: Adicionar handlers para:
  // - Planos de aula (createLessonPlan, updateLessonPlan, deleteLessonPlan, getLessonPlans)
  // - Recursos (createResource, updateResource, deleteResource, getResources)
  // - Turnos (createShift, updateShift, deleteShift, getShifts)
  // - Turmas (createClass, updateClass, deleteClass, getClasses)
  // - Componentes curriculares (createCurricula, updateCurricula, deleteCurricula, getCurricula)
  // - Horários (createTimeSlot, updateTimeSlot, deleteTimeSlot, getTimeSlots)
  // - Grade de componentes (createClassCurricula, deleteClassCurricula, getClassCurricula)
  // - Professor por componente (createClassTeacherCurricula, deleteClassTeacherCurricula, getClassTeacherCurricula)
  // - Dias de trabalho (createTeacherDay, deleteTeacherDay, getTeacherDays)

  logger.info('IPC handlers registered successfully');
}

module.exports = { registerIpcHandlers };

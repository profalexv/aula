const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expõe uma API segura ao renderer via contextBridge.
 * O renderer nunca tem acesso direto ao Node.js ou ao IPC.
 */
contextBridge.exposeInMainWorld('scholar', {
  // --- Autenticação ---
  auth: {
    checkFirstAdmin: (schoolId) => ipcRenderer.invoke('auth:checkFirstAdmin', schoolId),
    registerFirstAdmin: (data) => ipcRenderer.invoke('auth:registerFirstAdmin', data),
    login: (data) => ipcRenderer.invoke('auth:login', data),
    verifySession: (data) => ipcRenderer.invoke('auth:verifySession', data),
    logout: (data) => ipcRenderer.invoke('auth:logout', data),
    deactivateAdmin: (data) => ipcRenderer.invoke('auth:deactivateAdmin', data),
    activateAdmin: (data) => ipcRenderer.invoke('auth:activateAdmin', data),
    deactivateTeacher: (data) => ipcRenderer.invoke('auth:deactivateTeacher', data),
    activateTeacher: (data) => ipcRenderer.invoke('auth:activateTeacher', data),
    promoteTeacherToAdmin: (data) => ipcRenderer.invoke('auth:promoteTeacherToAdmin', data),
  },

  // --- Superadmins ---
  getSuperadmins: () => ipcRenderer.invoke('db:getSuperadmins'),
  createSuperadmin: (data) => ipcRenderer.invoke('db:createSuperadmin', data),
  loginSuperadmin: (credentials) => ipcRenderer.invoke('db:loginSuperadmin', credentials),
  deleteSuperadmin: (id) => ipcRenderer.invoke('db:deleteSuperadmin', id),

  // --- Escolas ---
  getSchools: () => ipcRenderer.invoke('db:getSchools'),
  createSchool: (data) => ipcRenderer.invoke('db:createSchool', data),
  updateSchool: (id, data) => ipcRenderer.invoke('db:updateSchool', id, data),
  deleteSchool: (id) => ipcRenderer.invoke('db:deleteSchool', id),

  // --- Admins ---
  getAdmins: (schoolId) => ipcRenderer.invoke('db:getAdmins', schoolId),
  createAdmin: (data) => ipcRenderer.invoke('db:createAdmin', data),
  deleteAdmin: (id) => ipcRenderer.invoke('db:deleteAdmin', id),
  loginAdmin: (credentials) => ipcRenderer.invoke('db:loginAdmin', credentials),

  // --- Professores ---
  getTeachers: (schoolId) => ipcRenderer.invoke('db:getTeachers', schoolId),
  createTeacher: (data) => ipcRenderer.invoke('db:createTeacher', data),
  updateTeacher: (id, data) => ipcRenderer.invoke('db:updateTeacher', id, data),
  deleteTeacher: (id) => ipcRenderer.invoke('db:deleteTeacher', id),

  // --- Cronograma ---
  getSchedules: (schoolId) => ipcRenderer.invoke('db:getSchedules', schoolId),
  createSchedule: (data) => ipcRenderer.invoke('db:createSchedule', data),
  updateSchedule: (id, data) => ipcRenderer.invoke('db:updateSchedule', id, data),
  deleteSchedule: (id) => ipcRenderer.invoke('db:deleteSchedule', id),

  // --- Aulas ---
  getLessons: (scheduleId) => ipcRenderer.invoke('db:getLessons', scheduleId),
  createLesson: (data) => ipcRenderer.invoke('db:createLesson', data),
  updateLesson: (id, data) => ipcRenderer.invoke('db:updateLesson', id, data),
  deleteLesson: (id) => ipcRenderer.invoke('db:deleteLesson', id),

  // --- Planos de Aula ---
  getLessonPlans: (schoolId) => ipcRenderer.invoke('db:getLessonPlans', schoolId),
  createLessonPlan: (data) => ipcRenderer.invoke('db:createLessonPlan', data),
  updateLessonPlan: (id, data) => ipcRenderer.invoke('db:updateLessonPlan', id, data),
  deleteLessonPlan: (id) => ipcRenderer.invoke('db:deleteLessonPlan', id),

  // --- Recursos (Salas, Laboratórios, etc.) ---
  getResources: (schoolId) => ipcRenderer.invoke('db:getResources', schoolId),
  createResource: (data) => ipcRenderer.invoke('db:createResource', data),
  updateResource: (id, data) => ipcRenderer.invoke('db:updateResource', id, data),
  deleteResource: (id) => ipcRenderer.invoke('db:deleteResource', id),

  // --- Turnos (Shifts) ---
  getShifts: (schoolId) => ipcRenderer.invoke('db:getShifts', schoolId),
  createShift: (data) => ipcRenderer.invoke('db:createShift', data),
  updateShift: (id, data) => ipcRenderer.invoke('db:updateShift', id, data),
  deleteShift: (id) => ipcRenderer.invoke('db:deleteShift', id),

  // --- Turmas (Classes) ---
  getClasses: (schoolId) => ipcRenderer.invoke('db:getClasses', schoolId),
  createClass: (data) => ipcRenderer.invoke('db:createClass', data),
  updateClass: (id, data) => ipcRenderer.invoke('db:updateClass', id, data),
  deleteClass: (id) => ipcRenderer.invoke('db:deleteClass', id),

  // --- Componentes Curriculares ---
  getCurricula: (schoolId) => ipcRenderer.invoke('db:getCurricula', schoolId),
  createCurricula: (data) => ipcRenderer.invoke('db:createCurricula', data),
  updateCurricula: (id, data) => ipcRenderer.invoke('db:updateCurricula', id, data),
  deleteCurricula: (id) => ipcRenderer.invoke('db:deleteCurricula', id),

  // --- Horários (Time Slots) ---
  getTimeSlots: (shiftId) => ipcRenderer.invoke('db:getTimeSlots', shiftId),
  createTimeSlot: (data) => ipcRenderer.invoke('db:createTimeSlot', data),
  updateTimeSlot: (id, data) => ipcRenderer.invoke('db:updateTimeSlot', id, data),
  deleteTimeSlot: (id) => ipcRenderer.invoke('db:deleteTimeSlot', id),

  // --- Grade: Componentes por Turma ---
  getClassCurricula: (classId) => ipcRenderer.invoke('db:getClassCurricula', classId),
  createClassCurricula: (data) => ipcRenderer.invoke('db:createClassCurricula', data),
  deleteClassCurricula: (id) => ipcRenderer.invoke('db:deleteClassCurricula', id),

  // --- Professor por Componente e Turma ---
  getClassTeacherCurricula: (classId) => ipcRenderer.invoke('db:getClassTeacherCurricula', classId),
  createClassTeacherCurricula: (data) => ipcRenderer.invoke('db:createClassTeacherCurricula', data),
  deleteClassTeacherCurricula: (id) => ipcRenderer.invoke('db:deleteClassTeacherCurricula', id),

  // --- Dias de Trabalho do Professor ---
  getTeacherDays: (teacherId) => ipcRenderer.invoke('db:getTeacherDays', teacherId),
  createTeacherDay: (data) => ipcRenderer.invoke('db:createTeacherDay', data),
  deleteTeacherDay: (id) => ipcRenderer.invoke('db:deleteTeacherDay', id),

  // --- Licenças ---
  getModulesStatus:  ()               => ipcRenderer.invoke('license:getModulesStatus'),
  activateLicense:   (moduleId, key)  => ipcRenderer.invoke('license:activate', { moduleId, licenseKey: key }),
  deactivateLicense: (moduleId)       => ipcRenderer.invoke('license:deactivate', moduleId),

  // --- Utilitários ---
  getAppDataPath: () => ipcRenderer.invoke('app:getDataPath'),
});

/**
 * data-provider.js
 * 
 * Abstração da camada de dados. O código dos módulos nunca acessa
 * SQLite ou Supabase diretamente — sempre usa esta interface.
 * 
 * Troca de provider:
 *   - Local (Electron):  usa window.scholar (IPC → SQLite)
 *   - Online / Premium:  usa SupabaseProvider (futuro)
 * 
 * Para adicionar Supabase no futuro, basta criar SupabaseProvider
 * implementando os mesmos métodos e chamar DataProvider.use('supabase').
 */

class DataProvider {
  constructor() {
    this._provider = null;
    this._mode = null; // 'local' | 'supabase'
  }

  /**
   * Inicializa o provider adequado ao ambiente.
   * Chamado uma vez no boot do app.
   */
  init() {
    if (window.scholar) {
      // Estamos no Electron — usa IPC (SQLite local)
      this._provider = new LocalIpcProvider();
      this._mode = 'local';
    } else {
      // Estamos no browser — futuramente Supabase
      // this._provider = new SupabaseProvider(config);
      // this._mode = 'supabase';
      throw new Error('[DataProvider] Nenhum provider disponível. Supabase ainda não implementado.');
    }
    console.log(`[DataProvider] Modo: ${this._mode}`);
  }

  get mode() { return this._mode; }
  get isLocal() { return this._mode === 'local'; }
  get isCloud() { return this._mode === 'supabase'; }

  // ─── Delegação para o provider ativo ─────────────────────────────────────

  // Superadmins
  getSuperadmins()              { return this._provider.getSuperadmins(); }
  createSuperadmin(data)        { return this._provider.createSuperadmin(data); }
  loginSuperadmin(creds)        { return this._provider.loginSuperadmin(creds); }
  deleteSuperadmin(id)          { return this._provider.deleteSuperadmin(id); }

  // Escolas
  getSchools()                  { return this._provider.getSchools(); }
  createSchool(data)            { return this._provider.createSchool(data); }
  updateSchool(id, data)        { return this._provider.updateSchool(id, data); }
  deleteSchool(id)              { return this._provider.deleteSchool(id); }

  // Admins
  getAdmins(schoolId)           { return this._provider.getAdmins(schoolId); }
  createAdmin(data)             { return this._provider.createAdmin(data); }
  deleteAdmin(id)               { return this._provider.deleteAdmin(id); }
  loginAdmin(creds)             { return this._provider.loginAdmin(creds); }

  // Professores
  getTeachers(schoolId)         { return this._provider.getTeachers(schoolId); }
  createTeacher(data)           { return this._provider.createTeacher(data); }
  updateTeacher(id, data)       { return this._provider.updateTeacher(id, data); }
  deleteTeacher(id)             { return this._provider.deleteTeacher(id); }

  // Cronograma
  getSchedules(schoolId)        { return this._provider.getSchedules(schoolId); }
  createSchedule(data)          { return this._provider.createSchedule(data); }
  updateSchedule(id, data)      { return this._provider.updateSchedule(id, data); }
  deleteSchedule(id)            { return this._provider.deleteSchedule(id); }

  // Aulas
  getLessons(scheduleId)        { return this._provider.getLessons(scheduleId); }
  createLesson(data)            { return this._provider.createLesson(data); }
  updateLesson(id, data)        { return this._provider.updateLesson(id, data); }
  deleteLesson(id)              { return this._provider.deleteLesson(id); }

  // Planos de aula
  getLessonPlans(schoolId)      { return this._provider.getLessonPlans(schoolId); }
  createLessonPlan(data)        { return this._provider.createLessonPlan(data); }
  updateLessonPlan(id, data)    { return this._provider.updateLessonPlan(id, data); }
  deleteLessonPlan(id)          { return this._provider.deleteLessonPlan(id); }

  // Recursos
  getResources(schoolId)        { return this._provider.getResources(schoolId); }
  createResource(data)          { return this._provider.createResource(data); }
  updateResource(id, data)      { return this._provider.updateResource(id, data); }
  deleteResource(id)            { return this._provider.deleteResource(id); }

  // Turnos
  getShifts(schoolId)           { return this._provider.getShifts(schoolId); }
  createShift(data)             { return this._provider.createShift(data); }
  updateShift(id, data)         { return this._provider.updateShift(id, data); }
  deleteShift(id)               { return this._provider.deleteShift(id); }

  // Turmas
  getClasses(schoolId)          { return this._provider.getClasses(schoolId); }
  createClass(data)             { return this._provider.createClass(data); }
  updateClass(id, data)         { return this._provider.updateClass(id, data); }
  deleteClass(id)               { return this._provider.deleteClass(id); }

  // Componentes Curriculares
  getCurricula(schoolId)        { return this._provider.getCurricula(schoolId); }
  createCurricula(data)         { return this._provider.createCurricula(data); }
  updateCurricula(id, data)     { return this._provider.updateCurricula(id, data); }
  deleteCurricula(id)           { return this._provider.deleteCurricula(id); }

  // Horários
  getTimeSlots(shiftId)         { return this._provider.getTimeSlots(shiftId); }
  createTimeSlot(data)          { return this._provider.createTimeSlot(data); }
  updateTimeSlot(id, data)      { return this._provider.updateTimeSlot(id, data); }
  deleteTimeSlot(id)            { return this._provider.deleteTimeSlot(id); }

  // Grade
  getClassCurricula(classId)    { return this._provider.getClassCurricula(classId); }
  createClassCurricula(data)    { return this._provider.createClassCurricula(data); }
  deleteClassCurricula(id)      { return this._provider.deleteClassCurricula(id); }

  // Professor por Componente e Turma
  getClassTeacherCurricula(classId) { return this._provider.getClassTeacherCurricula(classId); }
  createClassTeacherCurricula(data) { return this._provider.createClassTeacherCurricula(data); }
  deleteClassTeacherCurricula(id)   { return this._provider.deleteClassTeacherCurricula(id); }

  // Dias de Trabalho
  getTeacherDays(teacherId)    { return this._provider.getTeacherDays(teacherId); }
  createTeacherDay(data)       { return this._provider.createTeacherDay(data); }
  deleteTeacherDay(id)         { return this._provider.deleteTeacherDay(id); }
}

// ─── Provider local (Electron IPC → SQLite) ───────────────────────────────────
class LocalIpcProvider {
  _call(fn, ...args) {
    return fn(...args).then(res => {
      if (!res.success) throw new Error(res.error || 'Erro desconhecido');
      return res.data;
    });
  }

  getSuperadmins()           { return this._call(window.scholar.getSuperadmins); }
  createSuperadmin(d)        { return this._call(window.scholar.createSuperadmin, d); }
  loginSuperadmin(c)         { return this._call(window.scholar.loginSuperadmin, c); }
  deleteSuperadmin(id)       { return this._call(window.scholar.deleteSuperadmin, id); }

  getSchools()               { return this._call(window.scholar.getSchools); }
  createSchool(d)            { return this._call(window.scholar.createSchool, d); }
  updateSchool(id, d)        { return this._call(window.scholar.updateSchool, id, d); }
  deleteSchool(id)           { return this._call(window.scholar.deleteSchool, id); }

  getAdmins(schoolId)        { return this._call(window.scholar.getAdmins, schoolId); }
  createAdmin(d)             { return this._call(window.scholar.createAdmin, d); }
  deleteAdmin(id)            { return this._call(window.scholar.deleteAdmin, id); }
  loginAdmin(c)              { return this._call(window.scholar.loginAdmin, c); }

  getTeachers(schoolId)      { return this._call(window.scholar.getTeachers, schoolId); }
  createTeacher(d)           { return this._call(window.scholar.createTeacher, d); }
  updateTeacher(id, d)       { return this._call(window.scholar.updateTeacher, id, d); }
  deleteTeacher(id)          { return this._call(window.scholar.deleteTeacher, id); }

  getSchedules(schoolId)     { return this._call(window.scholar.getSchedules, schoolId); }
  createSchedule(d)          { return this._call(window.scholar.createSchedule, d); }
  updateSchedule(id, d)      { return this._call(window.scholar.updateSchedule, id, d); }
  deleteSchedule(id)         { return this._call(window.scholar.deleteSchedule, id); }

  getLessons(scheduleId)     { return this._call(window.scholar.getLessons, scheduleId); }
  createLesson(d)            { return this._call(window.scholar.createLesson, d); }
  updateLesson(id, d)        { return this._call(window.scholar.updateLesson, id, d); }
  deleteLesson(id)           { return this._call(window.scholar.deleteLesson, id); }

  getLessonPlans(schoolId)   { return this._call(window.scholar.getLessonPlans, schoolId); }
  createLessonPlan(d)        { return this._call(window.scholar.createLessonPlan, d); }
  updateLessonPlan(id, d)    { return this._call(window.scholar.updateLessonPlan, id, d); }
  deleteLessonPlan(id)       { return this._call(window.scholar.deleteLessonPlan, id); }

  getResources(schoolId)     { return this._call(window.scholar.getResources, schoolId); }
  createResource(d)          { return this._call(window.scholar.createResource, d); }
  updateResource(id, d)      { return this._call(window.scholar.updateResource, id, d); }
  deleteResource(id)         { return this._call(window.scholar.deleteResource, id); }

  getShifts(schoolId)        { return this._call(window.scholar.getShifts, schoolId); }
  createShift(d)             { return this._call(window.scholar.createShift, d); }
  updateShift(id, d)         { return this._call(window.scholar.updateShift, id, d); }
  deleteShift(id)            { return this._call(window.scholar.deleteShift, id); }

  getClasses(schoolId)       { return this._call(window.scholar.getClasses, schoolId); }
  createClass(d)             { return this._call(window.scholar.createClass, d); }
  updateClass(id, d)         { return this._call(window.scholar.updateClass, id, d); }
  deleteClass(id)            { return this._call(window.scholar.deleteClass, id); }

  getCurricula(schoolId)     { return this._call(window.scholar.getCurricula, schoolId); }
  createCurricula(d)         { return this._call(window.scholar.createCurricula, d); }
  updateCurricula(id, d)     { return this._call(window.scholar.updateCurricula, id, d); }
  deleteCurricula(id)        { return this._call(window.scholar.deleteCurricula, id); }

  getTimeSlots(shiftId)      { return this._call(window.scholar.getTimeSlots, shiftId); }
  createTimeSlot(d)          { return this._call(window.scholar.createTimeSlot, d); }
  updateTimeSlot(id, d)      { return this._call(window.scholar.updateTimeSlot, id, d); }
  deleteTimeSlot(id)         { return this._call(window.scholar.deleteTimeSlot, id); }

  getClassCurricula(classId) { return this._call(window.scholar.getClassCurricula, classId); }
  createClassCurricula(d)    { return this._call(window.scholar.createClassCurricula, d); }
  deleteClassCurricula(id)   { return this._call(window.scholar.deleteClassCurricula, id); }

  getClassTeacherCurricula(classId) { return this._call(window.scholar.getClassTeacherCurricula, classId); }
  createClassTeacherCurricula(d)    { return this._call(window.scholar.createClassTeacherCurricula, d); }
  deleteClassTeacherCurricula(id)   { return this._call(window.scholar.deleteClassTeacherCurricula, id); }

  getTeacherDays(teacherId) { return this._call(window.scholar.getTeacherDays, teacherId); }
  createTeacherDay(d)       { return this._call(window.scholar.createTeacherDay, d); }
  deleteTeacherDay(id)      { return this._call(window.scholar.deleteTeacherDay, id); }
}

/**
 * ─── SupabaseProvider (stub para implementação futura) ─────────────────────
 * 
 * Quando o módulo premium/online for ativado, criar:
 *   src/renderer/data/supabase-provider.js
 * 
 * Ele deve implementar todos os mesmos métodos acima usando
 * o cliente @supabase/supabase-js. Ex.:
 * 
 *   async getSchools() {
 *     const { data, error } = await supabase.from('schools').select('*');
 *     if (error) throw error;
 *     return data;
 *   }
 * 
 * E então registrar no DataProvider.init():
 *   case 'supabase': this._provider = new SupabaseProvider(config); break;
 */

// Exporta instância singleton
window.DB = new DataProvider();

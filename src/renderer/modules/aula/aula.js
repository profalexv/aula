/**
 * Módulo: Aula (Registro de Aulas)
 *
 * Gerencia o registro e acompanhamento de aulas ministradas.
 * Integrado com turmas, componentes curriculares, professores e horários.
 * Self-contained — pode ser extraído como repositório independente.
 *
 * Estrutura prevista para versão web independente:
 *   github.com/scholar-app/aula
 */

window.ModuleAula = (() => {
  let state = {
    classes: [],
    shifts: [],
    curricula: [],
    timeSlots: [],
    classCurricula: [],
    classTeacherCurricula: [],
    lessons: [],
    selectedClassId: null,
    filter: { resourceId: '' },
  };

  const WEEKDAYS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // ─── Ponto de entrada ────────────────────────────────────────────────────────
  async function mount(container) {
    container.innerHTML = `
      <div class="module-header">
        <div>
          <div class="module-title">📝 Aulas da Turma</div>
          <div class="module-subtitle">Horário de aulas — ${escHtml(window.AppContext?.schoolName ?? '')}</div>
        </div>
        <button class="btn btn-ghost" id="btn-manage-data">📊 Gestão de Dados</button>
        <button class="btn btn-ghost" id="btn-school-data">⚙️ Dados da Escola</button>
      </div>

      <div class="context-bar">
        <label>Turma</label>
        <select id="class-select"><option value="">— Selecione a turma —</option></select>
      </div>

      <div id="schedule-content"></div>
    `;

    bindEvents(container);
    await loadClassesAndData(container);
  }

  function bindEvents(container) {
    container.querySelector('#btn-manage-data').addEventListener('click', () => {
      window._activateTab('cronograma'); // Ativa aba de cronograma para Gestão de Dados
    });
    container.querySelector('#btn-school-data').addEventListener('click', () => {
      window.AppContext.openEditor(() => {
        container.querySelector('.module-subtitle').textContent =
          `Horário de aulas — ${window.AppContext.schoolName}`;
      });
    });
    container.querySelector('#class-select').addEventListener('change', async e => {
      state.selectedClassId = Number(e.target.value) || null;
      await loadClassData(container);
    });
  }

  async function loadClassesAndData(container) {
    const schoolId = window.AppContext.schoolId;
    try {
      [state.classes, state.shifts, state.curricula] = await Promise.all([
        window.DB.getClasses(schoolId),
        window.DB.getShifts(schoolId),
        window.DB.getCurricula(schoolId),
      ]);
    } catch (e) {
      window.showToast('Erro ao carregar dados: ' + e.message, 'error');
      return;
    }

    const classSel = container.querySelector('#class-select');
    classSel.innerHTML = '<option value="">— Selecione a turma —</option>' +
      state.classes.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

    renderContent(container);
  }

  async function loadClassData(container) {
    if (!state.selectedClassId) {
      renderContent(container);
      return;
    }

    try {
      const cls = state.classes.find(c => c.id === state.selectedClassId);
      const shift = state.shifts.find(s => s.id === cls?.shift_id);

      [state.timeSlots, state.classCurricula, state.classTeacherCurricula, state.lessons] = await Promise.all([
        shift ? window.DB.getTimeSlots(shift.id) : Promise.resolve([]),
        window.DB.getClassCurricula(state.selectedClassId),
        window.DB.getClassTeacherCurricula(state.selectedClassId),
        window.DB.getLessons(state.selectedClassId),
      ]);
    } catch (e) {
      window.showToast('Erro ao carregar aulas: ' + e.message, 'error');
      state.timeSlots = [];
      state.classCurricula = [];
      state.classTeacherCurricula = [];
      state.lessons = [];
    }

    renderContent(container);
  }

  function renderContent(container) {
    const el = container.querySelector('#schedule-content');

    if (!state.selectedClassId) {
      el.innerHTML = `<div class="empty-state">
        <div class="icon">📝</div>
        <p>Selecione uma turma para visualizar o horário de aulas.</p>
      </div>`;
      return;
    }

    const cls = state.classes.find(c => c.id === state.selectedClassId);
    const shift = state.shifts.find(s => s.id === cls?.shift_id);

    if (!state.timeSlots || state.timeSlots.length === 0) {
      el.innerHTML = `<div class="empty-state">
        <div class="icon">⏰</div>
        <p>Nenhum horário cadastrado para o turno <strong>${escHtml(shift?.name ?? '—')}</strong>.</p>
        <p style="font-size:12px;color:var(--color-text-muted);margin-top:8px">
          Configure os períodos em <strong>📊 Gestão de Dados → ⏰ Horários</strong>.
        </p>
      </div>`;
      return;
    }

    // Monta grid: Períodos × Dias da semana
    renderScheduleGrid(el, cls, shift);
  }

  function renderScheduleGrid(el, cls, shift) {
    // Cria mapa de aulas agendadas por (periodo, dia)
    const lessonMap = {};
    state.lessons.forEach(l => {
      lessonMap[`${l.weekday}_${l.period}`] = l;
    });

    // Cria mapa de componentes da turma: curricula_id -> professor_id
    const teacherByCurricula = {};
    state.classTeacherCurricula.forEach(ctc => {
      if (ctc.class_id === state.selectedClassId) {
        teacherByCurricula[ctc.curricula_id] = ctc.teacher_id;
      }
    });

    // Encontra períodos distintos
    const periods = [...new Set(state.timeSlots.map(ts => ts.period))].sort((a, b) => a - b);
    const maxPeriod = Math.max(...periods);

    let html = `
      <div style="margin-bottom:16px">
        <div style="font-size:14px;color:var(--color-text-muted)">
          <strong>Turma:</strong> ${escHtml(cls.name)}<br>
          <strong>Turno:</strong> ${escHtml(shift?.name ?? '—')}
        </div>
      </div>
    `;

    html += `<div class="schedule-grid"><table>
      <thead><tr>
        <th style="width:80px">Período</th>
        <th>Horário</th>`;

    for (let d = 1; d <= 6; d++) {
      html += `<th>${escHtml(WEEKDAYS[d])}</th>`;
    }
    html += `</tr></thead><tbody>`;

    periods.forEach(period => {
      const timeSlot = state.timeSlots.find(ts => ts.period === period);
      const startTime = timeSlot?.start_time ?? '—';
      const endTime = timeSlot?.end_time ?? '—';

      html += `<tr>
        <td style="font-weight:700;text-align:center">${period}º</td>
        <td style="font-size:12px;color:var(--color-text-muted)">${startTime} — ${endTime}</td>`;

      for (let day = 1; day <= 6; day++) {
        const lesson = lessonMap[`${day}_${period}`];
        
        if (lesson) {
          // Há uma aula agendada
          const curricula = state.curricula.find(c => c.id === lesson.curricula_id);
          const teacher = state.classTeacherCurricula.find(ctc =>
            ctc.class_id === state.selectedClassId &&
            ctc.curricula_id === lesson.curricula_id
          );
          
          let cellContent = `<div class="lesson-cell">
            <div style="font-weight:600">${escHtml(curricula?.name ?? 'Disciplina')}</div>`;
          if (teacher) {
            const prof = state.classTeacherCurricula.find(ctc => ctc.teacher_id === teacher.teacher_id);
            cellContent += `<div style="font-size:12px;color:var(--color-text-muted)">Prof. ${escHtml(prof ? 'Atribuído' : '—')}</div>`;
          }
          if (lesson.resource_id) {
            cellContent += `<div style="font-size:11px;color:#666">Sala/Ambiente</div>`;
          }
          cellContent += `</div>`;
          
          html += `<td class="lesson-filled" title="Aula agendada">${cellContent}</td>`;
        } else {
          html += `<td class="lesson-empty" title="Sem aula"></td>`;
        }
      }
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;

    html += `<div style="margin-top:16px;padding:12px;background:var(--color-bg);border-radius:8px;font-size:12px;color:var(--color-text-muted)">
      <strong>Componentes da turma:</strong> ${
        state.classCurricula.length === 0
          ? 'Nenhum componente associado.'
          : state.classCurricula.map(cc => {
              const curr = state.curricula.find(c => c.id === cc.curricula_id);
              return escHtml(curr?.name ?? '?');
            }).join(', ')
      }<br>
      <strong>Para editar:</strong> Use <strong>📊 Gestão de Dados</strong> na aba Cronograma.
    </div>`;

    el.innerHTML = html;
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { mount };
})();

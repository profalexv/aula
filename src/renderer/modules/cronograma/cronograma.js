/**
 * Módulo: Cronograma
 *
 * Sistema de agendamento de recursos (salas, laboratórios, bibliotecas, etc).
 * Self-contained — pode ser extraído como repositório independente.
 * Usa window.DB (DataProvider) e window.AppContext para acesso a dados.
 *
 * Estrutura prevista para versão web independente:
 *   github.com/scholar-app/cronograma
 */

window.ModuleCronograma = (() => {
  // ─── Estado interno ─────────────────────────────────────────────────────────
  let state = {
    resources: [],
    teachers: [],
    lessons: [],        // todas as aulas do schedule (todos os recursos)
    resourceLessons: [], // aulas filtradas pelo recurso selecionado
    selectedResourceId: null,
    defaultScheduleId: null,
  };

  const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const RESOURCE_TYPES = ['Sala', 'Laboratório', 'Biblioteca', 'Quadra', 'Auditório', 'Outro'];

  // ─── Ponto de entrada ────────────────────────────────────────────────────────
  async function mount(container) {
    container.innerHTML = `
      <div class="module-header">
        <div>
          <div class="module-title">📅 Cronograma</div>
          <div class="module-subtitle">Agendamento de recursos — ${escHtml(window.AppContext?.schoolName ?? '')}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" id="btn-manage-data">📊 Gestão de Dados</button>
          <button class="btn btn-ghost" id="btn-manage-teachers">👨‍🏫 Professores</button>
          <button class="btn btn-ghost" id="btn-manage-resources">🏛️ Recursos</button>
          <button class="btn btn-ghost" id="btn-school-data">⚙️ Dados da Escola</button>
        </div>
      </div>

      <div class="context-bar">
        <label>Recurso</label>
        <select id="resource-select"><option value="">— Selecione um recurso —</option></select>
      </div>

      <div id="schedule-content"></div>
    `;

    bindEvents(container);
    await loadResources(container);
  }

  function bindEvents(container) {
    container.querySelector('#btn-manage-data').addEventListener('click', () => openDataManagement(container));
    container.querySelector('#btn-manage-teachers').addEventListener('click', () => openTeachersManager(container));
    container.querySelector('#btn-manage-resources').addEventListener('click', () => openResourcesManager(container));
    container.querySelector('#btn-school-data').addEventListener('click', () => {
      window.AppContext.openEditor(() => {
        container.querySelector('.module-subtitle').textContent =
          `Agendamento de recursos — ${window.AppContext.schoolName}`;
      });
    });
    container.querySelector('#resource-select').addEventListener('change', async e => {
      state.selectedResourceId = Number(e.target.value) || null;
      await loadLessons(container);
    });
  }

  // ─── Carregamentos ──────────────────────────────────────────────────────────
  async function loadResources(container) {
    const schoolId = window.AppContext.schoolId;
    try {
      // Garante que existe um schedule padrão para agendamentos
      let schedules = await window.DB.getSchedules(schoolId);
      if (schedules.length === 0) {
        await window.DB.createSchedule({
          school_id: schoolId,
          name: 'Agendamentos',
          year: new Date().getFullYear(),
          semester: 1,
        });
        schedules = await window.DB.getSchedules(schoolId);
      }
      state.defaultScheduleId = schedules[0]?.id;

      [state.resources, state.teachers] = await Promise.all([
        window.DB.getResources(schoolId),
        window.DB.getTeachers(schoolId),
      ]);
    } catch { state.resources = []; state.teachers = []; }

    const resourceSel = container.querySelector('#resource-select');
    resourceSel.innerHTML = '<option value="">— Selecione um recurso —</option>' +
      state.resources.map(r => `<option value="${r.id}">${escHtml(r.name)} (${r.type})</option>`).join('');

    if (state.selectedResourceId) {
      resourceSel.value = state.selectedResourceId;
    }
    await loadLessons(container);
  }

  async function loadLessons(container) {
    if (!state.defaultScheduleId) {
      renderGrid(container);
      return;
    }
    try {
      // Carrega TODAS as aulas do schedule (necessário para detectar conflitos de professor)
      state.lessons = await window.DB.getLessons(state.defaultScheduleId);
      // Filtra pelo recurso selecionado para exibição na grade
      state.resourceLessons = state.selectedResourceId
        ? state.lessons.filter(l => l.resource_id === state.selectedResourceId)
        : [];
    } catch { state.lessons = []; state.resourceLessons = []; }
    renderGrid(container);
  }

  // ─── Grade de horários ──────────────────────────────────────────────────────
  function renderGrid(container) {
    const el = container.querySelector('#schedule-content');

    if (!state.selectedResourceId) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="icon">📅</div>
          <p>Selecione um recurso para visualizar e gerenciar o agendamento.</p>
        </div>`;
      return;
    }

    const resource = state.resources.find(r => r.id === state.selectedResourceId);
    if (!resource) {
      el.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>Recurso não encontrado.</p></div>';
      return;
    }

    const maxPeriod = Math.max(6, ...state.resourceLessons.map(l => l.period || 0));

    const lessonMap = {};
    state.resourceLessons.forEach(l => { lessonMap[`${l.weekday}_${l.period}`] = l; });

    let html = `<div style="margin-bottom:16px">
      <div style="font-size:14px;color:var(--color-text-muted)">
        <strong>${escHtml(resource.name)}</strong> • ${resource.type}
        ${resource.capacity ? ` • Capacidade: ${resource.capacity} pessoas` : ''}
      </div>
      ${resource.description ? `<div style="font-size:12px;margin-top:4px;color:var(--color-text-muted)">${escHtml(resource.description)}</div>` : ''}
    </div>`;

    html += `<div class="schedule-grid"><table>
      <thead><tr>
        <th>Período</th>
        ${WEEKDAYS.map(d => `<th>${d}</th>`).join('')}
      </tr></thead>
      <tbody>`;

    for (let p = 1; p <= maxPeriod; p++) {
      html += `<tr><td>${p}º</td>`;
      for (let d = 1; d <= WEEKDAYS.length; d++) {
        const lesson = lessonMap[`${d}_${p}`];
        if (lesson) {
          html += `<td data-day="${d}" data-period="${p}" title="Clique para editar" style="cursor:pointer">
            <div class="lesson-cell">
              ${escHtml(lesson.subject)}
              ${lesson.teacher_name ? `<div class="teacher-name">${escHtml(lesson.teacher_name)}</div>` : ''}
            </div>
          </td>`;
        } else {
          html += `<td class="empty-cell" data-day="${d}" data-period="${p}" title="Clique para agendar" style="cursor:pointer"></td>`;
        }
      }
      html += '</tr>';
    }

    html += `</tbody></table></div>`;

    html += `<div style="margin-top:10px;display:flex;gap:8px;align-items:center">
      <button class="btn btn-ghost btn-sm" id="btn-add-period">+ Período</button>
      <button class="btn btn-ghost btn-sm" id="btn-print-schedule">🖨️ Imprimir</button>
      <span style="color:var(--color-text-muted);font-size:12px">${state.resourceLessons.length} agendamento(s)</span>
    </div>`;

    el.innerHTML = html;

    // Cliques nas células
    el.querySelectorAll('td[data-day]').forEach(cell => {
      cell.addEventListener('click', () => {
        if (window.AppContext.currentUserRole !== 'admin') {
          window.showToast('Apenas administradores podem editar o cronograma.', 'warning');
          return;
        }
        const day = Number(cell.dataset.day);
        const period = Number(cell.dataset.period);
        const existing = lessonMap[`${day}_${period}`];
        openLessonForm(day, period, existing, container);
      });
    });

    el.querySelector('#btn-add-period')?.addEventListener('click', () => {
      if (window.AppContext.currentUserRole !== 'admin') {
        window.showToast('Apenas administradores podem editar o cronograma.', 'warning');
        return;
      }
      const newPeriod = maxPeriod + 1;
      window.showToast(`Período ${newPeriod}º adicionado. Clique nas células para agendar.`, 'info');
      state.resourceLessons.push({ weekday: 0, period: newPeriod, subject: '', resource_id: state.selectedResourceId, _placeholder: true });
      renderGrid(container);
      state.resourceLessons = state.resourceLessons.filter(l => !l._placeholder);
    });

    el.querySelector('#btn-print-schedule')?.addEventListener('click', () => {
      printSchedule(resource, lessonMap, maxPeriod);
    });
  }

  // ─── Impressão / exportação ───────────────────────────────────────────────
  function printSchedule(resource, lessonMap, maxPeriod) {
    const schoolName = escHtml(window.AppContext?.schoolName ?? '');
    const resourceName = escHtml(resource.name);
    const resourceType = escHtml(resource.type);

    let tableRows = '';
    for (let p = 1; p <= maxPeriod; p++) {
      tableRows += `<tr><td class="period">${p}º</td>`;
      for (let d = 1; d <= WEEKDAYS.length; d++) {
        const lesson = lessonMap[`${d}_${p}`];
        if (lesson) {
          tableRows += `<td class="has-lesson">
            <strong>${escHtml(lesson.subject)}</strong>
            ${lesson.teacher_name ? `<br><small>${escHtml(lesson.teacher_name)}</small>` : ''}
            ${lesson.notes ? `<br><em class="notes">${escHtml(lesson.notes)}</em>` : ''}
          </td>`;
        } else {
          tableRows += `<td class="empty"></td>`;
        }
      }
      tableRows += '</tr>';
    }

    const printHtml = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Cronograma — ${resourceName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; color: #000; }
    .header { margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .header h1 { font-size: 16px; }
    .header p { font-size: 11px; color: #555; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #333; color: #fff; padding: 6px 8px; font-size: 10px; text-align: center; }
    td { border: 1px solid #ccc; padding: 5px 7px; vertical-align: top; min-height: 36px; }
    td.period { background: #f0f0f0; font-weight: bold; text-align: center; width: 48px; }
    td.has-lesson { background: #fff; }
    td.empty { background: #fafafa; }
    small { color: #555; font-size: 10px; }
    em.notes { color: #777; font-size: 9px; }
    .footer { margin-top: 12px; font-size: 10px; color: #777; text-align: right; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Cronograma — ${resourceName} (${resourceType})</h1>
    <p>${schoolName} &nbsp;·&nbsp; Impresso em ${new Date().toLocaleDateString('pt-br')}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Per.</th>
        ${WEEKDAYS.map(d => `<th>${d}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">Gerado pelo Aula</div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(printHtml);
    win.document.close();
  }

  // ─── Formulários ────────────────────────────────────────────────────────────
  function openLessonForm(day, period, existing, container) {
    const teacherOptions = state.teachers
      .map(t => `<option value="${t.id}" ${existing?.teacher_id === t.id ? 'selected' : ''}>${escHtml(t.name)}</option>`)
      .join('');

    window.openModal({
      title: existing ? 'Editar Agendamento' : `Agendar — ${WEEKDAYS[day - 1]}, ${period}º período`,
      bodyHtml: `
        <div class="form-row">
          <div class="form-group">
            <label>Disciplina *</label>
            <input type="text" id="f-subject" value="${escHtml(existing?.subject ?? '')}" placeholder="Ex: Aula de Matemática">
          </div>
        </div>
        <div class="form-group">
          <label>Professor</label>
          <select id="f-teacher">
            <option value="">— Sem professor designado —</option>
            ${teacherOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Observações</label>
          <textarea id="f-notes" rows="2" placeholder="Ex: Experimental">${escHtml(existing?.notes ?? '')}</textarea>
        </div>
        ${existing ? `<div style="margin-top:8px">
          <button class="btn btn-danger btn-sm" id="btn-delete-lesson">🗑️ Remover agendamento</button>
        </div>` : ''}
      `,
      confirmLabel: existing ? 'Salvar' : 'Agendar',
      onConfirm: async (overlay, close) => {
        const subject = overlay.querySelector('#f-subject').value.trim();
        if (!subject) { window.showToast('Informe a disciplina.', 'warning'); return; }

        const data = {
          schedule_id: state.defaultScheduleId,
          resource_id: state.selectedResourceId,
          weekday: day,
          period,
          subject,
          teacher_id: Number(overlay.querySelector('#f-teacher').value) || null,
          notes: overlay.querySelector('#f-notes').value.trim(),
        };

        try {
          existing
            ? await window.DB.updateLesson(existing.id, data)
            : await window.DB.createLesson(data);
          close();
          await loadLessons(container);
          window.showToast('Agendamento salvo.', 'success');
        } catch (e) { window.showToast(e.message, 'error'); }
      },
    });

    setTimeout(() => {
      document.querySelector('#btn-delete-lesson')?.addEventListener('click', async () => {
        if (await window.confirmDialog(`Remover agendamento de ${WEEKDAYS[day - 1]}, ${period}º período?`)) {
          try {
            await window.DB.deleteLesson(existing.id);
            document.querySelector('.modal-overlay')?.remove();
            await loadLessons(container);
            window.showToast('Agendamento removido.', 'success');
          } catch (e) { window.showToast(e.message, 'error'); }
        }
      });
    }, 100);
  }

  // ─── Gerenciador de Professores ──────────────────────────────────────────────
  async function openTeachersManager(container) {
    const teachers = state.teachers;

    window.openModal({
      title: '👨‍🏫 Professores',
      bodyHtml: `
        <div style="margin-bottom:16px">
          <button class="btn btn-primary btn-sm" id="btn-add-teacher">+ Novo Professor</button>
        </div>
        <div id="teachers-list">
          ${teachers.length === 0
            ? '<p style="color:var(--color-text-muted)">Nenhum professor cadastrado.</p>'
            : `<div class="table-wrap"><table>
                <thead><tr><th>Nome</th><th>Disciplinas</th><th>E-mail</th><th></th></tr></thead>
                <tbody>
                  ${teachers.map(t => `
                    <tr>
                      <td><strong>${escHtml(t.name)}</strong></td>
                      <td>${escHtml(t.subjects || '—')}</td>
                      <td>${escHtml(t.email || '—')}</td>
                      <td style="display:flex;gap:4px">
                        <button class="btn btn-ghost btn-sm" data-edit="${t.id}">✏️</button>
                        <button class="btn btn-danger btn-sm" data-del="${t.id}">🗑️</button>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table></div>`}
        </div>
      `,
      confirmLabel: 'Fechar',
      confirmClass: 'btn-ghost',
      onConfirm: (_, close) => close(),
    });

    setTimeout(() => {
      document.querySelector('#btn-add-teacher')?.addEventListener('click', () => openTeacherForm(null, container));
      document.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = teachers.find(x => x.id === Number(btn.dataset.edit));
          openTeacherForm(t, container);
        });
      });
      document.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const t = teachers.find(x => x.id === Number(btn.dataset.del));
          if (await window.confirmDialog(`Excluir o professor "${t.name}"?`)) {
            try {
              await window.DB.deleteTeacher(t.id);
              document.querySelector('.modal-overlay')?.remove();
              state.teachers = state.teachers.filter(x => x.id !== t.id);
              window.showToast('Professor excluído.', 'success');
            } catch (e) { window.showToast(e.message, 'error'); }
          }
        });
      });
    }, 100);
  }

  function openTeacherForm(existing, container) {
    document.querySelector('.modal-overlay')?.remove();
    window.openModal({
      title: existing ? 'Editar Professor' : 'Novo Professor',
      bodyHtml: `
        <div class="form-group">
          <label>Nome *</label>
          <input type="text" id="f-tname" value="${escHtml(existing?.name ?? '')}" placeholder="Nome completo">
        </div>
        <div class="form-group">
          <label>Disciplinas</label>
          <input type="text" id="f-subjects" value="${escHtml(existing?.subjects ?? '')}" placeholder="Ex: Matemática, Física">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>E-mail</label>
            <input type="email" id="f-email" value="${escHtml(existing?.email ?? '')}" placeholder="professor@escola.edu.br">
          </div>
          <div class="form-group">
            <label>Matrícula</label>
            <input type="text" id="f-reg" value="${escHtml(existing?.registration ?? '')}" placeholder="Matrícula">
          </div>
        </div>
      `,
      onConfirm: async (overlay, close) => {
        const name = overlay.querySelector('#f-tname').value.trim();
        if (!name) { window.showToast('Informe o nome do professor.', 'warning'); return; }
        const data = {
          school_id:    window.AppContext.schoolId,
          name,
          subjects:     overlay.querySelector('#f-subjects').value.trim(),
          email:        overlay.querySelector('#f-email').value.trim(),
          registration: overlay.querySelector('#f-reg').value.trim(),
        };
        try {
          existing
            ? await window.DB.updateTeacher(existing.id, data)
            : await window.DB.createTeacher(data);
          close();
          state.teachers = await window.DB.getTeachers(window.AppContext.schoolId).catch(() => []);
          window.showToast('Professor salvo.', 'success');
        } catch (e) { window.showToast(e.message, 'error'); }
      },
    });
  }

  // ─── Gerenciador de Recursos ────────────────────────────────────────────────
  async function openResourcesManager(container) {
    const resources = state.resources;

    window.openModal({
      title: '🏛️ Recursos',
      bodyHtml: `
        <div style="margin-bottom:16px">
          <button class="btn btn-primary btn-sm" id="btn-add-resource">+ Novo Recurso</button>
        </div>
        <div id="resources-list">
          ${resources.length === 0
            ? '<p style="color:var(--color-text-muted)">Nenhum recurso cadastrado.</p>'
            : `<div class="table-wrap"><table>
                <thead><tr><th>Nome</th><th>Tipo</th><th>Capacidade</th><th>Descrição</th><th></th></tr></thead>
                <tbody>
                  ${resources.map(r => `
                    <tr>
                      <td><strong>${escHtml(r.name)}</strong></td>
                      <td>${escHtml(r.type)}</td>
                      <td style="text-align:center">${r.capacity || '—'}</td>
                      <td style="font-size:12px;color:var(--color-text-muted)">${escHtml(r.description || '')}</td>
                      <td style="display:flex;gap:4px;white-space:nowrap">
                        <button class="btn btn-ghost btn-sm" data-edit="${r.id}">✏️</button>
                        <button class="btn btn-danger btn-sm" data-del="${r.id}">🗑️</button>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table></div>`}
        </div>
      `,
      confirmLabel: 'Fechar',
      confirmClass: 'btn-ghost',
      onConfirm: (_, close) => close(),
    });

    setTimeout(() => {
      document.querySelector('#btn-add-resource')?.addEventListener('click', () => openResourceForm(null, container));
      document.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const resource = resources.find(r => r.id === Number(btn.dataset.edit));
          openResourceForm(resource, container);
        });
      });
      document.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const resource = resources.find(r => r.id === Number(btn.dataset.del));
          if (await window.confirmDialog(`Excluir o recurso "${resource.name}" e todos seus agendamentos?`)) {
            try {
              await window.DB.deleteResource(resource.id);
              document.querySelector('.modal-overlay')?.remove();
              await loadResources(container);
              window.showToast('Recurso excluído.', 'success');
            } catch (e) { window.showToast(e.message, 'error'); }
          }
        });
      });
    }, 100);
  }

  function openResourceForm(existing, container) {
    document.querySelector('.modal-overlay')?.remove();
    window.openModal({
      title: existing ? 'Editar Recurso' : 'Novo Recurso',
      bodyHtml: `
        <div class="form-group">
          <label>Nome *</label>
          <input type="text" id="f-name" value="${escHtml(existing?.name ?? '')}" placeholder="Ex: Sala 101, Laboratório de Informática">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Tipo *</label>
            <select id="f-type">
              <option value="">— Selecione —</option>
              ${RESOURCE_TYPES.map(t => `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Capacidade</label>
            <input type="number" id="f-capacity" value="${existing?.capacity ?? ''}" min="1" placeholder="Quantas pessoas">
          </div>
        </div>
        <div class="form-group">
          <label>Descrição</label>
          <textarea id="f-description" rows="2" placeholder="Ex: Equipado com projetor e quadro branco">${escHtml(existing?.description ?? '')}</textarea>
        </div>
      `,
      onConfirm: async (overlay, close) => {
        const name = overlay.querySelector('#f-name').value.trim();
        const type = overlay.querySelector('#f-type').value.trim();
        if (!name || !type) { window.showToast('Informe nome e tipo.', 'warning'); return; }
        const data = {
          name,
          type,
          capacity: Number(overlay.querySelector('#f-capacity').value) || null,
          description: overlay.querySelector('#f-description').value.trim(),
        };
        try {
          existing
            ? await window.DB.updateResource(existing.id, data)
            : await window.DB.createResource({ ...data, school_id: window.AppContext.schoolId });
          close();
          await loadResources(container);
          window.showToast('Recurso salvo.', 'success');
        } catch (e) { window.showToast(e.message, 'error'); }
      },
    });
  }

  // ─── Gestão de Dados da Escola ──────────────────────────────────────────────
  async function openDataManagement(container) {
    const schoolId = window.AppContext.schoolId;

    // Carrega dados iniciais
    let shifts = [], classes = [], curricula = [], timeSlots = [], classCurricula = [];
    try {
      [shifts, classes, curricula] = await Promise.all([
        window.DB.getShifts(schoolId),
        window.DB.getClasses(schoolId),
        window.DB.getCurricula(schoolId),
      ]);
    } catch (e) {
      window.showToast('Erro ao carregar dados: ' + e.message, 'error');
      return;
    }

    window.openModal({
      title: '📊 Gestão de Dados da Escola',
      bodyHtml: `
        <div class="data-management">
          <div class="tabs">
            <button class="tab-btn active" data-tab="shifts">📅 Turnos</button>
            <button class="tab-btn" data-tab="classes">👥 Turmas</button>
            <button class="tab-btn" data-tab="curricula">📖 Componentes</button>
            <button class="tab-btn" data-tab="timeslots">⏰ Horários</button>
            <button class="tab-btn" data-tab="grades">📝 Grades</button>
          </div>

          <div id="tab-shifts" class="tab-content active">
            <div style="margin-bottom:12px;">
              <button class="btn btn-primary btn-sm" id="btn-add-shift">+ Novo Turno</button>
            </div>
            <div id="shifts-list"></div>
          </div>

          <div id="tab-classes" class="tab-content">
            <div style="margin-bottom:12px;">
              <button class="btn btn-primary btn-sm" id="btn-add-class">+ Nova Turma</button>
            </div>
            <div id="classes-list"></div>
          </div>

          <div id="tab-curricula" class="tab-content">
            <div style="margin-bottom:12px;">
              <button class="btn btn-primary btn-sm" id="btn-add-curricula">+ Novo Componente</button>
            </div>
            <div id="curricula-list"></div>
          </div>

          <div id="tab-timeslots" class="tab-content">
            <div style="margin-bottom:12px;">
              <label>Selecione um turno:</label>
              <select id="timeslot-shift-select" style="margin-left:8px;padding:4px">
                <option value="">— Selecione —</option>
              </select>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-add-timeslot">+ Nova Aula</button>
            <div id="timeslots-list" style="margin-top:12px;"></div>
          </div>

          <div id="tab-grades" class="tab-content">
            <div style="margin-bottom:12px;">
              <label>Selecione uma turma:</label>
              <select id="grade-class-select" style="margin-left:8px;padding:4px">
                <option value="">— Selecione —</option>
              </select>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-add-grade" disabled>+ Adicionar Componente</button>
            <div id="grades-list" style="margin-top:12px;"></div>
          </div>
        </div>
      `,
      confirmLabel: 'Fechar',
      confirmClass: 'btn-ghost',
      size: 'large',
      onConfirm: (_, close) => close(),
    });

    // Renderiza listas iniciais
    renderShiftsList(shifts);
    renderClassesList(classes, shifts);
    renderCurriculaList(curricula);
    populateSelectsInModal(shifts, classes);

    // Tabs switching
    setTimeout(() => {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          document.querySelector('#tab-' + btn.dataset.tab).classList.add('active');
        });
      });

      // Shift buttons
      document.querySelector('#btn-add-shift')?.addEventListener('click', () => openShiftForm(null, schoolId, shifts));
      document.querySelectorAll('[data-edit-shift]').forEach(btn => {
        btn.addEventListener('click', () => {
          const shift = shifts.find(s => s.id === Number(btn.dataset.editShift));
          openShiftForm(shift, schoolId, shifts);
        });
      });
      document.querySelectorAll('[data-del-shift]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const shift = shifts.find(s => s.id === Number(btn.dataset.delShift));
          if (await window.confirmDialog(`Excluir turno "${shift.name}"?`)) {
            try {
              await window.DB.deleteShift(shift.id);
              shifts = shifts.filter(s => s.id !== shift.id);
              renderShiftsList(shifts);
              populateSelectsInModal(shifts, classes);
              window.showToast('Turno excluído.', 'success');
            } catch (e) { window.showToast(e.message, 'error'); }
          }
        });
      });

      // Class buttons
      document.querySelector('#btn-add-class')?.addEventListener('click', () => openClassForm(null, schoolId, shifts, classes));
      document.querySelectorAll('[data-edit-class]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cls = classes.find(c => c.id === Number(btn.dataset.editClass));
          openClassForm(cls, schoolId, shifts, classes);
        });
      });
      document.querySelectorAll('[data-del-class]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const cls = classes.find(c => c.id === Number(btn.dataset.delClass));
          if (await window.confirmDialog(`Excluir turma "${cls.name}"?`)) {
            try {
              await window.DB.deleteClass(cls.id);
              classes = classes.filter(c => c.id !== cls.id);
              renderClassesList(classes, shifts);
              populateSelectsInModal(shifts, classes);
              window.showToast('Turma excluída.', 'success');
            } catch (e) { window.showToast(e.message, 'error'); }
          }
        });
      });

      // Curricula buttons
      document.querySelector('#btn-add-curricula')?.addEventListener('click', () => openCurriculaForm(null, schoolId, curricula));
      document.querySelectorAll('[data-edit-curricula]').forEach(btn => {
        btn.addEventListener('click', () => {
          const curr = curricula.find(c => c.id === Number(btn.dataset.editCurricula));
          openCurriculaForm(curr, schoolId, curricula);
        });
      });
      document.querySelectorAll('[data-del-curricula]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const curr = curricula.find(c => c.id === Number(btn.dataset.delCurricula));
          if (await window.confirmDialog(`Excluir componente "${curr.name}"?`)) {
            try {
              await window.DB.deleteCurricula(curr.id);
              curricula = curricula.filter(c => c.id !== curr.id);
              renderCurriculaList(curricula);
              window.showToast('Componente excluído.', 'success');
            } catch (e) { window.showToast(e.message, 'error'); }
          }
        });
      });

      // TimeSlot handlers
      document.querySelector('#timeslot-shift-select')?.addEventListener('change', async e => {
        const shiftId = Number(e.target.value);
        if (shiftId) {
          try {
            const slots = await window.DB.getTimeSlots(shiftId);
            renderTimeSlotsList(slots, shifts, shiftId);
          } catch { renderTimeSlotsList([], shifts, shiftId); }
        } else {
          document.querySelector('#timeslots-list').innerHTML = '';
        }
      });

      document.querySelector('#btn-add-timeslot')?.addEventListener('click', () => {
        const shiftId = Number(document.querySelector('#timeslot-shift-select').value);
        if (!shiftId) {
          window.showToast('Selecione um turno primeiro.', 'warning');
          return;
        }
        const shift = shifts.find(s => s.id === shiftId);
        openTimeSlotForm(null, shift, shiftId);
      });

      // Grade handlers
      document.querySelector('#grade-class-select')?.addEventListener('change', async e => {
        const classId = Number(e.target.value);
        document.querySelector('#btn-add-grade').disabled = !classId;
        if (classId) {
          try {
            const gradeItems = await window.DB.getClassCurricula(classId);
            renderGradesList(gradeItems, classes, classId, curricula);
          } catch { renderGradesList([], classes, classId, curricula); }
        } else {
          document.querySelector('#grades-list').innerHTML = '';
        }
      });

      document.querySelector('#btn-add-grade')?.addEventListener('click', () => {
        const classId = Number(document.querySelector('#grade-class-select').value);
        if (!classId) {
          window.showToast('Selecione uma turma primeiro.', 'warning');
          return;
        }
        openGradeForm(null, classId, curricula);
      });
    }, 100);
  }

  function renderShiftsList(shifts) {
    const html = shifts.length === 0
      ? '<p style="color:var(--color-text-muted)">Nenhum turno cadastrado.</p>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th></th></tr></thead>
          <tbody>${shifts.map(s => `
            <tr>
              <td><strong>${escHtml(s.name)}</strong></td>
              <td style="display:flex;gap:4px;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-edit-shift="${s.id}">✏️</button>
                <button class="btn btn-danger btn-sm" data-del-shift="${s.id}">🗑️</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>`;
    document.querySelector('#shifts-list').innerHTML = html;
  }

  function renderClassesList(classes, shifts) {
    const html = classes.length === 0
      ? '<p style="color:var(--color-text-muted)">Nenhuma turma cadastrada.</p>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th>Turno</th><th>Ano</th><th></th></tr></thead>
          <tbody>${classes.map(c => {
            const shift = shifts.find(s => s.id === c.shift_id);
            return `<tr>
              <td><strong>${escHtml(c.name)}</strong></td>
              <td>${shift ? escHtml(shift.name) : '—'}</td>
              <td>${c.year || '—'}</td>
              <td style="display:flex;gap:4px;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-edit-class="${c.id}">✏️</button>
                <button class="btn btn-danger btn-sm" data-del-class="${c.id}">🗑️</button>
              </td>
            </tr>`;
          }).join('')}
          </tbody>
        </table></div>`;
    document.querySelector('#classes-list').innerHTML = html;
  }

  function renderCurriculaList(curricula) {
    const html = curricula.length === 0
      ? '<p style="color:var(--color-text-muted)">Nenhum componente cadastrado.</p>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th>Código</th><th>Descrição</th><th></th></tr></thead>
          <tbody>${curricula.map(c => `
            <tr>
              <td><strong>${escHtml(c.name)}</strong></td>
              <td>${escHtml(c.code || '—')}</td>
              <td style="font-size:12px;color:var(--color-text-muted)">${escHtml(c.description || '')}</td>
              <td style="display:flex;gap:4px;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-edit-curricula="${c.id}">✏️</button>
                <button class="btn btn-danger btn-sm" data-del-curricula="${c.id}">🗑️</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>`;
    document.querySelector('#curricula-list').innerHTML = html;
  }

  function renderTimeSlotsList(slots, shifts, shiftId) {
    const html = slots.length === 0
      ? '<p style="color:var(--color-text-muted)">Nenhum horário cadastrado.</p>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Período</th><th>Início</th><th>Fim</th><th></th></tr></thead>
          <tbody>${slots.map(ts => `
            <tr>
              <td><strong>${ts.period}º</strong></td>
              <td>${escHtml(ts.start_time)}</td>
              <td>${escHtml(ts.end_time)}</td>
              <td style="display:flex;gap:4px;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-edit-timeslot="${ts.id}">✏️</button>
                <button class="btn btn-danger btn-sm" data-del-timeslot="${ts.id}">🗑️</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>`;
    document.querySelector('#timeslots-list').innerHTML = html;

    // Attach timeslot handlers
    setTimeout(() => {
      document.querySelectorAll('[data-edit-timeslot]').forEach(btn => {
        btn.addEventListener('click', () => {
          const ts = slots.find(t => t.id === Number(btn.dataset.editTimeslot));
          const shift = shifts.find(s => s.id === shiftId);
          openTimeSlotForm(ts, shift, shiftId);
        });
      });
      document.querySelectorAll('[data-del-timeslot]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ts = slots.find(t => t.id === Number(btn.dataset.delTimeslot));
          if (await window.confirmDialog(`Excluir horário (período ${ts.period}º)?`)) {
            try {
              await window.DB.deleteTimeSlot(ts.id);
              const updatedSlots = slots.filter(t => t.id !== ts.id);
              renderTimeSlotsList(updatedSlots, shifts, shiftId);
              window.showToast('Horário excluído.', 'success');
            } catch (e) { window.showToast(e.message, 'error'); }
          }
        });
      });
    }, 50);
  }

  function renderGradesList(gradeItems, classes, classId, curricula) {
    const cls = classes.find(c => c.id === classId);
    const html = gradeItems.length === 0
      ? '<p style="color:var(--color-text-muted)">Nenhum componente associado a esta turma.</p>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Componente</th><th></th></tr></thead>
          <tbody>${gradeItems.map(g => {
            const curr = curricula.find(c => c.id === g.curricula_id);
            return `<tr>
              <td><strong>${curr ? escHtml(curr.name) : '—'}</strong></td>
              <td style="display:flex;gap:4px;white-space:nowrap">
                <button class="btn btn-danger btn-sm" data-del-grade="${g.id}">🗑️</button>
              </td>
            </tr>`;
          }).join('')}
          </tbody>
        </table></div>`;
    document.querySelector('#grades-list').innerHTML = html;

    // Attach grade delete handlers
    setTimeout(() => {
      document.querySelectorAll('[data-del-grade]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const gradeId = Number(btn.dataset.delGrade);
          if (await window.confirmDialog('Remover este componente da turma?')) {
            try {
              await window.DB.deleteClassCurricula(gradeId);
              const updated = gradeItems.filter(g => g.id !== gradeId);
              renderGradesList(updated, classes, classId, curricula);
              window.showToast('Componente removido.', 'success');
            } catch (e) { window.showToast(e.message, 'error'); }
          }
        });
      });
    }, 50);
  }

  function populateSelectsInModal(shifts, classes) {
    const shiftSelect = document.querySelector('#timeslot-shift-select');
    const classSelect = document.querySelector('#grade-class-select');
    
    if (shiftSelect) {
      shiftSelect.innerHTML = '<option value="">— Selecione —</option>' +
        shifts.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
    }
    if (classSelect) {
      classSelect.innerHTML = '<option value="">— Selecione —</option>' +
        classes.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    }
  }

  function openShiftForm(existing, schoolId, shifts) {
    document.querySelector('.modal-overlay')?.remove();
    window.openModal({
      title: existing ? 'Editar Turno' : 'Novo Turno',
      bodyHtml: `
        <div class="form-group">
          <label>Nome do Turno *</label>
          <input type="text" id="f-shift-name" value="${escHtml(existing?.name ?? '')}" placeholder="Ex: Manhã, Tarde, Noite">
        </div>
      `,
      onConfirm: async (overlay, close) => {
        const name = overlay.querySelector('#f-shift-name').value.trim();
        if (!name) { window.showToast('Informe o nome do turno.', 'warning'); return; }
        const data = { name, school_id: schoolId };
        try {
          existing
            ? await window.DB.updateShift(existing.id, data)
            : await window.DB.createShift(data);
          close();
          const updatedShifts = await window.DB.getShifts(schoolId);
          renderShiftsList(updatedShifts);
          populateSelectsInModal(updatedShifts, (data.classes || []));
          window.showToast('Turno salvo.', 'success');
        } catch (e) { window.showToast(e.message, 'error'); }
      },
    });
  }

  function openClassForm(existing, schoolId, shifts, classes) {
    document.querySelector('.modal-overlay')?.remove();
    window.openModal({
      title: existing ? 'Editar Turma' : 'Nova Turma',
      bodyHtml: `
        <div class="form-group">
          <label>Nome da Turma *</label>
          <input type="text" id="f-class-name" value="${escHtml(existing?.name ?? '')}" placeholder="Ex: 1º A, 2º B">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Turno *</label>
            <select id="f-class-shift">
              <option value="">— Selecione —</option>
              ${shifts.map(s => `<option value="${s.id}" ${existing?.shift_id === s.id ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Ano</label>
            <input type="number" id="f-class-year" value="${existing?.year ?? ''}" min="1" max="12" placeholder="Ex: 1">
          </div>
        </div>
      `,
      onConfirm: async (overlay, close) => {
        const name = overlay.querySelector('#f-class-name').value.trim();
        const shiftId = Number(overlay.querySelector('#f-class-shift').value);
        if (!name || !shiftId) { window.showToast('Informe nome e turno.', 'warning'); return; }
        const data = { name, shift_id: shiftId, year: Number(overlay.querySelector('#f-class-year').value) || null, school_id: schoolId };
        try {
          existing
            ? await window.DB.updateClass(existing.id, data)
            : await window.DB.createClass(data);
          close();
          const updatedClasses = await window.DB.getClasses(schoolId);
          renderClassesList(updatedClasses, shifts);
          populateSelectsInModal(shifts, updatedClasses);
          window.showToast('Turma salva.', 'success');
        } catch (e) { window.showToast(e.message, 'error'); }
      },
    });
  }

  function openCurriculaForm(existing, schoolId, curricula) {
    document.querySelector('.modal-overlay')?.remove();
    window.openModal({
      title: existing ? 'Editar Componente' : 'Novo Componente',
      bodyHtml: `
        <div class="form-group">
          <label>Nome do Componente *</label>
          <input type="text" id="f-curr-name" value="${escHtml(existing?.name ?? '')}" placeholder="Ex: Matemática, Português">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Código</label>
            <input type="text" id="f-curr-code" value="${escHtml(existing?.code ?? '')}" placeholder="Ex: MAT01">
          </div>
        </div>
        <div class="form-group">
          <label>Descrição</label>
          <textarea id="f-curr-desc" rows="2" placeholder="Descrição opcional">${escHtml(existing?.description ?? '')}</textarea>
        </div>
      `,
      onConfirm: async (overlay, close) => {
        const name = overlay.querySelector('#f-curr-name').value.trim();
        if (!name) { window.showToast('Informe o nome do componente.', 'warning'); return; }
        const data = {
          name,
          code: overlay.querySelector('#f-curr-code').value.trim(),
          description: overlay.querySelector('#f-curr-desc').value.trim(),
          school_id: schoolId,
        };
        try {
          existing
            ? await window.DB.updateCurricula(existing.id, data)
            : await window.DB.createCurricula(data);
          close();
          const updatedCurricula = await window.DB.getCurricula(schoolId);
          renderCurriculaList(updatedCurricula);
          window.showToast('Componente salvo.', 'success');
        } catch (e) { window.showToast(e.message, 'error'); }
      },
    });
  }

  function openTimeSlotForm(existing, shift, shiftId) {
    document.querySelector('.modal-overlay')?.remove();
    window.openModal({
      title: existing ? 'Editar Horário' : 'Novo Horário',
      bodyHtml: `
        <div style="margin-bottom:12px;padding:8px;background:var(--color-bg-secondary);border-radius:4px">
          <strong>Turno:</strong> ${escHtml(shift?.name ?? '')}
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Período *</label>
            <input type="number" id="f-ts-period" value="${existing?.period ?? ''}" min="1" max="20" placeholder="1, 2, 3...">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Horário de Início *</label>
            <input type="time" id="f-ts-start" value="${existing?.start_time ?? ''}">
          </div>
          <div class="form-group">
            <label>Horário de Fim *</label>
            <input type="time" id="f-ts-end" value="${existing?.end_time ?? ''}">
          </div>
        </div>
      `,
      onConfirm: async (overlay, close) => {
        const period = Number(overlay.querySelector('#f-ts-period').value);
        const startTime = overlay.querySelector('#f-ts-start').value.trim();
        const endTime = overlay.querySelector('#f-ts-end').value.trim();
        if (!period || !startTime || !endTime) { window.showToast('Informe período e horários.', 'warning'); return; }
        const data = { shift_id: shiftId, period, start_time: startTime, end_time: endTime };
        try {
          existing
            ? await window.DB.updateTimeSlot(existing.id, data)
            : await window.DB.createTimeSlot(data);
          close();
          const updatedSlots = await window.DB.getTimeSlots(shiftId);
          renderTimeSlotsList(updatedSlots, [shift], shiftId);
          window.showToast('Horário salvo.', 'success');
        } catch (e) { window.showToast(e.message, 'error'); }
      },
    });
  }

  function openGradeForm(existing, classId, curricula) {
    document.querySelector('.modal-overlay')?.remove();
    window.openModal({
      title: 'Adicionar Componente à Turma',
      bodyHtml: `
        <div class="form-group">
          <label>Componente *</label>
          <select id="f-grade-curricula">
            <option value="">— Selecione —</option>
            ${curricula.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      `,
      confirmLabel: 'Adicionar',
      onConfirm: async (overlay, close) => {
        const curriculaId = Number(overlay.querySelector('#f-grade-curricula').value);
        if (!curriculaId) { window.showToast('Selecione um componente.', 'warning'); return; }
        const data = { class_id: classId, curricula_id: curriculaId };
        try {
          await window.DB.createClassCurricula(data);
          close();
          const gradeItems = await window.DB.getClassCurricula(classId);
          renderGradesList(gradeItems, [], classId, curricula);
          window.showToast('Componente adicionado à turma.', 'success');
        } catch (e) { window.showToast(e.message, 'error'); }
      },
    });
  }

  // ─── Utilitário ─────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { mount };
})();

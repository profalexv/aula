/**
 * Módulo de Gestão de Usuários
 * Permite admins gerenciar outros admins e professores
 */

const UserManagementModule = (() => {
  let currentSchool = null;

  function render() {
    return `
      <div class="gestao-usuarios">
        <div class="page-header">
          <h1>Gestão de Usuários</h1>
          <p class="subtitle">Gerencie administradores e professores</p>
        </div>

        <div class="tabs-section">
          <button class="tab-btn active" data-tab="admins">👨‍💼 Administradores</button>
          <button class="tab-btn" data-tab="teachers">👨‍🏫 Professores</button>
        </div>

        <!-- Aba: Admins -->
        <div id="tab-admins" class="tab-content active">
          <div class="section-header">
            <h2>Administradores</h2>
            <button class="btn btn-primary" id="btn-new-admin">+ Novo Administrador</button>
          </div>

          <div id="admins-list" class="users-list loading">
            <div class="loading-spinner">Carregando...</div>
          </div>

          <!-- Modal: Novo Admin -->
          <div id="modal-new-admin" class="u-modal hidden">
            <div class="u-modal-bg"></div>
            <div class="u-modal-content">
              <div class="u-modal-header">
                <h2>Novo Administrador</h2>
                <button class="u-modal-close">&times;</button>
              </div>
              <form id="form-new-admin" class="form">
                <div class="form-group">
                  <label>Nome Completo</label>
                  <input type="text" name="name" required placeholder="Nome do administrador">
                </div>
                <div class="form-group">
                  <label>Nome de Usuário</label>
                  <input type="text" name="username" required placeholder="Username">
                </div>
                <div class="form-group">
                  <label>Senha</label>
                  <input type="password" name="password" required placeholder="Senha segura">
                </div>
                <div class="u-modal-actions">
                  <button type="button" class="btn btn-secondary" id="btn-cancel-admin">Cancelar</button>
                  <button type="submit" class="btn btn-primary">Criar Admin</button>
                </div>
                <div class="form-error"></div>
              </form>
            </div>
          </div>
        </div>

        <!-- Aba: Professores -->
        <div id="tab-teachers" class="tab-content">
          <div class="section-header">
            <h2>Professores</h2>
            <button class="btn btn-primary" id="btn-new-teacher">+ Novo Professor</button>
          </div>

          <div id="teachers-list" class="users-list loading">
            <div class="loading-spinner">Carregando...</div>
          </div>

          <!-- Modal: Novo Professor -->
          <div id="modal-new-teacher" class="u-modal hidden">
            <div class="u-modal-bg"></div>
            <div class="u-modal-content">
              <div class="u-modal-header">
                <h2>Novo Professor</h2>
                <button class="u-modal-close">&times;</button>
              </div>
              <form id="form-new-teacher" class="form">
                <div class="form-group">
                  <label>Nome Completo</label>
                  <input type="text" name="name" required placeholder="Nome do professor">
                </div>
                <div class="form-group">
                  <label>Matrícula (Opcional)</label>
                  <input type="text" name="registration" placeholder="Número de matrícula">
                </div>
                <div class="form-group">
                  <label>E-mail (Opcional)</label>
                  <input type="email" name="email" placeholder="Email do professor">
                </div>
                <div class="form-group">
                  <label>Disciplinas (Opcional)</label>
                  <input type="text" name="subjects" placeholder="Ex: Matemática, Português">
                </div>
                <div class="u-modal-actions">
                  <button type="button" class="btn btn-secondary" id="btn-cancel-teacher">Cancelar</button>
                  <button type="submit" class="btn btn-primary">Criar Professor</button>
                </div>
                <div class="form-error"></div>
              </form>
            </div>
          </div>

          <!-- Modal: Promover Professor -->
          <div id="modal-promote-teacher" class="u-modal hidden">
            <div class="u-modal-bg"></div>
            <div class="u-modal-content">
              <div class="u-modal-header">
                <h2>Promover Professor a Administrador</h2>
                <button class="u-modal-close">&times;</button>
              </div>
              <form id="form-promote-teacher" class="form">
                <p id="promote-teacher-name"></p>
                <div class="form-group">
                  <label>Senha para o novo admin</label>
                  <input type="password" id="promote-teacher-password" required placeholder="Senha segura">
                </div>
                <div class="u-modal-actions">
                  <button type="button" class="btn btn-secondary" id="btn-cancel-promote">Cancelar</button>
                  <button type="submit" class="btn btn-success">Promover</button>
                </div>
                <div class="form-error"></div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function loadAdmins() {
    try {
      const result = await window.scholar.getAdmins(currentSchool);
      if (!result.success) throw new Error(result.error);

      const list = document.getElementById('admins-list');
      list.classList.remove('loading');

      if (!result.data || result.data.length === 0) {
        list.innerHTML = '<p class="empty-state">Nenhum administrador cadastrado</p>';
        return;
      }

      list.innerHTML = result.data.map(admin => `
        <div class="user-card ${admin.active ? 'active' : 'inactive'}">
          <div class="user-info">
            <h3>${admin.name}</h3>
            <p class="username">@${admin.username}</p>
            <p class="created">Criado em: ${formatDate(admin.created_at)}</p>
          </div>
          <div class="user-actions">
            ${admin.active ? `
              <button class="btn btn-small btn-danger" data-action="deactivate-admin" data-id="${admin.id}">
                Desativar
              </button>
            ` : `
              <button class="btn btn-small btn-success" data-action="activate-admin" data-id="${admin.id}">
                Reativar
              </button>
            `}
          </div>
          <div class="user-status">
            ${admin.active ? '<span class="badge badge-active">Ativo</span>' : '<span class="badge badge-inactive">Inativo</span>'}
          </div>
        </div>
      `).join('');
    } catch (e) {
      document.getElementById('admins-list').innerHTML = `<p class="error">Erro ao carregar: ${e.message}</p>`;
    }
  }

  async function loadTeachers() {
    try {
      const result = await window.scholar.getTeachers(currentSchool);
      if (!result.success) throw new Error(result.error);

      const list = document.getElementById('teachers-list');
      list.classList.remove('loading');

      if (!result.data || result.data.length === 0) {
        list.innerHTML = '<p class="empty-state">Nenhum professor cadastrado</p>';
        return;
      }

      list.innerHTML = result.data.map(teacher => `
        <div class="user-card ${teacher.active ? 'active' : 'inactive'}">
          <div class="user-info">
            <h3>${teacher.name}</h3>
            ${teacher.registration ? `<p class="username">Matrícula: ${teacher.registration}</p>` : ''}
            ${teacher.email ? `<p class="email">📧 ${teacher.email}</p>` : ''}
            ${teacher.subjects ? `<p class="subjects">Disciplinas: ${teacher.subjects}</p>` : ''}
            <p class="created">Criado em: ${formatDate(teacher.created_at)}</p>
          </div>
          <div class="user-actions">
            <button class="btn btn-small btn-info" data-action="promote-teacher" data-id="${teacher.id}" data-name="${teacher.name}">
              ⬆️ Promover
            </button>
            ${teacher.active ? `
              <button class="btn btn-small btn-danger" data-action="deactivate-teacher" data-id="${teacher.id}">
                Desativar
              </button>
            ` : `
              <button class="btn btn-small btn-success" data-action="activate-teacher" data-id="${teacher.id}">
                Reativar
              </button>
            `}
          </div>
          <div class="user-status">
            ${teacher.active ? '<span class="badge badge-active">Ativo</span>' : '<span class="badge badge-inactive">Inativo</span>'}
          </div>
        </div>
      `).join('');
    } catch (e) {
      document.getElementById('teachers-list').innerHTML = `<p class="error">Erro ao carregar: ${e.message}</p>`;
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
  }

  function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
  }

  function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }

  function setupEventListeners() {
    // Abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
      });
    });

    // Novo Admin
    document.getElementById('btn-new-admin')?.addEventListener('click', () => showModal('modal-new-admin'));
    document.getElementById('btn-cancel-admin')?.addEventListener('click', () => hideModal('modal-new-admin'));
    document.getElementById('form-new-admin')?.addEventListener('submit', handleCreateAdmin);

    // Novo Professor
    document.getElementById('btn-new-teacher')?.addEventListener('click', () => showModal('modal-new-teacher'));
    document.getElementById('btn-cancel-teacher')?.addEventListener('click', () => hideModal('modal-new-teacher'));
    document.getElementById('form-new-teacher')?.addEventListener('submit', handleCreateTeacher);

    // Promover Professor
    document.getElementById('btn-cancel-promote')?.addEventListener('click', () => hideModal('modal-promote-teacher'));
    document.getElementById('form-promote-teacher')?.addEventListener('submit', handlePromoteTeacher);

    // Fechar modais ao clicar no overlay
    document.querySelectorAll('.u-modal-bg').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        e.target.parentElement.classList.add('hidden');
      });
    });

    // Fechar modais ao clicar no X
    document.querySelectorAll('.u-modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.u-modal').classList.add('hidden');
      });
    });

    // Ações de usuários (delegado)
    document.getElementById('admins-list')?.addEventListener('click', handleAdminAction);
    document.getElementById('teachers-list')?.addEventListener('click', handleTeacherAction);
  }

  async function handleCreateAdmin(e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);

    try {
      const result = await window.scholar.createAdmin({
        school_id: currentSchool,
        name: data.get('name'),
        username: data.get('username'),
        password: data.get('password')
      });

      if (!result.success) throw new Error(result.error);

      window.showToast('Admin criado com sucesso', 'success');
      hideModal('modal-new-admin');
      form.reset();
      await loadAdmins();
    } catch (e) {
      form.querySelector('.form-error').textContent = e.message;
      form.querySelector('.form-error').style.display = 'block';
    }
  }

  async function handleCreateTeacher(e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);

    try {
      const result = await window.scholar.createTeacher({
        school_id: currentSchool,
        name: data.get('name'),
        registration: data.get('registration') || null,
        email: data.get('email') || null,
        subjects: data.get('subjects') || null
      });

      if (!result.success) throw new Error(result.error);

      window.showToast('Professor criado com sucesso', 'success');
      hideModal('modal-new-teacher');
      form.reset();
      await loadTeachers();
    } catch (e) {
      form.querySelector('.form-error').textContent = e.message;
      form.querySelector('.form-error').style.display = 'block';
    }
  }

  async function handlePromoteTeacher(e) {
    e.preventDefault();
    const teacherId = parseInt(document.getElementById('form-promote-teacher').dataset.teacherId);
    const password = document.getElementById('promote-teacher-password').value;

    try {
      const result = await window.AuthManager.prototype.promoteTeacherToAdmin.call(window.__authManager, teacherId, password);
      
      window.showToast(`Professor promovido! Novo usuário: ${result.username}`, 'success');
      hideModal('modal-promote-teacher');
      await loadTeachers();
      await loadAdmins();
    } catch (e) {
      document.querySelector('#form-promote-teacher .form-error').textContent = e.message;
      document.querySelector('#form-promote-teacher .form-error').style.display = 'block';
    }
  }

  async function handleAdminAction(e) {
    if (e.target.dataset.action === 'deactivate-admin') {
      const adminId = parseInt(e.target.dataset.id);
      if (confirm('Tem certeza? Este é um admin ativo.')) {
        try {
          await window.__authManager.deactivateAdmin(adminId);
          window.showToast('Admin desativado', 'success');
          await loadAdmins();
        } catch (e) {
          window.showToast(e.message, 'error');
        }
      }
    } else if (e.target.dataset.action === 'activate-admin') {
      const adminId = parseInt(e.target.dataset.id);
      try {
        await window.__authManager.activateAdmin(adminId);
        window.showToast('Admin reativado', 'success');
        await loadAdmins();
      } catch (e) {
        window.showToast(e.message, 'error');
      }
    }
  }

  async function handleTeacherAction(e) {
    if (e.target.dataset.action === 'promote-teacher') {
      const teacherId = parseInt(e.target.dataset.id);
      const teacherName = e.target.dataset.name;
      document.getElementById('form-promote-teacher').dataset.teacherId = teacherId;
      document.getElementById('promote-teacher-name').textContent = `Promover ${teacherName} a administrador?`;
      document.getElementById('promote-teacher-password').value = '';
      showModal('modal-promote-teacher');
    } else if (e.target.dataset.action === 'deactivate-teacher') {
      const teacherId = parseInt(e.target.dataset.id);
      if (confirm('Tem certeza que deseja desativar este professor?')) {
        try {
          await window.__authManager.deactivateTeacher(teacherId);
          window.showToast('Professor desativado', 'success');
          await loadTeachers();
        } catch (e) {
          window.showToast(e.message, 'error');
        }
      }
    } else if (e.target.dataset.action === 'activate-teacher') {
      const teacherId = parseInt(e.target.dataset.id);
      try {
        await window.__authManager.activateTeacher(teacherId);
        window.showToast('Professor reativado', 'success');
        await loadTeachers();
      } catch (e) {
        window.showToast(e.message, 'error');
      }
    }
  }

  return {
    name: 'usuarios',
    title: '👥 Usuários',
    icon: '👥',

    async initialize(schoolId) {
      currentSchool = schoolId;
    },

    render,

    async afterRender() {
      await loadAdmins();
      await loadTeachers();
      setupEventListeners();
    },

    async beforeDestroy() {
      // Cleanup se necessário
    }
  };
})();

// Registra o módulo
window.registerModule(UserManagementModule);

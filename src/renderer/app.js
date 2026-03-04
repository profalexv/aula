/**
 * app.js — Script principal do renderer.
 * Gerencia a navegação entre abas, licenças e funções utilitárias globais.
 */

// ─── Mapa de módulos disponíveis ─────────────────────────────────────────────
const MODULES = {
  cronograma: window.ModuleCronograma,
  aula:       window.ModuleAula,
  licencas:   { mount(c) { window.LicenseManager.renderManagementScreen(c); } },
};

let currentTab = 'cronograma';

// ─── Navegação de abas ────────────────────────────────────────────────────────
window._activateTab = function activateTab(name) {
  // Módulos travados redirecionam para ativação
  if (name !== 'licencas' && !window.LicenseManager.isLicensed(name)) {
    window.LicenseManager.openActivationScreen(name);
    return;
  }

  const mod = MODULES[name];
  if (!mod) return;

  currentTab = name;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.module === name);
  });

  const content = document.getElementById('app-content');
  content.innerHTML = '';
  mod.mount(content);
};

// ─── Toast de notificações ────────────────────────────────────────────────────
window.showToast = function(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Anima entrada
  toast.style.animation = 'slideInUp 0.3s ease-out';

  // Remove após duração
  setTimeout(() => {
    toast.style.animation = 'slideOutDown 0.3s ease-out';
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
};

// ─── Modal utilitário ─────────────────────────────────────────────────────────
window.openModal = function({ title, bodyHtml, onConfirm, confirmLabel = 'Salvar', confirmClass = 'btn-primary', size = 'normal' }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${size === 'large' ? 'large' : ''}" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" aria-label="Fechar">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel">Cancelar</button>
        <button class="btn ${confirmClass}" id="modal-confirm">${confirmLabel}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('#modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#modal-confirm').addEventListener('click', () => {
    onConfirm(overlay, close);
  });

  // Foco no primeiro input
  setTimeout(() => {
    const first = overlay.querySelector('input, select, textarea');
    if (first) first.focus();
  }, 50);

  return overlay;
};

window.confirmDialog = function(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" style="max-width:360px">
        <div class="modal-header"><h3>Confirmar</h3></div>
        <div class="modal-body"><p>${message}</p></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="cd-cancel">Cancelar</button>
          <button class="btn btn-danger" id="cd-confirm">Excluir</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#cd-cancel').addEventListener('click',  () => { overlay.remove(); resolve(false); });
    overlay.querySelector('#cd-confirm').addEventListener('click', () => { overlay.remove(); resolve(true);  });
  });
};

// ─── AppContext — escola única ───────────────────────────────────────────────
/**
 * Na versão desktop, o app opera com UMA única escola.
 * AppContext carrega essa escola no boot e a disponibiliza globalmente.
 * Todos os módulos usam window.AppContext.schoolId — sem seletor.
 */
window.AppContext = {
  school: null,
  get schoolId() { return this.school?.id ?? null; },
  get schoolName() { return this.school?.name ?? ''; },

  async load() {
    const schools = await window.DB.getSchools().catch(() => []);
    if (schools.length > 0) {
      this.school = schools[0];
      this._updateHeader();
      return true;
    }
    return false; // primeira execução
  },

  /** Atualiza o nome da escola no cabeçalho do app. */
  _updateHeader() {
    const el = document.querySelector('.app-school-name');
    if (el) el.textContent = this.school?.name ?? '';
  },

  /** Abre o formulário de edição dos dados da escola. */
  openEditor(onSaved) {
    const s = this.school;
    window.openModal({
      title: s ? '⚙️ Dados da Escola' : '🏫 Configurar Escola',
      bodyHtml: `
        <div class="form-group">
          <label>Nome *</label>
          <input type="text" id="f-sname" value="${_esc(s?.name ?? '')}" placeholder="Nome completo da escola">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Sigla</label>
            <input type="text" id="f-acronym" value="${_esc(s?.acronym ?? '')}" placeholder="Ex: EEA">
          </div>
          <div class="form-group">
            <label>INEP</label>
            <input type="text" id="f-inep" value="${_esc(s?.inep_code ?? '')}" placeholder="Código INEP">
          </div>
        </div>
        <div class="form-group">
          <label>Endereço</label>
          <input type="text" id="f-address" value="${_esc(s?.address ?? '')}" placeholder="Rua, número, bairro">
        </div>
        <div class="form-group">
          <label>CNPJ</label>
          <input type="text" id="f-cnpj" value="${_esc(s?.cnpj ?? '')}" placeholder="00.000.000/0000-00">
        </div>
      `,
      confirmLabel: s ? 'Salvar' : 'Criar Escola',
      onConfirm: async (overlay, close) => {
        const name = overlay.querySelector('#f-sname').value.trim();
        if (!name) { window.showToast('Informe o nome da escola.', 'warning'); return; }
        const data = {
          name,
          acronym:   overlay.querySelector('#f-acronym').value.trim(),
          address:   overlay.querySelector('#f-address').value.trim(),
          cnpj:      overlay.querySelector('#f-cnpj').value.trim(),
          inep_code: overlay.querySelector('#f-inep').value.trim(),
        };
        try {
          if (s) {
            await window.DB.updateSchool(s.id, data);
          } else {
            const res = await window.DB.createSchool(data);
            data.id = res.id;
          }
          this.school = { ...this.school, ...data };
          this._updateHeader();
          close();
          window.showToast('Dados da escola salvos.', 'success');
          if (onSaved) onSaved();
        } catch (e) { window.showToast(e.message, 'error'); }
      },
    });
  },
};

/** Escapa HTML — disponível globalmente para os módulos. */
window._esc = function(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Inicializa o data provider (SQLite local via IPC)
  window.DB.init();

  // Carrega licenças e aplica cadeados nas abas
  await window.LicenseManager.load();

  // Registra cliques nas abas
  document.querySelectorAll('.tab-btn[data-module]').forEach(btn => {
    btn.addEventListener('click', () => window._activateTab(btn.dataset.module));
  });

  // Carrega escola única. Se não existir, abre setup de primeira execução.
  const hasSchool = await window.AppContext.load();
  if (!hasSchool) {
    window.AppContext.openEditor(() => {
      window.AppContext.load();
      window._activateTab('cronograma');
    });
    // Renderiza o módulo padrão atrás do modal para contexto visual
    window._activateTab('cronograma');
  } else {
    window._activateTab('cronograma');
  }
});

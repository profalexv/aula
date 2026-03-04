/**
 * license-client.js (renderer)
 * 
 * Lê o status de licenças dos módulos e controla
 * quais abas ficam visíveis/habilitadas na UI.
 */

window.LicenseManager = {
  _status: {},

  /**
   * Carrega o status de licenças e atualiza as abas.
   */
  async load() {
    try {
      const res = await window.scholar.getModulesStatus();
      if (res.success) {
        this._status = res.data;
      } else {
        console.warn('[LicenseManager] Erro ao carregar licenças:', res.error);
        this._status = {};
      }
    } catch (e) {
      console.warn('[LicenseManager] Falha ao contatar IPC:', e.message);
      this._status = {};
    }
    this._applyToTabs();
    return this._status;
  },

  /** Verifica se um módulo está licenciado. */
  isLicensed(moduleId) {
    return this._status[moduleId]?.licensed === true;
  },

  /** Retorna os dados completos de um módulo. */
  getModule(moduleId) {
    return this._status[moduleId] ?? null;
  },

  /**
   * Atualiza visualmente as abas de acordo com as licenças.
   * Módulos sem licença aparecem com um cadeado e ao clicar
   * abrem a tela de ativação.
   */
  _applyToTabs() {
    document.querySelectorAll('.tab-btn[data-module]').forEach(btn => {
      const id = btn.dataset.module;
      const mod = this._status[id];
      const locked = mod && !mod.licensed;

      if (locked) {
        btn.classList.add('tab-locked');
        btn.title = `${mod.name} — Licença não ativada`;
        if (!btn.querySelector('.lock-icon')) {
          const lock = document.createElement('span');
          lock.className = 'lock-icon';
          lock.textContent = '🔒';
          btn.appendChild(lock);
        }
      } else {
        btn.classList.remove('tab-locked');
        btn.title = '';
        btn.querySelector('.lock-icon')?.remove();
      }
    });
  },

  /**
   * Abre a tela de gerenciamento de licenças / ativação de um módulo.
   */
  openActivationScreen(moduleId) {
    const mod = this._status[moduleId];
    if (!mod) return;

    window.openModal({
      title: `Ativar módulo: ${mod.name}`,
      bodyHtml: `
        <p style="color:var(--color-text-muted);margin-bottom:16px">
          ${mod.description}<br><br>
          Insira a chave de licença adquirida para ativar este módulo localmente.
          Chaves no formato <code>AULA-${moduleId.toUpperCase()}-XXXX-XXXX-XXXX</code>.
        </p>
        <div class="form-group">
          <label>Chave de Licença</label>
          <input type="text" id="license-key-input"
            placeholder="AULA-${moduleId.toUpperCase()}-XXXX-XXXX-XXXX"
            style="font-family:monospace;letter-spacing:1px;text-transform:uppercase">
        </div>
        <p style="font-size:12px;color:var(--color-text-muted);margin-top:8px">
          💡 Ainda não tem uma licença?
          <a href="#" onclick="require('electron').shell.openExternal('https://aula.app/pricing')">
            Conheça os planos
          </a>
        </p>
      `,
      confirmLabel: 'Ativar',
      confirmClass: 'btn-primary',
      onConfirm: async (overlay, close) => {
        const key = overlay.querySelector('#license-key-input').value.trim();
        if (!key) { window.showToast('Insira a chave de licença.', 'warning'); return; }

        const btn = overlay.querySelector('#modal-confirm');
        btn.disabled = true;
        btn.textContent = 'Verificando...';

        const res = await window.scholar.activateLicense(moduleId, key);
        if (res.success) {
          window.showToast(`Módulo ${mod.name} ativado com sucesso!`, 'success');
          close();
          await this.load();         // Recarrega status
          window._activateTab(moduleId); // Navega para o módulo
        } else {
          window.showToast(res.error, 'error', 5000);
          btn.disabled = false;
          btn.textContent = 'Ativar';
        }
      },
    });
  },

  /** Tela de gerenciamento completo de licenças. */
  renderManagementScreen(container) {
    const entries = Object.values(this._status);

    container.innerHTML = `
      <div class="module-header">
        <div>
          <div class="module-title">Gerenciamento de Licenças</div>
          <div class="module-subtitle">Ative módulos adquiridos ou conheça os planos disponíveis.</div>
        </div>
      </div>
      <div class="card-grid">
        ${entries.map(mod => `
          <div class="card">
            <div style="font-size:32px;margin-bottom:8px">${mod.icon}</div>
            <div class="card-title">${mod.name}</div>
            <div class="card-meta" style="margin-bottom:12px">${mod.description}</div>
            ${mod.licensed
              ? `<span class="badge badge-green">✓ Ativado${mod.devMode ? ' (dev)' : ''}</span>`
              : `<button class="btn btn-primary btn-sm" onclick="LicenseManager.openActivationScreen('${mod.id}')">Ativar com chave</button>`
            }
            ${mod.expiresAt ? `<div class="card-meta" style="margin-top:6px">Expira em: ${new Date(mod.expiresAt).toLocaleDateString('pt-BR')}</div>` : ''}
          </div>
        `).join('')}
      </div>
      <div class="card" style="margin-top:24px">
        <div class="card-title" style="margin-bottom:8px">Planos disponíveis</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;font-size:13px">
          <div>
            <strong>🌐 Online (Assinatura)</strong><br>
            <span class="card-meta">Acesso via browser, dados no Supabase. Assine por módulo.</span>
          </div>
          <div>
            <strong>💻 Local (Licença)</strong><br>
            <span class="card-meta">App desktop, dados em SQLite local. Pagamento único por módulo.</span>
          </div>
          <div>
            <strong>⭐ Premium</strong><br>
            <span class="card-meta">Local + sincronização com Supabase. Acesso de qualquer lugar.</span>
          </div>
        </div>
      </div>
    `;
  },
};

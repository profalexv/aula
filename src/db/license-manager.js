/**
 * license-manager.js (main process)
 * 
 * Gerencia licenças locais de módulos.
 * 
 * Modelo de negócio previsto:
 * ┌────────────────────┬─────────────────────────────────────────────────────┐
 * │ Plano              │ Detalhes                                            │
 * ├────────────────────┼─────────────────────────────────────────────────────┤
 * │ Online (Web)       │ Assinatura por módulo, dados no Supabase            │
 * │ Local (Electron)   │ Licença permanente por módulo, dados em SQLite      │
 * │ Premium            │ Licença local + sincronização Supabase              │
 * └────────────────────┴─────────────────────────────────────────────────────┘
 * 
 * Em desenvolvimento, todos os módulos estão liberados (DEV_MODE = true).
 * Em produção, a chave de licença é validada contra um servidor de licenças
 * (endpoint a ser implementado quando o produto for comercializado).
 */

const crypto = require('crypto');
const { getDb } = require('./database');

// ─── Definição dos módulos disponíveis ───────────────────────────────────────
const AVAILABLE_MODULES = {
  cronograma: {
    id: 'cronograma',
    name: 'Cronograma',
    description: 'Criação e gerenciamento de grades de horários escolares.',
    icon: '📅',
  },
  aula: {
    id: 'aula',
    name: 'Registro de Aulas',
    description: 'Registro e controle de aulas ministradas por professor.',
    icon: '📝',
  },
  plano: {
    id: 'plano',
    name: 'Plano de Aula',
    description: 'Criação e gerenciamento de planos de aula estruturados.',
    icon: '📋',
  },
};

// ─── Durante desenvolvimento todos os módulos ficam liberados ─────────────────
const DEV_MODE = true; // Alterar para false antes de publicar

/**
 * Garante que a tabela de licenças existe no banco.
 */
function ensureLicenseTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id   TEXT UNIQUE NOT NULL,
      license_key TEXT NOT NULL,
      activated_at TEXT DEFAULT (datetime('now')),
      expires_at  TEXT,
      meta        TEXT
    );
  `);
}

/**
 * Retorna o status de todos os módulos.
 * @returns {{ [moduleId]: { ...module, licensed: boolean, expiresAt: string|null } }}
 */
function getModulesStatus() {
  ensureLicenseTable();

  if (DEV_MODE) {
    return Object.fromEntries(
      Object.entries(AVAILABLE_MODULES).map(([id, mod]) => [
        id,
        { ...mod, licensed: true, devMode: true, expiresAt: null },
      ])
    );
  }

  const rows = getDb()
    .prepare('SELECT module_id, expires_at FROM licenses')
    .all();

  const licenseMap = Object.fromEntries(rows.map(r => [r.module_id, r]));

  return Object.fromEntries(
    Object.entries(AVAILABLE_MODULES).map(([id, mod]) => {
      const lic = licenseMap[id];
      const isExpired = lic?.expires_at ? new Date(lic.expires_at) < new Date() : false;
      return [
        id,
        {
          ...mod,
          licensed: !!lic && !isExpired,
          expiresAt: lic?.expires_at ?? null,
        },
      ];
    })
  );
}

/**
 * Ativa um módulo com uma chave de licença.
 * Por ora, valida o formato localmente.
 * Futuramente: chamar servidor de licenças para verificar.
 * 
 * Formato de chave esperado (provisório): SCHOLAR-{MODULE}-XXXX-XXXX-XXXX
 */
function activateModule(moduleId, licenseKey) {
  ensureLicenseTable();

  if (!AVAILABLE_MODULES[moduleId]) {
    return { success: false, error: 'Módulo inválido.' };
  }

  // Validação básica de formato (será substituída por validação remota)
  const pattern = new RegExp(`^SCHOLAR-${moduleId.toUpperCase()}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$`, 'i');
  if (!pattern.test(licenseKey.trim())) {
    return { success: false, error: 'Chave de licença inválida. Formato esperado: SCHOLAR-MODULO-XXXX-XXXX-XXXX' };
  }

  try {
    getDb()
      .prepare(`
        INSERT INTO licenses (module_id, license_key)
        VALUES (?, ?)
        ON CONFLICT(module_id) DO UPDATE SET
          license_key = excluded.license_key,
          activated_at = datetime('now'),
          expires_at = NULL
      `)
      .run(moduleId, licenseKey.trim().toUpperCase());

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Remove a licença de um módulo.
 */
function deactivateModule(moduleId) {
  ensureLicenseTable();
  try {
    getDb().prepare('DELETE FROM licenses WHERE module_id = ?').run(moduleId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  getModulesStatus,
  activateModule,
  deactivateModule,
  AVAILABLE_MODULES,
  DEV_MODE,
};

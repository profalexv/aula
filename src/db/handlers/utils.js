/**
 * Funções utilitárias para handlers IPC.
 * Padrão de resposta: { success: true/false, data?, error? }
 */

const logger = require('../../utils/logger');

/**
 * Wraps handler para tratamento consistente de erros e logging.
 */
function withErrorHandling(name, fn) {
  return async (...args) => {
    try {
      logger.debug(`IPC Handler: ${name}`, { args: args[1] });
      const result = await fn(...args);
      return result;
    } catch (error) {
      logger.error(`IPC Handler failed: ${name}`, { error: error.message, stack: error.stack });
      return { success: false, error: error.message };
    }
  };
}

/**
 * Converte erro de database para mensagem amigável.
 */
function getFriendlyErrorMessage(error) {
  if (error.message?.includes('UNIQUE')) {
    return 'Este registro já existe. Verifique se os dados estão duplicados.';
  }
  if (error.message?.includes('FOREIGN KEY')) {
    return 'Este registro está referenciado por outro. Não é possível deletar.';
  }
  if (error.message?.includes('NOT NULL')) {
    return 'Campo obrigatório não preenchido.';
  }
  return error.message;
}

module.exports = { withErrorHandling, getFriendlyErrorMessage };

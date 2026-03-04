const bcrypt = require('bcryptjs');

/**
 * Hash de senha com bcrypt (assíncrono).
 * @param {string} password - Senha em texto plano
 * @returns {Promise<string>} Hash da senha
 */
async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verifica se a senha corresponde ao hash.
 * @param {string} password - Senha em texto plano
 * @param {string} hash - Hash armazenado
 * @returns {Promise<boolean>} true se a senha é válida
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, verifyPassword };

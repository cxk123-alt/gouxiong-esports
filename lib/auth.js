'use strict';

const crypto = require('crypto');
const { db, save } = require('./store');

const SESSION_COOKIE = 'xd_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_LEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const ACCOUNT_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{3,16}$/;

function fail(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeAccount(account) {
  return String(account == null ? '' : account).trim();
}

function validateAccount(account) {
  if (!account) return '请输入账号';
  if (!ACCOUNT_RE.test(account)) return '账号需为 3-16 位字母、数字、下划线或中文';
  return null;
}

function validatePassword(password) {
  const value = String(password == null ? '' : password);
  if (!value) return '请输入密码';
  if (value.length < 6) return '密码至少 6 位';
  if (value.length > 64) return '密码最多 64 位';
  return null;
}

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), useSalt, KEY_LEN, SCRYPT_OPTIONS);
  return { salt: useSalt, hash: hash.toString('hex') };
}

function verifyPassword(password, user) {
  try {
    const { hash } = hashPassword(password, user.salt);
    const actual = Buffer.from(hash, 'hex');
    const expected = Buffer.from(String(user.hash || ''), 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function publicUser(user) {
  return { id: user.id, account: user.account, createdAt: user.createdAt };
}

function register(account, password) {
  const name = normalizeAccount(account);
  const problem = validateAccount(name) || validatePassword(password);
  if (problem) throw fail(400, 'INVALID_INPUT', problem);

  const key = name.toLowerCase();
  const users = db().users;
  if (users.some((user) => user.accountKey === key)) {
    throw fail(409, 'ACCOUNT_EXISTS', '该账号已被注册，请直接登录或更换账号');
  }

  const { salt, hash } = hashPassword(password);
  const user = {
    id: `u_${crypto.randomBytes(8).toString('hex')}`,
    account: name,
    accountKey: key,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  save();
  return user;
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const sessions = db().sessions;

  for (const [key, session] of Object.entries(sessions)) {
    if (!session || !(session.expiresAt > now)) delete sessions[key];
  }

  sessions[hashToken(token)] = { userId: user.id, expiresAt: now + SESSION_TTL_MS, createdAt: now };
  save();
  return token;
}

function login(account, password) {
  const key = normalizeAccount(account).toLowerCase();
  if (!key) throw fail(400, 'INVALID_INPUT', '请输入账号');
  if (!String(password || '')) throw fail(400, 'INVALID_INPUT', '请输入密码');

  const user = db().users.find((item) => item.accountKey === key);
  if (!user) {
    throw fail(404, 'NOT_REGISTERED', '该账号尚未注册，请先注册账号和密码');
  }
  if (!verifyPassword(password, user)) {
    throw fail(401, 'BAD_CREDENTIALS', '账号或密码不正确');
  }

  return { user, token: createSession(user) };
}

function getUserByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const sessions = db().sessions;
  const session = sessions[hashToken(token)];
  if (!session) return null;

  if (!(session.expiresAt > Date.now())) {
    delete sessions[hashToken(token)];
    save();
    return null;
  }

  return db().users.find((user) => user.id === session.userId) || null;
}

function logout(token) {
  if (!token) return;
  const sessions = db().sessions;
  const key = hashToken(token);
  if (sessions[key]) {
    delete sessions[key];
    save();
  }
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  validateAccount,
  validatePassword,
  register,
  login,
  createSession,
  getUserByToken,
  logout,
  publicUser,
};

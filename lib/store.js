'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.XD_DATA_DIR
  ? path.resolve(process.env.XD_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let state = null;

function load() {
  if (state) return state;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  try {
    state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    state = {};
  }

  state.users = Array.isArray(state.users) ? state.users : [];
  state.sessions = state.sessions && typeof state.sessions === 'object' ? state.sessions : {};
  state.orders = Array.isArray(state.orders) ? state.orders : [];
  return state;
}

function db() {
  return load();
}

/** 原子写入，避免进程中断产生半个 JSON 文件 */
function save() {
  const target = db();
  const payload = JSON.stringify(target, null, 2);
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, payload, { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}

module.exports = { db, save, DATA_DIR, DB_FILE };

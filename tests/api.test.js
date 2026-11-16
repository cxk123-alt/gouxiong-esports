'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 在加载服务端模块前指定隔离的数据目录
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiongda-test-'));
process.env.XD_DATA_DIR = dataDir;

const { createServer } = require('../server');

async function request(base, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.cookie) headers.Cookie = options.cookie;

  const response = await fetch(base + pathname, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { response, json, text, setCookies: response.headers.getSetCookie() };
}

function sessionCookie(setCookies) {
  for (const line of setCookies) {
    const pair = line.split(';')[0];
    if (pair.startsWith('xd_session=')) return pair;
  }
  return '';
}

test('狗熊电竞：注册、登录与下单全流程', async (t) => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(() => {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  let cookie = '';

  await t.test('未登录不能访问个人信息', async () => {
    const { response, json } = await request(base, '/api/me');
    assert.equal(response.status, 401);
    assert.equal(json.code, 'UNAUTHORIZED');
  });

  await t.test('业务目录包含 5 位业务人员与 4 项业务能力', async () => {
    const { response, json } = await request(base, '/api/catalog');
    assert.equal(response.status, 200);
    assert.deepEqual(
      json.staff.map((item) => item.name),
      ['熊大', '狗熊', '笨笨', '铁掌大师', '唐人'],
    );
    assert.deepEqual(
      json.services.map((item) => item.name),
      ['堵桥', '最后一队', '蹲丢包', '蹲闸'],
    );
    assert.deepEqual(json.rounds, { min: 1, max: 5 });
  });

  await t.test('注册需要合法账号与至少 6 位密码', async () => {
    const shortPassword = await request(base, '/api/register', {
      method: 'POST',
      body: { account: 'player_01', password: '123' },
    });
    assert.equal(shortPassword.response.status, 400);
    assert.equal(shortPassword.json.code, 'INVALID_INPUT');

    const badAccount = await request(base, '/api/register', {
      method: 'POST',
      body: { account: 'a', password: '123456' },
    });
    assert.equal(badAccount.response.status, 400);
  });

  await t.test('注册成功后返回会话 Cookie', async () => {
    const { response, json, setCookies } = await request(base, '/api/register', {
      method: 'POST',
      body: { account: '熊大玩家', password: 'xiongda123' },
    });
    assert.equal(response.status, 201);
    assert.equal(json.user.account, '熊大玩家');
    assert.equal(json.user.password, undefined);
    cookie = sessionCookie(setCookies);
    assert.match(cookie, /^xd_session=[A-Za-z0-9_-]+$/);
  });

  await t.test('重复注册同一账号被拒绝', async () => {
    const { response, json } = await request(base, '/api/register', {
      method: 'POST',
      body: { account: '熊大玩家', password: 'xiongda456' },
    });
    assert.equal(response.status, 409);
    assert.equal(json.code, 'ACCOUNT_EXISTS');
  });

  await t.test('未注册账号登录会被提示先注册', async () => {
    const { response, json } = await request(base, '/api/login', {
      method: 'POST',
      body: { account: 'nobody_here', password: '123456' },
    });
    assert.equal(response.status, 404);
    assert.equal(json.code, 'NOT_REGISTERED');
    assert.match(json.error, /注册/);
  });

  await t.test('密码错误无法登录', async () => {
    const { response, json } = await request(base, '/api/login', {
      method: 'POST',
      body: { account: '熊大玩家', password: 'wrong-password' },
    });
    assert.equal(response.status, 401);
    assert.equal(json.code, 'BAD_CREDENTIALS');
  });

  await t.test('正确账号密码可以登录', async () => {
    const { response, json, setCookies } = await request(base, '/api/login', {
      method: 'POST',
      body: { account: '熊大玩家', password: 'xiongda123' },
    });
    assert.equal(response.status, 200);
    assert.equal(json.user.account, '熊大玩家');
    cookie = sessionCookie(setCookies);
    assert.match(cookie, /^xd_session=[A-Za-z0-9_-]+$/);
  });

  await t.test('经 HTTPS 反向代理访问时会话 Cookie 标记 Secure', async () => {
    const { response, setCookies } = await request(base, '/api/login', {
      method: 'POST',
      headers: { 'X-Forwarded-Proto': 'https' },
      body: { account: '熊大玩家', password: 'xiongda123' },
    });
    assert.equal(response.status, 200);
    assert.match(setCookies[0], /; Secure/);
  });

  await t.test('登录后可读取个人信息', async () => {
    const { response, json } = await request(base, '/api/me', { cookie });
    assert.equal(response.status, 200);
    assert.equal(json.user.account, '熊大玩家');
  });

  await t.test('未登录不能下单', async () => {
    const { response } = await request(base, '/api/orders', {
      method: 'POST',
      body: { staffId: 'xiongda', serviceId: 'duqiao', rounds: 1 },
    });
    assert.equal(response.status, 401);
  });

  await t.test('非法业务人员 / 局数 / 备注会被拒绝', async () => {
    const badStaff = await request(base, '/api/orders', {
      method: 'POST',
      cookie,
      body: { staffId: 'not-exist', serviceId: 'duqiao', rounds: 1 },
    });
    assert.equal(badStaff.response.status, 400);
    assert.equal(badStaff.json.code, 'INVALID_STAFF');

    const badRounds = await request(base, '/api/orders', {
      method: 'POST',
      cookie,
      body: { staffId: 'xiongda', serviceId: 'duqiao', rounds: 9 },
    });
    assert.equal(badRounds.response.status, 400);
    assert.equal(badRounds.json.code, 'INVALID_ROUNDS');

    const badNote = await request(base, '/api/orders', {
      method: 'POST',
      cookie,
      body: { staffId: 'xiongda', serviceId: 'duqiao', rounds: 1, note: 'x'.repeat(101) },
    });
    assert.equal(badNote.response.status, 400);
    assert.equal(badNote.json.code, 'INVALID_NOTE');
  });

  let orderId = '';

  await t.test('下单成功并按人员费 + 项目费计价', async () => {
    const { response, json } = await request(base, '/api/orders', {
      method: 'POST',
      cookie,
      body: { staffId: 'xiongda', serviceId: 'duqiao', rounds: 2, note: '晚上八点开' },
    });

    assert.equal(response.status, 201);
    assert.equal(json.order.staffName, '熊大');
    assert.equal(json.order.serviceName, '堵桥');
    assert.equal(json.order.unitPrice, 98);
    assert.equal(json.order.total, 196);
    assert.equal(json.order.status, 'pending');
    assert.equal(json.order.note, '晚上八点开');
    orderId = json.order.id;
  });

  await t.test('订单列表只返回自己的订单', async () => {
    const { response, json } = await request(base, '/api/orders', { cookie });
    assert.equal(response.status, 200);
    assert.equal(json.orders.length, 1);
    assert.equal(json.orders[0].id, orderId);
  });

  await t.test('取消订单后状态变更，且不能重复取消', async () => {
    const first = await request(base, `/api/orders/${orderId}/cancel`, { method: 'POST', cookie });
    assert.equal(first.response.status, 200);
    assert.equal(first.json.order.status, 'cancelled');

    const second = await request(base, `/api/orders/${orderId}/cancel`, { method: 'POST', cookie });
    assert.equal(second.response.status, 409);
    assert.equal(second.json.code, 'ORDER_STATE');
  });

  await t.test('密码与令牌不以明文落盘', async () => {
    const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
    assert.equal(db.users.length, 1);
    assert.ok(db.users[0].hash.length > 64);
    assert.equal(db.users[0].password, undefined);
    const raw = JSON.stringify(db);
    assert.equal(raw.includes('xiongda123'), false);
    const sessionKey = Object.keys(db.sessions)[0];
    assert.notEqual(sessionKey, cookie.replace('xd_session=', ''));
    assert.equal(sessionKey.length, 64);
  });

  await t.test('静态页面可访问且不允许路径穿越', async () => {
    const home = await request(base, '/');
    assert.equal(home.response.status, 200);
    assert.match(home.text, /狗熊电竞/);

    const css = await request(base, '/styles.css');
    assert.equal(css.response.status, 200);
    assert.match(css.response.headers.get('content-type'), /text\/css/);

    const traversal = await request(base, '/..%2F..%2Fserver.js');
    assert.equal(traversal.response.status, 404);

    const missing = await request(base, '/nope.html');
    assert.equal(missing.response.status, 404);
  });

  await t.test('退出登录后会话失效', async () => {
    const out = await request(base, '/api/logout', { method: 'POST', cookie });
    assert.equal(out.response.status, 200);

    const me = await request(base, '/api/me', { cookie });
    assert.equal(me.response.status, 401);
  });
});

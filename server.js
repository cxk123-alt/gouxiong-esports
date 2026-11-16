'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const auth = require('./lib/auth');
const orders = require('./lib/orders');
const { STAFF, SERVICES, ROUNDS } = require('./lib/catalog');

const PORT = process.env.PORT === undefined ? 8090 : Number(process.env.PORT);
const HOST = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
/** Render / 反向代理场景下信任 X-Forwarded-For，用于按真实访客限流 */
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const JSON_LIMIT = 16 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendText(res, status, text) {
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parseCookies(header) {
  const jar = {};
  if (!header) return jar;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    const raw = part.slice(index + 1).trim();
    try {
      jar[key] = decodeURIComponent(raw);
    } catch {
      jar[key] = raw;
    }
  }
  return jar;
}

function sessionCookie(token, maxAgeSeconds, secure = false) {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
  return `${auth.SESSION_COOKIE}=${token}; ${flags}${secure ? '; Secure' : ''}`;
}

/** Cloudflare Tunnel / 反向代理转发时，据 X-Forwarded-Proto 判断是否 HTTPS */
function isSecureRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return proto === 'https';
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > JSON_LIMIT) {
        reject(httpError(413, 'PAYLOAD_TOO_LARGE', '请求内容过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(httpError(400, 'INVALID_JSON', '请求格式不正确'));
        }
        resolve(parsed);
      } catch {
        reject(httpError(400, 'INVALID_JSON', '请求格式不正确'));
      }
    });

    req.on('error', reject);
  });
}

function isLoopback(req) {
  const address = req.socket.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function clientIp(req) {
  // 经由本机 cloudflared / Render 代理转发时，使用真实访客 IP 做限流
  if (TRUST_PROXY || isLoopback(req)) {
    const candidates = [
      req.headers['cf-connecting-ip'],
      String(req.headers['x-forwarded-for'] || '').split(',')[0],
    ];
    for (const candidate of candidates) {
      const value = typeof candidate === 'string' ? candidate.trim() : '';
      if (/^[0-9a-fA-F:.]{3,45}$/.test(value)) return value;
    }
  }
  return req.socket.remoteAddress || 'unknown';
}

// 简单的内存限流，防止暴力尝试密码
const attempts = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  let record = attempts.get(key);
  if (!record || record.resetAt <= now) {
    record = { count: 0, resetAt: now + windowMs };
    attempts.set(key, record);
  }
  record.count += 1;
  if (attempts.size > 5000) attempts.clear();
  return record.count <= limit;
}

function requireUser(req) {
  const token = parseCookies(req.headers.cookie)[auth.SESSION_COOKIE];
  const user = auth.getUserByToken(token);
  if (!user) throw httpError(401, 'UNAUTHORIZED', '请先登录');
  return { user, token };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/catalog') {
    return sendJson(res, 200, { staff: STAFF, services: SERVICES, rounds: ROUNDS });
  }

  if (method === 'POST' && pathname === '/api/register') {
    if (!rateLimit(`register:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
      throw httpError(429, 'RATE_LIMITED', '注册过于频繁，请稍后再试');
    }
    const body = await readJson(req);
    const user = auth.register(body.account, body.password);
    const token = auth.createSession(user);
    return sendJson(
      res,
      201,
      { user: auth.publicUser(user) },
      { 'Set-Cookie': sessionCookie(token, auth.SESSION_TTL_MS / 1000, isSecureRequest(req)) },
    );
  }

  if (method === 'POST' && pathname === '/api/login') {
    if (!rateLimit(`login:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
      throw httpError(429, 'RATE_LIMITED', '尝试次数过多，请 10 分钟后再试');
    }
    const body = await readJson(req);
    const { user, token } = auth.login(body.account, body.password);
    return sendJson(
      res,
      200,
      { user: auth.publicUser(user) },
      { 'Set-Cookie': sessionCookie(token, auth.SESSION_TTL_MS / 1000, isSecureRequest(req)) },
    );
  }

  if (method === 'POST' && pathname === '/api/logout') {
    const token = parseCookies(req.headers.cookie)[auth.SESSION_COOKIE];
    auth.logout(token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0, isSecureRequest(req)) });
  }

  if (method === 'GET' && pathname === '/api/me') {
    const { user } = requireUser(req);
    return sendJson(res, 200, { user: auth.publicUser(user) });
  }

  if (method === 'GET' && pathname === '/api/orders') {
    const { user } = requireUser(req);
    return sendJson(res, 200, { orders: orders.listForUser(user.id) });
  }

  if (method === 'POST' && pathname === '/api/orders') {
    const { user } = requireUser(req);
    const body = await readJson(req);
    const order = orders.create(user, body);
    return sendJson(res, 201, { order });
  }

  const cancelMatch = pathname.match(/^\/api\/orders\/([A-Za-z0-9_]+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    const { user } = requireUser(req);
    const order = orders.cancel(user.id, cancelMatch[1]);
    return sendJson(res, 200, { order });
  }

  return sendJson(res, 404, { error: '接口不存在', code: 'NOT_FOUND' });
}

// ---------------------------------------------------------------------------
// 静态资源
// ---------------------------------------------------------------------------

function resolvePublicPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  if (decoded === '/' || decoded === '') decoded = '/index.html';

  const target = path.resolve(PUBLIC_DIR, `.${decoded}`);
  const root = path.resolve(PUBLIC_DIR);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

async function handleStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: '不支持的请求方法', code: 'METHOD_NOT_ALLOWED' });
  }

  const filePath = resolvePublicPath(url.pathname);
  if (!filePath) return sendText(res, 404, '404 Not Found');

  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return sendText(res, 404, '404 Not Found');

    const data = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return sendText(res, 404, '404 Not Found');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 服务器
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);

  const url = new URL(req.url, 'http://localhost');

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      await handleStatic(req, res, url);
    }
  } catch (err) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const status = err.status || 500;
    if (status >= 500) console.error('[server]', err);
    sendJson(res, status, {
      error: status >= 500 ? '服务器开小差了，请稍后再试' : err.message,
      code: err.code || 'INTERNAL_ERROR',
    });
  }
}

function createServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('[server]', err);
      if (!res.headersSent) sendText(res, 500, '500 Internal Server Error');
      else res.destroy();
    });
  });
}

function start() {
  const server = createServer();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`端口 ${PORT} 已被占用，请设置 PORT 环境变量后重试，例如：PORT=8091 npm start`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, HOST, () => {
    const address = server.address();
    const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://${HOST}:${address.port}`;
    console.log(`狗熊电竞 已启动 → ${publicUrl}`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) start();

module.exports = { createServer, start, handleRequest, SECURITY_HEADERS };

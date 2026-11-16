'use strict';

const crypto = require('crypto');
const { db, save } = require('./store');
const catalog = require('./catalog');

const STATUS = {
  pending: '待接单',
  cancelled: '已取消',
  done: '已完成',
};

function fail(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function createCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function makeId() {
  return `o_${crypto.randomBytes(8).toString('hex')}`;
}

function sanitizeNote(note) {
  const text = String(note == null ? '' : note).trim();
  if (text.length > 100) throw fail(400, 'INVALID_NOTE', '备注最多 100 个字');
  return text;
}

function create(user, input = {}) {
  const staff = catalog.findStaff(input.staffId);
  if (!staff) throw fail(400, 'INVALID_STAFF', '请选择业务人员');

  const service = catalog.findService(input.serviceId);
  if (!service) throw fail(400, 'INVALID_SERVICE', '请选择业务能力');

  const rounds = Number.parseInt(input.rounds, 10);
  if (!Number.isInteger(rounds) || rounds < catalog.ROUNDS.min || rounds > catalog.ROUNDS.max) {
    throw fail(400, 'INVALID_ROUNDS', `局数需在 ${catalog.ROUNDS.min}-${catalog.ROUNDS.max} 之间`);
  }

  const order = {
    id: makeId(),
    code: createCode(),
    userId: user.id,
    staffId: staff.id,
    staffName: staff.name,
    staffInitial: staff.initial,
    staffRole: staff.role,
    serviceId: service.id,
    serviceName: service.name,
    rounds,
    unitPrice: staff.price + service.price,
    total: catalog.priceOf(staff, service, rounds),
    note: sanitizeNote(input.note),
    status: 'pending',
    statusText: STATUS.pending,
    createdAt: new Date().toISOString(),
  };

  db().orders.unshift(order);
  save();
  return order;
}

function listForUser(userId) {
  return db()
    .orders.filter((order) => order.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function cancel(userId, orderId) {
  const order = db().orders.find((item) => item.id === orderId && item.userId === userId);
  if (!order) throw fail(404, 'ORDER_NOT_FOUND', '订单不存在');
  if (order.status !== 'pending') {
    throw fail(409, 'ORDER_STATE', '该订单当前状态不可取消');
  }

  order.status = 'cancelled';
  order.statusText = STATUS.cancelled;
  order.cancelledAt = new Date().toISOString();
  save();
  return order;
}

module.exports = { STATUS, create, listForUser, cancel };

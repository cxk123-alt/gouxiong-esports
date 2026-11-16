'use strict';

/**
 * 业务人员与业务能力目录。
 * 价格单位：元 / 局。订单总价 =（人员单价 + 能力单价）× 局数。
 */

const STAFF = [
  {
    id: 'xiongda',
    name: '熊大',
    initial: '熊',
    role: '队长',
    rank: 'S+',
    price: 68,
    winrate: 92,
    specialty: '指挥 · 突击',
    tagline: '全图节奏发动机，开团从不犹豫',
    recommended: true,
  },
  {
    id: 'gouxiong',
    name: '狗熊',
    initial: '狗',
    role: '突击手',
    rank: 'S',
    price: 58,
    winrate: 88,
    specialty: '突破 · 反打',
    tagline: '枪线压得死，专治各种不服',
  },
  {
    id: 'benben',
    name: '笨笨',
    initial: '笨',
    role: '侦察兵',
    rank: 'A+',
    price: 48,
    winrate: 84,
    specialty: '侦查 · 架点',
    tagline: '先手信息拉满，敌人位置全知道',
  },
  {
    id: 'tiezhang',
    name: '铁掌大师',
    initial: '铁',
    role: '重装',
    rank: 'S+',
    price: 78,
    winrate: 95,
    specialty: '抗压 · 断后',
    tagline: '一夫当关，撤离路线守到最后一秒',
  },
  {
    id: 'tangren',
    name: '唐人',
    initial: '唐',
    role: '自由人',
    rank: 'S',
    price: 52,
    winrate: 86,
    specialty: '全能 · 补位',
    tagline: '哪里缺人补哪里，冷门点位全是绝活',
  },
];

const SERVICES = [
  {
    id: 'duqiao',
    name: '堵桥',
    price: 30,
    icon: 'bridge',
    desc: '封锁要道，截断敌方增援路线',
    recommended: true,
  },
  {
    id: 'zuihou',
    name: '最后一队',
    price: 40,
    icon: 'flag',
    desc: '残局收割，稳稳拿下最后胜利',
  },
  {
    id: 'diubao',
    name: '蹲丢包',
    price: 25,
    icon: 'box',
    desc: '伏击捡漏，低风险高回报',
  },
  {
    id: 'dunzha',
    name: '蹲闸',
    price: 35,
    icon: 'gate',
    desc: '守闸控图，锁死撤离点',
  },
];

const ROUNDS = { min: 1, max: 5 };

function findStaff(id) {
  return STAFF.find((item) => item.id === id) || null;
}

function findService(id) {
  return SERVICES.find((item) => item.id === id) || null;
}

/** 总价（元），rounds 需为合法整数 */
function priceOf(staff, service, rounds) {
  return (staff.price + service.price) * rounds;
}

module.exports = { STAFF, SERVICES, ROUNDS, findStaff, findService, priceOf };

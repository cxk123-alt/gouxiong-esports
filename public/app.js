'use strict';

/* ==========================================================================
   狗熊电竞 · 前端逻辑
   ========================================================================== */

const ACCOUNT_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{3,16}$/;

const ICON_CHECK =
  '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 7.4 3.1 3.1L12 3.8"></path></svg>';

const ICON_EYE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="3.2"></circle></svg>';

const ICON_EYE_OFF =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 5.8A9.9 9.9 0 0 1 12 5.7c6 0 9.5 6.3 9.5 6.3a17.6 17.6 0 0 1-3.4 4.1"></path><path d="M6.3 6.9A17.7 17.7 0 0 0 2.5 12S6 18.3 12 18.3c1.3 0 2.4-.2 3.5-.6"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';

const ICON_TOAST = {
  success:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8.3 12.2 2.5 2.5 4.9-5.2"></path></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7.8v5"></path><path d="M12 16.4h.01"></path></svg>',
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5.2"></path><path d="M12 7.8h.01"></path></svg>',
};

const SERVICE_ICONS = {
  bridge:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 11h20"></path><path d="M4 11v8M20 11v8"></path><path d="M4 19c4-4.6 12-4.6 16 0"></path></svg>',
  flag:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V4"></path><path d="M6 4h10l-2.2 3.6L16 11H6"></path></svg>',
  box:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z"></path><path d="M3.5 7.5 12 12l8.5-4.5"></path><path d="M12 12v9"></path></svg>',
  gate:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V8.5L12 4l8 4.5V21"></path><path d="M2.5 21h19"></path><path d="M9 21v-7.5h6V21"></path><path d="M12 10.6v1.6"></path></svg>',
};

const EMPTY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2.5"></rect><path d="M9.5 4.5V3.2h5v1.3"></path><path d="M9 10h6M9 14h6M9 18h3"></path></svg>';

const state = {
  user: null,
  staff: [],
  services: [],
  roundsRange: { min: 1, max: 5 },
  orders: [],
  selection: { staffId: null, serviceId: null },
  rounds: 1,
  authTab: 'login',
  busy: false,
};

const els = {};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// 网络
// ---------------------------------------------------------------------------

async function api(path, options = {}) {
  const init = {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: {},
  };
  if (options.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error('网络连接失败，请稍后重试');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error((data && data.error) || '请求失败，请稍后重试');
    error.status = response.status;
    error.code = data && data.code;
    throw error;
  }

  return data || {};
}

// ---------------------------------------------------------------------------
// 初始化
// ---------------------------------------------------------------------------

function cacheElements() {
  els.viewAuth = $('#view-auth');
  els.viewApp = $('#view-app');
  els.authTitle = $('#auth-title');
  els.authSub = $('#auth-sub');
  els.authAlert = $('#auth-alert');
  els.tabLogin = $('#tab-login');
  els.tabRegister = $('#tab-register');
  els.formLogin = $('#form-login');
  els.formRegister = $('#form-register');
  els.loginAccount = $('#login-account');
  els.loginPassword = $('#login-password');
  els.regAccount = $('#reg-account');
  els.regPassword = $('#reg-password');
  els.regConfirm = $('#reg-confirm');
  els.staffGrid = $('#staff-grid');
  els.serviceGrid = $('#service-grid');
  els.rounds = $('#rounds');
  els.note = $('#note');
  els.noteCount = $('#note-count');
  els.sumAvatar = $('#sum-avatar');
  els.sumName = $('#sum-name');
  els.sumServiceTag = $('#sum-service-tag');
  els.sumStaff = $('#sum-staff');
  els.sumService = $('#sum-service');
  els.sumRounds = $('#sum-rounds');
  els.sumStaffPrice = $('#sum-staff-price');
  els.sumServicePrice = $('#sum-service-price');
  els.sumTotal = $('#sum-total');
  els.submit = $('#submit-order');
  els.barSubmit = $('#bar-submit');
  els.barTotal = $('#bar-total');
  els.ordersList = $('#orders-list');
  els.ordersMeta = $('#orders-meta');
  els.navCount = $('#nav-order-count');
  els.sideAvatar = $('#side-avatar');
  els.sideAccount = $('#side-account');
  els.logoutBtn = $('#logout-btn');
  els.logoutMobile = $('#logout-btn-mobile');
  els.greeting = $('#greeting');
  els.helpBtn = $('#help-btn');
  els.toasts = $('#toasts');
}

async function init() {
  cacheElements();
  bindAuthEvents();
  bindAppEvents();
  updateNoteCount();

  try {
    const { user } = await api('/api/me');
    await enterApp(user);
  } catch (error) {
    showAuth();
    if (error.status !== 401) {
      toast('无法连接服务器，请刷新页面重试', 'error');
    }
  }
}

// ---------------------------------------------------------------------------
// 登录 / 注册
// ---------------------------------------------------------------------------

function bindAuthEvents() {
  els.viewAuth.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-auth-tab]');
    if (trigger) {
      const tab = trigger.dataset.authTab;
      setAuthTab(tab);
      if (trigger.closest('.auth-switch')) {
        const input = tab === 'login' ? els.loginAccount : els.regAccount;
        window.setTimeout(() => input.focus(), 0);
      }
      return;
    }

    const toggle = event.target.closest('.pwd-toggle');
    if (toggle) togglePassword(toggle);
  });

  els.formLogin.addEventListener('submit', onLogin);
  els.formRegister.addEventListener('submit', onRegister);
}

function setAuthTab(tab) {
  state.authTab = tab === 'register' ? 'register' : 'login';
  const isLogin = state.authTab === 'login';

  els.formLogin.hidden = !isLogin;
  els.formRegister.hidden = isLogin;
  els.tabLogin.classList.toggle('is-active', isLogin);
  els.tabRegister.classList.toggle('is-active', !isLogin);
  els.tabLogin.setAttribute('aria-selected', String(isLogin));
  els.tabRegister.setAttribute('aria-selected', String(!isLogin));

  els.authTitle.textContent = isLogin ? '欢迎回来' : '创建账号';
  els.authSub.textContent = isLogin
    ? '登录后即可下单，王牌队员随时待命'
    : '设置账号与密码，30 秒开启你的第一单';

  hideAuthAlert();
}

function showAuthAlert(message, action) {
  els.authAlert.replaceChildren(h('span', null, message));
  if (action) {
    const button = h('button', 'alert-link', action.label);
    button.type = 'button';
    button.addEventListener('click', action.onClick);
    els.authAlert.append(button);
  }
  els.authAlert.hidden = false;
}

function hideAuthAlert() {
  els.authAlert.hidden = true;
  els.authAlert.replaceChildren();
}

function togglePassword(button) {
  const input = document.getElementById(button.dataset.target);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.innerHTML = show ? ICON_EYE_OFF : ICON_EYE;
  button.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
  button.title = show ? '隐藏密码' : '显示密码';
}

function setFormBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('is-busy', busy);
  if (busy) {
    const spinner = h('span', 'spinner');
    spinner.setAttribute('aria-hidden', 'true');
    button.replaceChildren(spinner, document.createTextNode('处理中…'));
  } else {
    button.textContent = button.dataset.label || '提交';
  }
}

async function onLogin(event) {
  event.preventDefault();
  hideAuthAlert();

  const account = els.loginAccount.value.trim();
  const password = els.loginPassword.value;
  if (!account) return showAuthAlert('请输入账号');
  if (!password) return showAuthAlert('请输入密码');

  const button = els.formLogin.querySelector('button[type="submit"]');
  setFormBusy(button, true);

  try {
    const { user } = await api('/api/login', { method: 'POST', body: { account, password } });
    await enterApp(user);
    els.formLogin.reset();
    toast(`欢迎回来，${user.account}`, 'success');
  } catch (error) {
    if (error.code === 'NOT_REGISTERED') {
      showAuthAlert(error.message, {
        label: '去注册',
        onClick: () => {
          setAuthTab('register');
          els.regAccount.value = account;
          els.regAccount.focus();
        },
      });
      els.loginPassword.value = '';
    } else {
      showAuthAlert(error.message);
    }
  } finally {
    setFormBusy(button, false);
  }
}

async function onRegister(event) {
  event.preventDefault();
  hideAuthAlert();

  const account = els.regAccount.value.trim();
  const password = els.regPassword.value;
  const confirm = els.regConfirm.value;

  if (!account) return showAuthAlert('请输入账号');
  if (!ACCOUNT_RE.test(account)) return showAuthAlert('账号需为 3-16 位字母、数字、下划线或中文');
  if (password.length < 6) return showAuthAlert('密码至少 6 位');
  if (password !== confirm) return showAuthAlert('两次输入的密码不一致');

  const button = els.formRegister.querySelector('button[type="submit"]');
  setFormBusy(button, true);

  try {
    const { user } = await api('/api/register', { method: 'POST', body: { account, password } });
    await enterApp(user);
    els.formRegister.reset();
    toast(`注册成功，欢迎加入，${user.account}`, 'success');
  } catch (error) {
    showAuthAlert(error.message);
    if (error.code === 'ACCOUNT_EXISTS') {
      els.regAccount.focus();
      els.regAccount.select();
    }
  } finally {
    setFormBusy(button, false);
  }
}

function showAuth() {
  state.user = null;
  state.orders = [];
  state.busy = false;
  document.body.dataset.view = 'auth';
  els.viewApp.hidden = true;
  els.viewAuth.hidden = false;
  els.formLogin.reset();
  els.formRegister.reset();
  els.submit.disabled = true;
  els.barSubmit.disabled = true;
  setAuthTab('login');
}

function handleUnauthorized() {
  showAuth();
  showAuthAlert('登录状态已失效，请重新登录');
  toast('登录状态已失效，请重新登录', 'error');
}

// ---------------------------------------------------------------------------
// 工作台
// ---------------------------------------------------------------------------

function bindAppEvents() {
  els.staffGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.staff-card');
    if (card) selectStaff(card.dataset.id);
  });

  els.serviceGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.service-card');
    if (card) selectService(card.dataset.id);
  });

  $all('.stepper-btn').forEach((button) => {
    button.addEventListener('click', () => {
      setRounds(state.rounds + Number.parseInt(button.dataset.step, 10));
    });
  });

  els.rounds.addEventListener('change', () => {
    setRounds(Number.parseInt(els.rounds.value, 10));
  });

  els.note.addEventListener('input', updateNoteCount);

  els.submit.addEventListener('click', submitOrder);
  els.barSubmit.addEventListener('click', submitOrder);
  els.logoutBtn.addEventListener('click', logout);
  els.logoutMobile.addEventListener('click', logout);

  els.helpBtn.addEventListener('click', () => {
    toast('下单流程：选业务人员 → 选业务能力 → 定局数 → 提交，5 分钟内接单。', 'info');
  });

  $all('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      $all('.nav-item').forEach((link) => link.classList.toggle('is-active', link === item));
    });
  });
}

async function enterApp(user) {
  state.user = user;
  state.orders = [];
  state.selection = { staffId: null, serviceId: null };
  state.rounds = 1;
  state.busy = false;

  document.body.dataset.view = 'app';
  els.viewAuth.hidden = true;
  els.viewApp.hidden = false;
  els.sideAccount.textContent = user.account;
  els.sideAvatar.textContent = (user.account || '玩').charAt(0).toUpperCase();
  els.greeting.textContent = `${greeting()}，${user.account}`;
  els.note.value = '';
  els.rounds.value = '1';
  updateNoteCount();
  window.scrollTo({ top: 0, behavior: 'auto' });

  try {
    const [catalog, orderData] = await Promise.all([api('/api/catalog'), api('/api/orders')]);
    applyCatalog(catalog);
    state.orders = Array.isArray(orderData.orders) ? orderData.orders : [];
    renderOrders();
  } catch (error) {
    if (error.status === 401) return handleUnauthorized();
    toast(error.message, 'error');
  }
}

function applyCatalog(catalog) {
  state.staff = Array.isArray(catalog.staff) ? catalog.staff : [];
  state.services = Array.isArray(catalog.services) ? catalog.services : [];
  if (catalog.rounds) state.roundsRange = catalog.rounds;

  renderStaff();
  renderServices();

  const staff = state.staff.find((item) => item.recommended) || state.staff[0] || null;
  const service = state.services.find((item) => item.recommended) || state.services[0] || null;
  state.selection.staffId = staff ? staff.id : null;
  state.selection.serviceId = service ? service.id : null;
  syncSelection(els.staffGrid, state.selection.staffId);
  syncSelection(els.serviceGrid, state.selection.serviceId);

  els.rounds.min = String(state.roundsRange.min);
  els.rounds.max = String(state.roundsRange.max);
  setRounds(1);
}

function renderStaff() {
  els.staffGrid.replaceChildren();

  for (const staff of state.staff) {
    const card = h('button', 'staff-card');
    card.type = 'button';
    card.dataset.id = staff.id;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.setAttribute(
      'aria-label',
      `${staff.name}，${staff.role}，撤离率 ${staff.winrate}%，${staff.price} 元每局`,
    );

    const avatarWrap = h('span', 'staff-avatar-wrap');
    const avatar = h('span', 'staff-avatar', staff.initial);
    avatar.setAttribute('aria-hidden', 'true');
    avatarWrap.append(avatar, h('span', 'staff-rank', staff.rank));

    const info = h('span', 'staff-info');
    const nameRow = h('span', 'staff-name');
    nameRow.append(document.createTextNode(staff.name));
    if (staff.role) nameRow.append(h('span', 'staff-role', staff.role));
    if (staff.recommended) nameRow.append(h('span', 'staff-rec', '推荐'));
    info.append(nameRow, h('span', 'staff-tagline', staff.tagline));

    const stats = h('span', 'staff-stats');
    stats.append(h('span', 'staff-spec', staff.specialty));
    const meter = h('span', 'staff-meter');
    const track = h('span', 'meter');
    const fill = document.createElement('i');
    fill.style.width = `${Math.max(0, Math.min(100, staff.winrate))}%`;
    track.append(fill);
    meter.append(track);
    stats.append(meter);
    const rate = h('span', 'staff-rate');
    rate.append(document.createTextNode('撤离率 '));
    const rateValue = document.createElement('b');
    rateValue.textContent = `${staff.winrate}%`;
    rate.append(rateValue);
    stats.append(rate);

    const price = h('span', 'staff-price');
    price.append(h('strong', null, `¥${staff.price}`), h('small', null, '/局'));

    const pick = h('span', 'pick');
    pick.innerHTML = ICON_CHECK;
    pick.setAttribute('aria-hidden', 'true');

    card.append(avatarWrap, info, stats, price, pick);
    els.staffGrid.append(card);
  }
}

function renderServices() {
  els.serviceGrid.replaceChildren();

  for (const service of state.services) {
    const card = h('button', 'service-card');
    card.type = 'button';
    card.dataset.id = service.id;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');

    const icon = h('span', 'service-icon');
    icon.innerHTML = SERVICE_ICONS[service.icon] || SERVICE_ICONS.box;
    icon.setAttribute('aria-hidden', 'true');

    const body = h('span', 'service-body');
    const nameRow = h('span', 'service-name');
    nameRow.append(document.createTextNode(service.name));
    if (service.recommended) nameRow.append(h('span', 'tag-rec', '推荐'));
    body.append(nameRow, h('span', 'service-desc', service.desc));

    const pick = h('span', 'pick');
    pick.innerHTML = ICON_CHECK;
    pick.setAttribute('aria-hidden', 'true');

    card.append(icon, body, h('span', 'service-price', `+¥${service.price}`), pick);
    els.serviceGrid.append(card);
  }
}

function syncSelection(container, id) {
  for (const card of container.children) {
    const active = card.dataset.id === id;
    card.classList.toggle('is-active', active);
    card.setAttribute('aria-checked', active ? 'true' : 'false');
  }
}

function selectStaff(id) {
  if (!state.staff.some((item) => item.id === id)) return;
  state.selection.staffId = id;
  syncSelection(els.staffGrid, id);
  updateSummary();
}

function selectService(id) {
  if (!state.services.some((item) => item.id === id)) return;
  state.selection.serviceId = id;
  syncSelection(els.serviceGrid, id);
  updateSummary();
}

function setRounds(value) {
  const min = state.roundsRange.min;
  const max = state.roundsRange.max;
  const numeric = Number.isFinite(value) ? Math.trunc(value) : min;
  state.rounds = Math.min(max, Math.max(min, numeric));
  els.rounds.value = String(state.rounds);
  updateSummary();
}

function updateNoteCount() {
  els.noteCount.textContent = `${els.note.value.length}/100`;
}

function currentStaff() {
  return state.staff.find((item) => item.id === state.selection.staffId) || null;
}

function currentService() {
  return state.services.find((item) => item.id === state.selection.serviceId) || null;
}

function updateSummary() {
  const staff = currentStaff();
  const service = currentService();
  const ready = Boolean(staff && service);

  els.sumAvatar.textContent = staff ? staff.initial : '—';
  els.sumAvatar.dataset.id = staff ? staff.id : '';
  els.sumName.textContent = staff ? `${staff.name} · ${staff.role}` : '待选择业务人员';
  els.sumServiceTag.textContent = service ? `业务能力：${service.name}` : '待选择业务能力';

  els.sumStaff.textContent = staff ? staff.name : '—';
  els.sumService.textContent = service ? service.name : '—';
  els.sumRounds.textContent = `${state.rounds} 局`;
  els.sumStaffPrice.textContent = staff ? `¥${staff.price} / 局` : '—';
  els.sumServicePrice.textContent = service ? `¥${service.price} / 局` : '—';

  const total = ready ? (staff.price + service.price) * state.rounds : 0;
  els.sumTotal.textContent = `¥${total}`;
  els.barTotal.textContent = `¥${total}`;

  const disabled = !ready || state.busy;
  els.submit.disabled = disabled;
  els.barSubmit.disabled = disabled;
}

function setBusy(busy) {
  state.busy = busy;
  els.submit.disabled = busy;
  els.barSubmit.disabled = busy;
  els.submit.textContent = busy ? '提交中…' : '立即下单';
  els.barSubmit.textContent = busy ? '提交中…' : '立即下单';
  if (!busy) updateSummary();
}

async function submitOrder() {
  if (state.busy) return;

  const staff = currentStaff();
  const service = currentService();
  if (!staff || !service) {
    toast('请先选择业务人员和业务能力', 'error');
    return;
  }

  const note = els.note.value.trim();
  if (note.length > 100) {
    toast('备注最多 100 个字', 'error');
    return;
  }

  setBusy(true);
  try {
    const { order } = await api('/api/orders', {
      method: 'POST',
      body: {
        staffId: staff.id,
        serviceId: service.id,
        rounds: state.rounds,
        note,
      },
    });

    state.orders.unshift(order);
    renderOrders();
    els.note.value = '';
    updateNoteCount();

    toast(`下单成功！${order.staffName} 已收到 #${order.code} 订单`, 'success');
    const target = document.getElementById('my-orders');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    if (error.status === 401) {
      handleUnauthorized();
      return;
    }
    toast(error.message, 'error');
  } finally {
    setBusy(false);
  }
}

async function logout() {
  els.logoutBtn.disabled = true;
  els.logoutMobile.disabled = true;
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {
    /* 忽略：无论如何回到登录页 */
  } finally {
    els.logoutBtn.disabled = false;
    els.logoutMobile.disabled = false;
    showAuth();
    toast('已退出登录，下次见', 'info');
  }
}

// ---------------------------------------------------------------------------
// 订单
// ---------------------------------------------------------------------------

function renderOrders() {
  els.ordersList.replaceChildren();
  els.ordersMeta.textContent = `共 ${state.orders.length} 单`;

  const pending = state.orders.filter((order) => order.status === 'pending').length;
  els.navCount.hidden = pending === 0;
  els.navCount.textContent = String(pending);

  if (state.orders.length === 0) {
    els.ordersList.append(emptyOrders());
    return;
  }

  state.orders.forEach((order, index) => {
    els.ordersList.append(orderCard(order, index));
  });
}

function orderCard(order, index) {
  const cancelled = order.status === 'cancelled';
  const card = h('article', cancelled ? 'order is-cancelled' : 'order');
  card.style.animationDelay = `${Math.min(index, 6) * 35}ms`;

  const main = h('div', 'order-main');
  const head = h('div', 'order-head');
  head.append(h('span', 'order-code', `#${order.code}`));
  head.append(
    h(
      'span',
      `status-pill status-${cancelled ? 'cancelled' : 'pending'}`,
      order.statusText || (cancelled ? '已取消' : '待接单'),
    ),
  );

  const title = h('h4', null, `${order.staffName} · ${order.serviceName}`);
  const meta = h('p', 'order-meta');
  meta.append(document.createTextNode(`${order.rounds} 局 · ${formatDate(order.createdAt)}`));
  if (order.note) {
    meta.append(document.createTextNode(' · 备注：'), h('span', 'order-note', order.note));
  }

  main.append(head, title, meta);

  const side = h('div', 'order-side');
  side.append(h('strong', 'order-total', `¥${order.total}`));

  if (!cancelled) {
    const cancel = h('button', 'order-cancel', '取消订单');
    cancel.type = 'button';
    cancel.addEventListener('click', () => requestCancel(order, cancel));
    side.append(cancel);
  }

  card.append(main, side);
  return card;
}

function emptyOrders() {
  const box = h('div', 'orders-empty');
  box.innerHTML = `${EMPTY_ICON}<strong>还没有订单</strong><p>选一位王牌，挑一门绝活，第一单马上出发。</p>`;
  return box;
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function requestCancel(order, button) {
  if (button.dataset.confirm !== '1') {
    button.dataset.confirm = '1';
    button.classList.add('is-confirm');
    button.textContent = '确认取消？';
    window.clearTimeout(button._resetTimer);
    button._resetTimer = window.setTimeout(() => resetCancelButton(button), 4000);
    return;
  }

  button.disabled = true;
  cancelOrder(order, button);
}

function resetCancelButton(button) {
  button.dataset.confirm = '';
  button.classList.remove('is-confirm');
  button.textContent = '取消订单';
  button.disabled = false;
}

async function cancelOrder(order, button) {
  try {
    const { order: updated } = await api(
      `/api/orders/${encodeURIComponent(order.id)}/cancel`,
      { method: 'POST' },
    );
    const index = state.orders.findIndex((item) => item.id === order.id);
    if (index >= 0) state.orders[index] = updated;
    renderOrders();
    toast('订单已取消，随时可以重新下单', 'info');
  } catch (error) {
    resetCancelButton(button);
    if (error.status === 401) {
      handleUnauthorized();
      return;
    }
    toast(error.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// 通用交互
// ---------------------------------------------------------------------------

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function toast(message, type = 'info') {
  if (!els.toasts) return;

  const node = h('div', `toast toast-${type}`);
  node.innerHTML = ICON_TOAST[type] || ICON_TOAST.info;
  node.append(h('p', null, message));
  els.toasts.append(node);

  while (els.toasts.children.length > 4) {
    els.toasts.firstElementChild.remove();
  }

  window.requestAnimationFrame(() => node.classList.add('in'));
  window.setTimeout(() => {
    node.classList.remove('in');
    window.setTimeout(() => node.remove(), 240);
  }, 3600);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

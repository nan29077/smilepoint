import { escape, icon, roles } from '../catalog.js';
import { notificationsFor } from '../state.js';
import { adminDescriptions, adminMenu, adminPage } from './admin.js';
import { partnerDescriptions, partnerMenu, partnerPage } from './partner.js';
import { avatar, brand } from './ui.js';
import { profilePage, supportPage, userDescriptions, userMenu, userPage } from './user.js';

export const menus = { user: userMenu, partner: partnerMenu, admin: adminMenu };
const descriptions = { user: userDescriptions, partner: partnerDescriptions, admin: adminDescriptions };
export const pages = role => [...menus[role].flatMap(([, items]) => items), ['profile', 'user', role === 'partner' ? '담당자 프로필' : '내 프로필']];
export const pageTitle = (role, page) => pages(role).find(([id]) => id === page)?.[2] ?? '';

function badges(state, me) {
  const pending = state.transactions.filter(row => row.status === 'pending');
  if (me.role === 'admin') return { requests: pending.filter(r => r.type === 'exchange').length, payouts: pending.filter(r => r.type === 'withdrawal').length, support: state.tickets.filter(t => t.status === 'open').length };
  if (me.role === 'partner') return { requests: pending.filter(r => r.type === 'exchange' && r.partner === me.partnerId).length };
  const now = new Date().toISOString();
  return { coupons: state.transactions.filter(r => r.userId === me.id && r.type === 'coupon' && !r.coupon?.used && r.coupon?.expires > now).length, support: state.tickets.filter(t => t.userId === me.id && t.status === 'answered' && !t.seen).length };
}

export function dashboard(state, me, page, ui) {
  const role = me.role;
  const count = badges(state, me);
  const unread = notificationsFor(state, me).filter(item => !item.read).length;
  const partner = role === 'partner' ? state.partners.find(p => p.id === me.partnerId) : null;
  const body = role === 'user' ? userPage(state, me, page, ui)
    : role === 'partner' ? partnerPage(state, me, page, ui, profilePage)
    : adminPage(state, me, page, ui, { profilePage, supportPage });
  return `<div class="dash dash-${role}">
    <aside class="sidebar" id="dash-menu"><div class="sidebar-top">${brand()}<span class="role-label">${icon(roles[role].icon, 15)} ${roles[role].name}${partner ? ' · ' + partner.name : ''}</span></div>
      <nav aria-label="대시보드 메뉴">${menus[role].map(([group, items]) => `<p class="nav-group">${group}</p>${items.map(([id, glyph, label]) => `<a href="#app/${role}/${id}" ${id === page ? 'aria-current="page"' : ''}>${icon(glyph, 19)}<span>${label}</span>${count[id] ? `<b class="badge">${count[id]}</b>` : ''}</a>`).join('')}`).join('')}</nav>
      <div class="side-foot"><a href="#home" class="home-link">${icon('external', 19)} 메인으로</a>
        <a class="side-profile" href="#app/${role}/profile" ${page === 'profile' ? 'aria-current="page"' : ''}>${avatar(me, 'sm')}<span><strong>${escape(me.name)}</strong><small>${escape(me.email)}</small></span>${icon('chevron', 15)}</a></div>
    </aside>
    <div class="dash-main"><header class="dash-header">
      <div><button type="button" class="icon-btn dash-toggle" data-action="dash-menu" aria-label="대시보드 메뉴" aria-controls="dash-menu" aria-expanded="false">${icon('menu')}</button>
      <span class="mode-badge ${state.server?.mode === 'server' ? 'live' : ''}" title="${state.server?.mode === 'server' ? '서버에 저장됩니다' : '이 브라우저에만 저장됩니다'}"><i></i>${state.server?.mode === 'server' ? '서버 연결' : '데모 모드'}</span>
      <nav class="crumbs" aria-label="현재 위치"><span>${roles[role].name}</span>${icon('chevron', 14)}<strong>${pageTitle(role, page)}</strong></nav></div>
      <div class="dash-tools">
        <button type="button" class="icon-btn bell" data-action="notifications" aria-label="알림 ${unread}건">${icon('bell', 21)}${unread ? `<b>${unread > 9 ? '9+' : unread}</b>` : ''}</button>
        <a class="dash-profile" href="#app/${role}/profile">${avatar(me)}<span>${escape(me.name)}<small>${roles[role].name}</small></span></a>
        <button type="button" class="icon-btn" data-action="logout" aria-label="로그아웃" title="로그아웃">${icon('logout', 20)}</button>
      </div>
    </header><main id="main" class="dash-content">
      ${page === 'overview' ? '' : `<div class="dash-title"><h1>${pageTitle(role, page)}</h1><p>${descriptions[role][page] ?? ''}</p></div>`}
      ${body}
    </main></div>
  </div>`;
}

let token = localStorage.getItem('sb-token');
let me = JSON.parse(localStorage.getItem('sb-user') || 'null');
let currentStudy = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const utf8Bytes = value => new TextEncoder().encode(value).length;
const commonPasswords = new Set(['password','password1234','12345678','123456789','qwerty1234','letmein1234','admin1234','iloveyou1234']);
const APP_LABELS = { PENDING: '대기', APPROVED: '승인', REJECTED: '거절', CANCELLED: '지원 취소', WITHDRAWN: '탈퇴' };
const STUDY_LABELS = { RECRUITING: '모집중', CLOSED: '모집 마감', ACTIVE: '진행중', FINISHED: '종료', CANCELLED: '모집 취소' };
const isWithinRecruitment = study => study.status === 'RECRUITING' && study.deadline >= today();
const today = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

class ApiError extends Error {
  constructor(response, body) {
    super(body.message || '요청을 처리하지 못했습니다.');
    this.status = response.status;
    this.code = body.code;
  }
}

function notice(message) {
  const node = $('#notice');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => node.classList.remove('show'), 3500);
}

async function withBusy(button, action) {
  if (!button || button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try { return await action(); }
  finally {
    if (button.isConnected) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({ message: '서버 응답을 읽지 못했습니다.' }));
  if (response.status === 401 && token && !path.startsWith('/auth/')) {
    token = null;
    me = null;
    localStorage.removeItem('sb-token');
    localStorage.removeItem('sb-user');
    refreshAuth();
    navigate('login', { replace: true });
    notice('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    throw new ApiError(response, body);
  }
  if (!response.ok) throw new ApiError(response, body);
  return body;
}

const modal = $('#appModal');
let finishModal = null;
let modalReturnFocus = null;
function closeModal(result = false) {
  const finish = finishModal;
  finishModal = null;
  if (modal.open) modal.close();
  finish?.(result);
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
}
function openModal({ title, message, confirmText = '확인', cancelText = null, danger = false, eyebrow = '안내' }) {
  return new Promise(resolve => {
    modalReturnFocus = document.activeElement;
    finishModal = resolve;
    $('#modalEyebrow').textContent = eyebrow;
    $('#modalTitle').textContent = title;
    $('#modalMessage').textContent = message;
    $('#modalConfirm').textContent = confirmText;
    $('#modalConfirm').classList.toggle('buttonDanger', danger);
    $('#modalCancel').hidden = !cancelText;
    if (cancelText) $('#modalCancel').textContent = cancelText;
    modal.showModal();
    (cancelText ? $('#modalCancel') : $('#modalConfirm')).focus();
  });
}
$('#modalConfirm').addEventListener('click', () => closeModal(true));
$('#modalCancel').addEventListener('click', () => closeModal(false));
modal.addEventListener('cancel', event => { event.preventDefault(); closeModal(false); });
modal.addEventListener('click', event => { if (event.target === modal) closeModal(false); });
modal.addEventListener('close', () => {
  if (finishModal) closeModal(false);
  else if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
});

function routeHash(route) {
  if (route.page === 'detail' || route.page === 'room' || route.page === 'edit') return `#${route.page}/${route.id}`;
  return `#${route.page}`;
}
function parseRoute(hash = location.hash) {
  const path = hash.replace(/^#/, '');
  if (!path || path === 'studies') return { page: 'studies' };
  if (['login', 'mine', 'new'].includes(path)) return { page: path };
  const match = path.match(/^(detail|room|edit)\/([1-9]\d*)$/);
  if (match && Number.isSafeInteger(Number(match[2]))) return { page: match[1], id: Number(match[2]) };
  return { page: 'studies', invalid: true };
}
function navigate(page, { id = null, replace = false } = {}) {
  const route = { page, ...(id === null ? {} : { id }) };
  const hash = routeHash(route);
  if (location.hash === hash) {
    renderRoute(route);
    return;
  }
  if (replace) history.replaceState({ studyboard: true, route }, '', hash);
  else location.hash = hash;
}
function showPage(route) {
  const pageId = ['new', 'edit'].includes(route.page) ? 'studyFormPage' : `${route.page}Page`;
  $$('.page').forEach(section => { section.hidden = section.id !== pageId; });
  const composing = ['new', 'edit'].includes(route.page);
  $('#createStudyButton').classList.toggle('navActive', composing);
  if (composing) $('#createStudyButton').setAttribute('aria-current', 'page');
  else $('#createStudyButton').removeAttribute('aria-current');
  $$('[data-page]').forEach(button => {
    const active = button.dataset.page === route.page;
    button.classList.toggle('navActive', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
}
async function renderRoute(route = parseRoute()) {
  if (route.invalid) {
    history.replaceState({ studyboard: true, route: { page: 'studies' } }, '', '#studies');
    route = { page: 'studies' };
    notice('주소를 확인할 수 없어 모집글 목록을 열었습니다.');
  }
  if (['new', 'edit'].includes(route.page) && !me) {
    navigate('login', { replace: true });
    notice('모집글을 쓰거나 수정하려면 로그인해 주세요.');
    return;
  }
  showPage(route);
  if (route.page === 'studies') await loadStudies();
  if (route.page === 'mine') await loadMine();
  if (route.page === 'detail') await openStudy(route.id);
  if (route.page === 'room') await openRoom(route.id);
  if (route.page === 'new') loadStudyForm();
  if (route.page === 'edit') await loadStudyForm(route.id);
}

window.addEventListener('hashchange', () => renderRoute());
window.addEventListener('popstate', () => renderRoute());
$$('[data-page]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.page)));
$$('[data-back]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.back)));
$('#brandLink').addEventListener('click', event => {
  event.preventDefault();
  $('#searchForm').reset();
  if (location.hash === '#studies' || !location.hash) loadStudies();
  else navigate('studies');
});
$('#createStudyButton').addEventListener('click', () => navigate('new'));

function refreshAuth() {
  $('#authNav').textContent = me ? `${me.displayName} 님` : '로그인';
  $('#authNav').dataset.page = me ? 'mine' : 'login';
  $('#mineHeading').textContent = me ? `${me.displayName} 님의 활동` : '내 활동';
  $('#logout').hidden = !me;
  $('#createStudyButton').hidden = !me;
}
$('#logout').addEventListener('click', () => {
  token = null;
  me = null;
  localStorage.removeItem('sb-token');
  localStorage.removeItem('sb-user');
  refreshAuth();
  navigate('studies');
  notice('로그아웃했습니다.');
});

function formErrors(form, values = {}) {
  $$('[data-error-for]', form).forEach(node => { node.textContent = ''; });
  for (const [key, message] of Object.entries(values)) {
    const node = $(`[data-error-for="${key}"]`, form);
    if (node) node.textContent = message;
  }
}
function showFormError(form, error) {
  formErrors(form, { form: error.message });
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  formErrors(form);
  const password = String(new FormData(form).get('password') || '');
  if (utf8Bytes(password) > 72) {
    formErrors(form, { login: '비밀번호는 UTF-8 기준 72바이트 이하로 입력해 주세요.' });
    return;
  }
  await withBusy(event.submitter, async () => {
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      token = result.accessToken;
      me = result.user;
      localStorage.setItem('sb-token', token);
      localStorage.setItem('sb-user', JSON.stringify(me));
      refreshAuth();
      navigate('studies');
      notice('로그인했습니다.');
    } catch (error) { formErrors(form, { login: error.message }); }
  });
});
$('#signupForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  formErrors(form);
  const data = Object.fromEntries(new FormData(form));
  const errors = {};
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(data.username || '')) errors.signup = '아이디는 영문·숫자·밑줄 3~30자여야 합니다.';
  else if (!data.displayName?.trim()) errors.signup = '이름을 입력해 주세요.';
  else if (Array.from(data.password || '').length < 8) errors.signup = '비밀번호는 8자 이상이어야 합니다.';
  else if (utf8Bytes(data.password || '') > 72) errors.signup = '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.';
  else if ((data.password || '').toLowerCase() === (data.username || '').toLowerCase()) errors.signup = '아이디와 같은 비밀번호는 사용할 수 없습니다.';
  else if (commonPasswords.has((data.password || '').toLowerCase())) errors.signup = '자주 사용되는 비밀번호는 사용할 수 없습니다.';
  if (Object.keys(errors).length) { formErrors(form, errors); return; }
  await withBusy(event.submitter, async () => {
    try {
      await api('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
      form.reset();
      notice('가입이 완료됐습니다. 로그인해 주세요.');
    } catch (error) { formErrors(form, { signup: error.message }); }
  });
});

function studyStatusLabel(status) { return STUDY_LABELS[status] || '상태 확인'; }
function studyStatusText(study) {
  const closeLabels = { FULL: '정원 마감', DEADLINE: '기간 만료', MANUAL: '스터디장 마감' };
  return study.status === 'CLOSED' && closeLabels[study.close_reason]
    ? `${studyStatusLabel(study.status)} · ${closeLabels[study.close_reason]}`
    : studyStatusLabel(study.status);
}
function appStatusLabel(status) { return APP_LABELS[status] || '상태 확인'; }
function dateTime(value) {
  if (!value) return '—';
  const parsed = new Date(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.valueOf()) ? String(value) : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}
function defaultDeadline() {
  const deadline = new Date(`${today()}T00:00:00.000Z`);
  deadline.setUTCDate(deadline.getUTCDate() + 28);
  return deadline.toISOString().slice(0, 10);
}
function updateTitleCount() {
  $('#titleCount').textContent = `${Array.from($('#studyTitle').value).length}/100자`;
}
$('#studyTitle').addEventListener('input', updateTitleCount);

async function loadStudies() {
  try {
    const filters = Object.fromEntries(new FormData($('#searchForm')));
    const studies = await api(`/studies?search=${encodeURIComponent(filters.search || '')}&sort=${filters.sort || 'latest'}`);
    if (!studies.length) {
      const hasSearch = Boolean(filters.search?.trim());
      $('#studyList').innerHTML = `<div class="emptyState"><p>${hasSearch ? '검색 결과가 없습니다.' : '아직 모집글이 없습니다.'}</p><p>${hasSearch ? '검색어를 바꾸거나 검색을 초기화해 보세요.' : '첫 스터디 모집을 시작해 보세요.'}</p>${hasSearch ? '<button type="button" id="clearSearch" class="buttonSecondary">검색 초기화</button>' : (me ? '<button type="button" id="emptyCreateStudy">모집글 작성</button>' : '')}</div>`;
      $('#clearSearch')?.addEventListener('click', () => { $('#searchForm').reset(); loadStudies(); });
      $('#emptyCreateStudy')?.addEventListener('click', () => navigate('new'));
      return;
    }
    $('#studyList').innerHTML = studies.map(study => {
      const recruiting = study.status === 'RECRUITING';
      const remaining = Math.max(0, study.capacity - study.member_count);
      return `<article class="studyCard">
        <div class="meta"><span class="badge badge-${esc(study.status.toLowerCase())}">${esc(studyStatusText(study))}</span><span>승인 ${study.member_count}/${study.capacity}명</span>${recruiting && remaining === 1 ? '<span class="openSeat">한 자리 남음</span>' : ''}</div>
        <h2>${esc(study.title)}</h2>
        <p class="cardDescription">${esc(study.description) || '스터디 소개가 없습니다.'}</p>
        <div class="meta"><span>스터디장 ${esc(study.owner_name)}</span><span>모집 마감 ${esc(study.deadline)}</span></div>
        <button type="button" data-open="${study.id}">상세 보기</button>
      </article>`;
    }).join('');
    $$('[data-open]').forEach(button => button.addEventListener('click', () => navigate('detail', { id: Number(button.dataset.open) })));
  } catch (error) { notice(error.message); }
}
$('#searchForm').addEventListener('submit', event => { event.preventDefault(); loadStudies(); });

async function loadStudyForm(id = null) {
  const form = $('#studyForm');
  form.reset();
  formErrors(form);
  form.dataset.studyId = id || '';
  form.dataset.mode = id ? 'edit' : 'new';
  $('#studyFormHeading').textContent = id ? '모집글 수정' : '모집글 작성';
  $('#saveStudyButton').textContent = id ? '수정 저장' : '모집글 등록';
  $('#studyCapacity').value = id ? '' : '3';
  $('#studyDeadline').min = today();
  $('#studyDeadline').value = defaultDeadline();
  if (!id) { updateTitleCount(); return; }
  try {
    const study = await api(`/studies/${id}`);
    if (!me || me.id !== study.owner_id || study.status !== 'RECRUITING') {
      await openModal({ title: '수정할 수 없습니다', message: '모집글 수정은 해당 스터디장이 모집중인 글에서만 할 수 있습니다.' });
      navigate('detail', { id, replace: true });
      return;
    }
    $('#studyTitle').value = study.title;
    $('#studyDescription').value = study.description || '';
    $('#studyCapacity').value = study.capacity;
    $('#studyDeadline').value = study.deadline;
    updateTitleCount();
  } catch (error) {
    showFormError(form, error);
  }
}
$('#studyForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  formErrors(form);
  const data = Object.fromEntries(new FormData(form));
  const errors = {};
  if (!data.title?.trim()) errors.title = '제목을 입력해 주세요.';
  else if (Array.from(data.title.trim()).length > 100) errors.title = '제목은 100자 이내로 입력해 주세요.';
  else if (utf8Bytes(data.title.trim()) > 300) errors.title = '제목은 UTF-8 기준 300바이트 이하여야 합니다.';
  if ((data.description || '').length > 1000) errors.description = '소개는 1,000자 이내로 입력해 주세요.';
  const capacity = Number(data.capacity);
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100) errors.capacity = '정원은 1~100명의 정수로 입력해 주세요.';
  if (!data.deadline || data.deadline < today()) errors.deadline = '오늘 이후의 모집 마감일을 선택해 주세요.';
  if (Object.keys(errors).length) { formErrors(form, errors); return; }
  const id = form.dataset.studyId;
  const edit = form.dataset.mode === 'edit';
  await withBusy(event.submitter, async () => {
    try {
      const result = await api(edit ? `/studies/${id}` : '/studies', {
        method: edit ? 'PATCH' : 'POST', body: JSON.stringify(data)
      });
      notice(edit ? '모집글을 수정했습니다.' : '모집글을 등록했습니다.');
      navigate('detail', { id: result.id || Number(id) });
    } catch (error) { showFormError(form, error); }
  });
});

function stageStepper(status) {
  const stages = [
    ['RECRUITING', '모집중'], ['CLOSED', '모집 마감'], ['ACTIVE', '진행중'], ['FINISHED', '종료']
  ];
  const index = stages.findIndex(([key]) => key === status);
  if (status === 'CANCELLED') return `<div class="stageStepper cancelledStage"><span class="stageCurrent">모집 취소</span><span class="stageNote">취소된 모집글은 추가 변경할 수 없습니다.</span></div>`;
  return `<ol class="stageStepper" aria-label="스터디 진행 단계">${stages.map(([key, label], i) => `<li class="${i < index ? 'stageDone' : ''} ${i === index ? 'stageCurrent' : ''}" ${i === index ? 'aria-current="step"' : ''}><span>${esc(label)}</span></li>`).join('')}</ol>`;
}
function actionButton(status, memberCount) {
  if (status === 'RECRUITING') return `<div class="statusActionGroup"><button type="button" data-study-status="CLOSED">모집 마감</button><button type="button" class="buttonSubtle" data-study-status="CANCELLED" ${memberCount ? 'aria-disabled="true"' : ''}>모집 취소</button></div>`;
  if (status === 'CLOSED') return `<button type="button" data-study-status="ACTIVE" ${memberCount < 1 ? 'aria-disabled="true"' : ''}>스터디 시작</button>`;
  if (status === 'ACTIVE') return '<button type="button" data-study-status="FINISHED">스터디 종료</button>';
  return '';
}
function stateConfirmation(status) {
  const copy = {
    CLOSED: ['모집 마감', '모집을 마감하면 새 지원을 받을 수 없습니다. 대기 지원서는 스터디장만 처리할 수 있습니다.'],
    ACTIVE: ['스터디 시작', '스터디를 시작하면 더 이상 대기 지원을 승인할 수 없습니다. 승인된 멤버가 작업을 진행할 수 있습니다.'],
    FINISHED: ['스터디 종료', '종료하면 스터디를 다시 시작할 수 없습니다. 새 작업 등록과 작업 상태 변경은 거절됩니다.'],
    CANCELLED: ['모집 취소', '모집 취소 시 대기 지원서는 모두 거절되고 모집글은 취소 상태로 보존됩니다.']
  };
  return copy[status];
}
function blockedStateReason(status, memberCount) {
  if (status === 'ACTIVE' && memberCount < 1) return '스터디를 시작하려면 승인된 멤버가 한 명 이상 필요합니다.';
  if (status === 'CANCELLED' && memberCount > 0) return '승인된 멤버가 있어 모집을 취소할 수 없습니다. 멤버와 지원 이력을 보존합니다.';
  return null;
}
function deleteReason(applicationCount, memberCount) {
  const reasons = [];
  if (applicationCount > 0) reasons.push(`지원 이력 ${applicationCount}건`);
  if (memberCount) reasons.push(`승인 멤버 ${memberCount}명`);
  return `${reasons.join('과 ')}이 있어 삭제할 수 없습니다. 지원 이력을 보존하기 위한 정책입니다. 모집중이고 승인 멤버가 없다면 '모집 취소'로 이력을 남길 수 있습니다.`;
}

async function openStudy(id) {
  const container = $('#studyDetail');
  try {
    const study = await api(`/studies/${id}`);
    currentStudy = study;
    const own = Boolean(me && me.id === study.owner_id);
    const myApplications = me && !own ? await api('/me/applications') : [];
    const myApplication = myApplications.find(application => application.study_id === id);
    const applications = own ? await api(`/studies/${id}/applications`) : [];
    const member = myApplication?.status === 'APPROVED';
    const remaining = Math.max(0, study.capacity - study.member_count);
    const canApply = Boolean(me && !own && isWithinRecruitment(study) && (!myApplication || myApplication.status === 'CANCELLED'));
    const canCancelApplication = myApplication?.status === 'PENDING' && isWithinRecruitment(study);
    const canDelete = applications.length === 0 && study.member_count === 0;
    const deleteVisible = own && !['FINISHED', 'CANCELLED'].includes(study.status);
    const decisionAllowed = study.status === 'RECRUITING' && study.deadline >= today();

    showPage({ page: 'detail' });
    const actionPanel = own ? `
      <section class="managementPanel" aria-labelledby="ownerActionsHeading">
        <div class="panelHeading"><div><p class="eyebrow">스터디장 관리</p><h2 id="ownerActionsHeading">다음 단계</h2></div></div>
        <div class="statusActions">${actionButton(study.status, study.member_count)}</div>
        <div class="ownerTools">
          ${study.status === 'RECRUITING' ? `<button type="button" class="buttonSecondary" id="editStudyButton">모집글 수정</button>` : ''}
          ${deleteVisible ? `<button type="button" class="buttonDangerOutline" id="deleteStudy" ${canDelete ? '' : 'aria-disabled="true"'}>모집글 삭제</button>` : ''}
        </div>
      </section>` : '';

    const applicantAction = !me && study.status === 'RECRUITING'
      ? '<div class="actionMessage"><p>지원을 하려면 로그인해 주세요.</p><button type="button" data-go-login>로그인</button></div>'
      : canApply
        ? `<form id="applicationForm" class="applicationForm"><label for="applicationMessage">지원 메시지 <span class="optionalLabel">선택</span></label><textarea id="applicationMessage" name="message" maxlength="500" rows="3" placeholder="참여하고 싶은 이유를 적어 주세요."></textarea><small class="helpText">500자 이내로 입력할 수 있습니다.</small><p class="fieldError" data-error-for="application"></p><button type="submit">${myApplication?.status === 'CANCELLED' ? '다시 지원하기' : '지원하기'}</button></form>`
        : myApplication
          ? `<div class="applicationState"><span class="statusBadge status-${esc(myApplication.status.toLowerCase())}">내 지원: ${esc(appStatusLabel(myApplication.status))}</span>${canCancelApplication ? '<button type="button" class="buttonSecondary" id="cancelMyApplication">지원 취소</button>' : ''}${member ? `<button type="button" id="openMyRoom">스터디 방 열기</button>` : ''}</div>`
          : study.status !== 'RECRUITING'
            ? `<p class="actionMessage">${study.status === 'CLOSED' ? '모집이 마감되어 새 지원을 받지 않습니다.' : '현재 지원할 수 없는 모집글입니다.'}</p>`
            : '';

    const applicationRows = applications.map(application => {
      const processed = application.decided_at
        ? `<p class="applicationMeta">처리: ${esc(application.decided_by_name || '스터디장')} · ${esc(dateTime(application.decided_at))}</p>`
        : application.status !== 'PENDING'
          ? `<p class="applicationMeta">상태 변경: ${esc(dateTime(application.updated_at))}</p>` : '';
      const canDecide = application.status === 'PENDING' && decisionAllowed;
      const approveBlocked = study.member_count >= study.capacity;
      return `<article class="applicationRow">
        <div class="applicationIdentity"><strong>${esc(application.display_name)}</strong><span class="statusBadge status-${esc(application.status.toLowerCase())}">${esc(appStatusLabel(application.status))}</span></div>
        <p class="applicationMessage">${esc(application.message) || '지원 메시지를 작성하지 않았습니다.'}</p>
        <p class="applicationMeta">지원: ${esc(dateTime(application.created_at))}</p>${processed}
        ${canDecide ? `<div class="row applicationActions"><button type="button" data-decide="approve" data-id="${application.id}" ${approveBlocked ? 'disabled title="정원이 모두 찼습니다. 더 이상 승인할 수 없습니다."' : ''}>승인</button><button type="button" class="buttonSecondary" data-decide="reject" data-id="${application.id}">거절</button></div>` : ''}
      </article>`;
    }).join('');

    container.innerHTML = `
      <article class="card detailCard">
        ${stageStepper(study.status)}
        <div class="meta detailMeta"><span class="badge badge-${esc(study.status.toLowerCase())}">${esc(studyStatusText(study))}</span><span>승인 인원 ${study.member_count}/${study.capacity}명</span>${study.status === 'RECRUITING' ? `<span>남은 자리 ${remaining}명</span>` : ''}</div>
        <h1>${esc(study.title)}</h1>
        <div class="detailDescription">${esc(study.description) || '스터디 소개가 없습니다.'}</div>
        <dl class="studyFacts">
          <div><dt>스터디장</dt><dd>${esc(study.owner_name)}</dd></div>
          <div><dt>모집 마감일</dt><dd>${esc(study.deadline)}</dd></div>
          <div><dt>등록일</dt><dd>${esc(dateTime(study.created_at))}</dd></div>
          <div><dt>승인 인원</dt><dd>${study.member_count}명 / 정원 ${study.capacity}명</dd></div>
        </dl>
        ${own ? '<p class="ownerLabel">내가 작성한 모집글</p>' : ''}
        ${applicantAction ? `<section class="applicantActions" aria-label="지원 행동">${applicantAction}</section>` : ''}
        ${own && study.status !== 'FINISHED' && study.status !== 'CANCELLED' ? `<div class="detailRoomAction"><button type="button" id="openOwnerRoom" class="buttonSecondary">스터디 방 열기</button></div>` : ''}
      </article>
      ${actionPanel}
      ${own ? `<section class="card applicationsPanel"><div class="panelHeading"><div><p class="eyebrow">지원 현황</p><h2>지원자 관리</h2></div><span>${applications.length}명</span></div>
        ${study.status === 'CLOSED' && applications.some(application => application.status === 'PENDING') ? `<p class="capacityNotice" role="status">${esc(studyStatusText(study))} 상태입니다. 남은 대기 지원은 승인할 수 없으며 스터디 시작 시 거절 처리됩니다.</p>` : study.close_reason === 'FULL' ? '<p class="capacityNotice" role="status">정원이 모두 찼습니다. 남은 대기 지원서는 거절 처리되었습니다.</p>' : study.member_count >= study.capacity ? '<p class="capacityNotice" role="status">정원이 모두 찼습니다. 더 이상 승인할 수 없습니다.</p>' : ''}
        ${applications.length ? `<div class="applicationList">${applicationRows}</div>` : '<div class="emptyState compactEmpty">아직 지원자가 없습니다.</div>'}
      </section>` : ''}`;

    $('#editStudyButton')?.addEventListener('click', () => navigate('edit', { id }));
    $('#openOwnerRoom')?.addEventListener('click', () => navigate('room', { id }));
    $('#openMyRoom')?.addEventListener('click', () => navigate('room', { id }));
    $('[data-go-login]')?.addEventListener('click', () => navigate('login'));

    $('#applicationForm')?.addEventListener('submit', event => submitApplication(event, id, myApplication));
    $('#cancelMyApplication')?.addEventListener('click', event => withBusy(event.currentTarget, async () => {
      try {
        await api(`/applications/${myApplication.id}/cancel`, { method: 'PATCH', body: '{}' });
        notice('지원을 취소했습니다.');
        await openStudy(id);
      } catch (error) { openModal({ title: '지원 취소 실패', message: error.message }); }
    }));

    $$('[data-study-status]').forEach(button => button.addEventListener('click', () => changeStudyStatus(button, id, study)));
    $('#deleteStudy')?.addEventListener('click', button => deleteStudy(button.currentTarget, id, canDelete, applications.length, study.member_count));
    $$('[data-decide]').forEach(button => button.addEventListener('click', () => decideApplication(button, id)));
  } catch (error) {
    showPage({ page: 'detail' });
    container.innerHTML = `<div class="emptyState errorState"><h1>모집글을 열 수 없습니다</h1><p>${esc(error.message)}</p><a class="button" href="#studies">모집글 목록으로 이동</a></div>`;
  }
}

async function submitApplication(event, studyId, previous) {
  event.preventDefault();
  const form = event.currentTarget;
  formErrors(form);
  const message = String(new FormData(form).get('message') || '').trim();
  if (message.length > 500) { formErrors(form, { application: '지원 메시지는 500자 이내로 입력해 주세요.' }); return; }
  await withBusy(event.submitter, async () => {
    try {
      await api(`/studies/${studyId}/applications`, { method: 'POST', body: JSON.stringify({ message }) });
      notice(previous?.status === 'CANCELLED' ? '다시 지원했습니다.' : '지원했습니다.');
      await openStudy(studyId);
    } catch (error) { formErrors(form, { application: error.message }); }
  });
}

async function changeStudyStatus(button, studyId, study) {
  const next = button.dataset.studyStatus;
  const blockedReason = button.getAttribute('aria-disabled') === 'true' ? blockedStateReason(next, study.member_count) : null;
  if (blockedReason) {
    await openModal({ title: '아직 진행할 수 없습니다', message: blockedReason });
    return;
  }
  const [title, message] = stateConfirmation(next);
  const confirmed = await openModal({ title, message, confirmText: title, cancelText: '취소' });
  if (!confirmed) return;
  await withBusy(button, async () => {
    try {
      await api(`/studies/${studyId}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      notice(`${title} 처리했습니다.`);
      await openStudy(studyId);
    } catch (error) {
      await openModal({ title: `${title} 실패`, message: error.message });
    }
  });
}

async function deleteStudy(button, studyId, canDelete, applicationCount, memberCount) {
  if (button.getAttribute('aria-disabled') === 'true' || !canDelete) {
    await openModal({ title: '모집글을 삭제할 수 없습니다', message: deleteReason(applicationCount, memberCount) });
    return;
  }
  const confirmed = await openModal({
    title: '모집글을 삭제할까요?',
    message: '이 모집글은 지원 이력과 멤버가 없습니다. 삭제하면 되돌릴 수 없습니다.',
    confirmText: '삭제', cancelText: '취소', danger: true, eyebrow: '되돌릴 수 없는 작업'
  });
  if (!confirmed) return;
  await withBusy(button, async () => {
    try {
      await api(`/studies/${studyId}`, { method: 'DELETE' });
      notice('모집글을 삭제했습니다.');
      navigate('studies');
    } catch (error) {
      await openModal({ title: '모집글을 삭제할 수 없습니다', message: error.message });
    }
  });
}

async function decideApplication(button, studyId) {
  const action = button.dataset.decide;
  await withBusy(button, async () => {
    try {
      await api(`/applications/${button.dataset.id}/${action}`, { method: 'PATCH', body: '{}' });
      notice(action === 'approve' ? '지원자를 승인했습니다.' : '지원자를 거절했습니다.');
      await openStudy(studyId);
    } catch (error) {
      await openModal({ title: action === 'approve' ? '승인할 수 없습니다' : '거절할 수 없습니다', message: error.message });
    }
  });
}

async function loadMine() {
  if (!me) {
    $('#myStudies').innerHTML = '<div class="emptyState"><p>내 활동을 보려면 로그인해 주세요.</p><button type="button" id="mineLogin">로그인</button></div>';
    $('#myApps').innerHTML = '';
    $('#mineLogin')?.addEventListener('click', () => navigate('login'));
    return;
  }
  try {
    const [studies, applications] = await Promise.all([api('/me/studies'), api('/me/applications')]);
    $('#myStudies').innerHTML = studies.length ? studies.map(study => `<article class="studyCard"><div class="meta"><span class="badge badge-${esc(study.status.toLowerCase())}">${esc(studyStatusText(study))}</span><span>${study.member_count}/${study.capacity}명</span></div><h2>${esc(study.title)}</h2><button type="button" data-room="${study.id}">스터디 방 열기</button><button type="button" class="buttonSecondary" data-detail="${study.id}">상세 보기</button></article>`).join('') : '<div class="emptyState"><p>참여 중인 스터디가 없습니다.</p></div>';
    $('#myApps').innerHTML = applications.length ? applications.map(application => `<article class="studyCard"><div class="meta"><span class="statusBadge status-${esc(application.status.toLowerCase())}">${esc(appStatusLabel(application.status))}</span></div><h2>${esc(application.study_title)}</h2><p>모집 상태: ${esc(studyStatusText({ status: application.study_status, close_reason: application.study_close_reason }))}</p><button type="button" data-app-detail="${application.study_id}">모집글 보기</button>${application.status === 'PENDING' && isWithinRecruitment({ status: application.study_status, deadline: application.study_deadline }) ? `<button type="button" class="buttonSecondary" data-cancel="${application.id}">지원 취소</button>` : ''}${application.status === 'CANCELLED' && isWithinRecruitment({ status: application.study_status, deadline: application.study_deadline }) ? `<button type="button" class="buttonSecondary" data-reapply="${application.study_id}">다시 지원</button>` : ''}${application.status === 'APPROVED' ? `<button type="button" data-room="${application.study_id}">스터디 방 열기</button><button type="button" class="buttonSecondary" data-leave="${application.study_id}">스터디 탈퇴</button>` : ''}</article>`).join('') : '<div class="emptyState"><p>지원 내역이 없습니다.</p></div>';
    $$('[data-room]').forEach(button => button.addEventListener('click', () => navigate('room', { id: Number(button.dataset.room) })));
    $$('[data-detail], [data-app-detail]').forEach(button => button.addEventListener('click', () => navigate('detail', { id: Number(button.dataset.detail || button.dataset.appDetail) })));
    $$('[data-cancel]').forEach(button => button.addEventListener('click', () => mutate(`/applications/${button.dataset.cancel}/cancel`, '지원 취소', button)));
    $$('[data-reapply]').forEach(button => button.addEventListener('click', () => navigate('detail', { id: Number(button.dataset.reapply) })));
    $$('[data-leave]').forEach(button => button.addEventListener('click', () => mutate(`/studies/${button.dataset.leave}/leave`, '스터디 탈퇴', button)));
  } catch (error) { notice(error.message); }
}

async function mutate(path, label, button) {
  await withBusy(button, async () => {
    try { await api(path, { method: 'PATCH', body: '{}' }); notice(`${label}했습니다.`); await loadMine(); }
    catch (error) { await openModal({ title: `${label}할 수 없습니다`, message: error.message }); }
  });
}

async function openRoom(id) {
  try {
    const [study, tasks, progress, participants] = await Promise.all([
      api(`/studies/${id}`), api(`/studies/${id}/tasks`), api(`/studies/${id}/progress`), api(`/studies/${id}/participants`)
    ]);
    currentStudy = study;
    const owner = me?.id === study.owner_id;
    const canManageTasks = study.status === 'ACTIVE';
    const visibleTasks = tasks.filter(task => !task.archived);
    const archivedTasks = tasks.filter(task => task.archived);
    const participantList = participants.map(person => `<li><strong>${esc(person.display_name)}</strong><span>${person.role === 'OWNER' ? '스터디장' : '멤버'} · 담당 작업 ${person.assigned_task_count}개</span></li>`).join('');
    const taskCard = task => `<article class="taskCard"><div class="taskCardHeading"><strong>${esc(task.title)}</strong><span class="statusBadge status-task-${esc(task.status)}">${({ todo: '할 일', doing: '진행 중', done: '완료' })[task.status] || '상태 확인'}</span></div>${task.description ? `<p class="taskDescription">${esc(task.description)}</p>` : ''}<p class="taskMeta">${esc(task.assignee_name || '미배정')} · 마감 ${esc(task.due_date || '없음')}${task.archived ? ' · 보관됨' : ''}</p>${canManageTasks && !task.archived ? `<div class="row taskActions">${task.status !== 'done' ? `<button type="button" data-next="${task.id}" data-status="${task.status === 'todo' ? 'doing' : 'done'}">${task.status === 'todo' ? '진행 시작' : '완료'}</button>` : ''}<button type="button" class="buttonSecondary" data-delete-task="${task.id}">${task.status === 'todo' ? '삭제' : '보관'}</button></div>` : ''}</article>`;
    const columns = [
      ['todo', '할 일'], ['doing', '진행 중'], ['done', '완료']
    ].map(([status, label]) => `<section class="taskColumn" aria-label="${label} 작업"><div class="taskColumnHeading"><h3>${label}</h3><span>${visibleTasks.filter(task => task.status === status).length}</span></div>${visibleTasks.filter(task => task.status === status).map(taskCard).join('') || '<p class="taskColumnEmpty">작업이 없습니다.</p>'}</section>`).join('');
    showPage({ page: 'room' });
    $('#room').innerHTML = `<p class="eyebrow">스터디 작업 공간</p><h1>${esc(study.title)}</h1><p class="roomStudyState">현재 상태: ${esc(studyStatusText(study))}</p><section class="card participantPanel"><h2>스터디 참여자</h2><ul class="participantList">${participantList}</ul></section>
      <section class="card progressCard"><div class="row progressHeading"><strong>진행률</strong><span>${progress.percentage}% · ${progress.done}/${progress.total} 완료</span></div><div class="progress" role="progressbar" aria-valuenow="${progress.percentage}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress.percentage}%"></span></div></section>
      ${canManageTasks ? `<form id="newTask" class="card taskForm"><h2>작업 등록</h2><label for="taskTitle">작업 제목 <span class="requiredMark">필수</span></label><input id="taskTitle" name="title" maxlength="120" required><label for="taskDescription">설명 <span class="optionalLabel">선택</span></label><textarea id="taskDescription" name="description" maxlength="1000" rows="3"></textarea><label for="taskDueDate">마감일 <span class="optionalLabel">선택</span></label><input id="taskDueDate" name="dueDate" type="date">${owner ? `<label for="taskAssignee">담당자 <span class="optionalLabel">선택</span></label><select id="taskAssignee" name="assigneeId">${participants.map(person => `<option value="${person.id}" ${person.id === study.owner_id ? 'selected' : ''}>${esc(person.display_name)} (${person.role === 'OWNER' ? '스터디장' : '멤버'})</option>`).join('')}</select>` : '<p class="helpText">등록한 작업은 기본으로 본인이 담당합니다.</p>'}<p class="fieldError" data-error-for="task"></p><button type="submit">작업 추가</button></form>` : `<p class="actionMessage">${study.status === 'FINISHED' || study.status === 'CANCELLED' ? '종료된 스터디는 읽기 전용입니다.' : '스터디장이 시작하면 작업을 등록하고 진행할 수 있습니다.'}</p>`}
      ${!tasks.length ? '<div class="emptyState compactEmpty"><p>등록된 작업이 없습니다.</p></div>' : ''}<section class="taskBoard"><h2>작업 보드</h2><div class="taskColumns">${columns}</div></section>${archivedTasks.length ? `<section class="card archivedTasks"><h2>보관한 작업</h2>${archivedTasks.map(taskCard).join('')}</section>` : ''}`;
    $('#newTask')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      await withBusy(event.submitter, async () => {
        try { await api(`/studies/${id}/tasks`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); notice('작업을 등록했습니다.'); await openRoom(id); }
        catch (error) { formErrors(form, { task: error.message }); }
      });
    });
    $$('[data-next]').forEach(button => button.addEventListener('click', () => withBusy(button, async () => {
      try { await api(`/tasks/${button.dataset.next}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) }); notice('작업 상태를 변경했습니다.'); await openRoom(id); }
      catch (error) { await openModal({ title: '작업을 변경할 수 없습니다', message: error.message }); }
    })));
    $$('[data-delete-task]').forEach(button => button.addEventListener('click', () => withBusy(button, async () => {
      try { const result = await api(`/tasks/${button.dataset.deleteTask}`, { method: 'DELETE' }); notice(result.deleted ? '작업을 삭제했습니다.' : '작업을 보관했습니다.'); await openRoom(id); }
      catch (error) { await openModal({ title: '작업을 처리할 수 없습니다', message: error.message }); }
    })));
  } catch (error) {
    showPage({ page: 'room' });
    $('#room').innerHTML = `<div class="emptyState errorState"><h1>스터디 방을 열 수 없습니다</h1><p>${esc(error.message)}</p><a class="button" href="#studies">모집글 목록으로 이동</a></div>`;
  }
}

refreshAuth();
if (!location.hash) history.replaceState({ studyboard: true, route: { page: 'studies' } }, '', '#studies');
renderRoute(parseRoute());

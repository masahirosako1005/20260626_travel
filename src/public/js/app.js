const CAT_ICON = {
  '歴史・文化': '🏯', '自然・景観': '🌿', 'グルメ': '🍜', '買い物': '🛍️',
  '体験・アクティビティ': '🎨', '温泉・宿泊': '♨️', 'ファミリー向け': '👨‍👩‍👧', '地元民おすすめ': '🏠'
};

let currentUserId = null;
let currentTab = 'home';
let allUsersCache = [];

async function api(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function loadUsers() {
  try {
    const users = await api('/api/admin/users');
    allUsersCache = users;
    const sel = document.getElementById('userSelect');
    sel.innerHTML = '<option value="">ユーザーを選択してください</option>';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.user_id;
      opt.textContent = `${u.nickname} (${u.user_id})`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error('ユーザー読込失敗', e);
  }
}

document.getElementById('userSelect').addEventListener('change', e => {
  currentUserId = e.target.value;
  if (currentUserId) loadTab(currentTab);
  else clearTab(currentTab);
});

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + tab).classList.add('active');
  document.querySelectorAll('.nav-item')[['home','replay','incomplete','routes','attachment'].indexOf(tab)].classList.add('active');
  if (currentUserId) loadTab(tab);
}

async function loadTab(tab) {
  if (!currentUserId) return;
  try {
    if (tab === 'home') await loadHome();
    else if (tab === 'replay') await loadReplay();
    else if (tab === 'incomplete') await loadIncomplete();
    else if (tab === 'routes') await loadRoutes();
    else if (tab === 'attachment') await loadAttachment();
  } catch (e) {
    document.getElementById(tab + 'Content') && (document.getElementById(tab + 'Content').innerHTML = `<div class="card" style="color:red">エラー: ${e.message}</div>`);
  }
}

function clearTab(tab) {
  const msg = '<div class="loading">ユーザーを選択してください</div>';
  ['home','replay','incomplete','routes','attachment'].forEach(t => {
    const el = document.getElementById(t + 'Content');
    if (el) el.innerHTML = msg;
  });
}

// =========== HOME ===========
async function loadHome() {
  const el = document.getElementById('homeContent');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  const d = await api(`/api/users/${currentUserId}/home`);

  let html = `
    <div class="home-hero">
      <h2>おかえりなさい、${d.user.nickname}さん</h2>
      <p>${d.user.user_segment || '観光客'}</p>
      <div class="hero-level">Lv.${d.attachment.level} ${d.attachment.title}</div>
    </div>`;

  // 前回の旅
  if (d.lastVisitSummary) {
    html += `<div class="card">
      <div class="card-header"><span class="card-title">📖 前回の旅</span><button class="btn btn-outline btn-sm" onclick="switchTab('replay')">すべて見る</button></div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${d.lastVisitSummary.date}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">${d.lastVisitSummary.spots.slice(0,3).join(' → ')}${d.lastVisitSummary.spots.length > 3 ? ' ...' : ''}</div>
      <div style="display:flex;gap:12px;">
        <div class="stat-item"><div class="stat-value">${d.lastVisitSummary.spotCount}</div><div class="stat-label">スポット</div></div>
        <div class="stat-item"><div class="stat-value">${d.lastVisitSummary.stampCount}</div><div class="stat-label">スタンプ</div></div>
      </div>
    </div>`;
  }

  // 未完了ラリー
  if (d.incompleteRallyCount > 0) {
    html += `<div class="card">
      <div class="card-header"><span class="card-title">📋 未完了ラリー</span><button class="btn btn-outline btn-sm" onclick="switchTab('incomplete')">詳細を見る</button></div>
      <div style="font-size:15px;font-weight:700;color:var(--primary);">${d.incompleteRallyCount}件の未完了ラリーがあります</div>`;
    if (d.topIncompleteRally) {
      const rate = Math.round(d.topIncompleteRally.completionRate * 100);
      html += `<div style="margin-top:8px;font-size:13px;">${d.topIncompleteRally.name}：${rate}% 完了</div>
        <div class="progress-bar-wrap" style="margin-top:6px;"><div class="progress-bar" style="width:${rate}%"></div></div>`;
    }
    html += '</div>';
  }

  // 今日のおすすめ
  if (d.todayRoute) {
    html += `<div class="card">
      <div class="card-header"><span class="card-title">🗺️ 今日のおすすめ</span><button class="btn btn-outline btn-sm" onclick="switchTab('routes')">すべて見る</button></div>
      <div style="font-size:15px;font-weight:700;margin-bottom:8px;">${d.todayRoute.label} (${d.todayRoute.estimatedMinutes}分)</div>
      ${d.todayRoute.spots.map((s,i) => `<div class="route-spot"><span class="spot-num">${i+1}</span><span>${CAT_ICON[s.category]||'📍'} ${s.name}</span><span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${s.avg_minutes}分</span></div>`).join('')}
    </div>`;
  }

  // 利用可能特典
  if (d.availableBenefits?.length > 0) {
    html += `<div class="card">
      <div class="card-header"><span class="card-title">🎁 利用可能な特典</span></div>
      ${d.availableBenefits.map(b => `<div class="spot-item">
        <div class="spot-icon">🎁</div>
        <div class="spot-info"><div class="spot-name">${b.name}</div><div class="spot-meta">${b.category} / ¥${b.estimated_value_yen}相当</div></div>
      </div>`).join('')}
    </div>`;
  }

  el.innerHTML = html;
}

// =========== REPLAY ===========
async function loadReplay() {
  const el = document.getElementById('replayContent');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  const d = await api(`/api/users/${currentUserId}/replay`);

  if (!d.sessions || d.sessions.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🗺️</div><div>訪問記録がありません</div></div>';
    return;
  }

  let html = `<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">${d.sessions.length}回の旅の記録があります</div>`;

  d.sessions.forEach((sess, idx) => {
    html += `<div class="session-card">
      <div class="session-header">
        <div class="session-date">第${d.sessions.length - idx}回の旅 ・ ${sess.date || '日付不明'}</div>
        <div class="session-meta">${sess.spots.length}ヶ所 / スタンプ${sess.stampCount}個</div>
      </div>
      <div class="session-body">
        ${sess.spots.map((s, i) => `<div class="spot-item" style="padding:8px 0;">
          <div class="spot-icon" style="width:36px;height:36px;font-size:18px;">${CAT_ICON[s.category]||'📍'}</div>
          <div class="spot-info">
            <div class="spot-name" style="font-size:14px;">${i+1}. ${s.name}</div>
            <div class="spot-meta">${s.stay_minutes}分滞在${s.stamp ? ' ・ <span class="tag tag-stamp">スタンプ✓</span>' : ''}${s.benefit ? ` ・ 特典「${s.benefit}」利用` : ''}</div>
          </div>
        </div>`).join('')}
        ${sess.passSpots.length > 0 ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">通過：${sess.passSpots.join('、')}</div>` : ''}
        <div class="session-comment">💭 ${sess.comment}</div>
      </div>
    </div>`;
  });

  el.innerHTML = html;
}

// =========== INCOMPLETE ===========
async function loadIncomplete() {
  const el = document.getElementById('incompleteContent');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  const d = await api(`/api/users/${currentUserId}/incomplete`);

  let html = '';

  if (d.incompleteRallies.length === 0 && d.unvisitedSpots.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><div>すべて完了済みです！素晴らしい！</div></div>';
    return;
  }

  if (d.incompleteRallies.length > 0) {
    html += `<div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">未完了ラリー (${d.incompleteRallies.length}件)</div>`;
    d.incompleteRallies.forEach(r => {
      const rate = Math.round(r.completionRate * 100);
      html += `<div class="rally-card">
        <div class="rally-name">${r.name}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">完了率 ${rate}% ・ 残り${r.remaining.length}スポット・推定${r.estimatedMinutes}分</div>
        <div class="progress-bar-wrap"><div class="progress-bar" style="width:${rate}%"></div></div>
        <div class="rally-progress">
          ${r.targets.map(sid => {
            const s = r.remainingSpots.find(sp => sp.spot_id === sid);
            const acquired = !s;
            const spot = acquired ? { spot_id: sid } : s;
            return `<div class="stamp-dot ${acquired ? 'acquired' : 'missing'}" title="${s?.name || sid}">${acquired ? '✓' : '○'}</div>`;
          }).join('')}
        </div>
        ${r.remainingSpots.length > 0 ? `<div style="margin-top:8px;">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">未取得スポット：</div>
          ${r.remainingSpots.map(s => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:14px;">
            <span>${CAT_ICON[s.category]||'📍'}</span>
            <span>${s.name}</span>
            <span style="font-size:11px;color:var(--text-muted);">${s.avg_minutes}分</span>
            <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="acquireStamp('${s.spot_id}','${r.rally_id}','${s.name}')">スタンプ取得</button>
          </div>`).join('')}
        </div>` : ''}
      </div>`;
    });
  }

  if (d.unvisitedSpots.length > 0) {
    html += `<div class="card">
      <div class="card-header"><span class="card-title">未訪問スポット (${d.unvisitedSpots.length}件)</span></div>
      ${d.unvisitedSpots.map(s => `<div class="spot-item">
        <div class="spot-icon">${CAT_ICON[s.category]||'📍'}</div>
        <div class="spot-info">
          <div class="spot-name">${s.name} <span class="tag tag-new">未訪問</span></div>
          <div class="spot-meta">${s.category} ・ ${s.area}エリア ・ ${s.avg_minutes}分</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="openSpotModal('${s.spot_id}')">詳細</button>
      </div>`).join('')}
    </div>`;
  }

  el.innerHTML = html;
}

// =========== ROUTES ===========
async function loadRoutes() {
  const el = document.getElementById('routesContent');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  const d = await api(`/api/users/${currentUserId}/recommendations`);

  if (!d.routes || d.routes.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🗺️</div><div>おすすめルートを生成できませんでした</div></div>';
    return;
  }

  let html = `<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">${d.user.nickname}さんへのパーソナライズルートです</div>`;

  d.routes.forEach(route => {
    if (!route.spots || route.spots.length === 0) return;
    html += `<div class="route-card">
      <div class="route-header">
        <div class="route-title">${route.label}</div>
        <div class="route-time">⏱ 約${route.estimatedMinutes}分</div>
      </div>
      <div class="route-body">
        ${route.spots.map((s, i) => `<div class="route-spot">
          <span class="spot-num">${i+1}</span>
          <div>
            <div>${CAT_ICON[s.category]||'📍'} ${s.name}</div>
            <div class="route-reason">${s.reasons?.slice(0,2).join(' ・ ')||''}</div>
          </div>
          <span style="font-size:11px;color:var(--text-muted);margin-left:auto;white-space:nowrap;">${s.avg_minutes}分</span>
        </div>`).join('')}
        <div style="margin-top:10px;text-align:right;">
          <button class="btn btn-primary btn-sm" onclick="markRouteUsed('${route.id}','${route.label}')">このルートを使う</button>
        </div>
      </div>
    </div>`;
  });

  el.innerHTML = html;
}

async function markRouteUsed(routeId, routeLabel) {
  try {
    const ru = {
      route_usage_id: `RU-${currentUserId}-${routeId}-${Date.now()}`,
      user_id: currentUserId,
      session_id: `SESS-${currentUserId}-WEB`,
      route_id: routeId,
      viewed_at: new Date().toISOString(),
      used: true
    };
    await post('/api/admin/import-json', { json: JSON.stringify({ route_usages: [ru] }) });
    alert(`「${routeLabel}」を使用中にしました！`);
  } catch (e) {
    alert('エラー: ' + e.message);
  }
}

// =========== ATTACHMENT ===========
async function loadAttachment() {
  const el = document.getElementById('attachmentContent');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  const d = await api(`/api/users/${currentUserId}/attachment`);
  const a = d.attachment;

  const nextInfo = a.nextLevelScore ? `次のレベルまで: ${a.nextLevelScore - a.score}点` : '最高レベル達成！';

  let html = `<div class="card">
    <div class="attachment-score-big">
      <div class="score-number">${a.score}</div>
      <div class="score-label">地域愛着スコア</div>
      <div class="level-badge">Lv.${a.level} ${a.title}</div>
      <div class="progress-bar-wrap" style="margin: 10px 0;">
        <div class="progress-bar" style="width:${a.progress}%"></div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);">${nextInfo}</div>
    </div>
    <div class="stats-grid" style="margin-top:16px;">
      <div class="stat-item"><div class="stat-value">${a.visitedSpotCount}</div><div class="stat-label">訪問スポット</div></div>
      <div class="stat-item"><div class="stat-value">${a.stampCount}</div><div class="stat-label">スタンプ</div></div>
      <div class="stat-item"><div class="stat-value">${a.benefitUseCount}</div><div class="stat-label">特典利用</div></div>
      <div class="stat-item"><div class="stat-value">${a.completedRallyCount}</div><div class="stat-label">完了ラリー</div></div>
      <div class="stat-item"><div class="stat-value">${a.revisitCount}</div><div class="stat-label">再訪回数</div></div>
      <div class="stat-item"><div class="stat-value">${Math.round(a.totalStayMinutes/60*10)/10}h</div><div class="stat-label">総滞在時間</div></div>
    </div>
  </div>`;

  html += `<div class="card">
    <div class="card-header"><span class="card-title">ユーザータイプ</span></div>
    <div style="font-size:18px;font-weight:800;color:var(--primary);margin:8px 0;">${a.userType}</div>
    <div style="font-size:13px;color:var(--text-muted);">${userTypeDesc(a.userType)}</div>
  </div>`;

  if (a.badges.length > 0) {
    html += `<div class="card">
      <div class="card-header"><span class="card-title">獲得バッジ</span></div>
      <div class="badges-list">${a.badges.map(b => `<div class="badge-chip">🏅 ${b}</div>`).join('')}</div>
    </div>`;
  }

  el.innerHTML = html;
}

function userTypeDesc(type) {
  const m = {
    'コンプリート型': 'スタンプ収集が得意！ラリー完了を目指して精力的に巡ります。',
    'じっくり滞在型': '一ヶ所でのんびり過ごすのが好き。体験・文化スポットでの滞在が長いです。',
    '回遊型': '多くのスポットを効率よく巡る行動派。エリアを広く歩き回ります。',
    'グルメ・特典型': 'グルメと特典利用が得意！食とお得なサービスを楽しみます。',
    '再発見型': '地元や近隣エリアを短時間で楽しむスタイル。季節のイベントにも積極的です。'
  };
  return m[type] || '';
}

// =========== STAMP ===========
async function acquireStamp(spotId, rallyId, spotName) {
  if (!currentUserId) return alert('ユーザーを選択してください');
  if (!confirm(`「${spotName}」のスタンプを取得しますか？`)) return;
  try {
    await post(`/api/users/${currentUserId}/stamps`, { spot_id: spotId, rally_id: rallyId });
    alert(`「${spotName}」のスタンプを取得しました！`);
    await loadIncomplete();
  } catch (e) {
    const msg = e.message.includes('409') ? 'このスタンプはすでに取得済みです' : e.message;
    alert(msg);
  }
}

// =========== SPOT MODAL ===========
async function openSpotModal(spotId) {
  const spots = await api('/api/admin/spots');
  const spot = spots.find(s => s.spot_id === spotId);
  if (!spot) return;

  document.getElementById('spotModalContent').innerHTML = `
    <div style="font-size:36px;text-align:center;margin-bottom:8px;">${CAT_ICON[spot.category]||'📍'}</div>
    <div class="modal-title">${spot.name}</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">${spot.category} ・ ${spot.area}エリア ・ 標準${spot.avg_minutes}分</div>
    ${spot.description ? `<div style="font-size:14px;margin-bottom:12px;">${spot.description}</div>` : ''}
    <button class="btn btn-primary btn-block" onclick="acquireStampFromModal('${spot.spot_id}','${spot.name}')">スタンプを取得する</button>
  `;
  document.getElementById('spotModal').classList.add('open');
}

async function acquireStampFromModal(spotId, spotName) {
  closeModal();
  await acquireStamp(spotId, null, spotName);
}

function closeModal() {
  document.getElementById('spotModal').classList.remove('open');
}

document.getElementById('spotModal').addEventListener('click', e => {
  if (e.target === document.getElementById('spotModal')) closeModal();
});

// Init
loadUsers();

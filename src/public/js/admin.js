const CAT_ICON = {
  '歴史・文化': '🏯', '自然・景観': '🌿', 'グルメ': '🍜', '買い物': '🛍️',
  '体験・アクティビティ': '🎨', '温泉・宿泊': '♨️', 'ファミリー向け': '👨‍👩‍👧', '地元民おすすめ': '🏠'
};
const TYPE_COLORS = {
  'コンプリート型': '#e07b39', 'じっくり滞在型': '#4a9870', '回遊型': '#2a5bb0',
  'グルメ・特典型': '#b03070', '再発見型': '#6a30b0'
};

let currentAdminTab = 'dashboard';
let editingSpotId = null;
let selectedFile = null;

async function api(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function adminTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
  document.getElementById('admin-' + tab).classList.add('active');
  const items = document.querySelectorAll('.sidebar-item');
  const idx = ['dashboard','import','spots','rallies','benefits','revisit'].indexOf(tab);
  if (items[idx]) items[idx].classList.add('active');

  if (tab === 'dashboard') loadDashboard();
  else if (tab === 'spots') loadSpots();
  else if (tab === 'rallies') loadRallies();
  else if (tab === 'benefits') loadBenefits();
  else if (tab === 'revisit') loadRevisit();
}

// =========== DASHBOARD ===========
async function loadDashboard() {
  const el = document.getElementById('dashboardContent');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    const d = await api('/api/admin/dashboard');
    const k = d.kpi;
    let html = `<div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-value">${k.totalUsers}</div><div class="kpi-label">総ユーザー数</div></div>
      <div class="kpi-card"><div class="kpi-value">${k.revisitRate}%</div><div class="kpi-label">再訪率</div></div>
      <div class="kpi-card"><div class="kpi-value">${k.stampCompletionRate}%</div><div class="kpi-label">スタンプ完了率</div></div>
      <div class="kpi-card"><div class="kpi-value">${k.avgSpotsPerSession}</div><div class="kpi-label">平均訪問スポット数</div></div>
      <div class="kpi-card"><div class="kpi-value">${k.routeUsageRate}%</div><div class="kpi-label">推薦ルート利用率</div></div>
      <div class="kpi-card"><div class="kpi-value">¥${k.estimatedConsumption.toLocaleString()}</div><div class="kpi-label">消費額推定</div></div>
    </div>`;

    // ユーザータイプ分布
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">';

    // type distribution
    const typeTotal = Object.values(d.userTypeDistribution).reduce((a, b) => a + b, 0);
    html += `<div class="card"><div style="font-weight:700;margin-bottom:12px;">ユーザータイプ分布</div>
      ${Object.entries(d.userTypeDistribution).sort((a,b)=>b[1]-a[1]).map(([t,c]) => `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
            <span><span class="dot-type" style="background:${TYPE_COLORS[t]||'#888'}"></span>${t}</span>
            <span>${c}人 (${typeTotal > 0 ? Math.round(c/typeTotal*100) : 0}%)</span>
          </div>
          <div class="chart-bar"><div class="chart-bar-inner" style="width:${typeTotal>0?c/typeTotal*100:0}%;background:${TYPE_COLORS[t]||'#888'}"></div></div>
        </div>`).join('')}
    </div>`;

    // top transitions
    html += `<div class="card"><div style="font-weight:700;margin-bottom:12px;">よくある回遊順 Top10</div>
      <table style="width:100%;"><thead><tr><th style="font-size:11px;">経路</th><th style="font-size:11px;text-align:right;">回数</th></tr></thead><tbody>
      ${d.topTransitions.map(t => `<tr><td style="font-size:12px;">${t.from} → ${t.to}</td><td style="text-align:right;font-weight:700;">${t.count}</td></tr>`).join('')}
      </tbody></table>
    </div>`;

    html += '</div>';

    // popular spots
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
    <div class="card"><div style="font-weight:700;margin-bottom:12px;">人気スポットランキング</div>
      <table><thead><tr><th style="width:30px;">#</th><th>スポット</th><th style="text-align:right;">訪問数</th></tr></thead><tbody>
      ${d.popularSpots.map((s,i) => `<tr><td class="rank-num">${i+1}</td><td style="font-size:13px;">${CAT_ICON[s.category]||'📍'} ${s.name}</td><td style="text-align:right;font-weight:700;">${s.visit_count}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card"><div style="font-weight:700;margin-bottom:12px;">平均滞在時間ランキング</div>
      <table><thead><tr><th style="width:30px;">#</th><th>スポット</th><th style="text-align:right;">平均(分)</th></tr></thead><tbody>
      ${d.avgStayRanking.map((s,i) => `<tr><td class="rank-num">${i+1}</td><td style="font-size:13px;">${CAT_ICON[s.category]||'📍'} ${s.name}</td><td style="text-align:right;font-weight:700;">${s.avg_stay}</td></tr>`).join('')}
      </tbody></table>
    </div></div>`;

    // stamp rates
    html += `<div class="card" style="margin-bottom:16px;"><div style="font-weight:700;margin-bottom:12px;">スタンプ取得率</div>
      <table><thead><tr><th>スポット</th><th style="text-align:right;">取得者数</th><th style="text-align:right;">取得率</th><th>バー</th></tr></thead><tbody>
      ${d.stampRates.map(s => `<tr>
        <td style="font-size:13px;">${CAT_ICON[s.category]||'📍'} ${s.name}</td>
        <td style="text-align:right;">${s.acquired_count}</td>
        <td style="text-align:right;font-weight:700;color:var(--primary);">${s.rate}%</td>
        <td style="min-width:80px;"><div class="chart-bar"><div class="chart-bar-inner" style="width:${s.rate}%"></div></div></td>
      </tr>`).join('')}
      </tbody></table>
    </div>`;

    // pass spots
    if (d.passSpots.length > 0) {
      html += `<div class="card"><div style="font-weight:700;margin-bottom:12px;">通過が多いスポット</div>
        <table><thead><tr><th>スポット</th><th style="text-align:right;">通過数</th></tr></thead><tbody>
        ${d.passSpots.map(s => `<tr><td>${s.name}</td><td style="text-align:right;">${s.pass_count}</td></tr>`).join('')}
        </tbody></table>
      </div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="card" style="color:red">エラー: ${e.message}</div>`;
  }
}

// =========== IMPORT ===========
function handleFileSelect(input) {
  selectedFile = input.files[0];
  if (selectedFile) {
    document.getElementById('uploadArea').innerHTML = `<div style="font-size:36px;margin-bottom:8px;">✅</div><div style="font-weight:700;">${selectedFile.name}</div><div style="font-size:12px;color:var(--text-muted);">${(selectedFile.size/1024).toFixed(1)} KB</div>`;
    document.getElementById('importBtn').disabled = false;
  }
}

async function doImport() {
  if (!selectedFile) return;
  const btn = document.getElementById('importBtn');
  btn.disabled = true;
  btn.textContent = 'インポート中...';
  try {
    const text = await selectedFile.text();
    const data = JSON.parse(text);
    const fd = new FormData();
    fd.append('file', selectedFile);
    const r = await fetch('/api/admin/import-json', { method: 'POST', body: fd });
    const result = await r.json();
    showImportResult(result);
  } catch (e) {
    document.getElementById('importResult').innerHTML = `<div class="result-box" style="color:red;">エラー: ${e.message}</div>`;
  }
  btn.disabled = false;
  btn.textContent = 'インポート実行';
}

async function loadDefaultData() {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '読み込み中...';
  try {
    const r = await fetch('/api/admin/import-default', { method: 'POST' });
    const result = await r.json();
    showImportResult(result);
  } catch (e) {
    document.getElementById('importResult').innerHTML = `<div class="result-box" style="color:red;">エラー: ${e.message}</div>`;
  }
  btn.disabled = false;
  btn.textContent = '📂 data.json をインポート';
}

function showImportResult(result) {
  const c = result.counts || {};
  let html = `<div class="result-box">`;
  if (result.success) {
    html += `✅ インポート成功\n`;
    Object.entries(c).forEach(([k, v]) => { if (v > 0) html += `  ${k}: ${v}件\n`; });
  }
  if (result.errors?.length > 0) {
    html += `\n⚠️ エラー ${result.errors.length}件:\n`;
    result.errors.slice(0, 10).forEach(e => html += `  ${e}\n`);
  }
  html += `</div>`;
  document.getElementById('importResult').innerHTML = html;
  if (result.success) setTimeout(() => adminTab('dashboard'), 1500);
}

// =========== SPOTS ===========
async function loadSpots() {
  try {
    const spots = await api('/api/admin/spots');
    const tbody = document.getElementById('spotsBody');
    tbody.innerHTML = spots.map(s => `<tr>
      <td style="font-weight:700;color:var(--text-muted);">${s.spot_id}</td>
      <td>${CAT_ICON[s.category]||'📍'} ${s.name}</td>
      <td>${s.category}</td>
      <td>${s.area}</td>
      <td>${s.avg_minutes}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editSpot('${s.spot_id}','${s.name}','${s.category}','${s.area}',${s.avg_minutes},'${s.description||''}')">編集</button>
        <button class="btn btn-sm" style="background:#fee;color:#c00;border:1px solid #fcc;margin-left:4px;" onclick="deleteSpot('${s.spot_id}','${s.name}')">削除</button>
      </td>
    </tr>`).join('');
  } catch (e) {
    document.getElementById('spotsBody').innerHTML = `<tr><td colspan="6" style="color:red;">${e.message}</td></tr>`;
  }
}

function showSpotForm() {
  editingSpotId = null;
  document.getElementById('spotFormTitle').textContent = 'スポット追加';
  ['spot_id','name','area','description'].forEach(f => document.getElementById('f_'+f).value = '');
  document.getElementById('f_avg_minutes').value = 30;
  document.getElementById('f_spot_id').disabled = false;
  document.getElementById('spotFormArea').style.display = 'block';
}

function editSpot(id, name, category, area, avg, desc) {
  editingSpotId = id;
  document.getElementById('spotFormTitle').textContent = 'スポット編集';
  document.getElementById('f_spot_id').value = id;
  document.getElementById('f_spot_id').disabled = true;
  document.getElementById('f_name').value = name;
  document.getElementById('f_category').value = category;
  document.getElementById('f_area').value = area;
  document.getElementById('f_avg_minutes').value = avg;
  document.getElementById('f_description').value = desc;
  document.getElementById('spotFormArea').style.display = 'block';
  document.getElementById('spotFormArea').scrollIntoView({ behavior: 'smooth' });
}

async function saveSpot() {
  const spot = {
    spot_id: document.getElementById('f_spot_id').value.trim(),
    name: document.getElementById('f_name').value.trim(),
    category: document.getElementById('f_category').value,
    area: document.getElementById('f_area').value.trim(),
    avg_minutes: parseInt(document.getElementById('f_avg_minutes').value) || 30,
    description: document.getElementById('f_description').value.trim() || null
  };
  if (!spot.spot_id || !spot.name || !spot.area) return alert('必須項目を入力してください');
  try {
    const method = editingSpotId ? 'PUT' : 'POST';
    const url = editingSpotId ? `/api/admin/spots/${editingSpotId}` : '/api/admin/spots';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(spot) });
    document.getElementById('spotFormArea').style.display = 'none';
    loadSpots();
  } catch (e) { alert('エラー: ' + e.message); }
}

async function deleteSpot(spotId, name) {
  if (!confirm(`「${name}」を削除しますか？`)) return;
  try {
    await fetch(`/api/admin/spots/${spotId}`, { method: 'DELETE' });
    loadSpots();
  } catch (e) { alert('エラー: ' + e.message); }
}

// =========== RALLIES ===========
async function loadRallies() {
  const el = document.getElementById('ralliesContent');
  try {
    const rallies = await api('/api/admin/rallies');
    let html = '<div style="display:grid;gap:14px;">';
    rallies.forEach(r => {
      html += `<div class="card">
        <div style="font-weight:700;font-size:16px;margin-bottom:6px;">${r.name}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">ID: ${r.rally_id}${r.season_tag ? ' ・ ' + r.season_tag : ''}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${r.target_spots.map(s => `<div style="display:flex;align-items:center;gap:4px;background:#fff3e6;border:1px solid #f0c080;border-radius:8px;padding:6px 10px;font-size:13px;">
            <span>${CAT_ICON[s.category]||'📍'}</span><span>${s.name}</span>
          </div>`).join('')}
        </div>
      </div>`;
    });
    html += '</div>';
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="card" style="color:red;">${e.message}</div>`;
  }
}

// =========== BENEFITS ===========
async function loadBenefits() {
  try {
    const benefits = await api('/api/admin/benefits');
    const spots = await api('/api/admin/spots');
    const spotMap = Object.fromEntries(spots.map(s => [s.spot_id, s]));
    document.getElementById('benefitsBody').innerHTML = benefits.map(b => `<tr>
      <td style="font-weight:700;color:var(--text-muted);">${b.benefit_id}</td>
      <td>🎁 ${b.name}</td>
      <td>${b.category}</td>
      <td>${b.spot_id ? (CAT_ICON[spotMap[b.spot_id]?.category]||'📍') + ' ' + (spotMap[b.spot_id]?.name || b.spot_id) : '—'}</td>
      <td style="font-weight:700;color:var(--primary);">¥${b.estimated_value_yen}</td>
    </tr>`).join('');
  } catch (e) {
    document.getElementById('benefitsBody').innerHTML = `<tr><td colspan="5" style="color:red;">${e.message}</td></tr>`;
  }
}

// =========== REVISIT ===========
async function loadRevisit() {
  const el = document.getElementById('revisitContent');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    const candidates = await api('/api/admin/revisit-candidates');
    if (candidates.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><div>再訪候補ユーザーがいません</div></div>';
      return;
    }
    let html = `<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">${candidates.length}人の再訪候補ユーザー (再訪スコア順)</div>`;
    html += `<div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>ユーザー</th><th>タイプ</th><th>最終訪問</th><th>未完了ラリー</th><th>愛着Lv</th><th>再訪スコア</th><th>おすすめ理由</th>
      </tr></thead><tbody>
      ${candidates.map((c, i) => `<tr>
        <td class="rank-num">${i+1}</td>
        <td><div style="font-weight:700;">${c.nickname}</div><div style="font-size:11px;color:var(--text-muted);">${c.user_id}</div></td>
        <td><span class="badge badge-type" style="background:${TYPE_COLORS[c.userType]||'#888'}22;color:${TYPE_COLORS[c.userType]||'#888'};">${c.userType}</span></td>
        <td><div>${c.lastVisitDate}</div><div style="font-size:11px;color:var(--text-muted);">${c.daysSince}日前</div></td>
        <td style="text-align:center;font-weight:700;color:${c.incompleteRallyCount>0?'var(--primary)':'var(--text-muted)'};">${c.incompleteRallyCount}件</td>
        <td style="text-align:center;"><span style="font-weight:700;">Lv.${c.attachmentLevel}</span></td>
        <td style="text-align:center;font-weight:800;font-size:18px;color:var(--primary);">${c.revisitScore}</td>
        <td style="font-size:12px;color:var(--text-muted);">${c.reason}</td>
      </tr>`).join('')}
      </tbody></table></div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="card" style="color:red;">エラー: ${e.message}</div>`;
  }
}

// data.json をパブリックに公開するためのルート (import用)
// すでに static で / から提供されているため fetch('/data.json') で取得可能

// Init
loadDashboard();

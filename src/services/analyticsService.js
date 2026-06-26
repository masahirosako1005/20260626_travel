const visitRepo = require('../repositories/visitRepository');
const spotRepo = require('../repositories/spotRepository');
const userRepo = require('../repositories/userRepository');
const attachmentService = require('./attachmentService');

function getDashboard() {
  const users = userRepo.findAll();
  const allVisits = visitRepo.getAllVisits();
  const allStamps = visitRepo.getAllStamps();
  const allBenefitUses = visitRepo.getAllBenefitUses();
  const allRouteUsages = visitRepo.getAllRouteUsages();
  const spots = spotRepo.findAll();
  const rallies = spotRepo.getRallies();
  const allRallySpots = spotRepo.getAllRallySpots();

  const totalUsers = users.length;

  // 再訪率
  const sessionCounts = visitRepo.getUserSessionCounts();
  const revisitUsers = sessionCounts.filter(r => r.session_count >= 2).length;
  const revisitRate = totalUsers > 0 ? (revisitUsers / totalUsers * 100).toFixed(1) : 0;

  // スタンプ完了率 (完了ラリー数 / ユーザー参加ラリー数)
  let completedRallies = 0, participatedRallies = 0;
  for (const user of users) {
    const userStampSpots = new Set(allStamps.filter(s => s.user_id === user.user_id).map(s => s.spot_id));
    for (const rally of rallies) {
      const targets = allRallySpots.filter(rs => rs.rally_id === rally.rally_id).map(rs => rs.spot_id);
      const hasAny = targets.some(sid => userStampSpots.has(sid));
      if (hasAny) {
        participatedRallies++;
        if (targets.every(sid => userStampSpots.has(sid))) completedRallies++;
      }
    }
  }
  const stampCompletionRate = participatedRallies > 0 ? (completedRallies / participatedRallies * 100).toFixed(1) : 0;

  // 平均訪問スポット数 (stayイベント数 / セッション数)
  const stayVisits = allVisits.filter(v => v.event_type === 'stay');
  const uniqueSessions = new Set(allVisits.map(v => v.session_id)).size;
  const avgSpotsPerSession = uniqueSessions > 0 ? (stayVisits.length / uniqueSessions).toFixed(1) : 0;

  // 推薦ルート利用率
  const usedRoutes = allRouteUsages.filter(r => r.used === 1).length;
  const routeUsageRate = allRouteUsages.length > 0 ? (usedRoutes / allRouteUsages.length * 100).toFixed(1) : 0;

  // 地域内消費額推定
  const estimatedConsumption = allBenefitUses.reduce((s, b) => s + (b.estimated_value_yen || 0), 0);

  // 人気スポットランキング
  const spotVisitMap = {};
  const spotStayMap = {};
  for (const v of allVisits) {
    if (!spotVisitMap[v.spot_id]) spotVisitMap[v.spot_id] = 0;
    if (v.event_type === 'stay') {
      spotVisitMap[v.spot_id]++;
      if (!spotStayMap[v.spot_id]) spotStayMap[v.spot_id] = [];
      spotStayMap[v.spot_id].push(v.stay_minutes || 0);
    }
  }

  const spotMap = Object.fromEntries(spots.map(s => [s.spot_id, s]));

  const popularSpots = Object.entries(spotVisitMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([spot_id, count]) => ({ ...spotMap[spot_id], visit_count: count }));

  const avgStayRanking = Object.entries(spotStayMap)
    .map(([spot_id, mins]) => ({ ...spotMap[spot_id], avg_stay: Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) }))
    .sort((a, b) => b.avg_stay - a.avg_stay)
    .slice(0, 10);

  // 通過が多いスポット
  const passMap = {};
  for (const v of allVisits.filter(v => v.event_type === 'pass')) {
    passMap[v.spot_id] = (passMap[v.spot_id] || 0) + 1;
  }
  const passSpots = Object.entries(passMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sid, cnt]) => ({ ...spotMap[sid], pass_count: cnt }));

  // スタンプ取得率
  const stampMap = {};
  for (const s of allStamps) stampMap[s.spot_id] = (stampMap[s.spot_id] || 0) + 1;
  const stampRates = spots.map(s => ({
    ...s,
    acquired_count: stampMap[s.spot_id] || 0,
    rate: totalUsers > 0 ? ((stampMap[s.spot_id] || 0) / totalUsers * 100).toFixed(1) : 0
  })).sort((a, b) => b.acquired_count - a.acquired_count);

  // ユーザータイプ分布 - use simple logic without full calc for performance
  const typeMap = {};
  for (const u of users) {
    const uVisits = allVisits.filter(v => v.user_id === u.user_id && v.event_type === 'stay');
    const uStamps = allStamps.filter(s => s.user_id === u.user_id);
    const uBenefits = allBenefitUses.filter(b => b.user_id === u.user_id);
    const uSpots = new Set(uVisits.map(v => v.spot_id));
    const totalStay = uVisits.reduce((s, v) => s + (v.stay_minutes || 0), 0);
    const avgStay = uSpots.size > 0 ? totalStay / uSpots.size : 0;
    const stampRate = uSpots.size > 0 ? uStamps.length / uSpots.size : 0;

    let t;
    if (stampRate > 0.7) t = 'コンプリート型';
    else if (avgStay > 50) t = 'じっくり滞在型';
    else if (uBenefits.length >= 3) t = 'グルメ・特典型';
    else if (uSpots.size >= 6) t = '回遊型';
    else t = '再発見型';
    typeMap[t] = (typeMap[t] || 0) + 1;
  }

  // よくある回遊順 (spot transition pairs)
  const transitions = {};
  const sessionVisits = {};
  for (const v of allVisits.filter(v => v.event_type === 'stay').sort((a, b) => a.visited_at.localeCompare(b.visited_at))) {
    if (!sessionVisits[v.session_id]) sessionVisits[v.session_id] = [];
    sessionVisits[v.session_id].push(v.spot_id);
  }
  for (const spots of Object.values(sessionVisits)) {
    for (let i = 0; i < spots.length - 1; i++) {
      const key = `${spots[i]}→${spots[i+1]}`;
      transitions[key] = (transitions[key] || 0) + 1;
    }
  }
  const topTransitions = Object.entries(transitions)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([pair, count]) => {
      const [from, to] = pair.split('→');
      return { from: spotMap[from]?.name || from, to: spotMap[to]?.name || to, count };
    });

  return {
    kpi: { totalUsers, revisitRate, stampCompletionRate, avgSpotsPerSession, routeUsageRate, estimatedConsumption },
    popularSpots, avgStayRanking, passSpots, stampRates, userTypeDistribution: typeMap, topTransitions
  };
}

function getRevisitCandidates() {
  const users = userRepo.findAll();
  const allVisits = visitRepo.getAllVisits();
  const allStamps = visitRepo.getAllStamps();
  const allBenefitUses = visitRepo.getAllBenefitUses();
  const allRouteUsages = visitRepo.getAllRouteUsages();
  const rallies = spotRepo.getRallies();
  const allRallySpots = spotRepo.getAllRallySpots();

  const now = new Date('2026-06-26T00:00:00');

  const candidates = users.map(user => {
    const uVisits = allVisits.filter(v => v.user_id === user.user_id);
    const uStamps = allStamps.filter(s => s.user_id === user.user_id);
    const uBenefits = allBenefitUses.filter(b => b.user_id === user.user_id);
    const uRoutes = allRouteUsages.filter(r => r.user_id === user.user_id);

    if (uVisits.length === 0) return null;

    const acquiredSpots = new Set(uStamps.map(s => s.spot_id));
    const sessions = new Set(uVisits.map(v => v.session_id));

    // last visit
    const lastVisit = uVisits.sort((a, b) => b.visited_at.localeCompare(a.visited_at))[0];
    const lastVisitDate = new Date(lastVisit.visited_at);
    const daysSince = Math.floor((now - lastVisitDate) / (1000 * 60 * 60 * 24));

    // recency score (max 30, higher = more recent)
    const recencyScore = Math.max(0, 30 - daysSince * 0.1);

    // incomplete rallies
    let incompleteRallyCount = 0;
    let remainingStampNearComplete = 0;
    for (const rally of rallies) {
      const targets = allRallySpots.filter(rs => rs.rally_id === rally.rally_id).map(rs => rs.spot_id);
      const remaining = targets.filter(sid => !acquiredSpots.has(sid));
      if (remaining.length > 0) {
        incompleteRallyCount++;
        if (remaining.length <= 2) remainingStampNearComplete += (3 - remaining.length) * 15;
      }
    }

    // benefit interest
    const benefitInterestScore = uBenefits.length * 5;

    // route interest
    const routeInterestScore = uRoutes.filter(r => r.used === 1).length * 10;

    // attachment score contribution
    const uSpots = new Set(uVisits.filter(v => v.event_type === 'stay').map(v => v.spot_id));
    const totalStay = uVisits.filter(v => v.event_type === 'stay').reduce((s, v) => s + (v.stay_minutes || 0), 0);
    const attachmentScore = Math.round(uSpots.size * 8 + totalStay * 0.2 + uStamps.length * 10 + uBenefits.length * 8);

    const revisitScore = Math.round(
      incompleteRallyCount * 25 +
      remainingStampNearComplete +
      recencyScore +
      benefitInterestScore +
      routeInterestScore +
      attachmentScore * 0.1
    );

    // user type
    const avgStay = uSpots.size > 0 ? totalStay / uSpots.size : 0;
    const stampRate = uSpots.size > 0 ? uStamps.length / uSpots.size : 0;
    let userType;
    if (stampRate > 0.7) userType = 'コンプリート型';
    else if (avgStay > 50) userType = 'じっくり滞在型';
    else if (uBenefits.length >= 3) userType = 'グルメ・特典型';
    else if (uSpots.size >= 6) userType = '回遊型';
    else userType = '再発見型';

    // attachment level
    const LEVELS = [
      { level: 1, min: 0 }, { level: 2, min: 50 }, { level: 3, min: 100 }, { level: 4, min: 180 }, { level: 5, min: 300 }
    ];
    const attachLevel = [...LEVELS].reverse().find(l => attachmentScore >= l.min)?.level || 1;

    // revisit reason
    let reason = '';
    if (incompleteRallyCount > 0 && remainingStampNearComplete > 0) reason = `ラリーコンプリートまであと少し！(${incompleteRallyCount}件)`;
    else if (incompleteRallyCount > 0) reason = `未完了ラリーが${incompleteRallyCount}件あります`;
    else if (userType === 'グルメ・特典型') reason = '新しい特典をお試しください';
    else reason = '新しいスポットをご案内できます';

    return {
      user_id: user.user_id, nickname: user.nickname, userType,
      lastVisitDate: lastVisit.visited_at.slice(0, 10), daysSince,
      incompleteRallyCount, remainingStampCount: 0,
      attachmentLevel: attachLevel, revisitScore, reason,
      sessionCount: sessions.size
    };
  }).filter(Boolean).sort((a, b) => b.revisitScore - a.revisitScore);

  return candidates;
}

module.exports = { getDashboard, getRevisitCandidates };

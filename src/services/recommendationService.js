const visitRepo = require('../repositories/visitRepository');
const spotRepo = require('../repositories/spotRepository');
const userRepo = require('../repositories/userRepository');

const ROUTE_TYPES = [
  { id: '60min',   label: '60分コース',        maxMinutes: 60,  minSpots: 1, maxSpots: 2 },
  { id: '90min',   label: '90分コース',        maxMinutes: 90,  minSpots: 2, maxSpots: 3 },
  { id: 'halfday', label: '半日コース',        maxMinutes: 240, minSpots: 3, maxSpots: 5 },
  { id: 'fullday', label: '1日コース',         maxMinutes: 480, minSpots: 5, maxSpots: 8 },
  { id: 'local',   label: '地元再発見コース',  maxMinutes: 120, minSpots: 2, maxSpots: 4 },
];

function getUserStats(userId) {
  const visits = visitRepo.getVisitsByUser(userId);
  const stamps = visitRepo.getStampsByUser(userId);
  const benefitUses = visitRepo.getBenefitUsesByUser(userId);

  const visitedSpots = new Set(visits.filter(v => v.event_type === 'stay').map(v => v.spot_id));
  const passOnlySpots = new Set(visits.filter(v => v.event_type === 'pass').map(v => v.spot_id));
  const acquiredStamps = new Set(stamps.map(s => s.spot_id));

  // category scores
  const catScore = {};
  for (const v of visits) {
    if (!v.category) continue;
    catScore[v.category] = (catScore[v.category] || 0) +
      (v.event_type === 'stay' ? 5 : 0) +
      (v.stay_minutes || 0) * 0.2;
  }
  for (const s of stamps) catScore[s.category] = (catScore[s.category] || 0) + 4;
  for (const b of benefitUses) catScore[b.category] = (catScore[b.category] || 0) + 8;
  for (const v of visits.filter(v => v.event_type === 'pass')) catScore[v.category] = (catScore[v.category] || 0) - 2;

  const topCategory = Object.entries(catScore).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // long stay category
  const stayByCategory = {};
  for (const v of visits.filter(v => v.event_type === 'stay')) {
    if (!stayByCategory[v.category]) stayByCategory[v.category] = [];
    stayByCategory[v.category].push(v.stay_minutes || 0);
  }
  const longStayCategory = Object.entries(stayByCategory)
    .map(([cat, mins]) => ({ cat, avg: mins.reduce((a, b) => a + b, 0) / mins.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.cat || null;

  // coupon category
  const benefitCatCount = {};
  for (const b of benefitUses) benefitCatCount[b.category] = (benefitCatCount[b.category] || 0) + 1;
  const couponCategory = Object.entries(benefitCatCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // near complete rallies (1-2 stamps away)
  const rallies = spotRepo.getRallies();
  const allRallySpots = spotRepo.getAllRallySpots();
  const nearCompleteRallySpots = new Set();
  const incompleteRallies = [];

  for (const rally of rallies) {
    const targets = allRallySpots.filter(rs => rs.rally_id === rally.rally_id).map(rs => rs.spot_id);
    const acquired = targets.filter(sid => acquiredStamps.has(sid));
    const remaining = targets.filter(sid => !acquiredStamps.has(sid));
    if (remaining.length > 0) {
      incompleteRallies.push({ ...rally, targets, acquired, remaining, completionRate: acquired.length / targets.length });
      if (remaining.length <= 2) remaining.forEach(sid => nearCompleteRallySpots.add(sid));
    }
  }

  return { visitedSpots, passOnlySpots, acquiredStamps, topCategory, longStayCategory, couponCategory, nearCompleteRallySpots, incompleteRallies, catScore };
}

function scoreSpot(spot, stats, benefits) {
  let score = 0;
  const reasons = [];

  if (!stats.visitedSpots.has(spot.spot_id)) {
    score += 20; reasons.push('未訪問スポット');
  } else {
    score -= 10;
  }

  if (stats.nearCompleteRallySpots.has(spot.spot_id) && !stats.acquiredStamps.has(spot.spot_id)) {
    score += 30; reasons.push('スタンプあと少しで完了');
  } else if (!stats.acquiredStamps.has(spot.spot_id) && stats.visitedSpots.has(spot.spot_id)) {
    score += 15; reasons.push('スタンプ未取得');
  }

  if (spot.category === stats.topCategory) {
    score += 15; reasons.push(`お気に入りカテゴリ: ${spot.category}`);
  }
  if (spot.category === stats.longStayCategory && spot.category !== stats.topCategory) {
    score += 10; reasons.push('じっくり滞在したカテゴリ');
  }
  if (spot.category === stats.couponCategory) {
    score += 10; reasons.push('特典を利用したカテゴリ');
  }
  if (stats.passOnlySpots.has(spot.spot_id)) {
    score -= 5; reasons.push('前回は通過のみ');
  }

  const hasBenefit = benefits.find(b => b.spot_id === spot.spot_id);
  if (hasBenefit) { score += 5; reasons.push(`特典あり: ${hasBenefit.name}`); }

  return { score, reasons };
}

function buildRoute(spots, stats, benefits, routeType) {
  const scored = spots.map(s => {
    const { score, reasons } = scoreSpot(s, stats, benefits);
    return { ...s, recommend_score: score, reasons };
  }).sort((a, b) => b.recommend_score - a.recommend_score);

  const route = [];
  let totalMinutes = 0;

  for (const spot of scored) {
    if (route.length >= routeType.maxSpots) break;
    if (totalMinutes + spot.avg_minutes > routeType.maxMinutes) continue;
    route.push(spot);
    totalMinutes += spot.avg_minutes;
    if (route.length >= routeType.minSpots && totalMinutes >= routeType.maxMinutes * 0.6) break;
  }

  const hasBenefit = route.some(s => benefits.find(b => b.spot_id === s.spot_id));
  if (!hasBenefit && route.length < routeType.maxSpots) {
    const benefitSpot = scored.find(s => benefits.find(b => b.spot_id === s.spot_id) && !route.find(r => r.spot_id === s.spot_id));
    if (benefitSpot && totalMinutes + benefitSpot.avg_minutes <= routeType.maxMinutes * 1.1) {
      route.push(benefitSpot);
      totalMinutes += benefitSpot.avg_minutes;
    }
  }

  return { ...routeType, spots: route, estimatedMinutes: totalMinutes };
}

function getRecommendations(userId) {
  const stats = getUserStats(userId);
  const allSpots = spotRepo.findAll();
  const benefits = spotRepo.getBenefits();

  const routes = ROUTE_TYPES.map(rt => buildRoute(allSpots, stats, benefits, rt));
  return { routes, stats };
}

function getIncomplete(userId) {
  const stats = getUserStats(userId);
  const allSpots = spotRepo.findAll();
  const spotMap = Object.fromEntries(allSpots.map(s => [s.spot_id, s]));

  const unvisitedSpots = allSpots.filter(s => !stats.visitedSpots.has(s.spot_id));

  const incompleteRallies = stats.incompleteRallies.map(r => ({
    ...r,
    remainingSpots: r.remaining.map(sid => spotMap[sid]).filter(Boolean),
    estimatedMinutes: r.remaining.reduce((s, sid) => s + (spotMap[sid]?.avg_minutes || 30), 0)
  }));

  return { incompleteRallies, unvisitedSpots };
}

module.exports = { getRecommendations, getIncomplete, getUserStats };

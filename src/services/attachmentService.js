const visitRepo = require('../repositories/visitRepository');
const userRepo = require('../repositories/userRepository');

const LEVELS = [
  { level: 1, min: 0,   max: 49,  title: 'はじめての旅人' },
  { level: 2, min: 50,  max: 99,  title: 'まち歩き見習い' },
  { level: 3, min: 100, max: 179, title: '地域探索者' },
  { level: 4, min: 180, max: 299, title: 'まちの常連' },
  { level: 5, min: 300, max: Infinity, title: '地域アンバサダー' },
];

const BADGES = [
  { id: 'history', label: '歴史スポット好き', category: '歴史・文化', threshold: 2 },
  { id: 'nature',  label: '自然満喫派',       category: '自然・景観',   threshold: 2 },
  { id: 'gourmet', label: 'グルメ開拓者',      category: 'グルメ',       threshold: 2 },
  { id: 'coupon',  label: '特典活用上手',       category: null,           threshold: 3, type: 'benefit' },
  { id: 'rally',   label: 'ラリーコンプリート', category: null,           threshold: 1, type: 'rally' },
  { id: 'local',   label: '地元再発見マスター', category: '地元民おすすめ', threshold: 2 },
];

function calcAttachment(userId) {
  const visits    = visitRepo.getVisitsByUser(userId);
  const stamps    = visitRepo.getStampsByUser(userId);
  const benefitUses = visitRepo.getBenefitUsesByUser(userId);
  const sessions  = userRepo.getUserSessions(userId);

  const visitedSpotIds = new Set(visits.filter(v => v.event_type === 'stay').map(v => v.spot_id));
  const totalStayMinutes = visits.filter(v => v.event_type === 'stay').reduce((s, v) => s + (v.stay_minutes || 0), 0);
  const revisitCount = Math.max(0, sessions.length - 1);

  // completed rallies
  const { getRallies, getAllRallySpots } = require('../repositories/spotRepository');
  const rallies = getRallies();
  const rallySpots = getAllRallySpots();
  const acquiredSpotIds = new Set(stamps.map(s => s.spot_id));

  let completedRallyCount = 0;
  for (const rally of rallies) {
    const targets = rallySpots.filter(rs => rs.rally_id === rally.rally_id).map(rs => rs.spot_id);
    if (targets.length > 0 && targets.every(sid => acquiredSpotIds.has(sid))) completedRallyCount++;
  }

  const score = Math.round(
    visitedSpotIds.size    * 8  +
    totalStayMinutes       * 0.2 +
    stamps.length          * 10 +
    benefitUses.length     * 8  +
    completedRallyCount    * 20 +
    revisitCount           * 25
  );

  const levelInfo = LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[LEVELS.length - 1];
  const nextLevel = LEVELS.find(l => l.level === levelInfo.level + 1);
  const progress = nextLevel ? Math.round(((score - levelInfo.min) / (nextLevel.min - levelInfo.min)) * 100) : 100;

  // badges
  const earnedBadges = [];
  const categoryVisitCounts = {};
  for (const v of visits.filter(v => v.event_type === 'stay')) {
    categoryVisitCounts[v.category] = (categoryVisitCounts[v.category] || 0) + 1;
  }

  for (const badge of BADGES) {
    if (badge.type === 'benefit' && benefitUses.length >= badge.threshold) {
      earnedBadges.push(badge.label);
    } else if (badge.type === 'rally' && completedRallyCount >= badge.threshold) {
      earnedBadges.push(badge.label);
    } else if (badge.category && (categoryVisitCounts[badge.category] || 0) >= badge.threshold) {
      earnedBadges.push(badge.label);
    }
  }

  // user type
  const avgStay = visitedSpotIds.size > 0 ? totalStayMinutes / visitedSpotIds.size : 0;
  const stampRate = visitedSpotIds.size > 0 ? stamps.length / visitedSpotIds.size : 0;
  let userType = '回遊型';
  if (stampRate > 0.7) userType = 'コンプリート型';
  else if (avgStay > 50) userType = 'じっくり滞在型';
  else if (benefitUses.length >= 3) userType = 'グルメ・特典型';
  else if (visitedSpotIds.size >= 6) userType = '回遊型';
  else userType = '再発見型';

  return {
    score, level: levelInfo.level, title: levelInfo.title, progress,
    nextLevelScore: nextLevel ? nextLevel.min : null,
    visitedSpotCount: visitedSpotIds.size,
    totalStayMinutes, stampCount: stamps.length,
    benefitUseCount: benefitUses.length, completedRallyCount, revisitCount,
    badges: earnedBadges, userType
  };
}

module.exports = { calcAttachment };

const express = require('express');
const router = express.Router();
const userRepo = require('../repositories/userRepository');
const visitRepo = require('../repositories/visitRepository');
const spotRepo = require('../repositories/spotRepository');
const attachmentService = require('../services/attachmentService');
const recommendationService = require('../services/recommendationService');

// ホーム情報
router.get('/:userId/home', (req, res) => {
  const user = userRepo.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  const attachment = attachmentService.calcAttachment(req.params.userId);
  const lastSession = userRepo.getLastSession(req.params.userId);
  const { incompleteRallies } = recommendationService.getIncomplete(req.params.userId);
  const { routes } = recommendationService.getRecommendations(req.params.userId);
  const benefits = spotRepo.getBenefits();

  let lastVisitSummary = null;
  if (lastSession) {
    const sessionVisits = visitRepo.getVisitsBySession(req.params.userId, lastSession.session_id);
    const stamps = visitRepo.getStampsByUser(req.params.userId);
    const sessionStamps = stamps.filter(s => s.session_id === lastSession.session_id);
    lastVisitSummary = {
      date: lastSession.session_start?.slice(0, 10),
      spotCount: sessionVisits.filter(v => v.event_type === 'stay').length,
      stampCount: sessionStamps.length,
      spots: sessionVisits.filter(v => v.event_type === 'stay').map(v => v.spot_name)
    };
  }

  res.json({
    user, attachment,
    lastVisitSummary,
    incompleteRallyCount: incompleteRallies.length,
    topIncompleteRally: incompleteRallies[0] || null,
    todayRoute: routes.find(r => r.id === '60min') || routes[0] || null,
    availableBenefits: benefits.slice(0, 3)
  });
});

// 旅のリプレイ
router.get('/:userId/replay', (req, res) => {
  const user = userRepo.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  const sessions = userRepo.getUserSessions(req.params.userId);
  const stamps = visitRepo.getStampsByUser(req.params.userId);
  const benefitUses = visitRepo.getBenefitUsesByUser(req.params.userId);

  const sessionsDetail = sessions.map(sess => {
    const visits = visitRepo.getVisitsBySession(req.params.userId, sess.session_id);
    const sessStamps = stamps.filter(s => s.session_id === sess.session_id);
    const sessBenefits = benefitUses.filter(b => b.session_id === sess.session_id);

    // 前回の旅の特徴コメント
    const categories = [...new Set(visits.filter(v => v.event_type === 'stay').map(v => v.category))];
    let comment = '';
    if (categories.length === 0) comment = 'まちを散策しました。';
    else if (categories.length === 1) comment = `${categories[0]}を中心に巡りました。`;
    else comment = `${categories.slice(0, 2).join('と')}を中心に巡りました。`;

    return {
      session_id: sess.session_id,
      date: sess.session_start?.slice(0, 10),
      spots: visits.filter(v => v.event_type === 'stay').map(v => ({
        name: v.spot_name, category: v.category, stay_minutes: v.stay_minutes,
        stamp: sessStamps.some(s => s.spot_id === v.spot_id),
        benefit: sessBenefits.find(b => b.spot_id === v.spot_id)?.benefit_name || null
      })),
      passSpots: visits.filter(v => v.event_type === 'pass').map(v => v.spot_name),
      stampCount: sessStamps.length, benefitCount: sessBenefits.length, comment
    };
  }).reverse();

  res.json({ user, sessions: sessionsDetail });
});

// 未完了一覧
router.get('/:userId/incomplete', (req, res) => {
  const user = userRepo.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  const { incompleteRallies, unvisitedSpots } = recommendationService.getIncomplete(req.params.userId);
  res.json({ user, incompleteRallies, unvisitedSpots });
});

// おすすめルート
router.get('/:userId/recommendations', (req, res) => {
  const user = userRepo.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  const { routes } = recommendationService.getRecommendations(req.params.userId);
  res.json({ user, routes });
});

// 地域愛着スコア
router.get('/:userId/attachment', (req, res) => {
  const user = userRepo.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  const attachment = attachmentService.calcAttachment(req.params.userId);
  res.json({ user, attachment });
});

// スタンプ取得
router.post('/:userId/stamps', (req, res) => {
  const { spot_id, rally_id } = req.body;
  if (!spot_id) return res.status(400).json({ error: 'spot_idが必要です' });

  const user = userRepo.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  const now = new Date().toISOString();
  const sessionId = `SESS-${req.params.userId}-WEB`;
  const stampId = `ST-${req.params.userId}-${spot_id}-${Date.now()}`;

  const existing = visitRepo.getStampsByUser(req.params.userId).find(s => s.spot_id === spot_id && s.rally_id === (rally_id || null));
  if (existing) return res.status(409).json({ error: 'このスタンプはすでに取得済みです', stamp: existing });

  visitRepo.insertStamp({ stamp_id: stampId, user_id: req.params.userId, session_id: sessionId, spot_id, rally_id: rally_id || null, acquired_at: now, method: 'mock_button' });

  // 訪問履歴にも追加
  const visitId = `V-${req.params.userId}-${spot_id}-${Date.now()}`;
  const spot = spotRepo.findById(spot_id);
  const existingVisit = visitRepo.getVisitsByUser(req.params.userId).find(v => v.spot_id === spot_id && v.event_type === 'stay');
  if (!existingVisit) {
    visitRepo.insertVisit({ visit_id: visitId, user_id: req.params.userId, session_id: sessionId, spot_id, visited_at: now, route_order: null, stay_minutes: spot?.avg_minutes || 30, pass_minutes: 0, event_type: 'stay' });
  }

  res.json({ success: true, stamp_id: stampId });
});

module.exports = router;

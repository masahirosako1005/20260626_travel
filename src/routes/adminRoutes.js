const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const userRepo = require('../repositories/userRepository');
const spotRepo = require('../repositories/spotRepository');
const importService = require('../services/importService');
const analyticsService = require('../services/analyticsService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// JSONインポート
router.post('/import-json', upload.single('file'), (req, res) => {
  try {
    let data;
    if (req.file) {
      data = JSON.parse(req.file.buffer.toString('utf8'));
    } else if (req.body && req.body.json) {
      data = JSON.parse(req.body.json);
    } else {
      return res.status(400).json({ error: 'ファイルまたはJSONが必要です' });
    }

    const result = importService.importJson(data);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: `インポート失敗: ${e.message}` });
  }
});

// data.jsonを直接インポート
router.post('/import-default', (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../../data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const result = importService.importJson(data);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: `インポート失敗: ${e.message}` });
  }
});

// ダッシュボード
router.get('/dashboard', (req, res) => {
  const data = analyticsService.getDashboard();
  res.json(data);
});

// ユーザー一覧
router.get('/users', (req, res) => {
  res.json(userRepo.findAll());
});

// スポット一覧
router.get('/spots', (req, res) => {
  res.json(spotRepo.findAll());
});

// スポット登録
router.post('/spots', (req, res) => {
  const { spot_id, name, category, area, avg_minutes, description, image_path } = req.body;
  if (!spot_id || !name || !category || !area) return res.status(400).json({ error: '必須項目が不足しています' });
  spotRepo.insert({ spot_id, name, category, area, avg_minutes: avg_minutes || 30, description: description || null, image_path: image_path || null });
  res.json({ success: true });
});

// スポット更新
router.put('/spots/:spotId', (req, res) => {
  const { name, category, area, avg_minutes, description, image_path } = req.body;
  spotRepo.update({ spot_id: req.params.spotId, name, category, area, avg_minutes: avg_minutes || 30, description: description || null, image_path: image_path || null });
  res.json({ success: true });
});

// スポット削除
router.delete('/spots/:spotId', (req, res) => {
  spotRepo.remove(req.params.spotId);
  res.json({ success: true });
});

// ラリー一覧
router.get('/rallies', (req, res) => {
  const rallies = spotRepo.getRallies();
  const rallySpots = spotRepo.getAllRallySpots();
  const spots = spotRepo.findAll();
  const spotMap = Object.fromEntries(spots.map(s => [s.spot_id, s]));
  const result = rallies.map(r => ({
    ...r,
    target_spots: rallySpots.filter(rs => rs.rally_id === r.rally_id).map(rs => ({ ...spotMap[rs.spot_id], spot_id: rs.spot_id }))
  }));
  res.json(result);
});

// 特典一覧
router.get('/benefits', (req, res) => {
  res.json(spotRepo.getBenefits());
});

// 再訪候補一覧
router.get('/revisit-candidates', (req, res) => {
  const candidates = analyticsService.getRevisitCandidates();
  res.json(candidates);
});

// 回遊順分析
router.get('/analytics/routes', (req, res) => {
  const data = analyticsService.getDashboard();
  res.json({ transitions: data.topTransitions });
});

module.exports = router;

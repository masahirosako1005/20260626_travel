const { getDb } = require('./db');

function findAll() {
  return getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all();
}

function findById(userId) {
  return getDb().prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
}

function upsert(user) {
  getDb().prepare(`
    INSERT INTO users (user_id, nickname, user_segment, created_at, analytics_consent, nickname_display_consent)
    VALUES (@user_id, @nickname, @user_segment, @created_at, @analytics_consent, @nickname_display_consent)
    ON CONFLICT(user_id) DO UPDATE SET
      nickname = excluded.nickname,
      user_segment = excluded.user_segment
  `).run(user);
}

function getUserSessions(userId) {
  return getDb().prepare(`
    SELECT DISTINCT session_id, MIN(visited_at) as session_start
    FROM visits WHERE user_id = ?
    GROUP BY session_id ORDER BY session_start
  `).all(userId);
}

function getLastSession(userId) {
  return getDb().prepare(`
    SELECT session_id, MIN(visited_at) as session_start, MAX(visited_at) as session_end
    FROM visits WHERE user_id = ?
    GROUP BY session_id ORDER BY session_start DESC LIMIT 1
  `).get(userId);
}

module.exports = { findAll, findById, upsert, getUserSessions, getLastSession };

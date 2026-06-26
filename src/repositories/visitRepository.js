const { getDb } = require('./db');

function getVisitsByUser(userId) {
  return getDb().prepare(`
    SELECT v.*, s.name as spot_name, s.category, s.area, s.avg_minutes
    FROM visits v JOIN spots s ON s.spot_id = v.spot_id
    WHERE v.user_id = ?
    ORDER BY v.visited_at
  `).all(userId);
}

function getVisitsBySession(userId, sessionId) {
  return getDb().prepare(`
    SELECT v.*, s.name as spot_name, s.category, s.area, s.avg_minutes
    FROM visits v JOIN spots s ON s.spot_id = v.spot_id
    WHERE v.user_id = ? AND v.session_id = ?
    ORDER BY v.route_order, v.visited_at
  `).all(userId, sessionId);
}

function getStampsByUser(userId) {
  return getDb().prepare(`
    SELECT st.*, s.name as spot_name, s.category, r.name as rally_name
    FROM stamps st
    JOIN spots s ON s.spot_id = st.spot_id
    LEFT JOIN rallies r ON r.rally_id = st.rally_id
    WHERE st.user_id = ?
    ORDER BY st.acquired_at
  `).all(userId);
}

function getBenefitUsesByUser(userId) {
  return getDb().prepare(`
    SELECT bu.*, b.name as benefit_name, b.category, s.name as spot_name
    FROM benefit_uses bu
    JOIN benefits b ON b.benefit_id = bu.benefit_id
    JOIN spots s ON s.spot_id = bu.spot_id
    WHERE bu.user_id = ?
    ORDER BY bu.used_at
  `).all(userId);
}

function getRouteUsagesByUser(userId) {
  return getDb().prepare('SELECT * FROM route_usages WHERE user_id = ? ORDER BY viewed_at').all(userId);
}

function insertVisit(visit) {
  getDb().prepare(`
    INSERT OR IGNORE INTO visits (visit_id, user_id, session_id, spot_id, visited_at, route_order, stay_minutes, pass_minutes, event_type)
    VALUES (@visit_id, @user_id, @session_id, @spot_id, @visited_at, @route_order, @stay_minutes, @pass_minutes, @event_type)
  `).run(visit);
}

function insertStamp(stamp) {
  getDb().prepare(`
    INSERT OR IGNORE INTO stamps (stamp_id, user_id, session_id, spot_id, rally_id, acquired_at, method)
    VALUES (@stamp_id, @user_id, @session_id, @spot_id, @rally_id, @acquired_at, @method)
  `).run(stamp);
}

function insertBenefitUse(bu) {
  getDb().prepare(`
    INSERT OR IGNORE INTO benefit_uses (benefit_use_id, user_id, session_id, benefit_id, spot_id, used_at, estimated_value_yen)
    VALUES (@benefit_use_id, @user_id, @session_id, @benefit_id, @spot_id, @used_at, @estimated_value_yen)
  `).run(bu);
}

function insertRouteUsage(ru) {
  getDb().prepare(`
    INSERT OR IGNORE INTO route_usages (route_usage_id, user_id, session_id, route_id, viewed_at, used)
    VALUES (@route_usage_id, @user_id, @session_id, @route_id, @viewed_at, @used)
  `).run(ru);
}

function getAllVisits() {
  return getDb().prepare('SELECT * FROM visits').all();
}

function getAllStamps() {
  return getDb().prepare('SELECT * FROM stamps').all();
}

function getAllBenefitUses() {
  return getDb().prepare('SELECT * FROM benefit_uses').all();
}

function getAllRouteUsages() {
  return getDb().prepare('SELECT * FROM route_usages').all();
}

function getSpotVisitCounts() {
  return getDb().prepare(`
    SELECT spot_id, COUNT(*) as visit_count, AVG(stay_minutes) as avg_stay
    FROM visits WHERE event_type='stay'
    GROUP BY spot_id ORDER BY visit_count DESC
  `).all();
}

function getSpotPassCounts() {
  return getDb().prepare(`
    SELECT spot_id, COUNT(*) as pass_count
    FROM visits WHERE event_type='pass'
    GROUP BY spot_id ORDER BY pass_count DESC
  `).all();
}

function getStampAcquisitionRates() {
  return getDb().prepare(`
    SELECT spot_id, COUNT(DISTINCT user_id) as acquired_users
    FROM stamps GROUP BY spot_id
  `).all();
}

function getUserSessionCounts() {
  return getDb().prepare(`
    SELECT user_id, COUNT(DISTINCT session_id) as session_count
    FROM visits GROUP BY user_id
  `).all();
}

module.exports = {
  getVisitsByUser, getVisitsBySession, getStampsByUser, getBenefitUsesByUser, getRouteUsagesByUser,
  insertVisit, insertStamp, insertBenefitUse, insertRouteUsage,
  getAllVisits, getAllStamps, getAllBenefitUses, getAllRouteUsages,
  getSpotVisitCounts, getSpotPassCounts, getStampAcquisitionRates, getUserSessionCounts
};

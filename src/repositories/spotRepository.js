const { getDb } = require('./db');

function findAll() {
  return getDb().prepare('SELECT * FROM spots ORDER BY spot_id').all();
}

function findById(spotId) {
  return getDb().prepare('SELECT * FROM spots WHERE spot_id = ?').get(spotId);
}

function upsert(spot) {
  getDb().prepare(`
    INSERT INTO spots (spot_id, name, category, area, avg_minutes, description, image_path)
    VALUES (@spot_id, @name, @category, @area, @avg_minutes, @description, @image_path)
    ON CONFLICT(spot_id) DO UPDATE SET
      name = excluded.name, category = excluded.category, area = excluded.area,
      avg_minutes = excluded.avg_minutes, description = excluded.description, image_path = excluded.image_path
  `).run(spot);
}

function insert(spot) {
  getDb().prepare(`
    INSERT INTO spots (spot_id, name, category, area, avg_minutes, description, image_path)
    VALUES (@spot_id, @name, @category, @area, @avg_minutes, @description, @image_path)
  `).run(spot);
}

function update(spot) {
  getDb().prepare(`
    UPDATE spots SET name=@name, category=@category, area=@area,
    avg_minutes=@avg_minutes, description=@description, image_path=@image_path
    WHERE spot_id=@spot_id
  `).run(spot);
}

function remove(spotId) {
  getDb().prepare('DELETE FROM spots WHERE spot_id = ?').run(spotId);
}

function getRallies() {
  return getDb().prepare('SELECT * FROM rallies ORDER BY rally_id').all();
}

function getRallyById(rallyId) {
  return getDb().prepare('SELECT * FROM rallies WHERE rally_id = ?').get(rallyId);
}

function getRallySpots(rallyId) {
  return getDb().prepare(`
    SELECT s.* FROM spots s
    JOIN rally_spots rs ON rs.spot_id = s.spot_id
    WHERE rs.rally_id = ?
  `).all(rallyId);
}

function getAllRallySpots() {
  return getDb().prepare('SELECT * FROM rally_spots').all();
}

function upsertRally(rally) {
  getDb().prepare(`
    INSERT INTO rallies (rally_id, name, description, season_tag)
    VALUES (@rally_id, @name, @description, @season_tag)
    ON CONFLICT(rally_id) DO UPDATE SET
      name = excluded.name, description = excluded.description, season_tag = excluded.season_tag
  `).run(rally);
}

function upsertRallySpot(rallyId, spotId) {
  getDb().prepare(`
    INSERT OR IGNORE INTO rally_spots (rally_id, spot_id) VALUES (?, ?)
  `).run(rallyId, spotId);
}

function getBenefits() {
  return getDb().prepare('SELECT * FROM benefits ORDER BY benefit_id').all();
}

function getBenefitById(benefitId) {
  return getDb().prepare('SELECT * FROM benefits WHERE benefit_id = ?').get(benefitId);
}

function upsertBenefit(benefit) {
  getDb().prepare(`
    INSERT INTO benefits (benefit_id, name, category, spot_id, estimated_value_yen, valid_from, valid_to)
    VALUES (@benefit_id, @name, @category, @spot_id, @estimated_value_yen, @valid_from, @valid_to)
    ON CONFLICT(benefit_id) DO UPDATE SET
      name=excluded.name, category=excluded.category, spot_id=excluded.spot_id,
      estimated_value_yen=excluded.estimated_value_yen, valid_from=excluded.valid_from, valid_to=excluded.valid_to
  `).run(benefit);
}

module.exports = {
  findAll, findById, upsert, insert, update, remove,
  getRallies, getRallyById, getRallySpots, getAllRallySpots, upsertRally, upsertRallySpot,
  getBenefits, getBenefitById, upsertBenefit
};

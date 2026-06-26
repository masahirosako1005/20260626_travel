const { transaction } = require('../repositories/db');
const userRepo = require('../repositories/userRepository');
const spotRepo = require('../repositories/spotRepository');
const visitRepo = require('../repositories/visitRepository');

function importJson(data) {
  const errors = [];
  const counts = { users: 0, spots: 0, rallies: 0, benefits: 0, visits: 0, stamps: 0, benefit_uses: 0, route_usages: 0 };

  transaction(() => {
    // spots
    for (const s of (data.spots || [])) {
      if (!s.spot_id || !s.name || !s.category || !s.area) {
        errors.push(`スポット必須項目不足: ${JSON.stringify(s)}`);
        continue;
      }
      spotRepo.upsert({ spot_id: s.spot_id, name: s.name, category: s.category, area: s.area, avg_minutes: s.avg_minutes || 30, description: s.description || null, image_path: s.image_path || null });
      counts.spots++;
    }

    // rallies
    for (const r of (data.rallies || [])) {
      if (!r.rally_id || !r.name) { errors.push(`ラリー必須項目不足: ${JSON.stringify(r)}`); continue; }
      spotRepo.upsertRally({ rally_id: r.rally_id, name: r.name, description: r.description || null, season_tag: r.season_tag || null });
      for (const sid of (r.target_spots || [])) {
        spotRepo.upsertRallySpot(r.rally_id, sid);
      }
      counts.rallies++;
    }

    // benefits
    for (const b of (data.benefits || [])) {
      if (!b.benefit_id || !b.name || !b.category) { errors.push(`特典必須項目不足: ${JSON.stringify(b)}`); continue; }
      spotRepo.upsertBenefit({ benefit_id: b.benefit_id, name: b.name, category: b.category, spot_id: b.spot_id || null, estimated_value_yen: b.estimated_value_yen || 0, valid_from: b.valid_from || null, valid_to: b.valid_to || null });
      counts.benefits++;
    }

    // users
    for (const u of (data.users || [])) {
      if (!u.user_id) { errors.push(`ユーザー必須項目不足: ${JSON.stringify(u)}`); continue; }
      userRepo.upsert({
        user_id: u.user_id,
        nickname: u.nickname || u.user_id,
        user_segment: u.user_segment || null,
        created_at: u.created_at || new Date().toISOString(),
        analytics_consent: u.consent_flags?.analytics ? 1 : 0,
        nickname_display_consent: u.consent_flags?.nickname_display ? 1 : 0
      });
      counts.users++;
    }

    // visits
    for (const v of (data.visits || [])) {
      if (!v.visit_id || !v.user_id || !v.session_id || !v.spot_id || !v.visited_at) {
        errors.push(`訪問履歴必須項目不足: ${v.visit_id}`); continue;
      }
      visitRepo.insertVisit({ visit_id: v.visit_id, user_id: v.user_id, session_id: v.session_id, spot_id: v.spot_id, visited_at: v.visited_at, route_order: v.route_order || null, stay_minutes: v.stay_minutes || 0, pass_minutes: v.pass_minutes || 0, event_type: v.event_type || 'stay' });
      counts.visits++;
    }

    // stamps
    for (const s of (data.stamps || [])) {
      if (!s.stamp_id || !s.user_id || !s.session_id || !s.spot_id || !s.acquired_at) {
        errors.push(`スタンプ必須項目不足: ${s.stamp_id}`); continue;
      }
      visitRepo.insertStamp({ stamp_id: s.stamp_id, user_id: s.user_id, session_id: s.session_id, spot_id: s.spot_id, rally_id: s.rally_id || null, acquired_at: s.acquired_at, method: s.method || 'mock_button' });
      counts.stamps++;
    }

    // benefit_uses
    for (const bu of (data.benefit_uses || [])) {
      if (!bu.benefit_use_id || !bu.user_id || !bu.session_id || !bu.benefit_id || !bu.spot_id || !bu.used_at) {
        errors.push(`特典利用必須項目不足: ${bu.benefit_use_id}`); continue;
      }
      visitRepo.insertBenefitUse({ benefit_use_id: bu.benefit_use_id, user_id: bu.user_id, session_id: bu.session_id, benefit_id: bu.benefit_id, spot_id: bu.spot_id, used_at: bu.used_at, estimated_value_yen: bu.estimated_value_yen || 0 });
      counts.benefit_uses++;
    }

    // route_usages
    for (const ru of (data.route_usages || [])) {
      if (!ru.route_usage_id || !ru.user_id || !ru.session_id || !ru.route_id || !ru.viewed_at) {
        errors.push(`ルート利用必須項目不足: ${ru.route_usage_id}`); continue;
      }
      visitRepo.insertRouteUsage({ route_usage_id: ru.route_usage_id, user_id: ru.user_id, session_id: ru.session_id, route_id: ru.route_id, viewed_at: ru.viewed_at, used: ru.used ? 1 : 0 });
      counts.route_usages++;
    }
  });

  return { counts, errors };
}

module.exports = { importJson };

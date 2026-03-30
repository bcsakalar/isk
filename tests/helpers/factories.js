let counter = 0;

function uniqueId() {
  return ++counter;
}

function getMockUser(overrides = {}) {
  const id = uniqueId();
  return {
    id,
    username: `testuser_${id}`,
    email: null,
    password_hash: '$2b$12$LJ3m4ys3Lg3WKgWwGBbPXeRYczONXuGi0Mf9g.Xq0C5A.TJY8HK6i',
    display_name: `Test User ${id}`,
    avatar_url: null,
    role: 'player',
    xp: 0,
    level: 1,
    total_wins: 0,
    total_games: 0,
    is_banned: false,
    is_guest: false,
    ban_reason: null,
    last_login_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function getMockGuestUser(overrides = {}) {
  const id = uniqueId();
  return {
    id,
    username: `misafir_${String(id).padStart(6, '0')}`,
    email: null,
    password_hash: 'guest-no-login',
    display_name: `Misafir ${id}`,
    avatar_url: null,
    role: 'guest',
    xp: 0,
    level: 1,
    total_wins: 0,
    total_games: 0,
    is_banned: false,
    is_guest: true,
    guest_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ban_reason: null,
    last_login_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function getMockRoom(overrides = {}) {
  const id = uniqueId();
  return {
    id,
    code: `TST${String(id).padStart(3, '0')}`,
    name: `Test Odası ${id}`,
    owner_id: 1,
    status: 'waiting',
    max_players: 8,
    total_rounds: 5,
    time_per_round: 90,
    current_round: 0,
    answer_reveal_mode: 'direct',
    voting_timer: 60,
    enabled_letters: null,
    is_private: false,
    password_hash: null,
    last_activity: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function getMockRoomPlayer(overrides = {}) {
  const id = uniqueId();
  return {
    id,
    room_id: 1,
    user_id: 1,
    total_score: 0,
    is_ready: false,
    joined_at: new Date(),
    left_at: null,
    ...overrides,
  };
}

function getMockRound(overrides = {}) {
  const id = uniqueId();
  return {
    id,
    room_id: 1,
    round_number: 1,
    letter: 'A',
    started_at: new Date(),
    finished_at: null,
    voting_started_at: null,
    voting_finished_at: null,
    ...overrides,
  };
}

function getMockAnswer(overrides = {}) {
  const id = uniqueId();
  return {
    id,
    round_id: 1,
    player_id: 1,
    category_id: 1,
    answer: 'Ankara',
    is_valid: true,
    is_unique: true,
    base_score: 10,
    vote_score: 0,
    is_duplicate: false,
    submitted_at: new Date(),
    ...overrides,
  };
}

function getMockCategory(overrides = {}) {
  const id = uniqueId();
  return {
    id,
    name: `Kategori ${id}`,
    slug: `kategori_${id}`,
    description: null,
    icon: null,
    is_default: false,
    is_active: true,
    created_at: new Date(),
    ...overrides,
  };
}

module.exports = {
  getMockUser,
  getMockGuestUser,
  getMockRoom,
  getMockRoomPlayer,
  getMockRound,
  getMockAnswer,
  getMockCategory,
};

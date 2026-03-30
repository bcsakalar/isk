const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../server/services/game.service');
jest.mock('../../server/db/queries/games.queries');
jest.mock('../../server/db/queries/rooms.queries');
jest.mock('../../server/db/queries/users.queries');

const gameService = require('../../server/services/game.service');
const gamesQueries = require('../../server/db/queries/games.queries');
const roomsQueries = require('../../server/db/queries/rooms.queries');
const usersQueries = require('../../server/db/queries/users.queries');
const { createTestApp } = require('../helpers/testApp');

const app = createTestApp();
const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';

function generateToken(payload = { id: 1, username: 'testuser', role: 'player' }) {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

beforeEach(() => {
  usersQueries.findById.mockResolvedValue({
    id: 1, username: 'testuser', role: 'player', is_banned: false,
  });
});

describe('GET /api/game/categories (public)', () => {
  it('kategorileri auth olmadan getir → 200', async () => {
    gamesQueries.getDefaultCategories.mockResolvedValue([
      { id: 1, name: 'İsim' }, { id: 2, name: 'Şehir' },
    ]);

    const res = await request(app).get('/api/game/categories');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /api/game/leaderboard (public)', () => {
  it('liderlik tablosu → 200', async () => {
    usersQueries.getLeaderboard.mockResolvedValue([
      { id: 1, username: 'user1', display_name: 'User 1', avatar_url: null, xp: 100, level: 1, total_wins: 5, total_games: 10 },
    ]);

    const res = await request(app).get('/api/game/leaderboard');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /api/game/:roomId/start', () => {
  it('oyun başlatma → 200', async () => {
    gameService.startGame.mockResolvedValue({ gameId: 1, round: { id: 1, letter: 'A' } });

    const res = await request(app)
      .post('/api/game/1/start')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gameId).toBe(1);
  });

  it('token olmadan → 401', async () => {
    const res = await request(app).post('/api/game/1/start');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/game/:roomId/answers', () => {
  it('cevap gönderme → 200', async () => {
    gameService.submitAnswers.mockResolvedValue({ saved: true });

    const res = await request(app)
      .post('/api/game/1/answers')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ answers: [{ categoryId: 1, answer: 'Ankara' }] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/game/:roomId/vote', () => {
  it('oy verme → 200', async () => {
    gameService.submitVote.mockResolvedValue({ answerId: 5, positive: 1, negative: 0 });

    const res = await request(app)
      .post('/api/game/1/vote')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ answerId: 5, voteType: 'positive' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('token olmadan → 401', async () => {
    const res = await request(app)
      .post('/api/game/1/vote')
      .send({ answerId: 5, voteType: 'positive' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/game/:roomId/images', () => {
  it('resim yükleme → 200', async () => {
    gameService.uploadImage.mockResolvedValue({ imageId: 1 });

    const res = await request(app)
      .post('/api/game/1/images')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ answerId: 5, imageData: 'data:image/png;base64,abc', mimeType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/game/rounds/:roundId/results', () => {
  it('round sonuçları → 200', async () => {
    gamesQueries.getDetailedAnswersForRound.mockResolvedValue([
      { player_id: 1, category_id: 1, answer: 'Adana', score: 10 },
    ]);

    const res = await request(app)
      .get('/api/game/rounds/1/results')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

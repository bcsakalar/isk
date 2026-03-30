const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../server/services/room.service');
jest.mock('../../server/db/queries/users.queries');

const roomService = require('../../server/services/room.service');
const usersQueries = require('../../server/db/queries/users.queries');
const { createTestApp } = require('../helpers/testApp');

const app = createTestApp();
const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key';

function generateToken(payload = { id: 1, username: 'testuser', role: 'player' }) {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

beforeEach(() => {
  // authenticateToken → findById çağrısı
  usersQueries.findById.mockResolvedValue({
    id: 1, username: 'testuser', role: 'player', is_banned: false,
  });
});

describe('POST /api/rooms', () => {
  it('başarılı oda oluşturma → 201', async () => {
    roomService.createRoom.mockResolvedValue({
      id: 1, name: 'Test Oda', code: 'ABC123', status: 'waiting',
    });

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ name: 'Test Oda', gameMode: 'classic', maxPlayers: 6, totalRounds: 5, timePerRound: 60 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Oda');
  });

  it('token olmadan → 401', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ name: 'Test Oda' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/rooms/join', () => {
  it('odaya katılma → 200', async () => {
    roomService.joinRoom.mockResolvedValue({ roomId: 1, playerId: 5 });

    const res = await request(app)
      .post('/api/rooms/join')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ code: 'ABC123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('oda bulunamazsa → hata', async () => {
    const { NotFoundError } = require('../../server/utils/errors');
    roomService.joinRoom.mockRejectedValue(new NotFoundError('Oda bulunamadı'));

    const res = await request(app)
      .post('/api/rooms/join')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ code: 'INVALID' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/rooms', () => {
  it('aktif odaları listele → 200', async () => {
    roomService.listActiveRooms.mockResolvedValue([
      { id: 1, name: 'Oda 1', status: 'waiting' },
    ]);

    const res = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/rooms/:roomId', () => {
  it('oda detayını getir → 200', async () => {
    roomService.getRoom.mockResolvedValue({ id: 1, name: 'Oda', status: 'waiting' });

    const res = await request(app)
      .get('/api/rooms/1')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });
});

describe('POST /api/rooms/:roomId/leave', () => {
  it('odadan ayrılma → 200', async () => {
    roomService.leaveRoom.mockResolvedValue({ left: true });

    const res = await request(app)
      .post('/api/rooms/1/leave')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/rooms/:roomId/ready', () => {
  it('hazır durumu güncelle → 200', async () => {
    roomService.setReady.mockResolvedValue({ allReady: false });

    const res = await request(app)
      .post('/api/rooms/1/ready')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ ready: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/rooms/public', () => {
  it('auth olmadan aktif odaları listele → 200', async () => {
    roomService.listPublicRooms.mockResolvedValue([
      { code: 'ABC123', name: 'Oda 1', status: 'waiting', is_private: false, max_players: 8, player_count: 2, category_count: 5, owner_name: 'ali', total_rounds: 10, has_password: false },
    ]);

    const res = await request(app)
      .get('/api/rooms/public');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].code).toBe('ABC123');
  });

  it('response içinde id ve owner_id bulunmaz', async () => {
    roomService.listPublicRooms.mockResolvedValue([
      { code: 'XYZ789', name: 'Oda 2', status: 'waiting', is_private: false, max_players: 6, player_count: 1, category_count: 3, owner_name: 'veli', total_rounds: 5, has_password: false },
    ]);

    const res = await request(app)
      .get('/api/rooms/public');

    expect(res.status).toBe(200);
    expect(res.body.data[0]).not.toHaveProperty('id');
    expect(res.body.data[0]).not.toHaveProperty('owner_id');
  });

  it('boş oda listesi → 200 ve boş dizi', async () => {
    roomService.listPublicRooms.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/rooms/public');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('Yasaklı kullanıcı kontrolü', () => {
  it('yasaklı kullanıcı → 401', async () => {
    usersQueries.findById.mockResolvedValue({
      id: 1, username: 'banneduser', role: 'player', is_banned: true,
    });

    const res = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(401);
  });
});

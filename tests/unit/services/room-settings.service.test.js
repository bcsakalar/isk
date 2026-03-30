jest.mock('../../../server/db/queries/rooms.queries');
jest.mock('../../../server/db/queries/games.queries');
jest.mock('../../../server/db/queries/users.queries');
jest.mock('../../../server/utils/crypto', () => ({
  generateRoomCode: jest.fn(() => 'XYZ999'),
}));
jest.mock('../../../server/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const roomsQueries = require('../../../server/db/queries/rooms.queries');
const { getMockRoom } = require('../../helpers/factories');

let roomService;
beforeAll(() => {
  roomService = require('../../../server/services/room.service');
});

describe('roomService.updateSettings — voting timer', () => {
  beforeEach(() => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ id: 1, owner_id: 1, status: 'waiting' }));
    roomsQueries.updateSettings.mockImplementation((id, updates) => {
      const room = getMockRoom({ id, ...updates });
      return { ...room, has_password: false };
    });
  });

  it('votingTimer = 0 kabul edilmeli (süresiz mod)', async () => {
    const result = await roomService.updateSettings(1, 1, { votingTimer: 0 });
    expect(result).toBeDefined();
    expect(roomsQueries.updateSettings).toHaveBeenCalledWith(1, expect.objectContaining({ voting_timer: 0 }));
  });

  it('votingTimer = 60 kabul edilmeli', async () => {
    const result = await roomService.updateSettings(1, 1, { votingTimer: 60 });
    expect(result).toBeDefined();
    expect(roomsQueries.updateSettings).toHaveBeenCalledWith(1, expect.objectContaining({ voting_timer: 60 }));
  });

  it('votingTimer = 300 kabul edilmeli (maximum)', async () => {
    const result = await roomService.updateSettings(1, 1, { votingTimer: 300 });
    expect(result).toBeDefined();
    expect(roomsQueries.updateSettings).toHaveBeenCalledWith(1, expect.objectContaining({ voting_timer: 300 }));
  });

  it('votingTimer = -1 reddedilmeli', async () => {
    await expect(roomService.updateSettings(1, 1, { votingTimer: -1 }))
      .rejects.toThrow('Oylama süresi 0 (süresiz) veya 10-300 saniye arasında olmalıdır');
  });

  it('votingTimer = 5 reddedilmeli (10 altı)', async () => {
    await expect(roomService.updateSettings(1, 1, { votingTimer: 5 }))
      .rejects.toThrow('Oylama süresi 0 (süresiz) veya 10-300 saniye arasında olmalıdır');
  });

  it('votingTimer = 301 reddedilmeli', async () => {
    await expect(roomService.updateSettings(1, 1, { votingTimer: 301 }))
      .rejects.toThrow('Oylama süresi 0 (süresiz) veya 10-300 saniye arasında olmalıdır');
  });

  it('votingTimer = NaN reddedilmeli', async () => {
    await expect(roomService.updateSettings(1, 1, { votingTimer: 'abc' }))
      .rejects.toThrow('Oylama süresi 0 (süresiz) veya 10-300 saniye arasında olmalıdır');
  });
});

describe('roomService.updateSettings — answer reveal mode', () => {
  beforeEach(() => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ id: 1, owner_id: 1, status: 'waiting' }));
    roomsQueries.updateSettings.mockImplementation((id, updates) => {
      const room = getMockRoom({ id, ...updates });
      return { ...room, has_password: false };
    });
  });

  it('direct mod kabul edilmeli', async () => {
    const result = await roomService.updateSettings(1, 1, { answerRevealMode: 'direct' });
    expect(result).toBeDefined();
    expect(roomsQueries.updateSettings).toHaveBeenCalledWith(1, expect.objectContaining({ answer_reveal_mode: 'direct' }));
  });

  it('button mod kabul edilmeli', async () => {
    const result = await roomService.updateSettings(1, 1, { answerRevealMode: 'button' });
    expect(result).toBeDefined();
    expect(roomsQueries.updateSettings).toHaveBeenCalledWith(1, expect.objectContaining({ answer_reveal_mode: 'button' }));
  });

  it('geçersiz cevap gösterme modu reddedilmeli', async () => {
    await expect(roomService.updateSettings(1, 1, { answerRevealMode: 'invalid' }))
      .rejects.toThrow('Geçersiz cevap gösterme modu');
  });
});

describe('roomService.joinRoom — finished rooms', () => {
  it('finished odaya katılan mevcut oyuncuyu kabul etmeli', async () => {
    const room = getMockRoom({ id: 1, status: 'finished', code: 'FIN001' });
    roomsQueries.findByCode.mockResolvedValue(room);
    roomsQueries.getPlayerByRoomAndUser.mockResolvedValue({ id: 10, user_id: 1, room_id: 1 });

    const result = await roomService.joinRoom({ userId: 1, code: 'FIN001' });
    expect(result.alreadyJoined).toBe(true);
  });

  it('finished odaya yeni oyuncunun katılmasını reddetmeli', async () => {
    const room = getMockRoom({ id: 1, status: 'finished', code: 'FIN002' });
    roomsQueries.findByCode.mockResolvedValue(room);
    roomsQueries.getPlayerByRoomAndUser.mockResolvedValue(null);

    await expect(roomService.joinRoom({ userId: 99, code: 'FIN002' }))
      .rejects.toThrow('Bu oda artık aktif değil');
  });

  it('abandoned odaya kimsenin katılmasını reddetmeli', async () => {
    const room = getMockRoom({ id: 1, status: 'abandoned', code: 'ABN001' });
    roomsQueries.findByCode.mockResolvedValue(room);

    await expect(roomService.joinRoom({ userId: 1, code: 'ABN001' }))
      .rejects.toThrow('Bu oda artık aktif değil');
  });
});

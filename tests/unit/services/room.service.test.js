jest.mock('../../../server/db/queries/rooms.queries');
jest.mock('../../../server/db/queries/games.queries');
jest.mock('../../../server/db/queries/users.queries');
jest.mock('../../../server/utils/crypto', () => ({
  generateRoomCode: jest.fn(() => 'ABC123'),
}));
jest.mock('../../../server/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const bcrypt = require('bcrypt');
const roomsQueries = require('../../../server/db/queries/rooms.queries');
const gamesQueries = require('../../../server/db/queries/games.queries');
const usersQueries = require('../../../server/db/queries/users.queries');
const { generateRoomCode } = require('../../../server/utils/crypto');
const { getMockRoom, getMockRoomPlayer, getMockUser, getMockGuestUser } = require('../../helpers/factories');

let roomService;
beforeAll(() => {
  roomService = require('../../../server/services/room.service');
});

describe('roomService.createRoom', () => {
  beforeEach(() => {
    usersQueries.findById.mockResolvedValue(getMockUser({ id: 1, is_guest: false }));
    roomsQueries.findByCode.mockResolvedValue(null);
    roomsQueries.create.mockResolvedValue(getMockRoom({ id: 1, code: 'ABC123' }));
    roomsQueries.addPlayer.mockResolvedValue(getMockRoomPlayer());
    roomsQueries.setCategories.mockResolvedValue();
    gamesQueries.getDefaultCategories.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  });

  it('geçerli bilgilerle oda oluşturmalı', async () => {
    const room = await roomService.createRoom({
      userId: 1,
      name: 'Test Odası',
      maxPlayers: 8,
      totalRounds: 5,
      timePerRound: 90,
    });

    expect(room).toBeDefined();
    expect(roomsQueries.create).toHaveBeenCalled();
    expect(roomsQueries.addPlayer).toHaveBeenCalled();
  });

  it('kısa oda adını reddetmeli', async () => {
    await expect(roomService.createRoom({ userId: 1, name: 'A' }))
      .rejects.toThrow('Oda adı 2-40 karakter arasında olmalıdır');
  });

  it('uzun oda adını reddetmeli', async () => {
    await expect(roomService.createRoom({ userId: 1, name: 'x'.repeat(41) }))
      .rejects.toThrow('Oda adı 2-40 karakter arasında olmalıdır');
  });

  it('code çakışmasında retry yapmalı', async () => {
    roomsQueries.findByCode
      .mockResolvedValueOnce({ id: 99 }) // ilk deneme çakışır
      .mockResolvedValueOnce(null); // ikinci deneme boş

    const room = await roomService.createRoom({ userId: 1, name: 'Test Odası' });
    expect(room).toBeDefined();
    expect(generateRoomCode).toHaveBeenCalledTimes(2);
  });

  it('private oda için şifre hashlemeli', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_pass');
    await roomService.createRoom({ userId: 1, name: 'Gizli Oda', isPrivate: true, password: 'secret123' });
    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
  });

  it('misafir kullanıcılar oda oluşturabilmeli', async () => {
    usersQueries.findById.mockResolvedValue(getMockGuestUser());
    const room = await roomService.createRoom({ userId: 99, name: 'Test Odası' });
    expect(room).toBeDefined();
    expect(roomsQueries.create).toHaveBeenCalled();
  });
});

describe('roomService.joinRoom', () => {
  const mockRoom = getMockRoom({ id: 1, code: 'ABC123', status: 'waiting', max_players: 4 });

  beforeEach(() => {
    roomsQueries.findByCode.mockResolvedValue(mockRoom);
    roomsQueries.getPlayerCount.mockResolvedValue(2);
    roomsQueries.getPlayerByRoomAndUser.mockResolvedValue(null);
    roomsQueries.addPlayer.mockResolvedValue(getMockRoomPlayer());
    roomsQueries.touchActivity.mockResolvedValue();
  });

  it('geçerli bilgilerle odaya katılmalı', async () => {
    const result = await roomService.joinRoom({ userId: 2, code: 'ABC123' });
    expect(result.room).toBeDefined();
    expect(result.alreadyJoined).toBe(false);
  });

  it('olmayan oda kodu ile NotFoundError fırlatmalı', async () => {
    roomsQueries.findByCode.mockResolvedValue(null);
    await expect(roomService.joinRoom({ userId: 2, code: 'NONE00' }))
      .rejects.toThrow('Oda bulunamadı');
  });

  it('bitmiş odaya katılımı reddetmeli', async () => {
    roomsQueries.findByCode.mockResolvedValue(getMockRoom({ status: 'finished' }));
    await expect(roomService.joinRoom({ userId: 2, code: 'ABC123' }))
      .rejects.toThrow('Bu oda artık aktif değil');
  });

  it('dolu odaya katılımı reddetmeli', async () => {
    roomsQueries.getPlayerCount.mockResolvedValue(4);
    await expect(roomService.joinRoom({ userId: 2, code: 'ABC123' }))
      .rejects.toThrow('Oda dolu');
  });

  it('şifreli odada yanlış şifre ile ForbiddenError fırlatmalı', async () => {
    roomsQueries.findByCode.mockResolvedValue(getMockRoom({ is_private: true, password_hash: 'hash' }));
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    await expect(roomService.joinRoom({ userId: 2, code: 'ABC123', password: 'wrong' }))
      .rejects.toThrow('Oda şifresi yanlış');
  });

  it('zaten odada olan kullanıcıyı bilgilendirmeli', async () => {
    roomsQueries.getPlayerByRoomAndUser.mockResolvedValue(getMockRoomPlayer());
    const result = await roomService.joinRoom({ userId: 2, code: 'ABC123' });
    expect(result.alreadyJoined).toBe(true);
  });
});

describe('roomService.leaveRoom', () => {
  beforeEach(() => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ id: 1, owner_id: 1 }));
    roomsQueries.removePlayer.mockResolvedValue();
    roomsQueries.touchActivity.mockResolvedValue();
    roomsQueries.getPlayerCount.mockResolvedValue(1);
    roomsQueries.updateStatus.mockResolvedValue();
    roomsQueries.getPlayers.mockResolvedValue([]);
  });

  it('başarılı ayrılma sonucu döndürmeli', async () => {
    const result = await roomService.leaveRoom({ userId: 2, roomId: 1 });
    expect(result.playerCount).toBeDefined();
    expect(roomsQueries.removePlayer).toHaveBeenCalled();
  });

  it('son oyuncu çıkınca odayı abandoned yapmalı', async () => {
    roomsQueries.getPlayerCount.mockResolvedValue(0);
    await roomService.leaveRoom({ userId: 1, roomId: 1 });
    expect(roomsQueries.updateStatus).toHaveBeenCalledWith(1, 'abandoned');
  });

  it('olmayan oda ile NotFoundError fırlatmalı', async () => {
    roomsQueries.findById.mockResolvedValue(null);
    await expect(roomService.leaveRoom({ userId: 1, roomId: 999 }))
      .rejects.toThrow('Oda bulunamadı');
  });

  it('oda sahibi çıkarsa sahipliği devretmeli', async () => {
    const { query: dbQuery } = require('../../../server/config/database');
    roomsQueries.findById.mockResolvedValue(getMockRoom({ id: 1, owner_id: 1 }));
    roomsQueries.getPlayerCount.mockResolvedValue(2);
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ user_id: 5 }),
      getMockRoomPlayer({ user_id: 6 }),
    ]);
    dbQuery.mockResolvedValue();

    const result = await roomService.leaveRoom({ userId: 1, roomId: 1 });
    expect(result.newOwnerId).toBe(5);
    expect(dbQuery).toHaveBeenCalledWith('UPDATE rooms SET owner_id = $1 WHERE id = $2', [5, 1]);
  });

  it('oda sahibi değilse newOwnerId null olmalı', async () => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ id: 1, owner_id: 99 }));
    roomsQueries.getPlayerCount.mockResolvedValue(2);

    const result = await roomService.leaveRoom({ userId: 2, roomId: 1 });
    expect(result.newOwnerId).toBeNull();
  });
});

describe('roomService.transferOwnership', () => {
  const { query: dbQuery } = require('../../../server/config/database');

  beforeEach(() => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ id: 1, owner_id: 1, status: 'waiting' }));
    roomsQueries.getPlayerByRoomAndUser.mockResolvedValue(getMockRoomPlayer({ user_id: 5 }));
    dbQuery.mockResolvedValue();
  });

  it('geçerli bilgilerle sahipliği devretmeli', async () => {
    const result = await roomService.transferOwnership({ roomId: 1, ownerId: 1, targetUserId: 5 });
    expect(result.newOwnerId).toBe(5);
    expect(dbQuery).toHaveBeenCalledWith('UPDATE rooms SET owner_id = $1 WHERE id = $2', [5, 1]);
  });

  it('oda sahibi olmayan kullanıcı devredemez', async () => {
    await expect(roomService.transferOwnership({ roomId: 1, ownerId: 99, targetUserId: 5 }))
      .rejects.toThrow('Sadece oda sahibi sahipliği devredebilir');
  });

  it('oyun başlamışken devir yapılamaz', async () => {
    roomsQueries.findById.mockResolvedValue(getMockRoom({ id: 1, owner_id: 1, status: 'playing' }));
    await expect(roomService.transferOwnership({ roomId: 1, ownerId: 1, targetUserId: 5 }))
      .rejects.toThrow('Oyun başlamışken sahiplik devredilemez');
  });

  it('hedef oyuncu odada değilse hata fırlatmalı', async () => {
    roomsQueries.getPlayerByRoomAndUser.mockResolvedValue(null);
    await expect(roomService.transferOwnership({ roomId: 1, ownerId: 1, targetUserId: 5 }))
      .rejects.toThrow('Hedef oyuncu bu odada değil');
  });

  it('kendine devretmeye çalışırsa hata fırlatmalı', async () => {
    await expect(roomService.transferOwnership({ roomId: 1, ownerId: 1, targetUserId: 1 }))
      .rejects.toThrow('Zaten oda sahibisiniz');
  });

  it('olmayan oda için NotFoundError fırlatmalı', async () => {
    roomsQueries.findById.mockResolvedValue(null);
    await expect(roomService.transferOwnership({ roomId: 999, ownerId: 1, targetUserId: 5 }))
      .rejects.toThrow('Oda bulunamadı');
  });
});

describe('roomService.setReady', () => {
  it('tüm oyuncular hazırsa allReady: true döndürmeli', async () => {
    roomsQueries.setPlayerReady.mockResolvedValue();
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ is_ready: true }),
      getMockRoomPlayer({ is_ready: true }),
    ]);

    const result = await roomService.setReady(1, 1, true);
    expect(result.allReady).toBe(true);
  });

  it('tek oyuncu hazırsa allReady: false döndürmeli (min 2 gerekli)', async () => {
    roomsQueries.setPlayerReady.mockResolvedValue();
    roomsQueries.getPlayers.mockResolvedValue([
      getMockRoomPlayer({ is_ready: true }),
    ]);

    const result = await roomService.setReady(1, 1, true);
    expect(result.allReady).toBe(false);
  });
});

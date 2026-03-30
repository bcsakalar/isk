jest.mock('../../../server/db/queries/rooms.queries');
jest.mock('../../../server/db/queries/games.queries');
jest.mock('../../../server/db/queries/admin.queries');

const roomsQueries = require('../../../server/db/queries/rooms.queries');
const gamesQueries = require('../../../server/db/queries/games.queries');
const adminQueries = require('../../../server/db/queries/admin.queries');

let cleanupService;
beforeAll(() => {
  cleanupService = require('../../../server/services/cleanup.service');
});

describe('cleanupService.cleanInactiveRooms', () => {
  beforeEach(() => {
    roomsQueries.getInactiveRooms.mockResolvedValue([]);
    roomsQueries.abandonRooms.mockResolvedValue();
    roomsQueries.deleteOldAbandoned.mockResolvedValue();
  });

  it('inaktif oda yoksa sadece deleteOldAbandoned çağrılmalı', async () => {
    await cleanupService.cleanInactiveRooms();
    expect(roomsQueries.getInactiveRooms).toHaveBeenCalled();
    expect(roomsQueries.abandonRooms).not.toHaveBeenCalled();
    expect(roomsQueries.deleteOldAbandoned).toHaveBeenCalledWith(1);
  });

  it('inaktif odalar varsa abandon etmeli', async () => {
    roomsQueries.getInactiveRooms.mockResolvedValue([1, 2, 3]);
    await cleanupService.cleanInactiveRooms();
    expect(roomsQueries.abandonRooms).toHaveBeenCalledWith([1, 2, 3]);
  });
});

describe('cleanupService.cleanExpiredSessions', () => {
  it('expired session temizlemesi yapmalı', async () => {
    adminQueries.cleanExpiredSessions.mockResolvedValue(5);
    await cleanupService.cleanExpiredSessions();
    expect(adminQueries.cleanExpiredSessions).toHaveBeenCalled();
  });
});

describe('cleanupService.purgeOldChats', () => {
  it('eski mesajları silmeli', async () => {
    gamesQueries.purgeOldMessages.mockResolvedValue(10);
    await cleanupService.purgeOldChats();
    expect(gamesQueries.purgeOldMessages).toHaveBeenCalled();
  });
});

jest.mock('../../../server/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const { query } = require('../../../server/config/database');
const gamesQueries = require('../../../server/db/queries/games.queries');

describe('gamesQueries.getMessages', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [] });
  });

  it('roomId varken $1=roomId, $2=limit ile sorgu yapmalı', async () => {
    await gamesQueries.getMessages(42, 20);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual([42, 20]);
    expect(sql).toContain('cm.room_id = $1');
    expect(sql).toMatch(/LIMIT \$2/);
  });

  it('roomId null iken cm.room_id IS NULL ve $1=limit ile sorgu yapmalı', async () => {
    await gamesQueries.getMessages(null, 50);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual([50]);
    expect(sql).toContain('cm.room_id IS NULL');
    expect(sql).toMatch(/LIMIT \$1/);
  });

  it('varsayılan limit 50 olmalı', async () => {
    await gamesQueries.getMessages(null);

    const [, params] = query.mock.calls[0];
    expect(params).toEqual([50]);
  });

  it('sonuçları ters sıralayarak döndürmeli', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 3, message: 'üçüncü' },
        { id: 2, message: 'ikinci' },
        { id: 1, message: 'birinci' },
      ],
    });

    const result = await gamesQueries.getMessages(1, 10);

    expect(result).toEqual([
      { id: 1, message: 'birinci' },
      { id: 2, message: 'ikinci' },
      { id: 3, message: 'üçüncü' },
    ]);
  });
});

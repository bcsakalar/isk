jest.mock('../../../server/db/queries/kvkk.queries');

const kvkkQueries = require('../../../server/db/queries/kvkk.queries');

let kvkkService;
beforeAll(() => {
  kvkkService = require('../../../server/services/kvkk.service');
});

describe('kvkkService.acceptPrivacy', () => {
  beforeEach(() => {
    kvkkQueries.recordConsent.mockResolvedValue({ id: 1, created_at: new Date() });
    kvkkQueries.updateUserPrivacyAcceptance.mockResolvedValue();
  });

  it('onay kaydedip versiyon döndürmeli', async () => {
    const result = await kvkkService.acceptPrivacy({
      userId: 1,
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    });

    expect(result.version).toBe('1.0');
    expect(kvkkQueries.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, consentType: 'privacy_policy' })
    );
    expect(kvkkQueries.updateUserPrivacyAcceptance).toHaveBeenCalledWith(1, '1.0');
  });
});

describe('kvkkService.getPrivacyStatus', () => {
  it('onay durumunu döndürmeli', async () => {
    kvkkQueries.getUserPrivacyStatus.mockResolvedValue({
      privacy_accepted_at: new Date(),
      privacy_version: '1.0',
      deletion_requested_at: null,
    });
    kvkkQueries.getConsentHistory.mockResolvedValue([]);

    const result = await kvkkService.getPrivacyStatus(1);
    expect(result.accepted).toBe(true);
    expect(result.version).toBe('1.0');
    expect(result.deletionRequested).toBe(false);
  });

  it('kullanıcı yoksa NotFoundError fırlatmalı', async () => {
    kvkkQueries.getUserPrivacyStatus.mockResolvedValue(null);
    await expect(kvkkService.getPrivacyStatus(999)).rejects.toThrow('Kullanıcı bulunamadı');
  });
});

describe('kvkkService.requestDeletion', () => {
  beforeEach(() => {
    kvkkQueries.getDeletionRequest.mockResolvedValue(null);
    kvkkQueries.requestDeletion.mockResolvedValue({
      id: 1,
      requested_at: new Date(),
      scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  it('silme talebi oluşturmalı', async () => {
    const result = await kvkkService.requestDeletion({ userId: 1, reason: 'Test', ip: '127.0.0.1' });
    expect(result.id).toBeDefined();
    expect(result.scheduled_for).toBeDefined();
  });

  it('zaten aktif talep varsa BadRequestError fırlatmalı', async () => {
    kvkkQueries.getDeletionRequest.mockResolvedValue({ id: 1 });
    await expect(kvkkService.requestDeletion({ userId: 1 }))
      .rejects.toThrow('Zaten aktif bir silme talebiniz bulunuyor');
  });
});

describe('kvkkService.cancelDeletion', () => {
  it('aktif talep yoksa BadRequestError fırlatmalı', async () => {
    kvkkQueries.getDeletionRequest.mockResolvedValue(null);
    await expect(kvkkService.cancelDeletion(1))
      .rejects.toThrow('Aktif bir silme talebi bulunamadı');
  });

  it('aktif talebi iptal etmeli', async () => {
    kvkkQueries.getDeletionRequest.mockResolvedValue({ id: 1 });
    kvkkQueries.cancelDeletion.mockResolvedValue();
    await expect(kvkkService.cancelDeletion(1)).resolves.not.toThrow();
  });
});

describe('kvkkService.exportData', () => {
  it('kullanıcı verilerini döndürmeli', async () => {
    kvkkQueries.exportUserData.mockResolvedValue({
      user: { id: 1, username: 'testuser' },
      consents: [],
      games: [],
    });

    const result = await kvkkService.exportData(1);
    expect(result.user).toBeDefined();
    expect(result.consents).toBeDefined();
  });

  it('kullanıcı yoksa NotFoundError fırlatmalı', async () => {
    kvkkQueries.exportUserData.mockResolvedValue({ user: null, consents: [], games: [] });
    await expect(kvkkService.exportData(999)).rejects.toThrow('Kullanıcı bulunamadı');
  });
});

describe('kvkkService.processScheduledDeletions', () => {
  it('zamanı gelmiş hesapları silmeli', async () => {
    kvkkQueries.getScheduledDeletions.mockResolvedValue([
      { id: 1, user_id: 10, scheduled_for: new Date(), username: 'user10' },
    ]);
    kvkkQueries.deleteUserPermanently.mockResolvedValue();
    kvkkQueries.markDeletionCompleted.mockResolvedValue();

    const count = await kvkkService.processScheduledDeletions();
    expect(count).toBe(1);
    expect(kvkkQueries.deleteUserPermanently).toHaveBeenCalledWith(10);
    expect(kvkkQueries.markDeletionCompleted).toHaveBeenCalledWith(1);
  });

  it('zamanı gelmemiş hesapları silmemeli', async () => {
    kvkkQueries.getScheduledDeletions.mockResolvedValue([]);
    const count = await kvkkService.processScheduledDeletions();
    expect(count).toBe(0);
  });
});

const { checkEventLimit } = require('../../server/socket/middleware/socketRateLimit');

describe('Socket Rate Limiting Güvenlik Testleri', () => {
  describe('checkEventLimit — event bazlı rate limit', () => {
    beforeEach(() => {
      // Rate limit state'ini temizle
      const socketRateLimit = require('../../server/socket/middleware/socketRateLimit');
      socketRateLimit.stopCleanup();
    });

    it('game:upload_image — ilk istek kabul edilmeli', () => {
      expect(checkEventLimit('user1', 'game:upload_image')).toBe(true);
    });

    it('game:upload_image — 3 saniye içinde 2. istek reddedilmeli', () => {
      checkEventLimit('user2', 'game:upload_image');
      expect(checkEventLimit('user2', 'game:upload_image')).toBe(false);
    });

    it('chat:room — 3 mesaj/saniye kabul edilmeli', () => {
      expect(checkEventLimit('user3', 'chat:room')).toBe(true);
      expect(checkEventLimit('user3', 'chat:room')).toBe(true);
      expect(checkEventLimit('user3', 'chat:room')).toBe(true);
    });

    it('chat:room — 4. mesaj/saniye reddedilmeli', () => {
      checkEventLimit('user4', 'chat:room');
      checkEventLimit('user4', 'chat:room');
      checkEventLimit('user4', 'chat:room');
      expect(checkEventLimit('user4', 'chat:room')).toBe(false);
    });

    it('farklı kullanıcılar birbirini etkilememeli', () => {
      checkEventLimit('userA', 'game:upload_image');
      // userA limiti doldu ama userB etkilenmemeli
      expect(checkEventLimit('userB', 'game:upload_image')).toBe(true);
    });

    it('tanımsız event için her zaman true dönmeli', () => {
      expect(checkEventLimit('user5', 'unknown:event')).toBe(true);
      expect(checkEventLimit('user5', 'unknown:event')).toBe(true);
      expect(checkEventLimit('user5', 'unknown:event')).toBe(true);
    });

    it('chat: prefix ile eşleşen tüm eventler limitlenemeli', () => {
      // chat: prefix rule'u chat:room, chat:reaction vs. hepsini kapsar
      checkEventLimit('user6', 'chat:reaction');
      checkEventLimit('user6', 'chat:reaction');
      checkEventLimit('user6', 'chat:reaction');
      expect(checkEventLimit('user6', 'chat:reaction')).toBe(false);
    });
  });
});

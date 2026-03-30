const socketRateLimit = require('../../server/socket/middleware/socketRateLimit');
const { stopCleanup } = require('../../server/socket/middleware/socketRateLimit');

function createMockSocket(userId = null, socketId = 'sock-1') {
  return {
    id: socketId,
    user: userId ? { id: userId } : null,
  };
}

afterAll(() => {
  stopCleanup();
});

describe('socketRateLimit middleware', () => {
  it('ilk mesajı geçirmeli', (done) => {
    const socket = createMockSocket(100, 'rate-test-1');

    socketRateLimit(socket, (err) => {
      expect(err).toBeUndefined();
      done();
    });
  });

  it('MAX_MESSAGES_PER_SECOND (5) altında mesajlara izin vermeli', (done) => {
    const socket = createMockSocket(200, 'rate-test-2');
    let passed = 0;

    for (let i = 0; i < 5; i++) {
      socketRateLimit(socket, (err) => {
        if (!err) passed++;
        if (passed === 5) done();
      });
    }
  });

  it('limiti aşan mesajı engellemeli', (done) => {
    const socket = createMockSocket(300, 'rate-test-3');
    let blocked = false;

    // 6 mesaj gönder — 6. engellenmeli
    for (let i = 0; i < 6; i++) {
      socketRateLimit(socket, (err) => {
        if (err && err.message.includes('Rate limit')) {
          blocked = true;
          done();
        }
      });
    }
  });

  it('user.id yoksa socket.id ile keylenmeli', (done) => {
    const socket = createMockSocket(null, 'anon-sock-1');

    socketRateLimit(socket, (err) => {
      expect(err).toBeUndefined();
      done();
    });
  });

  it('farklı kullanıcılar birbirini etkilememeli', (done) => {
    const socket1 = createMockSocket(400, 'rate-indep-1');
    const socket2 = createMockSocket(401, 'rate-indep-2');

    // socket1'in 5 mesajını doldur
    for (let i = 0; i < 5; i++) {
      socketRateLimit(socket1, () => {});
    }

    // socket2 hala geçebilmeli
    socketRateLimit(socket2, (err) => {
      expect(err).toBeUndefined();
      done();
    });
  });

  it('stopCleanup çağrıldıktan sonra rate limit state temizlenmeli', () => {
    const socket = createMockSocket(500, 'cleanup-test-1');

    // Rate limit state oluştur
    socketRateLimit(socket, () => {});

    // Cleanup çağır
    stopCleanup();

    // State temizlenmiş olmalı — yeni mesaj tekrar 1'den başlamalı
    let passed = false;
    socketRateLimit(socket, (err) => {
      if (!err) passed = true;
    });
    expect(passed).toBe(true);
  });
});

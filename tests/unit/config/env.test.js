describe('env.js production güvenlik kontrolleri', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // .env dosyasının test ortamını bozmaması için fs.existsSync mock'la
    jest.mock('fs', () => ({
      existsSync: jest.fn(() => false),
      readFileSync: jest.fn(),
    }));
  });

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
    // Clear require cache so env.js re-evaluates
    jest.resetModules();
  });

  it('production ortamında varsayılan admin şifresi ile hata fırlatmalı', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'real-production-secret-that-is-secure';
    process.env.JWT_REFRESH_SECRET = 'real-production-refresh-secret';
    process.env.DB_PASSWORD = 'secure-db-password';
    process.env.ADMIN_INITIAL_PASSWORD = undefined;
    delete process.env.ADMIN_INITIAL_PASSWORD;

    expect(() => {
      require('../../../server/config/env');
    }).toThrow('ADMIN_INITIAL_PASSWORD');
  });

  it('production ortamında güçlü admin şifresi ile hata fırlatmamalı', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'real-production-secret-that-is-secure';
    process.env.JWT_REFRESH_SECRET = 'real-production-refresh-secret';
    process.env.DB_PASSWORD = 'secure-db-password';
    process.env.ADMIN_INITIAL_PASSWORD = 'MyStrongP@ssw0rd!';

    expect(() => {
      require('../../../server/config/env');
    }).not.toThrow();
  });

  it('production ortamında varsayılan JWT secret ile hata fırlatmalı', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_PASSWORD = 'secure-db-password';
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => {
      require('../../../server/config/env');
    }).toThrow('JWT_SECRET');
  });

  it('production ortamında boş DB_PASSWORD ile hata fırlatmalı', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'real-production-secret-that-is-secure';
    process.env.JWT_REFRESH_SECRET = 'real-production-refresh-secret';
    process.env.ADMIN_INITIAL_PASSWORD = 'MyStrongP@ssw0rd!';
    process.env.DB_PASSWORD = '';

    expect(() => {
      require('../../../server/config/env');
    }).toThrow('DB_PASSWORD');
  });
});

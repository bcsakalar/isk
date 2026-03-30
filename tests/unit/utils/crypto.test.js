const { generateRoomCode, generateToken } = require('../../../server/utils/crypto');

describe('generateRoomCode', () => {
  const VALID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  it('6 karakterlik bir kod üretmeli', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('sadece izin verilen karakterler içermeli', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRoomCode();
      for (const char of code) {
        expect(VALID_CHARS).toContain(char);
      }
    }
  });

  it('karışıklık yaratan karakterleri içermemeli (O, 0, I, 1, L)', () => {
    const forbidden = ['O', '0', 'I', '1'];
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      for (const char of code) {
        expect(forbidden).not.toContain(char);
      }
    }
  });

  it('farklı kodlar üretmeli', () => {
    const codes = new Set();
    for (let i = 0; i < 10; i++) {
      codes.add(generateRoomCode());
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('generateToken', () => {
  it('varsayılan 48 bayt → 96 hex karakter üretmeli', () => {
    const token = generateToken();
    expect(token).toHaveLength(96);
  });

  it('özel uzunlukta token üretmeli', () => {
    const token = generateToken(32);
    expect(token).toHaveLength(64);
  });

  it('hex formatında olmalı', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('her seferinde farklı token üretmeli', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

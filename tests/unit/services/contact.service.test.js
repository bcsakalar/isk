jest.mock('../../../server/db/queries/contact.queries');
jest.mock('../../../server/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const contactQueries = require('../../../server/db/queries/contact.queries');

let contactService;
beforeAll(() => {
  contactService = require('../../../server/services/contact.service');
});

const validInput = {
  name: 'Ali Veli',
  email: 'ali@test.com',
  subject: 'Destek talebi',
  message: 'Bu bir test mesajıdır, yeterince uzun.',
  ipAddress: '127.0.0.1',
};

describe('contactService.submitMessage', () => {
  beforeEach(() => {
    contactQueries.create.mockResolvedValue({ id: 1, ...validInput, is_read: false, created_at: new Date() });
  });

  it('geçerli verilerle mesaj oluşturmalı', async () => {
    const result = await contactService.submitMessage(validInput);
    expect(result.id).toBe(1);
    expect(contactQueries.create).toHaveBeenCalledWith({
      name: 'Ali Veli',
      email: 'ali@test.com',
      subject: 'Destek talebi',
      message: 'Bu bir test mesajıdır, yeterince uzun.',
      ipAddress: '127.0.0.1',
    });
  });

  it('boş isim → hata', async () => {
    await expect(contactService.submitMessage({ ...validInput, name: '' }))
      .rejects.toThrow('İsim 2-100 karakter arasında olmalıdır');
  });

  it('kısa isim → hata', async () => {
    await expect(contactService.submitMessage({ ...validInput, name: 'A' }))
      .rejects.toThrow('İsim 2-100 karakter arasında olmalıdır');
  });

  it('uzun isim → hata', async () => {
    await expect(contactService.submitMessage({ ...validInput, name: 'x'.repeat(101) }))
      .rejects.toThrow('İsim 2-100 karakter arasında olmalıdır');
  });

  it('geçersiz e-posta → hata', async () => {
    await expect(contactService.submitMessage({ ...validInput, email: 'invalid' }))
      .rejects.toThrow('Geçerli bir e-posta adresi giriniz');
  });

  it('boş e-posta → hata', async () => {
    await expect(contactService.submitMessage({ ...validInput, email: '' }))
      .rejects.toThrow('Geçerli bir e-posta adresi giriniz');
  });

  it('kısa konu → hata', async () => {
    await expect(contactService.submitMessage({ ...validInput, subject: 'A' }))
      .rejects.toThrow('Konu 2-200 karakter arasında olmalıdır');
  });

  it('uzun konu → hata', async () => {
    await expect(contactService.submitMessage({ ...validInput, subject: 'x'.repeat(201) }))
      .rejects.toThrow('Konu 2-200 karakter arasında olmalıdır');
  });

  it('kısa mesaj → hata', async () => {
    await expect(contactService.submitMessage({ ...validInput, message: 'Kısa' }))
      .rejects.toThrow('Mesaj 10-2000 karakter arasında olmalıdır');
  });

  it('uzun mesaj → hata', async () => {
    await expect(contactService.submitMessage({ ...validInput, message: 'x'.repeat(2001) }))
      .rejects.toThrow('Mesaj 10-2000 karakter arasında olmalıdır');
  });

  it('e-postayı lowercase yapmalı', async () => {
    await contactService.submitMessage({ ...validInput, email: 'Ali@TEST.com' });
    expect(contactQueries.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ali@test.com' })
    );
  });

  it('name ve subject trim edilmeli', async () => {
    await contactService.submitMessage({ ...validInput, name: '  Ali Veli  ', subject: '  Destek  ' });
    expect(contactQueries.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ali Veli', subject: 'Destek' })
    );
  });
});

describe('contactService.getMessages', () => {
  it('mesaj listesini döndürmeli', async () => {
    const mockMessages = [{ id: 1, name: 'Ali' }, { id: 2, name: 'Veli' }];
    contactQueries.getAll.mockResolvedValue(mockMessages);

    const result = await contactService.getMessages(50, 0);
    expect(result).toEqual(mockMessages);
    expect(contactQueries.getAll).toHaveBeenCalledWith(50, 0);
  });
});

describe('contactService.markAsRead', () => {
  it('mevcut mesajı okundu olarak işaretlemeli', async () => {
    contactQueries.getById.mockResolvedValue({ id: 1, is_read: false });
    contactQueries.markAsRead.mockResolvedValue({ id: 1, is_read: true, read_by: 99 });

    const result = await contactService.markAsRead(1, 99);
    expect(result.is_read).toBe(true);
    expect(contactQueries.markAsRead).toHaveBeenCalledWith(1, 99);
  });

  it('olmayan mesaj → NotFoundError', async () => {
    contactQueries.getById.mockResolvedValue(null);

    await expect(contactService.markAsRead(999, 99))
      .rejects.toThrow('Mesaj bulunamadı');
  });
});

describe('contactService.getUnreadCount', () => {
  it('okunmamış mesaj sayısını döndürmeli', async () => {
    contactQueries.getUnreadCount.mockResolvedValue(5);

    const count = await contactService.getUnreadCount();
    expect(count).toBe(5);
  });
});

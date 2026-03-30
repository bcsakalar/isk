// Input Validation Utilities
const Validators = (() => {

  function username(val) {
    if (!val || val.length < 3) return 'Kullanıcı adı en az 3 karakter olmalı';
    if (val.length > 20) return 'Kullanıcı adı en fazla 20 karakter olmalı';
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return 'Sadece harf, rakam ve _ kullanılabilir';
    return null;
  }

  function nickname(val) {
    if (!val || val.trim().length < 3) return 'Takma ad en az 3 karakter olmalı';
    if (val.trim().length > 15) return 'Takma ad en fazla 15 karakter olmalı';
    return null;
  }

  function password(val) {
    if (!val || val.length < 6) return 'Şifre en az 6 karakter olmalı';
    if (val.length > 128) return 'Şifre en fazla 128 karakter olmalı';
    return null;
  }

  function roomName(val) {
    if (!val || val.length < 2) return 'Oda adı en az 2 karakter olmalı';
    if (val.length > 30) return 'Oda adı en fazla 30 karakter olmalı';
    return null;
  }

  function chatMessage(val) {
    if (!val || val.trim().length === 0) return 'Mesaj boş olamaz';
    if (val.length > 500) return 'Mesaj en fazla 500 karakter olabilir';
    return null;
  }

  function answer(val) {
    if (!val || val.trim().length === 0) return null; // Boş cevap geçerli (0 puan)
    if (val.length > 100) return 'Cevap en fazla 100 karakter olabilir';
    return null;
  }

  return { username, nickname, password, roomName, chatMessage, answer };
})();

// Letter Selector Component — Lobby'de harf seçimi
const LetterSelector = (() => {
  const ALL_LETTERS = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
    'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
    'R', 'S', 'T', 'U', 'V', 'Y', 'Z',
    'Ç', 'İ', 'Ö', 'Ş', 'Ü'
  ];

  let container = null;
  let selected = new Set(ALL_LETTERS);
  let isOwner = false;

  function render(el, opts = {}) {
    container = el;
    isOwner = opts.isOwner || false;
    if (opts.enabledLetters) {
      selected = new Set(opts.enabledLetters.split(',').map(l => l.trim().toLocaleUpperCase('tr-TR')).filter(l => ALL_LETTERS.includes(l)));
      if (selected.size === 0) selected = new Set(ALL_LETTERS);
    } else {
      selected = new Set(ALL_LETTERS);
    }
    update();
    return { update: updateLetters, destroy };
  }

  function updateLetters(enabledLetters, owner) {
    if (enabledLetters !== undefined && enabledLetters !== null) {
      const arr = Array.isArray(enabledLetters)
        ? enabledLetters
        : enabledLetters.split(',');
      selected = new Set(arr.map(l => l.trim().toLocaleUpperCase('tr-TR')).filter(l => ALL_LETTERS.includes(l)));
      if (selected.size === 0) selected = new Set(ALL_LETTERS);
    }
    if (owner !== undefined) isOwner = owner;
    update();
  }

  function update() {
    if (!container) return;

    const allSelected = selected.size === ALL_LETTERS.length;

    const buttons = ALL_LETTERS.map(l => {
      const isActive = selected.has(l);
      return `<button class="w-7 h-7 sm:w-9 sm:h-9 rounded-full font-vt323 text-xs sm:text-sm transition-all letter-toggle
                      ${isActive ? 'bg-retro-accent/20 text-retro-accent border border-retro-accent' : 'bg-retro-surface/30 text-retro-text/30 border border-retro-text/10'}
                      ${isOwner ? 'hover:border-retro-accent cursor-pointer' : 'cursor-default'}"
                      data-letter="${l}">${l}</button>`;
    }).join('');

    container.innerHTML = `
      <h4 class="font-pixel text-xs text-retro-gold mb-2">HARFLER</h4>
      <div class="flex flex-wrap gap-1.5 mb-2" id="letter-grid">
        ${buttons}
      </div>
      ${isOwner ? `
        <div class="flex gap-2">
          <button class="btn-retro-outline text-xs px-3 py-1" id="letter-toggle-all">${allSelected ? 'HEPSİNİ KALDIR' : 'TÜMÜNÜ SEÇ'}</button>
          <span class="font-vt323 text-xs text-retro-text/40 self-center">${selected.size}/${ALL_LETTERS.length} harf</span>
        </div>
      ` : `<span class="font-vt323 text-xs text-retro-text/40">${selected.size}/${ALL_LETTERS.length} harf aktif</span>`}
    `;

    if (isOwner) {
      container.querySelectorAll('.letter-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const letter = btn.dataset.letter;
          if (selected.has(letter)) {
            if (selected.size <= 5) {
              if (typeof Toast !== 'undefined') Toast.error('En az 5 harf seçili olmalı');
              return;
            }
            selected.delete(letter);
          } else {
            selected.add(letter);
          }
          emitUpdate();
          update();
        });
      });

      const toggleAllBtn = document.getElementById('letter-toggle-all');
      if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', () => {
          if (selected.size === ALL_LETTERS.length) {
            // 5 harf bırak (ilk 5)
            selected = new Set(ALL_LETTERS.slice(0, 5));
          } else {
            selected = new Set(ALL_LETTERS);
          }
          emitUpdate();
          update();
        });
      }
    }
  }

  function emitUpdate() {
    const letters = Array.from(selected);
    SocketClient.send('room:update_letters', { letters });
  }

  function destroy() {
    if (container) container.innerHTML = '';
    container = null;
  }

  return { render, updateLetters, destroy };
})();

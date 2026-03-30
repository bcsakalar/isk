// Category Editor Component — Lobby'de kategori yönetimi
const CategoryEditor = (() => {
  let container = null;
  let categories = [];
  let isOwner = false;
  let roomId = null;
  let showSuggestions = false;
  let filterText = '';

  // Sabit kategori listesi — DB'den çekilmez, her zaman aynıdır
  const STATIC_CATEGORIES = [
    // Varsayılan
    { name: 'İsim', slug: 'isim' },
    { name: 'Şehir', slug: 'sehir' },
    { name: 'Hayvan', slug: 'hayvan' },
    { name: 'Bitki', slug: 'bitki' },
    { name: 'Ülke', slug: 'ulke' },
    // Coğrafya
    { name: 'Nehir', slug: 'nehir' },
    { name: 'Dağ', slug: 'dag' },
    { name: 'Başkent', slug: 'baskent' },
    { name: 'Ada', slug: 'ada' },
    { name: 'Göl', slug: 'gol' },
    // Yeme-İçme
    { name: 'Meyve', slug: 'meyve' },
    { name: 'Sebze', slug: 'sebze' },
    { name: 'Yiyecek', slug: 'yiyecek' },
    { name: 'İçecek', slug: 'icecek' },
    { name: 'Baharat', slug: 'baharat' },
    { name: 'Tatlı', slug: 'tatli' },
    // Eğlence & Kültür
    { name: 'Film', slug: 'film' },
    { name: 'Dizi', slug: 'dizi' },
    { name: 'Şarkı', slug: 'sarki' },
    { name: 'Kitap', slug: 'kitap' },
    { name: 'Çizgi Film', slug: 'cizgi_film' },
    { name: 'Oyun', slug: 'oyun' },
    // İnsanlar
    { name: 'Meslek', slug: 'meslek' },
    { name: 'Ünlü', slug: 'unlu' },
    { name: 'Tarihi Kişi', slug: 'tarihi_kisi' },
    { name: 'Süper Kahraman', slug: 'super_kahraman' },
    { name: 'Mitoloji', slug: 'mitoloji' },
    // Spor
    { name: 'Spor', slug: 'spor' },
    { name: 'Takım', slug: 'takim' },
    // Günlük Hayat
    { name: 'Eşya', slug: 'esya' },
    { name: 'Giysi', slug: 'giysi' },
    { name: 'Renk', slug: 'renk' },
    { name: 'Müzik Aleti', slug: 'muzik_aleti' },
    // Markalar & Teknoloji
    { name: 'Marka', slug: 'marka' },
    { name: 'Araba Markası', slug: 'araba' },
    { name: 'Teknoloji', slug: 'teknoloji' },
    // Yaratıcı & Eğlenceli
    { name: 'İngilizce Kelime', slug: 'ingilizce_kelime' },
    { name: 'Yatakta Söylenmeyecek Söz', slug: 'yatakta_soylenmeyecek' },
    { name: 'Savaşta Son Söz', slug: 'savasta_son_soz' },
    { name: 'Bir Filmin Konusu Olabilecek Cümle', slug: 'film_konusu' },
    { name: 'Dünyada Olmayan Şehir', slug: 'hayali_sehir' },
    { name: 'Annene Açıklayamayacağın Meslek', slug: 'aciklanamayanmeslek' },
    { name: 'İlk Buluşmada Sorulmayacak Soru', slug: 'ilk_bulusma' },
    { name: 'Atasözü / Deyim', slug: 'atasozu' },
    { name: 'Tarihi Olay', slug: 'tarihi_olay' },
    { name: 'Bir Şarkıdan Dize', slug: 'sarki_dize' },
  ];

  function render(el, opts = {}) {
    container = el;
    categories = opts.categories || [];
    isOwner = opts.isOwner || false;
    roomId = opts.roomId || null;
    update();
    return { update: updateCategories, destroy };
  }

  function updateCategories(cats, owner) {
    if (cats) categories = cats;
    if (owner !== undefined) isOwner = owner;
    update();
  }

  function getAvailableCategories() {
    const assignedSlugs = new Set(categories.map(c => (c.slug || c.name.toLowerCase().replace(/\s+/g, '-'))));
    let available = STATIC_CATEGORIES.filter(c => !assignedSlugs.has(c.slug));
    if (filterText) {
      const q = filterText.toLowerCase();
      available = available.filter(c => c.name.toLowerCase().includes(q));
    }
    return available;
  }

  function update() {
    if (!container) return;

    const chips = categories.map((cat, i) => `
      <div class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-retro-accent/30 bg-retro-surface/50 font-vt323 text-sm text-retro-text"
           draggable="${isOwner}" data-cat-id="${cat.id}" data-cat-idx="${i}">
        <span>${escapeHtml(cat.name)}</span>
        ${isOwner ? `<button class="text-retro-accent/50 hover:text-retro-accent ml-1 cat-remove" data-cat-id="${cat.id}" title="Kaldır">✕</button>` : ''}
      </div>
    `).join('');

    const available = getAvailableCategories();
    const suggestionsHtml = isOwner && showSuggestions ? `
      <div class="mt-2 p-2 border border-retro-accent/20 rounded bg-retro-surface/80" id="cat-suggestions">
        <input type="text" id="cat-filter-input" class="input-retro text-xs py-1 mb-2 w-full" placeholder="Kategorilerde ara..." value="${escapeAttr(filterText)}" />
        <div class="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          ${available.length > 0 ? available.map(c => `
            <button class="cat-suggest-btn px-2 py-1 rounded-full border border-retro-green/30 bg-retro-green/10 font-vt323 text-xs text-retro-green hover:bg-retro-green/25 transition-colors" data-cat-name="${escapeAttr(c.name)}">
              + ${escapeHtml(c.name)}
            </button>
          `).join('') : '<p class="font-vt323 text-xs text-retro-text/30">Eşleşen kategori yok</p>'}
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <h4 class="font-pixel text-xs text-retro-gold mb-2">KATEGORİLER</h4>
      <div class="flex flex-wrap gap-2 mb-3" id="cat-chips">
        ${chips}
      </div>
      ${isOwner ? `
        <div class="flex gap-2 mb-2">
          <input type="text" id="cat-new-input" class="input-retro text-sm py-1 flex-1" placeholder="Özel kategori yaz ve ekle..." maxlength="50" />
          <button class="btn-retro text-xs px-3" id="cat-add-btn">+ EKLE</button>
        </div>
        <button class="font-vt323 text-xs mt-1 px-2 py-0.5 rounded ${showSuggestions ? 'text-retro-accent' : 'text-retro-text/40 hover:text-retro-text/70'} transition-colors" id="cat-toggle-suggestions">
          ${showSuggestions ? '▲ Listeyi Gizle' : '▼ Eklenebilir Kategoriler (' + available.length + ')'}
        </button>
        ${suggestionsHtml}
      ` : ''}
    `;

    if (isOwner) {
      // Remove buttons
      container.querySelectorAll('.cat-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const catId = parseInt(btn.dataset.catId);
          if (categories.length <= 1) {
            if (typeof Toast !== 'undefined') Toast.error('En az 1 kategori olmalı');
            return;
          }
          SocketClient.send('room:remove_category', { categoryId: catId });
        });
      });

      // Toggle suggestions
      const toggleBtn = document.getElementById('cat-toggle-suggestions');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          showSuggestions = !showSuggestions;
          update();
        });
      }

      // Suggestion chips
      container.querySelectorAll('.cat-suggest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.dataset.catName;
          if (name) {
            SocketClient.send('room:add_category', { name });
          }
        });
      });

      // Suggestion filter input
      const filterInput = document.getElementById('cat-filter-input');
      if (filterInput) {
        filterInput.addEventListener('input', () => {
          filterText = filterInput.value.trim();
          update();
          const newFilter = document.getElementById('cat-filter-input');
          if (newFilter) {
            newFilter.focus();
            newFilter.setSelectionRange(newFilter.value.length, newFilter.value.length);
          }
        });
      }

      // Add button + input (sadece özel kategori ekleme)
      const addBtn = document.getElementById('cat-add-btn');
      const addInput = document.getElementById('cat-new-input');
      if (addBtn && addInput) {
        const doAdd = () => {
          const name = addInput.value.trim();
          if (!name || name.length < 2) return;
          SocketClient.send('room:add_category', { name });
          addInput.value = '';
        };
        addBtn.addEventListener('click', doAdd);
        addInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
        });
      }
    }
  }

  function destroy() {
    if (container) container.innerHTML = '';
    container = null;
    categories = [];
    showSuggestions = false;
    filterText = '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render, updateCategories, destroy };
})();

// Modal Component
const Modal = (() => {
  function show({ title, content, buttons = [], onClose }) {
    const container = document.getElementById('modal-container');
    if (!container) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };

    const btnHtml = buttons.map(b =>
      `<button class="${b.class || 'btn-retro'}" data-action="${b.action}">${escapeHtml(b.label)}</button>`
    ).join('');

    overlay.innerHTML = `
      <div class="modal-content">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-pixel text-retro-accent text-sm">${escapeHtml(title)}</h3>
          <button class="text-retro-text/50 hover:text-retro-accent text-2xl font-vt323" data-action="close">&times;</button>
        </div>
        <div class="mb-6 font-vt323 text-lg">${content}</div>
        <div class="flex gap-3 justify-end">${btnHtml}</div>
      </div>
    `;

    // Button handlers
    overlay.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'close') {
          close();
          if (onClose) onClose();
        } else {
          const buttonConfig = buttons.find(b => b.action === action);
          if (buttonConfig && buttonConfig.onClick) {
            buttonConfig.onClick();
          }
          close();
        }
      });
    });

    container.appendChild(overlay);

    function close() {
      overlay.remove();
    }

    return { close };
  }

  function confirm({ title, message, onConfirm }) {
    return show({
      title,
      content: `<p>${escapeHtml(message)}</p>`,
      buttons: [
        { label: 'İptal', action: 'close', class: 'btn-retro-outline' },
        { label: 'Onayla', action: 'confirm', class: 'btn-retro', onClick: onConfirm },
      ],
    });
  }

  function lightbox(imageSrc) {
    const container = document.getElementById('modal-container');
    if (!container) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '50';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
    overlay.style.backdropFilter = 'blur(2px)';

    const popup = document.createElement('div');
    popup.style.cssText = 'position:relative;background:#16213e;border:2px solid rgba(233,69,96,0.4);border-radius:0.75rem;padding:1rem;max-width:90vw;max-height:85vh;width:auto;display:flex;flex-direction:column;align-items:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'position:absolute;top:-0.75rem;right:-0.75rem;width:2.25rem;height:2.25rem;border-radius:50%;border:2px solid rgba(233,69,96,0.5);background:#16213e;display:flex;align-items:center;justify-content:center;color:rgba(224,224,224,0.7);font-family:VT323,monospace;font-size:1.5rem;cursor:pointer;z-index:51;transition:all 0.2s;';
    closeBtn.onmouseenter = () => { closeBtn.style.color = '#e94560'; closeBtn.style.borderColor = '#e94560'; };
    closeBtn.onmouseleave = () => { closeBtn.style.color = 'rgba(224,224,224,0.7)'; closeBtn.style.borderColor = 'rgba(233,69,96,0.5)'; };

    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.cssText = 'max-width:85vw;max-height:78vh;border-radius:0.5rem;object-fit:contain;';

    popup.appendChild(closeBtn);
    popup.appendChild(img);
    overlay.appendChild(popup);

    function remove() { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) remove(); });
    closeBtn.addEventListener('click', remove);
    const escHandler = (e) => { if (e.key === 'Escape') remove(); };
    document.addEventListener('keydown', escHandler);

    container.appendChild(overlay);
    return { close: remove };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { show, confirm, lightbox };
})();

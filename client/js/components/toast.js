// Toast Notification Component
const Toast = (() => {
  function show(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Aynı mesajlı toast varsa tekrarlama
    const existing = container.querySelectorAll('.toast');
    for (const t of existing) {
      if (t.textContent === message) return;
    }

    // Maksimum 4 toast göster, eskisini kaldır
    if (existing.length >= 4) {
      existing[0].remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error', 5000),
    info: (msg) => show(msg, 'info'),
    warn: (msg) => show(msg, 'warn', 5000),
  };
})();

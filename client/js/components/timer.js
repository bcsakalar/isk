// Timer Component — Tur zamanlayıcı UI
const TimerComponent = (() => {
  let container = null;
  let unsub = null;

  function render(parentEl) {
    container = document.createElement('div');
    container.className = 'mb-4';
    container.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="font-pixel text-xs text-retro-accent">SÜRE</span>
        <span id="timer-text" class="font-pixel text-lg text-retro-gold">--</span>
      </div>
      <div class="timer-bar">
        <div id="timer-fill" class="timer-bar-fill" style="width: 100%"></div>
      </div>
    `;
    parentEl.appendChild(container);

    const timerText = container.querySelector('#timer-text');
    const timerFill = container.querySelector('#timer-fill');

    unsub = SocketClient.on('game:timer', ({ remaining, total }) => {
      timerText.textContent = remaining;
      const pct = (remaining / total) * 100;
      timerFill.style.width = `${pct}%`;

      timerFill.classList.remove('warning', 'danger');
      if (remaining <= 5) {
        timerFill.classList.add('danger');
        timerText.classList.add('animate-shake');
      } else if (remaining <= 15) {
        timerFill.classList.add('warning');
        timerText.classList.remove('animate-shake');
      } else {
        timerText.classList.remove('animate-shake');
      }
    });

    return container;
  }

  function reset() {
    if (!container) return;
    const timerText = container.querySelector('#timer-text');
    const timerFill = container.querySelector('#timer-fill');
    if (timerText) timerText.textContent = '--';
    if (timerFill) {
      timerFill.style.width = '100%';
      timerFill.classList.remove('warning', 'danger');
    }
  }

  function destroy() {
    if (unsub) unsub();
    unsub = null;
    if (container) container.remove();
    container = null;
  }

  return { render, reset, destroy };
})();

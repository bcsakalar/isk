// Chat Component — Lobi ve Oda chat UI
const ChatComponent = (() => {
  let container = null;
  let unsubscribers = [];
  let _currentRoomId = null;

  function render(parentEl, { roomId = null } = {}) {
    // Önceki state temizle (render() destroy() olmadan çağrılırsa)
    destroy();
    _currentRoomId = roomId;

    container = document.createElement('div');
    container.className = 'card-retro flex flex-col h-[16rem] sm:h-[20rem] lg:h-[28rem]';
    container.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-pixel text-xs text-retro-accent">${roomId ? 'Oda Sohbet' : 'Lobi Sohbet'}</h4>
        <span class="text-xs text-retro-text/40 font-mono" id="chat-status">bağlı</span>
      </div>
      <div id="chat-messages" class="flex-1 overflow-y-auto space-y-1 mb-2 pr-1"></div>
      <div class="flex gap-2">
        <input 
          type="text" 
          id="chat-input" 
          class="input-retro text-sm py-2" 
          placeholder="Mesaj yaz..." 
          maxlength="500"
          autocomplete="off"
        />
        <button id="chat-send" class="btn-retro text-xs px-4">Gönder</button>
      </div>
      <div class="flex gap-1 mt-1" id="chat-reactions">
        ${['👍','👏','😂','😮','😡','🔥','💯','⭐'].map(e => 
          `<button class="text-lg hover:scale-125 transition-transform" data-emoji="${e}">${e}</button>`
        ).join('')}
      </div>
    `;

    parentEl.appendChild(container);

    const msgContainer = container.querySelector('#chat-messages');
    const input = container.querySelector('#chat-input');
    const sendBtn = container.querySelector('#chat-send');
    const reactions = container.querySelector('#chat-reactions');

    // Mesaj gönder
    function sendMessage() {
      const msg = input.value.trim();
      const err = Validators.chatMessage(msg);
      if (err) { Toast.warn(err); return; }

      SocketClient.send(roomId ? 'chat:room' : 'chat:lobby', { message: msg });
      input.value = '';
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Emoji tepki
    reactions.addEventListener('click', (e) => {
      const emoji = e.target.dataset?.emoji;
      if (emoji) SocketClient.send('chat:reaction', { emoji });
    });

    // Gelen mesajlar
    const messageEvent = roomId ? 'chat:room_message' : 'chat:lobby_message';
    const unsub1 = SocketClient.on(messageEvent, (data) => {
      appendMessage(msgContainer, data);
    });
    unsubscribers.push(unsub1);

    // Tepkiler
    const unsub2 = SocketClient.on('chat:reaction', (data) => {
      appendReaction(msgContainer, data);
    });
    unsubscribers.push(unsub2);

    // Geçmiş yükle
    const unsub3 = SocketClient.on('chat:history', (data) => {
      if (data.roomId === roomId) {
        msgContainer.innerHTML = '';
        (data.messages || []).forEach(m => appendMessage(msgContainer, m));
      }
    });
    unsubscribers.push(unsub3);

    // Oda chati ise geçmişi hemen yükleme — room:joined sonrası loadHistory() çağrılacak
    if (!roomId) {
      SocketClient.send('chat:history', { roomId, limit: 50 });
    }

    return container;
  }

  function loadHistory() {
    // room:joined sonrası çağrılır — socket.currentRoom artık set edilmiştir
    SocketClient.send('chat:history', { roomId: _currentRoomId, limit: 50 });
  }

  function appendMessage(container, msg) {
    const div = document.createElement('div');
    div.className = 'text-sm';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-retro-gold font-mono';
    nameSpan.textContent = (msg.displayName || msg.display_name || 'Anonim') + ': ';
    const msgSpan = document.createElement('span');
    msgSpan.className = 'text-retro-text/80';
    msgSpan.textContent = msg.message;
    div.appendChild(nameSpan);
    div.appendChild(msgSpan);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function appendReaction(container, data) {
    const div = document.createElement('div');
    div.className = 'text-center text-lg animate-score-pop';
    div.textContent = `${data.displayName} ${data.emoji}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    setTimeout(() => div.remove(), 2000);
  }

  function destroy() {
    unsubscribers.forEach(u => u());
    unsubscribers = [];
    if (container) container.remove();
    container = null;
  }

  return { render, destroy, loadHistory };
})();

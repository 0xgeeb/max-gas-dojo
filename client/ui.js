// Lobby UI Controller
class LobbyUI {
  constructor(socket, playerId) {
    this.socket = socket;
    this.playerId = playerId;
    this.sidebar = document.getElementById('playerListSidebar');
    this.playerListContent = document.getElementById('playerListContent');
    this.playerCount = document.getElementById('playerCount');
    this.challengeModal = document.getElementById('challengeModal');
    this.challengeList = document.getElementById('challengeList');
    this.challengeToast = document.getElementById('challengeToast');
    this.toastMessage = document.getElementById('toastMessage');

    this.incomingChallenges = [];

    // Expose methods to global scope for button onclick handlers
    window.acceptChallenge = (challengeId) => this.acceptChallenge(challengeId);
    window.declineChallenge = (challengeId) => this.declineChallenge(challengeId);
  }

  updatePlayerList(players) {
    this.playerListContent.innerHTML = '';
    this.playerCount.textContent = `${players.length}/10`;

    players.forEach(player => {
      const card = this.createPlayerCard(player);
      this.playerListContent.appendChild(card);
    });
  }

  createPlayerCard(player) {
    const div = document.createElement('div');
    div.className = 'player-card' + (player.id === this.playerId ? ' me' : '');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';

    // Display wallet address if available, otherwise socket ID
    if (player.walletAddress) {
      nameSpan.textContent = `${player.walletAddress.slice(0, 6)}...${player.walletAddress.slice(-4)}`;
      nameSpan.title = player.walletAddress;
    } else {
      nameSpan.textContent = `Player ${player.id.slice(0, 6)}`;
      nameSpan.title = player.id;
    }

    div.appendChild(nameSpan);

    // Add challenge button for other players
    if (player.id !== this.playerId) {
      const btn = document.createElement('button');
      btn.className = 'challenge-btn';
      btn.textContent = 'Challenge';
      btn.onclick = () => {
        console.log('Challenge button clicked for player:', player.id);
        this.openWagerDialog(player.id);
      };
      div.appendChild(btn);
    } else {
      const meLabel = document.createElement('span');
      meLabel.textContent = '(You)';
      meLabel.style.fontSize = '10px';
      meLabel.style.color = '#4A90E2';
      div.appendChild(meLabel);
    }

    return div;
  }

  openWagerDialog(playerId) {
    console.log('openWagerDialog called for player:', playerId);
    console.log('Socket connected:', this.socket.connected);

    const wager = prompt('Enter wager amount (tokens):', '1');
    console.log('Wager entered:', wager);

    if (wager !== null && wager !== '') {
      const amount = parseFloat(wager);
      if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid wager amount');
        return;
      }

      console.log('Emitting sendChallenge event:', { challenged: playerId, wagerAmount: amount });
      this.socket.emit('sendChallenge', {
        challenged: playerId,
        wagerAmount: amount
      });

      this.showToast(`Challenge sent! Waiting for response...`, 2000);
    }
  }

  addIncomingChallenge(challenge) {
    this.incomingChallenges.push(challenge);
    this.updateChallengeModal();
  }

  removeChallenge(challengeId) {
    this.incomingChallenges = this.incomingChallenges.filter(c => c.challengeId !== challengeId);
    this.updateChallengeModal();
  }

  updateChallengeModal() {
    this.challengeList.innerHTML = '';

    if (this.incomingChallenges.length === 0) {
      this.challengeModal.classList.add('hidden');
      return;
    }

    this.incomingChallenges.forEach(challenge => {
      const item = this.createChallengeItem(challenge);
      this.challengeList.appendChild(item);
    });

    this.challengeModal.classList.remove('hidden');
  }

  createChallengeItem(challenge) {
    const div = document.createElement('div');
    div.className = 'challenge-item';

    const challenger = challenge.challengerWallet
      ? `${challenge.challengerWallet.slice(0, 6)}...${challenge.challengerWallet.slice(-4)}`
      : `Player ${challenge.challenger.slice(0, 6)}`;

    div.innerHTML = `
      <p><strong>Challenge from ${challenger}</strong></p>
      <p>Wager: ${challenge.wagerAmount} tokens</p>
      <div class="challenge-actions">
        <button class="accept-btn" onclick="window.acceptChallenge('${challenge.challengeId}')">
          Accept
        </button>
        <button class="decline-btn" onclick="window.declineChallenge('${challenge.challengeId}')">
          Decline
        </button>
      </div>
    `;

    return div;
  }

  acceptChallenge(challengeId) {
    this.socket.emit('acceptChallenge', { challengeId });
    this.removeChallenge(challengeId);
    this.showToast('Challenge accepted! Preparing fight...', 2000);
  }

  declineChallenge(challengeId) {
    this.socket.emit('declineChallenge', { challengeId });
    this.removeChallenge(challengeId);
    this.showToast('Challenge declined', 2000);
  }

  showToast(message, duration = 3000) {
    this.toastMessage.textContent = message;
    this.challengeToast.classList.remove('hidden');

    setTimeout(() => {
      this.challengeToast.classList.add('hidden');
    }, duration);
  }

  show() {
    this.sidebar.classList.remove('hidden');
  }

  hide() {
    this.sidebar.classList.add('hidden');
    this.challengeModal.classList.add('hidden');
    this.incomingChallenges = [];
  }
}

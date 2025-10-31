// ========================================
// HITBOX CONFIGURATION
// Adjust these values to customize hitboxes for each sprite
// Must match server/server.js HITBOX_CONFIG
// ========================================
const HITBOX_CONFIG = {
    player1: {
        // Player body hitbox
        width: 40,
        height: 105,
        yOffset: 400,  // Ground position (feet)

        // Attack hitbox
        attack: {
            range: 70,      // How far attack reaches
            height: 75,     // Attack hitbox height
            yOffset: 125    // Distance above ground for attack
        }
    },
    player2: {
        // Player body hitbox
        width: 40,
        height: 105,
        yOffset: 400,  // Ground position (feet)

        // Attack hitbox
        attack: {
            range: 70,      // How far attack reaches
            height: 55,     // Attack hitbox height
            yOffset: 105    // Distance above ground for attack
        }
    }
};
// ========================================

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.socket = io();

        this.spriteManager = new SpriteManager();
        this.inputManager = null;

        this.gameState = null;
        this.playerId = null;
        this.gameId = null;

        this.lastTime = 0;
        this.isGameRunning = false;
        this.isWaitingRoom = true;

        // Store animated sprites separately
        this.playerSprites = new Map();

        // Web3 integration
        this.web3Manager = new Web3Manager();
        this.isStaked = false;
        this.currentMatchId = null;

        this.setupWeb3UI();
        this.setupSocketEvents();
        this.loadAssets();
    }

    setupWeb3UI() {
        // Get UI elements
        const connectWalletBtn = document.getElementById('connectWalletBtn');
        const stakeBtn = document.getElementById('stakeBtn');
        const approveBtn = document.getElementById('approveBtn');
        const walletInfo = document.getElementById('walletInfo');
        const stakingSection = document.getElementById('stakingSection');
        const walletAddress = document.getElementById('walletAddress');
        const tokenBalance = document.getElementById('tokenBalance');
        const txStatus = document.getElementById('txStatus');
        const networkName = document.getElementById('networkName');
        const contractStatus = document.getElementById('contractStatus');

        // Connect wallet button
        connectWalletBtn.addEventListener('click', async () => {
            try {
                connectWalletBtn.textContent = 'Connecting...';
                connectWalletBtn.disabled = true;

                await this.web3Manager.connectWallet();

                // Update UI
                walletAddress.textContent = this.web3Manager.formatAddress(this.web3Manager.account);
                walletInfo.classList.remove('hidden');
                stakingSection.classList.remove('hidden');
                connectWalletBtn.textContent = 'Connected';
                connectWalletBtn.classList.add('success');

                // Update token balance
                const balance = await this.web3Manager.getTokenBalance();
                tokenBalance.textContent = balance;

                // Enable stake button
                stakeBtn.disabled = false;

                // Update network info
                const chainId = await this.web3Manager.getChainId();
                networkName.textContent = this.getNetworkName(chainId);

            } catch (error) {
                console.error('Error connecting wallet:', error);
                connectWalletBtn.textContent = 'Connect Wallet';
                connectWalletBtn.disabled = false;
                this.showTxStatus('Error: ' + error.message, 'error');
            }
        });

        // Stake button
        stakeBtn.addEventListener('click', async () => {
            try {
                const stakeAmount = parseFloat(document.getElementById('stakeAmount').value);

                if (!stakeAmount || stakeAmount <= 0) {
                    this.showTxStatus('Please enter a valid stake amount', 'error');
                    return;
                }

                // Check if user has enough tokens
                const hasEnough = await this.web3Manager.hasEnoughTokens(stakeAmount);
                if (!hasEnough) {
                    this.showTxStatus('Insufficient token balance', 'error');
                    return;
                }

                stakeBtn.disabled = true;
                stakeBtn.textContent = 'Processing...';

                // Generate match ID (will be provided by server in production)
                this.currentMatchId = '0x' + Date.now().toString(16).padStart(64, '0');

                this.showTxStatus('Approving and staking tokens...', 'pending');

                // Stake tokens
                const txHash = await this.web3Manager.stakeForMatch(this.currentMatchId, stakeAmount);

                this.showTxStatus('Stake successful! Joining match...', 'success');
                this.isStaked = true;

                // Now join the game
                this.joinGame();

                stakeBtn.textContent = 'Staked';
                stakeBtn.classList.add('success');

            } catch (error) {
                console.error('Error staking:', error);
                stakeBtn.disabled = false;
                stakeBtn.textContent = 'Stake & Join Match';
                this.showTxStatus('Error: ' + error.message, 'error');
            }
        });

        // Setup web3 event listeners
        this.web3Manager.onConnectionChange = (isConnected, account) => {
            if (!isConnected) {
                walletInfo.classList.add('hidden');
                stakingSection.classList.add('hidden');
                connectWalletBtn.textContent = 'Connect Wallet';
                connectWalletBtn.classList.remove('success');
                connectWalletBtn.disabled = false;
            }
        };

        this.web3Manager.onBalanceChange = (balance) => {
            tokenBalance.textContent = balance;
        };
    }

    showTxStatus(message, type) {
        const txStatus = document.getElementById('txStatus');
        txStatus.textContent = message;
        txStatus.className = 'web3-status status-' + type;
        txStatus.classList.remove('hidden');

        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                txStatus.classList.add('hidden');
            }, 5000);
        }
    }

    getNetworkName(chainId) {
        const networks = {
            1: 'Ethereum Mainnet',
            5: 'Goerli Testnet',
            11155111: 'Sepolia Testnet',
            8453: 'Base Mainnet',
            84531: 'Base Goerli',
            84532: 'Base Sepolia'
        };
        return networks[chainId] || `Chain ID: ${chainId}`;
    }

    loadAssets() {
        this.spriteManager.onLoadComplete = () => {
            console.log('All sprites loaded!');
            // Don't auto-join anymore - user must stake first
            // this.joinGame();
        };
        this.spriteManager.loadAllSprites();
    }

    setupSocketEvents() {
        // Create input manager immediately after socket connection
        this.inputManager = new InputManager(this.socket);
        
        this.socket.on('gameJoined', (data) => {
            console.log('Joined game:', data);
            this.gameId = data.gameId;
            this.playerId = data.playerId;
            this.gameState = data.gameState;
        });

        this.socket.on('gameState', (state) => {
            this.gameState = state;
            // Check if we should transition from waiting room to fighting
            if (this.isWaitingRoom && state.players && state.players.length >= 2) {
                this.isWaitingRoom = false;
                this.isGameRunning = true;
            }
            // Check if we should transition back to waiting room
            if (!this.isWaitingRoom && state.players && state.players.length < 2) {
                this.isWaitingRoom = true;
                this.isGameRunning = false;
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isGameRunning = false;
        });
    }

    joinGame() {
        const joinData = {
            walletAddress: this.web3Manager.account,
            matchId: this.currentMatchId,
            stakeAmount: parseFloat(document.getElementById('stakeAmount').value),
            isStaked: this.isStaked
        };
        this.socket.emit('joinGame', joinData);
    }



    update(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Update all animated sprites
        for (let [playerId, animatedSprite] of this.playerSprites) {
            animatedSprite.update(currentTime);
        }

        this.render();
        requestAnimationFrame((time) => this.update(time));
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.isWaitingRoom) {
            this.drawWaitingRoom();
        } else {
            this.drawFightingScene();
        }
    }

    drawWaitingRoom() {
        // Waiting room background - darker/more atmospheric
        this.ctx.fillStyle = '#4A90E2';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);
        
        this.ctx.fillStyle = '#7B9E89';
        this.ctx.fillRect(0, this.canvas.height / 2, this.canvas.width, this.canvas.height / 2);
        
        // Draw waiting room text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('WAITING ROOM', this.canvas.width / 2, 150);
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Waiting for another player to join...', this.canvas.width / 2, 200);
        
        // Draw player count
        const playerCount = this.gameState ? this.gameState.players.length : 0;
        this.ctx.fillText(`Players: ${playerCount}/2`, this.canvas.width / 2, 250);
        
        // Draw players (if any)
        if (this.gameState) {
            this.gameState.players.forEach(player => {
                this.drawPlayer(player);
            });
        }
    }

    drawFightingScene() {
        // Fighting scene background - same as waiting room
        this.ctx.fillStyle = '#4A90E2';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);

        this.ctx.fillStyle = '#7B9E89';
        this.ctx.fillRect(0, this.canvas.height / 2, this.canvas.width, this.canvas.height / 2);

        // Draw players
        if (this.gameState) {
            this.gameState.players.forEach(player => {
                this.drawPlayer(player);
            });

            // Check for game over
            const deadPlayers = this.gameState.players.filter(p => p.health <= 0);
            if (deadPlayers.length > 0) {
                this.drawGameOver(deadPlayers[0]);
            }
        }
    }

    drawGameOver(deadPlayer) {
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Determine if player won or lost
        const playerWon = deadPlayer.id !== this.playerId;
        const message = playerWon ? 'YOU WIN!' : 'YOU LOSE!';

        // Draw message in same style as waiting room
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }

    drawBackground() {
        // Simple background - sky and ground
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);
        
        this.ctx.fillStyle = '#98FB98';
        this.ctx.fillRect(0, this.canvas.height / 2, this.canvas.width, this.canvas.height / 2);
    }

    drawPlayer(player) {
        // Determine player ID based on sprite or player ID
        let playerId;
        if (player.sprite === 'player1' || player.sprite === 'player2') {
            playerId = player.sprite;
        } else {
            // Fallback: use player ID to determine sprite
            playerId = player.id === this.playerId ? 'player1' : 'player2';
        }

        // Get or create animated sprite using player ID as key
        if (!this.playerSprites.has(player.id)) {
            console.log(`CREATING SPRITE FOR PLAYER: ${playerId} (ID: ${player.id})`);
            this.playerSprites.set(player.id, new AnimatedSprite(this.spriteManager, player.state, playerId));
        }

        const animatedSprite = this.playerSprites.get(player.id);
        animatedSprite.setState(player.state);

        // Draw player
        const width = 160;
        const height = 160;
        const x = player.x - width / 2;
        const y = player.y - height;

        animatedSprite.draw(this.ctx, x, y, width, height, player.facing);

        // Draw health bar - offset based on whether it's your player or opponent
        // Your player's health bar goes higher, opponent's goes lower
        const isMyPlayer = player.id === this.playerId;
        const healthBarOffset = isMyPlayer ? -30 : -50;
        this.drawHealthBar(player, x, y + healthBarOffset);

        // Draw debug hitboxes
        this.drawHitboxes(player, isMyPlayer);
    }

    drawHealthBar(player, x, y) {
        const barWidth = 80;
        const barHeight = 8;
        const healthPercent = player.health / 100;

        // Center the health bar over the player
        const playerWidth = 160;
        const barX = x + (playerWidth - barWidth) / 2;

        // Background
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, y, barWidth, barHeight);

        // Health fill
        this.ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        this.ctx.fillRect(barX, y, barWidth * healthPercent, barHeight);

        // Border
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, y, barWidth, barHeight);
    }

    drawHitboxes(player, isMyPlayer) {
        // Get sprite-specific hitbox config
        const config = HITBOX_CONFIG[player.sprite];

        // Player body hitbox
        const playerHitboxX = player.x - config.width / 2;
        const playerHitboxY = player.y - config.height;
        const playerHitboxWidth = config.width;
        const playerHitboxHeight = config.height / 2;

        // Draw player hitbox - light blue for user, dark blue for enemy
        this.ctx.strokeStyle = isMyPlayer ? 'rgba(135, 206, 250, 0.8)' : 'rgba(0, 0, 139, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(playerHitboxX, playerHitboxY, playerHitboxWidth, playerHitboxHeight);
        this.ctx.fillStyle = isMyPlayer ? 'rgba(135, 206, 250, 0.2)' : 'rgba(0, 0, 139, 0.2)';
        this.ctx.fillRect(playerHitboxX, playerHitboxY, playerHitboxWidth, playerHitboxHeight);

        // Attack hitbox (only show when attacking)
        if (player.state === 'attack1') {
            const attackRange = config.attack.range;
            const attackHeight = config.attack.height;
            const attackYOffset = config.attack.yOffset;

            let attackHitboxX, attackHitboxY;
            if (player.facing === 'right') {
                attackHitboxX = player.x;
                attackHitboxY = player.y - attackYOffset;
            } else {
                attackHitboxX = player.x - attackRange;
                attackHitboxY = player.y - attackYOffset;
            }

            // Draw attack hitbox - light red for user, dark red for enemy
            this.ctx.strokeStyle = isMyPlayer ? 'rgba(255, 99, 71, 0.8)' : 'rgba(139, 0, 0, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(attackHitboxX, attackHitboxY, attackRange, attackHeight);
            this.ctx.fillStyle = isMyPlayer ? 'rgba(255, 99, 71, 0.3)' : 'rgba(139, 0, 0, 0.3)';
            this.ctx.fillRect(attackHitboxX, attackHitboxY, attackRange, attackHeight);
        }
    }

    drawUI() {
        // UI elements can be added here later if needed
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    const game = new Game();
    game.update(0);
}); 
import { io } from 'socket.io-client';
import { SpriteManager, AnimatedSprite } from './SpriteManager.js';
import { InputManager } from './InputManager.js';
import { Web3Manager } from './Web3Manager.js';

// Hitbox configuration - must match server
const HITBOX_CONFIG = {
    player1: {
        width: 40,
        height: 105,
        yOffset: 400,
        attack: {
            range: 70,
            height: 75,
            yOffset: 125
        }
    },
    player2: {
        width: 40,
        height: 105,
        yOffset: 400,
        attack: {
            range: 70,
            height: 55,
            yOffset: 105
        }
    }
};

export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.socket = io();

        this.spriteManager = new SpriteManager();
        this.inputManager = null;
        this.web3Manager = new Web3Manager();

        // Scene management
        this.currentScene = 'waiting'; // 'lobby' | 'fight' | 'waiting'
        this.gameState = null;
        this.lobbyState = null;
        this.playerId = null;
        this.gameId = null;

        this.lastTime = 0;
        this.isGameRunning = false;
        this.isWaitingRoom = true;

        // Store animated sprites separately
        this.playerSprites = new Map();

        // Callbacks for React components
        this.onSceneChange = null;
        this.onLobbyStateChange = null;
        this.onWalletChange = null;
        this.onChallengeReceived = null;
        this.onToastMessage = null;

        this.isRunning = false;
        this.animationFrameId = null;

        this.setupSocketEvents();
        this.loadAssets();
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

        // Lobby socket events
        this.socket.on('lobbyJoined', (data) => {
            console.log('Joined lobby:', data);
            this.currentScene = 'lobby';
            this.playerId = data.playerId;
            this.lobbyState = data.lobbyState;

            if (this.onSceneChange) {
                this.onSceneChange('lobby');
            }
            if (this.onLobbyStateChange) {
                this.onLobbyStateChange(data.lobbyState);
            }
        });

        this.socket.on('lobbyState', (state) => {
            if (this.currentScene === 'lobby') {
                this.lobbyState = state;
                if (this.onLobbyStateChange) {
                    this.onLobbyStateChange(state);
                }
            }
        });

        this.socket.on('lobbyFull', (data) => {
            alert(data.message);
        });

        this.socket.on('challengeReceived', (challenge) => {
            if (this.onChallengeReceived) {
                this.onChallengeReceived(challenge);
            }
            if (this.onToastMessage) {
                this.onToastMessage(`New challenge from ${challenge.challengerWallet ? challenge.challengerWallet.slice(0, 6) + '...' : 'a player'}!`);
            }
        });

        this.socket.on('challengeResponse', (response) => {
            if (this.onToastMessage) {
                if (response.status === 'accepted') {
                    this.onToastMessage('Challenge accepted! Preparing fight...');
                } else if (response.status === 'declined') {
                    this.onToastMessage(response.message || 'Challenge declined');
                }
            }
        });

        this.socket.on('challengeExpired', (data) => {
            if (this.onToastMessage) {
                this.onToastMessage('Challenge expired');
            }
        });

        this.socket.on('challengeError', (data) => {
            if (this.onToastMessage) {
                this.onToastMessage(`Error: ${data.message}`);
            }
        });

        this.socket.on('challengeSent', (data) => {
            console.log('Challenge sent:', data);
        });

        this.socket.on('fightStarting', (data) => {
            console.log('Fight starting:', data);
            this.currentScene = 'fight';
            this.gameState = data.gameState;
            this.gameId = data.fightId;
            this.isGameRunning = true;
            this.isWaitingRoom = false;

            if (this.onSceneChange) {
                this.onSceneChange('fight');
            }
        });

        this.socket.on('returnToLobby', (data) => {
            console.log('Returning to lobby:', data);
            this.currentScene = 'lobby';
            this.lobbyState = data.lobbyState;
            this.isGameRunning = false;
            this.isWaitingRoom = false;

            if (this.onSceneChange) {
                this.onSceneChange('lobby');
            }
            if (this.onLobbyStateChange) {
                this.onLobbyStateChange(data.lobbyState);
            }
            if (this.onToastMessage) {
                this.onToastMessage('Returned to lobby');
            }
        });
    }

    loadAssets() {
        this.spriteManager.onLoadComplete = () => {
            console.log('All sprites loaded!');
        };
        this.spriteManager.loadAllSprites();
    }

    // Public methods for React to call
    connectWallet() {
        return this.web3Manager.connectWallet();
    }

    joinLobby() {
        const joinData = {
            walletAddress: this.web3Manager.account
        };
        this.socket.emit('joinLobby', joinData);
    }

    sendChallenge(playerId, wagerAmount) {
        this.socket.emit('sendChallenge', {
            challenged: playerId,
            wagerAmount: wagerAmount
        });
    }

    acceptChallenge(challengeId) {
        this.socket.emit('acceptChallenge', { challengeId });
    }

    declineChallenge(challengeId) {
        this.socket.emit('declineChallenge', { challengeId });
    }

    // Game loop
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.update(this.lastTime);
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    update(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Update all animated sprites
        for (let [playerId, animatedSprite] of this.playerSprites) {
            animatedSprite.update(currentTime);
        }

        this.render();
        this.animationFrameId = requestAnimationFrame((time) => this.update(time));
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        switch (this.currentScene) {
            case 'lobby':
                this.drawLobbyScene();
                break;
            case 'fight':
                this.drawFightingScene();
                break;
            case 'waiting':
            default:
                this.drawWaitingRoom();
                break;
        }
    }

    drawWaitingRoom() {
        // Waiting room background
        this.ctx.fillStyle = '#4A90E2';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);

        this.ctx.fillStyle = '#7B9E89';
        this.ctx.fillRect(0, this.canvas.height / 2, this.canvas.width, this.canvas.height / 2);

        // todo: these should be in the react files
        // Draw waiting room text
        // this.ctx.fillStyle = '#FFFFFF';
        // this.ctx.font = '48px Arial';
        // this.ctx.textAlign = 'center';
        // this.ctx.fillText('WAITING ROOM', this.canvas.width / 2, 150);

        // this.ctx.font = '24px Arial';
        // this.ctx.fillText('Waiting for another player to join...', this.canvas.width / 2, 200);

        // Draw player count
        // const playerCount = this.gameState ? this.gameState.players.length : 0;
        // this.ctx.fillText(`Players: ${playerCount}/2`, this.canvas.width / 2, 250);

        // Draw players (if any)
        if (this.gameState) {
            this.gameState.players.forEach(player => {
                this.drawPlayer(player);
            });
        }
    }

    drawLobbyScene() {
        // Same background as other scenes
        // this.ctx.fillStyle = '#4A90E2';
        // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);

        // this.ctx.fillStyle = '#7B9E89';
        // this.ctx.fillRect(0, this.canvas.height / 2, this.canvas.width, this.canvas.height / 2);

        const lobbybgSprite = this.spriteManager.sprites['lobbybg']
        this.ctx.drawImage(lobbybgSprite, 0, 0, this.canvas.width, this.canvas.height)

        // todo: these should be in the react files
        // Draw lobby title
        // this.ctx.fillStyle = '#FFFFFF';
        // this.ctx.font = '36px Arial';
        // this.ctx.textAlign = 'left';
        // this.ctx.fillText('LOBBY', 20, 50);

        // // Draw player count
        // const playerCount = this.lobbyState ? this.lobbyState.players.length : 0;
        // this.ctx.font = '18px Arial';
        // this.ctx.fillText(`Players: ${playerCount}/10`, 20, 85);

        // Draw all lobby players with movement
        if (this.lobbyState && this.lobbyState.players) {
            this.lobbyState.players.forEach(player => {
                this.drawPlayer(player);
            });
        }
    }

    drawFightingScene() {
        // Fighting scene background
        // this.ctx.fillStyle = '#4A90E2';
        // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);

        // this.ctx.fillStyle = '#7B9E89';
        // this.ctx.fillRect(0, this.canvas.height / 2, this.canvas.width, this.canvas.height / 2);
        
        const arenabgSprite = this.spriteManager.sprites['arenabg']
        this.ctx.drawImage(arenabgSprite, 0, 0, this.canvas.width, this.canvas.height)

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

        // Draw message
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }

    drawPlayer(player) {
        // Determine player ID based on sprite
        let playerId;
        if (player.sprite === 'player1' || player.sprite === 'player2') {
            playerId = player.sprite;
        } else {
            playerId = player.id === this.playerId ? 'player1' : 'player2';
        }

        // Get or create animated sprite
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

        // Draw health bar
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

        // Draw player hitbox
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

            // Draw attack hitbox
            this.ctx.strokeStyle = isMyPlayer ? 'rgba(255, 99, 71, 0.8)' : 'rgba(139, 0, 0, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(attackHitboxX, attackHitboxY, attackRange, attackHeight);
            this.ctx.fillStyle = isMyPlayer ? 'rgba(255, 99, 71, 0.3)' : 'rgba(139, 0, 0, 0.3)';
            this.ctx.fillRect(attackHitboxX, attackHitboxY, attackRange, attackHeight);
        }
    }

    // Getters for React components
    getWalletAddress() {
        return this.web3Manager.account;
    }

    isWalletConnected() {
        return this.web3Manager.isConnected;
    }

    getCurrentScene() {
        return this.currentScene;
    }

    getLobbyState() {
        return this.lobbyState;
    }

    getPlayerId() {
        return this.playerId;
    }
}

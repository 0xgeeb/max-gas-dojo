const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const serverWeb3Manager = require('./web3');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Game state storage
const games = new Map();
const players = new Map();

// Match data storage (wallet addresses, stakes, etc.)
const matchData = new Map();

// ========================================
// HITBOX CONFIGURATION
// Adjust these values to customize hitboxes for each sprite
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

// Game logic
class GameState {
  constructor(id, matchId = null) {
    this.id = id;
    this.matchId = matchId; // Blockchain match ID
    this.players = new Map();
    this.gameLoop = null;
    this.isRunning = false;
    this.lastUpdate = Date.now();
    this.matchResolved = false;
    this.disconnectTimeout = null;
  }

  addPlayer(socketId, playerData) {
    // Get hitbox config for this sprite type
    const spriteType = playerData.sprite || 'player1';
    const config = HITBOX_CONFIG[spriteType];

    this.players.set(socketId, {
      id: socketId,
      x: playerData.x || 100,
      y: playerData.y || config.yOffset,
      width: config.width,
      height: config.height,
      velocityX: 0,
      velocityY: 0,
      onGround: true,
      health: 100,
      state: 'idle',
      facing: 'right',
      lastAttack: 0,
      attackStartTime: 0,
      isAttacking: false,
      hasHitThisAttack: false,
      ...playerData
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  update() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // Update each player
    for (let [socketId, player] of this.players) {
      // Get sprite-specific config
      const config = HITBOX_CONFIG[player.sprite];
      const groundLevel = config.yOffset;

      // Apply gravity
      if (!player.onGround) {
        player.velocityY += 800 * deltaTime; // Gravity
        // Set fall animation when falling
        if (player.velocityY > 0 && player.state !== 'attack1' && player.state !== 'takeHit') {
          player.state = 'fall';
        }
      }

      // Update position
      player.x += player.velocityX * deltaTime;
      player.y += player.velocityY * deltaTime;

      // Ground collision
      if (player.y >= groundLevel) {
        player.y = groundLevel;
        player.velocityY = 0;
        player.onGround = true;
        // Return to idle or run when landing (unless attacking or hit)
        if (player.state === 'fall' || player.state === 'jump') {
          player.state = player.velocityX !== 0 ? 'run' : 'idle';
        }
      }

      // Keep players in bounds
      if (player.x < 0) player.x = 0;
      if (player.x > 800 - player.width) player.x = 800 - player.width;

      // Update attack state timing - attack completes after animation
      // Player1 has 6 frames, player2 has 4 frames at 100ms each
      const attackDuration = player.sprite === 'player1' ? 600 : 400;
      if (player.state === 'attack1' && now - player.attackStartTime > attackDuration) {
        player.state = player.velocityX !== 0 ? 'run' : 'idle';
        player.isAttacking = false;
      }
    }

    // Check for attack collisions
    this.checkAttackCollisions();
  }

  checkAttackCollisions() {
    const playersArray = Array.from(this.players.values());

    for (let i = 0; i < playersArray.length; i++) {
      const attacker = playersArray[i];

      // Only check if player is currently attacking
      if (attacker.state === 'attack1' && attacker.isAttacking) {
        // Get sprite-specific attack hitbox config
        const attackerConfig = HITBOX_CONFIG[attacker.sprite];
        const attackRange = attackerConfig.attack.range;
        const attackHeight = attackerConfig.attack.height;
        const attackYOffset = attackerConfig.attack.yOffset;

        let attackHitbox;
        if (attacker.facing === 'right') {
          attackHitbox = {
            x: attacker.x,
            y: attacker.y - attackYOffset,
            width: attackRange,
            height: attackHeight
          };
        } else {
          attackHitbox = {
            x: attacker.x - attackRange,
            y: attacker.y - attackYOffset,
            width: attackRange,
            height: attackHeight
          };
        }

        // Check collision with other players
        for (let j = 0; j < playersArray.length; j++) {
          if (i === j) continue;

          const defender = playersArray[j];

          // Player hitbox (matches client game.js:232-235)
          const playerHitbox = {
            x: defender.x - defender.width / 2,
            y: defender.y - defender.height,
            width: defender.width,
            height: defender.height / 2
          };

          // Check if attack hitbox overlaps with player hitbox
          if (this.checkCollision(attackHitbox, playerHitbox)) {
            // Only deal damage once per attack
            if (!attacker.hasHitThisAttack) {
              defender.health -= 10;
              if (defender.health < 0) defender.health = 0;

              // Visual feedback - set defender to take hit state
              if (defender.health > 0) {
                defender.state = 'takeHit';
                setTimeout(() => {
                  if (defender.state === 'takeHit') {
                    defender.state = 'idle';
                  }
                }, 300);
              } else {
                defender.state = 'death';
                // Trigger match resolution on blockchain
                this.onPlayerDeath(attacker, defender);
              }

              attacker.hasHitThisAttack = true;
            }
          }
        }
      }
    }
  }

  checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  }

  getState() {
    return {
      id: this.id,
      players: Array.from(this.players.values())
    };
  }

  onPlayerDeath(winner, loser) {
    // Only resolve once
    if (this.matchResolved) return;
    this.matchResolved = true;

    // If this is a blockchain match, resolve it
    if (this.matchId) {
      const match = matchData.get(this.matchId);
      if (match) {
        const winnerData = match.players.get(winner.id);
        const loserData = match.players.get(loser.id);

        if (winnerData && loserData && winnerData.walletAddress && loserData.walletAddress) {
          console.log(`Player ${loser.id} died. Resolving match on blockchain...`);
          resolveMatchOnChain(
            this.matchId,
            winnerData.walletAddress,
            loserData.walletAddress
          ).then(result => {
            console.log('Match resolved successfully:', result);
          }).catch(error => {
            console.error('Failed to resolve match:', error);
          });
        } else {
          console.log('Match ended but no wallet addresses found');
        }
      }
    }
  }
}

// Helper function to resolve match on blockchain
async function resolveMatchOnChain(matchId, winnerAddress, loserAddress) {
  try {
    console.log(`Resolving match ${matchId} on blockchain...`);
    const result = await serverWeb3Manager.resolveMatch(matchId, winnerAddress, loserAddress);
    console.log('Match resolved:', result);
    return result;
  } catch (error) {
    console.error('Error resolving match on chain:', error);
    throw error;
  }
}

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinGame', (data) => {
    let game = null;

    // Find an available game or create new one
    for (let [gameId, gameState] of games) {
      if (gameState.players.size < 2) {
        game = gameState;
        break;
      }
    }

    if (!game) {
      const gameId = Date.now().toString();
      // Use the matchId from the first player if provided
      const matchId = data.matchId || null;
      game = new GameState(gameId, matchId);
      games.set(gameId, game);

      // Initialize match data for blockchain matches
      if (matchId) {
        matchData.set(matchId, {
          gameId: gameId,
          players: new Map(),
          stakeAmount: data.stakeAmount || 0,
          startTime: Date.now()
        });
      }
    }

    // Store wallet address for this player (for blockchain resolution)
    if (data.walletAddress && game.matchId) {
      const match = matchData.get(game.matchId);
      if (match) {
        match.players.set(socket.id, {
          walletAddress: data.walletAddress,
          stakeAmount: data.stakeAmount,
          isStaked: data.isStaked
        });
      }
    }

    // Add player to game
    const isFirstPlayer = game.players.size === 0;
    const randomSprite = Math.random() < 0.5 ? 'player1' : 'player2';
    game.addPlayer(socket.id, {
      x: isFirstPlayer ? 100 : 700,
      sprite: randomSprite,
      facing: isFirstPlayer ? 'right' : 'left',
      walletAddress: data.walletAddress
    });

    players.set(socket.id, game.id);
    socket.join(game.id);

    // Start game loop if not already running
    if (!game.isRunning) {
      game.isRunning = true;
      game.gameLoop = setInterval(() => {
        game.update();
        io.to(game.id).emit('gameState', game.getState());
      }, 1000 / 60); // 60 FPS
    }

    // Send current game state
    socket.emit('gameJoined', {
      gameId: game.id,
      playerId: socket.id,
      gameState: game.getState()
    });
  });

  socket.on('playerInput', (data) => {
    const gameId = players.get(socket.id);
    if (!gameId) return;

    const game = games.get(gameId);
    if (!game) return;

    const player = game.players.get(socket.id);
    if (!player) return;



    // Handle input - block movement during hit reactions and death, but allow during attacks
    const canMove = player.state !== 'takeHit' && player.state !== 'death';
    const canChangeState = canMove && player.state !== 'attack1';

    switch (data.action) {
      case 'moveLeft':
        if (canMove) {
          player.velocityX = -200;
          player.facing = 'left';
          if (canChangeState) {
            player.state = 'run';
          }
        }
        break;
      case 'moveRight':
        if (canMove) {
          player.velocityX = 200;
          player.facing = 'right';
          if (canChangeState) {
            player.state = 'run';
          }
        }
        break;
      case 'stop':
        if (canMove) {
          player.velocityX = 0;
          if (canChangeState) {
            player.state = 'idle';
          }
        }
        break;
      case 'jump':
        if (canMove && player.onGround) {
          player.velocityY = -400;
          player.onGround = false;
          if (canChangeState) {
            player.state = 'jump';
          }
        }
        break;
      case 'attack':
        const now = Date.now();
        // Only allow attack if not already attacking and cooldown has passed
        if (player.state !== 'attack1' && now - player.lastAttack > 500) {
          player.state = 'attack1';
          player.lastAttack = now;
          player.attackStartTime = now;
          player.isAttacking = true;
          player.hasHitThisAttack = false;
        }
        break;
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);

    const gameId = players.get(socket.id);
    if (gameId) {
      const game = games.get(gameId);
      if (game) {
        // If this is a blockchain match with 2 players, start disconnect timeout
        if (game.matchId && game.players.size === 2 && !game.matchResolved) {
          const disconnectedPlayer = game.players.get(socket.id);
          const remainingPlayer = Array.from(game.players.values()).find(p => p.id !== socket.id);

          if (disconnectedPlayer && remainingPlayer) {
            console.log(`Player ${socket.id} disconnected. Starting 30s timeout...`);

            // Start timeout - if disconnected player doesn't reconnect in 30s, award match to remaining player
            game.disconnectTimeout = setTimeout(() => {
              if (game.players.size === 1 && !game.matchResolved) {
                console.log(`Timeout reached. Awarding match to ${remainingPlayer.id}`);
                game.onPlayerDeath(remainingPlayer, disconnectedPlayer);
              }
            }, 30000); // 30 seconds
          }
        }

        game.removePlayer(socket.id);

        // Immediately send updated game state to remaining players
        io.to(game.id).emit('gameState', game.getState());

        // Keep game loop running even with 1 player (for waiting room)
        // Only stop if no players left
        if (game.players.size === 0) {
          if (game.gameLoop) {
            clearInterval(game.gameLoop);
            game.isRunning = false;
          }
          if (game.disconnectTimeout) {
            clearTimeout(game.disconnectTimeout);
          }
        }
      }
      players.delete(socket.id);
    }
  });
});

// Initialize Web3 on server startup
serverWeb3Manager.initialize().then(initialized => {
  if (initialized) {
    console.log('Server Web3 Manager initialized successfully');
    console.log('Oracle address:', serverWeb3Manager.getOracleAddress());
  } else {
    console.log('Server Web3 Manager not initialized (running in mock mode)');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game available at http://localhost:${PORT}`);
}); 
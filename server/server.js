const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const resolver = require('./resolver');

const app = express();
const server = http.createServer(app);

// Configure CORS origins - use environment variable or default to localhost for development
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Serve static files from built React app if it exists, otherwise serve old client
const distPath = path.join(__dirname, '../client/dist');
const clientPath = path.join(__dirname, '../client');

if (fs.existsSync(distPath)) {
  console.log('Serving built React app from:', distPath);
  app.use(express.static(distPath));
} else {
  console.log('Built app not found. Serving from:', clientPath);
  app.use(express.static(clientPath));
}

app.use('/assets', express.static(path.join(__dirname, '../client/assets')));

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

// Lobby logic
class LobbyState {
  constructor() {
    this.players = new Map();
    this.gameLoop = null;
    this.isRunning = false;
    this.lastUpdate = Date.now();
  }

  addPlayer(socketId, playerData) {
    // Get hitbox config for this sprite type
    const spriteType = playerData.sprite || 'player1';
    const config = HITBOX_CONFIG[spriteType];

    this.players.set(socketId, {
      id: socketId,
      x: playerData.x || (Math.random() * 600 + 100), // Random spawn between 100-700
      y: playerData.y || config.yOffset,
      width: config.width,
      height: config.height,
      velocityX: 0,
      velocityY: 0,
      onGround: true,
      state: 'idle',
      facing: 'right',
      location: 'lobby',
      currentFightId: null,
      incomingChallenges: [],
      outgoingChallenges: [],
      lastChallengeTime: 0,
      ...playerData
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  // Get count of all players (including those in fights)
  getTotalPlayerCount() {
    return this.players.size;
  }

  // Get only players actively in lobby (not in fights)
  getActiveLobbyPlayers() {
    return Array.from(this.players.values()).filter(p => p.location === 'lobby');
  }

  update() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // Update each player in lobby (same physics as fight, but no combat)
    for (let [socketId, player] of this.players) {
      // Get sprite-specific config
      const config = HITBOX_CONFIG[player.sprite];
      const groundLevel = config.yOffset;

      // Apply gravity
      if (!player.onGround) {
        player.velocityY += 800 * deltaTime;
        if (player.velocityY > 0 && player.state !== 'takeHit') {
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
        if (player.state === 'fall' || player.state === 'jump') {
          player.state = player.velocityX !== 0 ? 'run' : 'idle';
        }
      }

      // Keep players in bounds
      if (player.x < 0) player.x = 0;
      if (player.x > 800 - player.width) player.x = 800 - player.width;
    }
  }

  getState() {
    return {
      players: Array.from(this.players.values())
    };
  }
}

// Game logic
class GameState {
  constructor(id, matchId = null, challengeData = null) {
    this.id = id;
    this.matchId = matchId; // Blockchain match ID
    this.challengeData = challengeData; // Challenge info (wager, players, etc.)
    this.players = new Map();
    this.gameLoop = null;
    this.isRunning = false;
    this.lastUpdate = Date.now();
    this.matchResolved = false;
    this.disconnectTimeout = null;
    this.timeouts = []; // Track all timeouts for cleanup
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

  clearAllTimeouts() {
    // Clear all tracked timeouts
    this.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.timeouts = [];
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }
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
                const timeoutId = setTimeout(() => {
                  if (defender.state === 'takeHit') {
                    defender.state = 'idle';
                  }
                }, 300);
                this.timeouts.push(timeoutId);
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

    const fightId = this.id;

    // If this is a blockchain match, resolve it
    if (this.matchId || this.challengeData) {
      // Use challengeData if available (new system), otherwise fallback to matchData (old system)
      if (this.challengeData) {
        console.log(`Player ${loser.id} died. Resolving challenge match on blockchain...`);

        resolveMatchOnChain(
          this.challengeData.matchId,
          winner.walletAddress
        ).then(result => {
          console.log('Challenge match resolved successfully:', result);
          // Return both players to lobby after blockchain resolution
          const timeoutId = setTimeout(() => returnPlayersToLobby(fightId), 3000); // 3 second delay
          this.timeouts.push(timeoutId);
        }).catch(error => {
          console.error('Failed to resolve challenge match:', error);
          // Still return players to lobby even if blockchain fails
          const timeoutId = setTimeout(() => returnPlayersToLobby(fightId), 3000);
          this.timeouts.push(timeoutId);
        });
      } else if (this.matchId) {
        const match = matchData.get(this.matchId);
        if (match) {
          const winnerData = match.players.get(winner.id);
          const loserData = match.players.get(loser.id);

          if (winnerData && loserData && winnerData.walletAddress && loserData.walletAddress) {
            console.log(`Player ${loser.id} died. Resolving match on blockchain...`);
            resolveMatchOnChain(
              this.matchId,
              winner.walletAddress
            ).then(result => {
              console.log('Match resolved successfully:', result);
              const timeoutId = setTimeout(() => returnPlayersToLobby(fightId), 3000);
              this.timeouts.push(timeoutId);
            }).catch(error => {
              console.error('Failed to resolve match:', error);
              const timeoutId = setTimeout(() => returnPlayersToLobby(fightId), 3000);
              this.timeouts.push(timeoutId);
            });
          } else {
            console.log('Match ended but no wallet addresses found');
            const timeoutId = setTimeout(() => returnPlayersToLobby(fightId), 3000);
            this.timeouts.push(timeoutId);
          }
        }
      }
    } else {
      // No blockchain match, just return to lobby immediately
      console.log('Non-blockchain fight ended. Returning players to lobby.');
      const timeoutId = setTimeout(() => returnPlayersToLobby(fightId), 3000); // Still add delay for game over screen
      this.timeouts.push(timeoutId);
    }
  }
}

// Game state storage
const lobby = new LobbyState(); // Global lobby for up to 10 players
const fights = new Map(); // Individual 1v1 fight instances (renamed from 'games')
const players = new Map(); // Track player locations (lobby or fight)
const challenges = new Map(); // Pending challenges
const matchData = new Map(); // Match data storage (wallet addresses, stakes, etc.)

// Rate limiting tracking
const rateLimits = new Map(); // Track rate limits per socket per event type

// Helper function to check rate limit
function checkRateLimit(socketId, eventType, maxRequests, windowMs) {
  const key = `${socketId}:${eventType}`;
  const now = Date.now();

  if (!rateLimits.has(key)) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  const limit = rateLimits.get(key);

  // Reset if window expired
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + windowMs;
    return true;
  }

  // Check if limit exceeded
  if (limit.count >= maxRequests) {
    return false;
  }

  limit.count++;
  return true;
}

// Helper function to resolve match on blockchain
async function resolveMatchOnChain(matchId, winnerAddress) {
  try {
    console.log(`Resolving match ${matchId} on blockchain...`);
    const result = await resolver.resolveMatch(matchId, winnerAddress);
    console.log('Match resolved:', result);
    return result;
  } catch (error) {
    console.error('Error resolving match on chain:', error);
    throw error;
  }
}

// Helper function to return players to lobby after fight
function returnPlayersToLobby(fightId) {
  const fight = fights.get(fightId);
  if (!fight) return;

  const playerIds = Array.from(fight.players.keys());

  playerIds.forEach(socketId => {
    const player = fight.players.get(socketId);
    if (!player) return;

    // Reset player state for lobby
    const randomX = Math.random() * 600 + 100;
    const randomSprite = Math.random() < 0.5 ? 'player1' : 'player2';

    lobby.addPlayer(socketId, {
      sprite: randomSprite,
      walletAddress: player.walletAddress
    });

    // Update player tracking
    players.set(socketId, {
      location: 'lobby',
      gameId: null
    });

    // Move socket to lobby room
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(fightId);
      socket.join('lobby');
    }

    // Notify client to return to lobby
    io.to(socketId).emit('returnToLobby', {
      lobbyState: lobby.getState()
    });
  });

  // Clean up fight
  if (fight.gameLoop) {
    clearInterval(fight.gameLoop);
  }
  fight.clearAllTimeouts();
  fights.delete(fightId);

  // Update remaining lobby players
  io.to('lobby').emit('lobbyState', lobby.getState());

  console.log(`Players from fight ${fightId} returned to lobby`);
}

// Helper function to clean up a single challenge
function cleanupChallenge(challengeId) {
  const challenge = challenges.get(challengeId);
  if (challenge) {
    // Clear the expiration timeout
    if (challenge.expirationTimeout) {
      clearTimeout(challenge.expirationTimeout);
      challenge.expirationTimeout = null;
    }
    challenges.delete(challengeId);
  }
}

// Helper function to cancel all challenges involving a player
function cancelPlayerChallenges(socketId) {
  const player = lobby.players.get(socketId);
  if (!player) return;

  // Cancel all outgoing challenges
  player.outgoingChallenges.forEach(challengeId => {
    const challenge = challenges.get(challengeId);
    if (challenge && challenge.status === 'pending') {
      challenge.status = 'expired';
      // Notify challenged player
      io.to(challenge.challenged).emit('challengeExpired', { challengeId });

      // Remove from challenged player's incoming list
      const challengedPlayer = lobby.players.get(challenge.challenged);
      if (challengedPlayer) {
        challengedPlayer.incomingChallenges = challengedPlayer.incomingChallenges.filter(id => id !== challengeId);
      }
    }
    cleanupChallenge(challengeId);
  });

  // Cancel all incoming challenges
  player.incomingChallenges.forEach(challengeId => {
    const challenge = challenges.get(challengeId);
    if (challenge && challenge.status === 'pending') {
      challenge.status = 'declined';
      // Notify challenger
      io.to(challenge.challenger).emit('challengeResponse', {
        challengeId,
        status: 'declined',
        message: 'Player disconnected'
      });

      // Remove from challenger's outgoing list
      const challengerPlayer = lobby.players.get(challenge.challenger);
      if (challengerPlayer) {
        challengerPlayer.outgoingChallenges = challengerPlayer.outgoingChallenges.filter(id => id !== challengeId);
      }
    }
    cleanupChallenge(challengeId);
  });

  // Clear player's challenge lists
  player.incomingChallenges = [];
  player.outgoingChallenges = [];
}

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinLobby', (data) => {
    // Rate limit: 3 requests per 10 seconds
    if (!checkRateLimit(socket.id, 'joinLobby', 3, 10000)) {
      socket.emit('challengeError', { message: 'Too many join requests. Please wait.' });
      return;
    }

    // Check if lobby is full (max 10 players, including those in fights)
    if (players.size >= 10) {
      socket.emit('lobbyFull', { message: 'Lobby is full. Please try again later.' });
      return;
    }

    // Assign random sprite
    const randomSprite = Math.random() < 0.5 ? 'player1' : 'player2';

    // Add player to lobby at random spawn position
    lobby.addPlayer(socket.id, {
      sprite: randomSprite,
      walletAddress: data.walletAddress || null
    });

    // Track player location
    players.set(socket.id, {
      location: 'lobby',
      gameId: null
    });

    // Join lobby socket room
    socket.join('lobby');

    // Start lobby game loop if not already running
    if (!lobby.isRunning) {
      lobby.isRunning = true;
      lobby.gameLoop = setInterval(() => {
        lobby.update();
        io.to('lobby').emit('lobbyState', lobby.getState());
      }, 1000 / 60); // 60 FPS
    }

    // Send confirmation to client
    socket.emit('lobbyJoined', {
      playerId: socket.id,
      lobbyState: lobby.getState()
    });

    console.log(`Player ${socket.id} joined lobby. Total players: ${lobby.players.size}/10`);
  });

  socket.on('sendChallenge', async (data) => {
    console.log('sendChallenge received from', socket.id, 'data:', data);

    const challenger = lobby.players.get(socket.id);
    const challenged = lobby.players.get(data.challenged);

    console.log('Challenger:', challenger ? challenger.id : 'not found');
    console.log('Challenged:', challenged ? challenged.id : 'not found');

    // Validation
    if (!challenger || !challenged) {
      console.log('Sending challengeError: Player not found in lobby');
      socket.emit('challengeError', { message: 'Player not found in lobby' });
      return;
    }

    // Validate matchId exists on blockchain if resolver is initialized
    if (data.matchId && resolver.isReady()) {
      try {
        const match = await resolver.getMatch(data.matchId);
        if (!match) {
          socket.emit('challengeError', { message: 'Match ID not found on blockchain' });
          return;
        }
      } catch (error) {
        console.error('Error validating matchId:', error);
        socket.emit('challengeError', { message: 'Failed to validate match on blockchain' });
        return;
      }
    }

    if (socket.id === data.challenged) {
      socket.emit('challengeError', { message: 'Cannot challenge yourself' });
      return;
    }

    // Spam prevention: max 1 challenge per 5 seconds
    const now = Date.now();
    if (now - challenger.lastChallengeTime < 5000) {
      socket.emit('challengeError', { message: 'Please wait before sending another challenge' });
      return;
    }

    // Max 3 outgoing challenges at once
    if (challenger.outgoingChallenges.length >= 3) {
      socket.emit('challengeError', { message: 'Too many pending challenges. Wait for responses.' });
      return;
    }

    // Max 5 incoming challenges for target player
    if (challenged.incomingChallenges.length >= 5) {
      socket.emit('challengeError', { message: 'Player has too many pending challenges' });
      return;
    }

    // Check for mutual challenges
    const mutualChallenge = challenges.get(challenged.outgoingChallenges.find(id => {
      const ch = challenges.get(id);
      return ch && ch.challenged === socket.id && ch.status === 'pending';
    }));
    if (mutualChallenge) {
      socket.emit('challengeError', { message: 'Player already challenged you' });
      return;
    }

    // Create challenge
    const challengeId = `${socket.id}-${data.challenged}-${now}`;
    const challenge = {
      id: challengeId,
      challenger: socket.id,
      challenged: data.challenged,
      wagerAmount: data.wagerAmount || 0,
      matchId: data.matchId,
      status: 'pending',
      timestamp: now,
      expiresAt: now + 30000, // 30 seconds
      challengerWallet: challenger.walletAddress,
      challengedWallet: challenged.walletAddress,
      expirationTimeout: null // Track timeout for cleanup
    };

    challenges.set(challengeId, challenge);
    challenger.outgoingChallenges.push(challengeId);
    challenged.incomingChallenges.push(challengeId);
    challenger.lastChallengeTime = now;

    // Send challenge to challenged player
    io.to(data.challenged).emit('challengeReceived', {
      challengeId: challenge.id,
      challenger: socket.id,
      challengerWallet: challenger.walletAddress,
      wagerAmount: challenge.wagerAmount,
      matchId: challenge.matchId
    });

    // Confirm to challenger
    socket.emit('challengeSent', { challengeId });

    // Set expiration timer
    challenge.expirationTimeout = setTimeout(() => {
      const ch = challenges.get(challengeId);
      if (ch && ch.status === 'pending') {
        ch.status = 'expired';

        // Notify both players
        io.to(ch.challenger).emit('challengeExpired', { challengeId });
        io.to(ch.challenged).emit('challengeExpired', { challengeId });

        // Clean up challenge lists
        const challengerPlayer = lobby.players.get(ch.challenger);
        const challengedPlayer = lobby.players.get(ch.challenged);
        if (challengerPlayer) {
          challengerPlayer.outgoingChallenges = challengerPlayer.outgoingChallenges.filter(id => id !== challengeId);
        }
        if (challengedPlayer) {
          challengedPlayer.incomingChallenges = challengedPlayer.incomingChallenges.filter(id => id !== challengeId);
        }

        cleanupChallenge(challengeId);
      }
    }, 30000);

    console.log(`Challenge ${challengeId}: ${socket.id} challenged ${data.challenged} for ${challenge.wagerAmount} tokens`);
  });

  socket.on('acceptChallenge', (data) => {
    // Rate limit: 10 requests per 10 seconds
    if (!checkRateLimit(socket.id, 'acceptChallenge', 10, 10000)) {
      socket.emit('challengeError', { message: 'Too many requests. Please wait.' });
      return;
    }

    const challenge = challenges.get(data.challengeId);

    // Validation
    if (!challenge) {
      socket.emit('challengeError', { message: 'Challenge not found' });
      return;
    }

    if (challenge.challenged !== socket.id) {
      socket.emit('challengeError', { message: 'Not your challenge to accept' });
      return;
    }

    if (challenge.status !== 'pending') {
      socket.emit('challengeError', { message: 'Challenge no longer available' });
      return;
    }

    if (Date.now() > challenge.expiresAt) {
      socket.emit('challengeError', { message: 'Challenge expired' });
      challenge.status = 'expired';
      return;
    }

    // Mark challenge as accepted
    challenge.status = 'accepted';

    // Get both players
    const challenger = lobby.players.get(challenge.challenger);
    const challenged = lobby.players.get(challenge.challenged);

    if (!challenger || !challenged) {
      socket.emit('challengeError', { message: 'Player no longer in lobby' });
      return;
    }

    // Create fight instance
    const fightId = `fight-${Date.now()}`;
    const fight = new GameState(fightId, challenge.id, challenge);

    // Add both players to fight
    const randomSprite1 = Math.random() < 0.5 ? 'player1' : 'player2';
    const randomSprite2 = randomSprite1 === 'player1' ? 'player2' : 'player1';

    fight.addPlayer(challenge.challenger, {
      x: 100,
      sprite: randomSprite1,
      facing: 'right',
      walletAddress: challenger.walletAddress
    });

    fight.addPlayer(challenge.challenged, {
      x: 700,
      sprite: randomSprite2,
      facing: 'left',
      walletAddress: challenged.walletAddress
    });

    // Remove both players from lobby
    lobby.removePlayer(challenge.challenger);
    lobby.removePlayer(challenge.challenged);

    // Update player tracking
    players.set(challenge.challenger, { location: 'fight', gameId: fightId });
    players.set(challenge.challenged, { location: 'fight', gameId: fightId });

    // Clear all challenges for both players
    cancelPlayerChallenges(challenge.challenger);
    cancelPlayerChallenges(challenge.challenged);

    // Stop lobby loop if empty to save CPU
    if (lobby.players.size === 0 && lobby.isRunning) {
      clearInterval(lobby.gameLoop);
      lobby.isRunning = false;
      console.log('Lobby empty - stopping game loop');
    }

    // Store fight
    fights.set(fightId, fight);

    // Start fight loop
    fight.isRunning = true;
    fight.gameLoop = setInterval(() => {
      fight.update();
      io.to(fightId).emit('gameState', fight.getState());
    }, 1000 / 60);

    // Move players to fight room
    const challengerSocket = io.sockets.sockets.get(challenge.challenger);
    const challengedSocket = io.sockets.sockets.get(challenge.challenged);
    if (challengerSocket) challengerSocket.leave('lobby');
    if (challengedSocket) challengedSocket.leave('lobby');
    if (challengerSocket) challengerSocket.join(fightId);
    if (challengedSocket) challengedSocket.join(fightId);

    // Notify both players
    io.to(fightId).emit('fightStarting', {
      fightId,
      gameState: fight.getState(),
      wagerAmount: challenge.wagerAmount
    });

    // Update lobby for remaining players
    io.to('lobby').emit('lobbyState', lobby.getState());

    console.log(`Fight ${fightId} started: ${challenge.challenger} vs ${challenge.challenged}`);
  });

  socket.on('declineChallenge', (data) => {
    // Rate limit: 10 requests per 10 seconds
    if (!checkRateLimit(socket.id, 'declineChallenge', 10, 10000)) {
      socket.emit('challengeError', { message: 'Too many requests. Please wait.' });
      return;
    }

    const challenge = challenges.get(data.challengeId);

    // Validation
    if (!challenge) {
      socket.emit('challengeError', { message: 'Challenge not found' });
      return;
    }

    if (challenge.challenged !== socket.id) {
      socket.emit('challengeError', { message: 'Not your challenge to decline' });
      return;
    }

    if (challenge.status !== 'pending') {
      return; // Already handled
    }

    // Mark as declined
    challenge.status = 'declined';

    // Notify challenger
    io.to(challenge.challenger).emit('challengeResponse', {
      challengeId: data.challengeId,
      status: 'declined'
    });

    // Clean up challenge lists
    const challenger = lobby.players.get(challenge.challenger);
    const challenged = lobby.players.get(challenge.challenged);

    if (challenger) {
      challenger.outgoingChallenges = challenger.outgoingChallenges.filter(id => id !== data.challengeId);
    }
    if (challenged) {
      challenged.incomingChallenges = challenged.incomingChallenges.filter(id => id !== data.challengeId);
    }

    cleanupChallenge(data.challengeId);

    console.log(`Challenge ${data.challengeId} declined by ${socket.id}`);
  });

  socket.on('playerInput', (data) => {
    // Rate limit: 100 requests per second
    if (!checkRateLimit(socket.id, 'playerInput', 100, 1000)) {
      return; // Silently drop excessive inputs
    }

    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    // Handle input based on player location
    let game, player;
    if (playerInfo.location === 'lobby') {
      game = lobby;
      player = lobby.players.get(socket.id);
    } else if (playerInfo.location === 'fight') {
      game = fights.get(playerInfo.gameId);
      if (!game) return;
      player = game.players.get(socket.id);
    } else {
      return;
    }

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

    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    if (playerInfo.location === 'lobby') {
      // Handle lobby disconnect
      lobby.removePlayer(socket.id);

      // Cancel all challenges involving this player
      cancelPlayerChallenges(socket.id);

      // Notify other players in lobby
      io.to('lobby').emit('lobbyState', lobby.getState());

      // Stop lobby loop if empty to save CPU
      if (lobby.players.size === 0 && lobby.isRunning) {
        clearInterval(lobby.gameLoop);
        lobby.isRunning = false;
        console.log('Lobby empty - stopping game loop');
      }

      console.log(`Player ${socket.id} left lobby. Remaining players: ${lobby.players.size}/10`);

    } else if (playerInfo.location === 'fight') {
      // Handle fight disconnect
      const game = fights.get(playerInfo.gameId);
      if (game) {
        // If this is a blockchain match with 2 players, start disconnect timeout
        if (game.matchId && game.players.size === 2 && !game.matchResolved) {
          const disconnectedPlayer = game.players.get(socket.id);
          const remainingPlayer = Array.from(game.players.values()).find(p => p.id !== socket.id);

          if (disconnectedPlayer && remainingPlayer) {
            console.log(`Player ${socket.id} disconnected from fight. Starting 30s timeout...`);

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

        // Clean up fight if no players left
        if (game.players.size === 0) {
          if (game.gameLoop) {
            clearInterval(game.gameLoop);
            game.isRunning = false;
          }
          game.clearAllTimeouts();
          fights.delete(game.id);
        }
      }
    }

    players.delete(socket.id);

    // Clean up rate limit data for this socket
    const rateLimitKeys = Array.from(rateLimits.keys()).filter(key => key.startsWith(`${socket.id}:`));
    rateLimitKeys.forEach(key => rateLimits.delete(key));
  });
});

// Initialize blockchain resolver on server startup
resolver.initialize().then(initialized => {
  if (initialized) {
    console.log('Match Resolver initialized successfully');
    console.log('Resolver address:', resolver.getResolverAddress());
  } else {
    console.log('Match Resolver not initialized (running in mock mode)');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game available at http://localhost:${PORT}`);
}); 
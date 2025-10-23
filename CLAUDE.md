# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A real-time multiplayer 2D fighting game called "Martial Hero Fighter" built with Node.js, Express, Socket.io, and vanilla JavaScript. Players connect to a server and are matched into 2-player fighting games with sprite-based characters.

## Development Commands

**Start the server (production):**
```bash
npm start
```

**Start the server (development with auto-reload):**
```bash
npm run dev
```

The server runs on port 3000 by default (configurable via `PORT` environment variable). Access the game at `http://localhost:3000`.

## Architecture

### Client-Server Model

**Server (`server/server.js`):**
- Express HTTP server serving static files from `client/` and `assets/`
- Socket.io WebSocket server for real-time communication
- Authoritative game loop running at 60 FPS
- Game state management with `GameState` class instances
- Automatic matchmaking: finds available games with < 2 players or creates new ones
- Physics simulation (gravity, movement, collision detection)

**Client (`client/`):**
- Vanilla JavaScript with HTML5 Canvas rendering
- Socket.io client for server communication
- Three main modules:
  - `game.js`: Main game loop, rendering, and state management
  - `sprites.js`: Sprite loading and animation (`SpriteManager`, `AnimatedSprite`)
  - `input.js`: Keyboard input handling and server transmission (`InputManager`)

### Game State Synchronization

1. **Server is authoritative**: All game logic runs server-side
2. **Client is presentational**: Receives game state updates and renders
3. **Input flow**: Client sends input actions → Server updates physics/state → Server broadcasts state to all clients
4. **State updates**: Server pushes full game state at 60 FPS via Socket.io

### Key Data Structures

**GameState (server):**
- Manages one game instance (up to 2 players)
- Tracks player positions, velocities, health, states, facing direction
- Runs physics updates (gravity, movement, collisions)
- Maintains game loop interval

**Player state object:**
```javascript
{
  id: socketId,
  x, y,              // Position
  velocityX, velocityY,
  onGround,
  health,
  state,            // 'idle', 'run', 'jump', 'attack1', etc.
  facing,           // 'left' or 'right'
  lastAttack,
  sprite            // 'player1' or 'player2'
}
```

### Sprite System

Two character sprite sheets in `assets/`:
- `Martial Hero/` - player1 sprites
- `Martial Hero 2/` - player2 sprites

Each has 8 animation states: Idle, Run, Jump, Fall, Attack1, Attack2, Take Hit, Death

Sprite sheets use 8 frames at 200x200px per frame. Animation cycles through frames with timing controlled by `AnimatedSprite.update()`.

### Socket.io Events

**Client → Server:**
- `joinGame`: Request to join/create a game
- `playerInput`: Send action ('moveLeft', 'moveRight', 'jump', 'attack', 'stop')

**Server → Client:**
- `gameJoined`: Confirmation with gameId, playerId, initial state
- `gameState`: Periodic state updates (60 FPS)

### Game Flow

1. Client loads → loads sprites → emits `joinGame`
2. Server assigns player to game (existing or new) → starts game loop if needed
3. Server broadcasts state updates → clients render
4. Players disconnected → removed from game → game loop stops if 0 players remain
5. Waiting room shown when < 2 players, fighting scene when 2 players

### Physics Constants

- Gravity: 800 pixels/second²
- Jump velocity: -400 pixels/second
- Run speed: 200 pixels/second
- Ground level: y = 400
- Canvas bounds: 800x600
- Attack cooldown: 500ms

## Important Implementation Notes

- **Input handling**: Client only sends input state changes to reduce network traffic (`input.js:56-60`)
- **Player positioning**: First player spawns at x=100 (facing right), second at x=700 (facing left)
- **Sprite assignment**: Players randomly assigned 'player1' or 'player2' sprite on join (`server.js:119`)
- **State transitions**: Waiting room ↔ Fighting based on player count, managed in `game.js:46-55`
- **Animation state**: Managed separately per player instance using `AnimatedSprite` class
- **Facing direction**: Handled by canvas horizontal flip (`sprites.js:90-93`)

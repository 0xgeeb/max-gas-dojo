# Martial Hero Fighter - React Edition

A real-time multiplayer 2D fighting game built with React, Node.js, Express, Socket.io, and vanilla JavaScript game engine.

## Architecture

### Client (React + Vite)
- **React 18**: UI components (wallet, lobby, challenges)
- **Vite**: Fast dev server and build tool
- **Pure JS Game Engine**: Canvas rendering and physics (independent of React)
- **Socket.io-client**: Real-time communication

### Server (Node.js + Express)
- **Express**: HTTP server
- **Socket.io**: WebSocket server for real-time game state
- **Ethers.js**: Blockchain integration
- **Authoritative game loop**: 60 FPS physics and combat

## Getting Started

### Prerequisites
- Node.js 16+ and npm

### Development Setup

#### 1. Install Dependencies

**Server:**
```bash
cd server
npm install
```

**Client:**
```bash
cd client
npm install
```

#### 2. Run Development Servers

Open **two terminals**:

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```
Server will run on http://localhost:3000

**Terminal 2 - Client (Vite):**
```bash
cd client
npm run dev
```
Vite dev server will run on http://localhost:5173

#### 3. Access the Game

Open your browser to: **http://localhost:5173**

The Vite dev server proxies Socket.io and asset requests to the Express server on port 3000.

### Production Build

#### 1. Build the React app:
```bash
cd client
npm run build
```
This creates an optimized build in `client/dist/`

#### 2. Run the server:
```bash
cd server
npm start
```

#### 3. Access the game:
Open your browser to: **http://localhost:3000**

The server automatically serves the built React app from `client/dist/` if it exists.

## Project Structure

```
/
├── client/
│   ├── package.json          # React dependencies
│   ├── vite.config.js        # Vite configuration
│   ├── index.html            # HTML entry point
│   └── src/
│       ├── main.jsx          # React entry point
│       ├── App.jsx           # Main App component
│       ├── index.css         # Global styles
│       ├── components/       # React components
│       │   ├── Game.jsx      # Canvas wrapper
│       │   ├── WalletButton.jsx
│       │   ├── LobbyUI.jsx
│       │   └── Toast.jsx
│       └── game/             # Pure JS game engine (no React)
│           ├── GameEngine.js # Main game loop
│           ├── SpriteManager.js
│           ├── InputManager.js
│           └── Web3Manager.js
│
├── server/
│   ├── package.json          # Server dependencies
│   ├── server.js             # Express + Socket.io server
│   └── web3.js               # Blockchain integration
│
└── assets/                   # Game sprites
    ├── Martial Hero/
    └── Martial Hero 2/
```

## Key Features

### React-Game Engine Separation
- **Game loop runs outside React**: Uses `requestAnimationFrame`, not React state
- **Canvas rendering**: Independent of React render cycle
- **Callbacks for UI updates**: Game engine notifies React components via callbacks
- **No re-render issues**: Animations stay smooth regardless of React updates

### Development Benefits
- **Hot Module Reload**: Instant updates during development (Vite)
- **Component-based UI**: Easy to modify wallet, lobby, modals
- **Type-safe (future)**: Can add TypeScript easily
- **Modern tooling**: React DevTools, Vite performance

## Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=3000
RPC_URL=http://localhost:8545
ORACLE_PRIVATE_KEY=your_private_key_here
STAKING_CONTRACT_ADDRESS=your_contract_address
GAME_TOKEN_ADDRESS=your_token_address
```

## How to Play

1. **Connect Wallet**: Click "connect" button (top-right) to connect MetaMask
2. **Join Lobby**: Automatically joins after wallet connection
3. **Challenge Player**: Click "Challenge" next to any player, enter wager
4. **Fight**: When opponent accepts, fight begins
5. **Controls**:
   - **A/D or Arrow Keys**: Move left/right
   - **W or Up Arrow**: Jump
   - **Space**: Attack

## Development Tips

### Modifying UI Components
Edit files in `client/src/components/` - changes will hot-reload instantly.

### Modifying Game Logic
Edit files in `client/src/game/` - these control physics, rendering, sprites.

### Adding New Features
1. Pure game logic → Add to `GameEngine.js`
2. UI elements → Create new React component
3. Connect them via callbacks

### Debugging
- **React DevTools**: Inspect component state
- **Console**: Game engine logs socket events
- **Canvas**: Hitboxes are drawn for debugging

## Common Issues

### Port 5173 already in use
Kill the Vite process: `pkill -f vite`

### Socket.io connection failed
Make sure the Express server is running on port 3000.

### Assets not loading
Check that `/assets` folder is in the root directory and server is serving it.

### Sprites not rendering
Open browser console - check for sprite loading errors. Make sure all sprite files exist in `assets/`.

## Scripts Reference

### Client (client/)
- `npm run dev`: Start Vite dev server (port 5173)
- `npm run build`: Build production app to `dist/`
- `npm run preview`: Preview production build locally

### Server (server/)
- `npm run dev`: Start server with nodemon (auto-reload)
- `npm start`: Start server in production mode

## License

MIT

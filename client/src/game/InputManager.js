export class InputManager {
    constructor(socket) {
        this.socket = socket;
        this.keys = {};
        this.lastSentInput = {};
        this.attackPressed = false; // Track if attack was already pressed

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            // Handle attack as a one-time press
            if (e.code === 'Space' && !this.attackPressed) {
                this.attackPressed = true;
                this.socket.emit('playerInput', { action: 'attack' });
                e.preventDefault();
                return;
            }

            this.keys[e.code] = true;
            this.handleInput();
        });

        document.addEventListener('keyup', (e) => {
            // Reset attack pressed state
            if (e.code === 'Space') {
                this.attackPressed = false;
            }

            this.keys[e.code] = false;
            this.handleInput();
        });

        // Prevent default behavior for game keys
        document.addEventListener('keydown', (e) => {
            if (['KeyA', 'KeyD', 'KeyW', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });
    }

    handleInput() {
        const input = {
            moveLeft: this.keys['KeyA'] || this.keys['ArrowLeft'],
            moveRight: this.keys['KeyD'] || this.keys['ArrowRight'],
            jump: this.keys['KeyW'] || this.keys['ArrowUp']
        };

        // Send input to server
        this.sendInputToServer(input);
    }

    sendInputToServer(input) {
        // Determine the action to send
        let action = 'stop';

        if (input.jump) {
            action = 'jump';
        } else if (input.moveLeft) {
            action = 'moveLeft';
        } else if (input.moveRight) {
            action = 'moveRight';
        }

        // Only send if input changed
        if (this.lastSentInput.action !== action) {
            this.socket.emit('playerInput', { action });
            this.lastSentInput = { action };
        }
    }

    // Check if a specific key is pressed
    isKeyPressed(keyCode) {
        return this.keys[keyCode] || false;
    }

    // Get current input state
    getInputState() {
        return {
            moveLeft: this.keys['KeyA'] || this.keys['ArrowLeft'],
            moveRight: this.keys['KeyD'] || this.keys['ArrowRight'],
            jump: this.keys['KeyW'] || this.keys['ArrowUp'],
            attack: this.keys['Space']
        };
    }
}

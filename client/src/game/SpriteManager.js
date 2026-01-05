export class SpriteManager {
    constructor() {
        this.sprites = {};
        this.loadedSprites = 0;
        this.totalSprites = 0;
        this.onLoadComplete = null;
    }

    loadSprite(name, path) {
        this.totalSprites++;
        const img = new Image();
        img.onload = () => {
            this.sprites[name] = img;
            this.loadedSprites++;
            if (this.loadedSprites === this.totalSprites && this.onLoadComplete) {
                this.onLoadComplete();
            }
        };
        img.src = path;
    }

    loadAllSprites() {
        // Load Martial Hero sprites
        this.loadSprite('idle', '/assets/Martial Hero/Sprites/Idle.png');
        this.loadSprite('run', '/assets/Martial Hero/Sprites/Run.png');
        this.loadSprite('jump', '/assets/Martial Hero/Sprites/Jump.png');
        this.loadSprite('attack1', '/assets/Martial Hero/Sprites/Attack1.png');
        this.loadSprite('attack2', '/assets/Martial Hero/Sprites/Attack2.png');
        this.loadSprite('takeHit', '/assets/Martial Hero/Sprites/Take Hit.png');
        this.loadSprite('death', '/assets/Martial Hero/Sprites/Death.png');
        this.loadSprite('fall', '/assets/Martial Hero/Sprites/Fall.png');

        // Load Martial Hero 2 sprites
        this.loadSprite('idle2', '/assets/Martial Hero 2/Sprites/Idle.png');
        this.loadSprite('run2', '/assets/Martial Hero 2/Sprites/Run.png');
        this.loadSprite('jump2', '/assets/Martial Hero 2/Sprites/Jump.png');
        this.loadSprite('attack1_2', '/assets/Martial Hero 2/Sprites/Attack1.png');
        this.loadSprite('attack2_2', '/assets/Martial Hero 2/Sprites/Attack2.png');
        this.loadSprite('takeHit2', '/assets/Martial Hero 2/Sprites/Take hit.png');
        this.loadSprite('death2', '/assets/Martial Hero 2/Sprites/Death.png');
        this.loadSprite('fall2', '/assets/Martial Hero 2/Sprites/Fall.png');

        // Load background sprites
        this.loadSprite('lobbybg', '/assets/lobby.jpg');
        this.loadSprite('arenabg', '/assets/arena.jpg');
    }

    getSprite(state, playerId) {
        if (playerId === 'player2') {
            // Handle special naming for player2 sprites
            const sprite2Names = {
                'attack1': 'attack1_2',
                'attack2': 'attack2_2',
                'takeHit': 'takeHit2',
                'idle': 'idle2',
                'run': 'run2',
                'jump': 'jump2',
                'fall': 'fall2',
                'death': 'death2'
            };
            const spriteName = sprite2Names[state] || 'idle2';
            return this.sprites[spriteName] || this.sprites['idle2'];
        } else {
            return this.sprites[state] || this.sprites['idle'];
        }
    }
}

export class AnimatedSprite {
    constructor(spriteManager, state, playerId) {
        this.spriteManager = spriteManager;
        this.state = state;
        this.playerId = playerId;
        this.frame = 0;
        this.frameTime = 0;
        this.id = Math.random(); // Unique ID to track instances
    }

    update(time) {
        // Different frame rates for different animations
        const frameRate = this.getFrameRate();
        const maxFrames = this.getFrameCount();

        if (time - this.frameTime > frameRate) {
            this.frame = (this.frame + 1) % maxFrames;
            this.frameTime = time;
        }

        // Force frame to stay in valid range
        if (this.frame >= maxFrames) {
            this.frame = 0;
        }
    }

    getFrameCount() {
        // Frame counts differ between the two characters
        if (this.playerId === 'player1') {
            // Martial Hero frame counts
            switch(this.state) {
                case 'attack1':
                case 'attack2':
                    return 6;
                case 'takeHit':
                    return 4;
                case 'death':
                    return 6;
                case 'idle':
                    return 8;
                case 'run':
                    return 8;
                case 'jump':
                case 'fall':
                    return 2;
                default:
                    return 8;
            }
        } else {
            // Martial Hero 2 frame counts
            switch(this.state) {
                case 'attack1':
                case 'attack2':
                    return 4;
                case 'takeHit':
                    return 3;
                case 'death':
                    return 7;
                case 'idle':
                    return 4;
                case 'run':
                    return 8;
                case 'jump':
                case 'fall':
                    return 2;
                default:
                    return 8;
            }
        }
    }

    getFrameRate() {
        // Different animations need different speeds (ms per frame)
        switch(this.state) {
            case 'attack1':
            case 'attack2':
                return 100; // Attack animation (100ms per frame = 400ms total for 4 frames)
            case 'run':
                return 80; // Medium speed running
            case 'takeHit':
                return 75; // Quick hit reaction (300ms total)
            case 'death':
                return 150; // Slower death animation
            default:
                return 120; // Default for idle, jump, fall
        }
    }

    draw(ctx, x, y, width, height, facing) {
        const sprite = this.spriteManager.getSprite(this.state, this.playerId);
        if (!sprite) {
            console.warn(`Sprite not found for state: ${this.state}, playerId: ${this.playerId}`);
            return;
        }

        // Draw frame from sprite sheet
        const frameWidth = 200;
        const frameHeight = 200;
        const sourceX = this.frame * frameWidth;
        const sourceY = 0;

        ctx.save();

        if (facing === 'left') {
            ctx.scale(-1, 1);
            x = -x - width;
        }

        ctx.drawImage(sprite, sourceX, sourceY, frameWidth, frameHeight, x, y, width, height);
        ctx.restore();
    }

    setState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            // Reset frame for new animations to start from beginning
            if (newState === 'attack1' || newState === 'attack2' || newState === 'jump' || newState === 'takeHit' || newState === 'death') {
                this.frame = 0;
                this.frameTime = 0;
            }
        }
    }
}

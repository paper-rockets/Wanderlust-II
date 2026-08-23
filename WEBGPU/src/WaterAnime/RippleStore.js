const MAX_RIPPLES = 8;

export class RippleStore {
    constructor() {
        this.buffer = [];
        this.config = {
            speed: 1.5,
            width: 0.12,
            decay: 1.6,
            strength: 5.5,
            rings: 2,
            spacing: 1.0,
        };
    }

    add(x, z, t) {
        if (this.buffer.length >= MAX_RIPPLES) {
            this.buffer.shift();
        }
        this.buffer.push({ x, z, t });
    }

    get ripples() {
        return this.buffer;
    }

    setConfig(partial) {
        this.config = { ...this.config, ...partial };
    }

    clear() {
        this.buffer.length = 0;
    }
}

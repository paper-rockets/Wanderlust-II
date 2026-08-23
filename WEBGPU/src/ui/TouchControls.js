// Mobile Touch Joystick and Boost Button Handlers

export class TouchControlsHandler {
    constructor(onJoyMove, onBoostChange) {
        this.onJoyMove = onJoyMove;
        this.onBoostChange = onBoostChange;
        
        this.joyBase = document.getElementById('joystick-base');
        this.joyKnob = document.getElementById('joystick-knob');
        this.boostBtn = document.getElementById('boost-btn');
        
        this.activeTouchId = null;
        this.baseCenterX = 0;
        this.baseCenterY = 0;
        
        this.init();
    }

    init() {
        if (!this.joyBase || !this.joyKnob) return;

        const updateCenter = () => {
            const rect = this.joyBase.getBoundingClientRect();
            this.baseCenterX = rect.left + rect.width / 2;
            this.baseCenterY = rect.top + rect.height / 2;
        };

        this.joyBase.addEventListener('touchstart', (e) => {
            if (this.activeTouchId !== null) return;
            const touch = e.changedTouches[0];
            this.activeTouchId = touch.identifier;
            updateCenter();
            this.handleMove(touch.clientX, touch.clientY);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.activeTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.activeTouchId) {
                    this.handleMove(touch.clientX, touch.clientY);
                    break;
                }
            }
        }, { passive: false });

        const endTouch = (e) => {
            if (this.activeTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.activeTouchId) {
                    this.activeTouchId = null;
                    this.joyKnob.style.transform = `translate(-50%, -50%)`;
                    if (this.onJoyMove) this.onJoyMove(0, 0);
                    break;
                }
            }
        };

        window.addEventListener('touchend', endTouch);
        window.addEventListener('touchcancel', endTouch);

        if (this.boostBtn) {
            this.boostBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.onBoostChange) this.onBoostChange(true);
            }, { passive: false });
            
            const releaseBoost = (e) => {
                if (this.onBoostChange) this.onBoostChange(false);
            };
            this.boostBtn.addEventListener('touchend', releaseBoost);
            this.boostBtn.addEventListener('touchcancel', releaseBoost);
        }
    }

    handleMove(clientX, clientY) {
        const dx = clientX - this.baseCenterX;
        const dy = clientY - this.baseCenterY;
        const maxDist = 40;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        
        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;
        
        this.joyKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
        
        if (this.onJoyMove) {
            this.onJoyMove(knobX / maxDist, knobY / maxDist);
        }
    }
}

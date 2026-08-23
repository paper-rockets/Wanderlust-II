// Web Audio API Wind Soundscape Synthesizer

export class SoundscapeEngine {
    constructor() {
        this.audioCtx = null;
        this.windGain = null;
        this.windFilter = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        this.audioCtx = new AudioContext();
        
        const bufferSize = this.audioCtx.sampleRate * 2; 
        const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1; 
        }
        
        const noiseSource = this.audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        
        this.windFilter = this.audioCtx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windFilter.frequency.value = 400; 
        
        this.windGain = this.audioCtx.createGain();
        this.windGain.gain.value = 0;
        
        noiseSource.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.audioCtx.destination);
        
        noiseSource.start();
        this.initialized = true;
    }

    updateWind(speedRatio) {
        if (!this.initialized || !this.windGain || !this.windFilter) return;
        const targetGain = Math.min(0.4, speedRatio * 0.35);
        const targetCutoff = 200 + speedRatio * 1800;
        this.windGain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.1);
        this.windFilter.frequency.setTargetAtTime(targetCutoff, this.audioCtx.currentTime, 0.1);
    }
}

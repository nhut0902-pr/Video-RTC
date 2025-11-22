// Audio Notifications using Web Audio API
class AudioNotifications {
    constructor() {
        this.enabled = localStorage.getItem('audioNotificationsEnabled') !== 'false';
        this.audioContext = null;
    }

    init() {
        // Create audio context on first user interaction
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Generate simple beep sound
    playBeep(frequency = 440, duration = 200, volume = 0.3) {
        if (!this.enabled) return;

        try {
            this.init();

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.01,
                this.audioContext.currentTime + duration / 1000
            );

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
        } catch (error) {
            console.log('Audio play failed:', error);
        }
    }

    // Different sounds for different events
    playJoin() {
        this.playBeep(523.25, 150, 0.2); // C5 note
    }

    playLeave() {
        this.playBeep(392, 150, 0.2); // G4 note
    }

    playMessage() {
        this.playBeep(659.25, 100, 0.15); // E5 note
    }

    playReaction() {
        // Quick ascending beep
        setTimeout(() => this.playBeep(523.25, 80, 0.1), 0);
        setTimeout(() => this.playBeep(659.25, 80, 0.1), 80);
    }

    playCallStart() {
        // Ascending melody
        setTimeout(() => this.playBeep(392, 100, 0.2), 0);
        setTimeout(() => this.playBeep(523.25, 100, 0.2), 100);
        setTimeout(() => this.playBeep(659.25, 150, 0.2), 200);
    }

    playCallEnd() {
        // Descending melody
        setTimeout(() => this.playBeep(659.25, 100, 0.2), 0);
        setTimeout(() => this.playBeep(523.25, 100, 0.2), 100);
        setTimeout(() => this.playBeep(392, 150, 0.2), 200);
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('audioNotificationsEnabled', this.enabled);
        return this.enabled;
    }

    isEnabled() {
        return this.enabled;
    }
}

export default AudioNotifications;

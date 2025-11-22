// Simple Virtual Background using Canvas
class VirtualBackground {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.video = null;
        this.stream = null;
        this.animationId = null;
        this.mode = 'none'; // none, blur
        this.isActive = false;
    }

    async applyBlur(inputStream) {
        try {
            // Create canvas and video elements
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            this.video = document.createElement('video');

            const videoTrack = inputStream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();

            this.canvas.width = settings.width || 640;
            this.canvas.height = settings.height || 480;

            this.video.srcObject = inputStream;
            this.video.play();

            // Wait for video to be ready
            await new Promise(resolve => {
                this.video.onloadedmetadata = resolve;
            });

            // Process frames
            const processFrame = () => {
                if (!this.isActive) return;

                // Apply blur filter
                this.ctx.filter = 'blur(20px)';
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

                this.animationId = requestAnimationFrame(processFrame);
            };

            this.isActive = true;
            this.mode = 'blur';
            processFrame();

            // Get stream from canvas
            this.stream = this.canvas.captureStream(30);

            // Add audio from original stream
            inputStream.getAudioTracks().forEach(track => {
                this.stream.addTrack(track);
            });

            return this.stream;
        } catch (error) {
            console.error('Error applying blur:', error);
            throw error;
        }
    }

    stop() {
        this.isActive = false;
        this.mode = 'none';

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.video) {
            this.video.srcObject = null;
            this.video = null;
        }

        this.canvas = null;
        this.ctx = null;
    }
}

export default VirtualBackground;

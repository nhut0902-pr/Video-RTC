// Call Recorder using MediaRecorder API
class CallRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.startTime = null;
    }

    async start(stream) {
        try {
            this.recordedChunks = [];

            // Check for supported mime types
            const mimeTypes = [
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/webm',
                'video/mp4'
            ];

            let selectedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    break;
                }
            }

            if (!selectedMimeType) {
                throw new Error('No supported mime type found');
            }

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: selectedMimeType,
                videoBitsPerSecond: 2500000 // 2.5 Mbps
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            this.startTime = Date.now();

            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            throw error;
        }
    }

    stop() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                reject(new Error('No recording in progress'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, {
                    type: this.mediaRecorder.mimeType
                });
                this.isRecording = false;
                const duration = Math.floor((Date.now() - this.startTime) / 1000);
                resolve({ blob, duration });
            };

            this.mediaRecorder.onerror = (error) => {
                reject(error);
            };

            this.mediaRecorder.stop();
        });
    }

    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    getRecordingTime() {
        if (!this.isRecording || !this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
}

export default CallRecorder;

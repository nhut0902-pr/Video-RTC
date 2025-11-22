// Network Quality Monitor
class NetworkMonitor {
    constructor(peerConnection) {
        this.pc = peerConnection;
        this.quality = 'good'; // good, fair, poor
        this.monitorInterval = null;
    }

    async checkQuality() {
        if (!this.pc) return this.quality;

        try {
            const stats = await this.pc.getStats();
            let packetLoss = 0;
            let jitter = 0;
            let rtt = 0;
            let packetsReceived = 0;
            let packetsLost = 0;

            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    packetsReceived = report.packetsReceived || 0;
                    packetsLost = report.packetsLost || 0;
                    jitter = report.jitter || 0;

                    if (packetsReceived > 0) {
                        packetLoss = packetsLost / (packetsReceived + packetsLost);
                    }
                }

                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
                }
            });

            // Determine quality based on metrics
            if (packetLoss > 0.05 || rtt > 300 || jitter > 30) {
                this.quality = 'poor';
            } else if (packetLoss > 0.02 || rtt > 150 || jitter > 15) {
                this.quality = 'fair';
            } else {
                this.quality = 'good';
            }

            return {
                quality: this.quality,
                metrics: {
                    packetLoss: (packetLoss * 100).toFixed(2),
                    rtt: rtt.toFixed(0),
                    jitter: jitter.toFixed(2)
                }
            };
        } catch (error) {
            console.error('Error checking network quality:', error);
            return { quality: this.quality, metrics: {} };
        }
    }

    startMonitoring(callback) {
        this.stopMonitoring(); // Clear any existing interval

        this.monitorInterval = setInterval(async () => {
            const result = await this.checkQuality();
            callback(result);
        }, 2000); // Check every 2 seconds
    }

    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }
}

export default NetworkMonitor;

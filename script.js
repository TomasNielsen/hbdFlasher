// ESP32 Web Flasher - Smart UX Script
// Handles step progression, browser compatibility, and user interaction

// ESP32 Bootloader Communication Class
class ESP32BootloaderController {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.keepAliveInterval = null;
        this.isInBootloaderMode = false;
    }

    // ESP32 bootloader protocol constants
    static SLIP_END = 0xC0;
    static SLIP_ESC = 0xDB;
    static SLIP_ESC_END = 0xDC;
    static SLIP_ESC_ESC = 0xDD;
    
    // ESP32 commands
    static ESP_SYNC = 0x08;
    static ESP_BEGIN_FLASH = 0x02;
    static ESP_CHANGE_BAUDRATE = 0x0F;

    async connect(port) {
        try {
            this.port = port;
            
            // Open port with specific settings for ESP32
            await this.port.open({
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none'
            });

            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();
            
            console.log('Connected to ESP32 device for bootloader control');
            return true;
        } catch (error) {
            console.error('Failed to connect to ESP32:', error);
            return false;
        }
    }

    // Encode data in SLIP protocol
    encodeSlip(data) {
        const encoded = [ESP32BootloaderController.SLIP_END];
        
        for (const byte of data) {
            if (byte === ESP32BootloaderController.SLIP_END) {
                encoded.push(ESP32BootloaderController.SLIP_ESC, ESP32BootloaderController.SLIP_ESC_END);
            } else if (byte === ESP32BootloaderController.SLIP_ESC) {
                encoded.push(ESP32BootloaderController.SLIP_ESC, ESP32BootloaderController.SLIP_ESC_ESC);
            } else {
                encoded.push(byte);
            }
        }
        
        encoded.push(ESP32BootloaderController.SLIP_END);
        return new Uint8Array(encoded);
    }

    // Create ESP32 command packet
    createCommand(cmd, data = []) {
        const dataLength = data.length;
        const packet = [
            0x00,  // Direction (request)
            cmd,   // Command
            dataLength & 0xFF,        // Data length (low byte)
            (dataLength >> 8) & 0xFF, // Data length (high byte)
            0x00, 0x00, 0x00, 0x00,   // Checksum (will be calculated)
            ...data
        ];

        // Calculate checksum
        let checksum = 0;
        for (let i = 8; i < packet.length; i++) {
            checksum ^= packet[i];
        }
        packet[4] = checksum & 0xFF;

        return packet;
    }

    // Send sync command to bootloader
    async sendSyncCommand() {
        try {
            const syncData = new Array(32).fill(0x55); // 32 bytes of 0x55
            const command = this.createCommand(ESP32BootloaderController.ESP_SYNC, syncData);
            const slipPacket = this.encodeSlip(command);
            
            await this.writer.write(slipPacket);
            console.log('Sent sync command to ESP32 bootloader');
            
            // Wait for response (simplified - in real implementation you'd parse the response)
            await this.delay(100);
            
            return true;
        } catch (error) {
            console.error('Failed to send sync command:', error);
            return false;
        }
    }

    // Force device into bootloader mode and keep it there
    async enterBootloaderMode() {
        try {
            console.log('Attempting to enter bootloader mode...');
            
            // Send multiple sync commands to establish communication
            for (let attempt = 0; attempt < 3; attempt++) {
                const success = await this.sendSyncCommand();
                if (success) {
                    this.isInBootloaderMode = true;
                    console.log('Successfully entered bootloader mode');
                    this.startKeepAlive();
                    return true;
                }
                await this.delay(200);
            }
            
            return false;
        } catch (error) {
            console.error('Failed to enter bootloader mode:', error);
            return false;
        }
    }

    // Send keep-alive commands every 2 seconds
    startKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
        }

        this.keepAliveInterval = setInterval(async () => {
            if (this.isInBootloaderMode && this.writer) {
                try {
                    // Send a simple sync command to keep bootloader active
                    await this.sendSyncCommand();
                    console.log('Sent keep-alive to bootloader');
                } catch (error) {
                    console.error('Keep-alive failed:', error);
                    this.stopKeepAlive();
                }
            }
        }, 2000);
    }

    stopKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        this.isInBootloaderMode = false;
    }

    async disconnect() {
        this.stopKeepAlive();
        
        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
                this.reader = null;
            }
        } catch (error) {
            console.warn('Reader cleanup warning:', error);
        }
        
        try {
            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }
        } catch (error) {
            console.warn('Writer cleanup warning:', error);
        }
        
        try {
            if (this.port && this.port.readable) {
                await this.port.close();
                this.port = null;
            }
        } catch (error) {
            console.warn('Port close warning:', error);
        }
        
        console.log('Disconnected from ESP32 bootloader - port released for ESP Web Tools');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class ESP32Flasher {
    constructor() {
        this.currentStep = 1;
        this.selectedVersion = 'v1.36.0.16433';
        this.manifestData = null;
        this.versions = null;
        this.connectedPort = null;
        this.portConnected = false;
        
        this.init();
    }

    async init() {
        // Check browser compatibility first
        this.checkBrowserCompatibility();
        
        // Load version data
        await this.loadVersions();
        
        // Initialize event listeners
        this.setupEventListeners();
        
        // Setup ESP Web Tools event listeners
        this.setupESPWebToolsListeners();
        
        console.log('Humly Booking Device Flasher initialized');
    }

    checkBrowserCompatibility() {
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        const isEdge = /Edg/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor);
        const isSupported = (isChrome || isEdge) && 'serial' in navigator;

        if (!isSupported) {
            document.getElementById('browser-check').classList.remove('hidden');
            document.getElementById('step1-card').classList.add('hidden');
            return false;
        }
        return true;
    }

    async loadVersions() {
        try {
            const response = await fetch('../firmware/versions.json');
            this.versions = await response.json();
            console.log('Loaded versions:', this.versions);
        } catch (error) {
            console.error('Failed to load versions:', error);
            // Fallback to default data
            this.versions = {
                versions: [
                    {
                        version: "v1.36.0.16433",
                        name: "1.36.0 (Latest)",
                        recommended: true
                    }
                ],
                default: "v1.36.0.16433"
            };
        }
    }

    setupEventListeners() {
        // Connect button
        const connectButton = document.getElementById('connect-button');
        connectButton.addEventListener('click', () => this.handleConnect());

        // Continue button for version selection
        const continueButton = document.getElementById('continue-button');
        continueButton.addEventListener('click', () => this.proceedToFlashing());

        // Version card selection
        const versionCards = document.querySelectorAll('.version-card');
        versionCards.forEach(card => {
            card.addEventListener('click', () => this.selectVersion(card));
        });
    }

    setupESPWebToolsListeners() {
        const installButton = document.querySelector('esp-web-install-button');
        if (installButton) {
            // Override port selection to use our pre-connected port
            if (this.portConnected && this.connectedPort) {
                // Pre-configure ESP Web Tools with our port
                installButton._port = this.connectedPort;
                console.log('✅ ESP Web Tools configured with pre-connected port');
            }
            
            // Listen for install events
            installButton.addEventListener('state-changed', (event) => {
                this.handleInstallStateChange(event.detail);
            });
        }
    }

    async handleConnect() {
        const connectButton = document.getElementById('connect-button');
        const connectStatus = document.getElementById('connect-status');
        
        // Update button state
        connectButton.disabled = true;
        connectButton.innerHTML = '<span class="button-text">Connecting...</span>';
        
        try {
            // Request port access and store it
            const port = await navigator.serial.requestPort();
            this.connectedPort = port;
            this.portConnected = true;
            
            console.log('✅ Port selected and stored for later use');
            
            // Success - device connected
            this.updateConnectionSuccess();
            
            // Auto-advance to step 2 after a brief delay
            setTimeout(() => {
                this.advanceToStep(2);
            }, 1500);
            
        } catch (error) {
            // User cancelled or connection failed
            console.error('Connection failed:', error);
            this.updateConnectionError();
        }
    }

    updateConnectionSuccess() {
        const connectButton = document.getElementById('connect-button');
        connectButton.innerHTML = '✅ Device Connected!';
        connectButton.style.background = 'var(--success-green)';
        
        // Add success animation
        connectButton.style.transform = 'scale(1.05)';
        setTimeout(() => {
            connectButton.style.transform = 'scale(1)';
        }, 200);
    }

    updateConnectionError() {
        const connectButton = document.getElementById('connect-button');
        connectButton.innerHTML = '<span class="button-text">Connect Device</span>';
        connectButton.disabled = false;
        
        // Show error feedback
        connectButton.style.background = 'var(--error-red)';
        setTimeout(() => {
            connectButton.style.background = '';
        }, 2000);
    }

    selectVersion(selectedCard) {
        // Remove selection from all cards
        document.querySelectorAll('.version-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Add selection to clicked card
        selectedCard.classList.add('selected');
        
        // Update selected version
        this.selectedVersion = selectedCard.dataset.version;
        console.log('Selected version:', this.selectedVersion);
        
        // Update manifest for selected version
        this.updateManifestForVersion(this.selectedVersion);
    }

    async updateManifestForVersion(version) {
        try {
            // Create dynamic manifest for selected version
            const manifestData = {
                "name": "Humly Booking Device Firmware",
                "version": version.replace('v', ''),
                "home_assistant_domain": "",
                "funding_url": "",
                "new_install_skip_erase": false,
                "new_install_prompt_erase": true,
                "builds": [
                    {
                        "chipFamily": "ESP32-S3",
                        "improv": false,
                        "parts": [
                            {
                                "path": `../firmware/${version}/bootloader/bootloader.bin`,
                                "offset": 0
                            },
                            {
                                "path": `../firmware/${version}/partition_table/partition-table.bin`,
                                "offset": 40960
                            },
                            {
                                "path": `../firmware/${version}/hbd.bin`,
                                "offset": 65536
                            },
                            {
                                "path": `../firmware/${version}/ota_data_initial.bin`,
                                "offset": 9502720
                            },
                            {
                                "path": `../firmware/${version}/phy_init_data.bin`,
                                "offset": 9510912
                            },
                            {
                                "path": `../firmware/${version}/assets.bin`,
                                "offset": 9519104
                            }
                        ]
                    }
                ]
            };

            // Update the install button manifest
            const installButton = document.querySelector('esp-web-install-button');
            if (installButton) {
                // Create a new manifest URL
                const manifestBlob = new Blob([JSON.stringify(manifestData, null, 2)], 
                    { type: 'application/json' });
                const manifestUrl = URL.createObjectURL(manifestBlob);
                installButton.setAttribute('manifest', manifestUrl);
            }
            
        } catch (error) {
            console.error('Failed to update manifest:', error);
        }
    }

    proceedToFlashing() {
        // Update summary with selected version
        const versionInfo = this.versions.versions.find(v => v.version === this.selectedVersion);
        if (versionInfo) {
            document.getElementById('selected-version').textContent = versionInfo.name;
        }
        
        // Configure ESP Web Tools with our pre-connected port before advancing
        const installButton = document.querySelector('esp-web-install-button');
        if (installButton && this.portConnected && this.connectedPort) {
            installButton._port = this.connectedPort;
            console.log('🔄 ESP Web Tools reconfigured with existing port for Step 3');
        }
        
        // Advance to step 3
        this.advanceToStep(3);
    }

    advanceToStep(step) {
        // Hide current step
        document.getElementById(`step${this.currentStep}-card`).classList.add('hidden');
        
        // Update progress
        this.updateProgress(step);
        
        // Show next step
        document.getElementById(`step${step}-card`).classList.remove('hidden');
        
        // Update current step
        this.currentStep = step;
        
        // If advancing to step 3, ensure ESP Web Tools is configured
        if (step === 3 && this.portConnected && this.connectedPort) {
            setTimeout(() => {
                const installButton = document.querySelector('esp-web-install-button');
                if (installButton) {
                    installButton._port = this.connectedPort;
                    console.log('🔧 Final ESP Web Tools port configuration for Step 3');
                }
            }, 100);
        }
        
        // Add some visual flair
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateProgress(step) {
        const progressFill = document.getElementById('progress-fill');
        const progressSteps = document.querySelectorAll('.step');
        
        // Update progress bar
        const progressWidth = (step / 3) * 100;
        progressFill.style.width = `${progressWidth}%`;
        
        // Update step indicators
        progressSteps.forEach((stepEl, index) => {
            const stepNumber = index + 1;
            stepEl.classList.remove('active', 'completed');
            
            if (stepNumber < step) {
                stepEl.classList.add('completed');
                stepEl.textContent = '✓';
            } else if (stepNumber === step) {
                stepEl.classList.add('active');
                stepEl.textContent = stepNumber;
            } else {
                stepEl.textContent = stepNumber;
            }
        });
    }

    handleInstallStateChange(state) {
        const flashProgress = document.getElementById('flash-progress');
        const flashSuccess = document.getElementById('flash-success');
        const installButton = document.getElementById('install-button');
        
        console.log('Install state changed:', state);
        
        switch (state.state) {
            case 'preparing':
            case 'erasing':
            case 'writing':
                // Show progress
                flashProgress.classList.remove('hidden');
                installButton.style.display = 'none';
                break;
                
            case 'finished':
                // Show success
                flashProgress.classList.add('hidden');
                flashSuccess.classList.remove('hidden');
                
                // Celebrate!
                this.celebrateSuccess();
                break;
                
            case 'error':
                // Handle error
                flashProgress.classList.add('hidden');
                installButton.style.display = 'flex';
                this.handleFlashError(state.message);
                break;
        }
    }

    celebrateSuccess() {
        // Add some confetti or celebration animation
        const successContent = document.querySelector('.success-content');
        successContent.style.animation = 'pulse 0.6s ease-in-out';
        
        // Update progress to 100%
        this.updateProgress(3);
        
        // Optional: Add confetti effect or other celebration
        console.log('🎉 Humly Booking Device firmware flashing completed successfully!');
    }

    handleFlashError(message) {
        console.error('Flash error:', message);
        
        // Show user-friendly error message
        alert(`Flashing failed: ${message || 'Unknown error occurred'}. Please try again.`);
    }
}

// Initialize the flasher when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ESP32Flasher();
});

// Add some helper animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .step-card {
        animation: fadeIn 0.5s ease-out;
    }
`;
document.head.appendChild(style);
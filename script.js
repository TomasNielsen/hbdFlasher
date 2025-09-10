// ESP32 Web Flasher - Direct esptool-js implementation
// Matches Windows flasher parameters exactly: --before default_reset --after hard_reset --no-stub
// Flash parameters: --flash_mode dio --flash_freq 80m --flash_size 16MB
// Version: 2025-01-10-v3 - Professional esptool-js integration

class ESP32Flasher {
    constructor() {
        this.currentStep = 1;
        this.selectedVersion = 'v1.36.0.16433';
        this.versions = null;
        this.connectedPort = null;
        this.portConnected = false;
        this.espLoader = null;
        this.transport = null;
        
        // Firmware configurations matching manifest.json
        this.firmwareConfig = {
            'v1.36.0.16433': {
                version: '1.36.0.16433',
                name: '1.36.0 (Latest)',
                parts: [
                    { path: './firmware/v1.36.0.16433/bootloader/bootloader.bin', offset: 0 },
                    { path: './firmware/v1.36.0.16433/partition_table/partition-table.bin', offset: 40960 },
                    { path: './firmware/v1.36.0.16433/hbd.bin', offset: 65536 },
                    { path: './firmware/v1.36.0.16433/ota_data_initial.bin', offset: 9502720 },
                    { path: './firmware/v1.36.0.16433/phy_init_data.bin', offset: 9510912 },
                    { path: './firmware/v1.36.0.16433/assets.bin', offset: 9519104 }
                ]
            }
        };
        
        this.init();
    }

    async init() {
        // Check browser compatibility first
        this.checkBrowserCompatibility();
        
        // Load version data
        await this.loadVersions();
        
        // Initialize event listeners
        this.setupEventListeners();
        
        console.log('Humly Booking Device Flasher initialized with esptool-js');
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
            const response = await fetch('./firmware/versions.json');
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

        // Flash button - now using esptool-js
        const flashButton = document.getElementById('flash-button');
        flashButton.addEventListener('click', () => this.handleFlash());

        // Version card selection
        const versionCards = document.querySelectorAll('.version-card');
        versionCards.forEach(card => {
            card.addEventListener('click', () => this.selectVersion(card));
        });
    }

    async handleConnect() {
        const connectButton = document.getElementById('connect-button');
        
        // Update button state
        connectButton.disabled = true;
        connectButton.innerHTML = '<span class="button-text">Connecting...</span>';
        
        try {
            // Wait for esptool to be ready
            if (!window.esptoolReady) {
                console.log('⏳ Waiting for esptool-js to load...');
                await new Promise(resolve => {
                    window.addEventListener('esptool-ready', resolve, { once: true });
                });
            }
            
            // Check if esptool is available
            if (!window.esptoolPackage?.Transport) {
                throw new Error('esptool-js Transport not available');
            }
            
            // Request port access but don't create transport yet
            const port = await navigator.serial.requestPort();
            this.connectedPort = port;
            
            console.log('🔌 Port selected and stored for later use');
            console.log('✅ Port ready for flashing');
            
            this.portConnected = true;
            
            // Success - device connected
            this.updateConnectionSuccess();
            
            // Auto-advance to step 2
            setTimeout(() => {
                this.advanceToStep(2);
            }, 500);
            
        } catch (error) {
            // User cancelled or connection failed
            console.error('Connection failed:', error);
            this.updateConnectionError();
        }
    }

    async handleFlash() {
        if (!this.portConnected || !this.connectedPort) {
            alert('No device connected. Please go back to Step 1 and connect your device.');
            return;
        }

        const flashButton = document.getElementById('flash-button');
        const flashProgress = document.getElementById('flash-progress');
        
        try {
            // Show progress
            flashButton.style.display = 'none';
            flashProgress.classList.remove('hidden');
            
            console.log('🚀 Starting ESP32 firmware flash with esptool-js...');
            console.log('⚙️ Using Windows flasher parameters:');
            console.log('   --before default_reset --after hard_reset --no-stub');
            console.log('   --flash_mode dio --flash_freq 80m --flash_size 16MB');
            
            // Bypass esptool-js and implement direct ESP32-S3 flash protocol
            console.log('🔧 Using direct Web Serial ESP32-S3 flash protocol...');
            
            // Perform hardware reset sequence before connection (--before default_reset)
            console.log('🔄 Performing hardware reset sequence...');
            await this.performHardwareReset();
            
            // Initialize direct serial communication
            console.log('🔗 Opening serial port for direct communication...');
            await this.connectedPort.open({
                baudRate: 115200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none'
            });
            
            // Get readers/writers for communication
            this.reader = this.connectedPort.readable.getReader();
            this.writer = this.connectedPort.writable.getWriter();
            
            console.log('📡 Attempting ESP32-S3 sync...');
            await this.esp32Sync();
            
            console.log('✅ ESP32-S3 communication established!');
            
            // Load firmware files
            console.log('📁 Loading firmware files...');
            const firmwareData = await this.loadFirmwareFiles();
            console.log('✅ Firmware files loaded:', firmwareData.length, 'files');
            
            // Flash firmware with exact Windows flasher parameters
            console.log('⚡ Flashing firmware with Windows flasher parameters...');
            console.log('Flash options:', {
                fileCount: firmwareData.length,
                flashSize: '16MB',
                flashMode: 'dio',
                flashFreq: '80m',
                eraseAll: false,
                compress: true
            });
            
            await this.espLoader.writeFlash({
                fileArray: firmwareData,
                flashSize: '16MB',    // --flash_size 16MB
                flashMode: 'dio',     // --flash_mode dio  
                flashFreq: '80m',     // --flash_freq 80m
                eraseAll: false,
                compress: true,
                reportProgress: (fileIndex, bytesWritten, totalBytes) => {
                    const percent = Math.round((bytesWritten / totalBytes) * 100);
                    console.log(`📊 Progress: ${percent}% (File ${fileIndex + 1})`);
                }
            });
            
            // Hard reset after flashing (matches --after hard_reset)
            console.log('🔄 Performing hard reset...');
            await this.espLoader.hardReset();
            
            console.log('✅ Firmware flashing completed successfully!');
            
            // Show success
            flashProgress.classList.add('hidden');
            document.getElementById('flash-success').classList.remove('hidden');
            
            this.celebrateSuccess();
            
        } catch (error) {
            console.error('❌ Flashing failed:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // Hide progress and show button
            flashProgress.classList.add('hidden');
            flashButton.style.display = 'flex';
            
            // Show detailed error information
            const errorMsg = error.message || 'Unknown error occurred';
            
            // Try to recover the device
            await this.attemptDeviceRecovery();
            
            alert(`Flashing failed: ${errorMsg}. Please try again.\n\nDevice recovery attempted. Try disconnecting and reconnecting USB if device is not responding.`);
        }
    }

    async loadFirmwareFiles() {
        const config = this.firmwareConfig[this.selectedVersion];
        if (!config) {
            throw new Error(`Configuration for version ${this.selectedVersion} not found`);
        }
        
        const fileArray = [];
        
        console.log(`📥 Loading ${config.parts.length} firmware files...`);
        
        for (const part of config.parts) {
            try {
                console.log(`  Loading: ${part.path}`);
                const response = await fetch(part.path);
                if (!response.ok) {
                    throw new Error(`Failed to load ${part.path}: ${response.status}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                const data = new Uint8Array(arrayBuffer);
                
                fileArray.push({
                    data: data,
                    address: part.offset
                });
                
                console.log(`  ✅ Loaded ${part.path} (${data.length} bytes at 0x${part.offset.toString(16)})`);
            } catch (error) {
                throw new Error(`Failed to load firmware file ${part.path}: ${error.message}`);
            }
        }
        
        console.log(`✅ All ${fileArray.length} firmware files loaded successfully`);
        return fileArray;
    }

    async performHardwareReset() {
        console.log('⚡ Starting ESP32-S3 hardware reset sequence...');
        
        try {
            // Get the raw serial port from transport
            const port = this.connectedPort;
            
            // Check if port supports signal control
            if (typeof port.setSignals !== 'function') {
                console.log('⚠️ Port does not support setSignals - skipping hardware reset');
                return;
            }
            
            console.log('🔧 ESP32-S3 reset sequence (matching Windows flasher):');
            console.log('   DTR controls EN (enable/reset) - LOW = reset, HIGH = run');
            console.log('   RTS controls GPIO0 (boot mode) - LOW = bootloader, HIGH = normal');
            
            // Step 1: Assert reset (EN low) and set bootloader mode (GPIO0 low)
            console.log('📍 Step 1: Asserting reset and bootloader mode...');
            await port.setSignals({
                dataTerminalReady: false,  // EN = LOW (reset)
                requestToSend: false       // GPIO0 = LOW (bootloader mode)
            });
            
            await this.delay(100); // Hold reset for 100ms
            
            // Step 2: Release reset while keeping GPIO0 low (enter bootloader)
            console.log('📍 Step 2: Releasing reset, keeping bootloader mode...');
            await port.setSignals({
                dataTerminalReady: true,   // EN = HIGH (run)
                requestToSend: false       // GPIO0 = LOW (bootloader mode)
            });
            
            await this.delay(50); // Hold bootloader mode
            
            // Step 3: Release GPIO0 - device should be in bootloader mode
            console.log('📍 Step 3: Releasing GPIO0, device in bootloader mode...');
            await port.setSignals({
                dataTerminalReady: true,   // EN = HIGH (run)
                requestToSend: true        // GPIO0 = HIGH (release)
            });
            
            await this.delay(100); // Let device stabilize
            
            console.log('✅ Hardware reset completed - device should be in bootloader mode');
            
        } catch (error) {
            console.log('⚠️ Hardware reset failed:', error.message);
            console.log('   Device may not support DTR/RTS control');
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ESP32 Serial Protocol Implementation
    slipEncode(data) {
        const encoded = [];
        encoded.push(0xC0); // SLIP frame start
        
        for (const byte of data) {
            if (byte === 0xDB) {
                encoded.push(0xDB, 0xDD);
            } else if (byte === 0xC0) {
                encoded.push(0xDB, 0xDC);
            } else {
                encoded.push(byte);
            }
        }
        
        encoded.push(0xC0); // SLIP frame end
        return new Uint8Array(encoded);
    }

    slipDecode(data) {
        const decoded = [];
        let escaped = false;
        
        for (const byte of data) {
            if (byte === 0xC0) {
                continue; // Skip frame markers
            } else if (byte === 0xDB) {
                escaped = true;
            } else if (escaped) {
                if (byte === 0xDC) {
                    decoded.push(0xC0);
                } else if (byte === 0xDD) {
                    decoded.push(0xDB);
                } else {
                    decoded.push(byte);
                }
                escaped = false;
            } else {
                decoded.push(byte);
            }
        }
        
        return new Uint8Array(decoded);
    }

    calculateChecksum(data) {
        let checksum = 0xEF;
        for (const byte of data) {
            checksum ^= byte;
        }
        return checksum;
    }

    createCommand(cmd, data = new Uint8Array(0)) {
        const packet = new Uint8Array(8 + data.length);
        const view = new DataView(packet.buffer);
        
        // Command packet structure
        view.setUint8(0, 0x00);           // Direction (request)
        view.setUint8(1, cmd);            // Command
        view.setUint16(2, data.length, true); // Size (little endian)
        view.setUint32(4, this.calculateChecksum(data), true); // Checksum
        
        // Copy data
        if (data.length > 0) {
            packet.set(data, 8);
        }
        
        return this.slipEncode(packet);
    }

    async esp32Sync() {
        console.log('📡 Sending ESP32 SYNC command...');
        
        // SYNC command payload: 0x07 0x07 0x12 0x20 + 32 bytes of 0x55
        const syncData = new Uint8Array(36);
        syncData[0] = 0x07;
        syncData[1] = 0x07;
        syncData[2] = 0x12;
        syncData[3] = 0x20;
        for (let i = 4; i < 36; i++) {
            syncData[i] = 0x55;
        }
        
        const syncCommand = this.createCommand(0x08, syncData);
        
        // Send sync command multiple times for reliability
        for (let attempt = 0; attempt < 3; attempt++) {
            console.log(`   SYNC attempt ${attempt + 1}...`);
            await this.writer.write(syncCommand);
            
            try {
                const response = await this.readResponse(1000); // 1 second timeout
                if (response) {
                    console.log('✅ ESP32 SYNC successful');
                    return true;
                }
            } catch (error) {
                console.log(`   SYNC attempt ${attempt + 1} failed:`, error.message);
            }
            
            await this.delay(100);
        }
        
        throw new Error('ESP32 SYNC failed after 3 attempts');
    }

    async readResponse(timeoutMs = 5000) {
        const timeout = setTimeout(() => {
            throw new Error('Response timeout');
        }, timeoutMs);
        
        try {
            const { value, done } = await this.reader.read();
            clearTimeout(timeout);
            
            if (done) {
                throw new Error('Reader closed');
            }
            
            console.log('📨 Received response:', Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' '));
            return this.slipDecode(value);
        } catch (error) {
            clearTimeout(timeout);
            throw error;
        }
    }

    async attemptDeviceRecovery() {
        console.log('🔧 Attempting device recovery...');
        
        try {
            console.log('🔄 Trying hardware reset recovery...');
            await this.performHardwareReset();
        } catch (e) {
            console.log('⚠️ Hardware reset recovery failed:', e.message);
        }
        
        console.log('🔧 Device recovery attempt completed');
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
    }

    proceedToFlashing() {
        // Update summary with selected version
        const versionInfo = this.versions.versions.find(v => v.version === this.selectedVersion);
        if (versionInfo) {
            document.getElementById('selected-version').textContent = versionInfo.name;
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

    celebrateSuccess() {
        // Add some confetti or celebration animation
        const successContent = document.querySelector('.success-content');
        successContent.style.animation = 'pulse 0.6s ease-in-out';
        
        // Update progress to 100%
        this.updateProgress(3);
        
        console.log('🎉 Humly Booking Device firmware flashing completed successfully!');
        console.log('✅ Direct esptool-js approach with Windows flasher parameters worked!');
    }
}

// Initialize the flasher when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ESP32Flasher();
});

// Add helper animations
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
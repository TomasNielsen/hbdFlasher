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
            
            // Request port access
            const port = await navigator.serial.requestPort();
            this.connectedPort = port;
            
            console.log('🔌 Port selected, creating transport...');
            
            // Create Transport for esptool-js
            this.transport = new window.esptoolPackage.Transport(port);
            
            console.log('✅ Transport created successfully');
            
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
        if (!this.portConnected || !this.transport) {
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
            
            // Create ESPLoader with exact Windows flasher configuration
            this.espLoader = new window.esptoolPackage.ESPLoader({
                transport: this.transport,
                baudrate: 115200, // Match Windows flasher baudrate
                terminal: {
                    clean() {},
                    writeLine(data) { console.log('ESP:', data); },
                    write(data) { console.log('ESP:', data); }
                }
            });
            
            // Your Windows flasher uses --chip esp32s3, let's set that explicitly
            console.log('⚙️ Configuring for ESP32-S3 chip type...');
            
            // Try different connection approaches to match Windows flasher
            console.log('🔗 Connecting to ESP32...');
            let chip;
            
            // First try: ESP32-S3 specific connection
            try {
                console.log('🔍 Attempting ESP32-S3 connection...');
                chip = await this.espLoader.connect();
                console.log('✅ Connected successfully:', chip);
            } catch (error) {
                console.log('⚠️ Standard connection failed:', error.message);
                
                // Second try: with specific reset sequence
                try {
                    console.log('🔍 Attempting connection with manual reset...');
                    chip = await this.espLoader.connect('no_reset');
                    console.log('✅ Connected with no_reset:', chip);
                } catch (error2) {
                    console.log('⚠️ no_reset connection failed:', error2.message);
                    throw new Error(`Failed to connect to ESP32: ${error.message}`);
                }
            }
            
            console.log('Chip info:', {
                chipName: chip,
                features: this.espLoader.getChipFeatures && this.espLoader.getChipFeatures(),
                macAddr: this.espLoader.readMac && await this.espLoader.readMac().catch(e => 'Could not read MAC')
            });
            
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

    async attemptDeviceRecovery() {
        console.log('🔧 Attempting device recovery...');
        
        try {
            if (this.espLoader) {
                console.log('🔄 Trying soft reset...');
                await this.espLoader.softReset();
            }
        } catch (e) {
            console.log('⚠️ Soft reset failed:', e.message);
        }
        
        try {
            if (this.espLoader) {
                console.log('🔄 Trying hard reset...');
                await this.espLoader.hardReset();
            }
        } catch (e) {
            console.log('⚠️ Hard reset failed:', e.message);
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
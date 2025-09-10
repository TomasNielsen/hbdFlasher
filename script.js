// ESP32 Web Flasher - Smart UX with Hardware Reset Control
// Handles step progression, browser compatibility, and ESP32 bootloader timing
// Version: 2025-01-10 with proper DTR/RTS hardware reset implementation

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

        // Setup ESP Web Tools event listeners
        this.setupESPWebToolsListeners();

        // Quick flash button - now uses hardware reset instead of workarounds
        const quickFlashButton = document.getElementById('quick-flash-button');
        quickFlashButton.addEventListener('click', () => this.handleQuickFlash());

        // Version card selection
        const versionCards = document.querySelectorAll('.version-card');
        versionCards.forEach(card => {
            card.addEventListener('click', () => this.selectVersion(card));
        });
    }

    setupESPWebToolsListeners() {
        const installButton = document.querySelector('esp-web-install-button');
        if (installButton) {
            console.log('🎯 Setting up ESP Web Tools listeners...');
            
            // Listen for install events with better debugging
            installButton.addEventListener('state-changed', (event) => {
                console.log('📡 ESP Web Tools state-changed event:', event.detail);
                this.handleInstallStateChange(event.detail);
            });

            // Listen for multiple ESP Web Tools events
            const events = ['install-started', 'install-finished', 'install-failed', 'connect'];
            events.forEach(eventName => {
                installButton.addEventListener(eventName, (event) => {
                    console.log(`📡 ESP Web Tools ${eventName} event:`, event.detail);
                    if (eventName === 'install-started' || eventName === 'connect') {
                        console.log('🎯 ESP Web Tools starting - triggering hardware reset!');
                        this.performHardwareReset();
                    }
                });
            });

            // Monitor ESP Web Tools lifecycle events
            this.monitorESPWebToolsEvents(installButton);
        } else {
            console.warn('⚠️ esp-web-install-button not found');
        }
    }

    // Monitor ESP Web Tools for the perfect moment to trigger hardware reset
    monitorESPWebToolsEvents(installButton) {
        console.log('🔍 Setting up ESP Web Tools monitoring...');

        // Hook into the ESP Web Tools button click directly
        const activateButton = installButton.querySelector('button[slot="activate"]');
        if (activateButton) {
            const originalClick = activateButton.click.bind(activateButton);
            activateButton.click = () => {
                console.log('🎯 ESP Web Tools button clicked - triggering hardware reset first!');
                this.performHardwareReset().then(() => {
                    // Small delay to ensure reset completes before ESP Web Tools starts
                    setTimeout(() => originalClick(), 200);
                });
            };
            console.log('✅ Hooked into ESP Web Tools button click');
        }

        // Monitor for when ESP Web Tools creates dialogs
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.checkForFlashingTrigger(node);
                        }
                    });
                }
            });
        });

        // Start observing the document for ESP Web Tools dialog creation
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });

        // Store observer for cleanup
        this.espToolsObserver = observer;
    }

    // Check if ESP Web Tools is about to start flashing
    checkForFlashingTrigger(element) {
        // Look for ESP Web Tools dialogs or progress indicators
        if (element.tagName && element.tagName.includes('DIALOG') ||
            element.classList && element.classList.contains('dialog') ||
            element.textContent && element.textContent.includes('Installing')) {
            
            console.log('🎯 ESP Web Tools dialog detected - preparing for hardware reset timing');
            this.prepareForHardwareReset();
        }
    }

    // Prepare for hardware reset when ESP Web Tools is about to flash
    async prepareForHardwareReset() {
        if (!this.connectedPort || !this.portConnected) {
            console.warn('⚠️ No connected port available for hardware reset');
            return;
        }

        console.log('🔧 Preparing hardware reset sequence for bootloader mode...');
        
        // Set up hardware reset trigger for when ESP Web Tools actually connects
        this.setupHardwareResetTrigger();
    }

    // Hardware reset control using DTR/RTS signals
    async performHardwareReset() {
        if (!this.connectedPort) {
            console.error('❌ No port available for hardware reset');
            return false;
        }

        try {
            console.log('⚡ Starting ESP32 hardware reset sequence...');
            
            // Check if setSignals is available
            if (typeof this.connectedPort.setSignals !== 'function') {
                console.error('❌ SerialPort.setSignals() not supported by this browser/port');
                return false;
            }

            // Get current signal state for debugging
            const currentSignals = await this.connectedPort.getSignals();
            console.log('📊 Current port signals:', currentSignals);

            console.log('🔧 ESP32 hardware reset sequence:');
            console.log('   DTR controls EN (enable/reset) - LOW = reset, HIGH = run');
            console.log('   RTS controls GPIO0 (boot mode) - LOW = bootloader, HIGH = normal boot');
            
            // Step 1: Assert reset (EN low) and set bootloader mode (GPIO0 low)
            console.log('📍 Step 1: Asserting reset and bootloader mode...');
            await this.connectedPort.setSignals({
                dataTerminalReady: false,  // EN = LOW (reset)
                requestToSend: false       // GPIO0 = LOW (bootloader mode)
            });
            
            // Hold reset for 100ms
            console.log('⏱️ Holding reset for 100ms...');
            await this.delay(100);
            
            // Step 2: Release reset while keeping GPIO0 low (bootloader mode)
            console.log('📍 Step 2: Releasing reset, keeping bootloader mode...');
            await this.connectedPort.setSignals({
                dataTerminalReady: true,   // EN = HIGH (run)
                requestToSend: false       // GPIO0 = LOW (bootloader mode)
            });
            
            // Hold bootloader mode for 50ms
            console.log('⏱️ Holding bootloader mode for 50ms...');
            await this.delay(50);
            
            // Step 3: Release GPIO0 - device should now be in bootloader mode
            console.log('📍 Step 3: Releasing GPIO0, device should be in bootloader mode...');
            await this.connectedPort.setSignals({
                dataTerminalReady: true,   // EN = HIGH (run)
                requestToSend: true        // GPIO0 = HIGH (release)
            });

            // Check final signal state
            const finalSignals = await this.connectedPort.getSignals();
            console.log('📊 Final port signals:', finalSignals);

            console.log('✅ Hardware reset sequence completed - ESP32 should be in bootloader mode');
            console.log('🎯 Device is now ready for ESP Web Tools flashing');
            return true;

        } catch (error) {
            console.error('❌ Hardware reset failed:', error);
            console.error('💡 Possible causes:');
            console.error('   - SerialPort.setSignals() not supported');
            console.error('   - Port not connected properly');
            console.error('   - Hardware doesn\'t support DTR/RTS control');
            return false;
        }
    }

    // Legacy method - now handled by button click hook
    setupHardwareResetTrigger() {
        console.log('⚠️ Legacy setupHardwareResetTrigger - hardware reset is now handled by button click hook');
    }

    // Utility function for delays
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Override navigator.serial.requestPort to return our existing port
    setupPortInterception() {
        if (this.portConnected && this.connectedPort) {
            // Store the original requestPort function
            const originalRequestPort = navigator.serial.requestPort.bind(navigator.serial);
            
            // Simple port reuse without workarounds
            navigator.serial.requestPort = () => {
                console.log('🔄 Using existing port from Step 1');
                return Promise.resolve(this.connectedPort);
            };
            
            // Store original function for cleanup
            this.originalRequestPort = originalRequestPort;
        }
    }

    // Restore original port selection behavior
    restorePortSelection() {
        if (this.originalRequestPort) {
            navigator.serial.requestPort = this.originalRequestPort;
            console.log('🔄 Restored original port selection behavior');
            this.originalRequestPort = null;
        }
    }

    // Handle quick flash with hardware reset control
    async handleQuickFlash() {
        if (!this.portConnected || !this.connectedPort) {
            alert('No device connected. Please go back to Step 1 and connect your device.');
            return;
        }

        try {
            console.log('⚡ Starting Quick Flash with hardware reset control...');
            
            // Test SerialPort.setSignals() capability first
            const resetCapable = await this.testHardwareResetCapability();
            if (!resetCapable) {
                console.warn('⚠️ Hardware reset not supported, trying ESP Web Tools anyway...');
            }
            
            // Click the ESP Web Tools button to start the process
            const installButton = document.querySelector('esp-web-install-button');
            const activateButton = installButton.querySelector('button[slot="activate"]');
            
            if (activateButton) {
                console.log('🚀 Clicking ESP Web Tools button (hardware reset is hooked in)...');
                activateButton.click();
            }
            
        } catch (error) {
            console.error('❌ Quick Flash failed:', error);
            alert(`Quick Flash failed: ${error.message}. Try the manual flash button instead.`);
        }
    }

    // Test if hardware reset is supported
    async testHardwareResetCapability() {
        if (!this.connectedPort) {
            console.log('❌ No port for hardware reset test');
            return false;
        }

        try {
            console.log('🧪 Testing SerialPort.setSignals() capability...');
            
            if (typeof this.connectedPort.setSignals !== 'function') {
                console.log('❌ SerialPort.setSignals() not available');
                return false;
            }

            if (typeof this.connectedPort.getSignals !== 'function') {
                console.log('❌ SerialPort.getSignals() not available');
                return false;
            }

            // Test getting current signals
            const signals = await this.connectedPort.getSignals();
            console.log('✅ SerialPort.getSignals() works:', signals);

            // Test setting signals (non-disruptive test)
            await this.connectedPort.setSignals({
                dataTerminalReady: signals.dataTerminalReady || true,
                requestToSend: signals.requestToSend || true
            });
            console.log('✅ SerialPort.setSignals() works');

            return true;
        } catch (error) {
            console.log('❌ Hardware reset capability test failed:', error);
            return false;
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
            
            // Test hardware reset capability immediately after connection
            setTimeout(async () => {
                const resetCapable = await this.testHardwareResetCapability();
                if (resetCapable) {
                    console.log('🎯 Hardware reset ready - ESP32 flashing should work perfectly!');
                } else {
                    console.warn('⚠️ Hardware reset not supported - may encounter timing issues');
                }
                
                // Auto-advance to step 2
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
                "new_install_skip_erase": true,
                "new_install_prompt_erase": false,
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
        
        // Setup port interception to avoid redundant port selection
        this.setupPortInterception();
        
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

    handleInstallStateChange(state) {
        const flashProgress = document.getElementById('flash-progress');
        const flashSuccess = document.getElementById('flash-success');
        const installButton = document.getElementById('install-button');
        
        console.log('📡 ESP Web Tools state changed:', state);
        
        switch (state.state) {
            case 'preparing':
            case 'erasing':
            case 'writing':
                // Show progress - hardware reset should have put device in bootloader mode
                flashProgress.classList.remove('hidden');
                installButton.style.display = 'none';
                console.log('📋 Flashing in progress - hardware reset worked!');
                break;
                
            case 'finished':
                // Show success
                flashProgress.classList.add('hidden');
                flashSuccess.classList.remove('hidden');
                
                // Restore original port selection function
                this.restorePortSelection();
                
                // Celebrate!
                this.celebrateSuccess();
                break;
                
            case 'error':
                // Handle error
                flashProgress.classList.add('hidden');
                installButton.style.display = 'flex';
                
                // Restore original port selection function
                this.restorePortSelection();
                
                this.handleFlashError(state.message);
                break;
        }
    }

    handleFlashError(message) {
        console.error('Flash error:', message);
        
        // Show user-friendly error message
        alert(`Flashing failed: ${message || 'Unknown error occurred'}. Please try again.`);
    }

    celebrateSuccess() {
        // Add some confetti or celebration animation
        const successContent = document.querySelector('.success-content');
        successContent.style.animation = 'pulse 0.6s ease-in-out';
        
        // Update progress to 100%
        this.updateProgress(3);
        
        // Clean up observers
        this.cleanupObservers();
        
        // Optional: Add confetti effect or other celebration
        console.log('🎉 Humly Booking Device firmware flashing completed successfully!');
        console.log('✅ Hardware reset approach eliminated timing issues!');
    }

    // Clean up observers and resources
    cleanupObservers() {
        if (this.espToolsObserver) {
            this.espToolsObserver.disconnect();
            this.espToolsObserver = null;
        }
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
# Humly Booking Device Web Flasher

A professional, browser-based firmware flashing tool for Humly Booking Devices inspired by Humly's clean design aesthetic.

## Features

- ✅ **Super Simple**: Just 3 steps - Connect, Select, Flash
- ✅ **Cross-Platform**: Works on Windows, Mac, Linux, Android
- ✅ **No Installation**: Runs entirely in Chrome/Edge browser
- ✅ **Multi-Version Support**: Choose between firmware versions
- ✅ **Professional UI**: Clean, Humly-inspired design
- ✅ **Smart UX**: Auto-progression and helpful guidance

## Browser Requirements

- **Supported**: Google Chrome, Microsoft Edge
- **Not Supported**: Safari, Firefox (no WebSerial API support)

## Quick Start

1. **Serve the files** over HTTPS (required for WebSerial API):
   ```bash
   # Using Python (simple local testing)
   python3 -m http.server 8000
   # Then visit: http://localhost:8000
   
   # For production: Deploy to GitHub Pages, Netlify, etc.
   ```

2. **Connect your Humly Booking Device** via USB-C

3. **Open the web flasher** in Chrome or Edge

4. **Follow the 3-step process**:
   - Step 1: Connect your device
   - Step 2: Select firmware version
   - Step 3: Flash firmware

## File Structure

```
web-flasher/
├── index.html              # Main web interface
├── style.css              # Humly-inspired styling
├── script.js              # Smart UX logic
├── manifest.json          # ESP Web Tools manifest (latest)
├── manifest-v1.35.1.json  # Alternative version manifest
└── README.md              # This file

../firmware/
├── v1.36.0.16433/         # Latest firmware version
├── v1.35.1.12304/         # Previous version
└── versions.json          # Version metadata
```

## Adding New Firmware Versions

1. Extract new firmware to `../firmware/vX.X.X/`
2. Update `../firmware/versions.json` with new version info
3. The web interface will automatically detect and offer the new version

## HTTPS Deployment

For production use, deploy to any HTTPS-enabled hosting service:

- **GitHub Pages**: Free, automatic HTTPS
- **Netlify**: Easy deployment with custom domains
- **Vercel**: Fast, global CDN
- **Your own server**: Just ensure HTTPS is enabled

## Technical Details

- Uses ESP Web Tools for device communication
- WebSerial API for browser-to-device flashing
- Supports ESP32-S3 with automatic chip detection
- Flash memory layout: Bootloader (0x0), Partitions (0xa000), App (0x10000), etc.

## Troubleshooting

**Device not detected?**
- Use a data USB cable (not power-only)
- Try different USB ports
- Check device drivers are installed
- Close other programs using the serial port

**Browser not supported error?**
- Use Chrome or Edge (latest versions)
- Safari and Firefox don't support WebSerial API
- Ensure you're accessing via HTTPS

**Secure Boot Device Issues?**
- ⚠️ **Web flasher cannot update secure boot devices** due to hardware security restrictions
- Use desktop tools instead: [esptool.py](https://github.com/espressif/esptool) or your C# flasher
- For network-capable devices, try OTA updates through the device's web interface
- See [SECURE_BOOT_LIMITATIONS.md](SECURE_BOOT_LIMITATIONS.md) for detailed technical explanation

## Device Compatibility

✅ **Fully Supported**: Development boards, non-secure boot ESP32-S3 devices  
⚠️ **Limited Support**: Secure boot enabled devices (use desktop tools instead)  
❌ **Not Supported**: ESP32 (original), ESP32-C3, other chip families

## Support

This tool flashes official HBD firmware for ESP32-S3 devices. For secure boot devices or hardware issues, use desktop flashing tools or contact your device supplier.
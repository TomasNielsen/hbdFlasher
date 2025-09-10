# ESP32 Web Flasher Development Workflow

## Our Working Approach

### Problem Solving Pattern
1. **Don't fight the tools** - If ESP Web Tools has limitations, replace it entirely
2. **Match the working solution** - Your Windows flasher proves what parameters work
3. **Be systematic** - Use TodoWrite to track progress and avoid losing work
4. **Clean as we go** - Remove test/experimental features to keep it professional

### Key Insights Learned
- ESP Web Tools uses generic "keep" parameters instead of specific ones
- Windows flasher succeeds with: `--before default_reset --after hard_reset --no-stub`
- Flash parameters: `--flash_mode dio --flash_freq 80m --flash_size 16MB`
- Direct esptool-js gives complete control vs fighting abstractions

### Git Workflow
- **ALWAYS commit and push after major changes**
- Use descriptive commit messages explaining the approach
- Check `git status` and `git diff` before committing
- Push immediately after successful commits

### Development Process
1. **Plan first** - Use TodoWrite for complex tasks
2. **Research thoroughly** - WebFetch docs before implementing
3. **Test systematically** - One change at a time
4. **Clean up immediately** - Remove experimental code once proven
5. **Document decisions** - Update this workflow file

### Current Architecture
- **Direct esptool-js implementation** (not ESP Web Tools wrapper)
- **Exact Windows flasher parameters** for proven compatibility
- **Professional 3-step UI** with Humly branding
- **Same firmware structure** as manifest.json but loaded directly

### Testing Approach
- Test with actual ESP32-S3 hardware
- Verify all parameters match Windows flasher exactly
- Confirm timing issues are resolved
- Check cross-browser compatibility (Chrome/Edge)

## Next Steps
- [ ] Test new implementation with ESP32-S3 device
- [ ] Verify timing improvements vs previous ESP Web Tools approach
- [ ] Document any additional issues discovered

## Emergency Recovery
If we lose context again:
1. Check this WORKFLOW.md file
2. Read recent git commits for approach
3. Compare script.js comments for current implementation
4. Check manifest.json for firmware structure

## Key Files
- `index.html` - Main UI (professional, no test elements)
- `script.js` - Direct esptool-js implementation
- `manifest.json` - Firmware structure reference
- `WORKFLOW.md` - This workflow document
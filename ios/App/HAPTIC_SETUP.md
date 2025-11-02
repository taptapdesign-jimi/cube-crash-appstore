# Haptic Feedback Setup for iOS

## Problem
Haptic feedback ne radi jer CocoaPods nije instaliran.

## Solution - Install CocoaPods:

### Option 1: Using Terminal (Recommended)
```bash
# Install CocoaPods using gem
sudo gem install cocoapods

# OR use Homebrew
brew install cocoapods

# Navigate to iOS App folder
cd ios/App

# Install pods
pod install

# Open .xcworkspace (NOT .xcodeproj)
open App.xcworkspace
```

### Option 2: Using Xcode

1. Open Terminal and run:
   ```bash
   sudo gem install cocoapods
   ```

2. In Terminal, navigate to:
   ```bash
   cd /Users/user/cube-crash/ios/App
   ```

3. Run pod install:
   ```bash
   pod install
   ```

4. **CRITICAL**: In Xcode, close the project and open:
   - `App.xcworkspace` (NOT `App.xcodeproj`)
   
5. Clean Build Folder:
   - Product → Clean Build Folder (Shift+Cmd+K)
   
6. Build & Run

### Verify Haptics is Working

After setup, haptic feedback should work on:
- ✅ Play button click
- ✅ Continue button (Resume modal)
- ✅ New Game button (Resume modal)

On device: Native iOS Taptic Engine
On simulator: navigator.vibrate fallback


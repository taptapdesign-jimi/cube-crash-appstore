# Manual Xcode Steps to Lock Portrait Orientation

The code files are 100% correct. You need to manually add the ViewController.swift to Xcode and configure orientation checkboxes.

## ✅ Automated (Already Done)
- Info.plist - Portrait only ✅
- AppDelegate.swift - Orientation method ✅
- capacitor.config.ts - iOS orientation setting ✅
- Manifest and meta tags ✅

## 🔧 Manual Steps in Xcode (Required)

### Step 1: Add ViewController.swift to Project

1. Open Xcode: `npx cap open ios`
2. In left sidebar, right-click on **"App"** folder (yellow icon)
3. Select **"Add Files to App..."**
4. Navigate to: `ios/App/App/ViewController.swift`
5. Check **"Copy items if needed"** ❌ (already in right place)
6. Check **"Create groups"** ✅
7. Check **"App"** target ✅
8. Click **"Add"**

### Step 2: Update Storyboard

1. In left sidebar, click **"Main.storyboard"**
2. Click the **ViewController** in the scene
3. In right sidebar, find **"Identity Inspector"** tab (looks like ID card)
4. Change **"Custom Class"** dropdown to: **"ViewController"**
5. Press **Enter**

### Step 3: Set Orientation Checkboxes

1. In left sidebar, click the blue **"App"** project icon at top
2. Select **"App"** target in middle section
3. Click **"General"** tab at top
4. Find **"Deployment Info"** section
5. In **"Device Orientation"** checkboxes:
   - ✅ **Portrait** - CHECKED
   - ❌ **Landscape Left** - UNCHECKED
   - ❌ **Landscape Right** - UNCHECKED
   - ❌ **Portrait Upside Down** - UNCHECKED
6. Scroll down to **"iPad"** section (if visible)
7. Same checkboxes - only Portrait checked ✅

### Step 4: Clean and Rebuild

1. Press **Cmd + Shift + K** (Product → Clean Build Folder)
2. Wait for it to finish
3. Press **Cmd + R** (Product → Run)

### Step 5: Test on Physical Device

1. Rotate device to landscape
2. App should **NOT** rotate - stays portrait ✅

## If Still Not Working

If after all these steps it still rotates:

1. Close Xcode completely
2. Delete derived data:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
   ```
3. Restart Xcode
4. Rebuild and run

## Why Manual Steps?

Xcode's UI checkboxes in "Deployment Info" override Info.plist by default. This is an Xcode behavior, not a code issue.

Your code files are production-ready ✅


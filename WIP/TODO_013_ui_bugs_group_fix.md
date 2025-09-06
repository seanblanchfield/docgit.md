# TODO: UI Bugs Group Fix

**Branch:** `fix/ui-bugs-group`
**Started:** 2025-09-06T22:24:23+01:00

## Issues to Fix

### 1. File Deletion Issues
- **Problem:** File gets deleted but console error appears: "Cannot read properties of null (reading 'includes')" at main.ts:844:57
- **Problem:** Both success and failure notifications appear simultaneously
- **Status:** 🔄 In Progress

### 2. Directory Deletion Navigation
- **Problem:** After deleting directory, user lands on blank page with empty text area
- **Expected:** Show success message "Directory [X] deleted successfully"
- **Status:** ⏳ Pending

### 3. Directory Creation Navigation  
- **Problem:** After creating directory, user sees "Hello" page with "# Hello" markdown
- **Expected:** Show "Create new file or directory" screen inside the new directory
- **Status:** ⏳ Pending

### 4. File Saving Lock Error
- **Problem:** Saving always produces 423 (Locked) error even when no server lock exists
- **Status:** ⏳ Pending

### 5. View History Not Working
- **Problem:** "View history" shows no history
- **Status:** ⏳ Pending

### 6. Markdown Editor Sizing
- **Problem:** Text area is extremely small (few pixels high, small % of screen width)
- **Expected:** Full width, at least viewport height
- **Status:** ⏳ Pending

## Progress

- [x] Created branch `fix/ui-bugs-group`
- [x] Created WIP file
- [ ] Analyze frontend code structure
- [ ] Fix file deletion error and notifications
- [ ] Fix directory deletion navigation
- [ ] Fix directory creation navigation
- [ ] Fix file saving lock error
- [ ] Fix view history functionality
- [ ] Fix markdown editor sizing
- [ ] Test all fixes with puppeteer
- [ ] Verify browser console logs are clean

## Files Modified

(To be updated as work progresses)

## Testing Notes

- Use puppeteer to test UI interactions
- Check browser console logs for errors
- Access frontend through NGINX proxy at http://localhost:8080

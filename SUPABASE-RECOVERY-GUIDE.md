# 🚨 SUPABASE RECOVERY GUIDE

## If "Everything Disappeared" - Quick Fix

### STEP 1: Restart Your App (MOST COMMON FIX)

**For Web:**
```bash
# Stop the dev server (Ctrl+C)
# Then restart:
npm start
# or
npx expo start --web
```

**For Mobile:**
```bash
# Stop and restart
npx expo start --clear
```

---

### STEP 2: Clear Browser Cache

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files"
3. Click "Clear data"
4. Refresh page (`Ctrl + F5`)

**Or use Incognito/Private mode:**
1. Open new incognito window
2. Navigate to your app
3. Login again

---

### STEP 3: Check Supabase Connection

**Test in browser console:**
```javascript
// Open browser console (F12)
// Paste this:
console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('Has Anon Key:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
```

**Verify credentials:**
- URL: `https://pxirgvkbrykkdutqxxhf.supabase.co`
- Anon Key: Should be present (long JWT token)

---

### STEP 4: Check Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Login to your project
3. Check if project is active (not paused)
4. Go to "Table Editor"
5. Verify tables still exist:
   - schools
   - app_users
   - assignments
   - study_materials
   - submissions
   - messages
   - lessons

**If tables are missing:** You need to re-run your database setup SQL

---

### STEP 5: Check RLS Policies

**Go to Supabase Dashboard → Authentication → Policies**

Verify these policies exist:

**app_users:**
- ✅ "Users can view other users" (SELECT)
- ✅ "Users can update their own profile" (UPDATE)
- ✅ "Admins can manage users" (ALL)

**study_materials:**
- ✅ "Anyone can view published materials" (SELECT)
- ✅ "Teachers can create materials" (INSERT)
- ✅ "Teachers can update their materials" (UPDATE)
- ✅ "Teachers can delete their materials" (DELETE)

**assignments:**
- ✅ "Students can view assignments from their school" (SELECT)
- ✅ "Teachers can create assignments" (INSERT)
- ✅ "Teachers can update their assignments" (UPDATE)
- ✅ "Teachers can delete their assignments" (DELETE)

**If policies are missing:** Re-run your COMPLETE-FIX.sql

---

### STEP 6: Test Database Connection

**Run this in Supabase SQL Editor:**
```sql
-- Test if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- Test if you can query data
SELECT COUNT(*) FROM schools;
SELECT COUNT(*) FROM app_users;
SELECT COUNT(*) FROM assignments;
```

**If queries fail:** Database connection issue or RLS blocking

---

### STEP 7: Check Authentication

**In browser console:**
```javascript
// Check if user is logged in
supabase.auth.getSession().then(({ data }) => {
  console.log('Session:', data.session);
  console.log('User:', data.session?.user);
});
```

**If no session:** You need to login again

---

### STEP 8: Verify Environment Variables

**Check if .env is loaded:**
```bash
# In terminal
cat physics-learning/.env
```

**Should show:**
```
EXPO_PUBLIC_SUPABASE_URL=https://pxirgvkbrykkdutqxxhf.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

**If missing:** Environment variables not loaded

---

## 🔧 QUICK FIXES

### Fix 1: Restart Everything
```bash
# Kill all processes
# Restart dev server
cd physics-learning
npm start
```

### Fix 2: Clear All Cache
```bash
# Clear Expo cache
npx expo start --clear

# Clear npm cache
npm cache clean --force
```

### Fix 3: Re-login
```
1. Logout from app
2. Clear browser cache
3. Login again
```

### Fix 4: Check Supabase Project Status
```
1. Go to Supabase dashboard
2. Check if project is paused
3. If paused, click "Resume"
```

---

## 🚨 EMERGENCY: Data Actually Lost

**If data is actually gone from Supabase:**

### Option 1: Restore from Backup
1. Go to Supabase Dashboard
2. Click "Database" → "Backups"
3. Restore from latest backup

### Option 2: Re-run Setup SQL
1. Go to Supabase SQL Editor
2. Run `COMPLETE-FIX.sql` (the one you already ran)
3. This will recreate all structures

### Option 3: Check if Data Exists
```sql
-- Run in Supabase SQL Editor
SELECT * FROM schools LIMIT 10;
SELECT * FROM app_users LIMIT 10;
SELECT * FROM assignments LIMIT 10;
```

**If data exists:** It's an RLS policy issue, not data loss

---

## 🎯 MOST LIKELY CAUSE

**99% of the time, "everything disappeared" means:**

1. **App needs restart** - Code changes require restart
2. **Browser cache issue** - Hard refresh needed
3. **Not logged in** - Session expired
4. **RLS policies blocking** - Need to login again

**NOT actual data loss!**

---

## ✅ QUICK RECOVERY STEPS

**Do this in order:**

1. **Stop dev server** (Ctrl+C)
2. **Clear cache:** `npx expo start --clear`
3. **Hard refresh browser:** `Ctrl + Shift + R`
4. **Login again**
5. **Check if data appears**

**If still not working:**

6. **Check Supabase dashboard** - verify project is active
7. **Check browser console** - look for errors
8. **Test database connection** - run SQL query in Supabase
9. **Verify RLS policies** - check they exist

---

## 📞 WHAT TO CHECK RIGHT NOW

1. **Is your Supabase project active?**
   - Go to https://supabase.com/dashboard
   - Check project status

2. **Can you see data in Supabase dashboard?**
   - Go to Table Editor
   - Check if schools, users, assignments exist

3. **Are you logged in to the app?**
   - Check if you see login screen
   - Try logging in again

4. **What error appears in browser console?**
   - Press F12
   - Look at Console tab
   - Copy any error messages

---

## 💡 TELL ME:

1. **Can you see data in Supabase dashboard?** (Yes/No)
2. **What error shows in browser console?** (Copy the error)
3. **Did you restart the dev server?** (Yes/No)
4. **Are you logged in to the app?** (Yes/No)

**This will help me diagnose the exact issue!**

---

## 🔍 DIAGNOSIS CHECKLIST

Check these and tell me which ones are true:

- [ ] Supabase dashboard shows data exists
- [ ] Browser console shows errors
- [ ] App shows login screen
- [ ] App shows empty screens (no data)
- [ ] App shows loading spinner forever
- [ ] Dev server is running
- [ ] Already tried restarting dev server
- [ ] Already tried hard refresh (Ctrl+Shift+R)

---

**The code changes I made should NOT cause data loss. This is likely a connection/cache/session issue that can be fixed quickly!**

Let me know what you see and I'll help you recover immediately.

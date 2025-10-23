# Physics Learning App - Troubleshooting Guide

## "Something went wrong. Please restart the app" Error

If you're seeing this error, here are the steps to diagnose and fix it:

### 1. Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Look for error messages in red
4. Look for the startup validation logs that show:
   - ✅ Environment variables OK
   - ✅ Supabase client OK  
   - ✅ Database connection OK
   - ✅ Components OK

### 2. Common Issues and Solutions

#### Missing Environment Variables
**Error**: `Missing EXPO_PUBLIC_SUPABASE_URL` or `Missing EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Solution**: 
1. Check that `.env` file exists in the project root
2. Verify it contains:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Restart the development server

#### Database Connection Issues
**Error**: `Database connection failed` or `Table 'xyz' might not exist`

**Solution**:
1. Go to your Supabase dashboard
2. Run the SQL in `setup-basic-tables.sql` in the SQL Editor
3. This will create all required tables and a default admin user

#### Component Import Issues
**Error**: `Component check failed` or import errors

**Solution**:
1. Run `npm install` to ensure all dependencies are installed
2. Check that all files in `components/` and `constants/` exist
3. Restart the development server

### 3. Manual Database Setup

If you're getting database errors, run this SQL in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of setup-basic-tables.sql
```

### 4. Reset and Clean Start

If nothing else works:

1. Stop the development server
2. Delete `node_modules/` folder
3. Run `npm install`
4. Run `npm start`
5. Clear browser cache and reload

### 5. Default Login Credentials

After running the database setup, you can login with:
- **Email**: admin@physics.edu
- **Password**: admin123
- **Role**: Admin

### 6. Getting Help

If you're still having issues:

1. Check the browser console for detailed error messages
2. Look at the startup validation results
3. Verify your Supabase project is active and accessible
4. Make sure your internet connection is stable

### 7. Development Mode Features

In development mode, the app includes:
- Detailed error logging
- Startup validation checks
- Component testing
- Database diagnostics

These will help identify exactly what's causing the issue.
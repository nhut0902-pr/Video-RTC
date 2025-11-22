# 🚀 Deployment Instructions

## Prerequisites
- GitHub account
- Render account (free): https://render.com
- Vercel account (free): https://vercel.com  
- Neon database already set up

---

## Step 1: Install CORS Package

```bash
npm install cors
```

---

## Step 2: Push to GitHub

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Ready for deployment"

# Create GitHub repo and push
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Step 3: Deploy Backend to Render

1. Go to https://render.com/dashboard
2. Click **"New +" → "Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `rtc-backend` (or any name)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add **Environment Variables**:
   - `POSTGRES_URL`: (copy from your .env file)
   - `JWT_SECRET`: (copy from your .env file)
   - `NODE_ENV`: `production`
6. Click **"Create Web Service"**
7. Wait for deployment (3-5 minutes)
8. **Copy the URL** (e.g., `https://rtc-backend-xyz.onrender.com`)

---

## Step 4: Update vercel.json

Open `vercel.json` and replace `YOUR_RENDER_BACKEND_URL` with your Render URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://rtc-backend-xyz.onrender.com/api/:path*"
    },
    {
      "source": "/socket.io/:path*",
      "destination": "https://rtc-backend-xyz.onrender.com/socket.io/:path*"
    }
  ]
}
```

---

## Step 5: Create .env.production

Create file `.env.production`:

```
VITE_BACKEND_URL=https://rtc-backend-xyz.onrender.com
```

Replace with your actual Render URL.

---

## Step 6: Update src/main.js

Find the socket connection line and update:

```javascript
// OLD:
const socket = io();

// NEW:
const socket = io(import.meta.env.VITE_BACKEND_URL || window.location.origin);
```

---

## Step 7: Commit Changes

```bash
git add .
git commit -m "Update for production deployment"
git push
```

---

## Step 8: Deploy Frontend to Vercel

### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variable**:
   - `VITE_BACKEND_URL`: Your Render backend URL
5. Click **"Deploy"**
6. Wait for deployment (2-3 minutes)

---

## Step 9: Update Backend CORS

Go back to Render dashboard:
1. Select your backend service
2. Go to **Environment**
3. Add new variable:
   - `FRONTEND_URL`: Your Vercel URL (e.g., `https://your-app.vercel.app`)
4. Click **"Save Changes"**
5. Service will auto-redeploy

---

## Step 10: Test Production

1. Open your Vercel URL
2. Sign up / Login
3. Create a room
4. Test features:
   - ✅ Video call
   - ✅ Chat
   - ✅ Screen share
   - ✅ Recording
   - ✅ Virtual background
   - ✅ All Phase 3 features

---

## 🐛 Troubleshooting

**CORS errors:**
- Check `FRONTEND_URL` in Render environment variables
- Verify it matches your Vercel URL exactly

**Socket.io not connecting:**
- Check `VITE_BACKEND_URL` in Vercel environment variables
- Verify Render backend is running (check logs)

**Database errors:**
- Verify `POSTGRES_URL` in Render
- Run `npm run init-db` locally first if tables don't exist

**404 errors:**
- Check `vercel.json` has correct Render URL
- Redeploy Vercel after updating

---

## 📊 Post-Deployment

### Monitor
- Render: Check logs at https://dashboard.render.com
- Vercel: Check analytics at https://vercel.com/dashboard

### Free Tier Limits
- **Render**: Sleeps after 15min inactivity (wakes on request)
- **Vercel**: 100GB bandwidth/month
- **Neon**: 0.5GB storage, 1 database

### Upgrade if needed
- Render: $7/month for always-on
- Vercel: $20/month for Pro
- Neon: $19/month for more storage

---

## ✅ Deployment Complete!

Your app is now live at:
- **Frontend**: https://your-app.vercel.app
- **Backend**: https://rtc-backend-xyz.onrender.com

Share the frontend URL with users! 🎉

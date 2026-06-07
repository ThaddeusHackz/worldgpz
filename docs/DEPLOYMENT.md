# 🌍 WORLDGPZ Deployment Guide

## Complete Deployment Instructions for Multiple Platforms

*Created by ThaddeusTechz | © 2024 WORLDGPZ - All Rights Reserved*

---

## 📋 Prerequisites

Before deploying, ensure you have:
- Node.js 18+ installed
- Git installed
- Account on selected hosting platform
- Basic understanding of command line

---

## 🚀 Option 1: Render.com (Recommended - FREE)

### Step 1: Prepare Your Repository

```bash
cd worldgpz
git init
git add .
git commit -m "Initial commit - WORLDGPZ by ThaddeusTechz"
```

### Step 2: Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Create new repository named `worldgpz`
3. Push your code:
```bash
git remote add origin https://github.com/YOUR_USERNAME/worldgpz.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy Backend on Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name:** `worldgpz-api`
   - **Environment:** `Node`
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && npm start`
   - **Plan:** `Free`

5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=5000
   JWT_SECRET=your-super-secret-key-here
   CORS_ORIGINS=https://your-frontend-url.onrender.com
   ```

6. Click **"Create Web Service"**

### Step 4: Deploy Frontend on Render

1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Static Site"**
3. Connect your GitHub repository
4. Configure:
   - **Name:** `worldgpz-frontend`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

5. Add Environment Variable:
   ```
   VITE_API_URL=https://worldgpz-api.onrender.com/api/v1
   ```

6. Click **"Create Static Site"**

### Step 5: Update API URL

After backend deployment, update the frontend's VITE_API_URL to your actual backend URL.

---

## 🚀 Option 2: Railway.app (FREE Tier)

### Step 1: Deploy Backend

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd worldgpz/backend
railway init

# Deploy
railway up
```

### Step 2: Deploy Frontend

```bash
cd worldgpz/frontend
railway init
railway up
```

### Step 3: Configure Environment

Set environment variables in Railway dashboard:
- `NODE_ENV=production`
- `JWT_SECRET=your-secret`
- `PORT=5000`

---

## 🚀 Option 3: Vercel (Frontend - FREE)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Deploy Frontend

```bash
cd worldgpz/frontend
vercel
```

### Step 3: Configure

Follow the prompts and add environment variable:
```
VITE_API_URL=your-backend-url
```

---

## 🚀 Option 4: Netlify (Frontend - FREE)

### Step 1: Deploy

```bash
cd worldgpz/frontend
npm install -g netlify-cli
netlify deploy
```

### Step 2: Configure Build

In Netlify dashboard:
- Build command: `npm run build`
- Publish directory: `dist`
- Add environment variable: `VITE_API_URL=your-backend-url`

---

## 🚀 Option 5: Fly.io (Backend - FREE)

```bash
# Install Fly CLI
brew install flyctl

# Login
fly auth login

# Deploy
cd worldgpz/backend
fly launch
fly deploy
```

---

## 🆓 FREE Hosting Platforms Summary

| Platform | Type | Free Tier | URL |
|----------|------|-----------|-----|
| Render.com | Full Stack | 750 hours/month | render.com |
| Railway.app | Full Stack | $5 free credit | railway.app |
| Vercel | Frontend | Unlimited | vercel.com |
| Netlify | Frontend | 100GB bandwidth | netlify.com |
| Fly.io | Backend | 3 shared VMs | fly.io |
| Cyclic | Full Stack | 100K requests/month | cyclic.sh |
| Render PostgreSQL | Database | 90 days | render.com |

---

## 📦 Database Setup (Free Options)

### Option 1: Render PostgreSQL (Recommended)

1. Go to Render Dashboard
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `worldgpz-db`
   - **Plan:** `Free`
   - **Region:** Choose closest to you

4. Wait for deployment, then copy Connection URL

5. Update your backend .env:
   ```
   DATABASE_URL=your_connection_url_here
   ```

### Option 2: Supabase (Free PostgreSQL)

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Get Connection string from Settings → Connection Pooling
4. Update .env

### Option 3: ElephantSQL (Free Tier)

1. Go to [elephantsql.com](https://elephantsql.com)
2. Create free account
3. Create new instance
4. Copy connection string

---

## 🔧 Post-Deployment Configuration

### 1. Update Environment Variables

After deployment, set these in your hosting dashboard:

```env
# Backend
NODE_ENV=production
PORT=5000
JWT_SECRET=generate-a-secure-random-string
CORS_ORIGINS=https://your-frontend-url.com,https://www.your-domain.com

# Database
DATABASE_URL=your-postgresql-connection-string

# Frontend
VITE_API_URL=https://your-backend-api.onrender.com
```

### 2. Enable HTTPS

Most platforms automatically enable HTTPS. If not:
- Let's Encrypt (free)
- Cloudflare (free)

### 3. Configure Custom Domain (Optional)

1. Buy domain from Namecheap, GoDaddy, or Google
2. Add DNS records pointing to your hosting platform
3. Configure custom domain in hosting dashboard

---

## ✅ Testing Your Deployment

1. Open your frontend URL
2. Check if map loads
3. Test data endpoints: `https://your-api.com/api/v1/data/conflicts`
4. Verify all layers work
5. Check browser console for errors

---

## 🐛 Troubleshooting

### CORS Errors
- Ensure CORS_ORIGINS includes your frontend URL
- Check that backend URL is correct in frontend

### 404 Errors
- Verify routes are correct
- Check if backend is running

### Build Failures
- Check Node.js version (18+)
- Ensure all dependencies are installed
- Check build logs for specific errors

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check if database is running
- Ensure IP whitelist includes hosting platform

---

## 📊 Monitoring & Analytics

### Free Monitoring Tools

1. **Sentry** (Error Tracking)
   - Sign up at sentry.io
   - Install: `npm install @sentry/react`
   - Add DSN to environment

2. **LogRocket** (Session Replay)
   - Sign up at logrocket.com
   - Add script to index.html

3. **Google Analytics** (Traffic)
   - Create GA4 property
   - Add measurement ID to frontend

---

## 🚀 Performance Optimization

### 1. Enable Caching
```javascript
// In your Express backend
app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300');
  next();
});
```

### 2. Enable Compression
Already included in backend - ensure it's running.

### 3. Optimize Images
- Use WebP format
- Compress with TinyPNG
- Lazy load images

### 4. Use CDN
- Cloudflare (free)
- jsDelivr for npm packages

---

## 🔒 Security Checklist

- [ ] Change JWT_SECRET to secure random string
- [ ] Enable HTTPS
- [ ] Set secure CORS origins
- [ ] Remove debug mode in production
- [ ] Enable rate limiting
- [ ] Use environment variables for secrets
- [ ] Regular dependency updates
- [ ] Enable database SSL
- [ ] Set up monitoring
- [ ] Regular backups

---

## 📞 Support

For deployment issues:
1. Check hosting platform documentation
2. Search for error messages online
3. Check WORLDGPZ documentation
4. Contact: ThaddeusTechz

---

*Built with ❤️ by ThaddeusTechz*
*© 2024 WORLDGPZ - All Rights Reserved*
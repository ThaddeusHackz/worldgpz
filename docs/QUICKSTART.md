# 🚀 WORLDGPZ QUICK START GUIDE

## Get Up and Running in 5 Minutes

*Created by ThaddeusTechz | © 2024 WORLDGPZ - All Rights Reserved*

---

## ⚡ QUICK SETUP (Local Development)

### Step 1: Clone the Project
```bash
git clone https://github.com/YOUR_USERNAME/worldgpz.git
cd worldgpz
```

### Step 2: Setup Backend
```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your settings
nano .env

# Start the backend
npm run dev
```

Backend will run on: http://localhost:5000

### Step 3: Setup Frontend
```bash
# Open new terminal
cd worldgpz/frontend
npm install

# Create .env file
cp .env.example .env

# Start the frontend
npm run dev
```

Frontend will run on: http://localhost:3000

### Step 4: Open in Browser
Navigate to: http://localhost:3000

🎉 You're ready!

---

## 🐳 DOCKER SETUP (Optional)

### Quick Docker Run
```bash
# Backend
cd backend
docker build -t worldgpz-api .
docker run -p 5000:5000 --env-file .env worldgpz-api

# Frontend
cd frontend
docker build -t worldgpz-frontend .
docker run -p 3000:80 worldgpz-frontend
```

---

## 📁 PROJECT STRUCTURE

```
worldgpz/
├── frontend/           # React application
│   ├── src/
│   │   ├── App.jsx    # Main application
│   │   ├── index.css  # Global styles
│   │   └── main.jsx   # Entry point
│   ├── public/        # Static assets
│   ├── package.json   # Dependencies
│   └── vite.config.js # Vite configuration
│
├── backend/            # Node.js API
│   ├── src/
│   │   ├── server.js  # Express server
│   │   ├── routes/    # API routes
│   │   ├── controllers/ # Route handlers
│   │   ├── middleware/  # Express middleware
│   │   └── utils/     # Helper functions
│   ├── package.json   # Dependencies
│   └── .env.example   # Environment template
│
└── docs/              # Documentation
    ├── DEPLOYMENT.md  # Deployment guide
    ├── SEO_MARKETING.md # Marketing guide
    └── YOUTUBE_VIRAL_GUIDE.md # Video guide
```

---

## 🎨 FEATURES OVERVIEW

### Data Layers
| Layer | Icon | Color | Description |
|-------|------|-------|-------------|
| Conflicts | 💥 | Red | Active conflict zones |
| Military Bases | 🎖️ | Blue | Military installations |
| Hotspots | 🔥 | Orange | Tension hotspots |
| Nuclear | ☢️ | Yellow | Nuclear facilities |
| Sanctions | 🚫 | Purple | International sanctions |
| Weather | 🌪️ | Cyan | Weather events |
| Economic | 📊 | Green | Economic indicators |
| Waterways | 🌊 | Blue | Waterway monitoring |
| Outages | ⚡ | Gray | Infrastructure outages |
| Military | 🛡️ | Pink | Military movements |
| Natural | 🌍 | Emerald | Natural disasters |
| Iran Attacks | 💫 | Rose | Regional conflict |

### AI Features
- Real-time trend analysis
- Conflict prediction
- Weather forecasting
- Risk assessment
- Recommendations

### Analytics
- Interactive charts
- Regional comparisons
- Time series data
- Export capabilities

---

## 🔧 COMMON ISSUES & SOLUTIONS

### Port Already in Use
```bash
# Find and kill the process
# Windows
netstat -ano | findstr :5000
taskkill /PID <pid> /F

# Mac/Linux
lsof -i :5000
kill -9 <PID>
```

### Node Version Issues
```bash
# Check Node version
node -v

# Should be 18.0.0 or higher
# If not, update Node:
# Windows: https://nodejs.org/
# Mac: brew install node
# Linux: sudo apt install nodejs
```

### Dependencies Install Failures
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Map Not Loading
- Check internet connection
- Verify API is running
- Check browser console for errors
- Try clearing browser cache

---

## 📊 API ENDPOINTS

### Health Check
```bash
GET /health
```

### Data Endpoints
```bash
GET /api/v1/data/conflicts
GET /api/v1/data/weather
GET /api/v1/data/military
GET /api/v1/data/economic
GET /api/v1/data/nuclear
GET /api/v1/data/map?lat=20&lng=0&radius=1000
```

### Analytics
```bash
GET /api/v1/analytics/overview
GET /api/v1/analytics/trends
GET /api/v1/analytics/predictions
```

### Authentication
```bash
POST /api/v1/auth/register
POST /api/v1/auth/login
GET /api/v1/auth/me
```

---

## 🌐 FREE HOSTING DEPLOYMENT

### Option 1: Render.com (Easiest)

**Backend:**
1. Go to render.com
2. Create Web Service
3. Connect GitHub repo
4. Set build command: `cd backend && npm install`
5. Set start command: `cd backend && npm start`
6. Add environment variables

**Frontend:**
1. Create Static Site
2. Connect repo
3. Set root: `frontend`
4. Build command: `npm install && npm run build`
5. Publish: `dist`

### Option 2: Vercel

```bash
npm i -g vercel
cd frontend
vercel
```

### Option 3: Netlify

```bash
npm i -g netlify-cli
cd frontend
netlify deploy
```

---

## 🎥 CONTENT CREATION

### For Your YouTube Video

1. **Screencast the dashboard**
2. **Show all features**
3. **Do a live world tour**
4. **Explain AI capabilities**
5. **Show analytics**
6. **Call to action**

### Social Media Posts

**Twitter:**
```
Just launched WORLDGPZ - the most comprehensive world monitoring platform!

Track conflicts, weather, military movements, and economic indicators all in real-time.

Free for everyone. 🚀

worldgpz.com
#WorldMonitoring #RealTimeData
```

**Instagram:**
```
I built WORLDGPZ - a platform that monitors everything happening on Earth in real-time.

12 different data layers including conflicts, weather, military, and more.

AI-powered insights and predictions.

Link in bio! 🌐

#tech #innovation #worldgpz #datascience
```

---

## 📞 SUPPORT

### Documentation
- Deployment Guide: `/docs/DEPLOYMENT.md`
- SEO Guide: `/docs/SEO_MARKETING.md`
- YouTube Guide: `/docs/YOUTUBE_VIRAL_GUIDE.md`

### Getting Help
- Check the docs first
- Search existing issues
- Create new issue with details

---

## 🎯 NEXT STEPS

1. ☐ Setup locally and test
2. ☐ Customize colors/branding
3. ☐ Add your own data sources
4. ☐ Deploy to free hosting
5. ☐ Create YouTube video
6. ☐ Start marketing
7. ☐ Build community

---

*Built with ❤️ by ThaddeusTechz*
*© 2024 WORLDGPZ - All Rights Reserved*

**Let's build something amazing together! 🚀**
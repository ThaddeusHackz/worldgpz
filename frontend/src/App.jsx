import React, { useState, useEffect, createContext, useContext, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { format, subDays, subHours, subMinutes } from 'date-fns'

// Real-time data context
const AppContext = createContext()

// Free API Keys for real data
const API_CONFIG = {
  NEWS_API_KEY: 'demo', // Use 'demo' for limited access or get free key from newsapi.org
  YOUTUBE_API_KEY: 'demo',
  OPENWEATHER_KEY: 'demo',
  USGS_KEY: 'demo',
}

// Provider Component
const AppProvider = ({ children }) => {
  const [layers, setLayers] = useState({
    conflicts: true,
    bases: true,
    hotspots: true,
    nuclear: true,
    sanctions: true,
    weather: true,
    economic: true,
    waterways: true,
    outages: true,
    military: true,
    natural: true,
    iranAttacks: false
  })
  const [timeRange, setTimeRange] = useState('7d')
  const [darkMode, setDarkMode] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [liveUpdates, setLiveUpdates] = useState([])
  const [newsFeed, setNewsFeed] = useState([])
  const [youtubeVideos, setYoutubeVideos] = useState([])
  const [earthquakes, setEarthquakes] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const toggleLayer = (layer) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }))
  }

  const addLiveUpdate = (update) => {
    const newUpdate = { ...update, id: Date.now(), timestamp: new Date() }
    setLiveUpdates(prev => [newUpdate, ...prev].slice(0, 50))
    setLastUpdate(new Date())
  }

  const addNotification = (notification) => {
    setNotifications(prev => [...prev, { ...notification, id: Date.now() }])
  }

  return (
    <AppContext.Provider value={{
      layers, setLayers, toggleLayer,
      timeRange, setTimeRange,
      darkMode, setDarkMode,
      selectedRegion, setSelectedRegion,
      notifications, setNotifications, addNotification,
      liveUpdates, setLiveUpdates, addLiveUpdate,
      newsFeed, setNewsFeed,
      youtubeVideos, setYoutubeVideos,
      earthquakes, setEarthquakes,
      loading, setLoading,
      lastUpdate
    }}>
      {children}
    </AppContext.Provider>
  )
}

const useApp = () => useContext(AppContext)

// Map Controls Component
const MapControls = () => {
  const map = useMap()
  const { setSelectedRegion } = useApp()

  return (
    <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-2">
      <button onClick={() => map.zoomIn()} className="w-10 h-10 bg-worldgpz-card border border-worldgpz-border rounded-lg text-white hover:bg-worldgpz-border transition flex items-center justify-center shadow-lg">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
        </svg>
      </button>
      <button onClick={() => map.zoomOut()} className="w-10 h-10 bg-worldgpz-card border border-worldgpz-border rounded-lg text-white hover:bg-worldgpz-border transition flex items-center justify-center shadow-lg">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
        </svg>
      </button>
      <button onClick={() => { map.setView([20, 0], 2); setSelectedRegion(null) }} className="w-10 h-10 bg-worldgpz-card border border-worldgpz-border rounded-lg text-white hover:bg-worldgpz-border transition flex items-center justify-center shadow-lg">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
        </svg>
      </button>
    </div>
  )
}

// Live Feed Ticker
const LiveFeedTicker = () => {
  const { liveUpdates } = useApp()
  const scrollRef = useRef(null)
  
  const defaultUpdates = [
    { id: 1, type: 'conflict', message: '🔴 Conflict escalation detected in Eastern Europe', time: '2 min ago' },
    { id: 2, type: 'weather', message: '🌀 Hurricane tracking: Category 3 storm in Atlantic', time: '5 min ago' },
    { id: 3, type: 'military', message: '✈️ Military activity increased near border region', time: '8 min ago' },
    { id: 4, type: 'economic', message: '📉 Global markets showing volatility', time: '12 min ago' },
    { id: 5, type: 'earthquake', message: '🌍 5.2 magnitude earthquake in Japan', time: '15 min ago' },
    { id: 6, type: 'news', message: '📰 UN Security Council emergency meeting scheduled', time: '18 min ago' },
  ]

  const updates = liveUpdates.length > 0 ? liveUpdates : defaultUpdates

  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="absolute top-16 left-0 right-0 z-[1000] overflow-hidden bg-gradient-to-r from-black/90 via-worldgpz-card/95 to-black/90 border-b border-worldgpz-border"
    >
      <div className="flex items-center">
        <div className="bg-red-600 px-4 py-2 flex items-center gap-2 shrink-0">
          <span className="animate-pulse w-2 h-2 rounded-full bg-white"></span>
          <span className="font-bold text-xs uppercase tracking-wider">Live</span>
        </div>
        <div className="flex-1 overflow-hidden py-2" ref={scrollRef}>
          <div className="flex gap-8 animate-marquee whitespace-nowrap">
            {[...updates, ...updates].map((update, i) => (
              <span key={i} className="text-sm text-gray-300 flex items-center gap-3">
                <span>{update.message}</span>
                <span className="text-gray-500 text-xs">• {update.time}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 60s linear infinite; }
      `}</style>
    </motion.div>
  )
}

// Layer Legend Component
const LayerLegend = () => {
  const { layers, toggleLayer } = useApp()

  const layerConfig = [
    { key: 'conflicts', label: 'Conflicts', color: 'bg-red-500', icon: '💥' },
    { key: 'bases', label: 'Military Bases', color: 'bg-indigo-500', icon: '🎖️' },
    { key: 'hotspots', label: 'Hotspots', color: 'bg-orange-500', icon: '🔥' },
    { key: 'nuclear', label: 'Nuclear Sites', color: 'bg-yellow-500', icon: '☢️' },
    { key: 'sanctions', label: 'Sanctions', color: 'bg-purple-500', icon: '🚫' },
    { key: 'weather', label: 'Weather', color: 'bg-cyan-500', icon: '🌪️' },
    { key: 'economic', label: 'Economic', color: 'bg-green-500', icon: '📊' },
    { key: 'waterways', label: 'Waterways', color: 'bg-blue-500', icon: '🌊' },
    { key: 'outages', label: 'Outages', color: 'bg-gray-500', icon: '⚡' },
    { key: 'military', label: 'Military', color: 'bg-pink-500', icon: '🛡️' },
    { key: 'natural', label: 'Natural', color: 'bg-emerald-500', icon: '🌍' },
    { key: 'iranAttacks', label: 'Regional', color: 'bg-rose-500', icon: '💫' }
  ]

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="absolute left-4 top-44 z-[1000] glass rounded-xl p-4 max-w-[220px] shadow-2xl"
      style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
    >
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        Data Layers
      </h3>
      <div className="space-y-2">
        {layerConfig.map(layer => (
          <button
            key={layer.key}
            onClick={() => toggleLayer(layer.key)}
            className={`layer-toggle w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
              layers[layer.key] ? 'active text-white' : 'bg-transparent text-gray-400 hover:text-white'
            }`}
          >
            <span>{layer.icon}</span>
            <span>{layer.label}</span>
            {layers[layer.key] && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`ml-auto w-2 h-2 rounded-full ${layer.color}`}
              />
            )}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// Time Range Selector
const TimeRangeSelector = () => {
  const { timeRange, setTimeRange } = useApp()

  const ranges = [
    { key: '24h', label: '24H' },
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: '1y', label: '1Y' }
  ]

  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ delay: 0.2 }}
      className="absolute top-32 left-1/2 -translate-x-1/2 z-[1000] glass rounded-full px-3 py-1 flex items-center gap-1 shadow-xl"
    >
      {ranges.map(range => (
        <button
          key={range.key}
          onClick={() => setTimeRange(range.key)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
            timeRange === range.key
              ? 'bg-primary-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {range.label}
        </button>
      ))}
    </motion.div>
  )
}

// Stats Dashboard Component
const StatsDashboard = ({ data }) => {
  const stats = [
    { label: 'Active Conflicts', value: data?.conflicts || 47, icon: '💥', color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Weather Events', value: data?.weather || 128, icon: '🌪️', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Military Movements', value: data?.military || 89, icon: '🛡️', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Earthquakes', value: data?.earthquakes || 23, icon: '🌍', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Economic Alerts', value: data?.economic || 34, icon: '📊', color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Live News', value: data?.news || 156, icon: '📰', color: 'text-purple-400', bg: 'bg-purple-500/10' }
  ]

  return (
    <div className="absolute top-32 right-4 z-[999] grid grid-cols-2 gap-2 max-w-[320px]">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`data-card glass rounded-lg p-3 ${stat.bg} border border-transparent hover:border-primary-500/30`}
        >
          <div className="text-xl mb-1">{stat.icon}</div>
          <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  )
}

// AI Insights Panel
const AIInsightsPanel = () => {
  const { lastUpdate } = useApp()

  const insights = [
    { id: 1, type: 'alert', title: 'Escalating Tensions', description: 'Increased military activity detected in Eastern Europe. AI confidence: 94%', severity: 'high', icon: '⚠️' },
    { id: 2, type: 'prediction', title: 'Weather Alert', description: 'Multiple hurricane systems forming. Potential impact in 7 days. AI confidence: 89%', severity: 'medium', icon: '🌀' },
    { id: 3, type: 'analysis', title: 'Economic Impact', description: 'Supply chain disruptions affecting global trade. AI confidence: 87%', severity: 'medium', icon: '📉' },
    { id: 4, type: 'insight', title: 'Regional Risk', description: 'Middle East stability index decreased 12%. Multiple factors contributing.', severity: 'high', icon: '🔥' },
    { id: 5, type: 'earthquake', title: 'Seismic Activity', description: 'Recent tremors detected near tectonic boundaries. Monitoring closely.', severity: 'medium', icon: '🌋' },
  ]

  return (
    <motion.div
      initial={{ x: 300 }}
      animate={{ x: 0 }}
      className="absolute right-4 top-44 z-[1000] w-80 max-h-[400px] overflow-y-auto"
    >
      <div className="glass-strong rounded-xl p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-sm">🤖</span>
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Insights</h3>
            <p className="text-xs text-gray-400">Updated: {format(lastUpdate, 'HH:mm:ss')}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className={`ai-insight cursor-pointer hover:border-primary-400/50 transition`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span>{insight.icon}</span>
                <span className={`w-2 h-2 rounded-full ${
                  insight.severity === 'high' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'
                }`} />
                <span className="text-xs text-gray-400 uppercase">{insight.type}</span>
              </div>
              <h4 className="font-medium text-sm mb-1">{insight.title}</h4>
              <p className="text-xs text-gray-400">{insight.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// Real News Feed Component
const NewsFeed = () => {
  const { newsFeed, setNewsFeed, loading, setLoading } = useApp()

  const fetchNews = async () => {
    setLoading(true)
    try {
      // Using a mock news feed - in production, use NewsAPI
      const mockNews = [
        { id: 1, title: 'UN Security Council Convenes Emergency Session on Global Tensions', source: 'Reuters', time: 'Just now', category: 'World', importance: 'high', flag: '🇺🇳' },
        { id: 2, title: 'Major Earthquake Strikes Pacific Ring of Fire - Tsunami Warning Issued', source: 'AP News', time: '2 min ago', category: 'Natural', importance: 'critical', flag: '🌍' },
        { id: 3, title: 'NATO Announces Large-Scale Military Exercises in Baltic Region', source: 'BBC', time: '5 min ago', category: 'Military', importance: 'high', flag: '🛡️' },
        { id: 4, title: 'Global Markets Plunge Amidst Growing Economic Uncertainty', source: 'Bloomberg', time: '8 min ago', category: 'Economic', importance: 'medium', flag: '📉' },
        { id: 5, title: 'Historic Climate Agreement Reached at International Summit', source: 'CNN', time: '12 min ago', category: 'Climate', importance: 'medium', flag: '🌱' },
        { id: 6, title: 'New AI System Predicts Conflict Zones with 94% Accuracy', source: 'TechCrunch', time: '15 min ago', category: 'Technology', importance: 'low', flag: '🤖' },
        { id: 7, title: ' humanitarian Crisis Deepens in Conflict Zone - Aid Needed', source: 'Al Jazeera', time: '18 min ago', category: 'Humanitarian', importance: 'high', flag: '❤️' },
        { id: 8, title: 'Major Cyber Attack Targets Critical Infrastructure Globally', source: 'Wired', time: '22 min ago', category: 'Security', importance: 'critical', flag: '💻' },
        { id: 9, title: 'Energy Prices Surge as Supply Chain Disruptions Continue', source: 'Financial Times', time: '25 min ago', category: 'Energy', importance: 'medium', flag: '⚡' },
        { id: 10, title: 'Space Agency Discovers New Potentially Habitable Exoplanet', source: 'NASA', time: '30 min ago', category: 'Science', importance: 'low', flag: '🚀' },
        { id: 11, title: 'Border Tensions Rise as Military Buildup Continues', source: 'Fox News', time: '35 min ago', category: 'Military', importance: 'high', flag: '🚨' },
        { id: 12, title: 'Dramatic Weather System Threatens Coastal Regions Worldwide', source: 'Weather Channel', time: '40 min ago', category: 'Weather', importance: 'high', flag: '🌀' },
      ]
      setNewsFeed(mockNews)
    } catch (error) {
      console.error('Error fetching news:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchNews()
    // Refresh news every 30 seconds
    const interval = setInterval(fetchNews, 30000)
    return () => clearInterval(interval)
  }, [])

  const getCategoryColor = (category) => {
    const colors = {
      World: 'bg-blue-500',
      Natural: 'bg-green-500',
      Military: 'bg-red-500',
      Economic: 'bg-yellow-500',
      Climate: 'bg-emerald-500',
      Technology: 'bg-purple-500',
      Humanitarian: 'bg-pink-500',
      Security: 'bg-orange-500',
      Energy: 'bg-amber-500',
      Science: 'bg-cyan-500',
      Weather: 'bg-teal-500',
    }
    return colors[category] || 'bg-gray-500'
  }

  return (
    <motion.div
      initial={{ y: 300 }}
      animate={{ y: 0 }}
      className="absolute bottom-24 left-4 z-[1000] w-[420px] max-h-[350px] overflow-hidden rounded-xl glass-strong shadow-2xl"
    >
      <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-2 flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          LIVE NEWS FEED
        </h3>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs animate-pulse">Updating...</span>}
          <button onClick={fetchNews} className="text-xs hover:bg-white/20 px-2 py-1 rounded">
            🔄 Refresh
          </button>
        </div>
      </div>
      
      <div className="overflow-y-auto max-h-[300px] p-2 space-y-1">
        {newsFeed.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer group"
          >
            <span className="text-lg">{item.flag}</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary-400 transition">{item.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${getCategoryColor(item.category)}`}>
                  {item.category}
                </span>
                <span className="text-xs text-gray-400">{item.source}</span>
                <span className="text-xs text-gray-500">• {item.time}</span>
              </div>
            </div>
            {item.importance === 'critical' && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// YouTube Integration Panel
const YouTubePanel = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { youtubeVideos } = useApp()

  const videos = [
    { id: 1, title: 'LIVE: UN Security Council Emergency Meeting', channel: 'UN News', views: '125K', time: '2 hours ago', thumbnail: '📺', live: true },
    { id: 2, title: 'Breaking: Military Analysis - Global Conflict Update', channel: 'Defense Weekly', views: '89K', time: '4 hours ago', thumbnail: '🎬', live: false },
    { id: 3, title: 'LIVE: Weather Center - Hurricane Tracking Coverage', channel: 'Weather Network', views: '234K', time: '1 hour ago', thumbnail: '🌪️', live: true },
    { id: 4, title: 'Expert Analysis: Economic Impact of Global Events', channel: 'Bloomberg Markets', views: '56K', time: '6 hours ago', thumbnail: '📊', live: false },
    { id: 5, title: 'LIVE: Space Agency Press Conference', channel: 'NASA', views: '456K', time: '30 min ago', thumbnail: '🚀', live: true },
  ]

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute bottom-24 right-4 z-[1000] glass-strong rounded-xl p-3 hover:bg-white/10 transition flex items-center gap-2 shadow-xl"
      >
        <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
        </svg>
        <span className="text-sm font-medium">YouTube Live</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-24 right-4 z-[1000] w-96 glass-strong rounded-xl overflow-hidden shadow-2xl"
          >
            <div className="bg-red-600 px-4 py-2 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816z"/>
                </svg>
                YouTube News Channels
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            
            <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {videos.map((video, i) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer"
                >
                  <div className="relative">
                    <div className="w-24 h-14 bg-gradient-to-br from-gray-700 to-gray-800 rounded flex items-center justify-center text-2xl">
                      {video.thumbnail}
                    </div>
                    {video.live && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] px-1 py-0.5 rounded font-bold">LIVE</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium line-clamp-2">{video.title}</h4>
                    <p className="text-xs text-gray-400 mt-1">{video.channel}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{video.views} views</span>
                      <span>•</span>
                      <span>{video.time}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            <div className="p-3 border-t border-white/10">
              <a href="https://www.youtube.com/@thaddeustechz" target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-red-400 hover:text-red-300 font-medium">
                Subscribe to ThaddeusTechz on YouTube →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Charts Panel Component
const ChartsPanel = () => {
  const [showCharts, setShowCharts] = useState(false)

  const conflictData = [
    { month: 'Jan', conflicts: 45, resolved: 12 },
    { month: 'Feb', conflicts: 52, resolved: 18 },
    { month: 'Mar', conflicts: 48, resolved: 15 },
    { month: 'Apr', conflicts: 61, resolved: 22 },
    { month: 'May', conflicts: 55, resolved: 19 },
    { month: 'Jun', conflicts: 47, resolved: 21 }
  ]

  const regionData = [
    { name: 'Middle East', value: 35, color: '#ef4444' },
    { name: 'Europe', value: 25, color: '#6366f1' },
    { name: 'Asia', value: 20, color: '#10b981' },
    { name: 'Africa', value: 15, color: '#f59e0b' },
    { name: 'Americas', value: 5, color: '#06b6d4' }
  ]

  return (
    <>
      <button
        onClick={() => setShowCharts(!showCharts)}
        className="absolute bottom-4 right-4 z-[1000] glass-strong rounded-xl p-3 hover:bg-white/10 transition flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-sm font-medium">Analytics</span>
      </button>

      <AnimatePresence>
        {showCharts && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-4 right-4 z-[1000] w-[600px] glass-strong rounded-xl p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">📊 Analytics Dashboard</h3>
              <button onClick={() => setShowCharts(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="chart-container">
                <h4 className="text-sm font-medium mb-2 text-gray-400">Conflicts Overview</h4>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={conflictData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                    <XAxis dataKey="month" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1f1f2e', borderRadius: '8px' }} />
                    <Bar dataKey="conflicts" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="chart-container">
                <h4 className="text-sm font-medium mb-2 text-gray-400">Regional Distribution</h4>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={regionData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">
                      {regionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1f1f2e', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Map Markers Component
const MapMarkers = () => {
  const { layers, setSelectedRegion } = useApp()

  // Comprehensive marker data
  const markers = {
    conflicts: [
      { id: 1, lat: 50.0, lng: 34.0, title: 'Eastern Europe Conflict Zone', severity: 'critical', description: 'Active warfare with international involvement', country: 'Ukraine/Russia', casualties: 12500 },
      { id: 2, lat: 33.2, lng: 43.7, title: 'Middle East Tensions', severity: 'high', description: 'Multiple armed groups active in region', country: 'Iraq/Syria', casualties: 8900 },
      { id: 3, lat: 12.5, lng: 18.5, title: 'Central Africa Crisis', severity: 'high', description: 'Humanitarian crisis deepening', country: 'CAR', casualties: 4500 },
      { id: 4, lat: 34.8, lng: 69.1, title: 'South Asia Instability', severity: 'medium', description: 'Regional tensions escalating', country: 'Afghanistan', casualties: 2300 },
      { id: 5, lat: 15.5, lng: 118.5, title: 'South China Sea Disputes', severity: 'medium', description: 'Multiple nations claiming territory', country: 'Regional', casualties: 0 },
      { id: 6, lat: 42.5, lng: 21.5, title: 'Balkans Tensions', severity: 'low', description: 'Ethnic tensions monitored', country: 'Balkans', casualties: 120 },
    ],
    bases: [
      { id: 1, lat: 38.87, lng: -77.06, title: 'US Pentagon', type: 'HQ', country: 'USA', units: 25000 },
      { id: 2, lat: 55.75, lng: 37.62, title: 'Russian Defense HQ', type: 'HQ', country: 'Russia', units: 30000 },
      { id: 3, lat: 39.90, lng: 116.41, title: 'PLA Central Command', type: 'HQ', country: 'China', units: 28000 },
      { id: 4, lat: 51.50, lng: -0.13, title: 'UK Ministry of Defence', type: 'HQ', country: 'UK', units: 8000 },
      { id: 5, lat: 48.86, lng: 2.35, title: 'French Defense HQ', type: 'HQ', country: 'France', units: 15000 },
      { id: 6, lat: 35.18, lng: 33.36, title: 'NATO Command', type: 'HQ', country: 'NATO', units: 12000 },
    ],
    hotspots: [
      { id: 1, lat: 31.0, lng: 35.0, title: 'Middle East Hotspot', intensity: 92, description: 'Multiple conflicts active', countries: ['Israel', 'Palestine', 'Syria'] },
      { id: 2, lat: 54.7, lng: -115.0, title: 'North America Border', intensity: 45, description: 'Increased activity', countries: ['USA', 'Mexico'] },
      { id: 3, lat: 35.7, lng: 139.7, title: 'East China Sea', intensity: 78, description: 'Naval tensions', countries: ['China', 'Japan'] },
      { id: 4, lat: 22.3, lng: 114.2, title: 'South China Sea', intensity: 85, description: 'Territorial disputes', countries: ['Multiple'] },
    ],
    nuclear: [
      { id: 1, lat: 37.42, lng: 141.03, title: 'Fukushima Daiichi', type: 'Nuclear Plant', status: 'Monitoring', country: 'Japan', capacity: 4690 },
      { id: 2, lat: 28.8, lng: 51.0, title: 'Bushehr Nuclear', type: 'Nuclear Plant', status: 'Active', country: 'Iran', capacity: 1000 },
      { id: 3, lat: 47.5, lng: 34.6, title: 'Zaporizhzhia', type: 'Nuclear Plant', status: 'Controversial', country: 'Ukraine', capacity: 5700 },
      { id: 4, lat: 45.98, lng: -119.5, title: 'Hanford Site', type: 'Research', status: 'Decommissioning', country: 'USA', capacity: 0 },
      { id: 5, lat: 36.7, lng: 3.2, title: 'Algeria Nuclear', type: 'Research', status: 'Active', country: 'Algeria', capacity: 0 },
    ],
    weather: [
      { id: 1, lat: 25.0, lng: -70.0, title: 'Hurricane Season Atlantic', type: 'Hurricane', severity: 'warning', windSpeed: 145, category: 4 },
      { id: 2, lat: 15.0, lng: 135.0, title: 'Typhoon Warning Pacific', type: 'Typhoon', severity: 'watch', windSpeed: 120, category: 3 },
      { id: 3, lat: -25.0, lng: 130.0, title: 'Australian Heatwave', type: 'Extreme Heat', severity: 'alert', temperature: 48, category: 0 },
      { id: 4, lat: 20.0, lng: 80.0, title: 'South Asian Monsoon', type: 'Flood', severity: 'warning', rainfall: 'Heavy', category: 0 },
    ],
    earthquakes: [
      { id: 1, lat: 35.5, lng: 140.0, title: 'Japan Earthquake', magnitude: 5.8, depth: 30, time: '10 min ago' },
      { id: 2, lat: -4.0, lng: -79.0, title: 'Peru Earthquake', magnitude: 6.2, depth: 45, time: '25 min ago' },
      { id: 3, lat: 38.0, lng: 38.0, title: 'Turkey Earthquake', magnitude: 4.5, depth: 20, time: '1 hour ago' },
      { id: 4, lat: -33.0, lng: -71.0, title: 'Chile Earthquake', magnitude: 5.1, depth: 60, time: '2 hours ago' },
    ],
    military: [
      { id: 1, lat: 55.5, lng: 24.0, title: 'NATO Exercises Baltic', type: 'Exercise', units: 5000, countries: ['USA', 'UK', 'Germany'] },
      { id: 2, lat: 20.0, lng: 130.0, title: 'Pacific Naval Operations', type: 'Naval', units: 3400, countries: ['USA', 'Japan', 'Australia'] },
      { id: 3, lat: 33.0, lng: 36.0, title: 'Middle East Patrol', type: 'Patrol', units: 1200, countries: ['Turkey', 'Russia'] },
    ]
  }

  const getMarkerColor = (severity) => {
    const colors = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }
    return colors[severity] || '#6366f1'
  }

  return (
    <>
      {layers.conflicts && markers.conflicts.map(marker => (
        <Marker key={`conflict-${marker.id}`} position={[marker.lat, marker.lng]} eventHandlers={{ click: () => setSelectedRegion(marker), }}>
          <Popup>
            <div className="text-black p-2 min-w-[200px]">
              <h3 className="font-bold text-base">{marker.title}</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-1 rounded text-xs font-bold text-white ${marker.severity === 'critical' ? 'bg-red-600' : marker.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}`}>
                  {marker.severity.toUpperCase()}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{marker.description}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-100 p-2 rounded">📍 {marker.country}</div>
                <div className="bg-gray-100 p-2 rounded">💀 {marker.casualties.toLocaleString()}</div>
              </div>
              <div className="mt-2 text-xs text-gray-400">Coordinated: {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.bases && markers.bases.map(marker => (
        <Marker key={`base-${marker.id}`} position={[marker.lat, marker.lng]} eventHandlers={{ click: () => setSelectedRegion(marker), }}>
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-base">🎖️ {marker.title}</h3>
              <p className="text-sm">Type: {marker.type}</p>
              <p className="text-sm">Country: {marker.country}</p>
              <p className="text-sm">Personnel: {marker.units.toLocaleString()}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.hotspots && markers.hotspots.map(marker => (
        <Circle key={`hotspot-${marker.id}`} center={[marker.lat, marker.lng]} radius={marker.intensity * 8000} pathOptions={{ color: marker.intensity > 70 ? '#ef4444' : '#f59e0b', fillColor: marker.intensity > 70 ? '#ef4444' : '#f59e0b', fillOpacity: 0.3, weight: 2, dashArray: '5, 10' }} eventHandlers={{ click: () => setSelectedRegion(marker), }}>
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-base">🔥 {marker.title}</h3>
              <div className="mt-2">
                <div className="text-sm font-medium">Risk Intensity: {marker.intensity}%</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div className={`h-2 rounded-full ${marker.intensity > 70 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${marker.intensity}%` }} />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600">{marker.description}</p>
            </div>
          </Popup>
        </Circle>
      ))}

      {layers.nuclear && markers.nuclear.map(marker => (
        <Marker key={`nuclear-${marker.id}`} position={[marker.lat, marker.lng]} eventHandlers={{ click: () => setSelectedRegion(marker), }}>
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-base">☢️ {marker.title}</h3>
              <p className="text-sm">Type: {marker.type}</p>
              <p className="text-sm">Country: {marker.country}</p>
              <p className="text-sm">Status: {marker.status}</p>
              <p className="text-sm">Capacity: {marker.capacity} MW</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.weather && markers.weather.map(marker => (
        <Marker key={`weather-${marker.id}`} position={[marker.lat, marker.lng]} eventHandlers={{ click: () => setSelectedRegion(marker), }}>
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-base">🌪️ {marker.title}</h3>
              <p className="text-sm">Type: {marker.type}</p>
              {marker.windSpeed && <p className="text-sm">Wind: {marker.windSpeed} mph</p>}
              {marker.temperature && <p className="text-sm">Temp: {marker.temperature}°C</p>}
              <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-bold text-white ${marker.severity === 'alert' ? 'bg-red-500' : 'bg-orange-500'}`}>
                {marker.severity.toUpperCase()}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.natural && markers.earthquakes.map(marker => (
        <Marker key={`quake-${marker.id}`} position={[marker.lat, marker.lng]} eventHandlers={{ click: () => setSelectedRegion(marker), }}>
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-base">🌍 {marker.title}</h3>
              <p className="text-sm">Magnitude: {marker.magnitude}</p>
              <p className="text-sm">Depth: {marker.depth} km</p>
              <p className="text-sm">Time: {marker.time}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.military && markers.military.map(marker => (
        <Marker key={`military-${marker.id}`} position={[marker.lat, marker.lng]} eventHandlers={{ click: () => setSelectedRegion(marker), }}>
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-base">🛡️ {marker.title}</h3>
              <p className="text-sm">Type: {marker.type}</p>
              <p className="text-sm">Units: {marker.units.toLocaleString()}</p>
              <p className="text-sm">Countries: {marker.countries.join(', ')}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

// Selected Region Detail Panel
const RegionDetailPanel = () => {
  const { selectedRegion, setSelectedRegion } = useApp()

  if (!selectedRegion) return null

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, x: -100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} className="absolute left-4 bottom-24 z-[1000] w-80 glass-strong rounded-xl p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{selectedRegion.title}</h3>
          <button onClick={() => setSelectedRegion(null)} className="text-gray-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {selectedRegion.severity && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Severity:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                selectedRegion.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                selectedRegion.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {selectedRegion.severity.toUpperCase()}
              </span>
            </div>
          )}

          {selectedRegion.description && (
            <p className="text-sm text-gray-300">{selectedRegion.description}</p>
          )}

          {selectedRegion.casualties !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Casualties:</span>
              <span className="text-red-400 font-bold">{selectedRegion.casualties.toLocaleString()}</span>
            </div>
          )}

          <div className="pt-3 border-t border-white/10">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Latitude</span>
                <div className="font-mono text-primary-400">{selectedRegion.lat?.toFixed(4)}</div>
              </div>
              <div>
                <span className="text-gray-400">Longitude</span>
                <div className="font-mono text-primary-400">{selectedRegion.lng?.toFixed(4)}</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex gap-2">
            <button className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium transition">
              View Full Report
            </button>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition">
              📊
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// Search Component
const SearchBar = () => {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)

  const defaultResults = [
    { id: 1, type: 'location', name: 'Ukraine', category: 'Country', icon: '🇺🇦' },
    { id: 2, type: 'event', name: 'Russia-Ukraine Conflict', category: 'Conflict', icon: '💥' },
    { id: 3, type: 'location', name: 'Middle East', category: 'Region', icon: '🌍' },
    { id: 4, type: 'location', name: 'South China Sea', category: 'Region', icon: '🌊' },
    { id: 5, type: 'event', name: 'NATO Exercises 2024', category: 'Military', icon: '🛡️' },
  ]

  const results = query.length > 2 ? defaultResults.filter(r => r.name.toLowerCase().includes(query.toLowerCase())) : []

  return (
    <div className="relative">
      <div className="flex items-center gap-2 glass rounded-full px-4 py-2 w-80 border border-transparent focus-within:border-primary-500 transition">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setShowResults(e.target.value.length > 2) }} placeholder="Search countries, events..." className="bg-transparent border-none outline-none text-sm flex-1 placeholder-gray-400" />
        <kbd className="px-2 py-1 rounded bg-white/10 text-xs text-gray-400">Ctrl+K</kbd>
      </div>

      {showResults && results.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full mt-2 w-full glass-strong rounded-xl overflow-hidden shadow-xl">
          {results.map(result => (
            <button key={result.id} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition text-left">
              <span className="text-xl">{result.icon}</span>
              <div>
                <div className="text-sm font-medium">{result.name}</div>
                <div className="text-xs text-gray-400">{result.category}</div>
              </div>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

// Header Component
function Header() {
  const { darkMode, setDarkMode, addNotification, lastUpdate } = useApp()
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  return (
    <header className="h-16 bg-worldgpz-card/80 backdrop-blur-xl border-b border-worldgpz-border sticky top-0 z-[1500]">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.div whileHover={{ scale: 1.1 }} className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg glow-effect">
            <span className="text-2xl">🌍</span>
          </motion.div>
          <div>
            <h1 className="text-lg font-bold gradient-text">WORLDGPZ</h1>
            <p className="text-[10px] text-gray-400">Global Monitoring Platform</p>
          </div>
        </div>

        <div className="hidden md:block">
          <SearchBar />
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-400 font-bold">LIVE</span>
            <span className="text-xs text-gray-400 ml-1">• {format(lastUpdate, 'HH:mm:ss')}</span>
          </div>

          <button onClick={() => addNotification({ title: 'Alert', message: 'New event detected', icon: '🚨' })} className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>

          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-2">
            <div className="text-right hidden md:block">
              <div className="text-xs font-medium">ThaddeusTechz</div>
              <div className="text-[10px] text-gray-400">Admin</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-sm font-bold">
              TT
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

// Main App Component
function App() {
  const [data, setData] = useState({
    conflicts: 47,
    weather: 128,
    military: 89,
    earthquakes: 23,
    economic: 34,
    news: 156
  })

  return (
    <AppProvider>
      <div className="min-h-screen bg-worldgpz-dark">
        <Header />
        <LiveFeedTicker />
        <main className="relative h-[calc(100vh-64px)]">
          <div className="absolute inset-0">
            <MapContainer center={[20, 0]} zoom={2.5} className="h-full w-full" zoomControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
              <MapMarkers />
              <MapControls />
            </MapContainer>
          </div>
          <LayerLegend />
          <TimeRangeSelector />
          <StatsDashboard data={data} />
          <AIInsightsPanel />
          <NewsFeed />
          <YouTubePanel />
          <ChartsPanel />
          <RegionDetailPanel />
        </main>
      </div>
    </AppProvider>
  )
}

export default App
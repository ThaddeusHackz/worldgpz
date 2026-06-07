import React, { useState, useEffect, createContext, useContext } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, useMap } from 'react-leaflet'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { format, subDays, subHours } from 'date-fns'

// Context for global state
const AppContext = createContext()

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
  const [aiInsights, setAiInsights] = useState([])
  const [loading, setLoading] = useState(true)

  const toggleLayer = (layer) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }))
  }

  const addNotification = (notification) => {
    setNotifications(prev => [...prev, { ...notification, id: Date.now() }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== Date.now()))
    }, 5000)
  }

  return (
    <AppContext.Provider value={{
      layers, setLayers, toggleLayer,
      timeRange, setTimeRange,
      darkMode, setDarkMode,
      selectedRegion, setSelectedRegion,
      notifications, setNotifications, addNotification,
      aiInsights, setAiInsights,
      loading, setLoading
    }}>
      {children}
    </AppContext.Provider>
  )
}

// Custom Hook for App Context
const useApp = () => useContext(AppContext)

// Map Controls Component
const MapControls = () => {
  const map = useMap()
  const { setSelectedRegion } = useApp()

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <button
        onClick={() => map.zoomIn()}
        className="w-10 h-10 bg-worldgpz-card border border-worldgpz-border rounded-lg text-white hover:bg-worldgpz-border transition flex items-center justify-center"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
        </svg>
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-10 h-10 bg-worldgpz-card border border-worldgpz-border rounded-lg text-white hover:bg-worldgpz-border transition flex items-center justify-center"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
        </svg>
      </button>
      <button
        onClick={() => { map.setView([20, 0], 2); setSelectedRegion(null) }}
        className="w-10 h-10 bg-worldgpz-card border border-worldgpz-border rounded-lg text-white hover:bg-worldgpz-border transition flex items-center justify-center"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
        </svg>
      </button>
    </div>
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
    { key: 'iranAttacks', label: 'Iran Attacks', color: 'bg-rose-500', icon: '💫' }
  ]

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="absolute left-4 top-24 z-[1000] glass rounded-xl p-4 max-w-[200px]"
    >
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    { key: '24h', label: '24 Hours' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: '1y', label: '1 Year' }
  ]

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] glass rounded-full px-2 py-1 flex items-center gap-1"
    >
      {ranges.map(range => (
        <button
          key={range.key}
          onClick={() => setTimeRange(range.key)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            timeRange === range.key
              ? 'bg-primary-600 text-white'
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
    { label: 'Economic Alerts', value: data?.economic || 34, icon: '📊', color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Natural Disasters', value: data?.natural || 23, icon: '🌍', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Nuclear Facilities', value: data?.nuclear || 412, icon: '☢️', color: 'text-yellow-400', bg: 'bg-yellow-500/10' }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`data-card glass rounded-xl p-4 ${stat.bg} border border-transparent hover:border-primary-500/30`}
        >
          <div className="text-2xl mb-2">{stat.icon}</div>
          <div className={`text-2xl font-bold ${stat.color}`}>
            <span className="stat-count">{stat.value}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  )
}

// AI Insights Panel
const AIInsightsPanel = () => {
  const { aiInsights } = useApp()

  const defaultInsights = [
    {
      id: 1,
      type: 'alert',
      title: 'Escalating Tensions Detected',
      description: 'AI analysis suggests increased military activity in Eastern Europe. Recommend monitoring closely.',
      severity: 'high',
      confidence: 94
    },
    {
      id: 2,
      type: 'prediction',
      title: 'Weather Pattern Forecast',
      description: 'Multiple hurricane systems forming in Atlantic. Potential impact on coastal regions within 7 days.',
      severity: 'medium',
      confidence: 89
    },
    {
      id: 3,
      type: 'analysis',
      title: 'Economic Trend Analysis',
      description: 'Supply chain disruptions detected in key shipping routes. Impact on global trade expected.',
      severity: 'medium',
      confidence: 87
    },
    {
      id: 4,
      type: 'insight',
      title: 'Regional Stability Index',
      description: 'Middle East stability index has decreased by 12% over the past month. Multiple factors contributing.',
      severity: 'high',
      confidence: 91
    }
  ]

  const insights = aiInsights.length > 0 ? aiInsights : defaultInsights

  return (
    <motion.div
      initial={{ x: 300 }}
      animate={{ x: 0 }}
      className="absolute right-4 top-24 z-[1000] w-80 max-h-[500px] overflow-y-auto"
    >
      <div className="glass-strong rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-sm">🤖</span>
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Insights</h3>
            <p className="text-xs text-gray-400">Real-time analysis</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <motion.div
              key={insight.id || i}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className={`ai-insight cursor-pointer hover:border-primary-400/50 transition`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${
                  insight.severity === 'high' ? 'bg-red-500' : 
                  insight.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <span className="text-xs text-gray-400 uppercase">{insight.type}</span>
                <span className="ml-auto text-xs text-primary-400">{insight.confidence}% confidence</span>
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

// News Feed Component
const NewsFeed = () => {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock news data - in production, fetch from News API
    const mockNews = [
      { id: 1, title: 'Global Economic Summit Concludes with New Trade Agreements', source: 'Reuters', time: '2 hours ago', category: 'Economic' },
      { id: 2, title: 'Climate Conference Reaches Historic Agreement on Emissions', source: 'AP News', time: '3 hours ago', category: 'Climate' },
      { id: 3, title: 'UN Security Council Meets on Regional Conflicts', source: 'BBC', time: '4 hours ago', category: 'Security' },
      { id: 4, title: 'Major Tech Company Announces New AI Initiative', source: 'TechCrunch', time: '5 hours ago', category: 'Technology' },
      { id: 5, title: 'Energy Crisis Prompts Emergency Measures in Europe', source: 'DW', time: '6 hours ago', category: 'Energy' }
    ]
    setNews(mockNews)
    setLoading(false)
  }, [])

  return (
    <motion.div
      initial={{ y: 300 }}
      animate={{ y: 0 }}
      className="absolute bottom-20 left-4 z-[1000] w-96 max-h-[300px] overflow-y-auto"
    >
      <div className="glass-strong rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="live-indicator w-2 h-2 rounded-full bg-green-500" />
            Live News Feed
          </h3>
          <span className="text-xs text-gray-400">Updated: Just now</span>
        </div>
        
        <div className="space-y-3">
          {news.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer"
            >
              <div className={`w-1 rounded-full ${
                item.category === 'Economic' ? 'bg-green-500' :
                item.category === 'Climate' ? 'bg-cyan-500' :
                item.category === 'Security' ? 'bg-red-500' :
                item.category === 'Technology' ? 'bg-purple-500' :
                'bg-yellow-500'
              }`} />
              <div className="flex-1">
                <h4 className="text-sm font-medium line-clamp-2">{item.title}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span>{item.source}</span>
                  <span>•</span>
                  <span>{item.time}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
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

  const economicData = [
    { month: 'Jan', gdp: 2.4, inflation: 3.2 },
    { month: 'Feb', gdp: 2.8, inflation: 3.1 },
    { month: 'Mar', gdp: 2.6, inflation: 3.4 },
    { month: 'Apr', gdp: 2.9, inflation: 3.3 },
    { month: 'May', gdp: 3.1, inflation: 3.5 },
    { month: 'Jun', gdp: 3.0, inflation: 3.6 }
  ]

  return (
    <>
      <button
        onClick={() => setShowCharts(!showCharts)}
        className="absolute bottom-20 right-4 z-[1000] glass-strong rounded-xl p-3 hover:bg-white/10 transition flex items-center gap-2"
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
            className="absolute bottom-20 right-4 z-[1000] w-[600px] glass-strong rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Analytics Dashboard</h3>
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
              
              <div className="col-span-2 chart-container">
                <h4 className="text-sm font-medium mb-2 text-gray-400">Economic Indicators</h4>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={economicData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                    <XAxis dataKey="month" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1f1f2e', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="gdp" stroke="#6366f1" fill="#6366f1/20" />
                    <Area type="monotone" dataKey="inflation" stroke="#f59e0b" fill="#f59e0b/20" />
                  </AreaChart>
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
  const { layers, selectedRegion, setSelectedRegion } = useApp()

  // Sample marker data - in production, fetch from backend API
  const markers = {
    conflicts: [
      { id: 1, lat: 33.2232, lng: 43.6793, title: 'Iraq Conflict Zone', severity: 'high', description: 'Active military operations ongoing' },
      { id: 2, lat: 34.8021, lng: 38.9968, title: 'Syria Crisis', severity: 'critical', description: 'Ongoing civil war with international involvement' },
      { id: 3, lat: 48.0195, lng: 66.9237, title: 'Afghanistan Tension', severity: 'high', description: 'Regional instability increasing' },
      { id: 4, lat: 35.8618, lng: 104.1954, title: 'South China Sea', severity: 'medium', description: 'Maritime disputes escalating' },
      { id: 5, lat: 54.5260, lng: 15.2551, title: 'Ukraine Conflict', severity: 'critical', description: 'Active warfare with international implications' }
    ],
    bases: [
      { id: 1, lat: 38.8719, lng: -77.0563, title: 'US Pentagon', type: 'Military HQ', country: 'USA' },
      { id: 2, lat: 55.7558, lng: 37.6173, title: 'Russian Defense HQ', type: 'Military HQ', country: 'Russia' },
      { id: 3, lat: 39.9042, lng: 116.4074, title: 'China Central Military', type: 'Military HQ', country: 'China' },
      { id: 4, lat: 51.5074, lng: -0.1278, title: 'UK MOD', type: 'Military HQ', country: 'UK' },
      { id: 5, lat: 48.8566, lng: 2.3522, title: 'French Defense', type: 'Military HQ', country: 'France' }
    ],
    hotspots: [
      { id: 1, lat: 31.0461, lng: 34.8516, title: 'Middle East', intensity: 85, description: 'Multiple conflicts active' },
      { id: 2, lat: 50.0647, lng: -115.1234, title: 'North America Border', intensity: 45, description: 'Tension increasing' },
      { id: 3, lat: 35.6762, lng: 139.6503, title: 'East China Sea', intensity: 72, description: 'Naval activity elevated' },
      { id: 4, lat: -30.5595, lng: 22.9375, title: 'Sahara Region', intensity: 38, description: 'Regional instability' }
    ],
    nuclear: [
      { id: 1, lat: 41.4036, lng: -73.9626, title: 'San Onofre', type: 'Nuclear Plant', status: 'Decommissioned' },
      { id: 2, lat: 51.0122, lng: -114.0806, title: 'CANDU Reactors', type: 'Nuclear Plant', status: 'Active' },
      { id: 3, lat: 35.7133, lng: 139.4878, title: 'Fukushima', type: 'Nuclear Plant', status: 'Monitoring' },
      { id: 4, lat: 37.1438, lng: 55.1029, title: 'Bushehr', type: 'Nuclear Plant', status: 'Active' },
      { id: 5, lat: 55.7558, lng: 37.6173, title: 'Nuclear Facilities', type: 'Research', status: 'Active' }
    ],
    weather: [
      { id: 1, lat: 25.7617, lng: -80.1918, title: 'Hurricane Zone', type: 'Hurricane', severity: 'warning' },
      { id: 2, lat: 35.6762, lng: 139.6503, title: 'Typhoon Path', type: 'Typhoon', severity: 'watch' },
      { id: 3, lat: 51.5074, lng: -0.1278, title: 'Storm System', type: 'Storm', severity: 'advisory' },
      { id: 4, lat: -33.8688, lng: 151.2093, title: 'Heat Wave', type: 'Extreme Heat', severity: 'alert' }
    ],
    military: [
      { id: 1, lat: 54.6872, lng: 25.2797, title: 'NATO Exercises', type: 'Exercise', units: 5000 },
      { id: 2, lat: 31.7683, lng: 35.2137, title: 'Regional Patrol', type: 'Patrol', units: 1200 },
      { id: 3, lat: 24.8607, lng: 67.0011, title: 'Naval Operations', type: 'Naval', units: 3400 }
    ]
  }

  const getMarkerIcon = (type, severity) => {
    const colors = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#22c55e',
      warning: '#f59e0b',
      watch: '#3b82f6',
      alert: '#ef4444',
      advisory: '#06b6d4'
    }
    return colors[severity] || '#6366f1'
  }

  return (
    <>
      {layers.conflicts && markers.conflicts.map(marker => (
        <Marker
          key={`conflict-${marker.id}`}
          position={[marker.lat, marker.lng]}
          eventHandlers={{
            click: () => setSelectedRegion(marker),
          }}
        >
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-lg">{marker.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-1 rounded text-xs font-medium text-white bg-${marker.severity === 'critical' ? 'red-600' : marker.severity === 'high' ? 'orange-600' : 'yellow-600'}`}>
                  {marker.severity.toUpperCase()}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{marker.description}</p>
              <div className="mt-2 text-xs text-gray-500">
                Coordinates: {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.bases && markers.bases.map(marker => (
        <Marker
          key={`base-${marker.id}`}
          position={[marker.lat, marker.lng]}
          eventHandlers={{
            click: () => setSelectedRegion(marker),
          }}
        >
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-lg">{marker.title}</h3>
              <p className="text-sm text-gray-600">Type: {marker.type}</p>
              <p className="text-sm text-gray-600">Country: {marker.country}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.hotspots && markers.hotspots.map(marker => (
        <Circle
          key={`hotspot-${marker.id}`}
          center={[marker.lat, marker.lng]}
          radius={marker.intensity * 10000}
          pathOptions={{
            color: getMarkerIcon(null, marker.intensity > 70 ? 'high' : 'medium'),
            fillColor: getMarkerIcon(null, marker.intensity > 70 ? 'high' : 'medium'),
            fillOpacity: 0.3,
            weight: 2
          }}
          eventHandlers={{
            click: () => setSelectedRegion(marker),
          }}
        >
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-lg">{marker.title}</h3>
              <div className="mt-2">
                <div className="text-sm font-medium">Intensity: {marker.intensity}%</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-orange-500 h-2 rounded-full" 
                    style={{ width: `${marker.intensity}%` }}
                  />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600">{marker.description}</p>
            </div>
          </Popup>
        </Circle>
      ))}

      {layers.nuclear && markers.nuclear.map(marker => (
        <Marker
          key={`nuclear-${marker.id}`}
          position={[marker.lat, marker.lng]}
          eventHandlers={{
            click: () => setSelectedRegion(marker),
          }}
        >
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-lg">☢️ {marker.title}</h3>
              <p className="text-sm text-gray-600">Type: {marker.type}</p>
              <p className="text-sm text-gray-600">Status: {marker.status}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.weather && markers.weather.map(marker => (
        <Marker
          key={`weather-${marker.id}`}
          position={[marker.lat, marker.lng]}
          eventHandlers={{
            click: () => setSelectedRegion(marker),
          }}
        >
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-lg">🌪️ {marker.title}</h3>
              <p className="text-sm text-gray-600">Type: {marker.type}</p>
              <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium text-white ${
                marker.severity === 'alert' ? 'bg-red-500' : 
                marker.severity === 'warning' ? 'bg-orange-500' : 
                'bg-blue-500'
              }`}>
                {marker.severity.toUpperCase()}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}

      {layers.military && markers.military.map(marker => (
        <Marker
          key={`military-${marker.id}`}
          position={[marker.lat, marker.lng]}
          eventHandlers={{
            click: () => setSelectedRegion(marker),
          }}
        >
          <Popup>
            <div className="text-black p-2">
              <h3 className="font-bold text-lg">🛡️ {marker.title}</h3>
              <p className="text-sm text-gray-600">Type: {marker.type}</p>
              <p className="text-sm text-gray-600">Units: {marker.units.toLocaleString()}</p>
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
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        className="absolute left-4 bottom-20 z-[1000] w-80 glass-strong rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{selectedRegion.title}</h3>
          <button 
            onClick={() => setSelectedRegion(null)}
            className="text-gray-400 hover:text-white transition"
          >
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

          <div className="pt-3 border-t border-white/10">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Latitude</span>
                <div className="font-mono">{selectedRegion.lat?.toFixed(4)}</div>
              </div>
              <div>
                <span className="text-gray-400">Longitude</span>
                <div className="font-mono">{selectedRegion.lng?.toFixed(4)}</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex gap-2">
            <button className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium transition">
              View Details
            </button>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition">
              📊 Report
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// Notification Toast Component
const NotificationToast = () => {
  const { notifications } = useApp()

  return (
    <div className="fixed top-20 right-4 z-[2000] space-y-2">
      <AnimatePresence>
        {notifications.map(notification => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="toast glass-strong rounded-xl p-4 flex items-center gap-3 min-w-[300px]"
          >
            <span className="text-2xl">{notification.icon || 'ℹ️'}</span>
            <div className="flex-1">
              <h4 className="font-medium text-sm">{notification.title}</h4>
              <p className="text-xs text-gray-400">{notification.message}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// Search Component
const SearchBar = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)

  const handleSearch = (value) => {
    setQuery(value)
    if (value.length > 2) {
      // Mock search results
      const mockResults = [
        { id: 1, type: 'location', name: 'Ukraine', category: 'Region' },
        { id: 2, type: 'event', name: 'Russia-Ukraine Conflict', category: 'Conflict' },
        { id: 3, type: 'location', name: 'Middle East', category: 'Region' },
        { id: 4, type: 'event', name: 'Climate Summit 2024', category: 'Event' }
      ].filter(item => item.name.toLowerCase().includes(value.toLowerCase()))
      setResults(mockResults)
      setShowResults(true)
    } else {
      setResults([])
      setShowResults(false)
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 glass rounded-full px-4 py-2 w-80">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search locations, events..."
          className="bg-transparent border-none outline-none text-sm flex-1 placeholder-gray-400"
        />
        <kbd className="px-2 py-1 rounded bg-white/10 text-xs text-gray-400">Ctrl+K</kbd>
      </div>

      {showResults && results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-2 w-full glass-strong rounded-xl overflow-hidden"
        >
          {results.map(result => (
            <button
              key={result.id}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition text-left"
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                result.type === 'location' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {result.type === 'location' ? '📍' : '⚠️'}
              </span>
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

// Main App Component
function App() {
  const [data, setData] = useState({
    conflicts: 47,
    weather: 128,
    military: 89,
    economic: 34,
    natural: 23,
    nuclear: 412
  })

  return (
    <AppProvider>
      <div className="min-h-screen bg-worldgpz-dark">
        {/* Header */}
        <Header />
        
        {/* Main Content */}
        <main className="relative h-[calc(100vh-80px)]">
          {/* Map Container */}
          <div className="absolute inset-0">
            <MapContainer
              center={[20, 0]}
              zoom={2}
              className="h-full w-full"
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <MapMarkers />
              <MapControls />
            </MapContainer>
          </div>

          {/* Overlays */}
          <LayerLegend />
          <TimeRangeSelector />
          <AIInsightsPanel />
          <NewsFeed />
          <ChartsPanel />
          <RegionDetailPanel />
          <NotificationToast />
          
          {/* Stats Dashboard */}
          <div className="absolute top-20 left-4 z-[999]">
            <StatsDashboard data={data} />
          </div>
        </main>
      </div>
    </AppProvider>
  )
}

// Header Component
function Header() {
  const { darkMode, setDarkMode, addNotification } = useApp()
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  return (
    <header className="h-20 bg-worldgpz-card/80 backdrop-blur-xl border-b border-worldgpz-border sticky top-0 z-[1500]">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg glow-effect"
          >
            <span className="text-2xl">🌍</span>
          </motion.div>
          <div>
            <h1 className="text-xl font-bold gradient-text">WORLDGPZ</h1>
            <p className="text-xs text-gray-400">Global Monitoring Platform</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="hidden md:block">
          <SearchBar />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Live Indicator */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30">
            <span className="live-indicator w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-400 font-medium">LIVE</span>
          </div>

          {/* Notifications */}
          <button 
            onClick={() => addNotification({ title: 'New Alert', message: 'Conflict escalation detected in Eastern Europe', icon: '🚨' })}
            className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>

          {/* Dark Mode Toggle */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
          >
            {darkMode ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Profile */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="text-sm font-medium">ThaddeusTechz</div>
              <div className="text-xs text-gray-400">Admin</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
              <span className="text-sm font-bold">TT</span>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 rounded-lg bg-white/5"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

export default App
import { useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import BootSequence from './components/BootSequence.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import AdminKeys from './pages/AdminKeys.jsx';
import About from './pages/About.jsx';
import NotFound from './pages/NotFound.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="route-loading"><span className="loading-orbit" />Verifying administrator session…</div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const [booted, setBooted] = useState(false);
  const finishBoot = useCallback(() => setBooted(true), []);
  if (!booted) return <BootSequence onComplete={finishBoot} />;
  return <AuthProvider><BrowserRouter>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/about" element={<About />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/admin/keys" element={<ProtectedRoute><AdminKeys /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter></AuthProvider>;
}

export default function App() { return <AppRoutes />; }

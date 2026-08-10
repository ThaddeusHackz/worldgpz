import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Operations = lazy(() => import("./pages/Operations.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

function ProtectedRoute({ children }) {
  const { authenticated, loading } = useAuth();
  if (loading) return <LoadingScreen label="Validating secure session" />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/operations" element={<Operations />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

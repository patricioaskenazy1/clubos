import React from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canRead } from "./permissions";
import { ModuleKey } from "./api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Plantilla from "./pages/Plantilla";
import Scouting from "./pages/Scouting";
import Video from "./pages/Video";
import Entrenamientos from "./pages/Entrenamientos";
import DataAnalyst from "./pages/DataAnalyst";
import FisicoMedico from "./pages/FisicoMedico";
import FichaJugador from "./pages/FichaJugador";
import Usuarios from "./pages/Usuarios";

const NAV_ITEMS: { to: string; label: string; module?: ModuleKey }[] = [
  { to: "/plantilla", label: "Gestion", module: "gestion" },
  { to: "/data", label: "Data", module: "data" },
  { to: "/scouting", label: "Scouting", module: "scouting" },
  { to: "/video", label: "Video", module: "video" },
  { to: "/entrenamientos", label: "Entrenamientos", module: "entrenamientos" },
  { to: "/fisico-medico", label: "Fisico-medico", module: "fisico_medico" },
];

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <div className="topnav">
        <div className="brand">
          <div className="brand-mark">FC</div>
          <div className="brand-name">ClubOS</div>
        </div>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            Resumen
          </NavLink>
          {NAV_ITEMS.filter((item) => !item.module || canRead(user, item.module)).map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
          {user?.role === "ADMIN" && (
            <NavLink to="/usuarios" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              Usuarios
            </NavLink>
          )}
        </nav>
        <div className="user-chip">
          <div className="avatar" />
          <span>
            {user?.name} · {user?.roleLabel ?? user?.role}
          </span>
          <button
            className="logout-btn"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Salir
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function ProtectedRoute({ children, module }: { children: React.ReactNode; module?: ModuleKey }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Ademas de estar logueado, si la pantalla pertenece a un sector, el rol
  // tiene que tener lectura de ese sector -- si escribe la URL a mano sin
  // tener acceso, lo mandamos al resumen. La API igual rechaza el pedido
  // (ver requireModule en el backend); esto es solo para no mostrarle una
  // pantalla vacia o rota.
  if (module && !canRead(user, module)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plantilla"
        element={
          <ProtectedRoute module="gestion">
            <Plantilla />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scouting"
        element={
          <ProtectedRoute module="scouting">
            <Scouting />
          </ProtectedRoute>
        }
      />
      <Route
        path="/video"
        element={
          <ProtectedRoute module="video">
            <Video />
          </ProtectedRoute>
        }
      />
      <Route
        path="/data"
        element={
          <ProtectedRoute module="data">
            <DataAnalyst />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entrenamientos"
        element={
          <ProtectedRoute module="entrenamientos">
            <Entrenamientos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fisico-medico"
        element={
          <ProtectedRoute module="fisico_medico">
            <FisicoMedico />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <AdminRoute>
            <Usuarios />
          </AdminRoute>
        }
      />
      <Route
        path="/jugador/:id"
        element={
          <ProtectedRoute>
            <FichaJugador />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

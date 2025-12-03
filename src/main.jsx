import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import App from "./pages/App.jsx";
import Login from "./pages/Login.jsx";
import RequisicaoNova from "./pages/RequisicaoNova.jsx";
import Canhoto from "./pages/Canhoto.jsx";
import RepresentantePainel from "./pages/RepresentantePainel.jsx";
import Acompanhar from "./pages/Acompanhar.jsx";
import Relatorios from "./pages/Relatorios.jsx";
import Configuracoes from "./pages/Configuracoes.jsx";
import TransportadorValidar from "./pages/TransportadorValidar.jsx";
import PortalBeneficios from "./pages/PortalBeneficios.jsx";

import "./index.css";

// ---------------- PRIVATE ROUTE CORRIGIDO ----------------
function PrivateRoute({ children, allow }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  // 1. Se não tiver user → volta para login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. (Opcional) Se quiser bloquear sem token REAL, descomente:
  // if (!token) return <Navigate to="/login" replace />;

  // 3. Se rota tem restrição de tipo (emissor, representante, etc)
  if (allow && !allow.includes(user.tipo)) {
    return <Navigate to="/login" replace />;
  }

  // 4. Permitir acesso
  return children;
}
// -----------------------------------------------------------

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>

        {/* raiz -> login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Portal (comum para todos) */}
        <Route
          path="/portal"
          element={
            <PrivateRoute>
              <PortalBeneficios />
            </PrivateRoute>
          }
        />

        {/* Emissor */}
        <Route
          path="/app"
          element={
            <PrivateRoute allow={["emissor"]}>
              <Acompanhar />
            </PrivateRoute>
          }
        />
        <Route
          path="/nova"
          element={
            <PrivateRoute allow={["emissor"]}>
              <RequisicaoNova />
            </PrivateRoute>
          }
        />
        <Route
          path="/relatorios"
          element={
            <PrivateRoute allow={["emissor", "representante"]}>
              <Relatorios />
            </PrivateRoute>
          }
        />

        {/* Representante */}
        <Route
          path="/assinaturas"
          element={
            <PrivateRoute allow={["representante"]}>
              <RepresentantePainel />
            </PrivateRoute>
          }
        />
        <Route
          path="/config"
          element={
            <PrivateRoute allow={["representante"]}>
              <Configuracoes />
            </PrivateRoute>
          }
        />

        {/* Transportador */}
        <Route
          path="/validar"
          element={
            <PrivateRoute allow={["transportador"]}>
              <TransportadorValidar />
            </PrivateRoute>
          }
        />

        {/* Comum (visualização) */}
        <Route
          path="/canhoto/:id"
          element={
            <PrivateRoute>
              <Canhoto />
            </PrivateRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

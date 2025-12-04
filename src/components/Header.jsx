// src/components/Header.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import borbaLogo from "/borba-logo.png"; // importa da pasta public

export default function Header() {
  const { pathname } = useLocation();
  const nav = useNavigate();

  // Não mostra header na tela de login
  if (pathname === "/login") return null;

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const tipo = user?.tipo;

  // Modal de confirmação de saída
  const [confirmSair, setConfirmSair] = useState(false);

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    nav("/login", { replace: true });
  }

  const isActive = (to) => pathname === to;

  // menus por tipo
  let menus = [];
  if (tipo === "emissor") {
    menus = [
      { key: "nova", to: "/nova", label: "Nova requisição" },
      { key: "app", to: "/app", label: "Acompanhar" },
      { key: "rel", to: "/relatorios", label: "Relatórios" },
    ];
  } else if (tipo === "representante") {
    menus = [
      { key: "assin", to: "/assinaturas", label: "Assinaturas" },
      { key: "rel", to: "/relatorios", label: "Relatórios" },
      { key: "cfg", to: "/config", label: "Configurações" },
    ];
  }
  // transportador não tem menus, só sair

  const tabsMobile = [
    ...menus,
    { key: "sair", action: () => setConfirmSair(true), label: "Sair" },
  ];

  // ícones para o menu inferior
  function iconFor(key) {
    switch (key) {
      case "nova":
        return "➕"; // nova requisição
      case "app":
        return "📋"; // acompanhar
      case "rel":
        return "📊"; // relatórios
      case "assin":
        return "✍️"; // assinaturas
      case "cfg":
        return "⚙️"; // config
      case "sair":
        return "🚪"; // sair
      default:
        return "•";
    }
  }

  // Espaço extra embaixo no mobile para não ficar nada escondido atrás da barra
  useEffect(() => {
    const isMobile = window.innerWidth < 640;
    const root = document.getElementById("root");
    const oldRootPadding = root ? root.style.paddingBottom : "";
    const oldBodyPadding = document.body.style.paddingBottom;

    if (isMobile) {
      // garante folga tanto no body quanto no root
      if (root) root.style.paddingBottom = "170px";
      document.body.style.paddingBottom = "170px";
    }

    return () => {
      if (root) root.style.paddingBottom = oldRootPadding;
      document.body.style.paddingBottom = oldBodyPadding;
    };
  }, []);

  const TopItem = ({ to, children }) => (
    <Link
      to={to}
      className={
        "px-3 py-2 rounded-md text-xs sm:text-sm transition-colors whitespace-nowrap " +
        (isActive(to)
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-700 hover:bg-white/70")
      }
    >
      {children}
    </Link>
  );

  return (
    <>
      {/* MODAL CONFIRMAÇÃO DE SAÍDA */}
      {confirmSair && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmSair(false)}
          />
          <div className="relative z-10 bg-white rounded-xl shadow-xl p-5 w-[90%] max-w-xs text-center transition-all">
            <h3 className="text-lg font-semibold mb-3">
              Deseja realmente sair?
            </h3>

            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setConfirmSair(false)}
                className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-100"
              >
                Não
              </button>
              <button
                onClick={sair}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Sim, sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SUPERIOR (desktop + mobile) */}
      <header className="bg-white border-b app-header print:hidden">
        <div className="container-page py-5 sm:py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* logo + texto */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src={borbaLogo}
              className="h-8 sm:h-9 flex-shrink-0"
              alt="Prefeitura de Borba"
            />
            <div className="leading-tight min-w-0">
              <h1 className="text-sm sm:text-lg font-semibold leading-snug">
                Prefeitura Municipal de Borba
              </h1>
              {user && (
                <p className="text-[11px] sm:text-xs text-gray-500 truncate">
                  {user.nome} • {tipo}
                </p>
              )}
            </div>
          </div>

          {/* Navegação topo (somente desktop) */}
          <nav className="hidden sm:flex flex-row items-center gap-3 justify-end">
            {menus.length > 0 && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1 py-1">
                {menus.map((m) => (
                  <TopItem key={m.key} to={m.to}>
                    {m.label}
                  </TopItem>
                ))}
              </div>
            )}

            <button
              onClick={() => setConfirmSair(true)}
              className="px-3 py-2 text-sm rounded-md bg-gray-900 text-white hover:bg-black whitespace-nowrap"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      {/* BOTTOM NAV — MOBILE */}
      <div className="fixed inset-x-0 bottom-3 z-40 sm:hidden pointer-events-none print:hidden">
        <div className="container-page flex justify-center">
          <div className="pointer-events-auto bg-gray-900/95 rounded-full px-2 py-1.5 flex items-center gap-1 shadow-2xl border border-black/40">
            {tabsMobile.map((tab) => {
              const isSairTab = tab.key === "sair";
              const active = tab.to && isActive(tab.to);
              const icon = iconFor(tab.key);

              if (isSairTab) {
                return (
                  <button
                    key={tab.key}
                    onClick={() => setConfirmSair(true)}
                    className="ml-1 px-3 py-2 rounded-full text-xs font-medium bg-red-600 text-white hover:bg-red-700 flex items-center gap-1 whitespace-nowrap"
                  >
                    <span>{icon}</span>
                    <span>Sair</span>
                  </button>
                );
              }

              return (
                <button
                  key={tab.key}
                  onClick={() => nav(tab.to)}
                  className={
                    "transition-all " +
                    (active
                      ? "bg-emerald-400 text-gray-900 font-semibold shadow-sm px-3.5 py-2 rounded-full flex items-center gap-1"
                      : "bg-transparent text-white/80 w-10 h-10 rounded-full flex items-center justify-center")
                  }
                >
                  <span>{icon}</span>
                  {active && <span className="text-[11px]">{tab.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

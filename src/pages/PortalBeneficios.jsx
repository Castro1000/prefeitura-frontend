// src/pages/PortalBeneficios.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function PortalBeneficios() {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const tipo = (user?.tipo || "").toLowerCase();

  // se não tiver usuário logado, manda pro login
  useEffect(() => {
    if (!user) nav("/login", { replace: true });
  }, [user, nav]);

  // para qual página vai ao clicar em "Passagem Fluvial"
  function irParaPassagem() {
    if (tipo === "transportador") {
      // painel do transportador
      nav("/validar");
    } else if (tipo === "representante") {
      // painel do representante (assinaturas)
      nav("/assinaturas");
    } else {
      // emissor cai direto na tela de emissão da requisição
      nav("/nova");
    }
  }

  const podeAcessarOutros = tipo === "emissor" || tipo === "representante";

  return (
    <main className="min-h-screen bg-slate-900 relative overflow-hidden">
      {/* fundo com gradiente borrado */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-16 w-72 h-72 bg-emerald-500/30 blur-3xl rounded-full" />
        <div className="absolute -bottom-40 -right-10 w-72 h-72 bg-sky-500/25 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 container-page py-10 pb-28 flex flex-col items-center">
        {/* Título / descrição */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-wide">
            Portal de Benefícios Eventuais
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-200/80 uppercase tracking-[0.15em]">
            ESCOLHA UMA CATEGORIA
          </p>
          {user && (
            <p className="mt-3 text-xs sm:text-sm text-slate-200/70">
              Logado como{" "}
              <span className="font-medium">
                {user.nome || user.login}
              </span>{" "}
              ·{" "}
              <span className="capitalize">
                {tipo || "usuário"}
              </span>
            </p>
          )}
        </div>

        {/* “Cartão” de vidro com as opções */}
        <div className="w-full max-w-3xl rounded-3xl bg-slate-900/70 border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl px-5 sm:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {/* Cesta Básica */}
            <button
              type="button"
              className={`group flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 border border-white/10 bg-white/0 text-center transition hover:bg-white/5 hover:border-emerald-400/60 ${
                !podeAcessarOutros ? "opacity-40 cursor-not-allowed" : ""
              }`}
              disabled={!podeAcessarOutros}
              onClick={() => {
                if (!podeAcessarOutros) return;
                alert("Módulo de Cesta Básica ainda em desenvolvimento.");
              }}
            >
              <span className="text-3xl sm:text-4xl">🧺</span>
              <span className="text-xs sm:text-sm text-slate-100 group-hover:text-white">
                Cesta Básica
              </span>
            </button>

            {/* Auxílio Funeral */}
            <button
              type="button"
              className={`group flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 border border-white/10 bg-white/0 text-center transition hover:bg-white/5 hover:border-rose-400/60 ${
                !podeAcessarOutros ? "opacity-40 cursor-not-allowed" : ""
              }`}
              disabled={!podeAcessarOutros}
              onClick={() => {
                if (!podeAcessarOutros) return;
                alert("Módulo de Auxílio Funeral ainda em desenvolvimento.");
              }}
            >
              <span className="text-3xl sm:text-4xl">⚰️</span>
              <span className="text-xs sm:text-sm text-slate-100 group-hover:text-white">
                Auxílio Funeral
              </span>
            </button>

            {/* Aluguel Social */}
            <button
              type="button"
              className={`group flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 border border-white/10 bg-white/0 text-center transition hover:bg-white/5 hover:border-sky-400/60 ${
                !podeAcessarOutros ? "opacity-40 cursor-not-allowed" : ""
              }`}
              disabled={!podeAcessarOutros}
              onClick={() => {
                if (!podeAcessarOutros) return;
                alert("Módulo de Aluguel Social ainda em desenvolvimento.");
              }}
            >
              <span className="text-3xl sm:text-4xl">🏠</span>
              <span className="text-xs sm:text-sm text-slate-100 group-hover:text-white">
                Aluguel Social
              </span>
            </button>

            {/* Passagem Fluvial */}
            <button
              type="button"
              className="group flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4 border border-emerald-400/70 bg-emerald-500/90 text-center shadow-[0_10px_30px_rgba(16,185,129,0.45)] transition hover:bg-emerald-400 hover:border-emerald-300"
              onClick={irParaPassagem}
            >
              <span className="text-3xl sm:text-4xl">⛴️</span>
              <span className="text-xs sm:text-sm text-slate-900 font-semibold">
                Passagem Fluvial
              </span>
              <span className="text-[10px] sm:text-[11px] text-emerald-100/90 group-hover:text-white">
                {tipo === "transportador"
                  ? "Validar / Confirmar viagens"
                  : tipo === "representante"
                  ? "Assinar e autorizar requisições"
                  : "Emitir novas requisições"}
              </span>
            </button>
          </div>

          {/* Observação */}
          <p className="mt-4 text-[11px] sm:text-xs text-slate-300/80 text-center">
            Módulos adicionais (Cesta Básica, Auxílio Funeral, Aluguel Social)
            serão liberados conforme implantação do sistema.
          </p>
        </div>
      </div>
    </main>
  );
}

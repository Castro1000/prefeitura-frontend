import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff } from "lucide-react";


//const API_BASE_URL =
 // import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";


//const API_BASE_URL = "http://localhost:3001";
 const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

export default function Login() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    if (!login || !senha) {
      setErro("Informe login e senha.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ login: login.trim(), senha }),
      });

      if (!resp.ok) {
        const dataErr = await resp.json().catch(() => ({}));
        setErro(dataErr.error || "Falha no login.");
        setLoading(false);
        return;
      }

      const data = await resp.json();

      const rawUser = data.user || {};
      const user = {
        ...rawUser,
        tipo: (rawUser.tipo || rawUser.perfil || rawUser.role || "").toLowerCase(),
      };

      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", data.token || "ok");

      navigate("/portal");
    } catch (err) {
      console.error(err);
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_30%)]" />
      <div className="absolute top-[-80px] left-[-80px] w-72 h-72 bg-emerald-500/20 blur-3xl rounded-full" />
      <div className="absolute bottom-[-100px] right-[-100px] w-80 h-80 bg-cyan-500/20 blur-3xl rounded-full" />

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Lado institucional */}
        <div className="hidden lg:block text-white">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-sm mb-6">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Ambiente seguro de acesso
            </div>

            <h1 className="text-4xl xl:text-5xl font-black leading-tight tracking-tight">
              Sistema de Requisição de
              <span className="block text-emerald-400">
                Benefícios Eventuais
              </span>
            </h1>

            <p className="mt-5 text-slate-300 text-lg leading-relaxed">
              Plataforma da Prefeitura Municipal de Borba para solicitação,
              análise, autorização e acompanhamento de benefícios eventuais,
              incluindo passagens fluviais e outros atendimentos sociais
              vinculados aos programas do município.
            </p>
          </div>
        </div>

        {/* Card login */}
        <div className="w-full max-w-md mx-auto">
          <div className="backdrop-blur-xl bg-slate-900/75 border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/30 p-6 sm:p-8">
            <div className="text-center mb-7">
              <div className="mx-auto mb-3 w-[200px] h-[95px] rounded-2xl bg-white flex items-center justify-center shadow-lg px-3 py-2">
                <img
                  src="/borba-logo.png"
                  alt="Prefeitura de Borba"
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              <p className="text-sm font-semibold tracking-[0.18em] text-emerald-300 mt-1">
                PORTAL DE BENEFÍCIOS
              </p>

              <p className="text-sm text-slate-400 mt-2">
                Informe suas credenciais para continuar
              </p>
            </div>

            {erro && (
              <div className="mb-5 text-sm text-red-200 bg-red-900/30 border border-red-500/40 rounded-xl px-4 py-3">
                {erro}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Usuário
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 text-white pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition"
                    autoComplete="username"
                    placeholder="Digite seu usuário"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 text-white pl-10 pr-14 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition"
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-emerald-200 transition"
                    title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
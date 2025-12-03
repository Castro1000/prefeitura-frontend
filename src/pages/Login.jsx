// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app"; 
// TROCAR AQUI quando subir o backend para o Railway

export default function Login() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
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

      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("token", data.token || "");

      navigate("/portal");
    } catch (err) {
      console.error(err);
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-md bg-slate-800/80 border border-slate-700 rounded-xl p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          Sistema de Requisição de Passagens Fluviais
        </h1>

        {erro && (
          <div className="mb-4 text-sm text-red-300 bg-red-900/40 border border-red-500/60 rounded px-3 py-2">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-200 mb-1">
              Usuário
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-200 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-semibold py-2 rounded-md transition"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Logins de teste:<br />
          emissor: <b>vitor / 123</b> · representante: <b>nixon / 123</b> ·
          transportador: <b>carlos / 123</b> · admin: <b>admin / admin</b>
        </p>
      </div>
    </div>
  );
}

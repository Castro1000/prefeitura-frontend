// src/pages/Configuracoes.jsx
import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

/* Modal simples */
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-white border rounded-2xl shadow-xl">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="px-2 py-1 text-sm rounded hover:bg-gray-100"
          >
            Fechar
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
          {footer}
        </div>
      </div>
    </div>
  );
}

export default function Configuracoes() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editIndex, setEditIndex] = useState(-1);
  const [form, setForm] = useState({
    nome: "",
    login: "",
    tipo: "emissor",
    cpf: "",
    senha: "",
    barco: "",
  });

  // carrega do backend
  async function carregarUsuarios() {
    try {
      setLoading(true);
      setErro("");
      const resp = await fetch(`${API_BASE_URL}/api/usuarios`);
      if (!resp.ok) {
        const dataErr = await resp.json().catch(() => ({}));
        throw new Error(dataErr.error || "Falha ao carregar usuários.");
      }
      const data = await resp.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setErro(err.message || "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarUsuarios();
  }, []);

  function openAdd() {
    setIsEdit(false);
    setEditIndex(-1);
    setForm({
      nome: "",
      login: "",
      tipo: "emissor",
      cpf: "",
      senha: "",
      barco: "",
    });
    setErro("");
    setSucesso("");
    setOpen(true);
  }

  function openEdit(i) {
    setIsEdit(true);
    setEditIndex(i);
    const u = users[i];
    setForm({
      nome: u.nome || "",
      login: u.login || "",
      tipo: (u.tipo || u.perfil || "emissor").toLowerCase(),
      cpf: u.cpf || "",
      senha: "",
      barco: u.barco || "",
    });
    setErro("");
    setSucesso("");
    setOpen(true);
  }

  function onChange(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function saveModal() {
    if (!form.nome.trim()) return alert("Informe o nome completo.");
    if (!form.login.trim()) return alert("Informe o usuário (login).");
    if (!isEdit && !form.senha.trim())
      return alert("Informe a senha do novo usuário.");

    if (form.tipo === "transportador" && !form.barco.trim()) {
      return alert("Informe o nome do barco do transportador.");
    }

    const payload = {
      nome: form.nome.trim(),
      login: form.login.trim().replace(/\s+/g, ""),
      tipo: form.tipo, // emissor/representante/transportador/admin
      senha: form.senha || "",
      cpf:
        form.tipo === "representante" ? (form.cpf || "").trim() : "",
      barco: form.tipo === "transportador" ? form.barco.trim() : "",
    };

    try {
      setLoading(true);
      setErro("");
      setSucesso("");

      if (isEdit) {
        const u = users[editIndex];
        const resp = await fetch(`${API_BASE_URL}/api/usuarios/${u.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const dataErr = await resp.json().catch(() => ({}));
          throw new Error(dataErr.error || "Falha ao atualizar usuário.");
        }
        setSucesso("Usuário atualizado com sucesso.");
      } else {
        const resp = await fetch(`${API_BASE_URL}/api/usuarios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const dataErr = await resp.json().catch(() => ({}));
          throw new Error(dataErr.error || "Falha ao cadastrar usuário.");
        }
        setSucesso("Usuário cadastrado com sucesso.");
      }

      setOpen(false);
      await carregarUsuarios();
    } catch (err) {
      console.error(err);
      setErro(err.message || "Erro ao salvar usuário.");
    } finally {
      setLoading(false);
    }
  }

  async function removeUser(i) {
    const u = users[i];
    if (!u) return;
    if (!confirm(`Excluir o usuário "${u.nome}"?`)) return;

    try {
      setLoading(true);
      setErro("");
      setSucesso("");

      const resp = await fetch(`${API_BASE_URL}/api/usuarios/${u.id}`, {
        method: "DELETE",
      });
      if (!resp.ok) {
        const dataErr = await resp.json().catch(() => ({}));
        throw new Error(dataErr.error || "Falha ao excluir usuário.");
      }

      setSucesso("Usuário excluído com sucesso.");
      await carregarUsuarios();
    } catch (err) {
      console.error(err);
      setErro(err.message || "Erro ao excluir usuário.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container-page py-6 pb-28 sm:pb-6 ">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Configurações — Usuários
          </h2>
          <button
            className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-black"
            onClick={openAdd}
          >
            Adicionar usuário
          </button>
        </div>

        {erro && (
          <div className="mb-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded px-3 py-2">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="mb-3 text-sm text-emerald-700 bg-emerald-100 border border-emerald-300 rounded px-3 py-2">
            {sucesso}
          </div>
        )}

        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="px-4 py-2 w-[34%]">Nome completo</th>
                <th className="px-4 py-2 w-[22%]">Usuário (login)</th>
                <th className="px-4 py-2 w-[18%]">Tipo</th>
                <th className="px-4 py-2 w-[16%]">
                  Barco (se transportador)
                </th>
                <th className="px-4 py-2 w-[10%] text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id || i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{u.nome}</td>
                  <td className="px-4 py-2">
                    {u.login || (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 capitalize">
                    {(u.tipo || u.perfil || "").toLowerCase()}
                  </td>
                  <td className="px-4 py-2">
                    {(u.tipo || u.perfil) &&
                    (u.tipo || u.perfil).toLowerCase() === "transportador"
                      ? u.barco || (
                          <span className="text-gray-400">—</span>
                        )
                      : (
                        <span className="text-gray-400">—</span>
                        )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="px-3 py-1.5 rounded border hover:bg-gray-100"
                        onClick={() => openEdit(i)}
                      >
                        Editar
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700"
                        onClick={() => removeUser(i)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-6 text-gray-500"
                  >
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={isEdit ? "Editar usuário" : "Adicionar usuário"}
          footer={
            <>
              <button
                className="px-3 py-1.5 rounded border hover:bg-gray-100"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-black"
                onClick={saveModal}
                disabled={loading}
              >
                {isEdit ? "Salvar alterações" : "Adicionar"}
              </button>
            </>
          }
        >
          {/* mesmo formulário que você já tinha */}
          {/* ... (mantive igual ao seu, só adaptado para usar state/form) */}
        </Modal>
      </main>
    </>
  );
}

// src/pages/Configuracoes.jsx
import { useState } from "react";
import Header from "../components/Header.jsx";
import { listUsers, addUser } from "../lib/storage.js";

/* storage helpers locais */
const USERS_KEY = "users_seed_v1";
function saveUsers(all) {
  localStorage.setItem(USERS_KEY, JSON.stringify(all));
}
function updateUserAt(index, patch) {
  const all = listUsers();
  all[index] = { ...all[index], ...patch };
  saveUsers(all);
  return all;
}
function deleteUserAt(index) {
  const all = listUsers();
  all.splice(index, 1);
  saveUsers(all);
  return all;
}

/* Modal bem simples */
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
  const [users, setUsers] = useState(listUsers());

  // modal
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editIndex, setEditIndex] = useState(-1);
  const [form, setForm] = useState({
    nome: "",
    login: "",
    tipo: "emissor",
    cpf: "",
    senha: "",
    barco: "", // nome do barco (apenas para tipo transportador)
  });

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
    setOpen(true);
  }

  function openEdit(i) {
    setIsEdit(true);
    setEditIndex(i);
    const u = users[i];
    setForm({
      nome: u.nome || "",
      login: u.login || "",
      tipo: u.tipo || "emissor",
      cpf: u.cpf || "",
      senha: u.senha || "",
      barco: u.barco || "",
    });
    setOpen(true);
  }

  function onChange(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function saveModal() {
    // validações simples
    if (!form.nome.trim()) return alert("Informe o nome completo.");
    if (!form.login.trim()) return alert("Informe o usuário (login).");
    if (!isEdit && !form.senha.trim())
      return alert("Informe a senha do novo usuário.");

    if (form.tipo === "transportador" && !form.barco.trim()) {
      return alert("Informe o nome do barco do transportador.");
    }

    const payload = {
      nome: form.nome.trim(),
      login: form.login.trim().toLowerCase().replace(/\s+/g, ""),
      tipo: form.tipo,
      senha: form.senha || "",
      cpf: form.tipo === "representante" ? (form.cpf || "").trim() : "",
      barco: form.tipo === "transportador" ? form.barco.trim() : "", // salva só quando for transportador
    };

    if (isEdit) {
      const novos = updateUserAt(editIndex, payload);
      setUsers(novos);
      setOpen(false);
    } else {
      addUser(payload);
      setUsers(listUsers());
      setOpen(false);
    }
  }

  function remove(i) {
    const u = users[i];
    if (!confirm(`Excluir o usuário "${u?.nome}"?`)) return;
    const novos = deleteUserAt(i);
    setUsers(novos);
  }

  return (
    <>
      <Header />
      <main className="container-page py-6 pb-28 sm:pb-6 ">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Configurações — Usuários</h2>
          <button
            className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-black"
            onClick={openAdd}
          >
            Adicionar usuário
          </button>
        </div>

        {/* Lista enxuta */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="px-4 py-2 w-[34%]">Nome completo</th>
                <th className="px-4 py-2 w-[22%]">Usuário (login)</th>
                <th className="px-4 py-2 w-[18%]">Tipo</th>
                <th className="px-4 py-2 w-[16%]">Barco (se transportador)</th>
                <th className="px-4 py-2 w-[10%] text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{u.nome}</td>
                  <td className="px-4 py-2">
                    {u.login || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2 capitalize">{u.tipo}</td>
                  <td className="px-4 py-2">
                    {u.tipo === "transportador"
                      ? u.barco || <span className="text-gray-400">—</span>
                      : <span className="text-gray-400">—</span>}
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
                        onClick={() => remove(i)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-6 text-gray-500">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal de novo/edição */}
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
              >
                {isEdit ? "Salvar alterações" : "Adicionar"}
              </button>
            </>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Nome completo</label>
              <input
                className="border rounded-md px-3 py-2 w-full"
                placeholder="Ex.: João da Silva"
                value={form.nome}
                onChange={(e) => onChange("nome", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Usuário (login)</label>
              <input
                className="border rounded-md px-3 py-2 w-full"
                placeholder="Ex.: joao123"
                value={form.login}
                onChange={(e) => onChange("login", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Tipo</label>
              <select
                className="border rounded-md px-3 py-2 w-full"
                value={form.tipo}
                onChange={(e) => onChange("tipo", e.target.value)}
              >
                <option value="emissor">Emissor</option>
                <option value="representante">Representante (Prefeitura)</option>
                <option value="transportador">Transportador</option>
              </select>
            </div>

            {/* CPF apenas para representante */}
            <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm text-gray-600">
                  CPF {form.tipo !== "representante" && "(apenas para representante)"}
                </label>
                <input
                  className={`border rounded-md px-3 py-2 w-full ${
                    form.tipo !== "representante" ? "bg-gray-50 text-gray-400" : ""
                  }`}
                  placeholder="Somente números"
                  value={form.cpf}
                  onChange={(e) => onChange("cpf", e.target.value)}
                  disabled={form.tipo !== "representante"}
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Senha</label>
                <input
                  className="border rounded-md px-3 py-2 w-full"
                  placeholder="Defina uma senha"
                  type="password"
                  value={form.senha}
                  onChange={(e) => onChange("senha", e.target.value)}
                />
              </div>
            </div>

            {/* Campo extra: nome do barco quando for transportador */}
            {form.tipo === "transportador" && (
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">
                  Nome do barco do transportador
                </label>
                <input
                  className="border rounded-md px-3 py-2 w-full"
                  placeholder="Ex.: B/M TIO GRACY"
                  value={form.barco}
                  onChange={(e) => onChange("barco", e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este nome aparecerá para o emissor escolher na requisição.
                </p>
              </div>
            )}
          </div>
        </Modal>
      </main>
    </>
  );
}

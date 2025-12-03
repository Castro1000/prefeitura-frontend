// src/lib/storage.js

const KEY = "requisicoes_v1";

/* ============== Requisições ============== */
export function genId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveOne(registro) {
  const list = loadAll();
  list.unshift(registro);
  saveAll(list);
}

export function getOne(id) {
  return loadAll().find((x) => x.id === id) || null;
}

export function updateOne(id, patch) {
  const list = loadAll();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...patch };
  saveAll(list);
  return true;
}

/** Marca como utilizada (embarque confirmado pelo transportador) */
export function marcarUtilizada(id, transportadorNome) {
  return updateOne(id, {
    utilizada_em: new Date().toISOString(),
    utilizada_por: transportadorNome || "Transportador",
  });
}

/** Gera número anual "SEQ/ANO" */
export function nextNumeroMensal() {
  const year = new Date().getFullYear();
  const seqKey = `req_seq_year_${year}`;
  let seq = parseInt(localStorage.getItem(seqKey) || "0", 10) || 0;
  seq += 1;
  localStorage.setItem(seqKey, String(seq));
  return `${seq}/${year}`;
}

/* ============== Usuários (seed + auth) ============== */
const USERS_KEY = "users_seed_v1";

const DEFAULT_USERS = [
  { nome: "Administrador", tipo: "emissor", senha: "123" },
  { nome: "João da Silva", tipo: "representante", senha: "123" }, // validador
  { nome: "B/M Tio Gracy", tipo: "transportador", senha: "123" },
];

function ensureUsers() {
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  }
}
ensureUsers();

export function listUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addUser(u) {
  const all = listUsers();
  all.push(u);
  localStorage.setItem(USERS_KEY, JSON.stringify(all));
  return true;
}

export function authByNomeSenha(nome, senha) {
  const all = listUsers();
  const n = (nome || "").trim().toLowerCase();
  const u = all.find((x) => x.nome.trim().toLowerCase() === n && x.senha === senha);
  if (!u) return null;
  return { nome: u.nome, tipo: u.tipo };
}

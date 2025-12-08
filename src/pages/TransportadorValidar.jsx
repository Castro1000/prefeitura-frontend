// src/pages/TransportadorValidar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AUTORIZADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  UTILIZADA: "bg-slate-100 text-slate-800 border-slate-200",
  REPROVADA: "bg-red-100 text-red-800 border-red-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
};

/* -------- utilidades -------- */
function normText(s = "") {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Normaliza nomes de barco: remove B/M, “barco”, acentos, espaços extras etc.
function normalizarBarco(nome = "") {
  return normText(
    String(nome)
      .replace(/^b\s*\/?\s*m\s*/i, "") // B/M, BM, B / M
      .replace(/^barco\s*/i, "") // "Barco "
  )
    .replace(/\s+/g, " ")
    .trim();
}

// Faz o mapeamento de um registro vindo do backend (requisicoes) para o formato usado na tela
function mapRequisicaoApiToUi(r) {
  let extras = {};
  try {
    if (r.observacoes) extras = JSON.parse(r.observacoes);
  } catch (_) {
    extras = {};
  }

  const barco = extras.transportador_nome_barco || r.transportador || "";
  const rg = extras.rg || r.rg || "";

  return {
    id: r.id,
    numero: r.numero_formatado || r.codigo_publico || r.id,
    status: r.status,
    data_saida: r.data_ida ? String(r.data_ida).slice(0, 10) : "",
    cidade_origem: r.origem || "",
    cidade_destino: r.destino || "",
    nome: r.passageiro_nome || "",
    cpf: r.passageiro_cpf || "",
    rg,
    transportador: barco,
    codigo_publico: r.codigo_publico,
    utilizada_em: r.status === "UTILIZADA" ? r.updated_at || null : null,
    utilizada_por: null, // se quiser, depois pode vir de outra tabela
  };
}

export default function TransportadorValidar() {
  // ========= USUÁRIO LOGADO =========
  const userRaw = localStorage.getItem("user") || localStorage.getItem("usuario");
  const user = userRaw ? JSON.parse(userRaw) : null;
  const tipoUser = (user?.tipo || user?.perfil || "").toLowerCase();
  const isTransportador = tipoUser === "transportador";

  // Barco ativo
  const barcoDoUsuario = (user?.barco || "").trim();
  const [barcoAtivo, setBarcoAtivo] = useState(barcoDoUsuario);
  const barcoKey = normalizarBarco(barcoAtivo);

  // ========= LISTAGEM GERAL =========
  const [todas, setTodas] = useState([]);
  const [loadingLista, setLoadingLista] = useState(false);

  useEffect(() => {
    if (!isTransportador) return;

    async function carregar() {
      try {
        setLoadingLista(true);
        const res = await fetch(`${API_BASE_URL}/api/requisicoes`);
        if (!res.ok) throw new Error("Erro ao carregar requisições");
        const data = await res.json();
        const mapped = (data || []).map(mapRequisicaoApiToUi);
        const ordenado = mapped.slice().sort((a, b) => (b.id || 0) - (a.id || 0));
        setTodas(ordenado);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingLista(false);
      }
    }

    carregar();
  }, [isTransportador]);

  const abertas = useMemo(() => {
    if (!barcoKey) return [];
    return todas.filter(
      (r) =>
        normalizarBarco(r.transportador) === barcoKey &&
        (r.status === "APROVADA" || r.status === "AUTORIZADA")
    );
  }, [todas, barcoKey]);

  // ========= SCANNER COM @zxing/browser + CONSTRAINTS =========
  const [qrOpen, setQrOpen] = useState(false);
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [scannerErro, setScannerErro] = useState("");

  async function startScanner() {
    try {
      setScannerErro("");
      if (!videoRef.current) return;

      const { BrowserMultiFormatReader } = await import("@zxing/browser");

      // se já tiver um reader rodando, reseta
      if (readerRef.current) {
        try {
          await readerRef.current.reset();
        } catch {}
      }

      const codeReader = new BrowserMultiFormatReader();
      readerRef.current = codeReader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      let constraints;

      if (devices && devices.length) {
        const backCam =
          devices.find((d) =>
            /back|rear|environment|traseira/i.test(d.label || "")
          ) || devices[0];

        constraints = {
          audio: false,
          video: {
            deviceId: { exact: backCam.deviceId },
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            focusMode: "continuous",
            advanced: [
              { focusMode: "continuous" },
              { zoom: 1 },
            ],
          },
        };
      } else {
        // fallback: sem lista de devices, usa câmera traseira padrão
        constraints = {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            focusMode: "continuous",
          },
        };
      }

      await codeReader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText();
            stopScanner();
            handleScan(text);
          }
          // erros de frame ignoramos
        }
      );
    } catch (err) {
      console.error("Erro ao iniciar scanner:", err);
      setScannerErro(
        "Não foi possível acessar a câmera. Verifique permissões no navegador."
      );
      stopScanner();
    }
  }

  async function stopScanner() {
    try {
      if (readerRef.current) {
        await readerRef.current.reset();
        readerRef.current = null;
      }
    } catch (e) {
      console.error("Erro ao parar scanner:", e);
    }
  }

  // ========= BUSCA / REQUISIÇÃO ATUAL =========
  const [codigo, setCodigo] = useState("");
  const [ultimoCodigoLido, setUltimoCodigoLido] = useState("");
  const [req, setReq] = useState(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [erroBusca, setErroBusca] = useState("");
  const [loadingBusca, setLoadingBusca] = useState(false);

  function validarPertenceAoMeuBarco(registro) {
    const barcoReqKey = normalizarBarco(registro?.transportador || "");
    if (barcoKey && barcoReqKey && barcoReqKey !== barcoKey) {
      alert("Esta requisição não pertence ao seu barco.");
      return false;
    }
    return true;
  }

  async function fetchById(id) {
    const res = await fetch(`${API_BASE_URL}/api/requisicoes/${id}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error("Requisição não encontrada.");
      throw new Error("Erro ao buscar requisição por ID.");
    }
    const data = await res.json();
    return mapRequisicaoApiToUi(data);
  }

  async function fetchByCodigoPublico(cod) {
    const res = await fetch(
      `${API_BASE_URL}/api/requisicoes/codigo/${encodeURIComponent(cod)}`
    );
    if (!res.ok) {
      if (res.status === 404) throw new Error("Requisição não encontrada.");
      throw new Error("Erro ao buscar requisição por código.");
    }
    const data = await res.json();
    return mapRequisicaoApiToUi(data);
  }

  function extrairIdDeUrlCanhoto(texto) {
    if (!texto) return null;
    if (!texto.includes("/canhoto/")) return null;
    const part = texto.split("/canhoto/").pop();
    return part.split(/[?#]/)[0];
  }

  function handleScan(decodedText) {
    const raw = String(decodedText || "").trim();
    setCodigo(raw);
    setUltimoCodigoLido(raw);
    buscar(raw);
  }

  async function buscar(codeArg) {
    const raw = (codeArg ?? codigo).trim();
    if (!raw) return;
    if (!barcoAtivo) {
      alert("Defina o barco ativo primeiro.");
      return;
    }

    setErroBusca("");
    setReq(null);
    setReqOpen(false);
    setLoadingBusca(true);

    try {
      let r = null;

      const idFromUrl = extrairIdDeUrlCanhoto(raw);
      if (idFromUrl && /^\d+$/.test(idFromUrl)) {
        r = await fetchById(idFromUrl);
      } else if (/^\d+$/.test(raw)) {
        r = await fetchById(raw);
      } else {
        r = await fetchByCodigoPublico(raw);
      }

      if (!validarPertenceAoMeuBarco(r)) {
        setReq(null);
        return;
      }

      setReq(r);
      setReqOpen(true);
    } catch (e) {
      console.error(e);
      setErroBusca(e.message || "Erro ao buscar requisição.");
    } finally {
      setLoadingBusca(false);
    }
  }

  // ========= CONFIRMAR VIAGEM =========
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function confirmar() {
    if (!req) return;

    const status = (req.status || "").toUpperCase();
    const podeConfirmarStatus = status === "APROVADA" || status === "AUTORIZADA";

    if (!podeConfirmarStatus) {
      alert("Só é possível confirmar viagens APROVADAS/AUTORIZADAS.");
      return;
    }
    if (status === "UTILIZADA") {
      alert("Esta requisição já foi utilizada.");
      return;
    }
    if (!validarPertenceAoMeuBarco(req)) return;

    const ok = window.confirm("Confirmar embarque desta requisição?");
    if (!ok) return;

    try {
      setConfirmLoading(true);

      const body = {
        transportador_id: user?.id,
        tipo_validacao: "EMBARQUE",
        codigo_lido: ultimoCodigoLido || codigo || req.codigo_publico || "",
        local_validacao: barcoAtivo || null,
        observacao: null,
      };

      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes/${req.id}/validar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const dataErr = await res.json().catch(() => ({}));
        throw new Error(dataErr.error || "Erro ao confirmar embarque.");
      }

      const nowIso = new Date().toISOString();

      setReq((prev) =>
        prev
          ? { ...prev, status: "UTILIZADA", utilizada_em: nowIso, utilizada_por: user?.nome }
          : prev
      );

      setTodas((prev) =>
        prev.map((r) =>
          r.id === req.id
            ? { ...r, status: "UTILIZADA", utilizada_em: nowIso, utilizada_por: user?.nome }
            : r
        )
      );

      alert("Embarque confirmado com sucesso!");
    } catch (e) {
      console.error(e);
      alert(e.message || "Não foi possível confirmar a viagem.");
    } finally {
      setConfirmLoading(false);
    }
  }

  // ========= RELATÓRIO / CONSULTA =========
  const [reportOpen, setReportOpen] = useState(false);
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const minhas = useMemo(() => {
    const qn = normText(q.trim());
    return todas.filter((r) => {
      if (barcoKey && normalizarBarco(r.transportador) !== barcoKey) return false;
      const d = (r.data_saida || "").slice(0, 10);
      if (ini && (!d || d < ini)) return false;
      if (fim && (!d || d > fim)) return false;
      if (qn) {
        const hay =
          (r.numero || "") +
          " " +
          (r.nome || "") +
          " " +
          (r.cidade_origem || "") +
          " " +
          (r.cidade_destino || "") +
          " " +
          (r.data_saida || "") +
          " " +
          (r.status || "");
        if (!normText(hay).includes(qn)) return false;
      }
      return true;
    });
  }, [todas, barcoKey, ini, fim, q]);

  const resumo = useMemo(() => {
    const base = { AUTORIZADA: 0, APROVADA: 0, USADA: 0, CANCELADA: 0 };
    for (const r of minhas) {
      if (r.status === "APROVADA" || r.status === "AUTORIZADA") base.AUTORIZADA++;
      if (r.status === "UTILIZADA") base.USADA++;
      if (r.status === "REPROVADA" || r.status === "CANCELADA") base.CANCELADA++;
    }
    return base;
  }, [minhas]);

  const total = minhas.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = minhas.slice(start, start + perPage);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  async function exportXLSX() {
    try {
      const XLSX = await import("xlsx");
      const rows = minhas.map((r) => ({
        Numero: r.numero || "",
        Status: r.status || "",
        "Data saída": r.data_saida || "",
        Origem: r.cidade_origem || "",
        Destino: r.cidade_destino || "",
        Requerente: r.nome || "",
        CPF: r.cpf || "",
        RG: r.rg || "",
        Barco: r.transportador || "",
        "Utilizada em": r.utilizada_em
          ? new Date(r.utilizada_em).toLocaleString("pt-BR")
          : "",
        "Utilizada por": r.utilizada_por || "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Viagens");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(
        wb,
        `viagens-${(barcoAtivo || "transportador").replace(/\s+/g, "_")}-${today}.xlsx`
      );
    } catch (err) {
      console.error(err);
      alert("Não foi possível exportar para Excel. Instale: npm i xlsx");
    }
  }

  function exportPDF() {
    window.print();
  }

  if (!isTransportador) {
    return (
      <>
        <Header />
        <main className="container-page py-8">
          <div className="max-w-md p-4 border rounded-xl bg-amber-50 text-amber-800">
            Este painel é exclusivo para usuários do tipo <b>Transportador</b>.
          </div>
        </main>
      </>
    );
  }

  const semBarco = !barcoAtivo && !barcoDoUsuario;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display:none !important; }
          .container-page { padding: 0 !important; }
          header { box-shadow: none !important; border:0 !important; }
          .print-card { page-break-inside: avoid; }
        }
      `}</style>

      <Header />

      {/* padding extra por causa do menu mobile */}
      <main className="container-page py-4 pb-28 sm:pb-6">
        {/* topo */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold leading-tight">
              Painel do Transportador
            </h2>

            <div className="text-xs text-gray-600 mt-1">
              Barco: <b>{barcoAtivo || "—"}</b>
            </div>

            {semBarco && (
              <div className="mt-1 text-xs text-rose-700 max-w-md">
                Nenhum barco cadastrado para este usuário. Peça ao representante
                para cadastrar em <b>Configurações → Usuários (tipo Transportador)</b>.
              </div>
            )}
          </div>

          {/* ícone de relatório */}
          <div className="no-print flex items-center gap-2">
            <button
              onClick={() => setReportOpen(true)}
              className="p-2 rounded border hover:bg-gray-50"
              aria-label="Abrir relatório"
              title="Relatório / Consulta"
            >
              <span className="inline-block" style={{ fontSize: 18 }}>
                📊
              </span>
            </button>
          </div>
        </div>

        {/* bloco central: total + scanner + código */}
        <section className="bg-white border rounded-xl p-4 max-w-xl mx-auto">
          <div className="mb-3 text-sm text-gray-700 text-center">
            Viagens em aberto para este barco:{" "}
            <span className="font-semibold">
              {loadingLista ? "…" : abertas.length}
            </span>
          </div>

          <div className="grid gap-3">
            <button
              className="w-full px-4 py-3 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => {
                if (!barcoAtivo) {
                  alert("Defina o barco deste usuário nas Configurações.");
                  return;
                }
                setQrOpen(true);
                setTimeout(() => startScanner(), 80);
              }}
              disabled={!barcoAtivo}
            >
              📷 Escanear QR
            </button>

            <div className="flex gap-2">
              <input
                className="border rounded-md px-3 py-3 w-full"
                placeholder="Ou digite o código público ou ID"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <button
                className="px-4 py-3 rounded border"
                onClick={() => {
                  if (!barcoAtivo) {
                    alert("Defina o barco deste usuário nas Configurações.");
                    return;
                  }
                  setUltimoCodigoLido(codigo);
                  buscar();
                }}
              >
                Buscar
              </button>
            </div>
          </div>

          {loadingBusca && (
            <p className="mt-3 text-sm text-gray-500 text-center">
              Buscando requisição...
            </p>
          )}

          {erroBusca && (
            <p className="mt-3 text-sm text-red-600 text-center">{erroBusca}</p>
          )}
        </section>
      </main>

      {/* ===== Modal do QR ===== */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={async () => {
              await stopScanner();
              setQrOpen(false);
            }}
          />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">Escanear QR do Canhoto</h3>
            </div>
            <div className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-[320px] object-contain bg-black"
                  autoPlay
                  muted
                  playsInline
                />
                {/* Moldura */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-3/4 h-3/4 border-2 border-white/80 rounded-lg" />
                </div>
              </div>
              {scannerErro && (
                <div className="text-xs text-red-600 mt-2">{scannerErro}</div>
              )}
              <div className="text-xs text-gray-600 mt-2">
                Posicione o QR do canhoto dentro da moldura.  
                Se estiver muito embaçado, afaste um pouco o papel (uns 15–20 cm) até a câmera focar.
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  className="px-3 py-2 rounded border text-xs sm:text-sm hover:bg-gray-50"
                  onClick={async () => {
                    await stopScanner();
                    setQrOpen(false);
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal da requisição ===== */}
      {req && reqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setReqOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Detalhes da requisição</h3>
            </div>

            <div className="p-4 text-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold">Nº {req.numero}</div>
                  <div className="text-gray-500 text-xs">
                    {req.cidade_origem} → {req.cidade_destino} • Saída:{" "}
                    {req.data_saida}
                  </div>
                </div>
                <span
                  className={`inline-block px-2 py-1 text-xs border rounded ${
                    statusClasses[req.status] || "border-gray-200"
                  }`}
                >
                  {req.status === "PENDENTE"
                    ? "AGUARDANDO AUTORIZAÇÃO"
                    : req.status === "APROVADA"
                    ? "AUTORIZADA"
                    : req.status}
                </span>
              </div>

              <div className="mb-2">
                <span className="text-gray-500">Nome: </span>
                <span className="font-medium">{req.nome}</span>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                CPF {req.cpf || "—"} • RG {req.rg || "—"}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Barco: {req.transportador || "—"}
              </div>

              {req.utilizada_em && (
                <div className="mt-2 text-emerald-700 text-xs">
                  ✔ Viagem já confirmada em{" "}
                  {new Date(req.utilizada_em).toLocaleString("pt-BR")}
                  {req.utilizada_por ? ` por ${req.utilizada_por}` : ""}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  className="px-3 py-2 rounded border text-xs sm:text-sm hover:bg-gray-50"
                  onClick={() => setReqOpen(false)}
                >
                  Fechar
                </button>
                <button
                  className={
                    "px-3 py-2 rounded text-xs sm:text-sm " +
                    ((req.status === "APROVADA" || req.status === "AUTORIZADA") &&
                    req.status !== "UTILIZADA"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed")
                  }
                  onClick={confirmar}
                  disabled={
                    !(req.status === "APROVADA" || req.status === "AUTORIZADA") ||
                    req.status === "UTILIZADA" ||
                    confirmLoading
                  }
                >
                  {confirmLoading ? "Confirmando..." : "Confirmar viagem"}
                </button>
              </div>

              {req.status !== "UTILIZADA" &&
                !(req.status === "APROVADA" || req.status === "AUTORIZADA") && (
                  <div className="mt-2 text-xs text-amber-700">
                    {req.status === "PENDENTE"
                      ? "Aguardando autorização da Prefeitura."
                      : "Só é possível confirmar viagens APROVADAS/AUTORIZADAS."}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Relatório/Consulta (RESPONSIVO) ===== */}
      {reportOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setReportOpen(false)}
          />
          <div className="relative z-10 w-full max-w-4xl mx-2 sm:mx-4 bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            {/* header fixo */}
            <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm sm:text-base">
                Relatório / Consulta — {barcoAtivo || "—"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportXLSX}
                  className="px-3 py-1.5 rounded border text-xs sm:text-sm"
                >
                  Exportar (.xlsx)
                </button>
                <button
                  onClick={exportPDF}
                  className="px-3 py-1.5 rounded bg-gray-900 text-white text-xs sm:text-sm"
                >
                  PDF
                </button>
                <button
                  onClick={() => setReportOpen(false)}
                  className="px-2 py-1 rounded hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* conteúdo rolável */}
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              {/* filtros */}
              <div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label className="text-sm text-gray-600">Saída (início)</label>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-2 w-full"
                    value={ini}
                    onChange={(e) => {
                      setPage(1);
                      setIni(e.target.value);
                    }}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-sm text-gray-600">Saída (fim)</label>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-2 w-full"
                    value={fim}
                    onChange={(e) => {
                      setPage(1);
                      setFim(e.target.value);
                    }}
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="text-sm text-gray-600">Buscar</label>
                  <input
                    className="border rounded-md px-3 py-2 w-full"
                    placeholder="nº, nome, origem, destino, status..."
                    value={q}
                    onChange={(e) => {
                      setPage(1);
                      setQ(e.target.value);
                    }}
                  />
                </div>
                <div className="sm:col-span-1 flex items-end">
                  <button
                    className="w-full px-3 py-2 rounded border hover:bg-gray-100 text-sm"
                    onClick={() => {
                      setIni("");
                      setFim("");
                      setQ("");
                      setPage(1);
                    }}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* contadores */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">
                    Autorizadas (APROVADAS)
                  </div>
                  <div className="text-lg font-semibold">
                    {resumo.AUTORIZADA}
                  </div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Usadas</div>
                  <div className="text-lg font-semibold">{resumo.USADA}</div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Canceladas/Reprovadas</div>
                  <div className="text-lg font-semibold">
                    {resumo.CANCELADA}
                  </div>
                </div>
              </div>

              {/* lista */}
              <div className="mt-4 border rounded-xl overflow-hidden">
                {/* header desktop */}
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 border-b">
                  <div className="col-span-2">Nº / Requerente</div>
                  <div className="col-span-3">Origem → Destino</div>
                  <div className="col-span-2">Saída</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3 text-right">Ações</div>
                </div>

                <ul className="divide-y">
                  {pageItems.map((r) => (
                    <li key={r.id} className="px-4 py-3">
                      {/* desktop */}
                      <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-2">
                          <div className="font-medium">{r.numero}</div>
                          <div className="text-xs text-gray-600 truncate">
                            {r.nome}
                          </div>
                        </div>
                        <div className="col-span-3">
                          <div className="truncate">
                            {r.cidade_origem} → {r.cidade_destino}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {r.transportador}
                          </div>
                        </div>
                        <div className="col-span-2">
                          {r.data_saida || "—"}
                        </div>
                        <div className="col-span-2">
                          <span
                            className={`inline-block px-2 py-1 text-xs border rounded ${
                              statusClasses[r.status] || "border-gray-200"
                            }`}
                          >
                            {r.status}
                          </span>
                          <div className="text-[11px] text-gray-500 mt-1">
                            {r.utilizada_em
                              ? `Usada em ${new Date(
                                  r.utilizada_em
                                ).toLocaleString("pt-BR")}`
                              : "—"}
                          </div>
                        </div>
                        <div className="col-span-3 text-right">
                          <a
                            className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
                            href={`/canhoto/${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Canhoto
                          </a>
                        </div>
                      </div>

                      {/* mobile cards */}
                      <div className="md:hidden grid gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">#{r.numero}</div>
                            <div className="text-xs text-gray-600 truncate">
                              {r.nome}
                            </div>
                          </div>
                          <a
                            className="px-3 py-1.5 rounded border text-sm"
                            href={`/canhoto/${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Canhoto
                          </a>
                        </div>
                        <div className="text-sm">
                          <div className="truncate">
                            {r.cidade_origem} → {r.cidade_destino}
                          </div>
                          <div className="text-xs text-gray-500">
                            Saída: {r.data_saida} • {r.transportador}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-block px-2 py-1 text-xs border rounded ${
                              statusClasses[r.status] || "border-gray-200"
                            }`}
                          >
                            {r.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {r.utilizada_em
                              ? `Usada em ${new Date(
                                  r.utilizada_em
                                ).toLocaleString("pt-BR")}`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}

                  {pageItems.length === 0 && (
                    <li className="px-4 py-6 text-gray-500">
                      Nenhuma requisição para os filtros atuais.
                    </li>
                  )}
                </ul>

                {/* paginação */}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="text-sm text-gray-600">
                    {total === 0
                      ? "0 registros"
                      : `${start + 1}–${Math.min(
                          start + perPage,
                          total
                        )} de ${total}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded-md px-2 py-1 text-sm"
                      value={perPage}
                      onChange={(e) => {
                        setPerPage(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}/página
                        </option>
                      ))}
                    </select>
                    <button
                      className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                    >
                      ◀
                    </button>
                    <span className="text-sm">
                      {safePage} / {totalPages}
                    </span>
                    <button
                      className="px-2 py-1 rounded border text-sm disabled:opacity-50"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

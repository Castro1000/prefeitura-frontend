// src/pages/TransportadorValidar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200", // vamos exibir como AUTORIZADA
  UTILIZADA: "bg-gray-100 text-gray-800 border-gray-200",
  REPROVADA: "bg-red-100 text-red-800 border-red-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
};

/* -------- utilidades -------- */
function normText(s = "") {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizarBarco(nome = "") {
  return normText(
    String(nome)
      .replace(/^b\s*\/?\s*m\s*/i, "") // B/M, BM, B / M
      .replace(/^barco\s*/i, "") // "Barco "
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseExtras(obs) {
  if (!obs) return {};
  try {
    return JSON.parse(obs);
  } catch {
    return {};
  }
}

function getBarcoFromRow(r) {
  const extras = parseExtras(r.observacoes);
  return extras.transportador_nome_barco || "";
}

function getRgFromRow(r) {
  const extras = parseExtras(r.observacoes);
  return extras.rg || "";
}

function formatDataBr(isoDate) {
  if (!isoDate) return "—";
  const s = String(isoDate).slice(0, 10);
  if (!s.includes("-")) return s;
  const [ano, mes, dia] = s.split("-");
  return `${dia}/${mes}/${ano}`;
}

function getNumeroReq(r) {
  return r.numero_formatado || r.codigo_publico || r.id;
}

export default function TransportadorValidar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isTransportador = (user?.tipo || "").toLowerCase() === "transportador";

  // barco “ativo” do transportador
  const loginKey = normText(user?.login || "");
  const storageKey = loginKey ? `active_barco_${loginKey}` : "active_barco";
  const [barcoAtivo, setBarcoAtivo] = useState(user?.barco || "");
  const meuBarcoOriginal = barcoAtivo || user?.barco || "";
  const meuBarcoKey = normalizarBarco(meuBarcoOriginal);

  useEffect(() => {
    let inicial = (user?.barco || "").trim();
    if (!inicial) {
      const saved = localStorage.getItem(storageKey);
      if (saved) inicial = saved.trim();
    }
    if (inicial) {
      setBarcoAtivo(inicial);
      localStorage.setItem(storageKey, inicial);
    }
  }, [user?.barco, storageKey]);

  /* ====== LISTA DO BACKEND (para contagem / relatório) ====== */
  const [lista, setLista] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(false);

  async function carregarLista() {
    try {
      setCarregandoLista(true);
      const res = await fetch(`${API_BASE_URL}/api/requisicoes`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setLista(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao carregar lista de requisições:", err);
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    carregarLista();
  }, []);

  /* ====== SCANNER (html5-qrcode) ====== */
  const [qrOpen, setQrOpen] = useState(false);
  const html5qrcodeRef = useRef(null);
  const hasStartedRef = useRef(false);
  const qrDivId = "qr-reader-transportador";

  async function startScanner() {
    try {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      const { Html5Qrcode } = await import("html5-qrcode");

      try {
        await Html5Qrcode.stopAllStreamedCameras();
      } catch {}

      const html5qrcode = new Html5Qrcode(qrDivId, false);
      html5qrcodeRef.current = html5qrcode;

      const devices = await Html5Qrcode.getCameras();
      let camConfig;

      // 🔥 Prioriza câmera traseira, mas SEM forçar resolução e sem aspect ratio — deixa o navegador escolher
      if (devices?.length) {
        const back = devices.find((d) =>
          /back|rear|traseira|environment/i.test(d.label || "")
        );
        if (back) {
          camConfig = { deviceId: { exact: back.id } };
        } else {
          camConfig = { deviceId: { exact: devices[0].id } };
        }
      } else {
        camConfig = { facingMode: "environment" };
      }

      const config = {
        fps: 10,
        // Caixa de leitura “quadrada” no meio, sem dar zoom absurdo
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        // nada de aspectRatio, nada de videoConstraints — isso estava causando zoom/embaçado
      };

      const onSuccess = (decodedText) => {
        stopScanner();
        handleScan(decodedText);
      };
      const onFailure = () => {};

      await html5qrcode.start(camConfig, config, onSuccess, onFailure);
    } catch (err) {
      console.error("Erro ao iniciar câmera:", err);
      alert(
        "Não foi possível iniciar a câmera.\n" +
          "Verifique se o navegador tem permissão de acesso e feche outros apps usando a câmera."
      );
      stopScanner();
      setQrOpen(false);
    }
  }

  async function stopScanner() {
    try {
      if (html5qrcodeRef.current) {
        const inst = html5qrcodeRef.current;
        html5qrcodeRef.current = null;
        await inst.stop();
        await inst.clear();
      }
    } catch {
    } finally {
      hasStartedRef.current = false;
    }
  }

  function handleScan(value) {
    const raw = String(value || "").trim();
    const id = raw.includes("/canhoto/")
      ? raw.split("/canhoto/").pop().split(/[?#]/)[0]
      : raw;
    setCodigo(id);
    buscar(id);
  }

  /* ===== Busca / Confirmação (BACKEND) ===== */
  const [codigo, setCodigo] = useState("");
  const [req, setReq] = useState(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [erroBusca, setErroBusca] = useState("");
  const [carregandoReq, setCarregandoReq] = useState(false);

  function validarPertenceAoMeuBarcoBack(registro) {
    if (!meuBarcoKey) return true; // se não tiver barco definido, não bloqueia
    const barcoReq = getBarcoFromRow(registro);
    const barcoReqKey = normalizarBarco(barcoReq);
    if (barcoReqKey && barcoReqKey !== meuBarcoKey) {
      alert("Esta requisição não pertence ao seu barco.");
      return false;
    }
    return true;
  }

  async function buscar(codeArg) {
    const code = (codeArg ?? codigo).trim();
    if (!code) {
      setErroBusca("Informe o código ou leia o QR.");
      return;
    }
    setErroBusca("");
    setReq(null);
    setReqOpen(false);
    setCarregandoReq(true);

    try {
      let url;
      // Se for só número → ID
      if (/^\d+$/.test(code)) {
        url = `${API_BASE_URL}/api/requisicoes/${code}`;
      } else {
        // Letras + números → código público
        url = `${API_BASE_URL}/api/requisicoes/codigo/${encodeURIComponent(
          code
        )}`;
      }

      const res = await fetch(url);
      if (res.status === 404) {
        setErroBusca("Requisição não encontrada.");
        setCarregandoReq(false);
        return;
      }
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }

      const data = await res.json();

      if (!validarPertenceAoMeuBarcoBack(data)) {
        setCarregandoReq(false);
        return;
      }

      setReq(data);
      setReqOpen(true);
    } catch (err) {
      console.error("Erro ao buscar requisição:", err);
      setErroBusca("Erro ao buscar requisição.");
    } finally {
      setCarregandoReq(false);
    }
  }

  async function confirmar() {
    if (!req) return;

    if (req.status !== "APROVADA") {
      alert("Só é possível confirmar viagens AUTORIZADAS.");
      return;
    }

    if (!window.confirm("Confirmar embarque desta requisição?")) {
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes/${req.id}/validar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transportador_id: user?.id,
            tipo_validacao: "EMBARQUE",
            codigo_lido: req.codigo_publico,
            local_validacao: meuBarcoOriginal || null,
            observacao: null,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Erro ao validar:", body);
        alert(
          body?.error ||
            "Não foi possível confirmar a viagem. Tente novamente em instantes."
        );
        return;
      }

      const data = await res.json(); // { ok: true, status: "UTILIZADA" }

      setReq((prev) =>
        prev
          ? {
              ...prev,
              status: data.status || "UTILIZADA",
              utilizada_em: new Date().toISOString(),
            }
          : prev
      );

      // recarrega lista para atualizar contadores
      carregarLista();

      alert("Embarque confirmado!");
    } catch (err) {
      console.error("Erro ao confirmar embarque:", err);
      alert("Erro ao confirmar embarque.");
    }
  }

  /* ===== Minhas viagens em aberto (contagem) ===== */
  const abertas = useMemo(() => {
    if (!meuBarcoKey) return [];
    return lista.filter((r) => {
      const barcoReqKey = normalizarBarco(getBarcoFromRow(r));
      const isMeuBarco = barcoReqKey === meuBarcoKey;
      const isAutorizada = r.status === "APROVADA";
      const usada = r.status === "UTILIZADA";
      return isMeuBarco && isAutorizada && !usada;
    });
  }, [lista, meuBarcoKey]);

  /* ===== Relatório / Consulta ===== */
  const [reportOpen, setReportOpen] = useState(false);
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const minhas = useMemo(() => {
    const qn = normText(q.trim());
    return lista.filter((r) => {
      if (!meuBarcoKey) return false;
      const barcoReqKey = normalizarBarco(getBarcoFromRow(r));
      if (barcoReqKey !== meuBarcoKey) return false;

      const d = String(r.data_ida || "").slice(0, 10);
      if (ini && (!d || d < ini)) return false;
      if (fim && (!d || d > fim)) return false;

      if (qn) {
        const hay =
          (getNumeroReq(r) || "") +
          " " +
          (r.passageiro_nome || "") +
          " " +
          (r.origem || "") +
          " " +
          (r.destino || "") +
          " " +
          (r.status || "");
        if (!normText(hay).includes(qn)) return false;
      }
      return true;
    });
  }, [lista, meuBarcoKey, ini, fim, q]);

  const resumo = useMemo(() => {
    const base = { AUTORIZADA: 0, USADA: 0, CANCELADA: 0 };
    for (const r of minhas) {
      if (r.status === "APROVADA") base.AUTORIZADA++;
      if (r.status === "UTILIZADA") base.USADA++;
      if (r.status === "REPROVADA" || r.status === "CANCELADA")
        base.CANCELADA++;
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
        Numero: getNumeroReq(r),
        Status: r.status === "APROVADA" ? "AUTORIZADA" : r.status || "",
        "Data saída": formatDataBr(r.data_ida),
        Origem: r.origem || "",
        Destino: r.destino || "",
        Requerente: r.passageiro_nome || "",
        CPF: r.passageiro_cpf || "",
        RG: getRgFromRow(r) || "",
        Barco: getBarcoFromRow(r) || "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Abatimento");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(
        wb,
        `abatimento-${(meuBarcoOriginal || "transportador").replace(
          /\s+/g,
          "_"
        )}-${today}.xlsx`
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

  const semBarco = !meuBarcoOriginal;

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

      <main className="container-page py-4 pb-28 sm:pb-6">
        {/* topo */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold leading-tight">
              Painel do Transportador
            </h2>

            {semBarco ? (
              <div className="mt-1 text-xs text-rose-700">
                Nenhum barco definido para este usuário. Peça ao
                administrador/representante para cadastrar o barco em{" "}
                <b>Configurações → Usuários (tipo Transportador)</b>.
              </div>
            ) : (
              <div className="text-xs text-gray-600 mt-1">
                Barco: <b>{meuBarcoOriginal}</b>
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

        {/* bloco central */}
        <section className="bg-white border rounded-xl p-4 max-w-xl mx-auto">
          <div className="mb-3 text-sm text-gray-700 text-center">
            Viagens em aberto para este barco:{" "}
            {carregandoLista ? (
              <span className="font-semibold">…</span>
            ) : (
              <span className="font-semibold">{abertas.length}</span>
            )}
          </div>

          <div className="grid gap-3">
            <button
              className="w-full px-4 py-3 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => {
                if (semBarco) {
                  alert("Defina o barco para este usuário nas configurações.");
                  return;
                }
                setQrOpen(true);
                setTimeout(() => startScanner(), 80);
              }}
              disabled={semBarco}
            >
              📷 Escanear QR
            </button>

            <div className="flex gap-2">
              <input
                className="border rounded-md px-3 py-3 w-full"
                placeholder="Ou digite o código (ID ou código público)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <button
                className="px-4 py-3 rounded border"
                onClick={() => {
                  if (semBarco) {
                    alert("Defina o barco para este usuário nas configurações.");
                    return;
                  }
                  buscar();
                }}
              >
                Buscar
              </button>
            </div>
          </div>

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
                <div id={qrDivId} className="w-full h-[360px]" />
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-10 border-2 border-white/70 rounded-lg" />
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Posicione o QR dentro da moldura. Funciona em iPhone (Safari) e
                Android (Chrome).
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
              {carregandoReq ? (
                <div className="text-center text-gray-500">
                  Carregando dados…
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold">
                        Nº {getNumeroReq(req)}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {req.origem} → {req.destino} • Saída:{" "}
                        {formatDataBr(req.data_ida)}
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
                    <span className="font-medium">
                      {req.passageiro_nome || "-"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    CPF {req.passageiro_cpf || "—"} • RG{" "}
                    {getRgFromRow(req) || "—"}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    Barco: {getBarcoFromRow(req) || "—"}
                  </div>

                  {req.status === "UTILIZADA" && (
                    <div className="mt-2 text-emerald-700 text-xs">
                      ✔ Viagem já confirmada
                      {req.utilizada_em
                        ? ` em ${new Date(
                            req.utilizada_em
                          ).toLocaleString("pt-BR")}`
                        : ""}{" "}
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
                        (req.status === "APROVADA"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-gray-300 text-gray-600 cursor-not-allowed")
                      }
                      onClick={confirmar}
                      disabled={req.status !== "APROVADA"}
                    >
                      Confirmar viagem
                    </button>
                  </div>

                  {req.status !== "APROVADA" && req.status !== "UTILIZADA" && (
                    <div className="mt-2 text-xs text-amber-700">
                      {req.status === "PENDENTE"
                        ? "Aguardando autorização da Prefeitura."
                        : "Só é possível confirmar viagens AUTORIZADAS."}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Relatório/Consulta ===== */}
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
                Relatório / Consulta — {meuBarcoOriginal || "—"}
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
                  <label className="text-sm text-gray-600">
                    Saída (início)
                  </label>
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
                  <div className="text-xs text-gray-500">Autorizadas</div>
                  <div className="text-lg font-semibold">
                    {resumo.AUTORIZADA}
                  </div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Usadas</div>
                  <div className="text-lg font-semibold">{resumo.USADA}</div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Canceladas</div>
                  <div className="text-lg font-semibold">
                    {resumo.CANCELADA}
                  </div>
                </div>
              </div>

              {/* lista */}
              <div className="mt-4 border rounded-xl overflow-hidden">
                {/* header desktop */}
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 border-b">
                  <div className="col-span-3">Nº / Requerente</div>
                  <div className="col-span-3">Origem → Destino</div>
                  <div className="col-span-2">Saída</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Ações</div>
                </div>

                <ul className="divide-y">
                  {pageItems.map((r) => (
                    <li key={r.id} className="px-4 py-3">
                      {/* desktop */}
                      <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <div className="font-medium">
                            {getNumeroReq(r)}
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            {r.passageiro_nome}
                          </div>
                        </div>
                        <div className="col-span-3">
                          <div className="truncate">
                            {r.origem} → {r.destino}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {getBarcoFromRow(r)}
                          </div>
                        </div>
                        <div className="col-span-2">
                          {formatDataBr(r.data_ida)}
                        </div>
                        <div className="col-span-2">
                          <span
                            className={`inline-block px-2 py-1 text-xs border rounded ${
                              statusClasses[r.status] || "border-gray-200"
                            }`}
                          >
                            {r.status === "APROVADA"
                              ? "AUTORIZADA"
                              : r.status}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
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

                      {/* mobile */}
                      <div className="md:hidden grid gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {getNumeroReq(r)}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {r.passageiro_nome}
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
                            {r.origem} → {r.destino}
                          </div>
                          <div className="text-xs text-gray-500">
                            Saída: {formatDataBr(r.data_ida)} •{" "}
                            {getBarcoFromRow(r)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-block px-2 py-1 text-xs border rounded ${
                              statusClasses[r.status] || "border-gray-200"
                            }`}
                          >
                            {r.status === "APROVADA"
                              ? "AUTORIZADA"
                              : r.status}
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
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
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

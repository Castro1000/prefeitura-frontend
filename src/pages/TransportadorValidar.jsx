import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REPROVADA: "bg-red-100 text-red-800 border-red-200",
  UTILIZADA: "bg-gray-200 text-gray-800 border-gray-300",
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
      .replace(/^b\s*\/?\s*m\s*/i, "")
      .replace(/^barco\s*/i, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseExtras(row = {}) {
  let extras = {};
  try {
    if (row.observacoes) extras = JSON.parse(row.observacoes);
  } catch {
    extras = {};
  }
  return extras;
}

// Mapeia o formato do banco → formato usado na tela
function mapRow(row) {
  const extras = parseExtras(row);

  const rg = extras.rg || row.rg || "";
  const barco =
    extras.transportador_nome_barco ||
    row.transportador ||
    extras.barco ||
    "";

  return {
    id: row.id,
    numero: row.numero_formatado || row.codigo_publico || String(row.id),
    nome: row.passageiro_nome,
    cpf: row.passageiro_cpf,
    rg,
    cidade_origem: row.origem,
    cidade_destino: row.destino,
    data_saida: row.data_ida,
    status: row.status,
    transportador: barco,
    codigo_publico: row.codigo_publico,
    utilizada_em: row.utilizada_em || null,
    utilizada_por: row.utilizada_por || null,
  };
}

export default function TransportadorValidar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isTransportador = (user?.tipo || "").toLowerCase() === "transportador";

  const meuBarcoOriginal = (user?.barco || "").trim();
  const meuBarcoKey = normalizarBarco(meuBarcoOriginal);

  /* ====== LISTA / RELATÓRIO ====== */
  const [todas, setTodas] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(false);

  async function carregarLista() {
    if (!meuBarcoKey) return;
    try {
      setCarregandoLista(true);
      const res = await fetch(`${API_BASE_URL}/api/requisicoes`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setTodas(data.map(mapRow));
    } catch (err) {
      console.error("Erro ao listar requisicoes:", err);
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    carregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuBarcoKey]);

  const abertas = useMemo(() => {
    if (!meuBarcoKey) return [];
    return todas.filter((r) => {
      const barcoReq = normalizarBarco(r.transportador || "");
      return barcoReq === meuBarcoKey && r.status === "APROVADA";
    });
  }, [todas, meuBarcoKey]);

  /* ====== SCANNER html5-qrcode (simples) ====== */
  const [qrOpen, setQrOpen] = useState(false);
  const html5qrcodeRef = useRef(null);
  const hasStartedRef = useRef(false);
  const hasScannedRef = useRef(false);
  const qrDivId = "qr-reader-transportador";

  async function startScanner() {
    try {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      hasScannedRef.current = false;

      const { Html5Qrcode } = await import("html5-qrcode");

      const html5qrcode = new Html5Qrcode(qrDivId);
      html5qrcodeRef.current = html5qrcode;

      const config = {
        fps: 10,
        qrbox: 250, // quadrado padrão
      };

      await html5qrcode.start(
        { facingMode: "environment" },
        config,
        async (decodedText /*, decodedResult */) => {
          // TRAVA: só deixa passar a primeira leitura
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;

          await stopScanner();
          setQrOpen(false);
          handleScan(decodedText);
        },
        () => {
          // onFailure: ignoramos os erros de tentativa
        }
      );
    } catch (err) {
      console.error("Erro ao iniciar câmera:", err);
      alert(
        "Não foi possível iniciar a câmera.\n" +
          "Permita o acesso no navegador. Se persistir, digite o código manualmente."
      );
      await stopScanner();
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
    } catch (e) {
      console.warn("Erro ao parar scanner:", e);
    } finally {
      hasStartedRef.current = false;
    }
  }

  /* ===== Busca / Confirmação ===== */
  const [codigo, setCodigo] = useState("");
  const [req, setReq] = useState(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [erro, setErro] = useState("");
  const [validando, setValidando] = useState(false);

  function validarPertenceAoMeuBarco(registro) {
    const barcoReqKey = normalizarBarco(registro?.transportador || "");
    if (meuBarcoKey && barcoReqKey && barcoReqKey !== meuBarcoKey) {
      alert("Esta requisição não pertence ao seu barco.");
      return false;
    }
    return true;
  }

  function handleScan(value) {
    const raw = String(value || "").trim();
    let id = null;
    let codigoPublico = null;

    if (raw.includes("/canhoto/")) {
      id = raw.split("/canhoto/").pop().split(/[?#]/)[0];
    } else if (/^\d+$/.test(raw)) {
      id = raw;
    } else {
      codigoPublico = raw;
    }

    setCodigo(codigoPublico || id || "");
    buscar(id, codigoPublico);
  }

  async function buscar(idArg, codigoPublicoArg) {
    try {
      setErro("");
      setReq(null);
      setReqOpen(false);

      if (!meuBarcoKey) {
        alert("Este usuário não tem barco cadastrado. Verifique o cadastro.");
        return;
      }

      let row = null;

      if (idArg) {
        const res = await fetch(`${API_BASE_URL}/api/requisicoes/${idArg}`);
        if (res.status === 404) {
          setErro("Requisição não encontrada.");
          return;
        }
        if (!res.ok) throw new Error("HTTP " + res.status);
        row = await res.json();
      } else {
        const code = (codigoPublicoArg || codigo).trim();
        if (!code) {
          setErro("Informe o código do canhoto.");
          return;
        }
        const params = new URLSearchParams();
        params.set("codigo_publico", code);
        const res = await fetch(
          `${API_BASE_URL}/api/requisicoes?${params.toString()}`
        );
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!data.length) {
          setErro("Requisição não encontrada.");
          return;
        }
        row = data[0];
      }

      const mapped = mapRow(row);

      if (!validarPertenceAoMeuBarco(mapped)) {
        return;
      }

      setReq(mapped);
      setReqOpen(true);
    } catch (err) {
      console.error("Erro ao buscar requisicao:", err);
      setErro("Erro ao buscar requisição.");
    }
  }

  async function confirmar() {
    if (!req) return;

    if (req.status !== "APROVADA") {
      alert("Só é possível confirmar viagens APROVADAS.");
      return;
    }

    const ok = confirm("Confirmar embarque desta requisição?");
    if (!ok) return;

    try {
      setValidando(true);

      const body = {
        transportador_id: user?.id,
        tipo_validacao: "EMBARQUE",
        codigo_lido: req.codigo_publico || codigo || String(req.id),
        local_validacao: null,
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
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Erro ao validar.");
      }

      const json = await res.json();

      const atualizado = {
        ...req,
        status: json.status || "UTILIZADA",
      };
      setReq(atualizado);

      alert("Embarque confirmado com sucesso!");
      carregarLista();
    } catch (err) {
      console.error("Erro ao confirmar:", err);
      alert(err.message || "Não foi possível confirmar a viagem.");
    } finally {
      setValidando(false);
    }
  }

  /* ===== Relatório ===== */
  const [reportOpen, setReportOpen] = useState(false);
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const minhas = useMemo(() => {
    const qn = normText(q.trim());
    return todas.filter((r) => {
      const barcoReq = normalizarBarco(r.transportador || "");
      if (!meuBarcoKey || barcoReq !== meuBarcoKey) return false;

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
  }, [todas, meuBarcoKey, ini, fim, q]);

  const resumo = useMemo(() => {
    const base = { APROVADA: 0, UTILIZADA: 0, REPROVADA: 0 };
    for (const r of minhas) {
      if (r.status === "APROVADA") base.APROVADA++;
      if (r.status === "REPROVADA") base.REPROVADA++;
      if (r.status === "UTILIZADA") base.UTILIZADA++;
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

  if (!meuBarcoOriginal) {
    return (
      <>
        <Header />
        <main className="container-page py-8">
          <div className="max-w-md p-4 border rounded-xl bg-rose-50 text-rose-800">
            Usuário transportador sem barco cadastrado.
            <br />
            Peça para o administrador/representante informar o{" "}
            <b>nome do barco</b> no cadastro de usuário.
          </div>
        </main>
      </>
    );
  }

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
            <div className="text-xs text-gray-600 mt-1">
              Barco: <b>{meuBarcoOriginal}</b>
            </div>
          </div>

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

        {/* scanner + código */}
        <section className="bg-white border rounded-xl p-4 max-w-xl mx-auto">
          <div className="mb-3 text-sm text-gray-700 text-center">
            Viagens em aberto para este barco:{" "}
            <span className="font-semibold">
              {carregandoLista ? "..." : abertas.length}
            </span>
          </div>

          <div className="grid gap-3">
            <button
              className="w-full px-4 py-3 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700"
              onClick={() => {
                setQrOpen(true);
                setTimeout(() => startScanner(), 80);
              }}
            >
              📷 Escanear QR
            </button>

            <div className="flex gap-2">
              <input
                className="border rounded-md px-3 py-3 w-full"
                placeholder="Ou digite o código público (IST7E18TGN...)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <button
                className="px-4 py-3 rounded border"
                onClick={() => buscar(null, codigo)}
              >
                Buscar
              </button>
            </div>
          </div>

          {erro && (
            <p className="mt-3 text-sm text-red-600 text-center">{erro}</p>
          )}
        </section>
      </main>

      {/* MODAL QR */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={async () => {
              await stopScanner();
              hasScannedRef.current = false;
              setQrOpen(false);
            }}
          />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">Escanear QR do Canhoto</h3>
            </div>
            <div className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <div id={qrDivId} className="w-full h-[420px]" />
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-6 border-2 border-white/70 rounded-lg" />
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Posicione o QR do canhoto dentro da moldura. Se estiver
                embaçado, afaste um pouco o papel (uns 15–20 cm) até a câmera
                focar.
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  className="px-3 py-2 rounded border text-xs sm:text-sm hover:bg-gray-50"
                  onClick={async () => {
                    await stopScanner();
                    hasScannedRef.current = false;
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

      {/* MODAL REQUISIÇÃO */}
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

              {req.status === "UTILIZADA" && (
                <div className="mt-2 text-emerald-700 text-xs">
                  ✔ Viagem já confirmada (UTILIZADA).
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
                  disabled={req.status !== "APROVADA" || validando}
                >
                  {validando ? "Confirmando..." : "Confirmar viagem"}
                </button>
              </div>

              {req.status !== "APROVADA" && req.status !== "UTILIZADA" && (
                <div className="mt-2 text-xs text-amber-700">
                  {req.status === "PENDENTE"
                    ? "Aguardando autorização da Prefeitura."
                    : "Requisição REPROVADA. Não é possível embarcar."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL RELATÓRIO */}
      {reportOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setReportOpen(false)}
          />
          <div className="relative z-10 w-full max-w-4xl mx-2 sm:mx-4 bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm sm:text-base">
                Relatório / Consulta — {meuBarcoOriginal}
              </h3>
              <button
                onClick={() => setReportOpen(false)}
                className="px-2 py-1 rounded hover:bg-gray-100 text-xs sm:text-sm"
              >
                Fechar
              </button>
            </div>

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
                  <div className="text-xs text-gray-500">Aprovadas</div>
                  <div className="text-lg font-semibold">
                    {resumo.APROVADA}
                  </div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Utilizadas</div>
                  <div className="text-lg font-semibold">
                    {resumo.UTILIZADA}
                  </div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">Reprovadas</div>
                  <div className="text-lg font-semibold">
                    {resumo.REPROVADA}
                  </div>
                </div>
              </div>

              {/* lista */}
              <div className="mt-4 border rounded-xl overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs text-gray-500 border-b">
                  <div className="col-span-2">Nº / Requerente</div>
                  <div className="col-span-3">Origem → Destino</div>
                  <div className="col-span-2">Saída</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3 text-right">Canhoto</div>
                </div>

                <ul className="divide-y">
                  {pageItems.map((r) => (
                    <li key={r.id} className="px-4 py-3">
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

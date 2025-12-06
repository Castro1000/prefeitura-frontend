// src/pages/TransportadorValidar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import { getOne, marcarUtilizada, loadAll, listUsers } from "../lib/storage.js";

const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  AUTORIZADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  UTILIZADA: "bg-sky-100 text-sky-800 border-sky-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
  REPROVADA: "bg-red-100 text-red-800 border-red-200",
};

/* -------- utilidades -------- */
function normText(s = "") {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

// Extrai possíveis barcos de um registro de usuário
function extrairBarcosDoUsuario(u) {
  const out = [];
  if (!u) return out;
  if (u.barco) out.push(String(u.barco));
  if (Array.isArray(u.barcos)) out.push(...u.barcos.map(String));
  if (u.barcos_str) {
    out.push(
      ...String(u.barcos_str)
        .split(/[,\n;]/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  const seen = new Set();
  const final = [];
  for (const b of out) {
    const k = normalizarBarco(b);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    final.push(b.trim());
  }
  return final;
}

export default function TransportadorValidar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isTransportador = (user?.tipo || "").toLowerCase() === "transportador";

  // chave específica por login pra não reaproveitar barco de outro usuário
  const loginKey = normText(user?.login || "");
  const storageKey = loginKey ? `active_barco_${loginKey}` : "active_barco";

  const [barcoAtivo, setBarcoAtivo] = useState("");
  const [barcosDisponiveis, setBarcosDisponiveis] = useState([]);

  useEffect(() => {
    let inicial = (user?.barco || "").trim();

    if (!inicial) {
      const saved = localStorage.getItem(storageKey);
      if (saved) inicial = saved.trim();
    }

    const all = listUsers?.() || [];
    const me =
      all.find((u) => normText(u?.login) === normText(user?.login)) ||
      all.find((u) => normText(u?.nome) === normText(user?.nome));
    const barcos = extrairBarcosDoUsuario(me);
    setBarcosDisponiveis(barcos);

    if (!inicial && barcos.length === 1) {
      inicial = barcos[0];
    }

    if (inicial) {
      setBarcoAtivo(inicial);
      localStorage.setItem(storageKey, inicial);
    }
  }, [user?.login, user?.nome, user?.barco, storageKey]);

  const meuBarcoOriginal = barcoAtivo || "";
  const meuBarcoKey = normalizarBarco(meuBarcoOriginal);

  /* ====== SCANNER (html5-qrcode) ====== */
  const [qrOpen, setQrOpen] = useState(false);
  const html5qrcodeRef = useRef(null);
  const hasStartedRef = useRef(false);
  const qrDivId = "qr-reader-transportador";

  // 🚀 NOVA VERSÃO: scanner nítido, sem zoom exagerado
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
      let camId = null;

      // Prioriza câmera traseira
      if (devices?.length) {
        const back = devices.find((d) =>
          /back|rear|traseira|environment/i.test(d.label)
        );
        camId = back ? back.id : devices[0].id;
      }

      const config = {
        fps: 8,
        qrbox: { width: 260, height: 260 }, // caixa de leitura estável
        aspectRatio: 1,
        disableFlip: true,
        // Alta resolução pra evitar imagem embaçada
        videoConstraints: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: "continuous",
          advanced: [
            { focusMode: "continuous" },
            { exposureMode: "continuous" },
            { whiteBalanceMode: "continuous" },
          ],
        },
      };

      const onSuccess = (decodedText) => {
        stopScanner();
        handleScan(decodedText);
      };
      const onFailure = () => {};

      if (camId) {
        await html5qrcode.start(
          { deviceId: { exact: camId } },
          config,
          onSuccess,
          onFailure
        );
      } else {
        await html5qrcode.start(
          { facingMode: "environment" },
          config,
          onSuccess,
          onFailure
        );
      }
    } catch (err) {
      console.error(err);
      alert(
        "Não foi possível iniciar a câmera. Permita o acesso no navegador. Se persistir, digite o código manualmente."
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
    } catch {} finally {
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

  /* ===== Busca / Confirmação ===== */
  const [codigo, setCodigo] = useState("");
  const [req, setReq] = useState(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [erro, setErro] = useState("");

  function validarPertenceAoMeuBarco(registro) {
    const barcoReqKey = normalizarBarco(registro?.transportador || "");
    if (meuBarcoKey && barcoReqKey && barcoReqKey !== meuBarcoKey) {
      alert("Esta requisição não pertence ao seu barco.");
      return false;
    }
    return true;
  }

  function buscar(codeArg) {
    const code = (codeArg ?? codigo).trim();
    setErro("");
    setReqOpen(false);

    const r = getOne(code);
    if (!r) {
      setReq(null);
      setErro("Requisição não encontrada.");
      return;
    }
    if (!meuBarcoKey) {
      alert("Selecione o barco ativo primeiro.");
      return;
    }
    if (!validarPertenceAoMeuBarco(r)) {
      setReq(null);
      return;
    }
    setReq(r);
    setReqOpen(true);
  }

  function confirmar() {
    if (!req) return;

    // ✅ Considera APROVADA e AUTORIZADA como válidas
    const autorizada =
      req.status === "AUTORIZADA" || req.status === "APROVADA";

    if (!autorizada) {
      alert("Só é possível confirmar viagens APROVADAS/AUTORIZADAS.");
      return;
    }
    if (req.utilizada_em) {
      alert("Esta requisição já foi utilizada.");
      return;
    }
    if (!validarPertenceAoMeuBarco(req)) return;

    const ok = confirm("Confirmar embarque desta requisição?");
    if (!ok) return;

    if (marcarUtilizada(req.id, user?.nome || user?.login || "transportador")) {
      const r2 = getOne(req.id);
      setReq(r2);
      alert("Embarque confirmado!");
    }
  }

  /* ===== Minhas viagens em aberto (só contagem) ===== */
  const todas = (loadAll() || [])
    .slice()
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const abertas = useMemo(() => {
    if (!meuBarcoKey) return [];
    return todas.filter((r) => {
      const isMeuBarco = normalizarBarco(r.transportador) === meuBarcoKey;
      const autorizada =
        r.status === "AUTORIZADA" || r.status === "APROVADA";
      return isMeuBarco && autorizada && !r.utilizada_em;
    });
  }, [todas, meuBarcoKey]);

  /* ===== Relatório / Consulta ===== */
  const [reportOpen, setReportOpen] = useState(false);
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const minhas = useMemo(() => {
    const qn = normText(q.trim());
    return todas.filter((r) => {
      if (!meuBarcoKey || normalizarBarco(r.transportador) !== meuBarcoKey)
        return false;
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
    const base = { AUTORIZADA: 0, USADA: 0, CANCELADA: 0 };
    for (const r of minhas) {
      if (r.status === "AUTORIZADA" || r.status === "APROVADA")
        base.AUTORIZADA++;
      if (r.status === "CANCELADA" || r.status === "REPROVADA")
        base.CANCELADA++;
      if (r.utilizada_em) base.USADA++;
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

  const semBarco = !meuBarcoOriginal && barcosDisponiveis.length === 0;

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

            {barcosDisponiveis.length > 1 ? (
              <div className="flex items-center gap-2 mt-1">
                <label className="text-xs text-gray-600">Barco ativo:</label>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={barcoAtivo}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBarcoAtivo(v);
                    localStorage.setItem(storageKey, v);
                  }}
                >
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {barcosDisponiveis.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            ) : semBarco ? (
              <div className="mt-1 text-xs text-rose-700">
                Nenhum barco cadastrado para este usuário. Peça ao
                representante para cadastrar em{" "}
                <b>Configurações → Usuários (tipo Transportador)</b>.
              </div>
            ) : (
              <div className="text-xs text-gray-600 mt-1">
                Barco: <b>{meuBarcoOriginal || "—"}</b>
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
            <span className="font-semibold">{abertas.length}</span>
          </div>

          <div className="grid gap-3">
            <button
              className="w-full px-4 py-3 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => {
                if (!meuBarcoOriginal) {
                  alert("Selecione o barco ativo primeiro.");
                  return;
                }
                setQrOpen(true);
                setTimeout(() => startScanner(), 60);
              }}
              disabled={!meuBarcoOriginal}
            >
              📷 Escanear QR
            </button>

            <div className="flex gap-2">
              <input
                className="border rounded-md px-3 py-3 w-full"
                placeholder="Ou digite o código (ex.: 123, 45 ou ID da requisição)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <button
                className="px-4 py-3 rounded border"
                onClick={() => {
                  if (!meuBarcoOriginal) {
                    alert("Selecione o barco ativo primeiro.");
                    return;
                  }
                  buscar();
                }}
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
                <div id="qr-reader-transportador" className="w-full h-[420px]" />
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-6 border-2 border-white/70 rounded-lg" />
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

              {req.utilizada_em && (
                <div className="mt-2 text-emerald-700 text-xs">
                  ✔ Viagem já confirmada em{" "}
                  {new Date(req.utilizada_em).toLocaleString("pt-BR")}
                  {req.utilizada_por ? ` por ${req.utilizada_por}` : ""}
                </div>
              )}

              {/* ✅ Habilita botão se status for AUTORIZADA ou APROVADA */}
              const autorizada =
                req.status === "AUTORIZADA" || req.status === "APROVADA";

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
                    (autorizada && !req.utilizada_em
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed")
                  }
                  onClick={confirmar}
                  disabled={!autorizada || !!req.utilizada_em}
                >
                  Confirmar viagem
                </button>
              </div>

              {!autorizada && !req.utilizada_em && (
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

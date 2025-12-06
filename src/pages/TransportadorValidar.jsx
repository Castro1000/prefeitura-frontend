// src/pages/TransportadorValidar.jsx
import { useEffect, useRef, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

// Mapeia cores de status
const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  AUTORIZADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
  UTILIZADA: "bg-gray-200 text-gray-800 border-gray-300",
};

// util simples
function formatarDataBr(str) {
  if (!str) return "-";
  const s = String(str).slice(0, 10); // yyyy-mm-dd
  const [ano, mes, dia] = s.split("-");
  if (!ano || !mes || !dia) return str;
  return `${dia}/${mes}/${ano}`;
}

function normText(s = "") {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function TransportadorValidar() {
  // usuário logado (tipo transportador)
  const userRaw =
    localStorage.getItem("user") || localStorage.getItem("usuario");
  const user = userRaw ? JSON.parse(userRaw) : null;
  const tipo = (user?.tipo || user?.perfil || "").toLowerCase();
  const isTransportador = tipo === "transportador";

  const barco = user?.barco || "";

  // scanner
  const [qrOpen, setQrOpen] = useState(false);
  const html5qrcodeRef = useRef(null);
  const hasStartedRef = useRef(false);
  const qrDivId = "qr-reader-transportador";

  // busca / resultado
  const [codigo, setCodigo] = useState("");
  const [codigoUsado, setCodigoUsado] = useState(""); // guarda o que foi lido
  const [req, setReq] = useState(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmaLoading, setConfirmaLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // ---------- scanner QR (html5-qrcode) ----------
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
      let camId;
      if (devices?.length) {
        const back = devices.find((d) =>
          /back|traseira|rear|environment/i.test(d.label || "")
        );
        camId = back ? back.id : devices[0].id;
      }

      const config = {
        fps: 10,
        qrbox: (vw, vh) => {
          const minEdge = Math.min(vw, vh);
          const box = Math.floor(minEdge * 0.7);
          return { width: box, height: box };
        },
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        aspectRatio: 1.333,
      };

      const onSuccess = (decodedText) => {
        stopScanner();
        setQrOpen(false);
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
    } catch {
    } finally {
      hasStartedRef.current = false;
    }
  }

  function handleScan(value) {
    const raw = String(value || "").trim();
    // Se for a URL do canhoto, extrai o ID
    let entrada = raw;
    if (raw.includes("/canhoto/")) {
      entrada = raw.split("/canhoto/").pop().split(/[?#]/)[0];
    }
    setCodigo(entrada);
    buscarRequisicao(entrada);
  }

  // ---------- BUSCA NA API ----------
  async function fetchPorId(id) {
    const res = await fetch(`${API_BASE_URL}/api/requisicoes/${id}`);
    if (res.status === 404) {
      throw new Error("Requisição não encontrada.");
    }
    if (!res.ok) {
      throw new Error("Erro ao buscar requisição.");
    }
    return await res.json();
  }

  async function fetchPorCodigoPublico(cod) {
    const url = `${API_BASE_URL}/api/requisicoes?codigo_publico=${encodeURIComponent(
      cod
    )}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Erro ao buscar requisição.");
    }
    const lista = await res.json();
    if (!Array.isArray(lista) || lista.length === 0) {
      throw new Error("Requisição não encontrada para este código.");
    }
    // esperamos somente 1
    return lista[0];
  }

  async function buscarRequisicao(codArg) {
    const entrada = (codArg ?? codigo).trim();
    if (!entrada) {
      setErro("Informe o ID ou o código público.");
      setReq(null);
      setModalOpen(false);
      return;
    }

    setErro("");
    setLoading(true);
    setReq(null);
    setModalOpen(false);

    try {
      let data;

      // Só dígitos? trata como ID da requisição.
      if (/^\d+$/.test(entrada)) {
        data = await fetchPorId(entrada);
      } else {
        // Caso contrário, assume que é o código público (ex.: SV6676NKVA)
        data = await fetchPorCodigoPublico(entrada);
      }

      // conferência simples do barco (se quiser travar por barco)
      if (barco) {
        const reqBarco = (data.transportador || "").trim();
        if (
          reqBarco &&
          normText(reqBarco) !== normText(barco)
        ) {
          setErro(
            `Esta requisição está vinculada ao barco "${reqBarco}", e não ao seu ("${barco}").`
          );
          setReq(null);
          return;
        }
      }

      setReq(data);
      setCodigoUsado(entrada);
      setModalOpen(true);
    } catch (err) {
      console.error(err);
      setErro(err.message || "Erro ao buscar requisição.");
      setReq(null);
    } finally {
      setLoading(false);
    }
  }

  // ---------- CONFIRMAR VIAGEM ----------
  async function confirmarViagem() {
    if (!req || !user?.id) return;

    if (req.status !== "AUTORIZADA") {
      alert("Só é possível confirmar viagens AUTORIZADAS.");
      return;
    }

    const ok = window.confirm(
      `Confirmar embarque da requisição Nº ${req.numero_formatado || req.id} para ${
        req.passageiro_nome || "passageiro"
      }?`
    );
    if (!ok) return;

    try {
      setConfirmaLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes/${req.id}/validar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transportador_id: user.id,
            tipo_validacao: "EMBARQUE",
            codigo_lido: codigoUsado || String(req.id),
            local_validacao: barco || null,
            observacao: null,
          }),
        }
      );

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erro ao confirmar viagem.");
      }

      // depois de validar, recarrega dados da requisição
      const atualizado = await fetchPorId(req.id);
      setReq(atualizado);
      alert("Viagem confirmada com sucesso! Requisição marcada como utilizada.");
    } catch (err) {
      console.error(err);
      alert(err.message || "Erro ao confirmar viagem.");
    } finally {
      setConfirmaLoading(false);
    }
  }

  // ---------- BLOQUEIO PARA NÃO-TRANSPORTADOR ----------
  if (!isTransportador) {
    return (
      <>
        <Header />
        <main className="container-page py-8">
          <div className="max-w-md p-4 border rounded-xl bg-amber-50 text-amber-800">
            Este painel é exclusivo para usuários do tipo{" "}
            <strong>Transportador</strong>.
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="container-page py-4 pb-24 sm:pb-6">
        {/* topo */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold leading-tight">
              Painel do Transportador
            </h2>
            <div className="text-xs text-gray-600 mt-1">
              Usuário: <b>{user?.nome || user?.login}</b>
              {barco && (
                <>
                  {" "}
                  • Barco: <b>{barco}</b>
                </>
              )}
            </div>
          </div>
        </div>

        {/* bloco central */}
        <section className="bg-white border rounded-xl p-4 max-w-xl mx-auto">
          <p className="text-sm text-gray-700 mb-3 text-center">
            Leia o QR do canhoto ou digite o{" "}
            <strong>código público</strong> impresso abaixo do QR.
          </p>

          <div className="grid gap-3">
            {/* botão scanner */}
            <button
              className="w-full px-4 py-3 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => {
                setQrOpen(true);
                setTimeout(() => startScanner(), 80);
              }}
            >
              📷 Escanear QR
            </button>

            {/* input código */}
            <div className="flex gap-2">
              <input
                className="border rounded-md px-3 py-3 w-full text-sm"
                placeholder="Ou digite o código (ID ou código público)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <button
                className="px-4 py-3 rounded border text-sm"
                onClick={() => buscarRequisicao()}
                disabled={loading}
              >
                {loading ? "..." : "Buscar"}
              </button>
            </div>
          </div>

          {erro && (
            <p className="mt-3 text-sm text-red-600 text-center break-words">
              {erro}
            </p>
          )}
        </section>
      </main>

      {/* ===== Modal QR ===== */}
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
              <h3 className="font-semibold text-sm">
                Escanear QR da requisição
              </h3>
              <button
                className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                onClick={async () => {
                  await stopScanner();
                  setQrOpen(false);
                }}
              >
                Fechar
              </button>
            </div>
            <div className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <div id={qrDivId} className="w-full h-[360px]" />
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-6 border-2 border-white/70 rounded-lg" />
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Posicione o QR dentro da moldura. Funciona em iPhone (Safari) e
                Android (Chrome).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Detalhes da Requisição ===== */}
      {req && modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                Detalhes da requisição
              </h3>
              <button
                className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                onClick={() => setModalOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="p-4 text-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">
                    Nº {req.numero_formatado || req.id}
                  </div>
                  <div className="text-xs text-gray-500">
                    {req.origem || "-"} → {req.destino || "-"} • Saída:{" "}
                    {formatarDataBr(req.data_ida)}
                  </div>
                  {codigoUsado && (
                    <div className="text-[11px] text-gray-500 mt-1">
                      Código lido: {codigoUsado}
                    </div>
                  )}
                </div>
                <span
                  className={`inline-block px-2 py-1 text-xs border rounded ${
                    statusClasses[req.status] || "border-gray-200"
                  }`}
                >
                  {req.status}
                </span>
              </div>

              <div className="mb-2">
                <span className="text-gray-500">Nome: </span>
                <span className="font-medium">
                  {req.passageiro_nome || "-"}
                </span>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                CPF {req.passageiro_cpf || "—"}{" "}
                {req.emissor_nome && (
                  <>
                    • Emissor: {req.emissor_nome}
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Barco: {req.transportador || barco || "—"}
              </div>

              {/* mensagens de situação */}
              {req.status === "PENDENTE" && (
                <div className="mt-2 text-xs text-amber-700">
                  ⚠ Esta requisição ainda está{" "}
                  <strong>aguardando autorização</strong> da Prefeitura.
                  <br />
                  Não libere o embarque.
                </div>
              )}
              {req.status === "CANCELADA" && (
                <div className="mt-2 text-xs text-red-700">
                  ❌ Requisição <strong>cancelada</strong>. Não libere o
                  embarque.
                </div>
              )}
              {req.status === "UTILIZADA" && (
                <div className="mt-2 text-xs text-gray-700">
                  ✔ Esta requisição <strong>já foi utilizada</strong> em outra
                  viagem e não pode ser usada novamente.
                </div>
              )}
              {req.status === "AUTORIZADA" && (
                <div className="mt-2 text-xs text-emerald-700">
                  ✅ Requisição <strong>AUTORIZADA</strong> pela Prefeitura.
                  Confirme abaixo apenas se o passageiro estiver embarcando
                  agora.
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  className="px-3 py-2 rounded border text-xs sm:text-sm hover:bg-gray-50"
                  onClick={() => setModalOpen(false)}
                >
                  Fechar
                </button>
                <button
                  className={
                    "px-3 py-2 rounded text-xs sm:text-sm " +
                    (req.status === "AUTORIZADA"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed")
                  }
                  onClick={confirmarViagem}
                  disabled={
                    req.status !== "AUTORIZADA" || confirmaLoading
                  }
                >
                  {confirmaLoading ? "Confirmando..." : "Confirmar viagem"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

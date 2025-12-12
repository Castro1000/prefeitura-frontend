// src/pages/TransportadorValidar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";

const API_BASE_URL = "https://backend-prefeitura-production.up.railway.app";

const statusClasses = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AUTORIZADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REPROVADA: "bg-red-100 text-red-800 border-red-200",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
  UTILIZADA: "bg-gray-100 text-gray-700 border-gray-200",
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
      .replace(/^b\s*\/?\s*m\s*/i, "") // B/M, BM...
      .replace(/^barco\s*/i, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export default function TransportadorValidar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isTransportador = (user?.tipo || "").toLowerCase() === "transportador";

  const meuBarcoOriginal = user?.barco || "";
  const meuBarcoKey = normalizarBarco(meuBarcoOriginal);

  // ===== SCANNER com @zxing/browser =====
  const [qrOpen, setQrOpen] = useState(false);
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const controlsRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);
  const hasScannedRef = useRef(false);

  async function stopScanner() {
    try {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    } catch (e) {
      console.warn("Erro ao parar controles do scanner:", e);
    }
    try {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset?.();
        codeReaderRef.current = null;
      }
    } catch (e) {
      console.warn("Erro ao resetar leitor:", e);
    }
    try {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;

      const video = videoRef.current;
      if (video) {
        video.pause?.();
        video.srcObject = null;
      }
    } catch (e) {
      console.warn("Erro ao parar stream de vídeo:", e);
    }
    scanningRef.current = false;
  }

  async function applyHuaweiFixes(track) {
    if (!track?.applyConstraints) return;

    const caps = track.getCapabilities ? track.getCapabilities() : null;

    // 1) reforça 1280x720 + aspect ratio depois que a câmera abriu
    try {
      await track.applyConstraints({
        width: { ideal: 1280 },
        height: { ideal: 720 },
        aspectRatio: 16 / 9,
      });
    } catch (e) {
      // ok
    }

    // 2) tenta advanced (nem todo device suporta)
    const adv = [];

    // Huawei/Chrome às vezes inicia com zoom/crop; forçar zoom=1 costuma ajudar mais que "min"
    if (caps?.zoom) adv.push({ zoom: 1 });

    // foco contínuo (se suportar)
    if (
      caps?.focusMode &&
      Array.isArray(caps.focusMode) &&
      caps.focusMode.includes("continuous")
    ) {
      adv.push({ focusMode: "continuous" });
    }

    // resizeMode pode influenciar crop/zoom
    if (caps?.resizeMode) adv.push({ resizeMode: "none" });

    if (adv.length) {
      try {
        await track.applyConstraints({ advanced: adv });
      } catch (e) {
        // fallback pro resizeMode
        try {
          const adv2 = adv.map((o) =>
            o.resizeMode ? { resizeMode: "crop-and-scale" } : o
          );
          await track.applyConstraints({ advanced: adv2 });
        } catch (_) {
          // ignora
        }
      }
    }
  }

  async function startScanner() {
    if (scanningRef.current) return;
    scanningRef.current = true;
    hasScannedRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      alert(
        "Seu navegador não permite acesso à câmera. Atualize o aplicativo/navegador ou use outro navegador."
      );
      scanningRef.current = false;
      return;
    }

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      codeReaderRef.current = reader;

      // Descobre a câmera traseira, se existir
      const devices = (await BrowserQRCodeReader.listVideoInputDevices()) || [];
      let deviceId = null;
      if (devices.length > 0) {
        const back = devices.find((d) =>
          /back|rear|traseira|environment/i.test(
            `${d.label || ""} ${d.deviceId || ""}`
          )
        );
        deviceId = back ? back.deviceId : devices[0].deviceId;
      }

      const videoElement = videoRef.current;
      if (!videoElement) {
        throw new Error("Elemento de vídeo não encontrado.");
      }

      // Constraints focados em estabilidade no Android/Chrome
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          aspectRatio: { ideal: 16 / 9 },
        },
      };
      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];

      // Ajustes finos pro Huawei/Chrome (zoom/foco/resizeMode)
      try {
        await applyHuaweiFixes(track);
      } catch (e) {
        console.warn("Não foi possível aplicar ajustes Huawei:", e);
      }

      // liga o vídeo
      videoElement.srcObject = stream;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.autoplay = true;

      // espera metadata pra garantir dimensões
      await new Promise((resolve) => {
        const onLoaded = () => {
          videoElement.removeEventListener("loadedmetadata", onLoaded);
          resolve();
        };
        videoElement.addEventListener("loadedmetadata", onLoaded);
      });

      await videoElement.play();

      // ✅ mais estável que decodeFromVideoElement (principalmente em Android Chrome)
      controlsRef.current = await reader.decodeFromVideoElementContinuously(
        videoElement,
        (result, err, controls) => {
          if (!result) return;
          if (hasScannedRef.current) return; // garante que só lê uma vez
          hasScannedRef.current = true;

          const text = result.getText();
          try {
            controls?.stop?.();
          } catch (_) {}
          stopScanner();
          setQrOpen(false);
          handleScan(text);
        }
      );
    } catch (err) {
      console.error("Erro ao iniciar scanner:", err);
      alert(
        "Não foi possível iniciar a câmera.\n" +
          "Verifique se o navegador tem permissão para usar a câmera.\n" +
          "Se persistir, use o código manualmente."
      );
      await stopScanner();
      setQrOpen(false);
    }
  }

  // Inicia / para o scanner quando abre/fecha o modal
  useEffect(() => {
    if (qrOpen) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrOpen]);

  // ===== BUSCA / CONFIRMAÇÃO =====
  const [codigo, setCodigo] = useState("");
  const [req, setReq] = useState(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [erro, setErro] = useState("");
  const [loadingReq, setLoadingReq] = useState(false);

  function validarPertenceAoMeuBarco(registro) {
    if (!meuBarcoKey) return true; // sem barco cadastrado, não bloqueia
    let extras = {};
    try {
      if (registro.observacoes) {
        extras = JSON.parse(registro.observacoes);
      }
    } catch (_) {
      extras = {};
    }
    const nomeBarcoReq =
      extras.transportador_nome_barco || registro.transportador || "";
    const barcoReqKey = normalizarBarco(nomeBarcoReq);

    if (barcoReqKey && barcoReqKey !== meuBarcoKey) {
      alert("Esta requisição não pertence ao seu barco.");
      return false;
    }
    return true;
  }

  async function buscarPorId(id) {
    setErro("");
    setReq(null);
    setReqOpen(false);
    setLoadingReq(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/requisicoes/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setErro("Requisição não encontrada.");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!validarPertenceAoMeuBarco(data)) return;
      setReq(data);
      setReqOpen(true);
    } catch (err) {
      console.error("Erro ao buscar por ID:", err);
      setErro("Erro ao buscar requisição.");
    } finally {
      setLoadingReq(false);
    }
  }

  async function buscarPorCodigoPublico(codeArg) {
    const code = (codeArg ?? codigo).trim();
    if (!code) {
      setErro("Digite o código público do canhoto.");
      return;
    }
    setErro("");
    setReq(null);
    setReqOpen(false);
    setLoadingReq(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes?codigo_publico=${encodeURIComponent(
          code.toUpperCase()
        )}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setErro("Requisição não encontrada.");
        return;
      }
      const registro = data[0];
      if (!validarPertenceAoMeuBarco(registro)) return;
      setReq(registro);
      setReqOpen(true);
    } catch (err) {
      console.error("Erro ao buscar por código:", err);
      setErro("Erro ao buscar requisição.");
    } finally {
      setLoadingReq(false);
    }
  }

  function handleScan(value) {
    if (!value) return;
    const raw = String(value).trim();
    // Se for URL do canhoto -> extrai ID
    if (raw.includes("/canhoto/")) {
      const id = raw.split("/canhoto/").pop().split(/[?#]/)[0];
      setCodigo(""); // limpa input, pois veio do QR
      buscarPorId(id);
    } else {
      // Se vier só o código público
      setCodigo(raw);
      buscarPorCodigoPublico(raw);
    }
  }

  async function confirmarViagem() {
    if (!req) return;

    if (req.status !== "APROVADA" && req.status !== "AUTORIZADA") {
      alert("Só é possível confirmar viagens APROVADAS/AUTORIZADAS.");
      return;
    }

    const ok = window.confirm("Confirmar embarque desta requisição?");
    if (!ok) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/requisicoes/${req.id}/validar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transportador_id: user?.id,
            tipo_validacao: "EMBARQUE",
            codigo_lido: codigo || req.codigo_publico || "",
            local_validacao: null,
            observacao: null,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setReq((old) => (old ? { ...old, status: data.status || "UTILIZADA" } : old));
      alert("Embarque confirmado!");
    } catch (err) {
      console.error("Erro ao confirmar viagem:", err);
      alert("Não foi possível confirmar a viagem. Tente novamente.");
    }
  }

  // ===== Contador simples de viagens em aberto (só status APROVADA/AUTORIZADA) =====
  const [abertas, setAbertas] = useState(0);

  useEffect(() => {
    async function carregarAbertas() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/requisicoes?status=APROVADA`);
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const total = data
          .filter((r) => {
            if (!meuBarcoKey) return true;
            let extras = {};
            try {
              if (r.observacoes) extras = JSON.parse(r.observacoes);
            } catch (_) {
              extras = {};
            }
            const nomeBarcoReq = extras.transportador_nome_barco || r.transportador || "";
            const barcoReqKey = normalizarBarco(nomeBarcoReq);
            return !barcoReqKey || barcoReqKey === meuBarcoKey;
          })
          .length;

        setAbertas(total);
      } catch (err) {
        console.warn("Erro ao carregar viagens em aberto:", err);
      }
    }

    if (isTransportador) {
      carregarAbertas();
    }
  }, [isTransportador, meuBarcoKey]);

  // ===== Relatório simples =====
  const [reportOpen, setReportOpen] = useState(false);
  const [lista, setLista] = useState([]);
  const [loadingLista, setLoadingLista] = useState(false);

  useEffect(() => {
    async function carregarLista() {
      if (!reportOpen) return;
      setLoadingLista(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/requisicoes`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        let filtradas = Array.isArray(data) ? data : [];
        if (meuBarcoKey) {
          filtradas = filtradas.filter((r) => {
            let extras = {};
            try {
              if (r.observacoes) extras = JSON.parse(r.observacoes);
            } catch (_) {
              extras = {};
            }
            const nomeBarcoReq = extras.transportador_nome_barco || r.transportador || "";
            return normalizarBarco(nomeBarcoReq) === meuBarcoKey;
          });
        }
        setLista(filtradas);
      } catch (err) {
        console.error("Erro ao carregar lista:", err);
      } finally {
        setLoadingLista(false);
      }
    }
    carregarLista();
  }, [reportOpen, meuBarcoKey]);

  const resumo = useMemo(() => {
    const base = {
      APROVADA: 0,
      AUTORIZADA: 0,
      UTILIZADA: 0,
      CANCELADA: 0,
      REPROVADA: 0,
    };
    for (const r of lista) {
      if (r.status in base) base[r.status]++;
    }
    return base;
  }, [lista]);

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

  return (
    <>
      <style>{`
        @media print {
          .no-print { display:none !important; }
        }
        #video-transportador {
          width: 100%;
          height: 100%;
          object-fit: cover; /* 🔥 Huawei/Chrome: melhora crop/zoom e nitidez percebida */
          background: #000;
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
              Barco: <b>{meuBarcoOriginal || "—"}</b>
            </div>
          </div>

          <div className="no-print flex items-center gap-2">
            <button
              onClick={() => setReportOpen(true)}
              className="p-2 rounded border hover:bg-gray-50"
              title="Relatório / Consulta"
            >
              <span style={{ fontSize: 18 }}>📊</span>
            </button>
          </div>
        </div>

        {/* bloco central */}
        <section className="bg-white border rounded-xl p-4 max-w-xl mx-auto">
          <div className="mb-3 text-sm text-gray-700 text-center">
            Viagens em aberto para este barco:{" "}
            <span className="font-semibold">{abertas}</span>
          </div>

          <div className="grid gap-3">
            <button
              className="w-full px-4 py-3 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => {
                if (!meuBarcoOriginal) {
                  alert("Cadastre o barco deste usuário nas Configurações.");
                  return;
                }
                setQrOpen(true);
              }}
            >
              📷 Escanear QR
            </button>

            <div className="flex gap-2">
              <input
                className="border rounded-md px-3 py-3 w-full"
                placeholder="Ou digite o código (ex.: ABC1234XYZ)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <button
                className="px-4 py-3 rounded border"
                onClick={() => buscarPorCodigoPublico()}
                disabled={loadingReq}
              >
                Buscar
              </button>
            </div>
          </div>

          {erro && <p className="mt-3 text-sm text-red-600 text-center">{erro}</p>}
          {loadingReq && (
            <p className="mt-3 text-sm text-gray-500 text-center">
              Buscando requisição...
            </p>
          )}
        </section>
      </main>

      {/* ===== Modal do QR (scanner) ===== */}
      {qrOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setQrOpen(false)} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">Escanear QR do Canhoto</h3>
            </div>
            <div className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video id="video-transportador" ref={videoRef} playsInline muted />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="border-2 border-white/80 rounded-lg w-[80%] h-[80%]" />
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Posicione o QR do canhoto dentro da moldura. Se estiver embaçado,
                afaste um pouco o papel (uns 15–20 cm) até a câmera focar.
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  className="px-3 py-2 rounded border text-xs sm:text-sm hover:bg-gray-50"
                  onClick={() => setQrOpen(false)}
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
          <div className="absolute inset-0 bg-black/60" onClick={() => setReqOpen(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Detalhes da requisição</h3>
            </div>

            <div className="p-4 text-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold">Nº {req.numero_formatado || req.id}</div>
                  <div className="text-gray-500 text-xs">
                    {req.origem} → {req.destino} • Saída: {req.data_ida?.slice(0, 10)}
                  </div>
                </div>
                <span
                  className={`inline-block px-2 py-1 text-xs border rounded ${
                    statusClasses[req.status] || "border-gray-200"
                  }`}
                >
                  {req.status === "PENDENTE" ? "AGUARDANDO AUTORIZAÇÃO" : req.status}
                </span>
              </div>

              <div className="mb-2">
                <span className="text-gray-500">Nome: </span>
                <span className="font-medium">{req.passageiro_nome}</span>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                CPF {req.passageiro_cpf || "—"}
              </div>

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
                    (req.status === "APROVADA" || req.status === "AUTORIZADA"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed")
                  }
                  onClick={confirmarViagem}
                  disabled={req.status !== "APROVADA" && req.status !== "AUTORIZADA"}
                >
                  Confirmar viagem
                </button>
              </div>

              {req.status !== "APROVADA" && req.status !== "AUTORIZADA" && (
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

      {/* ===== Modal Relatório simples ===== */}
      {reportOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setReportOpen(false)} />
          <div className="relative z-10 w-full max-w-4xl mx-2 sm:mx-4 bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm sm:text-base">
                Relatório — {meuBarcoOriginal || "—"}
              </h3>
              <button
                onClick={() => setReportOpen(false)}
                className="px-2 py-1 rounded hover:bg-gray-100 text-xs sm:text-sm"
              >
                Fechar
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6">
              {loadingLista ? (
                <p className="text-sm text-gray-500">Carregando requisições...</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                    <div className="border rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">Aprovadas/Autorizadas</div>
                      <div className="text-lg font-semibold">
                        {resumo.APROVADA + resumo.AUTORIZADA}
                      </div>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">Utilizadas</div>
                      <div className="text-lg font-semibold">{resumo.UTILIZADA}</div>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">Canceladas / Reprovadas</div>
                      <div className="text-lg font-semibold">
                        {resumo.CANCELADA + resumo.REPROVADA}
                      </div>
                    </div>
                  </div>

                  <ul className="divide-y">
                    {lista.map((r) => (
                      <li key={r.id} className="px-2 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-xs sm:text-sm">
                              {r.numero_formatado || r.id} —{" "}
                              <span className="truncate inline-block max-w-[220px] align-bottom">
                                {r.passageiro_nome}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {r.origem} → {r.destino} • Saída: {r.data_ida?.slice(0, 10)}
                            </div>
                          </div>
                          <span
                            className={`inline-block px-2 py-1 text-[11px] border rounded ${
                              statusClasses[r.status] || "border-gray-200"
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                      </li>
                    ))}
                    {lista.length === 0 && (
                      <li className="px-2 py-4 text-sm text-gray-500">
                        Nenhuma requisição encontrada para este barco.
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

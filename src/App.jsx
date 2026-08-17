import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { 
  Copy, Monitor, Play, CheckCircle2, Wifi, 
  Laptop2, Maximize, Minimize, Settings, Mic, MicOff, X, Tv, AlertTriangle
} from 'lucide-react';

function App() {
  // --- ESTADOS ---
  const [myPeerId, setMyPeerId] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('');
  const [status, setStatus] = useState('Iniciando...');
  const [isSharing, setIsSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [showControls, setShowControls] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [config, setConfig] = useState({ audio: true, quality: '1080' });

  // --- REFS ---
  const videoRef = useRef(null);
  const peerInstance = useRef(null);
  const videoContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // --- PEERJS SETUP ---
  useEffect(() => {
    if (peerInstance.current) return;

    const newId = uuidv4().substring(0, 5);
    const peer = new Peer(newId, { debug: 1 });

    peer.on('open', (id) => {
      setMyPeerId(id);
      setStatus('Pronto para conectar');
    });

    peer.on('error', (err) => {
      setStatus('Erro: ' + (err.type === 'peer-unavailable' ? 'ID não encontrado' : err.type));
    });

    // Evento disparado quando alguém liga para você (receber stream)
    peer.on('call', (call) => {
      call.answer();
      call.on('stream', (remoteStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          // CORREÇÃO CRÍTICA: Quem recebe NÃO pode estar mutado
          videoRef.current.muted = false; 
          videoRef.current.play().catch(e => console.error("Erro autoplay:", e));
          setStatus('Assistindo');
          setIsConnected(true);
        }
      });
    });

    peerInstance.current = peer;

    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      peer.destroy();
      peerInstance.current = null;
    };
  }, []);

  // --- CONTROLES AUTO-HIDE ---
  const resetControlsTimeout = useCallback(() => {
    if (!isConnected) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) resetControlsTimeout();
    else setShowControls(true);
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [isConnected, resetControlsTimeout]);

  // --- AÇÕES ---
  const copyToClipboard = () => {
    navigator.clipboard.writeText(myPeerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = async (e) => {
    e.stopPropagation();
    if (!videoContainerRef.current) return;
    try {
      if (!document.fullscreenElement) await videoContainerRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) { console.error(err); }
  };

  const confirmShare = async () => {
    setShowSetupModal(false);
    try {
      const width = config.quality === '1080' ? 1920 : 1280;
      const height = config.quality === '1080' ? 1080 : 720;

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          cursor: "always",
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { max: 30 }
        },
        // Configuração de áudio aprimorada
        audio: config.audio ? {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
        } : false
      });

      // Validar se o áudio foi realmente capturado
      if (config.audio && stream.getAudioTracks().length === 0) {
        alert("Atenção: O áudio do sistema não foi capturado. Lembre-se de marcar a caixa 'Compartilhar áudio' na janela do navegador.");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Host sempre mutado para evitar eco
        videoRef.current.play();
      }

      setIsSharing(true);
      setIsConnected(true);
      setStatus('Transmitindo');

      stream.getVideoTracks()[0].onended = () => {
        setIsSharing(false);
        setIsConnected(false);
        setStatus('Encerrado');
        if (videoRef.current) videoRef.current.srcObject = null;
      };
      
    } catch (err) {
      console.error("Erro share:", err);
      setStatus('Cancelado');
    }
  };

  const connectToHost = () => {
    if (!targetPeerId) return;
    setStatus('Conectando...');
    const conn = peerInstance.current.connect(targetPeerId);
    conn.on('open', () => {
        setStatus('Pedindo vídeo...');
        conn.send({ type: 'request-stream', peerId: myPeerId });
    });
  };
  
  // Responder a pedidos de stream
  useEffect(() => {
     if(!peerInstance.current) return;
     peerInstance.current.on('connection', (conn) => {
        conn.on('data', (data) => {
            if(data.type === 'request-stream' && videoRef.current?.srcObject) {
                // Envia o stream completo (Vídeo + Áudio)
                peerInstance.current.call(data.peerId, videoRef.current.srcObject);
            }
        });
     });
  }, [isSharing]);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0f172a] text-white font-sans">
      
      {/* HEADER */}
      <header className="p-4 flex justify-center shrink-0 z-10">
        <div className="w-full max-w-7xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
                <Monitor className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Share<span className="text-blue-400">Cast</span></h1>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`}></div>
                <span className="text-xs font-medium text-slate-300">{status}</span>
            </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">
            
            {/* LADO ESQUERDO: CONTROLES */}
            <div className="lg:col-span-4 flex flex-col gap-5 justify-center order-2 lg:order-1">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-3 text-slate-400">
                    <Wifi className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase">Seu ID</span>
                </div>
                <div className="flex gap-2">
                  <input readOnly value={myPeerId} className="w-full h-12 bg-black/40 border border-white/5 rounded-xl text-center font-mono text-xl text-white outline-none" />
                  <button onClick={copyToClipboard} className="h-12 w-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10">
                    {copied ? <CheckCircle2 size={20} className="text-green-400"/> : <Copy size={20} />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
                {!isSharing && !isConnected && (
                    <button 
                        onClick={() => setShowSetupModal(true)}
                        className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        <Laptop2 size={18} />
                        <span>Compartilhar Tela</span>
                    </button>
                )}

                <div className="flex gap-2">
                    <input 
                        value={targetPeerId}
                        onChange={(e) => setTargetPeerId(e.target.value)}
                        placeholder="ID do Amigo..."
                        className="flex-1 h-14 bg-black/40 border border-white/5 rounded-xl px-4 text-white focus:border-blue-500 outline-none"
                    />
                    <button onClick={connectToHost} className="h-14 w-16 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-lg flex items-center justify-center">
                        <Play size={24} fill="currentColor" />
                    </button>
                </div>
              </div>
            </div>

            {/* LADO DIREITO: VÍDEO */}
            <div className="lg:col-span-8 h-full min-h-[400px] order-1 lg:order-2">
              <div 
                ref={videoContainerRef}
                onMouseMove={resetControlsTimeout}
                className="relative w-full h-full bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center group"
              >
                {/* CORREÇÃO AQUI: muted={isSharing} */}
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-contain" 
                  autoPlay 
                  playsInline 
                  muted={isSharing} 
                />

                {!isConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center animate-pulse pointer-events-none">
                    <Monitor className="w-12 h-12 text-slate-700 mb-4" />
                    <h3 className="text-lg font-medium text-slate-500">Aguardando Transmissão</h3>
                  </div>
                )}

                {/* CONTROLES FLUTUANTES */}
                {isConnected && (
                  <div className={`absolute inset-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none"></div>
                    <div className="absolute top-6 left-6 flex items-center gap-3">
                         <div className="bg-red-600 px-3 py-1 rounded-lg flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                             <span className="text-xs font-bold text-white">AO VIVO</span>
                         </div>
                    </div>
                    <button 
                      onClick={toggleFullscreen}
                      className="absolute bottom-6 right-6 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10"
                    >
                      {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
        </div>
      </main>
      
      {/* MODAL ESTILO DISCORD */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#36393f] w-full max-w-md rounded-lg shadow-2xl border border-[#202225]">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-bold text-white">Configurar Transmissão</h2>
                        <button onClick={() => setShowSetupModal(false)} className="text-gray-400 hover:text-white"><X size={24}/></button>
                    </div>
                    
                    <div className="space-y-6">
                        {/* Qualidade */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Qualidade</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setConfig({...config, quality: '720'})}
                                    className={`p-3 rounded border text-sm font-medium transition-all ${config.quality === '720' ? 'bg-[#5865f2] border-[#5865f2]' : 'bg-[#2f3136] border-[#202225] text-gray-300'}`}
                                >720p</button>
                                <button 
                                    onClick={() => setConfig({...config, quality: '1080'})}
                                    className={`p-3 rounded border text-sm font-medium transition-all ${config.quality === '1080' ? 'bg-[#5865f2] border-[#5865f2]' : 'bg-[#2f3136] border-[#202225] text-gray-300'}`}
                                >1080p</button>
                            </div>
                        </div>

                        {/* Áudio */}
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase">Áudio do Sistema</label>
                             <div 
                                onClick={() => setConfig({...config, audio: !config.audio})}
                                className="flex items-center justify-between p-3 bg-[#2f3136] rounded border border-[#202225] cursor-pointer"
                             >
                                <div className="flex items-center gap-3">
                                    {config.audio ? <Mic className="text-green-400" /> : <MicOff className="text-red-400" />}
                                    <span className="text-sm">Transmitir áudio</span>
                                </div>
                                <div className={`w-10 h-6 rounded-full relative transition-colors ${config.audio ? 'bg-green-500' : 'bg-gray-500'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.audio ? 'left-5' : 'left-1'}`}></div>
                                </div>
                             </div>
                             {config.audio && (
                                <div className="bg-blue-500/10 border border-blue-500/50 p-3 rounded-lg flex gap-3">
                                    <AlertTriangle className="text-blue-400 shrink-0" size={18} />
                                    <p className="text-[10px] text-blue-200">
                                        Importante: No seletor do navegador, você DEVE marcar a caixa <b>"Compartilhar áudio do sistema"</b>.
                                    </p>
                                </div>
                             )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-[#2f3136] flex justify-end gap-3 rounded-b-lg">
                    <button onClick={() => setShowSetupModal(false)} className="px-4 py-2 text-sm hover:underline">Cancelar</button>
                    <button onClick={confirmShare} className="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-bold rounded shadow-lg">Entrar ao Vivo</button>
                </div>
            </div>
        </div>
      )}

      <footer className="p-4 text-center text-slate-600 text-xs shrink-0">ShareCast P2P &copy; 2024</footer>
    </div>
  );
}

export default App;
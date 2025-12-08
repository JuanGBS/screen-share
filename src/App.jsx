import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { 
  Copy, Monitor, Play, CheckCircle2, Wifi, 
  Laptop2, Maximize, Minimize, Settings, Mic, MicOff, X, Tv
} from 'lucide-react';

function App() {
  // --- ESTADOS ---
  const [myPeerId, setMyPeerId] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('');
  const [status, setStatus] = useState('Iniciando sistema...');
  const [isSharing, setIsSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Estados para UX (Controles e Modal)
  const [showControls, setShowControls] = useState(true); // Controla visibilidade dos botões
  const [showSetupModal, setShowSetupModal] = useState(false); // Modal estilo Discord
  const [config, setConfig] = useState({ audio: true, quality: '1080' }); // Config do Modal

  // --- REFS ---
  const videoRef = useRef(null);
  const peerInstance = useRef(null);
  const videoContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null); // Timer para esconder controles

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

    peer.on('call', (call) => {
      call.answer();
      call.on('stream', (remoteStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play().catch(e => console.error("Erro autoplay:", e));
          setStatus('Recebendo transmissão');
          setIsConnected(true);
        }
      });
      call.on('close', () => {
        setIsConnected(false);
        setStatus('Transmissão encerrada');
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

  // --- LÓGICA DE CONTROLES (Auto-Hide) ---
  const resetControlsTimeout = useCallback(() => {
    if (!isConnected) return;
    
    setShowControls(true);
    
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    // Esconde depois de 3 segundos de inatividade
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, [isConnected]);

  // Monitora movimento do mouse no vídeo
  useEffect(() => {
    if (isConnected) {
      resetControlsTimeout();
    } else {
      setShowControls(true); // Sempre mostra se não tiver vídeo
    }
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [isConnected, resetControlsTimeout]);


  // --- AÇÕES ---
  const copyToClipboard = () => {
    navigator.clipboard.writeText(myPeerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = async (e) => {
    e.stopPropagation(); // Evita conflito com o clique do container
    if (!videoContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await videoContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Erro fullscreen:", err);
    }
  };

  // 1. Abre o Modal
  const openSetupModal = () => {
    setShowSetupModal(true);
  };

  // 2. Inicia o compartilhamento com as configs do Modal
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
        audio: config.audio // Liga/Desliga audio baseado no modal
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsSharing(true);
      setIsConnected(true);
      setStatus('Transmitindo');

      stream.getVideoTracks()[0].onended = () => {
        setIsSharing(false);
        setIsConnected(false);
        setStatus('Transmissão encerrada');
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
  
  useEffect(() => {
     if(!peerInstance.current) return;
     peerInstance.current.on('connection', (conn) => {
        conn.on('data', (data) => {
            if(data.type === 'request-stream' && videoRef.current && videoRef.current.srcObject) {
                peerInstance.current.call(data.peerId, videoRef.current.srcObject);
            }
        });
     });
  }, [isSharing]);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0f172a] text-white font-sans selection:bg-blue-500/30">
      
      {/* HEADER */}
      <header className="p-4 flex justify-center shrink-0 z-10">
        <div className="w-full max-w-7xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-lg">
                <Monitor className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Share<span className="text-blue-400">Cast</span></h1>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 backdrop-blur-md">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`}></div>
                <span className="text-xs font-medium text-slate-300 hidden sm:block">{status}</span>
            </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in pb-10">
            
            {/* CONTROLES (Esquerda) */}
            <div className="lg:col-span-4 flex flex-col gap-5 justify-center order-2 lg:order-1">
              {/* Card ID */}
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-3 text-slate-400">
                    <Wifi className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-widest">Seu ID</span>
                </div>
                <div className="flex gap-2">
                  <input readOnly value={myPeerId} className="w-full h-12 bg-black/40 border border-white/5 rounded-xl text-center font-mono text-xl text-white tracking-widest focus:outline-none" />
                  <button onClick={copyToClipboard} className="h-12 w-12 flex items-center justify-center rounded-xl border border-white/10 bg-slate-800 hover:bg-slate-700">
                    {copied ? <CheckCircle2 size={20} className="text-green-400"/> : <Copy size={20} />}
                  </button>
                </div>
              </div>

              {/* Card Ações */}
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
                {!isConnected && (
                    <button 
                        onClick={openSetupModal} // Abre o modal em vez de ir direto
                        className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        <Laptop2 size={18} />
                        <span>Compartilhar Tela</span>
                    </button>
                )}

                {!isConnected && (
                     <div className="flex items-center gap-3 py-1"><div className="h-px flex-1 bg-white/10"></div><span className="text-xs text-slate-500 font-medium">OU ASSISTIR</span><div className="h-px flex-1 bg-white/10"></div></div>
                )}

                <div className="flex gap-2">
                    <input 
                        value={targetPeerId}
                        onChange={(e) => setTargetPeerId(e.target.value)}
                        placeholder="ID do Host..."
                        className="flex-1 h-14 bg-black/40 border border-white/5 rounded-xl px-4 text-white focus:border-green-500/50 focus:outline-none"
                    />
                    <button onClick={connectToHost} className="h-14 w-16 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-lg flex items-center justify-center">
                        <Play size={24} fill="currentColor" className="ml-1" />
                    </button>
                </div>
              </div>
            </div>

            {/* VÍDEO (Direita) */}
            <div className="lg:col-span-8 h-full min-h-[400px] order-1 lg:order-2">
              <div 
                ref={videoContainerRef}
                onClick={resetControlsTimeout} // Clicar na tela mostra os controles
                onMouseMove={resetControlsTimeout} // Mover o mouse mostra os controles
                className="relative w-full h-full bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center group cursor-pointer"
              >
                <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline muted />

                {!isConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-pulse pointer-events-none">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 ring-1 ring-white/10"><Monitor className="w-8 h-8 text-slate-500" /></div>
                    <h3 className="text-lg font-medium text-slate-300">Aguardando Vídeo</h3>
                  </div>
                )}

                {/* CONTROLES FLUTUANTES (Com Fade-in/out) */}
                {isConnected && (
                  <div className={`absolute inset-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                    
                    {/* Gradiente para facilitar leitura */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none"></div>

                    {/* Topo */}
                    <div className="absolute top-6 left-6 flex items-center gap-3">
                         <div className="bg-red-600 px-3 py-1 rounded-lg flex items-center gap-2 shadow-lg">
                             <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                             <span className="text-xs font-bold text-white tracking-wider">AO VIVO</span>
                         </div>
                         <div className="bg-black/50 backdrop-blur px-3 py-1 rounded-lg border border-white/10 text-xs font-mono text-slate-300">
                            {config.quality === '1080' ? 'HD 1080p' : 'HD 720p'}
                         </div>
                    </div>

                    {/* Botões Centrais (Play/Pause fake se quisesse) ou apenas feedback */}

                    {/* Rodapé - Fullscreen */}
                    <button 
                      onClick={toggleFullscreen}
                      className="absolute bottom-6 right-6 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 transition-transform active:scale-95 z-50"
                    >
                      {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
        </div>
      </main>
      
      {/* --- MODAL ESTILO DISCORD --- */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#36393f] w-full max-w-md rounded-lg shadow-2xl overflow-hidden border border-[#202225]">
                {/* Modal Header */}
                <div className="p-6 pb-2">
                    <div className="flex justify-between items-start">
                        <h2 className="text-xl font-bold text-white mb-2">Compartilhar Tela</h2>
                        <button onClick={() => setShowSetupModal(false)} className="text-gray-400 hover:text-white"><X size={24}/></button>
                    </div>
                    <p className="text-gray-400 text-sm">Selecione a qualidade da transmissão e as configurações de áudio.</p>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6">
                    
                    {/* Qualidade */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Qualidade do Vídeo</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setConfig({...config, quality: '720'})}
                                className={`p-3 rounded border text-sm font-medium transition-all ${config.quality === '720' ? 'bg-[#5865f2] border-[#5865f2] text-white' : 'bg-[#2f3136] border-[#202225] text-gray-300 hover:bg-[#40444b]'}`}
                            >
                                720p <span className="text-[10px] opacity-70 block">Fluidez</span>
                            </button>
                            <button 
                                onClick={() => setConfig({...config, quality: '1080'})}
                                className={`p-3 rounded border text-sm font-medium transition-all ${config.quality === '1080' ? 'bg-[#5865f2] border-[#5865f2] text-white' : 'bg-[#2f3136] border-[#202225] text-gray-300 hover:bg-[#40444b]'}`}
                            >
                                1080p <span className="text-[10px] opacity-70 block">Nitidez</span>
                            </button>
                        </div>
                    </div>

                    {/* Áudio */}
                    <div className="space-y-2">
                         <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Áudio do Sistema</label>
                         <div 
                            onClick={() => setConfig({...config, audio: !config.audio})}
                            className="flex items-center justify-between p-3 bg-[#2f3136] rounded border border-[#202225] cursor-pointer hover:bg-[#40444b] transition-colors"
                         >
                            <div className="flex items-center gap-3">
                                {config.audio ? <Mic className="text-green-400" size={20} /> : <MicOff className="text-red-400" size={20} />}
                                <span className="text-sm text-gray-200">Transmitir som</span>
                            </div>
                            <div className={`w-10 h-6 rounded-full relative transition-colors ${config.audio ? 'bg-green-500' : 'bg-gray-500'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.audio ? 'left-5' : 'left-1'}`}></div>
                            </div>
                         </div>
                         <p className="text-[10px] text-gray-500">*Você precisará marcar a caixa "Compartilhar áudio" na janela do navegador também.</p>
                    </div>

                    {/* Preview (Fake) */}
                    <div className="bg-black/50 h-32 rounded flex items-center justify-center border border-[#202225] relative overflow-hidden">
                        <Tv className="text-gray-600 mb-2" size={32} />
                        <div className="absolute bottom-2 right-2 text-[10px] text-gray-500 font-mono">PREVIEW</div>
                    </div>

                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-[#2f3136] flex justify-end gap-3">
                    <button onClick={() => setShowSetupModal(false)} className="px-4 py-2 text-sm text-white hover:underline">Cancelar</button>
                    <button 
                        onClick={confirmShare}
                        className="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-medium rounded transition-colors shadow-lg"
                    >
                        Entrar ao Vivo
                    </button>
                </div>
            </div>
        </div>
      )}

      <footer className="p-4 text-center text-slate-600 text-xs shrink-0 z-10">ShareCast P2P &copy; 2025</footer>
    </div>
  );
}

export default App;
import { useEffect, useRef, useState, useCallback } from 'react';
import { streamService } from './services/streamService';
import { 
  Copy, Monitor, Play, CheckCircle2, Wifi, 
  Laptop2, Maximize, Minimize, Mic, MicOff, X, AlertTriangle, Volume2
} from 'lucide-react';

function App() {
  // --- ESTADOS ---
  const [myPeerId, setMyPeerId] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('');
  const [status, setStatus] = useState('Pronto');
  const [isSharing, setIsSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Estados de Interface e Áudio
  const [showControls, setShowControls] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false); // NOVO: Detecta bloqueio de som
  const [config, setConfig] = useState({ audio: true, quality: '1080' });

  // --- REFS ---
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // --- INICIALIZAÇÃO ---
  useEffect(() => {
    streamService.init(
      (id) => setMyPeerId(id), 
      (remoteStream) => {      
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.muted = false; // Garante que não está mutado para o ouvinte
          
          // Tenta dar play com áudio
          videoRef.current.play().catch(err => {
            console.warn("Autoplay bloqueado pelo navegador:", err);
            setAudioBlocked(true); // Ativa o botão de "Ativar Som"
          });

          setIsConnected(true);
          setStatus('Assistindo');
        }
      },
      (err) => setStatus('Erro: ' + err.type)
    );

    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      streamService.destroy();
    };
  }, []);

  // --- LÓGICA DE CONTROLES (AUTO-HIDE) ---
  const resetControlsTimeout = useCallback(() => {
    if (!isConnected) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, [isConnected]);

  // --- AÇÕES ---
  const confirmShare = async () => {
    setShowSetupModal(false);
    setStatus('Iniciando captura...');
    try {
      const stream = await streamService.startCapture(config);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Host mudo para evitar eco
        videoRef.current.play();
      }

      streamService.listenForRequests();
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
      setStatus('Falha na captura');
    }
  };

  const unmuteManual = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play();
      setAudioBlocked(false);
    }
  };

  const handleConnect = () => {
    if (!targetPeerId) return;
    setStatus('Conectando...');
    streamService.connectToHost(targetPeerId, myPeerId);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(myPeerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#0f172a] text-white overflow-hidden font-sans">
      
      {/* HEADER */}
      <header className="p-4 flex justify-center shrink-0 z-10">
        <div className="w-full max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-lg">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Share<span className="text-blue-400">Cast</span></h1>
          </div>
          <div className="bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 text-xs font-medium text-slate-300">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
              {status}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-center">
          
          {/* LADO ESQUERDO: PAINEL DE CONTROLE */}
          <div className="lg:col-span-4 order-2 lg:order-1 flex flex-col gap-6">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl">
              <div className="flex items-center gap-2 mb-3 text-slate-400">
                <Wifi className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] uppercase font-bold tracking-widest">Seu ID P2P</span>
              </div>
              <div className="flex gap-2">
                <input readOnly value={myPeerId} className="flex-1 bg-black/40 border border-white/5 p-3 rounded-xl font-mono text-center outline-none text-blue-400 text-xl" />
                <button onClick={copyToClipboard} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 border border-white/10 transition-colors">
                  {copied ? <CheckCircle2 className="text-green-400" size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col gap-4">
              {!isSharing && !isConnected && (
                <button 
                  onClick={() => setShowSetupModal(true)} 
                  className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
                >
                  <Laptop2 size={20} /> Compartilhar Tela
                </button>
              )}

              <div className="flex gap-2">
                <input 
                  placeholder="ID do Amigo..." 
                  value={targetPeerId}
                  onChange={e => setTargetPeerId(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/5 p-4 rounded-xl outline-none focus:border-blue-500 transition-colors"
                />
                <button onClick={handleConnect} className="p-4 bg-green-600 hover:bg-green-500 rounded-xl shadow-lg flex items-center justify-center min-w-[64px] transition-colors">
                  <Play fill="currentColor" size={24} />
                </button>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: PLAYER DE VÍDEO */}
          <div 
            ref={videoContainerRef}
            onMouseMove={resetControlsTimeout}
            className="lg:col-span-8 order-1 lg:order-2 aspect-video bg-black rounded-2xl border border-white/10 relative overflow-hidden group shadow-2xl"
          >
            <video 
              ref={videoRef} 
              className="w-full h-full object-contain" 
              autoPlay 
              playsInline 
              muted={isSharing} // Host mudo, Amigo ouvindo
            />
            
            {/* BOTÃO PARA DESBLOQUEAR ÁUDIO (Aparece se o navegador bloquear autoplay) */}
            {audioBlocked && isConnected && !isSharing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30">
                <button 
                  onClick={unmuteManual}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold flex items-center gap-3 shadow-2xl animate-bounce"
                >
                  <Volume2 size={24} />
                  Ativar Áudio da Transmissão
                </button>
              </div>
            )}

            {!isConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 pointer-events-none">
                <Monitor size={48} className="mb-4 opacity-20 text-blue-400" />
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30">Aguardando Conexão</p>
              </div>
            )}

            {/* OVERLAY DE CONTROLES */}
            {isConnected && showControls && (
               <div className="absolute inset-0 flex items-end justify-between p-6 pointer-events-none">
                  <div className="bg-red-600 px-3 py-1 rounded flex items-center gap-2 shadow-lg">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Ao Vivo</span>
                  </div>
                  <button 
                    onClick={toggleFullscreen}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 transition-all pointer-events-auto active:scale-90"
                  >
                    {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                  </button>
               </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL DE CONFIGURAÇÃO */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#2f3136] w-full max-w-md rounded-xl border border-white/5 shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Transmitir Tela</h2>
                <button onClick={() => setShowSetupModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
              </div>

              <div className="space-y-6">
                <div 
                  onClick={() => setConfig({...config, audio: !config.audio})} 
                  className="p-4 bg-black/20 rounded-xl border border-white/5 flex justify-between items-center cursor-pointer hover:bg-black/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {config.audio ? <Volume2 className="text-green-400" size={20} /> : <MicOff className="text-red-400" size={20} />}
                    <span className="font-medium text-slate-200">Áudio do Sistema</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${config.audio ? 'bg-green-500' : 'bg-slate-600'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.audio ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                {config.audio && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex gap-3">
                    <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                    <div className="text-[11px] text-amber-200 leading-relaxed">
                      <p className="font-bold uppercase mb-1">Aviso Crítico:</p>
                      <p>Para o áudio funcionar, selecione uma <b className="text-white">Aba</b> ou <b className="text-white">Tela Inteira</b> e marque o checkbox <b className="text-white">"Compartilhar áudio"</b> no seletor do navegador.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button onClick={() => setShowSetupModal(false)} className="text-slate-400 hover:underline text-sm font-medium">Cancelar</button>
                <button onClick={confirmShare} className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-lg font-bold shadow-lg transition-all">Entrar ao Vivo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="p-4 text-center text-slate-600 text-[10px] uppercase tracking-[0.2em] shrink-0">
        ShareCast P2P &copy; 2024
      </footer>
    </div>
  );
}

export default App;
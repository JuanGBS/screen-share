import { useEffect, useRef, useState, useCallback } from 'react';
import { streamService } from './services/streamService';
import { 
  Copy, Monitor, Play, CheckCircle2, Wifi, 
  Laptop2, Maximize, Minimize, Mic, MicOff, X, AlertTriangle 
} from 'lucide-react';

function App() {
  const [myPeerId, setMyPeerId] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('');
  const [status, setStatus] = useState('Pronto');
  const [isSharing, setIsSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [config, setConfig] = useState({ audio: true, quality: '1080' });

  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Inicialização
  useEffect(() => {
    const id = streamService.init(
      (id) => setMyPeerId(id),
      (remoteStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.muted = false; // Importante para quem assiste
          videoRef.current.play();
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

  // Lógica de esconder controles
  const resetControlsTimeout = useCallback(() => {
    if (!isConnected) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, [isConnected]);

  // Ações
  const confirmShare = async () => {
    setShowSetupModal(false);
    setStatus('Iniciando captura...');
    try {
      const stream = await streamService.startCapture(config);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Host mudo para não dar eco
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
      };
    } catch (err) {
      setStatus('Falha na captura');
    }
  };

  const handleConnect = () => {
    if (!targetPeerId) return;
    setStatus('Conectando ao host...');
    streamService.connectToHost(targetPeerId, myPeerId);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(myPeerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#0f172a] text-white overflow-hidden font-sans">
      {/* HEADER */}
      <header className="p-4 flex justify-center shrink-0 z-10">
        <div className="w-full max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold">Share<span className="text-blue-400">Cast</span></h1>
          </div>
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 text-xs text-slate-300">
            {status}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-center">
          
          {/* PAINEL DE CONTROLE */}
          <div className="lg:col-span-4 flex flex-col gap-6 order-2 lg:order-1">
            <div className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Seu ID P2P</label>
              <div className="flex gap-2">
                <input readOnly value={myPeerId} className="flex-1 bg-black/40 border border-white/5 p-3 rounded-xl font-mono text-center outline-none" />
                <button onClick={copyToClipboard} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700">
                  {copied ? <CheckCircle2 className="text-green-400" /> : <Copy />}
                </button>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl flex flex-col gap-4">
              {!isSharing && !isConnected && (
                <button onClick={() => setShowSetupModal(true)} className="w-full h-14 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center justify-center gap-2">
                  <Laptop2 size={20} /> Compartilhar Tela
                </button>
              )}
              <div className="flex gap-2">
                <input 
                  placeholder="ID do Amigo..." 
                  value={targetPeerId}
                  onChange={e => setTargetPeerId(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/5 p-3 rounded-xl outline-none focus:border-blue-500"
                />
                <button onClick={handleConnect} className="p-3 bg-green-600 rounded-xl hover:bg-green-500">
                  <Play fill="currentColor" />
                </button>
              </div>
            </div>
          </div>

          {/* PLAYER DE VÍDEO */}
          <div className="lg:col-span-8 aspect-video bg-black rounded-2xl border border-white/10 relative overflow-hidden group">
            <video 
              ref={videoRef} 
              className="w-full h-full object-contain" 
              autoPlay 
              playsInline 
              muted={isSharing} // Correção: Host mutado, Client não.
              onMouseMove={resetControlsTimeout}
            />
            
            {!isConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 pointer-events-none">
                <Monitor size={64} className="mb-4 opacity-20" />
                <p className="text-sm uppercase tracking-widest font-bold opacity-40">Aguardando Conexão</p>
              </div>
            )}

            {/* BOTÃO FULLSCREEN */}
            {isConnected && showControls && (
               <button 
                onClick={() => videoContainerRef.current?.requestFullscreen()}
                className="absolute bottom-4 right-4 p-3 bg-black/50 hover:bg-black/80 rounded-full border border-white/10 transition-opacity"
               >
                <Maximize size={20} />
               </button>
            )}
          </div>
        </div>
      </main>

      {/* MODAL DE CONFIGURAÇÃO (O SEU MODAL DE 2 ETAPAS) */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#2f3136] w-full max-w-md rounded-xl border border-white/5 shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Configurar Transmissão</h2>
                <button onClick={() => setShowSetupModal(false)}><X /></button>
              </div>

              <div className="space-y-6">
                {/* Áudio */}
                <div onClick={() => setConfig({...config, audio: !config.audio})} className="p-4 bg-black/20 rounded-xl border border-white/5 flex justify-between items-center cursor-pointer">
                  <div className="flex items-center gap-3">
                    {config.audio ? <Mic className="text-green-400" /> : <MicOff className="text-red-400" />}
                    <span className="font-medium">Áudio (Mic + Sistema)</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${config.audio ? 'bg-blue-600' : 'bg-slate-600'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.audio ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                {/* Aviso de Etapas */}
                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl flex gap-3">
                  <AlertTriangle className="text-blue-400 shrink-0" size={20} />
                  <div className="text-[11px] text-blue-200 leading-relaxed">
                    <p className="font-bold uppercase mb-1">Processo em 2 Etapas:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Primeiro, permitiremos o uso do <b>Microfone</b>.</li>
                      <li>Depois, você escolherá a <b>Tela</b>. Lembre-se de marcar a caixa <b>"Compartilhar áudio do sistema"</b>.</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button onClick={() => setShowSetupModal(false)} className="text-slate-400 hover:underline text-sm">Cancelar</button>
                <button onClick={confirmShare} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold transition-colors">Começar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
import { useEffect, useRef, useState, useCallback } from 'react';
import { streamService } from './services/streamService';
import {
  Copy, Monitor, Play, CheckCircle2, Wifi,
  Laptop2, Maximize, Minimize, Mic, MicOff, X, AlertTriangle, Volume2, VolumeX
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
  const [viewers, setViewers] = useState([]); // <--- Adicionando estado dos viewers
  const [isMuted, setIsMuted] = useState(false); // <--- Adicionando estados faltantes
  const [volume, setVolume] = useState(1);       // <--- Adicionando estados faltantes
  
  // Estados de Interface e Áudio
  const [showControls, setShowControls] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false); // NOVO: Detecta bloqueio de som
  const [config, setConfig] = useState({ audio: true, quality: '1080' });

  // --- REFS ---
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const audioContextRef = useRef(null); // Ref para o contexto de áudio
  const analyserRef = useRef(null);     // Ref para o analisador de áudio
  const animationFrameRef = useRef(null); // Ref para o loop de animação
  const [audioLevel, setAudioLevel] = useState(0);
  const [user, setUser] = useState(null);

  // --- CARREGAR USUÁRIO PERSISTENTE ---
  useEffect(() => {
    const savedUser = localStorage.getItem('discord_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // --- LÓGICA PARA PROCESSAR CALLBACK E SALVAR ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      fetch('http://localhost:3001/api/auth/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      .then(res => res.json())
      .then(data => {
        setUser(data);
        localStorage.setItem('discord_user', JSON.stringify(data)); // Salva
        window.history.replaceState({}, document.title, "/");
      });
    }
  }, []);

  // --- LOGOUT ---
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('discord_user'); // Remove
  };

  const loginDiscord = () => {
    const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
    const REDIRECT_URI = encodeURIComponent(import.meta.env.VITE_DISCORD_REDIRECT_URI || 'http://localhost:5173/callback');
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=identify`;
  };

  // Lógica de áudio no useEffect
  useEffect(() => {
    streamService.init(
      (id) => setMyPeerId(id),
      (remoteStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.muted = true; // Força mudo inicialmente para evitar bloqueio do Firefox

          // Setup Analyser
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(remoteStream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            setAudioLevel(sum / dataArray.length);
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();

          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(err => {
              console.warn("Autoplay bloqueado:", err);
              setAudioBlocked(true);
            });
          };

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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
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

      // Agora passando o callback de novo espectador e o usuário host
      streamService.listenForRequests((viewer) => {
        setViewers(prev => {
          // Garante que criamos um novo array
          const next = [...prev, viewer];
          console.log("Novo estado de viewers:", next);
          return next;
        });
      }, user);
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

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
      videoRef.current.muted = newVolume === 0;
    }
  };

  const handleConnect = () => {
    if (!targetPeerId) return;
    setStatus('Conectando...');
    streamService.connectToHost(targetPeerId, myPeerId, user);
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

          <div className="flex items-center gap-4">
            {user ? (
              <div
                onClick={handleLogout}
                className="flex items-center gap-3 bg-slate-800 p-1.5 pr-4 rounded-full border border-slate-700 cursor-pointer hover:bg-slate-700 transition-all"
                title="Clique para sair"
              >
                <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} className="w-8 h-8 rounded-full" alt="Avatar" />
                <span className="text-sm font-medium">{user.username}</span>
              </div>
            ) : (
              <button onClick={loginDiscord} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-full text-sm font-bold transition-all">
                Entrar com Discord
              </button>
            )}

            <div className="bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 text-xs font-medium text-slate-300">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
                {status}
              </div>
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

            {/* LISTA DE VIEWERS */}
            {isSharing && (
              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl">
                <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Espectadores ({viewers.length})</h3>
                <div className="space-y-2">
                  {viewers.map((viewer, i) => (
                    <div key={i} className="flex items-center gap-3 bg-black/20 p-2 rounded-lg">
                      {viewer.avatar ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${viewer.userId}/${viewer.avatar}.png`}
                          className="w-6 h-6 rounded-full"
                          alt="Avatar"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {viewer.username ? viewer.username[0].toUpperCase() : '?'}
                        </div>
                      )}
                      <span className="text-sm text-slate-300">{viewer.username || 'Anônimo'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    <div className={`w-2 h-2 rounded-full bg-white ${audioLevel > 10 ? 'animate-ping' : ''}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Ao Vivo</span>
                  </div>

            {/* CONTROLE DE VOLUME - DISPONÍVEL APENAS PARA O ESPECTADOR */}
                  {!isSharing && (
                  <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/10 pointer-events-auto">
                    <button onClick={toggleMute} className="text-white hover:text-blue-400 transition-colors">
                      {isMuted || volume === 0 ? <VolumeX className="text-red-400" size={20} /> : <Volume2 size={20} />}
                    </button>
                    <input
                      type="range"
                      min="0" max="1" step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20 accent-blue-500 cursor-pointer"
                    />
                  </div>
                  )}

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

              <div className="space-y-4">
                <div
                  onClick={() => setConfig({...config, audio: !config.audio})}
                  className="p-4 bg-black/20 rounded-xl border border-white/5 flex justify-between items-center cursor-pointer hover:bg-black/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {config.audio ? <Volume2 className="text-green-400" size={20} /> : <MicOff className="text-red-400" size={20} />}
                    <div>
                      <div className="font-medium text-slate-200">Áudio do Sistema</div>
                      <div className="text-[10px] text-slate-400">Captura o som de janelas ou abas</div>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${config.audio ? 'bg-green-500' : 'bg-slate-600'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.audio ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 text-[11px] text-slate-300 space-y-2">
                  <p className="font-bold text-blue-400 uppercase">Dicas para melhor áudio:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Selecione <b>"Janela"</b> ou <b>"Aba"</b>, não "Tela Inteira".</li>
                    <li>No seletor do navegador, marque <b>"Compartilhar áudio"</b>.</li>
                    <li>Feche aplicativos desnecessários que emitem som.</li>
                  </ul>
                </div>
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
        ShareCast P2P &copy; 2026
      </footer>
    </div>
  );
}

export default App;
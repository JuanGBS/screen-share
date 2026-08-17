import Peer from 'peerjs';
import { v4 as uuidv4 } from 'uuid';

class StreamService {
  constructor() {
    this.peer = null;
    this.myStream = null;
  }

  // Inicializa o PeerJS
  init(onOpen, onStream, onError) {
    const id = uuidv4().substring(0, 5);
    this.peer = new Peer(id, { debug: 1 });

    this.peer.on('open', onOpen);
    this.peer.on('error', onError);

    // Quando recebe uma chamada (alguém querendo assistir)
    this.peer.on('call', (call) => {
      call.answer();
      call.on('stream', (remoteStream) => {
        onStream(remoteStream);
      });
    });

    return id;
  }

  // Lógica de captura em duas etapas: 1. Mic -> 2. Tela + Áudio do Sistema
  async startCapture(config) {
    try {
      // ETAPA 1: Microfone
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: config.audio ? { echoCancellation: true, noiseSuppression: true } : false
      });

      // ETAPA 2: Tela + Áudio do Sistema
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: config.quality === '1080' ? 1920 : 1280 },
          height: { ideal: config.quality === '1080' ? 1080 : 720 },
          frameRate: { max: 30 }
        },
        audio: config.audio // O navegador pedirá permissão para o som do sistema aqui
      });

      // Mesclando as faixas (Tracks)
      const videoTrack = screenStream.getVideoTracks()[0];
      const audioTracks = [
        ...micStream.getAudioTracks(),
        ...screenStream.getAudioTracks()
      ];

      this.myStream = new MediaStream([videoTrack, ...audioTracks]);
      return this.myStream;
    } catch (err) {
      console.error("Erro na captura:", err);
      throw err;
    }
  }

  // Conectar a um Host
  connectToHost(targetId, myId) {
    const conn = this.peer.connect(targetId);
    conn.on('open', () => {
      conn.send({ type: 'request-stream', peerId: myId });
    });
  }

  // Responder a pedidos de stream
  listenForRequests() {
    this.peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        if (data.type === 'request-stream' && this.myStream) {
          this.peer.call(data.peerId, this.myStream);
        }
      });
    });
  }

  destroy() {
    if (this.myStream) {
      this.myStream.getTracks().forEach(t => t.stop());
    }
    if (this.peer) {
      this.peer.destroy();
    }
  }
}

export const streamService = new StreamService();
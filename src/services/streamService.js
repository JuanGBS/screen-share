import Peer from 'peerjs';
import { v4 as uuidv4 } from 'uuid';

class StreamService {
  constructor() {
    this.peer = null;
    this.myStream = null;
  }

  /**
   * Inicializa o PeerJS com configurações de estabilidade e servidores STUN.
   */
  init(onOpen, onStream, onError) {
    const id = uuidv4().substring(0, 5);

    this.peer = new Peer(id, {
      host: '0.peerjs.com',
      port: 443,
      secure: true, // Necessário para evitar erros de segurança no Firefox/Chrome
      debug: 1,
      config: {
        
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
        sdpSemantics: 'unified-plan'
      }
    });

    this.peer.on('open', onOpen);
    
    this.peer.on('error', (err) => {
      console.error("PeerJS Error:", err.type);
      onError(err);
    });

    // Evento quando recebemos uma chamada (Alguém quer assistir)
    this.peer.on('call', (call) => {
      // Respondemos com o stream do host e o hack de SDP
      call.answer(this.myStream, {
        sdpTransform: this._forceStereoAudio
      });

      // Se o chamador enviar metadados (como o usuário do Discord), podemos capturá-los aqui
      call.on('open', () => {
        console.log("Chamada aberta. Metadados do espectador:", call.metadata);
      });

      call.on('stream', (remoteStream) => {
        console.log("Stream recebido. Tracks:", remoteStream.getTracks());
        onStream(remoteStream);
      });
    });

    return id;
  }

  /**
   * Atualiza o stream de vídeo nas chamadas ativas.
   */
  updateStream(newStream) {
    this.myStream = newStream;
    // Itera sobre todas as conexões de chamada ativas e substitui as trilhas
    Object.values(this.peer.connections).forEach(conns => {
      conns.forEach(conn => {
        if (conn.peerConnection) {
          const videoTrack = newStream.getVideoTracks()[0];
          const sender = conn.peerConnection.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        }
      });
    });
  }

  /**
   * Captura Tela + Áudio do Sistema.
   * Importante: No seletor do navegador, o usuário DEVE marcar "Compartilhar Áudio".
   */
  async startCapture(config) {
    try {
      const constraints = {
        video: {
          width: { ideal: config.quality === '1080' ? 1920 : 1280 },
          height: { ideal: config.quality === '1080' ? 1080 : 720 },
          frameRate: { max: 30 }
        },
        audio: config.audio ? {
          autoGainControl: false, // Desativa ajuste automático de volume
          echoCancellation: false, // Desativa cancelamento de eco (estraga som de sistema)
          noiseSuppression: false, // Desativa supressão de ruído
          channelCount: 2          // Tenta capturar em Stereo
        } : false
      };

      const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);

      // Validação de áudio
      if (config.audio && screenStream.getAudioTracks().length === 0) {
        console.warn("Usuário não marcou o checkbox de áudio no navegador.");
      }

      this.myStream = screenStream;
      return this.myStream;
    } catch (err) {
      console.error("Erro ao capturar tela/áudio:", err);
      throw err;
    }
  }

  /**
   * Solicita a transmissão de um Host.
   */
  connectToHost(targetId, myId, user) {
    if (!this.peer) return;

    const conn = this.peer.connect(targetId);
    conn.on('open', () => {
      conn.send({
        type: 'request-stream',
        peerId: myId,
        username: user?.username || 'Anônimo',
        userId: user?.id,
        avatar: user?.avatar
      });
    });
  }

  /**
   * Escuta pedidos de conexão e liga de volta enviando o vídeo.
   * Agora aceita o usuário do host para passar metadados.
   */
  listenForRequests(onNewViewer, hostUser) {
    if (!this.peer) return;

    this.peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        if (data.type === 'request-stream' && this.myStream) {
          console.log("Enviando stream para:", data.peerId);
          console.log("Dados do espectador recebidos:", data); // DEBUG

          // Chamamos o callback informando o espectador
          if (onNewViewer) {
             onNewViewer({
                peerId: data.peerId,
                username: data.username || 'Anônimo',
                userId: data.userId, // Certifique-se que estes campos estão vindo
                avatar: data.avatar
             });
          }

          // Enviamos os dados do host como metadados na chamada
          this.peer.call(data.peerId, this.myStream, {
            sdpTransform: this._forceStereoAudio,
            metadata: { host: hostUser }
          });
        }
      });
    });
  }

  /**
   * Hack de SDP: Força o WebRTC a usar Stereo e bitrate de 128kbps.
   * Sem isso, o som do sistema soa abafado ou "mudo" (como se fosse voz).
   */
  _forceStereoAudio(sdp) {
    return sdp.replace(
      'useinbandfec=1',
      'useinbandfec=1; stereo=1; maxaveragebitrate=128000'
    );
  }

  /**
   * Limpa recursos ao fechar.
   */
  destroy() {
    if (this.myStream) {
      this.myStream.getTracks().forEach(track => track.stop());
    }
    if (this.peer) {
      this.peer.destroy();
    }
  }
}

export const streamService = new StreamService();
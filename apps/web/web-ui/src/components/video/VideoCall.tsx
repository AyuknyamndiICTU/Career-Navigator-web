'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionQuality,
  ConnectionState,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type Participant,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
} from 'livekit-client';
import { joinVideoCall } from '@/lib/api/video';

type Devices = { videoinput: MediaDeviceInfo[]; audioinput: MediaDeviceInfo[] };
type Phase = 'prejoin' | 'connecting' | 'connected' | 'left';

const CAPTURE = VideoPresets.h720.resolution;
const DEVICE_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for the device')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

const QUALITY: Record<ConnectionQuality, { label: string; bars: number; cls: string }> = {
  [ConnectionQuality.Excellent]: { label: 'Excellent connection', bars: 3, cls: 'bg-emerald-400' },
  [ConnectionQuality.Good]: { label: 'Good connection', bars: 2, cls: 'bg-emerald-400' },
  [ConnectionQuality.Poor]: { label: 'Poor connection', bars: 1, cls: 'bg-amber-400' },
  [ConnectionQuality.Lost]: { label: 'Connection lost', bars: 0, cls: 'bg-red-500' },
  [ConnectionQuality.Unknown]: { label: 'Measuring connection', bars: 0, cls: 'bg-slate-400' },
};

function QualityBars({ quality }: { quality: ConnectionQuality }) {
  const q = QUALITY[quality] ?? QUALITY[ConnectionQuality.Unknown];
  return (
    <span className="inline-flex items-end gap-0.5" title={q.label} aria-label={q.label} role="img">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`w-1 rounded-sm ${n <= q.bars ? q.cls : 'bg-white/30'}`} style={{ height: 4 + n * 3 }} />
      ))}
    </span>
  );
}

/** Attaches one participant's camera (or screen share), plus remote audio, to media elements. */
function ParticipantTile({ participant, isLocal, version }: { participant: Participant; isLocal: boolean; version: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const screen = participant.getTrackPublication(Track.Source.ScreenShare);
  const camera = participant.getTrackPublication(Track.Source.Camera);
  const shown = screen?.track && !screen.isMuted ? screen : camera;
  const videoTrack = shown?.track && !shown.isMuted ? shown.track : undefined;
  const audioTrack = isLocal ? undefined : participant.getTrackPublication(Track.Source.Microphone)?.track;

  useEffect(() => {
    const el = videoRef.current;
    if (!videoTrack || !el) return;
    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack, version]);

  useEffect(() => {
    const el = audioRef.current;
    if (!audioTrack || !el) return;
    audioTrack.attach(el);
    return () => {
      audioTrack.detach(el);
    };
  }, [audioTrack, version]);

  const micMuted = !participant.isMicrophoneEnabled;
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-900 aspect-video ${participant.isSpeaking ? 'ring-2 ring-emerald-400' : ''}`}>
      {videoTrack ? (
        <video ref={videoRef} className={`w-full h-full ${shown === screen ? 'object-contain' : 'object-cover'} ${isLocal && shown !== screen ? '-scale-x-100' : ''}`} autoPlay playsInline muted={isLocal} />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-700 text-white text-xl font-bold flex items-center justify-center">
            {(participant.name || participant.identity).slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      {!isLocal && <audio ref={audioRef} autoPlay />}
      <div className="absolute bottom-0 inset-x-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between gap-2 text-xs text-white">
        <span className="truncate font-medium">
          {isLocal ? 'You' : participant.name || 'Participant'}
          {shown === screen && videoTrack ? ' · sharing screen' : ''}
          {micMuted ? ' · muted' : ''}
        </span>
        <QualityBars quality={participant.connectionQuality} />
      </div>
    </div>
  );
}

function ControlButton(props: { active: boolean; pressed?: boolean; onClick: () => void; label: string; danger?: boolean; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.pressed ?? props.active}
      aria-label={props.label}
      title={props.label}
      className={`p-3 rounded-xl transition-colors disabled:opacity-50 ${
        props.danger ? 'bg-red-50 text-red-600 hover:bg-red-100' : props.active ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-red-500 text-white hover:bg-red-600'
      }`}
    >
      {props.children}
    </button>
  );
}

const icon = {
  mic: 'M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z',
  cam: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  screen: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
};
const Svg = ({ d }: { d: string }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

/**
 * LiveKit call for one conversation: pre-join preview with device choice, then a room with
 * camera/mic/screen-share controls. LiveKit reconnects on its own; the UI reports it.
 */
export function VideoCall({ conversationId, onLeave }: { conversationId: string; onLeave?: () => void }) {
  const [phase, setPhase] = useState<Phase>('prejoin');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<Devices>({ videoinput: [], audioinput: [] });
  const [cameraId, setCameraId] = useState<string>('');
  const [micId, setMicId] = useState<string>('');
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [needsAudioClick, setNeedsAudioClick] = useState(false);
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState<LocalVideoTrack | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const tracksRef = useRef<{ video?: LocalVideoTrack; audio?: LocalAudioTrack }>({});
  // Set while joining: the preview camera track is published instead of being stopped.
  const handedOverRef = useRef(false);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const loadDevices = useCallback(async () => {
    try {
      const [videoinput, audioinput] = await Promise.all([
        Room.getLocalDevices('videoinput'),
        Room.getLocalDevices('audioinput'),
      ]);
      setDevices({ videoinput, audioinput });
    } catch (e) {
      console.warn('Could not list media devices:', e);
    }
  }, []);

  // Pre-join preview: (re)create the camera track when the camera choice or toggle changes.
  useEffect(() => {
    if (phase !== 'prejoin') return;
    let cancelled = false;
    let created: LocalVideoTrack | undefined;
    if (camOn) {
      createLocalVideoTrack({ resolution: CAPTURE, deviceId: cameraId || undefined })
        .then((track) => {
          if (cancelled) {
            track.stop();
            return;
          }
          created = track;
          tracksRef.current.video = track;
          setPreview(track);
          void loadDevices();
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          console.warn('Camera unavailable:', e);
          setCamOn(false);
          setError('Your camera is not available. You can join with audio only.');
        });
    }
    return () => {
      cancelled = true;
      if (created && !handedOverRef.current) {
        created.stop();
        if (tracksRef.current.video === created) tracksRef.current.video = undefined;
      }
      setPreview(null);
    };
  }, [phase, camOn, cameraId, loadDevices]);

  useEffect(() => {
    const el = previewRef.current;
    if (!preview || !el) return;
    preview.attach(el);
    return () => {
      preview.detach(el);
    };
  }, [preview]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const leave = useCallback(async () => {
    const current = roomRef.current;
    roomRef.current = null;
    setRoom(null);
    await current?.disconnect();
    tracksRef.current.video?.stop();
    tracksRef.current.audio?.stop();
    tracksRef.current = {};
    handedOverRef.current = false;
    setPhase('left');
    onLeave?.();
  }, [onLeave]);

  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
      tracksRef.current.video?.stop();
      tracksRef.current.audio?.stop();
    };
  }, []);

  async function join() {
    setError('');
    handedOverRef.current = Boolean(tracksRef.current.video);
    setPhase('connecting');
    try {
      const { url, token } = await joinVideoCall(conversationId);
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: CAPTURE },
        publishDefaults: { simulcast: true, videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] },
      });
      roomRef.current = room;
      room
        .on(RoomEvent.ParticipantConnected, bump)
        .on(RoomEvent.ParticipantDisconnected, bump)
        .on(RoomEvent.TrackSubscribed, bump)
        .on(RoomEvent.TrackUnsubscribed, bump)
        .on(RoomEvent.TrackMuted, bump)
        .on(RoomEvent.TrackUnmuted, bump)
        .on(RoomEvent.LocalTrackPublished, bump)
        .on(RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub.source === Track.Source.ScreenShare) setScreenOn(false);
          bump();
        })
        .on(RoomEvent.ActiveSpeakersChanged, bump)
        .on(RoomEvent.ConnectionQualityChanged, bump)
        .on(RoomEvent.Reconnecting, () => setReconnecting(true))
        .on(RoomEvent.Reconnected, () => setReconnecting(false))
        .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudioClick(!room.canPlaybackAudio))
        .on(RoomEvent.MediaDevicesChanged, () => void loadDevices())
        .on(RoomEvent.Disconnected, () => {
          if (roomRef.current === room) void leave();
        });

      await room.connect(url, token);
      setNeedsAudioClick(!room.canPlaybackAudio);
      setRoom(room);
      setPhase('connected');
      bump();
      void publishLocal(room);
    } catch (e) {
      roomRef.current?.disconnect().catch(() => undefined);
      roomRef.current = null;
      tracksRef.current.video?.stop();
      tracksRef.current.audio?.stop();
      tracksRef.current = {};
      handedOverRef.current = false;
      setPhase('prejoin');
      setError(e instanceof Error ? e.message : 'Could not join the call.');
    }
  }

  /** Publishes camera and microphone after joining, so a slow or ignored permission prompt never blocks the call. */
  async function publishLocal(room: Room) {
    try {
      if (tracksRef.current.video) {
        await room.localParticipant.publishTrack(tracksRef.current.video, { source: Track.Source.Camera, simulcast: true });
      }
    } catch (e) {
      console.warn('Could not publish the camera:', e);
      setCamOn(false);
    }
    if (!micOn) return;
    try {
      const audio = await withTimeout(
        createLocalAudioTrack({ deviceId: micId || undefined, echoCancellation: true, noiseSuppression: true }),
        DEVICE_TIMEOUT_MS,
      );
      if (roomRef.current !== room) {
        audio.stop();
        return;
      }
      tracksRef.current.audio = audio;
      await room.localParticipant.publishTrack(audio, { source: Track.Source.Microphone });
    } catch (e) {
      console.warn('Microphone unavailable:', e);
      setMicOn(false);
      setError('Your microphone is not available. Check the browser permission, then unmute.');
    }
    bump();
  }

  async function toggleMic() {
    const room = roomRef.current;
    const next = !micOn;
    setMicOn(next);
    try {
      await room?.localParticipant.setMicrophoneEnabled(next, micId ? { deviceId: micId } : undefined);
    } catch (e) {
      setMicOn(!next);
      setError(e instanceof Error ? e.message : 'Could not change the microphone.');
    }
    bump();
  }

  async function toggleCamera() {
    const room = roomRef.current;
    const next = !camOn;
    setCamOn(next);
    if (!room) return;
    try {
      await room.localParticipant.setCameraEnabled(next, { resolution: CAPTURE, deviceId: cameraId || undefined });
    } catch (e) {
      setCamOn(!next);
      setError(e instanceof Error ? e.message : 'Could not change the camera.');
    }
    bump();
  }

  async function toggleScreen() {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(!screenOn, { audio: false });
      setScreenOn(!screenOn);
    } catch (e) {
      // Cancelling the browser's share picker is not an error worth showing.
      if (!(e instanceof Error && e.name === 'NotAllowedError')) {
        setError(e instanceof Error ? e.message : 'Could not share the screen.');
      }
    }
    bump();
  }

  async function chooseDevice(kind: 'videoinput' | 'audioinput', deviceId: string) {
    if (kind === 'videoinput') setCameraId(deviceId);
    else setMicId(deviceId);
    const room = roomRef.current;
    if (room && room.state === ConnectionState.Connected) {
      try {
        await room.switchActiveDevice(kind, deviceId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not switch the device.');
      }
    }
  }

  const remotes = room ? [...room.remoteParticipants.values()] : [];

  const deviceSelects = (
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="block text-xs font-semibold text-slate-600">
        Camera
        <select
          className="mt-1 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
          value={cameraId}
          onChange={(e) => void chooseDevice('videoinput', e.target.value)}
        >
          <option value="">Default camera</option>
          {devices.videoinput.filter((d) => d.deviceId).map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Microphone
        <select
          className="mt-1 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
          value={micId}
          onChange={(e) => void chooseDevice('audioinput', e.target.value)}
        >
          <option value="">Default microphone</option>
          {devices.audioinput.filter((d) => d.deviceId).map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
          ))}
        </select>
      </label>
    </div>
  );

  if (phase === 'left') {
    return (
      <div className="bg-white rounded-2xl shadow-card p-8 text-center space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">You left the call</h2>
        <button type="button" onClick={() => setPhase('prejoin')} className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700">
          Rejoin
        </button>
      </div>
    );
  }

  if (phase !== 'connected') {
    return (
      <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Ready to join?</h2>
        {error && <p role="alert" className="text-sm text-amber-700">{error}</p>}
        <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video max-w-xl">
          {preview ? (
            <video ref={previewRef} className="w-full h-full object-cover -scale-x-100" autoPlay playsInline muted />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">Camera off</div>
          )}
        </div>
        {deviceSelects}
        <div className="flex flex-wrap items-center gap-3">
          <ControlButton active={micOn} onClick={() => setMicOn((v) => !v)} label="Microphone">
            <Svg d={icon.mic} />
          </ControlButton>
          <ControlButton active={camOn} onClick={() => setCamOn((v) => !v)} label="Camera">
            <Svg d={icon.cam} />
          </ControlButton>
          <button
            type="button"
            onClick={() => void join()}
            disabled={phase === 'connecting'}
            className="px-6 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            {phase === 'connecting' ? 'Joining…' : 'Join call'}
          </button>
        </div>
      </div>
    );
  }

  const grid = remotes.length === 0 ? 'grid-cols-1' : remotes.length === 1 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3';
  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      {reconnecting && (
        <div role="status" className="px-5 py-2 bg-amber-50 text-amber-800 text-sm border-b border-amber-200">
          Connection interrupted. Reconnecting…
        </div>
      )}
      {needsAudioClick && room && (
        <div className="px-5 py-2 bg-blue-50 text-blue-800 text-sm border-b border-blue-200 flex items-center justify-between gap-3">
          Your browser blocked call audio.
          <button type="button" onClick={() => void room.startAudio()} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold">
            Enable audio
          </button>
        </div>
      )}
      {error && <p role="alert" className="px-5 py-2 text-sm text-amber-700 border-b border-surface-border">{error}</p>}
      <div className="p-4">
        <div className={`grid gap-3 grid-cols-1 ${grid}`}>
          {room && <ParticipantTile participant={room.localParticipant} isLocal version={version} />}
          {remotes.map((p) => (
            <ParticipantTile key={p.identity} participant={p} isLocal={false} version={version} />
          ))}
        </div>
        {remotes.length === 0 && <p className="mt-3 text-sm text-slate-500">Waiting for the other person to join…</p>}
      </div>
      <div className="border-t border-surface-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ControlButton active={micOn} onClick={() => void toggleMic()} label="Microphone">
            <Svg d={icon.mic} />
          </ControlButton>
          <ControlButton active={camOn} onClick={() => void toggleCamera()} label="Camera">
            <Svg d={icon.cam} />
          </ControlButton>
          <ControlButton
            active={!screenOn}
            pressed={screenOn}
            onClick={() => void toggleScreen()}
            label="Share screen"
            disabled={typeof navigator !== 'undefined' && !navigator.mediaDevices?.getDisplayMedia}
          >
            <Svg d={icon.screen} />
          </ControlButton>
          <details className="relative">
            <summary className="list-none cursor-pointer p-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold">Devices</summary>
            <div className="absolute bottom-14 left-0 z-10 w-80 rounded-xl border border-surface-border bg-white p-4 shadow-card">{deviceSelects}</div>
          </details>
        </div>
        <div className="flex items-center gap-3">
          {room && (
            <span className="px-2 py-1.5 rounded-lg bg-slate-800">
              <QualityBars quality={room.localParticipant.connectionQuality} />
            </span>
          )}
          <button type="button" onClick={() => void leave()} className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

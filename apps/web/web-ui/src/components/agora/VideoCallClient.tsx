'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { endAgoraSession, startAgoraSession } from '@/lib/api/agora';

type AgoraRole = 'publisher' | 'subscriber';

type IAgoraRTCClient = any;
type IAgoraRTCRemoteUser = any;

type Props = {
  channelName: string;
  uid?: number;
  role: AgoraRole; // publisher/subscriber
};

function getAgoraAppId(): string {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  if (!appId) throw new Error('Missing NEXT_PUBLIC_AGORA_APP_ID');
  return appId;
}

export function VideoCallClient({ channelName, uid, role }: Props) {
  const appId = useMemo(() => getAgoraAppId(), []);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const agoraRef = useRef<typeof import('agora-rtc-sdk-ng').default | null>(null);

  const localVideoEl = useRef<HTMLVideoElement | null>(null);
  const remoteVideoEls = useRef<Record<number, HTMLVideoElement | null>>({});

  const localTrackStateRef = useRef<{
    audioTrack?: any;
    videoTrack?: any;
  }>({});

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [callState, setCallState] = useState<
    'idle' | 'joining' | 'connected' | 'error' | 'ended'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  async function getAgora() {
    if (!agoraRef.current) {
      const mod = await import('agora-rtc-sdk-ng');
      agoraRef.current = mod.default;
    }
    return agoraRef.current;
  }

  async function publishLocalTracks(
    client: IAgoraRTCClient,
  ): Promise<void> {
    const AgoraRTC = await getAgora();
    const { createCameraVideoTrack, createMicrophoneAudioTrack } = AgoraRTC;

    const [videoTrack, audioTrack] = await Promise.all([
      createCameraVideoTrack(),
      createMicrophoneAudioTrack(),
    ]);

    localTrackStateRef.current.videoTrack = videoTrack;
    localTrackStateRef.current.audioTrack = audioTrack;

    if (localVideoEl.current) {
      videoTrack.play(localVideoEl.current);
    }

    await client.publish([audioTrack, videoTrack]);
  }

  async function handleUserPublished(user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') {
    const client = clientRef.current;
    if (!client) return;

    if (mediaType === 'video') {
      const videoTrack = await client.subscribe(user, 'video');
      setRemoteUids((prev) => (prev.includes(Number(user.uid)) ? prev : [...prev, Number(user.uid)]));
      const el = remoteVideoEls.current[Number(user.uid)];
      if (el && typeof (videoTrack as any).play === 'function') {
        (videoTrack as any).play(el);
      }
    } else if (mediaType === 'audio') {
      const audioTrack = await client.subscribe(user, 'audio');
      audioTrack.play();
    }
  }

  async function stopAndCloseTracks() {
    const { audioTrack, videoTrack } = localTrackStateRef.current;

    if (audioTrack) {
      try {
        audioTrack.stop();
        audioTrack.close();
      } catch {
        // ignore
      }
    }

    if (videoTrack) {
      try {
        videoTrack.stop();
        videoTrack.close();
      } catch {
        // ignore
      }
    }

    localTrackStateRef.current = {};
  }

  async function hardLeave() {
    const client = clientRef.current;
    if (client) {
      try {
        await client.leave();
      } catch {
        // ignore
      }
    }
    clientRef.current = null;
    await stopAndCloseTracks();

    setCallState('ended');
    if (sessionId) {
      void endAgoraSession(sessionId).catch(() => {});
    }
  }

  async function join() {
    setError(null);
    setCallState('joining');

    try {
      const AgoraRTC = await getAgora();

      const start = await startAgoraSession({
        channelName,
        uid,
        role,
      });

      setSessionId(start.sessionId);
      setToken(start.token);

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', (user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
        void handleUserPublished(user, mediaType);
      });

      client.on('user-unpublished', (user: IAgoraRTCRemoteUser) => {
        const u = Number(user.uid);
        setRemoteUids((prev) => prev.filter((x) => x !== u));
      });

      client.on('user-left', (user: IAgoraRTCRemoteUser) => {
        const u = Number(user.uid);
        setRemoteUids((prev) => prev.filter((x) => x !== u));
      });

      await client.join(appId, start.channelName, start.token, start.uid);

      if (role === 'publisher') {
        await publishLocalTracks(client);
      }

      setCallState('connected');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join video call');
      setCallState('error');
    }
  }

  useEffect(() => {
    if (!channelName) return;
    void join();
    return () => {
      void hardLeave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, uid, role]);

  useEffect(() => {
    const audioTrack = localTrackStateRef.current.audioTrack;
    if (!audioTrack) return;

    void (async () => {
      try {
        await audioTrack.setMuted(isMuted);
      } catch {
        // ignore
      }
    })();
  }, [isMuted]);

  useEffect(() => {
    const videoTrack = localTrackStateRef.current.videoTrack;
    if (!videoTrack) return;

    void (async () => {
      try {
        await videoTrack.setEnabled(!isCameraOff);
      } catch {
        // ignore
      }
    })();
  }, [isCameraOff]);

  return (
    <div className="relative w-full">
      <AnimatePresence mode="wait">
        {callState === 'joining' && (
          <motion.div
            key="joining"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl shadow-card p-8 text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Joining Session…</h3>
            <p className="mt-1 text-sm text-slate-500">Connecting to the video channel</p>
          </motion.div>
        )}

        {(callState === 'connected' || callState === 'ended') && (
          <motion.div
            key="connected"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl shadow-card overflow-hidden"
          >
            {/* Controls bar */}
            <div className="border-b border-surface-border px-5 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-slate-800">Video Call</div>
                  <div className="text-xs text-slate-500">
                    Channel: <span className="font-mono text-primary-600">{channelName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {role === 'publisher' && (
                    <>
                      <button
                        onClick={() => setIsMuted((v) => !v)}
                        className={`p-2.5 rounded-xl text-sm font-medium transition-all ${
                          isMuted
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-surface text-slate-600 hover:bg-surface-hover'
                        }`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => setIsCameraOff((v) => !v)}
                        className={`p-2.5 rounded-xl text-sm font-medium transition-all ${
                          isCameraOff
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-surface text-slate-600 hover:bg-surface-hover'
                        }`}
                        title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                      >
                        {isCameraOff ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => void hardLeave()}
                    className="px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors shadow-soft"
                  >
                    Leave
                  </button>
                </div>
              </div>
            </div>

            {/* Video grid */}
            <div className="p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Local video */}
                <div className="rounded-2xl overflow-hidden bg-slate-900 shadow-soft">
                  <div className="px-3 py-2 bg-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-medium text-white/80">
                      You {role === 'publisher' ? '(Host)' : '(Viewer)'}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <video
                    ref={localVideoEl}
                    className="aspect-video w-full bg-slate-900"
                    playsInline
                    muted
                    autoPlay
                  />
                </div>

                {/* Remote videos */}
                <div className="rounded-2xl overflow-hidden bg-slate-900 shadow-soft">
                  <div className="px-3 py-2 bg-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-medium text-white/80">
                      Remote {remoteUids.length ? `(${remoteUids.length})` : '(Waiting)'}
                    </span>
                    {remoteUids.length > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                  </div>

                  {remoteUids.length === 0 && (
                    <div className="flex h-[220px] items-center justify-center bg-slate-800/50 p-4 text-center">
                      <div>
                        <svg className="w-10 h-10 mx-auto text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm text-slate-400 font-medium">Waiting for others to join</p>
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    <div className="grid gap-2 p-2 sm:grid-cols-2">
                      {remoteUids.map((u) => (
                        <motion.div
                          key={u}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="rounded-xl overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2 bg-slate-800/80 px-2 py-1">
                            <span className="text-xs font-medium text-white/80">UID {u}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          </div>
                          <video
                            ref={(el) => {
                              remoteVideoEls.current[u] = el;
                            }}
                            className="aspect-video w-full bg-slate-900"
                            playsInline
                            autoPlay
                          />
                        </motion.div>
                      ))}
                    </div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {callState === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl shadow-card p-8 text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Connection Failed</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {error ?? 'Something went wrong while joining the call.'}
            </p>
            <button
              onClick={() => void join()}
              className="mt-5 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors shadow-soft"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

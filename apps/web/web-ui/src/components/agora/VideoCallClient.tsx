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
      // Create uid->video element if needed
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
      <div className="absolute inset-0 -z-10 bg-black/10" />
      <AnimatePresence mode="wait">
        {callState === 'joining' && (
          <motion.div
            key="joining"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border-4 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="text-3xl font-black leading-none">JOINING…</div>
            <div className="mt-2 text-sm font-bold opacity-80">
              We're cracking the channel open. Don't blink.
            </div>
          </motion.div>
        )}

        {(callState === 'connected' || callState === 'ended') && (
          <motion.div
            key="connected"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="border-b-4 border-black p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-2xl font-black">VIDEO CALL</div>
                  <div className="mt-1 text-sm font-bold opacity-80">
                    channel: <span className="font-mono">{channelName}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {role === 'publisher' && (
                    <>
                      <button
                        onClick={() => setIsMuted((v) => !v)}
                        className="rounded-lg border-3 border-black bg-yellow-300 px-3 py-2 text-sm font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[0px]"
                      >
                        {isMuted ? 'UNMUTE' : 'MUTE'}
                      </button>
                      <button
                        onClick={() => setIsCameraOff((v) => !v)}
                        className="rounded-lg border-3 border-black bg-green-300 px-3 py-2 text-sm font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[0px]"
                      >
                        {isCameraOff ? 'CAM ON' : 'CAM OFF'}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => void hardLeave()}
                    className="rounded-lg border-3 border-black bg-red-300 px-3 py-2 text-sm font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[0px]"
                  >
                    LEAVE
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <motion.div
                  key="local"
                  initial={{ opacity: 0, rotate: -1 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  className="rounded-lg border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                >
                  <div className="border-b-4 border-black p-2">
                    <div className="text-sm font-black">
                      LOCAL {role === 'publisher' ? '(HOST)' : '(SUB)'}
                    </div>
                  </div>
                  <video
                    ref={localVideoEl}
                    className="aspect-video w-full bg-black"
                    playsInline
                    muted
                    autoPlay
                  />
                </motion.div>

                <div className="rounded-lg border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                  <div className="border-b-4 border-black p-2">
                    <div className="text-sm font-black">
                      REMOTE {remoteUids.length ? `(${remoteUids.length})` : '(WAITING)'}
                    </div>
                  </div>

                  {remoteUids.length === 0 && (
                    <div className="flex h-[220px] items-center justify-center bg-black/5 p-4 text-center">
                      <div className="font-black">
                        No one joined yet.
                        <div className="mt-1 text-sm font-bold opacity-70">
                          Send a summon: "come online!"
                        </div>
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    <div className="grid gap-3 p-3 sm:grid-cols-2">
                      {remoteUids.map((u) => (
                        <motion.div
                          key={u}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="rounded-lg border-3 border-black overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2 border-b-3 border-black px-2 py-1">
                            <div className="text-xs font-black">UID {u}</div>
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                          </div>
                          <video
                            ref={(el) => {
                              remoteVideoEls.current[u] = el;
                            }}
                            className="aspect-video w-full bg-black"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border-4 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="text-3xl font-black leading-none">OH NO!</div>
            <div className="mt-2 text-sm font-bold opacity-80">
              {error ?? 'Something broke while joining.'}
            </div>
            <div className="mt-4">
              <button
                onClick={() => void join()}
                className="rounded-lg border-3 border-black bg-yellow-300 px-4 py-2 text-sm font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[0px]"
              >
                RETRY
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

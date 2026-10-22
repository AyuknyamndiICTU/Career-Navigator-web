'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ParsedCv } from '@career-navigator/cv-parser';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorAlert from '@/components/ErrorAlert';
import { apiFetch, apiFetchFile } from '@/lib/auth';
import type { OcrProgress } from '@/lib/cv-ocr';
import CvReviewForm from './CvReviewForm';

type CvScanStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

type StatusResponse = {
  status: CvScanStatus | null;
  error: string | null;
  fileName: string | null;
  review: ParsedCv | null;
  confirmedAt: string | null;
  aiAssistAvailable: boolean;
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ocr'; progress: OcrProgress }
  | { kind: 'uploading' }
  | { kind: 'scanning' };

const ACCEPT =
  '.pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png';

function phaseLabel(phase: Phase): string {
  switch (phase.kind) {
    case 'checking':
      return 'Checking your file…';
    case 'ocr':
      return phase.progress.stage === 'loading'
        ? 'Preparing text recognition (first time can take a moment)…'
        : `Reading scanned page ${phase.progress.page} of ${phase.progress.pages}… ${Math.round(phase.progress.progress * 100)}%`;
    case 'uploading':
      return 'Uploading…';
    case 'scanning':
      return 'Reading your CV…';
    default:
      return '';
  }
}

export default function CvUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState('');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [confirmedMessage, setConfirmedMessage] = useState('');
  const [reviewAgain, setReviewAgain] = useState(false);
  const pollGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const poll = useCallback(async () => {
    // A newer poll (or unmount) bumps the generation and stops this loop.
    const gen = ++pollGenRef.current;
    for (;;) {
      let res: StatusResponse;
      try {
        res = (await apiFetch('/upload/cv/status', { method: 'GET' })) as StatusResponse;
      } catch {
        if (gen !== pollGenRef.current) return;
        setPhase({ kind: 'idle' });
        setError('Could not check the scan status. Refresh the page to try again.');
        return;
      }
      if (gen !== pollGenRef.current) return;
      setStatus(res);
      if (res.status !== 'PENDING' && res.status !== 'PROCESSING') {
        setPhase({ kind: 'idle' });
        return;
      }
      setPhase({ kind: 'scanning' });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (gen !== pollGenRef.current) return;
    }
  }, []);

  useEffect(() => {
    void poll();
    const pollGen = pollGenRef;
    return () => {
      pollGen.current += 1;
      abortRef.current?.abort();
    };
  }, [poll]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || phase.kind !== 'idle') return;
    setError('');
    setConfirmedMessage('');
    setReviewAgain(false);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      setPhase({ kind: 'checking' });
      // Only the OCR helpers pull in pdf.js and tesseract.js, so load them on demand.
      const ocr = await import('@/lib/cv-ocr');
      if (await ocr.needsOcr(file)) {
        const words = await ocr.recognizeCv(file, (progress) => setPhase({ kind: 'ocr', progress }), controller.signal);
        if (words.length === 0) {
          throw new Error('No text could be read from this file. Try a clearer scan or a PDF/DOCX export.');
        }
        formData.append('ocr', JSON.stringify(words));
      }
      formData.append('file', file);
      setPhase({ kind: 'uploading' });
      await apiFetchFile('/upload/cv', formData);
      setFile(null);
      await poll();
    } catch (err) {
      setPhase({ kind: 'idle' });
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to upload CV');
      }
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setPhase({ kind: 'idle' });
  }

  const busy = phase.kind !== 'idle';
  const review = status?.status === 'COMPLETED' ? status.review : null;
  const confirmed = Boolean(status?.confirmedAt) || Boolean(confirmedMessage);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">CV Upload</h1>
          <p className="text-sm text-slate-500">
            Upload your CV to fill in your profile. It is read without AI, and you review everything before it is saved.
          </p>
        </div>

        <ErrorAlert error={error} />

        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Upload PDF, DOCX or a photo/scan (JPG, PNG)</h2>
          </div>
          <form onSubmit={onSubmit} className="p-6 space-y-4">
            <label className="block">
              <span className="sr-only">Choose CV file</span>
              <input
                type="file"
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={busy}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-colors cursor-pointer disabled:opacity-50"
              />
            </label>
            <p className="text-xs text-slate-500">
              Scanned documents and photos are read in your browser, so the image is not sent anywhere for text recognition.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                disabled={!file || busy}
                type="submit"
                className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
              >
                {busy ? 'Working…' : 'Upload CV'}
              </button>
              {(phase.kind === 'ocr' || phase.kind === 'checking') && (
                <button type="button" onClick={cancel} className="px-5 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-bold border border-red-200 hover:bg-red-100">
                  Cancel
                </button>
              )}
            </div>
            {busy && (
              <div role="status" aria-live="polite" className="space-y-2">
                <p className="text-sm text-slate-700">{phaseLabel(phase)}</p>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        phase.kind === 'ocr'
                          ? Math.max(5, ((phase.progress.page - 1 + phase.progress.progress) / Math.max(1, phase.progress.pages)) * 100)
                          : phase.kind === 'scanning'
                            ? 90
                            : 30
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {status?.status === 'FAILED' && !busy && (
          <div className="bg-white rounded-2xl shadow-card border border-surface-border p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-2">We could not read this CV</h2>
            <p className="text-sm text-red-600">{status.error || 'An unknown error occurred during scanning.'}</p>
          </div>
        )}

        {status?.status === 'COMPLETED' && !review && !busy && (
          <p className="text-sm text-slate-600">
            Your current CV was read by an older version of the scanner. Upload it again to review the results.
          </p>
        )}

        {review && !busy && confirmed && !reviewAgain && (
          <div className="bg-white rounded-2xl shadow-card border border-surface-border p-6 space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 font-medium">
              {confirmedMessage || `Your CV${status?.fileName ? ` (${status.fileName})` : ''} was added to your profile.`}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/profile" className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 shadow-soft">
                View & Edit Profile
              </Link>
              <Link href="/resume" className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 shadow-soft">
                Preview Resume
              </Link>
              <button type="button" onClick={() => setReviewAgain(true)} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold border border-slate-200 hover:bg-slate-200">
                Review again
              </button>
            </div>
          </div>
        )}

        {review && !busy && (!confirmed || reviewAgain) && (
          <div className="bg-white rounded-2xl shadow-card border border-surface-border">
            <div className="px-6 py-4 border-b border-surface-border">
              <h2 className="text-base font-semibold text-slate-800">
                Review your CV{status?.fileName ? ` — ${status.fileName}` : ''}
              </h2>
            </div>
            <div className="p-6">
              <CvReviewForm
                key={status?.fileName ?? 'cv'}
                review={review}
                aiAssistAvailable={Boolean(status?.aiAssistAvailable)}
                onError={setError}
                onConfirmed={(message) => {
                  setConfirmedMessage(message);
                  setReviewAgain(false);
                  setError('');
                  void poll();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

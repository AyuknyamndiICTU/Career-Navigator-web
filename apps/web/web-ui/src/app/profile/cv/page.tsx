'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch, apiFetchFile } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

type CvScanStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

type ExtractedData = {
  fullName?: string | null;
  summary?: string | null;
  skills?: string[];
  education?: Array<{
    degree?: string | null;
    fieldOfStudy?: string | null;
    institution?: string | null;
    startYear?: number | null;
    endYear?: number | null;
    grade?: string | null;
    description?: string | null;
    isCurrent?: boolean;
  }>;
  experience?: Array<{
    jobTitle?: string | null;
    company?: string | null;
    location?: string | null;
    startYear?: number | null;
    endYear?: number | null;
    description?: string | null;
    isCurrent?: boolean;
  }>;
};

type StatusResponse = {
  status: CvScanStatus | null;
  error: string | null;
  skills: string[];
  extractedData: ExtractedData | null;
};

const STAGES = [
  { key: 'upload', label: 'Uploading file' },
  { key: 'extract', label: 'Extracting text from document' },
  { key: 'analyze', label: 'AI analyzing your CV' },
  { key: 'done', label: 'Complete' },
];

export default function CvUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const [scanStatus, setScanStatus] = useState<CvScanStatus | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [polling, setPolling] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);

  // Progress stages
  useEffect(() => {
    if (scanStatus === 'PENDING') setCurrentStage(1); // Extract
    if (scanStatus === 'PROCESSING') setCurrentStage(2); // AI analyze
    if (scanStatus === 'COMPLETED' || scanStatus === 'FAILED') setCurrentStage(3); // Done
  }, [scanStatus]);

  // Elapsed timer
  useEffect(() => {
    if (scanStatus === 'PENDING' || scanStatus === 'PROCESSING') {
      elapsedTimerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [scanStatus]);

  // Poll status
  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      if (cancelledRef.current) return;
      try {
        const res = (await apiFetch('/upload/cv/status', { method: 'GET' })) as StatusResponse;
        if (!mounted || cancelledRef.current) return;

        setScanStatus(res.status);
        setScanError(res.error);
        setSkills(res.skills);
        if (res.extractedData) setExtractedData(res.extractedData);

        if (res.status === 'PENDING' || res.status === 'PROCESSING') {
          pollTimerRef.current = setTimeout(checkStatus, 1500);
        } else {
          setPolling(false);
        }
      } catch (err) {
        if (!mounted) return;
        setScanStatus('FAILED');
        setScanError('Failed to check scan status');
        setPolling(false);
      }
    }

    if (polling) {
      void checkStatus();
    }

    return () => {
      mounted = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [polling]);

  // Initial load
  useEffect(() => {
    setPolling(true);
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  function handleCancel() {
    cancelledRef.current = true;
    setPolling(false);
    setScanStatus(null);
    setUploading(false);
    setError('');
    setElapsed(0);
    setCurrentStage(0);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
  }

  function formatTime(sec: number): string {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || uploading) return;

    cancelledRef.current = false;
    setUploading(true);
    setError('');
    setElapsed(0);
    setCurrentStage(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await apiFetchFile('/upload/cv', formData);
      
      setScanStatus('PENDING');
      setScanError(null);
      setSkills([]);
      setPolling(true);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload CV');
      setUploading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">CV Upload</h1>
          <p className="text-sm text-slate-500">
            Upload your resume to automatically extract your skills and profile data using AI.
          </p>
        </div>

        <ErrorAlert error={error} />

        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Upload PDF or DOCX</h2>
          </div>

          <form onSubmit={onSubmit} className="p-6">
            <label className="block mb-4">
              <span className="sr-only">Choose CV file</span>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={uploading}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2.5 file:px-5
                  file:rounded-xl file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary-50 file:text-primary-700
                  hover:file:bg-primary-100 transition-colors
                  cursor-pointer disabled:opacity-50"
              />
            </label>
            
            <button
              disabled={!file || uploading}
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-soft flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading…
                </>
              ) : (
                'Upload CV'
              )}
            </button>
          </form>
        </div>

        {/* Progress Card */}
        {(scanStatus === 'PENDING' || scanStatus === 'PROCESSING') && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Processing Your CV</h2>
              <span className="text-xs text-slate-500">{formatTime(elapsed)} elapsed</span>
            </div>

            <div className="p-6">
              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(((currentStage + 1) / STAGES.length) * 100, 95)}%` }}
                />
              </div>

              {/* Stage indicators */}
              <div className="space-y-2 mb-6">
                {STAGES.slice(0, -1).map((stage, i) => (
                  <div key={stage.key} className="flex items-center gap-3 text-sm">
                    {i < currentStage ? (
                      <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : i === currentStage ? (
                      <svg className="w-5 h-5 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
                    )}
                    <span className={i <= currentStage ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                      {stage.label}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-bold border border-red-200 hover:bg-red-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Result Card */}
        {scanStatus === 'COMPLETED' && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-slate-800">Extraction Complete</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                {formatTime(elapsed)}
              </span>
            </div>
            <div className="p-6 space-y-6">
              {/* Success banner */}
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-sm text-emerald-800 font-medium">
                  Your CV data has been automatically applied to your profile. You can view and edit it on the Profile page, or preview your resume.
                </p>
              </div>

              {/* Extracted Name & Summary */}
              {(extractedData?.fullName || extractedData?.summary) && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Personal Info</h3>
                  <div className="rounded-xl border border-surface-border p-4 bg-slate-50 space-y-2">
                    {extractedData.fullName && (
                      <p className="text-sm text-slate-800"><span className="font-semibold">Name:</span> {extractedData.fullName}</p>
                    )}
                    {extractedData.summary && (
                      <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Summary:</span> {extractedData.summary.length > 200 ? extractedData.summary.slice(0, 200) + '...' : extractedData.summary}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Extracted Skills */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Extracted Skills</h3>
                {skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, i) => (
                      <span key={i} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm border border-primary-200 font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No skills could be identified in the document.</p>
                )}
              </div>

              {/* Extracted Education */}
              {extractedData?.education && extractedData.education.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Education <span className="text-slate-400 font-normal">({extractedData.education.length} {extractedData.education.length === 1 ? 'entry' : 'entries'})</span>
                  </h3>
                  <div className="space-y-2">
                    {extractedData.education.map((edu, i) => (
                      <div key={i} className="rounded-xl border border-surface-border p-3 bg-slate-50">
                        <p className="text-sm font-semibold text-slate-800">{edu.degree || 'Degree'}{edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}</p>
                        {edu.institution && <p className="text-sm text-slate-600">{edu.institution}</p>}
                        <p className="text-xs text-slate-400 mt-1">
                          {[edu.startYear, edu.isCurrent ? 'Present' : edu.endYear].filter(Boolean).join(' — ')}
                          {edu.grade ? ` · ${edu.grade}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Experience */}
              {extractedData?.experience && extractedData.experience.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Work Experience <span className="text-slate-400 font-normal">({extractedData.experience.length} {extractedData.experience.length === 1 ? 'entry' : 'entries'})</span>
                  </h3>
                  <div className="space-y-2">
                    {extractedData.experience.map((exp, i) => (
                      <div key={i} className="rounded-xl border border-surface-border p-3 bg-slate-50">
                        <p className="text-sm font-semibold text-slate-800">{exp.jobTitle || 'Role'}</p>
                        {exp.company && <p className="text-sm text-slate-600">{exp.company}{exp.location ? ` · ${exp.location}` : ''}</p>}
                        <p className="text-xs text-slate-400 mt-1">
                          {[exp.startYear, exp.isCurrent ? 'Present' : exp.endYear].filter(Boolean).join(' — ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-surface-border">
                <Link
                  href="/profile"
                  className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 transition-colors shadow-soft"
                >
                  View & Edit Profile
                </Link>
                <Link
                  href="/resume"
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 transition-colors shadow-soft"
                >
                  Preview Resume
                </Link>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  Upload Another CV
                </button>
              </div>
            </div>
          </div>
        )}

        {scanStatus === 'FAILED' && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
            <div className="px-6 py-4 border-b border-surface-border">
              <h2 className="text-base font-semibold text-slate-800">Extraction Failed</h2>
            </div>
            <div className="p-6">
              <div className="text-sm text-red-600 mb-4">
                <span className="font-semibold block mb-1">Error:</span>
                {scanError || 'An unknown error occurred during scanning.'}
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold border border-slate-200 hover:bg-slate-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

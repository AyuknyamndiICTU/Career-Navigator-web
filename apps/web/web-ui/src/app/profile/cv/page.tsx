// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch, apiFetchFile } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

type CvScanStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

type StatusResponse = {
  status: CvScanStatus | null;
  error: string | null;
  skills: string[];
};

export default function CvUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const [scanStatus, setScanStatus] = useState<CvScanStatus | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [polling, setPolling] = useState(false);

  // Poll status when it's PENDING or PROCESSING
  useEffect(() => {
    let mounted = true;
    let timer: NodeJS.Timeout;

    async function checkStatus() {
      try {
        const res = (await apiFetch('/upload/cv/status', { method: 'GET' })) as StatusResponse;
        if (!mounted) return;

        setScanStatus(res.status);
        setScanError(res.error);
        setSkills(res.skills);

        if (res.status === 'PENDING' || res.status === 'PROCESSING') {
          timer = setTimeout(checkStatus, 3000);
        } else {
          setPolling(false);
        }
      } catch (err) {
        if (!mounted) return;
        setPolling(false);
      }
    }

    if (polling) {
      void checkStatus();
    }

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [polling]);

  // Initial load
  useEffect(() => {
    setPolling(true);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await apiFetchFile('/upload/cv', formData);
      
      // Start polling after successful upload
      setScanStatus('PENDING');
      setScanError(null);
      setSkills([]);
      setPolling(true);
      setFile(null); // Clear input
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload CV');
    } finally {
      setUploading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">CV Upload</h1>
          <p className="text-sm text-slate-500">
            Upload your resume to automatically extract your skills using AI.
          </p>
        </div>

        <ErrorAlert error={error} />

        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Upload PDF or DOCX</h2>
          </div>

          <form onSubmit={onSubmit} className="p-6">
            <label className="block mb-4">
              <span className="sr-only">Choose profile photo</span>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2.5 file:px-5
                  file:rounded-xl file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary-50 file:text-primary-700
                  hover:file:bg-primary-100 transition-colors
                  cursor-pointer"
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

        {scanStatus && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">AI Extraction Status</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                scanStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                scanStatus === 'FAILED' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {scanStatus}
              </span>
            </div>

            <div className="p-6">
              {(scanStatus === 'PENDING' || scanStatus === 'PROCESSING') && (
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing document structure and extracting skills… this usually takes 15-30 seconds.
                </div>
              )}

              {scanStatus === 'FAILED' && (
                <div className="text-sm text-red-600">
                  <span className="font-semibold block mb-1">Extraction failed:</span>
                  {scanError || 'An unknown error occurred during scanning.'}
                </div>
              )}

              {scanStatus === 'COMPLETED' && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Extracted Skills</h3>
                  {skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill, i) => (
                        <span key={i} className="px-3 py-1.5 bg-surface text-slate-700 rounded-lg text-sm border border-surface-border">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No skills could be identified in the document.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

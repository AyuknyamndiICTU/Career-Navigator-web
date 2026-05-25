// @ts-nocheck
'use client';

import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

type Project = {
  id?: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  skills: string[];
  isCurrent: boolean;
};

export default function ProjectsPage() {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  const [draft, setDraft] = useState(() => ({
    title: '',
    description: '',
    externalUrl: '',
    skillsText: '',
    isCurrent: false,
  }));

  const formPayload = useMemo(() => {
    const skills = draft.skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      externalUrl: draft.externalUrl.trim() || undefined,
      skills: skills.length > 0 ? skills : undefined,
      isCurrent: draft.isCurrent,
    };
  }, [draft]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const res = (await apiFetch('/profile/projects', { method: 'GET' })) as Project[];
      setProjects(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!formPayload.title) {
        throw new Error('Project title is required');
      }

      await apiFetch('/profile/projects', { method: 'POST', body: formPayload });
      setDraft({
        title: '',
        description: '',
        externalUrl: '',
        skillsText: '',
        isCurrent: false,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(projectId: string) {
    setDeletingId(projectId);
    setError('');
    try {
      await apiFetch(`/profile/projects/${projectId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-600 mt-1">
            Add projects you’ve built to strengthen your resume and portfolio.
          </p>
        </div>

        <ErrorAlert error={error} />

        <div className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-6 py-4 border-b border-surface-border bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800">Add a Project</h2>
          </div>

          <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5" onSubmit={onCreate}>
            <label className="block md:col-span-2">
              <span className="text-sm font-bold text-slate-700 mb-2 block">Title</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                placeholder="e.g. Career Navigator web app"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 mb-2 block">External URL</span>
              <input
                value={draft.externalUrl}
                onChange={(e) => setDraft((d) => ({ ...d, externalUrl: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                placeholder="e.g. https://github.com/you/repo"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 mb-2 block">Skills (comma-separated)</span>
              <input
                value={draft.skillsText}
                onChange={(e) => setDraft((d) => ({ ...d, skillsText: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                placeholder="node, typescript, react"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-bold text-slate-700 mb-2 block">Description</span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm min-h-[110px]"
                placeholder="What you built, key features, impact..."
              />
            </label>

            <label className="flex items-center gap-3 md:col-span-2">
              <input
                type="checkbox"
                checked={draft.isCurrent}
                onChange={(e) => setDraft((d) => ({ ...d, isCurrent: e.target.checked }))}
                className="w-5 h-5"
              />
              <span className="text-sm font-bold text-slate-700">Mark as current</span>
            </label>

            <div className="md:col-span-2 flex justify-end pt-2 border-t border-slate-100">
              <button
                disabled={saving}
                type="submit"
                className="px-8 py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
              >
                {saving ? 'Saving...' : 'Add Project'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Your Projects</h2>
            {busy ? <span className="text-sm text-slate-600">Loading...</span> : null}
          </div>

          {projects.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-surface-border p-6 text-sm text-slate-600">
              No projects yet. Add one above.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-surface-border p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-extrabold text-slate-900">{p.title}</h3>
                        {p.isCurrent ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            Current
                          </span>
                        ) : null}
                      </div>
                      {p.description ? (
                        <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                          {p.description}
                        </p>
                      ) : null}
                      {p.externalUrl ? (
                        <a
                          className="text-sm font-bold text-rose-600 mt-2 inline-block"
                          href={p.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View link
                        </a>
                      ) : null}
                      {Array.isArray(p.skills) && p.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {p.skills.map((s) => (
                            <span
                              key={s}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm border border-slate-200"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {p.id ? (
                      <button
                        disabled={deletingId === p.id}
                        onClick={() => void onDelete(p.id as string)}
                        className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold border border-rose-100 hover:bg-rose-100 transition disabled:opacity-50"
                      >
                        {deletingId === p.id ? 'Deleting...' : 'Delete'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

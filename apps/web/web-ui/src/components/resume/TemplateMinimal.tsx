// @ts-nocheck
import React from 'react';
import type { ResumeData } from './types';

interface Props {
  data: ResumeData;
}

export default function TemplateMinimal({ data }: Props) {
  const { sections } = data;
  const { header } = sections;

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-slate-800 font-sans px-12 py-10">
      {/* Name + Contact */}
      <div className="text-center mb-6">
        {header.fullName && (
          <h1 className="text-2xl font-bold uppercase tracking-wide">{header.fullName}</h1>
        )}
        {header.headline && (
          <p className="mt-1 text-sm text-slate-500">{header.headline}</p>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {header.contact.phone && <span>{header.contact.phone}</span>}
          {header.contact.email && <span>{header.contact.email}</span>}
          {header.contact.location && <span>{header.contact.location}</span>}
          {header.contact.linkedIn && <span>{header.contact.linkedIn}</span>}
        </div>
      </div>

      <hr className="border-slate-300 mb-5" />

      {sections.summary && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Professional Summary</h3>
          <p className="text-sm leading-relaxed">{sections.summary}</p>
        </div>
      )}

      {sections.objective && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Objective</h3>
          <p className="text-sm leading-relaxed">{sections.objective}</p>
        </div>
      )}

      {sections.experience.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-200 pb-1">Experience</h3>
          <div className="space-y-4">
            {sections.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-sm">{exp.jobTitle} — {exp.company}</span>
                  <span className="text-xs text-slate-500">{exp.years}</span>
                </div>
                {exp.location && <p className="text-xs text-slate-500">{exp.location}</p>}
                {exp.description && <p className="text-sm mt-1">{exp.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.education.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-200 pb-1">Education</h3>
          <div className="space-y-4">
            {sections.education.map((edu, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-sm">{edu.degree} — {edu.institution}</span>
                  <span className="text-xs text-slate-500">{edu.years}</span>
                </div>
                {edu.fieldOfStudy && <p className="text-xs text-slate-500">{edu.fieldOfStudy}</p>}
                {edu.grade && <p className="text-xs text-slate-500">Grade: {edu.grade}</p>}
                {edu.description && <p className="text-sm mt-1">{edu.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.skills.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-200 pb-1">Skills</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {sections.skills.map((s, i) => <span key={i}>{s}</span>)}
          </div>
        </div>
      )}

      {sections.projects.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-200 pb-1">Projects</h3>
          <div className="space-y-2">
            {sections.projects.map((proj, i) => (
              <div key={i}>
                <span className="font-bold text-sm">{proj.title}</span>
                {proj.description && <span className="text-sm"> — {proj.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.languages.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-200 pb-1">Languages</h3>
          <p className="text-sm">{sections.languages.join(', ')}</p>
        </div>
      )}

      {sections.references.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-200 pb-1">References</h3>
          <div className="space-y-2 text-sm">
            {sections.references.map((ref, i) => (
              <div key={i}>
                <span className="font-bold">{ref.name}</span>
                {ref.relationship && <span> — {ref.relationship}</span>}
                {ref.company && <span> at {ref.company}</span>}
                {ref.email && <span> | {ref.email}</span>}
                {ref.phone && <span> | {ref.phone}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

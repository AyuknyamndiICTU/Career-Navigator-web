// @ts-nocheck
import React from 'react';
import type { ResumeData } from './types';

interface Props {
  data: ResumeData;
}

export default function TemplateClassic({ data }: Props) {
  const { sections } = data;
  const { header } = sections;

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-slate-800 font-serif">
      {/* Header */}
      <div className="bg-slate-800 text-white px-10 py-8 text-center">
        {header.fullName && (
          <h1 className="text-3xl font-bold tracking-wide uppercase">{header.fullName}</h1>
        )}
        {header.headline && (
          <p className="mt-2 text-lg text-slate-300">{header.headline}</p>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-slate-400">
          {header.contact.phone && <span>{header.contact.phone}</span>}
          {header.contact.email && <span>{header.contact.email}</span>}
          {header.contact.location && <span>{header.contact.location}</span>}
          {header.contact.linkedIn && <span>{header.contact.linkedIn}</span>}
        </div>
      </div>

      <div className="px-10 py-6 grid grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="col-span-1 space-y-5 border-r border-slate-200 pr-6">
          {sections.skills.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">Skills</h3>
              <ul className="text-sm space-y-1">
                {sections.skills.map((s, i) => (
                  <li key={i} className="text-slate-700">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {sections.languages.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">Languages</h3>
              <ul className="text-sm space-y-1">
                {sections.languages.map((l, i) => (
                  <li key={i} className="text-slate-700">{l}</li>
                ))}
              </ul>
            </div>
          )}

          {sections.interests.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">Interests</h3>
              <ul className="text-sm space-y-1">
                {sections.interests.map((s, i) => (
                  <li key={i} className="text-slate-700">{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="col-span-2 space-y-5">
          {sections.summary && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">Professional Summary</h3>
              <p className="text-sm leading-relaxed text-slate-700">{sections.summary}</p>
            </div>
          )}

          {sections.objective && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">Objective</h3>
              <p className="text-sm leading-relaxed text-slate-700">{sections.objective}</p>
            </div>
          )}

          {sections.experience.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">Experience</h3>
              <div className="space-y-3">
                {sections.experience.map((exp, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-slate-800">{exp.jobTitle}</span>
                      <span className="text-xs text-slate-500">{exp.years}</span>
                    </div>
                    <p className="text-sm text-slate-600">{exp.company}{exp.location ? ` — ${exp.location}` : ''}</p>
                    {exp.description && <p className="text-sm mt-1 text-slate-700">{exp.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.education.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">Education</h3>
              <div className="space-y-3">
                {sections.education.map((edu, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-slate-800">{edu.degree}</span>
                      <span className="text-xs text-slate-500">{edu.years}</span>
                    </div>
                    <p className="text-sm text-slate-600">{edu.institution}{edu.fieldOfStudy ? ` — ${edu.fieldOfStudy}` : ''}</p>
                    {edu.grade && <p className="text-sm text-slate-600">Grade: {edu.grade}</p>}
                    {edu.description && <p className="text-sm mt-1 text-slate-700">{edu.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

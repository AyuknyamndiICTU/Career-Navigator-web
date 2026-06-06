// @ts-nocheck
import React from 'react';
import type { ResumeData } from './types';

interface Props {
  data: ResumeData;
}

export default function TemplateModern({ data }: Props) {
  const { sections } = data;
  const { header } = sections;

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-slate-700 font-sans flex min-h-[297mm]">
      {/* Left Sidebar */}
      <div className="w-[35%] bg-indigo-600 text-white px-8 py-10 flex flex-col gap-6">
        {header.contact.photoUrl && (
          <div className="w-24 h-24 rounded-full bg-white/20 mx-auto overflow-hidden">
            <img src={header.contact.photoUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {header.fullName && (
          <h1 className="text-2xl font-extrabold text-center leading-tight">{header.fullName}</h1>
        )}
        {header.headline && (
          <p className="text-sm text-center text-indigo-200 -mt-4">{header.headline}</p>
        )}

        {/* Contact */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3 border-b border-indigo-400 pb-1">Contact</h3>
          <div className="space-y-2 text-sm">
            {header.contact.email && <p>{header.contact.email}</p>}
            {header.contact.phone && <p>{header.contact.phone}</p>}
            {header.contact.location && <p>{header.contact.location}</p>}
            {header.contact.website && <p className="break-all">{header.contact.website}</p>}
            {header.contact.linkedIn && <p className="break-all">{header.contact.linkedIn}</p>}
          </div>
        </div>

        {/* Skills */}
        {sections.skills.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3 border-b border-indigo-400 pb-1">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {sections.skills.map((s, i) => (
                <span key={i} className="px-3 py-1 bg-white/15 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {sections.languages.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3 border-b border-indigo-400 pb-1">Languages</h3>
            <ul className="space-y-1 text-sm">
              {sections.languages.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        )}

        {/* Interests */}
        {sections.interests.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3 border-b border-indigo-400 pb-1">Interests</h3>
            <ul className="space-y-1 text-sm">
              {sections.interests.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Right Content */}
      <div className="w-[65%] px-8 py-10 space-y-6">
        {sections.summary && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-2 border-b border-indigo-200 pb-1">About Me</h3>
            <p className="text-sm leading-relaxed">{sections.summary}</p>
          </div>
        )}

        {sections.objective && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-2 border-b border-indigo-200 pb-1">Career Objective</h3>
            <p className="text-sm leading-relaxed">{sections.objective}</p>
          </div>
        )}

        {sections.experience.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-3 border-b border-indigo-200 pb-1">Experience</h3>
            <div className="space-y-4">
              {sections.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-800">{exp.jobTitle}</span>
                    <span className="text-xs text-slate-500">{exp.years}</span>
                  </div>
                  <p className="text-sm text-slate-600">{exp.company}{exp.location ? ` — ${exp.location}` : ''}</p>
                  {exp.description && <p className="text-sm mt-1 text-slate-600">{exp.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.education.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-3 border-b border-indigo-200 pb-1">Education</h3>
            <div className="space-y-4">
              {sections.education.map((edu, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-800">{edu.degree}</span>
                    <span className="text-xs text-slate-500">{edu.years}</span>
                  </div>
                  <p className="text-sm text-slate-600">{edu.institution}{edu.fieldOfStudy ? ` — ${edu.fieldOfStudy}` : ''}</p>
                  {edu.grade && <p className="text-sm text-slate-600">Grade: {edu.grade}</p>}
                  {edu.description && <p className="text-sm mt-1 text-slate-600">{edu.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.projects.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-3 border-b border-indigo-200 pb-1">Projects</h3>
            <div className="space-y-3">
              {sections.projects.map((proj, i) => (
                <div key={i}>
                  <span className="font-bold text-slate-800">{proj.title}</span>
                  {proj.description && <p className="text-sm mt-1 text-slate-600">{proj.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

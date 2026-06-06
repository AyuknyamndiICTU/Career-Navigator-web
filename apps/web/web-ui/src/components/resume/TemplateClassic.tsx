// @ts-nocheck
import React from 'react';
import type { ResumeData } from './types';

interface Props {
  data: ResumeData;
}

export default function TemplateClassic({ data }: Props) {
  const { sections } = data;
  const { header } = sections;

  const hasLeft =
    sections.skills.length > 0 ||
    sections.languages.length > 0 ||
    sections.interests.length > 0 ||
    sections.achievementsAwards.length > 0;

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-slate-800 font-serif print:shadow-none print:m-0 print:p-0">
      {/* Header */}
      <div className="bg-slate-800 text-white px-10 py-8 text-center print:bg-slate-800 print:text-white">
        {header.fullName ? (
          <h1 className="text-3xl font-bold tracking-wide uppercase">{header.fullName}</h1>
        ) : (
          <h1 className="text-3xl font-bold tracking-wide uppercase text-slate-400">
            Your Name
          </h1>
        )}
        {header.headline ? (
          <p className="mt-2 text-lg text-slate-300">{header.headline}</p>
        ) : (
          <p className="mt-2 text-lg text-slate-500 italic">Professional Title</p>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-slate-400">
          {header.contact.phone && <span>{header.contact.phone}</span>}
          {header.contact.email && <span>{header.contact.email}</span>}
          {header.contact.location && <span>{header.contact.location}</span>}
          {header.contact.linkedIn && <span>{header.contact.linkedIn}</span>}
          {header.contact.website && <span>{header.contact.website}</span>}
        </div>
      </div>

      <div className="px-10 py-6 grid grid-cols-3 gap-8 print:px-8 print:py-5">
        {/* Left Column */}
        {hasLeft && (
          <div className="col-span-1 space-y-5 border-r border-slate-200 pr-6 print:border-r print:border-slate-200">
            {sections.skills.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">
                  Skills
                </h3>
                <ul className="text-sm space-y-1">
                  {sections.skills.map((s, i) => (
                    <li key={i} className="text-slate-700">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sections.languages.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">
                  Languages
                </h3>
                <ul className="text-sm space-y-1">
                  {sections.languages.map((l, i) => (
                    <li key={i} className="text-slate-700">
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sections.interests.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">
                  Interests
                </h3>
                <ul className="text-sm space-y-1">
                  {sections.interests.map((s, i) => (
                    <li key={i} className="text-slate-700">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sections.achievementsAwards.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">
                  Achievements
                </h3>
                <ul className="text-sm space-y-1">
                  {sections.achievementsAwards.map((a, i) => (
                    <li key={i} className="text-slate-700">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Right Column */}
        <div className={hasLeft ? 'col-span-2 space-y-5' : 'col-span-3 space-y-5'}>
          {sections.summary && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">
                Professional Summary
              </h3>
              <p className="text-sm leading-relaxed text-slate-700">{sections.summary}</p>
            </div>
          )}

          {sections.objective && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">
                Objective
              </h3>
              <p className="text-sm leading-relaxed text-slate-700">{sections.objective}</p>
            </div>
          )}

          {sections.experience.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-300 pb-1">
                Experience
              </h3>
              <div className="space-y-4">
                {sections.experience.map((exp, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-slate-800">{exp.jobTitle}</span>
                      <span className="text-xs text-slate-500">{exp.years}</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {exp.company}
                      {exp.location ? ` — ${exp.location}` : ''}
                    </p>
                    {exp.description && (
                      <p className="text-sm mt-1 text-slate-700 leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.education.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-300 pb-1">
                Education
              </h3>
              <div className="space-y-3">
                {sections.education.map((edu, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-slate-800">{edu.degree}</span>
                      <span className="text-xs text-slate-500">{edu.years}</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {edu.institution}
                      {edu.fieldOfStudy ? ` — ${edu.fieldOfStudy}` : ''}
                    </p>
                    {edu.grade && <p className="text-sm text-slate-600">Grade: {edu.grade}</p>}
                    {edu.description && (
                      <p className="text-sm mt-1 text-slate-700">{edu.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.projects.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-300 pb-1">
                Projects
              </h3>
              <div className="space-y-3">
                {sections.projects.map((proj, i) => (
                  <div key={i}>
                    <span className="font-bold text-slate-800">{proj.title}</span>
                    {proj.description && (
                      <p className="text-sm mt-1 text-slate-700">{proj.description}</p>
                    )}
                    {proj.externalUrl && (
                      <p className="text-xs text-slate-500 mt-0.5">{proj.externalUrl}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.references.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">
                References
              </h3>
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

          {sections.publications.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 border-b border-slate-300 pb-1">
                Publications
              </h3>
              <ul className="text-sm space-y-1">
                {sections.publications.map((p, i) => (
                  <li key={i} className="text-slate-700">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// @ts-nocheck
import React from 'react';
import type { ResumeData } from './types';

interface Props {
  data: ResumeData;
}

export default function TemplateProfessional({ data }: Props) {
  const { sections } = data;
  const { header } = sections;

  const hasLeft =
    sections.skills.length > 0 ||
    sections.languages.length > 0 ||
    sections.interests.length > 0 ||
    sections.achievementsAwards.length > 0 ||
    header.contact.photoUrl;

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-slate-800 font-sans min-h-[297mm] print:shadow-none print:m-0 print:p-0 print:min-h-[297mm]">
      {/* Header Bar */}
      <div className="bg-slate-900 px-10 py-7 flex items-center gap-6 print:bg-slate-900">
        {header.contact.photoUrl && (
          <div className="w-20 h-20 rounded-full border-2 border-amber-400/80 overflow-hidden shrink-0">
            <img
              src={header.contact.photoUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className={header.contact.photoUrl ? '' : 'w-full'}>
          {header.fullName ? (
            <h1 className="text-2xl font-bold text-white tracking-wide">
              {header.fullName}
            </h1>
          ) : (
            <h1 className="text-2xl font-bold text-slate-500 tracking-wide italic">
              Your Name
            </h1>
          )}
          {header.headline ? (
            <p className="text-sm text-amber-400 mt-1 font-medium">{header.headline}</p>
          ) : (
            <p className="text-sm text-slate-500 mt-1 italic">Professional Title</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-slate-400">
            {header.contact.email && <span>{header.contact.email}</span>}
            {header.contact.phone && <span>{header.contact.phone}</span>}
            {header.contact.location && <span>{header.contact.location}</span>}
            {header.contact.linkedIn && <span>{header.contact.linkedIn}</span>}
            {header.contact.website && <span>{header.contact.website}</span>}
            {header.contact.address && <span>{header.contact.address}</span>}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar */}
        {hasLeft && (
          <div className="w-[35%] bg-slate-50 px-8 py-7 space-y-6 border-r border-slate-200 print:bg-slate-50 print:border-r print:border-slate-200">
            {sections.skills.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 border-b-2 border-amber-400/70 pb-1.5">
                  Skills
                </h3>
                <div className="space-y-1.5">
                  {sections.skills.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sections.languages.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 border-b-2 border-amber-400/70 pb-1.5">
                  Languages
                </h3>
                <div className="space-y-1.5">
                  {sections.languages.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sections.interests.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 border-b-2 border-amber-400/70 pb-1.5">
                  Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {sections.interests.map((s, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {sections.achievementsAwards.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 border-b-2 border-amber-400/70 pb-1.5">
                  Achievements
                </h3>
                <div className="space-y-1.5">
                  {sections.achievementsAwards.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-amber-500 mt-0.5 shrink-0">★</span>
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Main Content */}
        <div className={hasLeft ? 'w-[65%] px-8 py-7 space-y-6' : 'w-full px-10 py-7 space-y-6'}>
          {sections.summary && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-2 border-b-2 border-amber-400/70 pb-1.5">
                Professional Summary
              </h3>
              <p className="text-sm leading-relaxed text-slate-700">{sections.summary}</p>
            </div>
          )}

          {sections.objective && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-2 border-b-2 border-amber-400/70 pb-1.5">
                Career Objective
              </h3>
              <p className="text-sm leading-relaxed text-slate-700">{sections.objective}</p>
            </div>
          )}

          {sections.experience.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 border-b-2 border-amber-400/70 pb-1.5">
                Professional Experience
              </h3>
              <div className="space-y-5">
                {sections.experience.map((exp, i) => (
                  <div key={i} className="relative pl-4 border-l-2 border-slate-200">
                    <div className="flex justify-between items-baseline flex-wrap gap-x-4">
                      <span className="font-bold text-slate-800">{exp.jobTitle}</span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{exp.years}</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {exp.company}
                      {exp.location ? ` — ${exp.location}` : ''}
                    </p>
                    {exp.description && (
                      <p className="text-sm mt-1.5 text-slate-700 leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.education.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 border-b-2 border-amber-400/70 pb-1.5">
                Education
              </h3>
              <div className="space-y-4">
                {sections.education.map((edu, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline flex-wrap gap-x-4">
                      <span className="font-bold text-slate-800">{edu.degree}</span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{edu.years}</span>
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
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 border-b-2 border-amber-400/70 pb-1.5">
                Projects
              </h3>
              <div className="space-y-4">
                {sections.projects.map((proj, i) => (
                  <div key={i}>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="font-bold text-slate-800">{proj.title}</span>
                      {proj.externalUrl && (
                        <a
                          href={proj.externalUrl}
                          className="text-xs text-amber-600 underline break-all"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {proj.externalUrl}
                        </a>
                      )}
                    </div>
                    {proj.description && (
                      <p className="text-sm mt-1 text-slate-700 leading-relaxed">{proj.description}</p>
                    )}
                    {proj.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {proj.skills.map((s, j) => (
                          <span
                            key={j}
                            className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium border border-amber-200"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.publications.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 border-b-2 border-amber-400/70 pb-1.5">
                Publications
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
                {sections.publications.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {sections.references.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 border-b-2 border-amber-400/70 pb-1.5">
                References
              </h3>
              <div className="space-y-2.5 text-sm">
                {sections.references.map((ref, i) => (
                  <div key={i}>
                    <span className="font-bold text-slate-800">{ref.name}</span>
                    {ref.relationship && <span className="text-slate-600"> — {ref.relationship}</span>}
                    {ref.company && <span className="text-slate-600"> at {ref.company}</span>}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                      {ref.email && <span>{ref.email}</span>}
                      {ref.phone && <span>{ref.phone}</span>}
                      {ref.notes && <span className="italic">{ref.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.signature && (
            <div className="pt-4 mt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600 italic">{sections.signature}</p>
            </div>
          )}

          {sections.additionalInformation && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-2 border-b-2 border-amber-400/70 pb-1.5">
                Additional Information
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">{sections.additionalInformation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
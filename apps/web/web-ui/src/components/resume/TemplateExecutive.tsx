import React from 'react';
import type { ResumeData } from './types';

interface Props {
  data: ResumeData;
}

export default function TemplateExecutive({ data }: Props) {
  const { sections } = data;
  const { header } = sections;

  const hasLeft =
    header.contact.photoUrl ||
    header.contact.email ||
    header.contact.phone ||
    header.contact.location ||
    header.contact.website ||
    header.contact.linkedIn ||
    header.contact.address ||
    sections.skills.length > 0 ||
    sections.languages.length > 0 ||
    sections.interests.length > 0 ||
    sections.achievementsAwards.length > 0 ||
    sections.activities.length > 0;

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-slate-700 font-sans min-h-[297mm] print:shadow-none print:m-0 print:p-0 print:min-h-[297mm]">
      {/* Full-width Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-10 pt-9 pb-6 print:from-slate-900 print:via-slate-800 print:to-slate-900 print:text-white">
        <div className="flex items-center gap-6">
          {/* Photo (if provided) */}
          {header.contact.photoUrl && (
            <div className="w-20 h-20 rounded-full border-2 border-amber-400/70 overflow-hidden flex-shrink-0 shadow-lg print:border-amber-400/70">
              <img src={header.contact.photoUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex-1">
            {header.fullName ? (
              <h1 className="text-[2rem] font-bold tracking-tight leading-tight text-white">
                {header.fullName}
              </h1>
            ) : (
              <h1 className="text-[2rem] font-bold tracking-tight leading-tight text-slate-400">
                Your Name
              </h1>
            )}
            {header.headline ? (
              <p className="mt-1.5 text-base text-amber-400/90 font-medium tracking-wide">
                {header.headline}
              </p>
            ) : (
              <p className="mt-1.5 text-base text-slate-500 italic font-medium tracking-wide">
                Executive Title
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Gold accent bar */}
      <div className="h-[3px] bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 print:from-amber-500 print:via-amber-400 print:to-amber-500" />

      <div className="flex">
        {/* Left Sidebar */}
        {hasLeft && (
          <div className="w-[32%] bg-slate-50 border-r border-slate-200 px-6 py-7 flex flex-col gap-5 print:bg-slate-50 print:border-r print:border-slate-200">
            {/* Contact */}
            {(header.contact.email ||
              header.contact.phone ||
              header.contact.location ||
              header.contact.website ||
              header.contact.linkedIn ||
              header.contact.address) && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 mb-3 border-b-2 border-amber-300/60 pb-1.5">
                  Contact
                </h3>
                <div className="space-y-1.5 text-sm text-slate-600">
                  {header.contact.email && (
                    <p className="break-all flex items-start gap-1.5">
                      <span className="text-amber-500 shrink-0 mt-0.5">✉</span>
                      {header.contact.email}
                    </p>
                  )}
                  {header.contact.phone && (
                    <p className="flex items-start gap-1.5">
                      <span className="text-amber-500 shrink-0 mt-0.5">☎</span>
                      {header.contact.phone}
                    </p>
                  )}
                  {header.contact.location && (
                    <p className="flex items-start gap-1.5">
                      <span className="text-amber-500 shrink-0 mt-0.5">⌂</span>
                      {header.contact.location}
                    </p>
                  )}
                  {header.contact.address && <p className="text-xs text-slate-500 pl-5">{header.contact.address}</p>}
                  {header.contact.website && (
                    <p className="break-all flex items-start gap-1.5">
                      <span className="text-amber-500 shrink-0 mt-0.5">↗</span>
                      {header.contact.website}
                    </p>
                  )}
                  {header.contact.linkedIn && (
                    <p className="break-all flex items-start gap-1.5">
                      <span className="text-amber-500 shrink-0 mt-0.5">🔗</span>
                      {header.contact.linkedIn}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Skills */}
            {sections.skills.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 mb-3 border-b-2 border-amber-300/60 pb-1.5">
                  Core Competencies
                </h3>
                <div className="space-y-2">
                  {sections.skills.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0 print:bg-amber-400" />
                      <span className="text-sm text-slate-700 leading-tight">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {sections.languages.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 mb-3 border-b-2 border-amber-300/60 pb-1.5">
                  Languages
                </h3>
                <div className="space-y-1.5 text-sm text-slate-700">
                  {sections.languages.map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {sections.interests.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 mb-3 border-b-2 border-amber-300/60 pb-1.5">
                  Interests
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {sections.interests.map((s, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 print:bg-white print:border-slate-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Achievements & Awards */}
            {sections.achievementsAwards.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 mb-3 border-b-2 border-amber-300/60 pb-1.5">
                  Achievements
                </h3>
                <div className="space-y-2">
                  {sections.achievementsAwards.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 text-xs mt-0.5 shrink-0">★</span>
                      <span className="text-sm text-slate-700 leading-tight">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activities */}
            {sections.activities.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 mb-3 border-b-2 border-amber-300/60 pb-1.5">
                  Activities
                </h3>
                <div className="space-y-1.5 text-sm text-slate-700">
                  {sections.activities.map((act, i) => (
                    <p key={i}>{act}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Content */}
        <div className={hasLeft ? 'w-[68%] px-8 py-7 space-y-6 bg-white print:bg-white' : 'w-full px-10 py-7 space-y-6 bg-white print:bg-white'}>
          {/* Professional Summary */}
          {sections.summary && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-2 flex items-center gap-3">
                <span>Executive Profile</span>
                <span className="flex-1 h-[1px] bg-gradient-to-r from-amber-400/60 to-transparent" />
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">{sections.summary}</p>
            </div>
          )}

          {/* Objective */}
          {sections.objective && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-2 flex items-center gap-3">
                <span>Career Objective</span>
                <span className="flex-1 h-[1px] bg-gradient-to-r from-amber-400/60 to-transparent" />
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">{sections.objective}</p>
            </div>
          )}

          {/* Experience */}
          {sections.experience.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-4 flex items-center gap-3">
                <span>Professional Experience</span>
                <span className="flex-1 h-[1px] bg-gradient-to-r from-amber-400/60 to-transparent" />
              </h3>
              <div className="space-y-5">
                {sections.experience.map((exp, i) => (
                  <div key={i} className="relative pl-4 border-l-2 border-amber-200 print:border-amber-200">
                    <div className="flex justify-between items-baseline flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-bold text-slate-800 text-base">{exp.jobTitle}</span>
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full print:bg-amber-50 print:text-amber-700">
                        {exp.years}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {exp.company}
                      {exp.location ? ` — ${exp.location}` : ''}
                    </p>
                    {exp.description && (
                      <p className="text-sm mt-2 text-slate-600 leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {sections.education.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-4 flex items-center gap-3">
                <span>Education</span>
                <span className="flex-1 h-[1px] bg-gradient-to-r from-amber-400/60 to-transparent" />
              </h3>
              <div className="space-y-4">
                {sections.education.map((edu, i) => (
                  <div key={i} className="relative pl-4 border-l-2 border-amber-200 print:border-amber-200">
                    <div className="flex justify-between items-baseline flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-bold text-slate-800">{edu.degree}</span>
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full print:bg-amber-50 print:text-amber-700">
                        {edu.years}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {edu.institution}
                      {edu.fieldOfStudy ? ` — ${edu.fieldOfStudy}` : ''}
                    </p>
                    {edu.grade && <p className="text-sm text-slate-500 mt-0.5">Grade: {edu.grade}</p>}
                    {edu.description && (
                      <p className="text-sm mt-1.5 text-slate-600 leading-relaxed">{edu.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {sections.projects.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-4 flex items-center gap-3">
                <span>Key Projects</span>
                <span className="flex-1 h-[1px] bg-gradient-to-r from-amber-400/60 to-transparent" />
              </h3>
              <div className="space-y-4">
                {sections.projects.map((proj, i) => (
                  <div key={i} className="relative pl-4 border-l-2 border-amber-200 print:border-amber-200">
                    <div className="flex items-baseline flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-bold text-slate-800">{proj.title}</span>
                      {proj.isCurrent && (
                        <span className="text-[10px] font-semibold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full print:bg-emerald-50 print:text-emerald-600">
                          Current
                        </span>
                      )}
                    </div>
                    {proj.description && (
                      <p className="text-sm mt-1.5 text-slate-600 leading-relaxed">{proj.description}</p>
                    )}
                    {proj.externalUrl && (
                      <a
                        href={proj.externalUrl}
                        className="text-xs text-amber-600 hover:text-amber-800 underline mt-1 inline-block"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {proj.externalUrl}
                      </a>
                    )}
                    {proj.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {proj.skills.map((s, j) => (
                          <span
                            key={j}
                            className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-medium print:bg-slate-100"
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

          {/* Publications */}
          {sections.publications.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 flex items-center gap-3">
                <span>Publications</span>
                <span className="flex-1 h-[1px] bg-gradient-to-r from-amber-400/60 to-transparent" />
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {sections.publications.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-400 text-xs mt-1 shrink-0">■</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* References */}
          {sections.references.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3 flex items-center gap-3">
                <span>References</span>
                <span className="flex-1 h-[1px] bg-gradient-to-r from-amber-400/60 to-transparent" />
              </h3>
              <div className="grid grid-cols-1 gap-2.5 text-sm">
                {sections.references.map((ref, i) => (
                  <div key={i} className="bg-slate-50 rounded px-3 py-2.5 border border-slate-100 print:bg-slate-50 print:border-slate-100">
                    <span className="font-bold text-slate-800">{ref.name}</span>
                    {ref.relationship && <span className="text-slate-600"> — {ref.relationship}</span>}
                    {ref.company && <span className="text-slate-600"> at {ref.company}</span>}
                    {(ref.email || ref.phone) && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                        {ref.email && <span>{ref.email}</span>}
                        {ref.phone && <span>{ref.phone}</span>}
                      </div>
                    )}
                    {ref.notes && <p className="text-xs text-slate-500 mt-1 italic">{ref.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signature */}
          {sections.signature && (
            <div className="pt-4 mt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600 italic">{sections.signature}</p>
            </div>
          )}

          {/* Additional Information */}
          {sections.additionalInformation && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-2 flex items-center gap-3">
                <span>Additional Information</span>
                <span className="flex-1 h-[1px] bg-gradient-to-r from-amber-400/60 to-transparent" />
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">{sections.additionalInformation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
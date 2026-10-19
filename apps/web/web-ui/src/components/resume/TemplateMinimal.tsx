import React from 'react';
import type { ResumeData } from './types';

interface Props {
  data: ResumeData;
}

export default function TemplateMinimal({ data }: Props) {
  const { sections } = data;
  const { header } = sections;

  const hasSidebar =
    sections.skills.length > 0 ||
    sections.languages.length > 0 ||
    sections.interests.length > 0 ||
    sections.achievementsAwards.length > 0;

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-neutral-800 font-sans min-h-[297mm] print:shadow-none print:m-0 print:p-0 print:flex">
      {/* Header — clean centered name line */}
      <div className="px-10 pt-8 pb-2 text-center">
        {header.fullName ? (
          <h1 className="text-2xl font-light tracking-[0.15em] uppercase text-neutral-900">
            {header.fullName}
          </h1>
        ) : (
          <h1 className="text-2xl font-light tracking-[0.15em] uppercase text-neutral-300">
            Your Name
          </h1>
        )}
        {header.headline ? (
          <p className="mt-1.5 text-xs tracking-widest uppercase text-neutral-400">
            {header.headline}
          </p>
        ) : (
          <p className="mt-1.5 text-xs tracking-widest uppercase text-neutral-300 italic">
            Professional Title
          </p>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[11px] text-neutral-400 font-light">
          {header.contact.email && <span>{header.contact.email}</span>}
          {header.contact.phone && <span>{header.contact.phone}</span>}
          {header.contact.location && <span>{header.contact.location}</span>}
          {header.contact.linkedIn && <span>{header.contact.linkedIn}</span>}
          {header.contact.website && <span>{header.contact.website}</span>}
        </div>
      </div>

      {/* Thin rule under header */}
      <div className="px-10 mb-6">
        <div className="border-t border-neutral-200" />
      </div>

      <div className="px-10 pb-8 grid grid-cols-5 gap-8">
        {/* Sidebar column */}
        {hasSidebar && (
          <div className="col-span-2 space-y-5 pr-4">
            {sections.skills.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                  Skills
                </h3>
                <ul className="space-y-2 text-sm font-light text-neutral-600">
                  {sections.skills.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {sections.languages.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                  Languages
                </h3>
                <ul className="space-y-1.5 text-sm font-light text-neutral-600">
                  {sections.languages.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            )}

            {sections.interests.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                  Interests
                </h3>
                <ul className="space-y-1.5 text-sm font-light text-neutral-600">
                  {sections.interests.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {sections.achievementsAwards.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                  Achievements
                </h3>
                <ul className="space-y-2 text-sm font-light text-neutral-600">
                  {sections.achievementsAwards.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Main content column */}
        <div className={hasSidebar ? 'col-span-3 space-y-6' : 'col-span-5 space-y-6'}>
          {sections.summary && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-2">
                About
              </h3>
              <p className="text-sm leading-relaxed font-light text-neutral-600">
                {sections.summary}
              </p>
            </div>
          )}

          {sections.objective && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-2">
                Objective
              </h3>
              <p className="text-sm leading-relaxed font-light text-neutral-600">
                {sections.objective}
              </p>
            </div>
          )}

          {sections.experience.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-4">
                Experience
              </h3>
              <div className="space-y-5">
                {sections.experience.map((exp, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium text-sm text-neutral-800">
                        {exp.jobTitle}
                      </span>
                      <span className="text-[11px] text-neutral-400 font-light">
                        {exp.years}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 font-light mt-0.5">
                      {exp.company}
                      {exp.location ? ` — ${exp.location}` : ''}
                    </p>
                    {exp.description && (
                      <p className="text-sm mt-1.5 leading-relaxed font-light text-neutral-600">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.education.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-4">
                Education
              </h3>
              <div className="space-y-5">
                {sections.education.map((edu, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium text-sm text-neutral-800">
                        {edu.degree}
                      </span>
                      <span className="text-[11px] text-neutral-400 font-light">
                        {edu.years}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 font-light mt-0.5">
                      {edu.institution}
                      {edu.fieldOfStudy ? ` — ${edu.fieldOfStudy}` : ''}
                    </p>
                    {edu.grade && (
                      <p className="text-xs text-neutral-500 font-light mt-0.5">
                        Grade: {edu.grade}
                      </p>
                    )}
                    {edu.description && (
                      <p className="text-sm mt-1.5 leading-relaxed font-light text-neutral-600">
                        {edu.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.projects.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-4">
                Projects
              </h3>
              <div className="space-y-4">
                {sections.projects.map((proj, i) => (
                  <div key={i}>
                    <div className="flex items-baseline gap-3">
                      <span className="font-medium text-sm text-neutral-800">
                        {proj.title}
                      </span>
                      {proj.isCurrent && (
                        <span className="text-[10px] text-neutral-400 italic font-light">
                          current
                        </span>
                      )}
                    </div>
                    {proj.description && (
                      <p className="text-sm mt-1 leading-relaxed font-light text-neutral-600">
                        {proj.description}
                      </p>
                    )}
                    {proj.externalUrl && (
                      <p className="text-[11px] text-neutral-400 mt-0.5 font-light">
                        {proj.externalUrl}
                      </p>
                    )}
                    {proj.skills.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs font-light text-neutral-500">
                        {proj.skills.map((s, j) => (
                          <span key={j}>{s}</span>
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
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                Publications
              </h3>
              <ul className="space-y-2 text-sm font-light text-neutral-600">
                {sections.publications.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {sections.activities.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                Activities
              </h3>
              <ul className="space-y-2 text-sm font-light text-neutral-600">
                {sections.activities.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {sections.references.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                References
              </h3>
              <div className="space-y-3 text-sm font-light text-neutral-600">
                {sections.references.map((ref, i) => (
                  <div key={i}>
                    <span className="font-medium text-neutral-800">{ref.name}</span>
                    {ref.relationship && (
                      <span className="text-neutral-500"> — {ref.relationship}</span>
                    )}
                    {ref.company && <span className="text-neutral-500"> at {ref.company}</span>}
                    {(ref.email || ref.phone) && (
                      <span className="text-neutral-400">
                        {' '}
                        | {[ref.email, ref.phone].filter(Boolean).join(' | ')}
                      </span>
                    )}
                    {ref.notes && (
                      <p className="text-xs text-neutral-400 mt-0.5">{ref.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.additionalInformation && (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-2">
                Additional Info
              </h3>
              <p className="text-sm leading-relaxed font-light text-neutral-600">
                {sections.additionalInformation}
              </p>
            </div>
          )}

          {sections.signature && (
            <div className="pt-4">
              <p className="text-sm font-light italic text-neutral-500">{sections.signature}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
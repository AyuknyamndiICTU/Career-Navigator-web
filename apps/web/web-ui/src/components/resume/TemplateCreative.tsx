// @ts-nocheck
import React from 'react';
import type { ResumeData } from './types';

interface Props {
  data: ResumeData;
}

export default function TemplateCreative({ data }: Props) {
  const { sections } = data;
  const { header } = sections;

  const hasSidebar =
    sections.skills.length > 0 ||
    sections.languages.length > 0 ||
    sections.interests.length > 0 ||
    sections.achievementsAwards.length > 0 ||
    sections.activities.length > 0;

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-slate-700 font-sans min-h-[297mm] print:shadow-none print:m-0 print:p-0 overflow-hidden">
      {/* Creative Header with angled accent */}
      <div className="relative bg-gradient-to-r from-teal-500 via-teal-600 to-cyan-600 text-white px-10 py-10 overflow-hidden print:from-teal-500 print:via-teal-600 print:to-cyan-600 print:text-white">
        {/* Decorative circles */}
        <div className="absolute top-[-40px] right-[-30px] w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute bottom-[-20px] left-[20%] w-24 h-24 rounded-full bg-white/8" />
        <div className="absolute top-8 right-[40%] w-6 h-6 rounded-full bg-white/20" />

        {/* Photo + name area */}
        <div className="relative z-10 flex items-center gap-6">
          {header.contact.photoUrl && (
            <div className="w-20 h-20 rounded-full border-3 border-white/60 overflow-hidden flex-shrink-0 print:w-20 print:h-20">
              <img src={header.contact.photoUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            {header.fullName ? (
              <h1 className="text-3xl font-black tracking-tight leading-tight">{header.fullName}</h1>
            ) : (
              <h1 className="text-3xl font-black tracking-tight leading-tight text-white/50">Your Name</h1>
            )}
            {header.headline ? (
              <p className="mt-1 text-teal-100 text-lg font-light tracking-wide">{header.headline}</p>
            ) : (
              <p className="mt-1 text-teal-200/60 text-lg font-light tracking-wide italic">Creative Professional</p>
            )}
          </div>
        </div>

        {/* Contact tags */}
        <div className="relative z-10 mt-5 flex flex-wrap gap-2">
          {header.contact.email && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm">
              &#9993; {header.contact.email}
            </span>
          )}
          {header.contact.phone && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm">
              &#9742; {header.contact.phone}
            </span>
          )}
          {header.contact.location && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm">
              &#9906; {header.contact.location}
            </span>
          )}
          {header.contact.website && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm">
              &#127760; {header.contact.website}
            </span>
          )}
          {header.contact.linkedIn && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm">
              in {header.contact.linkedIn}
            </span>
          )}
        </div>

        {/* Angled bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" style={{ clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }} />
      </div>

      <div className={`px-8 py-8 ${hasSidebar ? 'grid grid-cols-5 gap-6' : ''}`}>
        {/* Sidebar */}
        {hasSidebar && (
          <div className="col-span-2 space-y-6 pr-4 border-r-2 border-dashed border-teal-100 print:border-r-2 print:border-dashed print:border-teal-100">
            {sections.skills.length > 0 && (
              <div>
                <h3 className="inline-block text-xs font-black uppercase tracking-widest text-teal-600 mb-3 px-3 py-1 bg-teal-50 rounded-full">
                  Skills
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {sections.skills.map((s, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-gradient-to-br from-teal-50 to-cyan-50 text-teal-700 rounded-lg text-xs font-medium border border-teal-100 hover:shadow-sm transition-shadow"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {sections.languages.length > 0 && (
              <div>
                <h3 className="inline-block text-xs font-black uppercase tracking-widest text-cyan-600 mb-3 px-3 py-1 bg-cyan-50 rounded-full">
                  Languages
                </h3>
                <ul className="space-y-1.5 mt-2">
                  {sections.languages.map((l, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sections.interests.length > 0 && (
              <div>
                <h3 className="inline-block text-xs font-black uppercase tracking-widest text-teal-600 mb-3 px-3 py-1 bg-teal-50 rounded-full">
                  Interests
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {sections.interests.map((s, i) => (
                    <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {sections.achievementsAwards.length > 0 && (
              <div>
                <h3 className="inline-block text-xs font-black uppercase tracking-widest text-amber-600 mb-3 px-3 py-1 bg-amber-50 rounded-full">
                  Achievements
                </h3>
                <ul className="space-y-2 mt-2">
                  {sections.achievementsAwards.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">&#9733;</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sections.activities.length > 0 && (
              <div>
                <h3 className="inline-block text-xs font-black uppercase tracking-widest text-purple-600 mb-3 px-3 py-1 bg-purple-50 rounded-full">
                  Activities
                </h3>
                <ul className="space-y-1.5 mt-2">
                  {sections.activities.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className={hasSidebar ? 'col-span-3 space-y-6' : 'space-y-6'}>
          {sections.summary && (
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-2 flex items-center gap-2">
                <span className="w-8 h-1 bg-teal-500 rounded-full inline-block" />
                About Me
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 bg-teal-50/50 p-4 rounded-xl border border-teal-50">
                {sections.summary}
              </p>
            </div>
          )}

          {sections.objective && (
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-2 flex items-center gap-2">
                <span className="w-8 h-1 bg-teal-500 rounded-full inline-block" />
                Objective
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 bg-teal-50/50 p-4 rounded-xl border border-teal-50">
                {sections.objective}
              </p>
            </div>
          )}

          {sections.experience.length > 0 && (
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-8 h-1 bg-teal-500 rounded-full inline-block" />
                Experience
              </h3>
              <div className="space-y-4">
                {sections.experience.map((exp, i) => (
                  <div key={i} className="relative pl-5 border-l-2 border-teal-200 pb-4 last:pb-0">
                    {/* Timeline dot */}
                    <div className="absolute top-1.5 left-[-5px] w-2.5 h-2.5 rounded-full bg-teal-500 border-2 border-white shadow-sm" />
                    <div className="flex justify-between items-baseline flex-wrap gap-x-3">
                      <span className="font-bold text-slate-800">{exp.jobTitle || 'Job Title'}</span>
                      <span className="text-xs text-teal-600 font-semibold bg-teal-50 px-2 py-0.5 rounded-full">
                        {exp.years}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {exp.company}
                      {exp.location ? ` · ${exp.location}` : ''}
                    </p>
                    {exp.description && (
                      <p className="text-sm mt-1.5 text-slate-600 leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.education.length > 0 && (
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-8 h-1 bg-teal-500 rounded-full inline-block" />
                Education
              </h3>
              <div className="space-y-4">
                {sections.education.map((edu, i) => (
                  <div key={i} className="relative pl-5 border-l-2 border-cyan-200 pb-4 last:pb-0">
                    <div className="absolute top-1.5 left-[-5px] w-2.5 h-2.5 rounded-full bg-cyan-500 border-2 border-white shadow-sm" />
                    <div className="flex justify-between items-baseline flex-wrap gap-x-3">
                      <span className="font-bold text-slate-800">{edu.degree || 'Degree'}</span>
                      <span className="text-xs text-cyan-600 font-semibold bg-cyan-50 px-2 py-0.5 rounded-full">
                        {edu.years}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {edu.institution}
                      {edu.fieldOfStudy ? ` · ${edu.fieldOfStudy}` : ''}
                    </p>
                    {edu.grade && (
                      <p className="text-sm text-slate-500 mt-0.5">Grade: {edu.grade}</p>
                    )}
                    {edu.description && (
                      <p className="text-sm mt-1 text-slate-600 leading-relaxed">{edu.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.projects.length > 0 && (
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-8 h-1 bg-teal-500 rounded-full inline-block" />
                Projects
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {sections.projects.map((proj, i) => (
                  <div key={i} className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-200 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800">{proj.title || 'Project'}</span>
                      {proj.isCurrent && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    {proj.description && (
                      <p className="text-sm text-slate-600 leading-relaxed">{proj.description}</p>
                    )}
                    {proj.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {proj.skills.map((s, j) => (
                          <span key={j} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {proj.externalUrl && (
                      <a
                        href={proj.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs text-teal-600 underline"
                      >
                        View Project &#8599;
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.publications.length > 0 && (
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-2 flex items-center gap-2">
                <span className="w-8 h-1 bg-teal-500 rounded-full inline-block" />
                Publications
              </h3>
              <ul className="space-y-2">
                {sections.publications.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-teal-400 mt-0.5 flex-shrink-0">&#128196;</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sections.references.length > 0 && (
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-8 h-1 bg-teal-500 rounded-full inline-block" />
                References
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sections.references.map((ref, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="font-bold text-sm text-slate-800">{ref.name || 'Reference'}</p>
                    {ref.relationship && (
                      <p className="text-xs text-teal-600 font-medium">{ref.relationship}</p>
                    )}
                    {ref.company && <p className="text-xs text-slate-500">{ref.company}</p>}
                    <div className="mt-1.5 text-xs text-slate-500 space-y-0.5">
                      {ref.email && <p className="break-all">{ref.email}</p>}
                      {ref.phone && <p>{ref.phone}</p>}
                    </div>
                    {ref.notes && (
                      <p className="mt-1 text-xs text-slate-400 italic">{ref.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sections.additionalInformation && (
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-2 flex items-center gap-2">
                <span className="w-8 h-1 bg-teal-500 rounded-full inline-block" />
                Additional Info
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{sections.additionalInformation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Signature */}
      {sections.signature && (
        <div className="px-8 pb-8 text-right">
          <p className="text-sm italic text-slate-500">— {sections.signature}</p>
        </div>
      )}
    </div>
  );
}
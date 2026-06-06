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
    <div className="max-w-[210mm] mx-auto bg-white text-slate-700 font-sans flex min-h-[297mm] print:shadow-none print:m-0 print:p-0 print:flex">
      {/* Left Sidebar */}
      <div className="w-[35%] bg-gradient-to-b from-violet-600 to-indigo-700 text-white px-8 py-10 flex flex-col gap-6 print:from-violet-600 print:to-indigo-700 print:text-white">
        {header.contact.photoUrl && (
          <div className="w-24 h-24 rounded-full bg-white/20 mx-auto overflow-hidden border-2 border-white/30">
            <img src={header.contact.photoUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {header.fullName ? (
          <h1 className="text-2xl font-extrabold text-center leading-tight">{header.fullName}</h1>
        ) : (
          <h1 className="text-2xl font-extrabold text-center leading-tight text-white/50">Your Name</h1>
        )}
        {header.headline ? (
          <p className="text-sm text-center text-indigo-200 -mt-4">{header.headline}</p>
        ) : (
          <p className="text-sm text-center text-indigo-300/60 -mt-4 italic">Professional Title</p>
        )}

        {/* Contact */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3 border-b border-indigo-400/50 pb-1">
            Contact
          </h3>
          <div className="space-y-2 text-sm">
            {header.contact.email && <p className="break-all">{header.contact.email}</p>}
            {header.contact.phone && <p>{header.contact.phone}</p>}
            {header.contact.location && <p>{header.contact.location}</p>}
            {header.contact.website && <p className="break-all">{header.contact.website}</p>}
            {header.contact.linkedIn && <p className="break-all">{header.contact.linkedIn}</p>}
            {header.contact.address && <p>{header.contact.address}</p>}
          </div>
        </div>

        {/* Skills */}
        {sections.skills.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3 border-b border-indigo-400/50 pb-1">
              Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {sections.skills.map((s, i) => (
                <span key={i} className="px-3 py-1.5 bg-white/15 rounded-full text-xs font-medium hover:bg-white/25 transition-colors">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {sections.languages.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3 border-b border-indigo-400/50 pb-1">
              Languages
            </h3>
            <ul className="space-y-1 text-sm">
              {sections.languages.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Interests */}
        {sections.interests.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3 border-b border-indigo-400/50 pb-1">
              Interests
            </h3>
            <ul className="space-y-1 text-sm">
              {sections.interests.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Achievements */}
        {sections.achievementsAwards.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-3 border-b border-indigo-400/50 pb-1">
              Achievements
            </h3>
            <ul className="space-y-1 text-sm">
              {sections.achievementsAwards.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Right Content */}
      <div className="w-[65%] px-8 py-10 space-y-6 bg-white print:bg-white">
        {sections.summary && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-2 border-b border-indigo-200 pb-1">
              About Me
            </h3>
            <p className="text-sm leading-relaxed">{sections.summary}</p>
          </div>
        )}

        {sections.objective && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-2 border-b border-indigo-200 pb-1">
              Career Objective
            </h3>
            <p className="text-sm leading-relaxed">{sections.objective}</p>
          </div>
        )}

        {sections.experience.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-3 border-b border-indigo-200 pb-1">
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
                    <p className="text-sm mt-1 text-slate-600 leading-relaxed">{exp.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.education.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-3 border-b border-indigo-200 pb-1">
              Education
            </h3>
            <div className="space-y-4">
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
                    <p className="text-sm mt-1 text-slate-600">{edu.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.projects.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-3 border-b border-indigo-200 pb-1">
              Projects
            </h3>
            <div className="space-y-3">
              {sections.projects.map((proj, i) => (
                <div key={i}>
                  <span className="font-bold text-slate-800">{proj.title}</span>
                  {proj.description && (
                    <p className="text-sm mt-1 text-slate-600">{proj.description}</p>
                  )}
                  {proj.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {proj.skills.map((s, j) => (
                        <span key={j} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
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

        {sections.references.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-2 border-b border-indigo-200 pb-1">
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
      </div>
    </div>
  );
}

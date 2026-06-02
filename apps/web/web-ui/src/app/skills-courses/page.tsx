/* eslint-disable no-undef */
// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

const skillCategories = [
  {
    name: 'Technical',
    color: 'from-blue-500 to-cyan-400',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  {
    name: 'Leadership',
    color: 'from-purple-500 to-pink-400',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  {
    name: 'Communication',
    color: 'from-emerald-500 to-teal-400',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  {
    name: 'Problem Solving',
    color: 'from-amber-500 to-orange-400',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  {
    name: 'Creativity',
    color: 'from-pink-500 to-rose-400',
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
  },
  {
    name: 'Analytical',
    color: 'from-indigo-500 to-violet-400',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
];

const platformIcons: Record<string, string> = {
  coursera: '🎓',
  edx: '📚',
  udemy: '🎯',
  linkedin: '💼',
  simplilearn: '🚀',
  alison: '✨',
  freecodecamp: '💻',
};

function getPlatformIcon(text: string): string {
  const lower = (text ?? '').toLowerCase();
  for (const [key, icon] of Object.entries(platformIcons)) {
    if (lower.includes(key)) return icon;
  }
  return '📖';
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

const chipVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

function parseRecommendations(text: string): string[] {
  // Split by numbered items or bullet points
  const lines = text.split('\n').filter((l) => l.trim());
  const items: string[] = [];
  let current = '';

  for (const line of lines) {
    // Avoid unnecessary escape chars inside character classes.
    const isNewItem = /^(\d+[.)]\s|[-•*]\s|\*\*\d+)/.test(line.trim());
    if (isNewItem && current) {
      items.push(current.trim());
      current = line;
    } else {
      current += '\n' + line;
    }
  }
  if (current.trim()) items.push(current.trim());

  return items.length > 1 ? items : [text];
}

type CourseCard = {
  platform: string;
  courseName: string;
  difficulty: string;
  description: string;
  externalUrl: string;
  whyRecommended: string;
};

function normalizeCourseCards(value: unknown): CourseCard[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => item as Record<string, unknown>)
    .map((course) => ({
      platform: typeof course.platform === 'string' ? course.platform : '',
      courseName:
        typeof course.courseName === 'string'
          ? course.courseName
          : typeof course.title === 'string'
            ? course.title
            : '',
      difficulty:
        typeof course.difficulty === 'string' ? course.difficulty : '',
      description:
        typeof course.description === 'string' ? course.description : '',
      externalUrl:
        typeof course.externalUrl === 'string' ? course.externalUrl : '',
      whyRecommended:
        typeof course.whyRecommended === 'string'
          ? course.whyRecommended
          : '',
    }))
    .filter((course) => course.courseName.trim().length > 0);
}

function jsonTextFromAiResponse(text: string): string | null {
  const stripped = text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  const startObject = stripped.indexOf('{');
  const endObject = stripped.lastIndexOf('}');
  if (startObject !== -1 && endObject > startObject) {
    return stripped.slice(startObject, endObject + 1);
  }

  const startArray = stripped.indexOf('[');
  const endArray = stripped.lastIndexOf(']');
  if (startArray !== -1 && endArray > startArray) {
    return stripped.slice(startArray, endArray + 1);
  }

  return null;
}

function courseCardsFromResponseText(text: unknown): CourseCard[] {
  if (typeof text !== 'string' || !text.trim()) return [];

  const jsonText = jsonTextFromAiResponse(text);
  if (!jsonText) return [];

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (Array.isArray(parsed)) return normalizeCourseCards(parsed);
    if (parsed && typeof parsed === 'object') {
      return normalizeCourseCards((parsed as Record<string, unknown>).courses);
    }
  } catch {
    return [];
  }

  return [];
}

function isJsonLikeText(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('```') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    trimmed.includes('"courses"')
  );
}

export default function SkillsCoursesPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [courseRecommendations, setCourseRecommendations] = useState<CourseCard[]>([]);
  const [allowedSkills, setAllowedSkills] = useState<string[]>([]);
  const [studentGoal, setStudentGoal] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadRecommendations(goal?: string) {
    setBusy(true);
    setError('');
    setCourseRecommendations([]);
    setRecommendations([]);

    try {
      const body: Record<string, unknown> = {};
      if (goal?.trim()) body.studentGoal = goal.trim();

      const res = (await apiFetch('/ai/course-recommendations', {
        method: 'POST',
        body,
      })) as {
        response?: string;
        allowedSkills?: string[];
        courses?: Array<{
          courseName?: string;
          platform?: string;
          difficulty?: string;
          description?: string;
          externalUrl?: string;
          whyRecommended?: string;
        }>;
      };

      if (res?.allowedSkills) setAllowedSkills(res.allowedSkills);

      const structuredCourses = normalizeCourseCards(res?.courses);
      const textCourses = courseCardsFromResponseText(res?.response);
      const mapped = structuredCourses.length > 0 ? structuredCourses : textCourses;

      if (mapped.length > 0) {
        setCourseRecommendations(mapped);
      } else if (typeof res?.response === 'string' && res.response.trim().length > 0) {
        setRecommendations(
          isJsonLikeText(res.response) ? [] : parseRecommendations(res.response),
        );
      }

      setHasLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadRecommendations();
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-8 md:p-10"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 30%, #a855f7 60%, #d946ef 100%)',
          }}
        >
          <div className="relative z-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-xs font-semibold mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI-Powered Recommendations
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Skills & Courses
            </h1>
            <p className="mt-3 text-white/70 text-sm md:text-base leading-relaxed max-w-lg">
              Discover personalized learning paths and courses tailored to your career goals. Our AI analyzes your profile to recommend the most impactful skills to develop.
            </p>

            {/* Goal Input */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={studentGoal}
                  onChange={(e) => setStudentGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadRecommendations(studentGoal)}
                  placeholder="Enter your career goal (e.g., become a data scientist)..."
                  className="w-full pl-10 pr-4 py-3 bg-white/15 backdrop-blur-sm rounded-xl text-sm text-white placeholder-white/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all"
                />
              </div>
              <button
                onClick={() => loadRecommendations(studentGoal)}
                disabled={busy}
                className="px-6 py-3 bg-white text-purple-600 rounded-xl text-sm font-bold hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
              >
                {busy ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Get Recommendations
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute -right-8 -bottom-20 w-48 h-48 bg-white/5 rounded-full" />
          <div className="absolute right-32 top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <div className="absolute left-1/2 -bottom-8 w-32 h-32 bg-pink-400/20 rounded-full blur-2xl" />
        </motion.div>

        {/* Your Skills */}
        {allowedSkills.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-indigo-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Your Career Skills</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {allowedSkills.map((skill, i) => {
                const cat = skillCategories[i % skillCategories.length];
                return (
                  <motion.span
                    key={skill}
                    custom={i}
                    variants={chipVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={{ scale: 1.05, y: -2 }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold ${cat.bg} ${cat.text} border ${cat.border} cursor-default transition-shadow hover:shadow-md`}
                  >
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${cat.color}`} />
                    {skill}
                  </motion.span>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Skill Categories */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Explore Skill Categories</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {skillCategories.map((cat) => (
              <motion.div
                key={cat.name}
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-white rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer border border-surface-border group"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center shadow-soft mb-3 group-hover:scale-110 transition-transform`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="text-sm font-semibold text-slate-700">{cat.name}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Error */}
        <ErrorAlert error={error} />

        {/* Recommendations */}
        <AnimatePresence mode="wait">
          {busy && !hasLoaded ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg animate-pulse">
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-700">Generating Recommendations</h3>
              <p className="mt-1 text-sm text-slate-500">Our AI is analyzing your career profile...</p>
            </motion.div>
          ) : courseRecommendations.length > 0 ? (
            <motion.div
              key="courses"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">Recommended Courses</h2>
                </div>
                {busy && (
                  <div className="flex items-center gap-2 text-xs text-primary-600 font-medium">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Refreshing...
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {courseRecommendations.map((course, i) => (
                  <motion.div
                    key={`${course.courseName}-${i}`}
                    variants={itemVariants}
                    whileHover={{ y: -3 }}
                    className="group bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-300 border border-surface-border relative overflow-hidden"
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${skillCategories[i % skillCategories.length].color} opacity-80`} />

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5 text-2xl">
                        {getPlatformIcon(course.platform || course.courseName)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-700 font-semibold leading-relaxed">
                          {course.courseName}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {course.platform ? `${course.platform}` : 'Course Platform'}
                          {course.difficulty ? ` • ${course.difficulty}` : ''}
                        </div>

                        {course.description ? (
                          <div className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {course.description}
                          </div>
                        ) : null}

                        {course.whyRecommended ? (
                          <div className="mt-2 text-xs text-slate-500 leading-relaxed">
                            <span className="font-semibold text-slate-600">Why:</span> {course.whyRecommended}
                          </div>
                        ) : null}

                        {course.externalUrl ? (
                          <a
                            href={course.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-purple-700 hover:text-purple-800 underline underline-offset-2"
                          >
                            Visit Course
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7v7m0-7L10 14" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14a2 2 0 0 0 2-2V9" />
                            </svg>
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-br from-primary-50/0 to-purple-50/0 group-hover:from-primary-50/30 group-hover:to-purple-50/30 transition-all duration-500 pointer-events-none rounded-2xl" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : recommendations.length > 0 ? (
            <motion.div
              key="results"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">Recommended Courses</h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {recommendations.map((rec, i) => (
                  <motion.div
                    key={i}
                    variants={itemVariants}
                    whileHover={{ y: -3 }}
                    className="group bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-300 border border-surface-border relative overflow-hidden"
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${skillCategories[i % skillCategories.length].color} opacity-80`} />

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5 text-2xl">
                        {getPlatformIcon(rec)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {rec
                            .replace(/^[\d.)*\-•]\s*/, '')
                            .replace(/^\*\*[\d]+\.\s*/, '')}
                        </div>
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-br from-primary-50/0 to-purple-50/0 group-hover:from-primary-50/30 group-hover:to-purple-50/30 transition-all duration-500 pointer-events-none rounded-2xl" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : hasLoaded && !busy ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-700">No Recommendations Yet</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-sm">
                Enter a career goal above and click "Get Recommendations" to receive AI-powered course suggestions.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Quick Tips Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Learning Tips</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Set Clear Goals',
                desc: 'Define specific, measurable learning objectives. Focus on skills that align with your target role.',
                gradient: 'from-blue-500 to-cyan-500',
                icon: '🎯',
              },
              {
                title: 'Practice Daily',
                desc: 'Consistency beats intensity. Even 30 minutes of daily practice will compound into significant growth.',
                gradient: 'from-emerald-500 to-teal-500',
                icon: '⚡',
              },
              {
                title: 'Build Projects',
                desc: 'Apply what you learn by building real projects. Employers value practical experience over certificates.',
                gradient: 'from-purple-500 to-pink-500',
                icon: '🛠️',
              },
            ].map((tip, i) => (
              <motion.div
                key={tip.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -3 }}
                className="bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-300 border border-surface-border"
              >
                <div className="text-3xl mb-3">{tip.icon}</div>
                <h3 className="text-sm font-bold text-slate-800">{tip.title}</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{tip.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

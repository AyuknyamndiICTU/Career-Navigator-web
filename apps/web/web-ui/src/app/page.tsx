'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';

const features = [
  {
    title: 'AI Career Chat',
    description: 'Get career-path guidance from our AI assistant. Ask about your next step, skill gaps, and more.',
    href: '/ai/chat',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    gradient: 'from-violet-500 to-purple-600',
    bgLight: 'bg-violet-50',
  },
  {
    title: 'Job Board',
    description: 'Browse jobs, apply with cover letters, and get AI-powered recommendations.',
    href: '/jobs',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.193 23.193 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    gradient: 'from-blue-500 to-cyan-500',
    bgLight: 'bg-blue-50',
  },
  {
    title: 'Mentor Matching',
    description: 'Connect with mentors who match your skills and career interests.',
    href: '/mentors',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    gradient: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50',
  },
  {
    title: 'Video Sessions',
    description: 'Join live video calls with mentors and career advisors via Agora.',
    href: '/agora',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    gradient: 'from-pink-500 to-rose-500',
    bgLight: 'bg-pink-50',
  },
  {
    title: 'Resume Builder',
    description: 'Build structured resumes and scan your CV with AI extraction.',
    href: '/resume',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    gradient: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50',
  },
  {
    title: 'Admin Analytics',
    description: 'View engagement metrics and manage users and feedback.',
    href: '/admin/analytics',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    gradient: 'from-indigo-500 to-blue-600',
    bgLight: 'bg-indigo-50',
  },
];

type Stat = {
  label: string;
  value: string;
  color: string;
  bg: string;
  icon: ReactNode;
};

const defaultStats: Stat[] = [
  { label: 'Active Jobs', value: '—', color: 'text-blue-600', bg: 'bg-blue-50', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.193 23.193 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )},
  { label: 'Mentors', value: '120+', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { label: 'AI Chats', value: '10K+', color: 'text-violet-600', bg: 'bg-violet-50', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  )},
  { label: 'Users', value: '2K+', color: 'text-amber-600', bg: 'bg-amber-50', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )},
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function Home() {
  const [stats, setStats] = useState<Stat[]>(defaultStats);

  function formatKpi(value: number | null | undefined): string {
    if (!Number.isFinite(value as number)) return '—';
    const n = Number(value);

    if (n >= 1000) return `${Math.round(n / 1000)}K+`;
    return `${Math.max(0, n)}+`;
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = (await apiFetch('/admin/analytics/dashboard', {
          method: 'GET',
        })) as {
          activeJobs?: number;
          totalMentors?: number;
          aiChats?: number;
          totalUsers?: number;
        };

        if (!mounted) return;

        setStats((prev) =>
          prev.map((s) => {
            if (s.label === 'Active Jobs')
              return { ...s, value: formatKpi(res.activeJobs) };
            if (s.label === 'Mentors')
              return { ...s, value: formatKpi(res.totalMentors) };
            if (s.label === 'AI Chats')
              return { ...s, value: formatKpi(res.aiChats) };
            if (s.label === 'Users')
              return { ...s, value: formatKpi(res.totalUsers) };
            return s;
          }),
        );
      } catch {
        // If the endpoint is protected and no token exists, keep placeholders.
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-400 p-8 text-white"
        >
          <div className="relative z-10 max-w-lg">
            <h1 className="text-3xl font-bold leading-tight">
              Welcome to Career Navigator!
            </h1>
            <p className="mt-3 text-white/80 text-sm leading-relaxed">
              AI-powered career guidance, job matching, mentor connections, resume building, and video coaching — all in one platform. Let&apos;s get started!
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/auth/register"
                className="inline-flex items-center px-5 py-2.5 bg-white text-primary-600 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors shadow-soft"
              >
                Get Started Free
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center px-5 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold hover:bg-white/25 transition-colors backdrop-blur-sm"
              >
                Sign In
              </Link>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -right-4 -bottom-10 w-32 h-32 bg-white/5 rounded-full" />
          <div className="absolute right-28 top-4 w-20 h-20 bg-white/10 rounded-full" />
        </motion.div>

        {/* Stats Row */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className="bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow duration-300"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                  {stat.icon}
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                  <div className="text-xs text-slate-500 font-medium">{stat.label}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-800">Everything You Need</h2>
            <p className="mt-1 text-sm text-slate-500">
              One platform. All the career tools.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <motion.div key={feature.title} variants={itemVariants}>
                <Link href={feature.href} className="group block">
                  <div className="bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-300 group-hover:-translate-y-0.5 h-full">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white shadow-soft`}>
                      {feature.icon}
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-800">{feature.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="mt-3 inline-flex items-center text-xs font-semibold text-primary-600 group-hover:gap-2 transition-all">
                      Explore
                      <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-800">How It Works</h2>
            <p className="mt-1 text-sm text-slate-500">Three steps to your dream career</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Create Profile',
                desc: 'Sign up, upload your CV, and let AI extract your skills automatically.',
                gradient: 'from-blue-500 to-indigo-500',
                href: '/auth/register',
              },
              {
                step: '02',
                title: 'Get Matched',
                desc: 'AI matches you with jobs, mentors, and courses tailored to your goals.',
                gradient: 'from-emerald-500 to-teal-500',
                href: '/get-matched',
              },
              {
                step: '03',
                title: 'Level Up',
                desc: 'Chat with AI, join video sessions, and track your career progress.',
                gradient: 'from-violet-500 to-purple-500',
                href: '/level-up',
              },
            ].map((item) => (
              <Link key={item.step} href={item.href} className="block">
                <motion.div
                  variants={itemVariants}
                  className="bg-white rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300"
                >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white text-sm font-bold shadow-soft`}>
                  {item.step}
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-800">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="rounded-2xl bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-500 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute -left-10 -top-10 w-40 h-40 bg-white/5 rounded-full" />
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full" />
            <div className="relative z-10">
              <h2 className="text-2xl font-bold">Ready to Start?</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
                Join thousands of professionals using Career Navigator to find their path. It&apos;s free to get started.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center px-6 py-2.5 bg-white text-primary-600 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors shadow-soft"
                >
                  Sign Up Now
                </Link>
                <Link
                  href="/ai/chat"
                  className="inline-flex items-center px-6 py-2.5 bg-white/15 text-white rounded-xl text-sm font-semibold hover:bg-white/25 transition-colors backdrop-blur-sm"
                >
                  Try AI Chat
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

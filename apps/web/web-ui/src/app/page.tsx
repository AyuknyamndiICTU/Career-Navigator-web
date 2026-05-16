'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const features = [
  {
    title: 'AI Career Chat',
    description: 'Get career-path guidance from our AI assistant. Ask about your next step, skill gaps, and more.',
    href: '/ai/chat',
    icon: '🤖',
    color: 'bg-purple-200',
  },
  {
    title: 'Job Board',
    description: 'Browse jobs, apply with cover letters, and get AI-powered recommendations.',
    href: '/auth/login',
    icon: '💼',
    color: 'bg-blue-200',
  },
  {
    title: 'Mentor Matching',
    description: 'Connect with mentors who match your skills and career interests.',
    href: '/auth/login',
    icon: '🧑‍🏫',
    color: 'bg-green-200',
  },
  {
    title: 'Video Sessions',
    description: 'Join live video calls with mentors and career advisors via Agora.',
    href: '/agora',
    icon: '📹',
    color: 'bg-pink-200',
  },
  {
    title: 'Resume Builder',
    description: 'Build structured resumes and scan your CV with AI extraction.',
    href: '/auth/login',
    icon: '📄',
    color: 'bg-orange-200',
  },
  {
    title: 'Admin Analytics',
    description: 'View engagement metrics and manage users and feedback.',
    href: '/admin/analytics',
    icon: '📊',
    color: 'bg-yellow-200',
  },
];

const stats = [
  { label: 'Active Jobs', value: '500+', icon: '💼' },
  { label: 'Mentors', value: '120+', icon: '🧑‍🏫' },
  { label: 'AI Chats', value: '10K+', icon: '💬' },
  { label: 'Users', value: '2K+', icon: '👥' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function Home() {
  return (
    <main className="min-h-screen pb-12">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="px-4 pt-10 pb-8 text-center"
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-block rounded-xl border-4 border-black bg-yellow-300 px-5 py-2 text-sm font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            🚀 YOUR CAREER STARTS HERE
          </div>
          <h1 className="mt-4 text-5xl font-black leading-tight tracking-tight md:text-6xl">
            Navigate Your
            <span className="relative mx-2 inline-block">
              <span className="relative z-10">Career</span>
              <span className="absolute bottom-1 left-0 -z-0 h-4 w-full bg-yellow-300/70"></span>
            </span>
            Path
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg font-bold opacity-70">
            AI-powered career guidance, job matching, mentor connections, resume building, and video coaching — all in one brutally good platform.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="rounded-xl border-4 border-black bg-yellow-300 px-8 py-3 text-sm font-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-[2px] active:translate-y-[0px]"
            >
              GET STARTED FREE
            </Link>
            <Link
              href="/auth/login"
              className="rounded-xl border-4 border-black bg-white px-8 py-3 text-sm font-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-[2px] active:translate-y-[0px]"
            >
              SIGN IN
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Stats Row */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mx-auto grid max-w-4xl grid-cols-2 gap-4 px-4 md:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            className="rounded-xl border-3 border-black bg-white p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="text-2xl">{stat.icon}</div>
            <div className="mt-1 text-2xl font-black">{stat.value}</div>
            <div className="text-xs font-bold opacity-60">{stat.label}</div>
          </motion.div>
        ))}
      </motion.section>

      {/* Features Grid */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="mx-auto mt-12 max-w-5xl px-4"
      >
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-black">EVERYTHING YOU NEED</h2>
          <p className="mt-1 text-sm font-bold opacity-60">
            One platform. All the career tools. No fluff.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <motion.div key={feature.title} variants={itemVariants}>
              <Link href={feature.href} className="group block">
                <div
                  className={`rounded-xl border-4 border-black ${feature.color} p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 group-hover:-translate-y-[3px] group-hover:shadow-[7px_7px_0px_0px_rgba(0,0,0,1)]`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border-3 border-black bg-white text-2xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {feature.icon}
                  </div>
                  <h3 className="mt-3 text-lg font-black">{feature.title}</h3>
                  <p className="mt-1 text-sm font-bold leading-snug opacity-70">
                    {feature.description}
                  </p>
                  <div className="mt-3 inline-flex items-center text-xs font-black opacity-80">
                    EXPLORE →
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* How It Works */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="mx-auto mt-16 max-w-4xl px-4"
      >
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black">HOW IT WORKS</h2>
          <p className="mt-1 text-sm font-bold opacity-60">Three steps to your dream career</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Create Profile',
              desc: 'Sign up, upload your CV, and let AI extract your skills automatically.',
              bg: 'bg-blue-100',
            },
            {
              step: '02',
              title: 'Get Matched',
              desc: 'AI matches you with jobs, mentors, and courses tailored to your goals.',
              bg: 'bg-green-100',
            },
            {
              step: '03',
              title: 'Level Up',
              desc: 'Chat with AI, join video sessions, and track your career progress.',
              bg: 'bg-purple-100',
            },
          ].map((item) => (
            <motion.div
              key={item.step}
              variants={itemVariants}
              className={`rounded-xl border-4 border-black ${item.bg} p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border-3 border-black bg-black text-sm font-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                {item.step}
              </div>
              <h3 className="mt-3 text-lg font-black">{item.title}</h3>
              <p className="mt-1 text-sm font-bold leading-snug opacity-70">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA */}
      <motion.section
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="mx-auto mt-16 max-w-3xl px-4"
      >
        <div className="rounded-2xl border-4 border-black bg-black p-8 text-center text-white shadow-[8px_8px_0px_0px_rgba(250,204,21,1)]">
          <h2 className="text-3xl font-black">READY TO START?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-bold opacity-70">
            Join thousands of professionals using Career Navigator to find their path. It&apos;s free to get started.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/auth/register"
              className="rounded-xl border-4 border-yellow-300 bg-yellow-300 px-8 py-3 text-sm font-black text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] transition-transform hover:-translate-y-[2px]"
            >
              SIGN UP NOW
            </Link>
            <Link
              href="/ai/chat"
              className="rounded-xl border-4 border-white/30 bg-white/10 px-8 py-3 text-sm font-black text-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] transition-transform hover:-translate-y-[2px]"
            >
              TRY AI CHAT
            </Link>
          </div>
        </div>
      </motion.section>
    </main>
  );
}

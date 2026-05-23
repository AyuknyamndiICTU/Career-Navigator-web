import Link from 'next/link';

export default function RecommendedSkillsCard() {
  return (
    <div className="px-3 mb-2">
      <Link href="/skills-courses" className="block group">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 overflow-hidden relative transition-all duration-300 hover:border-indigo-500/40 hover:from-indigo-500/20 hover:to-purple-500/20">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-soft">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-white">Skill Analysis</div>
            </div>
            
            <p className="text-xs text-white/70 leading-relaxed mb-2">
              Discover courses and skills tailored to your career goals.
            </p>

            <div className="inline-flex items-center text-[11px] font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">
              Explore Recommendations
              <svg className="w-3 h-3 ml-1 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Decorative shine */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shine_1.5s_ease-in-out_infinite]" />
        </div>
      </Link>
    </div>
  );
}

'use client';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: number;
}

export default function StatsCard({ title, value, icon, trend }: StatsCardProps) {
  return (
    <div className="card-pop float-in relative overflow-hidden rounded-2xl border border-blue-100 bg-white/95 p-4 shadow-sm md:p-6">
      <svg
        className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 opacity-60"
        viewBox="0 0 120 120"
        fill="none"
      >
        <path d="M60 12L72 43L104 45L79 66L87 98L60 80L33 98L41 66L16 45L48 43L60 12Z" fill="#FFE08A" />
      </svg>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-600">{title}</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-900 md:text-3xl">{value}</p>
          {typeof trend === 'number' && (
            <p className={`mt-1 text-sm font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend > 0 ? '+' : ''}{trend} from last week
            </p>
          )}
        </div>
        <div className="bob rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 p-2.5 text-white shadow-lg shadow-blue-200 md:p-3">
          {icon}
        </div>
      </div>
    </div>
  );
}

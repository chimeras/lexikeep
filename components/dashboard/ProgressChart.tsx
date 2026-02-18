'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const data = [
  { date: 'Mon', words: 5, expressions: 2 },
  { date: 'Tue', words: 8, expressions: 4 },
  { date: 'Wed', words: 12, expressions: 5 },
  { date: 'Thu', words: 7, expressions: 3 },
  { date: 'Fri', words: 15, expressions: 7 },
  { date: 'Sat', words: 10, expressions: 4 },
  { date: 'Sun', words: 18, expressions: 9 },
];

export default function ProgressChart() {
  return (
    <div className="rounded-xl bg-white p-4 shadow-lg md:p-6">
      <h2 className="mb-4 text-lg font-bold text-gray-900 md:mb-6 md:text-xl">Weekly Progress</h2>

      <div className="h-56 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="words"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="Words Collected"
            />
            <Line
              type="monotone"
              dataKey="expressions"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="Expressions Collected"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-center md:mt-6 md:gap-8">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 md:text-3xl">85</div>
          <div className="text-xs text-gray-600 md:text-base">Total Words</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 md:text-3xl">42</div>
          <div className="text-xs text-gray-600 md:text-base">Total Expressions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-violet-600 md:text-3xl">1270</div>
          <div className="text-xs text-gray-600 md:text-base">Total Points</div>
        </div>
      </div>
    </div>
  );
}

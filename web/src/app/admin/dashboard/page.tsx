'use client';
// web/src/app/admin/dashboard/page.tsx
import { useEffect, useState } from 'react';
import { Users, ClipboardList, TrendingUp, MessageSquare, Activity } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatCard } from '@/components/shared/StatCard';
import { AdherenceBar } from '@/components/admin/AdherenceBar';
import { WeeklyChart } from '@/components/admin/WeeklyChart';
import { IIFYMBox } from '@/components/admin/IIFYMBox';

interface DashboardData {
  stats: {
    totalPatients: number;
    activePlans: number;
    avgAdherence: number;
    unreadFeedbacks: number;
  };
  recentAdherence: Array<{ patientName: string; pct: number; patientId: string }>;
  weeklyAvg: number[];
  topPatientIifym: {
    name: string; kcal: number; protein: number; carbs: number; fat: number; tdee: number; method: string;
  } | null;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiGet<DashboardData>('/reports/dashboard')
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <AdminLayout title="Dashboard"><DashboardSkeleton /></AdminLayout>;

  const { stats, recentAdherence, weeklyAvg, topPatientIifym } = data ?? {
    stats: { totalPatients: 3, activePlans: 2, avgAdherence: 80, unreadFeedbacks: 3 },
    recentAdherence: [
      { patientName: 'Maria Silva', pct: 82, patientId: '1' },
      { patientName: 'João Costa', pct: 68, patientId: '2' },
      { patientName: 'Ana Ferreira', pct: 91, patientId: '3' },
    ],
    weeklyAvg: [68, 72, 76, 80, 78, 84, 80],
    topPatientIifym: { name: 'Maria Silva', kcal: 1800, protein: 115, carbs: 175, fat: 65, tdee: 2300, method: 'Katch-McArdle (BF=28%)' },
  };

  return (
    <AdminLayout title="Dashboard">
      {/* Saudação */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">
          Olá, {user?.profile?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-gray-500 text-sm mt-1">Aqui está um resumo dos seus pacientes hoje.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users className="w-5 h-5" />} value={stats.totalPatients} label="Pacientes ativos" trend="+1 este mês" trendUp />
        <StatCard icon={<ClipboardList className="w-5 h-5" />} value={stats.activePlans} label="Planos configurados" trend="em andamento" trendUp />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} value={`${stats.avgAdherence}%`} label="Adesão média" trend={stats.avgAdherence >= 75 ? '↑ Boa adesão' : '↓ Atenção'} trendUp={stats.avgAdherence >= 75} />
        <StatCard icon={<MessageSquare className="w-5 h-5" />} value={stats.unreadFeedbacks} label="Feedbacks não lidos" trend="aguardando" trendUp={false} />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adesão */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#3D6B52]" /> Adesão dos pacientes
          </h3>
          <div className="space-y-3">
            {recentAdherence.map((p) => (
              <AdherenceBar key={p.patientId} name={p.patientName} pct={p.pct} />
            ))}
          </div>
          <div className="border-t border-gray-100 mt-4 pt-3 text-sm text-gray-500 flex justify-between">
            <span>Média geral</span>
            <strong className="text-gray-800">{stats.avgAdherence}%</strong>
          </div>
        </div>

        {/* Chart + IIFYM */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Adesão média — 7 dias</h3>
            <WeeklyChart values={weeklyAvg} />
          </div>
          {topPatientIifym && (
            <IIFYMBox
              patientName={topPatientIifym.name}
              kcal={topPatientIifym.kcal}
              protein={topPatientIifym.protein}
              carbs={topPatientIifym.carbs}
              fat={topPatientIifym.fat}
              tdee={topPatientIifym.tdee}
              method={topPatientIifym.method}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-100 rounded-lg w-48 mb-6" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-64 bg-gray-100 rounded-2xl" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );
}

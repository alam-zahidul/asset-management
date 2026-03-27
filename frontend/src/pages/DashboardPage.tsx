import { useQuery } from '@tanstack/react-query';
import { assetApi } from '../services/assets';
import { useAuth } from '../context/AuthContext';
import { Server, Upload, Download, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: assetsData } = useQuery({
    queryKey: ['assets', 'count'],
    queryFn: () => assetApi.list({ page: 1, limit: 1 }),
  });

  const stats = [
    { label: 'Total Assets', value: assetsData?.total ?? '...', icon: Server, color: 'bg-blue-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Welcome, {user?.displayName || user?.username}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/assets"
          className="bg-white rounded-xl shadow-sm p-6 border hover:shadow-md transition-shadow"
        >
          <Server className="h-8 w-8 text-primary-600 mb-3" />
          <h3 className="font-semibold text-gray-900">View Inventory</h3>
          <p className="text-sm text-gray-500 mt-1">Browse and manage server assets</p>
        </Link>

        <Link
          to="/import"
          className="bg-white rounded-xl shadow-sm p-6 border hover:shadow-md transition-shadow"
        >
          <Upload className="h-8 w-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-gray-900">Import Data</h3>
          <p className="text-sm text-gray-500 mt-1">Upload Excel or CSV files</p>
        </Link>

        <Link
          to="/export"
          className="bg-white rounded-xl shadow-sm p-6 border hover:shadow-md transition-shadow"
        >
          <Download className="h-8 w-8 text-purple-600 mb-3" />
          <h3 className="font-semibold text-gray-900">Export Data</h3>
          <p className="text-sm text-gray-500 mt-1">Download in Excel, CSV, or PDF</p>
        </Link>
      </div>
    </div>
  );
}

import { useNavigate, useLocation } from 'react-router-dom';
import { Camera } from 'lucide-react';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    return (
        <div className="bg-white border-t border-slate-200 py-4 px-8 flex justify-center gap-4 sticky bottom-0 z-50">
            <button
                onClick={() => navigate('/analysis')}
                className={`px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${currentPath === '/analysis'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
            >
                <Camera className="w-5 h-5" />
                <span>Video Analysis</span>
            </button>
        </div>
    );
}

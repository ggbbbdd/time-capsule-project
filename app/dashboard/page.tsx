'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter();
  const [capsules, setCapsules] = useState<any[]>([]);
  const [user, setUser] = useState<{name: string, id: string} | null>(null);

  // 로그인 체크 & 데이터 로딩
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');

    // 1. 로그인이 안 되어 있다면 로그인 화면으로 튕겨냄
    if (!token || !userId) {
      router.push('/'); 
      return;
    }
    setUser({ name: username || 'User', id: userId });

    // 2. 내 캡슐 목록 API 호출
    fetch(`/api/capsules?userId=${userId}`)
      .then(res => res.json())
      .then(data => setCapsules(data.capsules || []))
      .catch(err => console.error("데이터 로딩 실패:", err));
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  const handleGoToVerifier = () => {
     router.push('/verifier'); // 새로운 라우트로 이동하도록 설정
     };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 상단 헤더 */}
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm">
          <h1 className="text-xl font-bold text-indigo-800 flex items-center">
            🚀 {user?.name}님의 대시보드
          </h1>
          <button 
            onClick={handleLogout} 
            className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
          >
            로그아웃
          </button>
        </div>

        {/* 생성 버튼 (페이지 이동) */}
        <button 
          onClick={() => router.push('/capsules/create')} 
          className="w-full py-4 mb-8 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 font-bold hover:bg-indigo-50 hover:border-indigo-500 transition-all shadow-sm"
        >
          + 새로운 타임캡슐 봉인하러 가기
        </button>

        {/* 인증자 대시보드 바로가기 버튼 추가 */}
        <button 
               onClick={handleGoToVerifier} 
               className="w-full py-4 border-2 border-dashed border-green-300 rounded-xl text-green-600 font-bold hover:bg-green-50 hover:border-green-500 transition-all shadow-sm flex items-center justify-center space-x-2"
              >
                <UserCheck className="w-5 h-5" />
               <span>인증자 대시보드 확인</span>
           </button>
        

        {/* 리스트 영역 */}
        <h2 className="text-lg font-bold mb-4 text-gray-700">📦 내 캡슐 보관함</h2>
        
        <div className="grid gap-4 md:grid-cols-2">
          {capsules.map((cap) => (
            <div 
              key={cap.capsule_id} 
              onClick={() => router.push(`/capsules/${cap.capsule_id}`)} // 클릭 시 상세 페이지로 이동
              className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 cursor-pointer group"
            >
              <div className="flex justify-between mb-2">
                {/* group-hover: 마우스 올렸을 때 제목 색상 변경 */}
                <h3 className="font-bold text-lg truncate group-hover:text-indigo-600 transition-colors">
                  {cap.title}
                </h3>
                {/* 상태에 따른 뱃지 색상 다르게 표시 */}
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    cap.status === 'sealed' ? 'bg-blue-100 text-blue-700' : 
                    cap.status === 'unlocked' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                }`}>
                    {cap.status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                🔓 개봉 예정: {new Date(cap.unlock_date).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                생성일: {new Date(cap.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
          
          {capsules.length === 0 && (
            <div className="col-span-2 text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              아직 생성된 캡슐이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
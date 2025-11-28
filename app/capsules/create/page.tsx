'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateCapsulePage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [unlockDate, setUnlockDate] = useState('');

  useEffect(() => {
    const storedId = localStorage.getItem('userId');
    if (!storedId) router.push('/');
    setUserId(storedId || '');
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('이대로 봉인하시겠습니까?')) return;

    try {
      const res = await fetch('/api/capsules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: userId,
          title,
          content,
          unlock_date: unlockDate
        }),
      });
      
      if (res.ok) {
        alert('✅ 봉인 완료!');
        router.push('/dashboard'); // 생성 후 목록으로 이동
      } else {
        throw new Error('생성 실패');
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-indigo-700">✨ 타임캡슐 봉인하기</h1>
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800">취소 / 뒤로가기</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
            <input 
              type="text" value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="캡슐의 이름을 지어주세요"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">편지 내용</label>
            <textarea 
              rows={6} value={content} onChange={e => setContent(e.target.value)} required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              placeholder="미래의 나에게 남길 메시지를 적어보세요..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">언제 열까요?</label>
            <input 
              type="date" value={unlockDate} onChange={e => setUnlockDate(e.target.value)} required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md">
            🔒 타임캡슐 봉인하기
          </button>
        </form>
      </div>
    </div>
  );
}
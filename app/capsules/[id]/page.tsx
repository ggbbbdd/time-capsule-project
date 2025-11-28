'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function CapsuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const capsuleId = unwrappedParams.id;

  const [capsule, setCapsule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    setUserId(localStorage.getItem('userId'));
  }, []);

  const fetchCapsuleData = useCallback(() => {
    if (!capsuleId) return;
    fetch(`/api/capsules/${capsuleId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('불러오기 실패');
        return res.json();
      })
      .then((data) => setCapsule(data))
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [capsuleId]);

  useEffect(() => {
    fetchCapsuleData();
  }, [fetchCapsuleData]);

  // 친구 초대
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return alert("이메일을 입력해주세요.");
    try {
      const res = await fetch(`/api/capsules/${capsuleId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail })
      });
      const data = await res.json();
      if (res.ok) { alert(data.message); setInviteEmail(''); fetchCapsuleData(); } 
      else { alert(data.message); }
    } catch (err) { alert("오류 발생"); }
  };

  // 서명 요청
  const handleRequestSign = async () => {
    if (!confirm("서명 요청을 보내시겠습니까?")) return;
    try {
      const res = await fetch(`/api/capsules/${capsuleId}/request-sign`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { alert(data.message); fetchCapsuleData(); }
      else { alert(data.message); }
    } catch (err) { alert("오류 발생"); }
  };

  // 승인/거절
  const handleSign = async (decision: 'approved' | 'rejected') => {
    const action = decision === 'approved' ? '승인' : '거절';
    if (!confirm(`정말 이 캡슐의 봉인을 ${action}하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/capsules/${capsuleId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_id: userId, decision })
      });
      const data = await res.json();
      if (res.ok) { alert(data.message); fetchCapsuleData(); }
      else { alert(data.message); }
    } catch (err) { alert("오류 발생"); }
  };

  // 개봉
  const handleUnlock = async () => {
    if (!confirm("두근두근! 캡슐을 개봉하시겠습니까? 🎉")) return;
    try {
      const res = await fetch(`/api/capsules/${capsuleId}/unlock`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { alert(data.message); fetchCapsuleData(); }
      else { alert(`❌ ${data.message}`); }
    } catch (err) { alert("오류 발생"); }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">로딩 중... ⏳</div>;
  if (!capsule) return null;

  const isOwner = String(capsule.owner_id) === userId;
  const isDraft = capsule.status === 'draft';
  const isPending = capsule.status === 'pending_sign';
  const isSealed = capsule.status === 'sealed';
  
  // 개봉 조건 계산
  const isTimeReached = new Date() >= new Date(capsule.unlock_date);
  const isSignCompleted = capsule.total_signers === 0 || capsule.approved_signers >= capsule.total_signers;
  
  // 🎁 개봉 준비 완료 여부 (봉인됨 + 시간됨 + 서명완료)
  const isReadyToUnlock = isSealed && isTimeReached && isSignCompleted;

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex justify-center">
      <div className="max-w-3xl w-full bg-white rounded-xl shadow-lg p-8 h-fit">
        
        {/* 헤더 */}
        <div className="flex justify-between items-start mb-6 border-b pb-4">
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 
              ${isDraft ? 'bg-gray-200 text-gray-700' : 
                isPending ? 'bg-yellow-100 text-yellow-800' :
                isSealed ? 'bg-blue-100 text-blue-700' : 
                'bg-green-100 text-green-700'}`}>
              {capsule.status.toUpperCase()}
            </span>
            <h1 className="text-3xl font-bold text-gray-900">{capsule.title}</h1>
          </div>
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800">← 뒤로가기</button>
        </div>

        {/* 정보 요약 */}
        <div className="grid grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 rounded-lg text-sm">
          <div>
            <p className="text-gray-500">📅 생성일</p>
            <p className="font-semibold">{new Date(capsule.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-500">👥 서명 현황</p>
            <p className="font-semibold text-indigo-600">
               {capsule.total_signers}명 중 {capsule.approved_signers}명 승인
            </p>
          </div>
        </div>

        {/* 서명 요청 안내 박스 (친구용) */}
        {isPending && !isOwner && (
            <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-xl text-center shadow-sm">
                <h3 className="text-xl font-bold text-yellow-800 mb-2">📝 서명이 필요합니다</h3>
                <p className="text-yellow-700 mb-6">
                    작성자가 당신을 공동 서명자로 초대했습니다.<br/>
                    아래 내용을 꼼꼼히 확인하고, 봉인에 동의하면 승인해주세요.
                </p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => handleSign('rejected')} className="px-6 py-2 border-2 border-red-400 text-red-600 font-bold rounded-lg hover:bg-red-50">거절</button>
                    <button onClick={() => handleSign('approved')} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg">✅ 내용 확인 및 승인</button>
                </div>
            </div>
        )}

        {/* 친구 초대 박스 (작성자용) */}
        {isOwner && isDraft && (
          <div className="mb-8 p-4 border border-indigo-100 bg-indigo-50 rounded-lg">
            <h3 className="font-bold text-indigo-900 mb-2">🤝 공동 서명자 초대</h3>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input 
                type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="친구 이메일 (예: friend@test.com)" className="flex-1 p-2 border border-gray-300 rounded"
              />
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">초대</button>
            </form>
          </div>
        )}

        {/* 본문 영역 */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-700 mb-2">💌 메시지</h3>
          <div className="p-6 border rounded-xl bg-gray-50 min-h-[200px] leading-relaxed whitespace-pre-wrap text-gray-800 relative overflow-hidden">
            
            {/* 🔒 [수정됨] Sealed 상태면 무조건 내용을 가립니다! */}
            {isSealed ? (
               <div className="flex flex-col items-center justify-center h-full py-12 text-center bg-gray-50">
                  {isReadyToUnlock ? (
                     // Case 1: 봉인 해제 가능 (버튼 보여주기)
                     <div className="animate-fade-in">
                        <div className="text-6xl mb-4 animate-bounce">🎁</div>
                        <h3 className="text-2xl font-bold text-indigo-800 mb-2">개봉할 시간이 되었습니다!</h3>
                        <p className="text-indigo-600 mb-8">모든 조건이 충족되었습니다.</p>
                        <button 
                          onClick={handleUnlock}
                          className="px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-full shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all"
                        >
                          ✨ 캡슐 봉인 해제하기
                        </button>
                     </div>
                  ) : (
                     // Case 2: 아직 봉인 중 (자물쇠 보여주기)
                     <div>
                        <div className="text-5xl mb-4 text-gray-400">🔒</div>
                        <h3 className="text-xl font-bold text-gray-600">이 캡슐은 봉인되어 있습니다.</h3>
                        <p className="mt-2 text-sm text-gray-500">
                          <span className="text-indigo-600 font-bold mx-1">
                            {new Date(capsule.unlock_date).toLocaleDateString()}
                          </span>
                          이 되어야 열어볼 수 있습니다.
                        </p>
                        {/* 서명 부족 시 안내 */}
                        {!isSignCompleted && (
                           <p className="mt-2 text-xs text-red-500">
                             (동료 서명 대기 중: {capsule.approved_signers}/{capsule.total_signers}명)
                           </p>
                        )}
                     </div>
                  )}
               </div>
            ) : (
              // 🔓 Sealed가 아니면(Draft, Pending, Unlocked) 내용 표시
              capsule.content
            )}
          </div>
        </div>

        {/* 하단 버튼 영역 */}
        <div className="flex justify-end gap-2">
            {isOwner && isDraft && capsule.total_signers > 0 && (
                <button onClick={handleRequestSign} className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow">✅ 서명 요청하기</button>
            )}
            {/* 개봉 버튼은 이제 본문 중앙으로 이동했으므로 여기서는 제거하거나 유지해도 됨 (중복 방지를 위해 제거함) */}
        </div>
      </div>
    </div>
  );
}
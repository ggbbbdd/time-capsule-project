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

  const [verifierEmailInput, setVerifierEmailInput] = useState<string>('');
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [verifierMessage, setVerifierMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 계승자 관련 state
  const [successorEmailInput, setSuccessorEmailInput] = useState<string>('');
  const [isRequestingSuccessor, setIsRequestingSuccessor] = useState(false);
  const [successorMessage, setSuccessorMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [successorRequests, setSuccessorRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

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
    fetchSuccessorRequests();
  }, [fetchCapsuleData]);

  // 계승 요청 목록 조회
  const fetchSuccessorRequests = useCallback(async () => {
    if (!capsuleId) return;
    setIsLoadingRequests(true);
    try {
      const res = await fetch(`/api/capsules/${capsuleId}/successor/request`);
      const data = await res.json();
      if (res.ok) {
        setSuccessorRequests(data.requests || []);
      }
    } catch (err) {
      console.error("계승 요청 목록 조회 실패:", err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [capsuleId]);

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

  const handleInviteVerifier = async (e: React.FormEvent) => {
        e.preventDefault();

        console.log("현재 capsuleId 값:", capsuleId);
        console.log("현재 verifierEmailInput 값:", verifierEmailInput);
     
        if (!verifierEmailInput) {
          setVerifierMessage({ type: 'error', text: "이메일 주소를 입력해주세요." });
          return;
        }
    
        if (capsule?.status !== 'draft') {
          setVerifierMessage({ type: 'error', text: "❌ 'draft' 상태에서만 역할을 추가할 수 있습니다." });
          return;
        }
    
        setIsAddingRole(true);
        setVerifierMessage(null);
    
        const requestBody = {
          email: verifierEmailInput, // 이메일 사용
        };
    
        try {
          // ⚠️ 새로운 API 엔드포인트 가정: /api/capsules/[id]/verifier
          const res = await fetch(`/api/capsules/${capsuleId}/verifier`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
    
          const data = await res.json();
    
          if (res.ok) {
            setVerifierMessage({ type: 'success', text: data.message || `✅ Verifier (Email: ${verifierEmailInput}) 초대 성공!` });
            setVerifierEmailInput('');
            fetchCapsuleData();
          } else {
            setVerifierMessage({ type: 'error', text: data.message || "❌ 역할 추가에 실패했습니다." });
          }
        } catch (error) {
          setVerifierMessage({ type: 'error', text: "❌ 서버 통신 실패: Verifier 초대 요청이 실패했습니다." });
        } finally {
          setIsAddingRole(false);
        }
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

  // 계승자 요청 등록
  const handleRequestSuccessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!successorEmailInput) {
      setSuccessorMessage({ type: 'error', text: "이메일 주소를 입력해주세요." });
      return;
    }

    setIsRequestingSuccessor(true);
    setSuccessorMessage(null);

    try {
      const res = await fetch(`/api/capsules/${capsuleId}/successor/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: successorEmailInput,
          user_id: userId 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessorMessage({ type: 'success', text: data.message || "계승 요청이 등록되었습니다." });
        setSuccessorEmailInput('');
        fetchSuccessorRequests();
        fetchCapsuleData();
      } else {
        setSuccessorMessage({ type: 'error', text: data.message || "계승 요청 등록에 실패했습니다." });
      }
    } catch (error) {
      setSuccessorMessage({ type: 'error', text: "서버 통신 실패: 계승 요청이 실패했습니다." });
    } finally {
      setIsRequestingSuccessor(false);
    }
  };

  // 계승 요청 승인 (소유자가 승인)
  const handleApproveSuccessor = async (requestId: number) => {
    if (!confirm("이 계승 요청을 승인하시겠습니까? 소유권이 이전됩니다.")) return;

    try {
      const res = await fetch(`/api/capsules/${capsuleId}/successor/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          request_id: requestId,
          user_id: userId 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message || "계승이 승인되었습니다.");
        fetchSuccessorRequests();
        fetchCapsuleData();
      } else {
        alert(data.message || "계승 승인에 실패했습니다.");
      }
    } catch (err) {
      alert("오류 발생");
    }
  };

  // 계승자가 직접 계승받기
  const handleAcceptSuccession = async () => {
    if (!confirm("이 캡슐의 계승을 받으시겠습니까? 소유권이 이전됩니다.")) return;

    try {
      const res = await fetch(`/api/capsules/${capsuleId}/successor/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message || "계승이 완료되었습니다.");
        fetchCapsuleData();
      } else {
        alert(data.message || "계승 처리에 실패했습니다.");
      }
    } catch (err) {
      alert("오류 발생");
    }
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
  
  // 인증 완료 여부 확인
  const isVerificationComplete = capsule.is_verification_complete || false;
  const totalVerifiers = capsule.total_verifiers || 0;
  const verifierApprovalCount = capsule.verifier_approval_count || 0;
  
  // 🎁 개봉 준비 완료 여부 (봉인됨 + 시간됨 + 서명완료 + 인증완료)
  const isReadyToUnlock = isSealed && isTimeReached && isSignCompleted && isVerificationComplete;

  // 💡 Verifier 관련 변수 계산
  const isVerifier = capsule.roles?.some((r: any) => String(r.user_id) === userId && r.role_type === 'verifier');
  const verifiers = capsule.roles?.filter((r: any) => r.role_type === 'verifier') || [];
  
  // 💡 Co-Signer 관련 변수 계산
  const isCoSigner = capsule.roles?.some((r: any) => String(r.user_id) === userId && r.role_type === 'co-signer');
  
  // 💡 Successor 관련 변수 계산
  const isSuccessor = capsule.roles?.some((r: any) => String(r.user_id) === userId && r.role_type === 'successor');
  // 현재 사용자의 계승 요청 승인 여부 확인
  const userSuccessorRequest = capsule.successor_requests?.find((req: any) => String(req.successor_id) === userId);
  const successorRequestApproved = userSuccessorRequest?.approved || false;
  const canViewContent = !isSuccessor || successorRequestApproved || isOwner; // 계승자는 계승받기 전까지 내용을 볼 수 없음

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

        {/* 서명 요청 안내 박스 (공동 서명자용) - co-signer 역할인 경우에만 표시 */}
        {isPending && !isOwner && isCoSigner && (
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

        {/* 인증자 안내 박스 */}
        {isVerifier && isSealed && (
            <div className="mb-8 p-6 bg-teal-50 border border-teal-200 rounded-xl text-center shadow-sm">
                <h3 className="text-xl font-bold text-teal-800 mb-2">🔍 인증자 역할</h3>
                <p className="text-teal-700 mb-4">
                    이 캡슐의 인증자로 지정되었습니다.<br/>
                    개봉일이 도래하면 인증자 대시보드에서 개봉을 승인할 수 있습니다.
                </p>
                <button 
                    onClick={() => router.push('/verifier')}
                    className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 shadow-lg"
                >
                    인증자 대시보드로 이동
                </button>
            </div>
        )}

        {/* 계승자 안내 박스 */}
        {isSuccessor && !successorRequestApproved && (
            <div className="mb-8 p-6 bg-purple-50 border border-purple-200 rounded-xl text-center shadow-sm">
                <h3 className="text-xl font-bold text-purple-800 mb-2">👑 계승자 역할</h3>
                <p className="text-purple-700 mb-4">
                    이 캡슐의 계승자로 지정되었습니다.<br/>
                    계승을 받으면 캡슐의 소유권을 이어받고 내용을 볼 수 있습니다.
                </p>
                <button
                    onClick={handleAcceptSuccession}
                    className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-lg"
                >
                    ✨ 계승받기
                </button>
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

        {/* 🔑 [수정됨] 캡슐 인증자 (Verifier) 이메일 초대 박스 (작성자용) */}
        {isOwner && isDraft && (
          <div className="mb-8 p-4 border border-teal-100 bg-teal-50 rounded-lg">
            <h3 className="font-bold text-teal-900 mb-2 flex items-center space-x-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 4 0 0 0-4-4H6a4 4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="16" x2="22" y1="11" y2="11"/></svg>
            <span>인증자 초대</span>
            </h3>

            {/* Verifier 지정 메시지 */}
            {verifierMessage && (
              <div className={`p-2 mb-3 rounded-lg flex items-center space-x-2 text-xs ${verifierMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <p className="font-medium">{verifierMessage.text}</p>
              </div>
            )}

            <form onSubmit={handleInviteVerifier} className="flex space-x-2">
              <input
                type="email" // 이메일 타입
                placeholder="Verifier 이메일 (예: verifier@test.com)"
                value={verifierEmailInput} // 새로운 state 사용
                onChange={(e) => setVerifierEmailInput(e.target.value)} // 새로운 state setter 사용
                required
                className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
              />
              <button
                type="submit"
                disabled={isAddingRole || verifierEmailInput.trim() === ''}
                className="flex items-center space-x-1 px-4 py-2 bg-teal-600 text-white font-medium rounded-lg shadow-md hover:bg-teal-700 transition duration-150 disabled:bg-gray-400"
              >
                {isAddingRole ? (
                 <span>초대 중...</span>
                ) : (
                  <span>Verifier 초대</span>
                )}
              </button>
             </form>
            <div className="mt-2 text-sm text-teal-800">지정된 Verifier ID: {verifiers.map((r: any) => r.user_id).join(', ') || '없음'}</div>
          </div>
        )}

        {/* 👑 계승자(Successor) 지정 박스 (작성자용) */}
        {isOwner && isDraft && (
          <div className="mb-8 p-4 border border-purple-100 bg-purple-50 rounded-lg">
            <h3 className="font-bold text-purple-900 mb-2 flex items-center space-x-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>계승자 지정</span>
            </h3>

            {/* 계승자 지정 메시지 */}
            {successorMessage && (
              <div className={`p-2 mb-3 rounded-lg flex items-center space-x-2 text-xs ${successorMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <p className="font-medium">{successorMessage.text}</p>
              </div>
            )}

            <form onSubmit={handleRequestSuccessor} className="flex space-x-2 mb-4">
              <input
                type="email"
                placeholder="계승자 이메일 (예: successor@test.com)"
                value={successorEmailInput}
                onChange={(e) => setSuccessorEmailInput(e.target.value)}
                required
                className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={isRequestingSuccessor || successorEmailInput.trim() === ''}
                className="flex items-center space-x-1 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg shadow-md hover:bg-purple-700 transition duration-150 disabled:bg-gray-400"
              >
                {isRequestingSuccessor ? (
                  <span>요청 중...</span>
                ) : (
                  <span>계승자 요청</span>
                )}
              </button>
            </form>

            {/* 계승 요청 목록 */}
            {isLoadingRequests ? (
              <div className="text-sm text-gray-500">로딩 중...</div>
            ) : successorRequests.length > 0 ? (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-purple-800 mb-2">계승 요청 목록:</h4>
                {successorRequests.map((req: any) => (
                  <div key={req.request_id} className="flex items-center justify-between p-2 bg-white rounded border border-purple-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{req.username} ({req.email})</p>
                      <p className="text-xs text-gray-500">
                        요청일: {new Date(req.request_date).toLocaleDateString()}
                        {req.approved && <span className="ml-2 text-green-600 font-semibold">✓ 승인됨</span>}
                      </p>
                    </div>
                    {!req.approved && isOwner && (
                      <button
                        onClick={() => handleApproveSuccessor(req.request_id)}
                        className="px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700"
                      >
                        승인
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">등록된 계승 요청이 없습니다.</div>
            )}
          </div>
        )}

        {/* 본문 영역 */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-700 mb-2">💌 메시지</h3>
          <div className="p-6 border rounded-xl bg-gray-50 min-h-[200px] leading-relaxed whitespace-pre-wrap text-gray-800 relative overflow-hidden">
            
            {/* 🔒 [수정됨] Sealed 상태이거나 계승자가 계승받기 전이면 내용을 가립니다! */}
            {isSealed || (isSuccessor && !successorRequestApproved) ? (
               <div className="flex flex-col items-center justify-center h-full py-12 text-center bg-gray-50">
                  {isReadyToUnlock ? (
                     // Case 1: 모든 조건 충족 - 개봉하기 버튼 표시
                     <div className="animate-fade-in">
                        <div className="text-6xl mb-4 animate-bounce">🎁</div>
                        <h3 className="text-2xl font-bold text-indigo-800 mb-2">개봉할 준비가 완료되었습니다!</h3>
                        <p className="text-indigo-600 mb-4">인증자 승인 완료. 이제 개봉할 수 있습니다.</p>
                        {totalVerifiers > 0 && (
                          <p className="text-sm text-gray-600 mb-6">
                            인증자 {verifierApprovalCount}/{totalVerifiers}명 승인 완료
                          </p>
                        )}
                        <button 
                          onClick={handleUnlock}
                          className="px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-full shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all"
                        >
                          ✨ 캡슐 개봉하기
                        </button>
                     </div>
                  ) : (
                     // Case 2: 아직 봉인 중 (조건 미충족)
                     <div>
                        <div className="text-5xl mb-4 text-gray-400">🔒</div>
                        <h3 className="text-xl font-bold text-gray-600">이 캡슐은 봉인되어 있습니다.</h3>
                        <div className="mt-4 space-y-2 text-sm text-gray-600">
                          {/* 시간 조건 */}
                          {!isTimeReached && (
                            <p>
                              ⏰ 개봉일: <span className="text-indigo-600 font-bold">
                                {new Date(capsule.unlock_date).toLocaleDateString()}
                              </span> 이후 개봉 가능
                            </p>
                          )}
                          {/* 서명 조건 */}
                          {isTimeReached && !isSignCompleted && (
                            <p className="text-red-500">
                              📝 서명 대기 중: {capsule.approved_signers}/{capsule.total_signers}명 승인 완료
                            </p>
                          )}
                          {/* 인증 조건 */}
                          {isTimeReached && isSignCompleted && !isVerificationComplete && totalVerifiers > 0 && (
                            <p className="text-teal-600">
                              🔍 인증자 승인 대기 중: {verifierApprovalCount}/{totalVerifiers}명 승인 완료
                            </p>
                          )}
                          {/* 모든 조건 충족 시 안내 */}
                          {isTimeReached && isSignCompleted && isVerificationComplete && (
                            <p className="text-green-600 font-semibold">
                              ✅ 모든 조건 충족! 위의 개봉하기 버튼을 눌러주세요.
                            </p>
                          )}
                        </div>
                     </div>
                  )}
               </div>
            ) : (
              // 🔓 Sealed가 아니고, 계승자가 계승받았거나 계승자가 아니면 내용 표시
              canViewContent ? capsule.content : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center bg-gray-50">
                  <div className="text-5xl mb-4 text-gray-400">🔒</div>
                  <h3 className="text-xl font-bold text-gray-600">계승받기 전까지 내용을 볼 수 없습니다.</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    위의 "계승받기" 버튼을 눌러 계승을 완료하세요.
                  </p>
                </div>
              )
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
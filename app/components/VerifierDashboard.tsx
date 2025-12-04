import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle, Clock, FileText, XCircle, Info, Send, ArrowLeft } from 'lucide-react';

// =========================================================================
// 💡 TypeScript 인터페이스 정의
// =========================================================================

interface Capsule {
    capsule_id: number;
    owner_id: number;
    title: string;
    unlock_date: string; // ISO string for unlock date
}

interface AuthData {
    token: string | null;
}

interface Message {
    type: 'success' | 'error';
    text: string;
}

// 사용자 인증 정보 (토큰)를 가져오는 함수 (localStorage 사용)
const getAuthData = (): AuthData => {
    // app/dashboard/page.tsx와 동일하게 localStorage에서 토큰을 가져옵니다.
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    return { token: token };
};

const VerifierDashboard: React.FC = () => {
    const router = useRouter();
    // 💡 useState에 명시적인 타입 적용
    const [capsules, setCapsules] = useState<Capsule[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCapsuleId, setSelectedCapsuleId] = useState<number | null>(null);
    const [noteContent, setNoteContent] = useState<string>('');
    const [isApproving, setIsApproving] = useState<boolean>(false);
    const [message, setMessage] = useState<Message | null>(null); // 성공/실패 메시지

    const auth = getAuthData();

    // 1. 인증 대기 캡슐 목록 조회 함수
    const fetchWaitingCapsules = useCallback(async () => {
        if (!auth.token) {
            setError("인증 토큰이 없습니다. 로그인이 필요합니다.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setMessage(null);

        // userId를 가져와서 대체 인증 방법으로 사용
        const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
        
        try {
            // 토큰과 userId를 모두 전달 (토큰이 실패하면 userId로 대체)
            const url = userId ? `/api/verifier?userId=${userId}` : '/api/verifier';
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    // 💡 API 호출 시 토큰 사용
                    'Authorization': auth.token ? `Bearer ${auth.token}` : '',
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (response.ok) {
                // 💡 타입 캐스팅: 응답 데이터가 Capsule 배열 형태임을 명시
                setCapsules(data.capsules as Capsule[]);
            } else {
                setError(data.message || "캡슐 목록을 불러오는 데 실패했습니다.");
                setCapsules([]);
            }
        } catch (err) {
            setError("서버와 통신하는 중 오류가 발생했습니다.");
            console.error("Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [auth.token]); // auth.token이 변경될 때만 함수 재생성

    // 컴포넌트 마운트 시 데이터 로드
    useEffect(() => {
        fetchWaitingCapsules();
    }, [fetchWaitingCapsules]);

    // 2. 캡슐 개봉 승인 및 메모 작성 함수
    const handleApproveCapsule = async (e: FormEvent) => {
        e.preventDefault();
        if (selectedCapsuleId === null || isApproving) return;

        // 🚨 Verifier ID (인증자 ID)는 실제 인증 로직에서 가져와야 하지만, 
        // 현재 로직상 auth.token에 담긴 사용자 정보가 Verifier라고 가정하고
        // 임시로 localStorage의 userId를 가져와 사용합니다.
        const verifier_id = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

        if (!verifier_id) {
            setMessage({ type: 'error', text: "사용자 ID를 찾을 수 없습니다. 다시 로그인해 주세요." });
            return;
        }


        setIsApproving(true);
        setMessage(null);

        try {
            // 💡 인증자 개봉 승인 API: /api/verifier POST 사용
            const response = await fetch(`/api/verifier`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${auth.token}`, // 💡 토큰 재사용
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    capsule_id: selectedCapsuleId,
                    note_content: noteContent, // API에서 note_content로 받음
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: data.message || "✅ 캡슐 개봉이 성공적으로 승인되었습니다." });
                // 승인 후 목록 새로고침
                fetchWaitingCapsules(); 
                setSelectedCapsuleId(null);
                setNoteContent('');
            } else {
                setMessage({ type: 'error', text: data.message || "❌ 승인 처리 중 오류가 발생했습니다." });
            }
        } catch (err) {
            setMessage({ type: 'error', text: "❌ 서버 통신 실패: 캡슐 승인에 실패했습니다." });
            console.error("Approve error:", err);
        } finally {
            setIsApproving(false);
        }
    };

    // UI 요소: 캡슐 카드를 클릭하여 메모 작성 모달을 엽니다.
    const CapsuleCard: React.FC<{ capsule: Capsule }> = ({ capsule }) => (
        <div 
            className={`p-4 bg-white rounded-xl shadow-lg border cursor-pointer transition duration-200 
                       ${selectedCapsuleId === capsule.capsule_id ? 'border-indigo-500 ring-2 ring-indigo-500' : 'hover:border-indigo-300'}`}
            onClick={() => {
                setSelectedCapsuleId(capsule.capsule_id);
                setNoteContent(''); // 선택 시 메모 초기화
            }}
        >
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 truncate">{capsule.title}</h3>
                <Clock className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-sm text-gray-700 mt-1">
                개봉일: {new Date(capsule.unlock_date).toLocaleDateString('ko-KR')}
            </p>
            <p className="text-xs text-gray-500 mt-2">
                ID: #{capsule.capsule_id}
            </p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <header className="mb-8 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">인증자 대시보드</h1>
                        <p className="text-lg text-gray-600">
                            개봉일이 도래한 캡슐을 확인하고 개봉을 승인하여 신뢰도를 높여주세요.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        title="메인 대시보드로 이동"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">뒤로가기</span>
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 왼쪽 패널: 캡슐 목록 */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800">개봉 대기 캡슐 ({capsules.length})</h2>
                        <button 
                            onClick={fetchWaitingCapsules}
                            disabled={isLoading}
                            className="flex items-center space-x-1 text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>{isLoading ? '로딩 중...' : '새로고침'}</span>
                        </button>
                    </div>
                    
                    {/* 상태 메시지 */}
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg flex items-center space-x-2">
                            <XCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}
                    {message && (
                        <div className={`border-l-4 p-4 rounded-lg flex items-center space-x-2 ${message.type === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700'}`}>
                            <Info className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-medium">{message.text}</p>
                        </div>
                    )}

                    {/* 캡슐 목록 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {capsules.length > 0 ? (
                            capsules.map(capsule => (
                                <CapsuleCard key={capsule.capsule_id} capsule={capsule} />
                            ))
                        ) : (
                            !isLoading && (
                                <div className="col-span-2 p-6 text-center bg-white rounded-xl shadow-inner text-gray-500">
                                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                    <p>현재 승인 대기 중인 캡슐이 없습니다.</p>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* 오른쪽 패널: 승인/메모 작성 */}
                <div className="lg:col-span-1">
                    <div className="sticky top-4">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">캡슐 개봉 승인</h2>
                        
                        <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-100">
                            {selectedCapsuleId !== null ? (
                                <form onSubmit={handleApproveCapsule} className="space-y-4">
                                    <p className="text-sm font-medium text-gray-900">
                                        선택된 캡슐 ID: <span className="font-bold text-indigo-600">#{selectedCapsuleId}</span>
                                    </p>
                                    
                                    <div>
                                        <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
                                            인증 메모 작성 (필수)
                                        </label>
                                        <textarea
                                            id="note"
                                            rows={4}
                                            value={noteContent}
                                            onChange={(e) => setNoteContent(e.target.value)}
                                            required
                                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 resize-none transition-shadow"
                                            placeholder="캡슐 개봉을 승인하며 확인한 내용을 간단히 기록합니다. (최소 1자)"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isApproving || noteContent.trim().length === 0}
                                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                                    >
                                        {isApproving ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>승인 중...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-4 h-4" />
                                                <span>개봉 승인 및 메모 기록</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            ) : (
                                <div className="text-center py-8">
                                    <Send className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                                    <p className="text-gray-600 font-medium">
                                        왼쪽 목록에서 승인할 캡슐을 선택해 주세요.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default VerifierDashboard;
import React, { useState } from 'react';
import { UserPlus, Loader2, CheckCircle, XCircle } from 'lucide-react';

// 💡 인터페이스 정의 (부모 컴포넌트의 capsule 구조와 일치해야 합니다)
interface Capsule {
    capsule_id: number;
    owner_id: number;
    status: 'draft' | 'pending_sign' | 'sealed' | 'unlocked';
    roles: { user_id: number; role_type: string }[];
}

interface VerifierManagementProps {
    capsule: Capsule;
    userId: string | null; // 현재 로그인된 사용자 ID (Owner)
    fetchCapsuleData: () => void; // 캡슐 상태 변경 후 부모 데이터 새로고침 함수
}

/**
 * 캡슐의 Owner가 Verifier (인증자)를 지정할 수 있는 UI 및 로직을 제공하는 컴포넌트입니다.
 */
const VerifierManagement: React.FC<VerifierManagementProps> = ({ capsule, userId, fetchCapsuleData }) => {
    const [verifierIdInput, setVerifierIdInput] = useState<string>('');
    const [isAddingRole, setIsAddingRole] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const isOwner = String(capsule.owner_id) === userId;
    const isDraft = capsule.status === 'draft';
    const currentUserIdNumber = Number(userId);

    // 현재 지정된 Verifier 목록 필터링
    const verifiers = capsule.roles?.filter(r => r.role_type === 'verifier') || [];

    // Verifier 지정 API 호출 함수
    const handleAddVerifier = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const userToAddId = parseInt(verifierIdInput, 10);

        if (!userId || isNaN(userToAddId) || userToAddId === currentUserIdNumber) {
            setMessage({ type: 'error', text: "유효하지 않은 Verifier ID입니다. 본인 ID는 지정할 수 없습니다." });
            return;
        }

        if (!isDraft) {
            setMessage({ type: 'error', text: "❌ 'draft' 상태에서만 역할을 추가할 수 있습니다." });
            return;
        }

        setIsAddingRole(true);
        setMessage(null); // 이전 메시지 초기화

        const requestBody = {
            requester_id: currentUserIdNumber, // 요청자(Owner) ID
            user_to_add_id: userToAddId,
            role_type: 'verifier', // 역할 타입 지정
        };

        try {
            // API: /api/capsules/[id]/role (POST) 호출
            const response = await fetch(`/api/capsules/${capsule.capsule_id}/role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: data.message || `✅ Verifier (ID: ${userToAddId}) 지정 성공!` });
                setVerifierIdInput(''); // 입력 필드 초기화
                fetchCapsuleData(); // 부모 컴포넌트의 데이터 새로고침
            } else {
                setMessage({ type: 'error', text: data.message || "❌ 역할 추가에 실패했습니다." });
            }
        } catch (error) {
            setMessage({ type: 'error', text: "❌ 서버 통신 실패: 역할 추가 요청이 실패했습니다." });
        } finally {
            setIsAddingRole(false);
        }
    };

    // Owner가 아니거나 Draft 상태가 아니면 아무것도 렌더링하지 않습니다.
    if (!isOwner || !isDraft) {
        return null; 
    }

    return (
        <div className="p-4 border border-teal-100 bg-teal-50 rounded-lg">
            <h3 className="font-bold text-teal-900 mb-2 flex items-center space-x-1">
                <UserPlus className="w-4 h-4" />
                <span>캡슐 인증자 (Verifier) 지정</span>
            </h3>

            {/* Verifier 지정 관련 메시지 표시 */}
            {message && (
                <div className={`p-2 mb-3 rounded-lg flex items-center space-x-2 text-xs ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <p className="font-medium">{message.text}</p>
                </div>
            )}
            
            <form onSubmit={handleAddVerifier} className="flex space-x-2">
                <input
                    type="number"
                    placeholder="Verifier ID (숫자)"
                    value={verifierIdInput}
                    onChange={(e) => setVerifierIdInput(e.target.value)}
                    required
                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                />
                <button
                    type="submit"
                    disabled={isAddingRole || verifierIdInput.trim() === ''}
                    className="flex items-center space-x-1 px-4 py-2 bg-teal-600 text-white font-medium rounded-lg shadow-md hover:bg-teal-700 transition duration-150 disabled:bg-gray-400"
                >
                    {isAddingRole ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>추가 중</span>
                        </>
                    ) : (
                        <span>Verifier 지정</span>
                    )}
                </button>
            </form>
            <div className="mt-2 text-sm text-teal-800">지정된 Verifier: {verifiers.map(r => r.user_id).join(', ') || '없음'}</div>
        </div>
    );
};

export default VerifierManagement;
import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; 

// 임시 인증 함수: 현재 로그인된 사용자 ID를 반환합니다.
async function getAuthenticatedUserId(request: Request): Promise<string> {
    // 💡 실제 환경에서는 JWT 토큰 등을 검증하여 사용자 ID를 반환해야 합니다.
    return "current_logged_in_user_id"; 
}

/**
 * [POST] Verifier가 캡슐 개봉을 승인하는 전용 API입니다.
 * 이 API를 호출하는 사용자는 반드시 해당 캡슐의 'verifier' 역할이어야 합니다.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const capsuleId = Number(params.id);
  
  try {
    const currentUserId = await getAuthenticatedUserId(request);

    if (isNaN(capsuleId)) {
      return NextResponse.json({ message: "유효한 캡슐 ID가 필요합니다." }, { status: 400 });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. 캡슐 상태 및 개봉일 확인
      const capsuleCheck = await client.query(
        `SELECT status, open_date FROM "CAPSULE" WHERE capsule_id = $1`, 
        [capsuleId]
      );
      
      if (capsuleCheck.rows.length === 0) throw new Error("요청된 캡슐을 찾을 수 없습니다.");
      
      const { status, open_date } = capsuleCheck.rows[0];
      const now = new Date();
      const openDate = new Date(open_date);

      if (status === 'opened') {
        throw new Error("이미 개봉된 캡슐입니다.");
      }

      // 개봉일 검사: 개봉일이 지나지 않았다면 Verifier도 승인할 수 없습니다.
      if (now < openDate) {
        throw new Error(`개봉일(Open Date: ${openDate.toLocaleDateString()})이 지나지 않았습니다.`);
      }

      // 2. 사용자 역할 확인: 요청자가 반드시 Verifier 역할이어야 합니다.
      const roleCheck = await client.query(
        `SELECT role_type FROM "CAPSULE_ROLE" WHERE capsule_id = $1 AND user_id = $2 AND role_type = 'verifier'`,
        [capsuleId, currentUserId]
      );
      
      // Verifier가 아닌 사용자가 POST 요청 시도 시 403 Forbidden 반환
      if (roleCheck.rows.length === 0) {
        throw new Error("권한이 없습니다. Verifier 역할만 개봉을 승인할 수 있습니다.");
      }

      // 3. Verifier의 개봉 승인 상태 업데이트 또는 추가
      await client.query(
        `INSERT INTO "CAPSULE_VERIFY" (capsule_id, verifier_id, verify_status, verified_at) 
         VALUES ($1, $2, 'approved', NOW())
         ON CONFLICT (capsule_id, verifier_id) 
         DO UPDATE SET verify_status = 'approved', verified_at = NOW()
         RETURNING *`,
        [capsuleId, currentUserId]
      );

      // 4. 모든 Verifier의 승인 완료 여부 확인
      const allVerifiers = await client.query(
          `SELECT COUNT(*) FROM "CAPSULE_ROLE" WHERE capsule_id = $1 AND role_type = 'verifier'`,
          [capsuleId]
      );
      const totalVerifiers = Number(allVerifiers.rows[0].count);
      
      const approvedVerifiers = await client.query(
          `SELECT COUNT(*) FROM "CAPSULE_VERIFY" WHERE capsule_id = $1 AND verify_status = 'approved'`,
          [capsuleId]
      );
      const approvedCount = Number(approvedVerifiers.rows[0].count);

      let responseMessage = "Verifier 개봉 승인이 기록되었습니다.";

      // 5. 최종 개봉 결정: 모든 Verifier가 승인했을 때만 status를 'opened'로 변경
      if (totalVerifiers > 0 && approvedCount >= totalVerifiers) {
          await client.query(
              `UPDATE "CAPSULE" SET status = 'opened', opened_at = NOW() WHERE capsule_id = $1`,
              [capsuleId]
          );
          responseMessage = "✅ 모든 Verifier의 승인 완료! 캡슐이 개봉되었습니다.";
      } else {
          const remaining = totalVerifiers - approvedCount;
          responseMessage = `✅ 승인이 기록되었습니다. ${remaining}명의 Verifier가 추가로 승인해야 개봉됩니다.`;
      }

      await client.query('COMMIT'); 

      return NextResponse.json({ message: responseMessage }, { status: 200 });

    } catch (error: any) {
      await client.query('ROLLBACK');
      
      // 권한 에러는 403 Forbidden으로 반환
      if (error.message.includes("권한이 없습니다")) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
      
      // 개봉일 미달 에러는 400 Bad Request로 반환
      if (error.message.includes("개봉일")) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      
      return NextResponse.json({ message: error.message || "개봉 처리 중 서버 오류가 발생했습니다." }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Capsule Open General Error:", error);
    return NextResponse.json({ message: "서버 연결 오류" }, { status: 500 });
  }
}
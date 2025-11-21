import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; // DB 연결 모듈

/**
 * @summary 캡슐 상세 조회 (GET)
 * @description 1. 요청자의 권한을 확인하고 캡슐 정보를 반환합니다.
 * @description 2. 캡슐의 상태, 역할, 서명, 개봉 노트 등 모든 관련 정보를 집계하여 반환합니다.
 */
export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  const client = await pool.connect(); // DB 연결 (읽기 작업이므로 트랜잭션은 선택적이지만, 일관성을 위해 사용 가능)
  
  try {
    const capsule_id = parseInt(context.params.id, 10);
    
    // 🚨 실제 인증된 사용자 ID를 여기에서 가져와야 합니다. (예: JWT 디코딩)
    // 현재는 테스트를 위해 쿼리 파라미터에서 user_id를 임시로 가져온다고 가정합니다.
    const url = new URL(request.url);
    const authenticated_user_id = url.searchParams.get('user_id');

    // 1. 유효성 검사
    if (isNaN(capsule_id) || !authenticated_user_id) {
      client.release();
      return NextResponse.json({
        message: "❌ 잘못된 요청입니다. capsule_id와 user_id(인증) 정보가 필요합니다.",
      }, { status: 400 });
    }

    // 2. (1단계) 권한 확인 및 캡슐 기본 정보 조회
    // 캡슐이 존재하고, 요청자가 해당 캡슐의 역할(creator, co-signer, verifier) 중 하나를 가지고 있는지 확인합니다.
    const baseCapsuleQuery = `
      SELECT 
        C.capsule_id, C.owner_id, C.title, C.status, C.unlock_date, C.unlocked_at,
        CASE
            WHEN C.status = 'unlocked' OR R.role_type IS NOT NULL THEN C.content
            ELSE NULL 
        END AS content, -- unlocked 상태이거나 역할이 있는 경우에만 content 노출
        R.role_type AS user_role
      FROM "CAPSULE" C
      LEFT JOIN "CAPSULE_ROLE" R ON C.capsule_id = R.capsule_id AND R.user_id = $2
      WHERE C.capsule_id = $1;
    `;
    const baseResult = await client.query(baseCapsuleQuery, [capsule_id, authenticated_user_id]);

    if (baseResult.rows.length === 0) {
      client.release();
      return NextResponse.json({
        message: "❌ 해당 캡슐이 존재하지 않습니다.",
      }, { status: 404 });
    }

    const capsule = baseResult.rows[0];
    const { user_role, status } = capsule;
    
    // 3. (2단계) 접근 권한 최종 확인 (unlocked 상태가 아니면서, 역할이 없는 경우 접근 차단)
    // 'unlocked' 상태의 캡슐은 (프로젝트 규칙에 따라) 누구나 볼 수 있도록 허용하거나,
    // 최소한 관련자(role_type이 NULL이 아닌 경우)에게는 보여줘야 합니다.
    if (status !== 'unlocked' && user_role === null) {
      client.release();
      return NextResponse.json({
        message: "❌ 캡슐을 조회할 권한이 없습니다. 봉인된 캡슐은 관련자만 조회할 수 있습니다.",
      }, { status: 403 });
    }

    // 4. (3단계) 관련 정보 조회 및 병합

    // 4-A. 역할(Roles) 목록 조회
    const rolesQuery = `
      SELECT user_id, role_type FROM "CAPSULE_ROLE" WHERE capsule_id = $1;
    `;
    const rolesResult = await client.query(rolesQuery, [capsule_id]);
    capsule.roles = rolesResult.rows;

    // 4-B. 서명 상태(Signatures) 목록 조회 (pending, approved, rejected)
    const signsQuery = `
      SELECT signer_id, sign_status FROM "CAPSULE_SIGN" WHERE capsule_id = $1;
    `;
    const signsResult = await client.query(signsQuery, [capsule_id]);
    capsule.signatures = signsResult.rows;

    // 4-C. 개봉 노트(Verification Note) 조회 (unlocked 상태인 경우에만 존재)
    if (status === 'unlocked') {
      const noteQuery = `
        SELECT verifier_id, note, verified_at FROM "VERIFICATION_NOTE" WHERE capsule_id = $1;
      `;
      const noteResult = await client.query(noteQuery, [capsule_id]);
      capsule.verification_note = noteResult.rows[0] || null;
    } else {
      capsule.verification_note = null;
    }

    // 5. 성공 반환
    return NextResponse.json({
      message: "✅ 캡슐 상세 조회 성공",
      capsule: capsule,
    }, { status: 200 });

  } catch (error) {
    // 6. 실패 시
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    return NextResponse.json({
      message: "❌ 캡슐 상세 조회 실패...",
      error: errorMessage,
    }, { status: 500 });
  } finally {
    // 7. (필수!) 사용한 client를 Pool에 반환
    client.release();
  }
}
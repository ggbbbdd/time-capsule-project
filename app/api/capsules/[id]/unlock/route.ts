import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const capsuleId = id;

  let client;
  try {
    client = await pool.connect();

    // 1. 먼저 캡슐 정보를 조회해서 날짜 확인
    const checkQuery = `SELECT unlock_date, status FROM "CAPSULE" WHERE capsule_id = $1`;
    const checkResult = await client.query(checkQuery, [capsuleId]);

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ message: "캡슐을 찾을 수 없습니다." }, { status: 404 });
    }

    const capsule = checkResult.rows[0];
    
    // 2. 서버 측 날짜 검증 (보안)
    if (new Date() < new Date(capsule.unlock_date)) {
      return NextResponse.json({ message: "아직 개봉 시간이 되지 않았습니다!" }, { status: 403 });
    }

    // 3. 이미 열려있으면 패스
    if (capsule.status === 'unlocked') {
        return NextResponse.json({ message: "이미 개봉된 캡슐입니다." }, { status: 200 });
    }

    // 4. 인증자 승인 여부 확인 (VERIFICATION_NOTE 테이블 확인)
    const verifierCheck = await client.query(
      `SELECT COUNT(*)::int as count 
       FROM "VERIFICATION_NOTE" 
       WHERE capsule_id = $1`,
      [capsuleId]
    );

    const verifierApprovalCount = verifierCheck.rows[0]?.count || 0;
    
    // 인증자가 지정되어 있는지 확인
    const verifierRoleCheck = await client.query(
      `SELECT COUNT(*)::int as count 
       FROM "CAPSULE_ROLE" 
       WHERE capsule_id = $1 AND role_type = 'verifier'`,
      [capsuleId]
    );

    const totalVerifiers = verifierRoleCheck.rows[0]?.count || 0;

    // 인증자가 지정되어 있으면, 최소 1명 이상의 인증자 승인이 필요
    if (totalVerifiers > 0 && verifierApprovalCount === 0) {
      return NextResponse.json({ 
        message: "인증자의 승인이 필요합니다. 인증자 대시보드에서 승인해주세요." 
      }, { status: 403 });
    }

    // 5. 상태 업데이트 (sealed -> unlocked)
    // 인증자 승인이 있거나, 인증자가 없는 경우에만 개봉 가능
    const updateQuery = `
      UPDATE "CAPSULE" 
      SET status = 'unlocked' 
      WHERE capsule_id = $1 
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [capsuleId]);

    return NextResponse.json({ 
      message: "봉인이 해제되었습니다!", 
      capsule: updateResult.rows[0] 
    }, { status: 200 });

  } catch (error) {
    console.error("Unlock Error:", error);
    return NextResponse.json({ message: "서버 오류" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

// ⚠️ 함수 이름 앞에 'export'가 꼭 있어야 합니다!
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const capsuleId = id;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 캡슐 상태 및 서명자 수 확인
    const checkQuery = `
      SELECT 
        status, 
        (SELECT COUNT(*) FROM "CAPSULE_ROLE" WHERE capsule_id = $1 AND role_type = 'co-signer') as signer_count
      FROM "CAPSULE"
      WHERE capsule_id = $1
    `;
    const checkResult = await client.query(checkQuery, [capsuleId]);

    if (checkResult.rows.length === 0) throw new Error("캡슐을 찾을 수 없습니다.");
    
    const { status, signer_count } = checkResult.rows[0];

    // 2. 조건 검사
    if (status !== 'draft') {
      throw new Error("초안(Draft) 상태에서만 서명 요청을 할 수 있습니다.");
    }
    if (parseInt(signer_count) === 0) {
      throw new Error("최소 1명 이상의 공동 서명자를 초대해야 합니다.");
    }

    // 3. 상태 업데이트
    const updateQuery = `
      UPDATE "CAPSULE" 
      SET status = 'pending_sign' 
      WHERE capsule_id = $1
    `;
    await client.query(updateQuery, [capsuleId]);

    await client.query('COMMIT');

    return NextResponse.json({ message: "서명 요청이 완료되었습니다! 이제 친구들의 승인을 기다립니다." }, { status: 200 });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error("Request Sign Error:", error);
    return NextResponse.json({ message: error.message || "서버 오류" }, { status: 500 });
  } finally {
    client.release();
  }
}
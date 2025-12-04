import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

/**
 * 계승자(Successor) 계승받기 API
 * 계승자가 직접 계승을 받아 소유권을 이전합니다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const capsuleId = parseInt(id);

  let client;
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ message: "사용자 ID가 필요합니다." }, { status: 400 });
    }

    if (isNaN(capsuleId)) {
      return NextResponse.json({ message: "유효한 캡슐 ID가 필요합니다." }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // 1. 캡슐 및 현재 소유자 확인
    const capsuleCheck = await client.query(
      `SELECT owner_id, status FROM "CAPSULE" WHERE capsule_id = $1`,
      [capsuleId]
    );

    if (capsuleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: "캡슐을 찾을 수 없습니다." }, { status: 404 });
    }

    // 2. 계승 요청 확인 (이 사용자가 계승자로 지정되어 있고, 아직 승인되지 않은 요청)
    const requestCheck = await client.query(
      `SELECT request_id, approved FROM "OWNERSHIP_REQUEST" 
       WHERE capsule_id = $1 AND successor_id = $2`,
      [capsuleId, user_id]
    );

    if (requestCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: "계승 요청을 찾을 수 없습니다. 계승자로 지정되지 않았습니다." }, { status: 404 });
    }

    if (requestCheck.rows[0].approved) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: "이미 계승이 완료되었습니다." }, { status: 400 });
    }

    const requestId = requestCheck.rows[0].request_id;

    // 3. 소유권 이전 (CAPSULE 테이블의 owner_id 업데이트)
    await client.query(
      `UPDATE "CAPSULE" 
       SET owner_id = $1 
       WHERE capsule_id = $2`,
      [user_id, capsuleId]
    );

    // 4. 계승 요청 승인 상태 업데이트
    await client.query(
      `UPDATE "OWNERSHIP_REQUEST" 
       SET approved = true 
       WHERE request_id = $1`,
      [requestId]
    );

    // 5. 계승자의 creator 역할 추가
    await client.query(
      `INSERT INTO "CAPSULE_ROLE" (capsule_id, user_id, role_type)
       VALUES ($1, $2, 'creator')
       ON CONFLICT (capsule_id, user_id) 
       DO UPDATE SET role_type = 'creator'`,
      [capsuleId, user_id]
    );

    await client.query('COMMIT');

    return NextResponse.json({ 
      message: "계승이 완료되었습니다. 소유권이 이전되었습니다." 
    }, { status: 200 });

  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error("Successor Accept Error:", error);
    return NextResponse.json({ 
      message: error.message || "계승 처리 중 오류가 발생했습니다." 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}



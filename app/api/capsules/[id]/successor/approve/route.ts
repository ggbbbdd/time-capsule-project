import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

/**
 * 계승자(Successor) 승인 API
 * 계승 요청을 승인하여 캡슐의 소유권을 이전합니다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const capsuleId = parseInt(id);

  let client;
  try {
    const { request_id, user_id } = await request.json();

    if (!request_id) {
      return NextResponse.json({ message: "요청 ID가 필요합니다." }, { status: 400 });
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

    const currentOwnerId = capsuleCheck.rows[0].owner_id;

    // 소유자 권한 확인 (선택사항: 소유자만 승인 가능하도록)
    if (user_id && String(currentOwnerId) !== String(user_id)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: "소유자만 계승 요청을 승인할 수 있습니다." }, { status: 403 });
    }

    // 2. 계승 요청 확인
    const requestCheck = await client.query(
      `SELECT successor_id, approved FROM "OWNERSHIP_REQUEST" 
       WHERE request_id = $1 AND capsule_id = $2`,
      [request_id, capsuleId]
    );

    if (requestCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: "계승 요청을 찾을 수 없습니다." }, { status: 404 });
    }

    if (requestCheck.rows[0].approved) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: "이미 승인된 요청입니다." }, { status: 400 });
    }

    const successorId = requestCheck.rows[0].successor_id;

    // 3. 소유권 이전 (CAPSULE 테이블의 owner_id 업데이트)
    await client.query(
      `UPDATE "CAPSULE" 
       SET owner_id = $1 
       WHERE capsule_id = $2`,
      [successorId, capsuleId]
    );

    // 4. 계승 요청 승인 상태 업데이트
    await client.query(
      `UPDATE "OWNERSHIP_REQUEST" 
       SET approved = true 
       WHERE request_id = $1`,
      [request_id]
    );

    // 5. 기존 소유자의 creator 역할 유지, 계승자의 creator 역할 추가
    // (기존 소유자는 creator 역할 유지, 계승자도 creator 역할 추가)
    await client.query(
      `INSERT INTO "CAPSULE_ROLE" (capsule_id, user_id, role_type)
       VALUES ($1, $2, 'creator')
       ON CONFLICT (capsule_id, user_id) 
       DO UPDATE SET role_type = 'creator'`,
      [capsuleId, successorId]
    );

    await client.query('COMMIT');

    return NextResponse.json({ 
      message: "계승이 승인되었습니다. 소유권이 이전되었습니다." 
    }, { status: 200 });

  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error("Successor Approve Error:", error);
    return NextResponse.json({ 
      message: error.message || "계승 승인 중 오류가 발생했습니다." 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}


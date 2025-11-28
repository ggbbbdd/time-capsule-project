import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const capsuleId = id;
  
  let client;
  try {
    client = await pool.connect();
    
    // ✨ 쿼리 업그레이드!
    // 1. 캡슐 기본 정보
    // 2. total_signers: 공동 서명자('co-signer')가 총 몇 명인지
    // 3. approved_signers: 그 중 몇 명이 승인('approved') 도장을 찍었는지
    const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*)::int FROM "CAPSULE_ROLE" WHERE capsule_id = c.capsule_id AND role_type = 'co-signer') as total_signers,
        (SELECT COUNT(*)::int FROM "CAPSULE_SIGN" WHERE capsule_id = c.capsule_id AND sign_status = 'approved') as approved_signers
      FROM "CAPSULE" c
      WHERE c.capsule_id = $1;
    `;
    
    const result = await client.query(query, [capsuleId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ message: "캡슐을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });

  } catch (error) {
    console.error("Detail Fetch Error:", error);
    return NextResponse.json({ message: "서버 오류" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
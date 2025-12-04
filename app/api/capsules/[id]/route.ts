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

    // roles 정보도 함께 조회
    const rolesQuery = `
      SELECT cr.capsule_id, cr.user_id, cr.role_type, u.username, u.email
      FROM "CAPSULE_ROLE" cr
      JOIN "USERS" u ON cr.user_id = u.user_id
      WHERE cr.capsule_id = $1;
    `;
    const rolesResult = await client.query(rolesQuery, [capsuleId]);

    // 인증자 승인 여부 확인
    const verifierApprovalQuery = `
      SELECT COUNT(*)::int as approval_count
      FROM "VERIFICATION_NOTE"
      WHERE capsule_id = $1;
    `;
    const verifierApprovalResult = await client.query(verifierApprovalQuery, [capsuleId]);
    
    // 총 인증자 수 확인
    const totalVerifiersQuery = `
      SELECT COUNT(*)::int as total_count
      FROM "CAPSULE_ROLE"
      WHERE capsule_id = $1 AND role_type = 'verifier';
    `;
    const totalVerifiersResult = await client.query(totalVerifiersQuery, [capsuleId]);

    // 계승 요청 승인 여부 확인 (현재 사용자가 계승자인 경우)
    const successorRequestQuery = `
      SELECT approved FROM "OWNERSHIP_REQUEST"
      WHERE capsule_id = $1
      ORDER BY request_date DESC
      LIMIT 1;
    `;
    const successorRequestResult = await client.query(successorRequestQuery, [capsuleId]);
    const successorRequestApproved = successorRequestResult.rows[0]?.approved || false;

    const capsule = result.rows[0];
    capsule.roles = rolesResult.rows;
    capsule.verifier_approval_count = verifierApprovalResult.rows[0]?.approval_count || 0;
    capsule.total_verifiers = totalVerifiersResult.rows[0]?.total_count || 0;
    // 인증자가 없거나, 인증자가 모두 승인한 경우 인증 완료
    capsule.is_verification_complete = capsule.total_verifiers === 0 || capsule.verifier_approval_count >= capsule.total_verifiers;
    // 계승 요청 정보 (클라이언트에서 현재 사용자 기준으로 필터링)
    capsule.successor_requests = successorRequestResult.rows;

    return NextResponse.json(capsule, { status: 200 });

  } catch (error) {
    console.error("Detail Fetch Error:", error);
    return NextResponse.json({ message: "서버 오류" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
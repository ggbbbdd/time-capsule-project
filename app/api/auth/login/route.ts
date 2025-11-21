import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; // DB 연결 모듈
import * as bcrypt from 'bcryptjs'; // ⚠️ 설치 필요: npm install bcryptjs

/**
 * @summary 모의 JWT 토큰 생성 유틸리티
 * @description 실제 서비스에서는 'jsonwebtoken'과 같은 라이브러리를 사용하여 시크릿 키로 토큰을 서명해야 합니다.
 * 여기서는 사용자 ID와 이름을 base64로 간단하게 인코딩하여 토큰처럼 사용합니다.
 * @param {object} user - 토큰에 포함될 사용자 정보 (user_id, username)
 * @returns {string} 모의 JWT 토큰 문자열
 */
function createMockJwtToken(user: { user_id: number; username: string }): string {
    const payload = JSON.stringify({ 
        userId: user.user_id, 
        username: user.username,
        issuedAt: new Date().toISOString()
    });
    // Base64 인코딩을 사용하여 단순한 토큰을 만듭니다. (실제 JWT 역할을 대체합니다)
    return Buffer.from(payload).toString('base64');
}

/**
 * @summary 사용자 로그인 및 JWT 토큰 발급 (POST)
 * @description 이메일과 비밀번호를 확인하고, 유효한 경우 JWT 토큰을 반환합니다.
 */
export async function POST(request: Request) {
    // 🚨 pool.connect()는 실패할 수 있으므로 try 블록 밖에서 선언하여 finally에서 접근할 수 있도록 함
    let client; 
    
    try {
        client = await pool.connect(); 
        
        // 1. JSON Body에서 로그인 정보 가져오기
        const {
            email,
            password,
        } = await request.json();

        // 2. (유효성 검사) 필수 값 확인
        if (!email || !password) {
            return NextResponse.json({
                message: "❌ 'email'과 'password'는 필수 항목입니다.",
            }, { status: 400 });
        }
        
        // --- 트랜잭션 시작 (선택 사항이지만 안전을 위해 유지) ---
        await client.query('BEGIN');

        // 3. (1단계) 이메일을 기준으로 사용자 정보 조회
        const findUserQuery = `
            SELECT user_id, username, hashed_password FROM "USERS" WHERE "email" = $1;
        `;
        const findResult = await client.query(findUserQuery, [email]);
        const user = findResult.rows[0];

        // 4. (2단계) 사용자 존재 여부 확인
        if (!user) {
            // 이메일이 존재하지 않는 경우
            await client.query('ROLLBACK');
            return NextResponse.json({
                message: "❌ 로그인 실패: 이메일 또는 비밀번호가 일치하지 않습니다.",
            }, { status: 401 }); // 401: Unauthorized
        }

        // 5. (3단계) 비밀번호 비교 (✨ bcrypt.compare를 사용하여 해시된 비밀번호 검증)
        // DB에 저장된 해시 비밀번호와 사용자가 입력한 평문 비밀번호를 비교합니다.
        const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
        
        if (!isPasswordValid) {
            // 비밀번호가 일치하지 않는 경우
            await client.query('ROLLBACK');
            return NextResponse.json({
                message: "❌ 로그인 실패: 이메일 또는 비밀번호가 일치하지 않습니다.",
            }, { status: 401 }); // 401: Unauthorized
        }
        
        // 6. (4단계) 인증 성공 -> JWT 토큰 생성
        const token = createMockJwtToken({ user_id: user.user_id, username: user.username });
        
        await client.query('COMMIT'); // 커밋

        // 7. 성공 시 (토큰 및 사용자 정보 반환)
        return NextResponse.json({
            message: "✅ 로그인 성공!",
            token: token,
            user_id: user.user_id, // 디버깅 편의를 위해 ID도 함께 반환
            username: user.username,
        }, { status: 200 });

    } catch (error) {
        // 8. 실패 시 (롤백)
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
        }
        
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        return NextResponse.json({
            message: "❌ 로그인 처리 실패...",
            error: errorMessage,
        }, { status: 500 });
    } finally {
        // 9. client 반환은 오직 finally에서만 안전하게 처리
        if (client) {
            client.release();
        }
    }
}
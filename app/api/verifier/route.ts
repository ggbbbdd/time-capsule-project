import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; 
import { PoolClient } from 'pg'; // pg 라이브러리의 PoolClient 타입 임포트

// =========================================================================
// ⚠️ 주의: 실제 서비스에서는 이 코드를 Auth Middleware에서 처리해야 합니다.
// 현재는 이전 대화의 구조를 기반으로 간단한 mock 디코딩을 사용합니다.
// =========================================================================

/**
 * @summary HTTP 요청 헤더에서 JWT를 디코딩하여 사용자 ID를 추출합니다.
 * @param request Next.js Request 객체
 * @returns 현재 로그인된 사용자의 ID (숫자) 또는 null
 */
function getUserIdFromToken(request: Request): number | null {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error("인증 토큰 누락 또는 형식 오류");
        return null;
    }
    const token = authHeader.substring(7); // 'Bearer ' 제거
    try {
        // 현재 프로젝트는 base64로 인코딩된 JSON 문자열을 토큰으로 사용합니다.
        // (JWT 형식이 아닌 단순 base64 인코딩)
        const payloadJson = Buffer.from(token, 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        
        // user_id가 숫자인지 확인
        if (typeof payload.userId === 'number') {
            return payload.userId;
        }
        return null;
    } catch (e) {
        console.error("토큰 디코딩 실패:", e);
        return null;
    }
}


// =========================================================================
// 1. 인증자 대기 캡슐 조회 (GET) - CAPSULE_ROLE 테이블 사용
// =========================================================================

/**
 * @summary 자신이 인증자로 지정된, 개봉 대기 중인 캡슐 목록을 조회합니다.
 * (개봉일이 현재 시각 이전인 캡슐만 표시)
 */
export async function GET(request: Request) {
    let client: PoolClient | null = null;
    
    // 1. 현재 사용자 ID 추출 (인증자 ID)
    // 먼저 토큰에서 추출 시도, 실패하면 URL 파라미터에서 가져오기
    let verifierId = getUserIdFromToken(request);
    
    // 토큰에서 추출 실패 시 URL 파라미터에서 userId 가져오기 (대체 방법)
    if (verifierId === null) {
        const url = new URL(request.url);
        const userIdParam = url.searchParams.get('userId');
        if (userIdParam) {
            verifierId = parseInt(userIdParam, 10);
            if (isNaN(verifierId)) {
                verifierId = null;
            }
        }
    }
    
    if (verifierId === null) {
        return NextResponse.json({ message: "❌ 인증 정보가 유효하지 않습니다." }, { status: 401 });
    }

    try {
        client = await pool.connect(); 
        
        // 2. 인증 대기 캡슐 조회 쿼리 (CAPSULE_ROLE과의 조인 필수)
        // - CAPSULE_ROLE에서 role_type='verifier'이고 user_id가 현재 인증자와 일치하는 캡슐만 조회
        // - 캡슐 상태는 'unlocked'가 아닌 모든 상태 (draft, pending_sign, sealed)
        // - unlock_date는 NOW() 이하 (개봉일이 도래한 캡슐)
        // - 이미 승인한 캡슐은 제외 (VERIFICATION_NOTE에 해당 인증자의 기록이 없는 캡슐만)
        const selectQuery = `
            SELECT 
                T1.capsule_id, T1.owner_id, T1.unlock_date, T1.title, T1.created_at, T1.status
            FROM "CAPSULE" T1 
            JOIN "CAPSULE_ROLE" T2 ON T1.capsule_id = T2.capsule_id
            LEFT JOIN "VERIFICATION_NOTE" VN ON T1.capsule_id = VN.capsule_id AND VN.verifier_id = $1
            WHERE 
                T2.user_id = $1 
                AND T2.role_type = 'verifier'
                AND T1.status != 'unlocked'  -- 이미 개봉된 캡슐은 제외
                AND T1.unlock_date <= NOW()  -- 개봉일이 도래한 캡슐만
                AND VN.note_id IS NULL  -- 이미 승인한 캡슐은 제외
            ORDER BY T1.unlock_date ASC;
        `;
        
        const result = await client.query(selectQuery, [verifierId]);

        return NextResponse.json({
            message: "✅ 인증 대기 캡슐 목록 조회 성공",
            capsules: result.rows,
        }, { status: 200 });

    } catch (error) {
        console.error("🚨 Verifier GET API 내부 서버 오류:", error);
        return NextResponse.json({
            message: "❌ 캡슐 목록 조회 처리 실패: 서버 로그를 확인하세요.",
            error: (error instanceof Error) ? error.message : String(error), 
        }, { status: 500 });
    } finally {
        if (client) {
            client.release();
        }
    }
}


// =========================================================================
// 2. 캡슐 개봉 승인 및 인증 메모 작성 (POST - Transaction)
// =========================================================================

/**
 * @summary 개봉일이 도래한 캡슐을 승인하고, 인증 메모를 기록합니다. (트랜잭션 처리)
 */
export async function POST(request: Request) {
    let client: PoolClient | null = null;

    // 1. 현재 사용자 ID 추출 (인증자 ID)
    const verifierId = getUserIdFromToken(request);
    if (verifierId === null) {
        return NextResponse.json({ message: "❌ 인증 정보가 유효하지 않습니다." }, { status: 401 });
    }

    try {
        // note_content는 DB 스키마에서 'note' 컬럼에 대응됩니다.
        const { capsule_id, note_content } = await request.json(); 

        if (!capsule_id || note_content === undefined) {
            return NextResponse.json({ message: "❌ 'capsule_id'와 'note_content'는 필수 항목입니다." }, { status: 400 });
        }

        client = await pool.connect();
        
        // 2. 트랜잭션 시작 (원자성 확보)
        await client.query('BEGIN');

        // 3. 인증 권한 확인 (CAPSULE_ROLE 체크)
        const authCheckQuery = `
            SELECT 1 FROM "CAPSULE_ROLE"
            WHERE capsule_id = $1 AND user_id = $2 AND role_type = 'verifier';
        `;
        const authCheck = await client.query(authCheckQuery, [capsule_id, verifierId]);

        if (authCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json({
                message: "❌ 권한 없음: 해당 캡슐의 인증자로 지정되지 않았습니다.",
            }, { status: 403 });
        }
        
        // 4. 캡슐 상태 및 개봉일 확인 (상태는 변경하지 않음)
        const capsuleCheck = await client.query(
            `SELECT status, unlock_date FROM "CAPSULE" WHERE capsule_id = $1`,
            [capsule_id]
        );

        if (capsuleCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json({
                message: "❌ 캡슐을 찾을 수 없습니다.",
            }, { status: 404 });
        }

        const capsule = capsuleCheck.rows[0];
        
        // 개봉일 확인
        if (new Date() < new Date(capsule.unlock_date)) {
            await client.query('ROLLBACK');
            return NextResponse.json({
                message: "❌ 개봉일이 도래하지 않았습니다.",
            }, { status: 403 });
        }

        // 이미 개봉된 경우
        if (capsule.status === 'unlocked') {
            await client.query('ROLLBACK');
            return NextResponse.json({
                message: "❌ 이미 개봉된 캡슐입니다.",
            }, { status: 400 });
        }

        // 5. 중복 승인 방지: 이미 이 인증자가 승인했는지 확인
        const existingApproval = await client.query(
            `SELECT note_id FROM "VERIFICATION_NOTE" 
             WHERE capsule_id = $1 AND verifier_id = $2`,
            [capsule_id, verifierId]
        );

        if (existingApproval.rows.length > 0) {
            await client.query('ROLLBACK');
            return NextResponse.json({
                message: "❌ 이미 이 캡슐에 대해 승인하셨습니다. 중복 승인은 불가능합니다.",
            }, { status: 400 });
        }

        // 6. 인증 메모 작성 (VERIFICATION_NOTE 테이블 사용 및 컬럼명 수정)
        // verifier_id와 note 컬럼을 사용합니다.
        // UNIQUE 제약이 없으므로 중복 체크 후 INSERT
        const insertNoteQuery = `
            INSERT INTO "VERIFICATION_NOTE" 
                (capsule_id, verifier_id, note, created_at)
            VALUES ($1, $2, $3, NOW());
        `;
        await client.query(insertNoteQuery, [capsule_id, verifierId, note_content]); // JS 변수 note_content 사용

        // 6. 트랜잭션 커밋
        await client.query('COMMIT');

        return NextResponse.json({
            message: `✅ 캡슐 (ID: ${capsule_id}) 인증 승인 및 메모 작성 성공. 이제 소유자나 참여자가 개봉하기 버튼을 눌러야 캡슐이 개봉됩니다.`,
            capsule_id: capsule_id,
        }, { status: 200 });

    } catch (error) {
        console.error("🚨 Verifier POST (승인) API 내부 서버 오류:", error);
        
        // 오류 발생 시 롤백 시도
        if (client) {
            try {
                await client.query('ROLLBACK');
                console.log("트랜잭션 롤백 완료.");
            } catch (rollbackError) {
                console.error("트랜잭션 롤백 실패:", rollbackError);
            }
        }
        
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        return NextResponse.json({
            message: "❌ 캡슐 승인 처리 실패: 서버 로그를 확인하세요.",
            error: errorMessage, 
        }, { status: 500 });
    } finally {
        if (client) {
            client.release();
        }
    }
}
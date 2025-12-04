import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// Pool 인스턴스는 index.ts에서 주입받아 사용합니다.
export const createCapsuleRouter = (pool: Pool): Router => {
    const router = Router();

    /**
     * 임시 인증 미들웨어 (실제로는 JWT 등을 사용해야 합니다.)
     * 요청 본문에서 currentUserId를 가져와 req.user.id로 설정한다고 가정합니다.
     */
    const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
        // 실제 인증 로직 (토큰 확인, 사용자 ID 추출 등)
        const currentUserId = req.body.currentUserId || 1; // 임시 사용자 ID 설정

        if (!currentUserId) {
            return res.status(401).send({ message: '인증되지 않은 사용자입니다.' });
        }
        // 타입스크립트의 Request 객체에 사용자 정보를 추가하기 위해 타입 확장이 필요하지만,
        // 여기서는 간단히 req.body를 통해 ID를 사용하거나, 임시로 ID를 설정합니다.
        (req as any).user = { id: currentUserId }; 
        next();
    };


    /* --------------------------------------------------
     * 1. USERS 엔드포인트
     * -------------------------------------------------- */

    // 사용자 등록 (이전과 동일)
    router.post('/users/register', async (req: Request, res: Response) => {
        const { username, password, email } = req.body;
        if (!username || !password || !email) {
            return res.status(400).send({ message: '필수 필드를 모두 입력해주세요.' });
        }

        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const result = await pool.query(
                'INSERT INTO "USERS" (username, hashed_password, email) VALUES ($1, $2, $3) RETURNING user_id, username, email, join_date',
                [username, hashedPassword, email]
            );

            res.status(201).send({ 
                message: '사용자 등록 성공', 
                user: result.rows[0] 
            });
        } catch (error) {
            const err = error as any;
            if (err.code === '23505') {
                return res.status(409).send({ message: '이미 존재하는 사용자 이름 또는 이메일입니다.' });
            }
            console.error('사용자 등록 오류:', error);
            res.status(500).send({ message: '서버 오류' });
        }
    });


    /* --------------------------------------------------
     * 2. CAPSULE 엔드포인트
     * -------------------------------------------------- */

    // 새로운 캡슐 생성 (이전과 동일)
    router.post('/capsules', authMiddleware, async (req: Request, res: Response) => {
        const { title, content, unlock_date } = req.body;
        const ownerId = (req as any).user.id; // authMiddleware에서 설정된 ID

        if (!title || !unlock_date) {
            return res.status(400).send({ message: '제목과 개봉일은 필수입니다.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. CAPSULE 테이블에 삽입
            const capsuleRes = await client.query(
                'INSERT INTO "CAPSULE" (owner_id, title, content, status, unlock_date) VALUES ($1, $2, $3, $4, $5) RETURNING capsule_id',
                [ownerId, title, content, 'draft', unlock_date]
            );
            const capsuleId = capsuleRes.rows[0].capsule_id;

            // 2. CAPSULE_ROLE 테이블에 생성자(creator) 역할 추가
            await client.query(
                'INSERT INTO "CAPSULE_ROLE" (capsule_id, user_id, role_type) VALUES ($1, $2, $3)',
                [capsuleId, ownerId, 'creator']
            );

            await client.query('COMMIT');
            res.status(201).send({ message: '캡슐이 성공적으로 생성되었습니다.', capsuleId });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('캡슐 생성 오류:', error);
            res.status(500).send({ message: '캡슐 생성 중 서버 오류 발생' });
        } finally {
            client.release();
        }
    });

    /* --------------------------------------------------
     * 3. VERIFIER 대시보드 엔드포인트 (신규 추가)
     * -------------------------------------------------- */

    // 현재 사용자가 인증자로 지정된 모든 캡슐 목록 조회
    router.get('/verifier/capsules', authMiddleware, async (req: Request, res: Response) => {
        const userId = (req as any).user.id;

        try {
            const query = `
                SELECT
                    c.capsule_id,
                    c.title,
                    c.status,
                    c.unlock_date,
                    u.username AS owner_name,
                    -- Verifier의 현재 인증 상태를 가져옵니다.
                    COALESCE(vs.verify_status, 'pending') AS user_verify_status
                FROM
                    "CAPSULE" c
                JOIN
                    "CAPSULE_ROLE" cr ON c.capsule_id = cr.capsule_id
                JOIN
                    "USERS" u ON c.owner_id = u.user_id -- 소유자 이름 조인
                LEFT JOIN 
                    "CAPSULE_VERIFY_STATUS" vs ON c.capsule_id = vs.capsule_id AND vs.verifier_id = $1
                WHERE
                    cr.user_id = $1 AND cr.role_type = 'verifier'
                ORDER BY
                    c.unlock_date ASC;
            `;
            const result = await pool.query(query, [userId]);

            res.send({ 
                message: '인증할 캡슐 목록 조회 성공', 
                capsules: result.rows 
            });
        } catch (error) {
            console.error('인증할 캡슐 목록 조회 오류:', error);
            res.status(500).send({ message: '캡슐 목록 조회 중 서버 오류 발생' });
        }
    });


    /* --------------------------------------------------
     * 4. CO-SIGNER 서명 엔드포인트 (이전과 동일)
     * -------------------------------------------------- */

    // Co-signer 서명 상태 업데이트
    router.post('/capsules/:capsuleId/sign', authMiddleware, async (req: Request, res: Response) => {
        const capsuleId = req.params.capsuleId;
        const signerId = (req as any).user.id;
        const { sign_status, reason } = req.body;

        if (!['approved', 'rejected'].includes(sign_status)) {
            return res.status(400).send({ message: '서명 상태는 approved 또는 rejected여야 합니다.' });
        }
        
        try {
            const result = await pool.query(
                // 서명이 이미 존재하면 업데이트, 없으면 삽입 (UPSERT)
                `INSERT INTO "CAPSULE_SIGN" (capsule_id, signer_id, sign_status, reason)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (capsule_id, signer_id)
                DO UPDATE SET sign_status = $3, reason = $4, sign_id = EXCLUDED.sign_id
                RETURNING sign_id, sign_status`,
                [capsuleId, signerId, sign_status, reason]
            );

            res.send({ message: '서명 상태가 업데이트되었습니다.', signData: result.rows[0] });
        } catch (error) {
            console.error('서명 업데이트 오류:', error);
            res.status(500).send({ message: '서명 처리 중 서버 오류 발생' });
        }
    });


    /* --------------------------------------------------
     * 5. VERIFIER 인증 엔드포인트 (이전과 동일)
     * -------------------------------------------------- */

    // Verifier 인증 상태 업데이트 (개봉 승인/거부)
    router.post('/capsules/:capsuleId/verify', authMiddleware, async (req: Request, res: Response) => {
        const capsuleId = req.params.capsuleId;
        const verifierId = (req as any).user.id;
        const { verify_status, note } = req.body; // note는 선택 사항

        if (!['approved', 'rejected'].includes(verify_status)) {
            return res.status(400).send({ message: '인증 상태는 approved 또는 rejected여야 합니다.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. CAPSULE_VERIFY_STATUS 테이블에 인증 상태 기록 또는 업데이트 (UPSERT)
            const verifyStatusQuery = `
                INSERT INTO "CAPSULE_VERIFY_STATUS" (capsule_id, verifier_id, verify_status)
                VALUES ($1, $2, $3)
                ON CONFLICT (capsule_id, verifier_id) 
                DO UPDATE SET verify_status = $3, verified_at = CURRENT_TIMESTAMP
                RETURNING verify_id
            `;
            const statusRes = await client.query(verifyStatusQuery, [capsuleId, verifierId, verify_status]);
            const verifyId = statusRes.rows[0].verify_id;

            // 2. CAPSULE_VERIFY_NOTE 테이블에 메모 기록/업데이트 (verify_id는 UNIQUE 제약이 있으므로 UPSERT 사용)
            if (note) {
                const noteQuery = `
                    INSERT INTO "CAPSULE_VERIFY_NOTE" (verify_id, verifier_id, note)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (verify_id)
                    DO UPDATE SET note = $3, created_at = CURRENT_TIMESTAMP
                    WHERE "CAPSULE_VERIFY_NOTE".verify_id = $1
                `;
                await client.query(noteQuery, [verifyId, verifierId, note]);
            }
            
            // 3. (추가 로직) 모든 Verifier가 승인했는지 확인하고 캡슐 상태 업데이트
            // ... (생략)
            
            await client.query('COMMIT');
            res.send({ message: '캡슐 인증 상태가 성공적으로 기록/업데이트되었습니다.', verifyId, status: verify_status });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('캡슐 인증 처리 오류:', error);
            res.status(500).send({ message: '인증 처리 중 서버 오류 발생' });
        } finally {
            client.release();
        }
    });

    return router;
};
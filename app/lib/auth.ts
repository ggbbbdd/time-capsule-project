import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || "secret_key_placeholder";

// 로그인한 사용자 ID 리턴
export async function getAuthenticatedUserId(request: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return null;

    const decoded = jwt.verify(token, SECRET_KEY) as { userId: number };

    return decoded.userId ?? null;
  } catch (err) {
    return null;
  }
}

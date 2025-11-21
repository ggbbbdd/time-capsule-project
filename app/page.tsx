import UserAuthInterface from '@/UserAuthInterface'; 

/**
 * @summary Next.js 메인 페이지 (Server Component)
 * @description 사용자 인증 UI를 렌더링하여 로그인 화면이 가장 먼저 보이도록 합니다.
 * @note DB 모니터링 코드는 이 파일에서 완전히 제거되었습니다.
 */
async function Home() {
  
  // UserAuthInterface는 클라이언트 컴포넌트입니다.
  return (
    // <UserAuthInterface /> 컴포넌트가 min-h-screen을 가지고 있어 전체 화면을 차지합니다.
    <UserAuthInterface />
  );
}

export default Home;

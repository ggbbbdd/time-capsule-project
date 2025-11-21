'use client'; // 클라이언트 컴포넌트 (Hooks 사용 가능)

import React, { useState, useCallback, useEffect } from 'react';

// ----------------------------------------------------
// 인라인 SVG 아이콘 정의 (lucide-react 대체)
// ----------------------------------------------------
const Icon = ({ children, size = 24, className = "" }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        {children}
    </svg>
);

const LogIn = (props) => (
    <Icon {...props}>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" x2="3" y1="12" y2="12" />
    </Icon>
);

const UserPlus = (props) => (
    <Icon {...props}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" x2="19" y1="8" y2="14" />
        <line x1="22" x2="16" y1="11" y2="11" />
    </Icon>
);

const Zap = (props) => (
    <Icon {...props}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Icon>
);

const LogOut = (props) => (
    <Icon {...props}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" x2="9" y1="12" y2="12" />
    </Icon>
);

// ----------------------------------------------------
// API 요청 함수 (재사용을 위해 분리)
// ----------------------------------------------------
const callApi = async (url, method, data = null) => {
  try {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : null,
    };

    const response = await fetch(url, options);
    const json = await response.json();

    if (!response.ok) {
      // 4xx, 5xx 에러 처리
      throw new Error(json.message || `API 요청 실패: ${response.status}`);
    }

    return json;

  } catch (error) {
    console.error('API Error:', error);
    // 에러 객체가 메시지를 가지고 있지 않을 경우를 대비
    if (error instanceof Error) {
        throw error;
    }
    throw new Error("네트워크 요청 중 알 수 없는 에러가 발생했습니다.");
  }
};

// ----------------------------------------------------
// 1. 인증 폼 컴포넌트 (로그인/회원가입)
// ----------------------------------------------------
const AuthForm = ({ isRegistering, setIsRegistering, setUser }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 비밀번호 최소 길이 상수 정의
  const MIN_PASSWORD_LENGTH = 8;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true);

    // --- 클라이언트 측 유효성 검사 (회원가입 시) ---
    if (isRegistering && password.length < MIN_PASSWORD_LENGTH) {
        setMessage(`❌ 회원가입 실패: 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
        setIsLoading(false);
        setPassword('');
        return; 
    }
    // ---------------------------------------------

    const endpoint = isRegistering ? '/api/users' : '/api/auth/login';

    try {
      if (isRegistering) {
        // --- 회원가입 (POST /api/users) ---
        const result = await callApi(endpoint, 'POST', { username, email, password });
        setMessage(`✅ ${result.message} (User ID: ${result.user.user_id})`);
        
        // 성공 후 로그인 화면으로 전환 제안
        setTimeout(() => {
            setIsRegistering(false);
            setEmail(result.user.email); // 가입한 이메일을 로그인 폼에 미리 채워줍니다.
            setUsername('');
        }, 1500); 

      } else {
        // --- 로그인 (POST /api/auth/login - 구현된 API 호출) ---
        const result = await callApi(endpoint, 'POST', { email, password });
        
        // 1. 토큰 및 사용자 정보 저장 (Local Storage)
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('userId', result.user_id);
        localStorage.setItem('username', result.username);

        // 2. 상위 컴포넌트 상태 업데이트
        setUser({
            id: result.user_id,
            username: result.username,
            token: result.token,
        });

        setMessage(`🎉 로그인 성공! Welcome, ${result.username}`);
      }
    } catch (error) {
      setMessage(`❌ 처리 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
      setPassword(''); // 보안을 위해 비밀번호 필드 초기화
    }
  }, [isRegistering, username, email, password, setIsRegistering, setUser]);

  const buttonText = isRegistering ? '계정 생성 (회원가입)' : '로그인';
  const icon = isRegistering ? <UserPlus size={20} className="mr-2" /> : <LogIn size={20} className="mr-2" />;

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl transition-all duration-300">
      <div className="flex flex-col items-center">
        <Zap className="w-10 h-10 text-indigo-600 mb-2" />
        <h1 className="text-3xl font-extrabold text-gray-900">
          {isRegistering ? '타임캡슐 계정 등록' : '타임캡슐 로그인'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {isRegistering ? '새로운 캡슐 여정을 시작하세요' : '당신의 캡슐을 확인하세요'}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {isRegistering && (
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">사용자 이름</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">이메일 주소</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            비밀번호 (최소 {MIN_PASSWORD_LENGTH}자)
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            // 클라이언트 측에서 최소 길이 피드백 제공
            minLength={MIN_PASSWORD_LENGTH}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
          />
        </div>

        {message && (
          <div className={`p-3 text-sm rounded-lg ${message.startsWith('❌') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
        >
          {isLoading ? '처리 중...' : (
            <>
              {icon}
              <span className="ml-2">{buttonText}</span>
            </>
          )}
        </button>
      </form>

      <div className="text-sm text-center">
        <button
          onClick={() => {
            setIsRegistering(!isRegistering);
            setMessage('');
            setUsername('');
            // 이메일은 유지
            setPassword('');
          }}
          className="font-medium text-indigo-600 hover:text-indigo-500 transition duration-150"
        >
          {isRegistering ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
        </button>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 2. 로그인 후 대시보드 컴포넌트
// ----------------------------------------------------
const Dashboard = ({ user, setUser }) => {
    const handleLogout = () => {
        // Local Storage에서 인증 정보 제거
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        // 상태 초기화 -> AuthForm 표시
        setUser(null);
    };

    return (
        <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-xl shadow-2xl">
            <h1 className="text-3xl font-extrabold text-indigo-600">
                <Zap className="inline-block w-8 h-8 mr-2" />
                타임캡슐 대시보드
            </h1>
            <h2 className="text-xl font-semibold text-gray-900">환영합니다, {user.username}님!</h2>
            <div className="space-y-2 text-gray-700">
                <p><strong>인증 ID:</strong> <span className="font-mono bg-gray-100 p-1 rounded text-sm">{user.id}</span></p>
                <p>
                    <strong>인증 토큰:</strong> 
                    <span className="font-mono bg-gray-100 p-1 rounded text-xs break-words block mt-1">
                        {user.token.substring(0, 50)}...
                    </span>
                </p>
                <p className="text-sm pt-2 border-t mt-4 text-gray-500">
                    이제 이 토큰을 사용하여 캡슐 $\text{API}$ (생성, 조회 등)를 호출할 수 있습니다.
                </p>
            </div>
            
            <button
                onClick={handleLogout}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-150 mt-6"
            >
                <LogOut size={20} className="mr-2" />
                로그아웃
            </button>
        </div>
    );
};


// ----------------------------------------------------
// 3. 메인 앱 컴포넌트
// ----------------------------------------------------
const UserAuthInterface = () => {
  const [isRegistering, setIsRegistering] = useState(true);
  // 인증된 사용자 정보를 저장하는 상태: null이면 미인증, 객체면 인증됨
  const [user, setUser] = useState(null); 

  // 컴포넌트 마운트 시 LocalStorage에서 인증 정보 확인
  useEffect(() => {
    // LocalStorage는 Client Component에서만 접근 가능합니다.
    try {
        const storedToken = localStorage.getItem('authToken');
        const storedUserId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');

        if (storedToken && storedUserId && storedUsername) {
            setUser({
                id: storedUserId,
                username: storedUsername,
                token: storedToken,
            });
            // 로그인 성공 시 바로 대시보드를 보여주기 위해 isRegistering을 false로 설정 (선택 사항)
            setIsRegistering(false); 
        }
    } catch (error) {
        console.warn("LocalStorage 접근 실패 (SSR 환경 또는 권한 문제):", error);
    }
  }, []); // Run only once on mount

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans antialiased">
      {/* Tailwind CSS CDN 로드 */}
      <script src="https://cdn.tailwindcss.com"></script>
      
      {user ? (
          // 로그인 상태 -> 대시보드 표시
          <Dashboard user={user} setUser={setUser} />
      ) : (
          // 미로그인 상태 -> 인증 폼 표시
          <AuthForm 
              isRegistering={isRegistering} 
              setIsRegistering={setIsRegistering} 
              setUser={setUser} 
          />
      )}
    </div>
  );
};

export default UserAuthInterface;
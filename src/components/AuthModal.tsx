import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Lock, User as UserIcon, Sparkles, Loader2, Disc, Mail, AlertTriangle, Settings2, Info } from 'lucide-react';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);

  // Form states
  const [identifier, setIdentifier] = useState(''); // username or email for login
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google OAuth Client ID state
  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('soundify_google_client_id') || '');

  if (!isOpen) return null;

  // Real Email validation
  const validateRealEmail = (mail: string): { valid: boolean; reason?: string } => {
    const trimmed = mail.trim().toLowerCase();
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      return { valid: false, reason: 'Email phải có ký tự @ và tên miền (ví dụ: .com, .vn)' };
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, reason: 'Địa chỉ email chứa ký tự không hợp lệ' };
    }
    const domain = trimmed.split('@')[1];
    const validProviders = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'edu.vn'];
    // Warning for suspicious fake domains
    if (!domain.includes('.')) {
      return { valid: false, reason: 'Tên miền email không tồn tại' };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister) {
      const emailCheck = validateRealEmail(registerEmail);
      if (!emailCheck.valid) {
        setError(emailCheck.reason || 'Email không hợp lệ');
        return;
      }
      if (password.length < 6) {
        setError('Mật khẩu phải từ 6 ký tự trở lên');
        return;
      }
      if (registerUsername.trim().length < 3) {
        setError('Tên tài khoản phải từ 3 ký tự trở lên');
        return;
      }

      setLoading(true);
      try {
        const user = await invoke<User>('auth_register', {
          username: registerUsername.trim(),
          email: registerEmail.trim().toLowerCase(),
          password,
          displayName: displayName.trim() || registerUsername.trim(),
        });
        onSuccess(user);
        onClose();
      } catch (err: unknown) {
        setError(typeof err === 'string' ? err : 'Đăng ký thất bại');
      } finally {
        setLoading(false);
      }

    } else {
      // Login by Username or Email
      if (!identifier.trim()) {
        setError('Vui lòng nhập Email hoặc Tên tài khoản');
        return;
      }

      setLoading(true);
      try {
        const user = await invoke<User>('auth_login', {
          username: identifier.trim(),
          password,
        });
        onSuccess(user);
        onClose();
      } catch (err: unknown) {
        setError(typeof err === 'string' ? err : 'Tài khoản hoặc mật khẩu không đúng');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoogleOAuthClick = async () => {
    setError(null);

    // Check if user accidentally pasted an email into client_id
    if (googleClientId.includes('@')) {
      setError('⚠️ Bạn đang nhập địa chỉ Email vào ô Client ID. Google Client ID phải có dạng: xxxxx.apps.googleusercontent.com');
      setShowGoogleHelp(true);
      return;
    }

    if (!googleClientId.trim()) {
      setShowGoogleHelp(true);
      return;
    }

    setLoading(true);
    try {
      localStorage.setItem('soundify_google_client_id', googleClientId.trim());
      const user = await invoke<User>('auth_start_google_oauth', {
        customClientId: googleClientId.trim(),
        clientSecret: null,
      });
      onSuccess(user);
      onClose();
    } catch (err: unknown) {
      setError(typeof err === 'string' ? err : 'Đăng nhập Google thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#080808] border border-[#1e1e1e] rounded-2xl p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-[#181818] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffe600] to-[#00e5ff] text-black flex items-center justify-center mx-auto mb-2 shadow-[0_0_12px_rgba(255,230,0,0.35)]">
            <Disc className="w-6 h-6 text-black" />
          </div>
          <h2 className="text-base font-black tracking-tight text-white uppercase flex items-center justify-center gap-1.5">
            SPYTIFY ACCOUNT
          </h2>
          <p className="text-[11px] text-[#00e5ff] font-mono">SQLite Local Auth • Hoạt động 100% Offline</p>
        </div>

        {/* Google OAuth Help / Config Modal */}
        {showGoogleHelp ? (
          <div className="space-y-3">
            <div className="p-3 bg-[#121212] rounded-xl border border-[#222]">
              <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
                <Info className="w-4 h-4 text-[#00e5ff]" />
                <span>Vì sao Google báo lỗi 400?</span>
              </div>
              <p className="text-[11px] text-[#888] leading-relaxed">
                Google chỉ cho phép đăng nhập qua API khi có <b>Google Client ID</b> (do Google Cloud Console cấp).
                <br /><br />
                <span className="text-red-400 font-semibold">Lưu ý:</span> Không điền địa chỉ email cá nhân vào ô Client ID.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#777] mb-1 font-mono">
                Google Client ID (Dành cho Developer)
              </label>
              <input
                type="text"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                placeholder="xxxxxx.apps.googleusercontent.com"
                className="w-full px-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#00e5ff] outline-none font-mono"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGoogleHelp(false)}
                className="flex-1 py-2 rounded-lg bg-[#141414] text-[#888] hover:text-white text-xs font-semibold cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleGoogleOAuthClick}
                disabled={loading || !googleClientId.trim()}
                className="flex-1 py-2 rounded-lg bg-[#00e5ff] text-black text-xs font-bold uppercase cursor-pointer hover:bg-white transition-colors disabled:opacity-50"
              >
                Thử lại Google
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setShowGoogleHelp(false); setIsRegister(true); }}
                className="text-xs text-[#00e5ff] hover:underline cursor-pointer"
              >
                👉 Khuyên dùng: Đăng ký trực tiếp bằng Email của bạn bên dưới
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleOAuthClick}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#141414] hover:bg-[#1a1a1a] text-white font-semibold text-xs rounded-xl border border-[#262626] transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm mb-4"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Đăng nhập với Google OAuth</span>
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-[#181818]" />
              <span className="text-[10px] text-[#555] uppercase font-mono">hoặc đăng nhập bằng Email</span>
              <div className="flex-1 h-px bg-[#181818]" />
            </div>

            {/* Tabs: Login / Register */}
            <div className="flex border-b border-[#181818] mb-4">
              <button
                onClick={() => { setIsRegister(false); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer ${
                  !isRegister
                    ? 'text-white border-b-2 border-[#00e5ff]'
                    : 'text-[#666] hover:text-[#999]'
                }`}
              >
                Đăng nhập
              </button>
              <button
                onClick={() => { setIsRegister(true); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer ${
                  isRegister
                    ? 'text-white border-b-2 border-[#00e5ff]'
                    : 'text-[#666] hover:text-[#999]'
                }`}
              >
                Đăng ký tài khoản
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-4 p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {isRegister ? (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                      Email thật của bạn
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        placeholder="tenban@gmail.com"
                        className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#00e5ff] outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                      Tên tài khoản (Username)
                    </label>
                    <div className="relative flex items-center">
                      <UserIcon className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={registerUsername}
                        onChange={(e) => setRegisterUsername(e.target.value)}
                        placeholder="Ví dụ: minhtri2025"
                        className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#00e5ff] outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                      Tên hiển thị (Tùy chọn)
                    </label>
                    <div className="relative flex items-center">
                      <UserIcon className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ví dụ: Minh Trí"
                        className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#00e5ff] outline-none transition-colors"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                    Email hoặc Tên tài khoản
                  </label>
                  <div className="relative flex items-center">
                    <UserIcon className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Email hoặc username của bạn"
                      className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#00e5ff] outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                  Mật khẩu
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#00e5ff] outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-[#ffe600] to-[#00e5ff] hover:opacity-95 text-black font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(255,230,0,0.3)] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isRegister ? 'Tạo tài khoản ngay' : 'Đăng nhập'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        <p className="text-[10px] text-[#444] text-center mt-4">
          Tài khoản lưu trữ an toàn trong SQLite nội bộ tại AppData, bảo mật 100%
        </p>
      </div>
    </div>
  );
};

"use client";


import Link from "next/link";
import { useState, useEffect } from "react";
import { Lock, Unlock, User, Loader2, Smartphone, KeyRound } from "lucide-react";
import { authApi, authExtraApi, publicApi } from "../lib/api";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stars, setStars] = useState([]);
  const [mode, setMode] = useState("password"); // password | otp | forgot | verify
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [mobile, setMobile] = useState("");
  const [info, setInfo] = useState(null);
  const [institute, setInstitute] = useState(null);

  useEffect(() => { publicApi.institute().then(setInstitute).catch(() => {}); }, []);

  function finish(data) {
    localStorage.setItem("edumanage-token", data.token);
    localStorage.setItem("edumanage-user", JSON.stringify(data.user));
    onLoginSuccess(data.user);
  }

  async function requestOtp(e) {
    e.preventDefault();
    try {
      setLoading(true); setError(null);
      const d = await authExtraApi.otpRequest(mobile);
      setChallenge(d.challenge); setMode("verify");
      setInfo(d.devCode ? `Development code: ${d.devCode}` : "Enter the 6-digit code sent to your mobile.");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  // Quick sign-in with mobile + PIN set after a full login.
  async function pinLogin(e) {
    e.preventDefault();
    try {
      setLoading(true); setError(null);
      finish(await authExtraApi.pinLogin(mobile, code));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function verifyCode(e) {
    e.preventDefault();
    try {
      setLoading(true); setError(null);
      const d = mode === "verify2fa" ? await authExtraApi.verify2fa(challenge, code) : await authExtraApi.otpVerify(challenge, code);
      finish(d);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function forgot(e) {
    e.preventDefault();
    try {
      setLoading(true); setError(null);
      const r = await authExtraApi.forgot(email);
      setInfo(r?.data?.devToken ? `Development reset link: /reset-password?token=${r.data.devToken}` : r?.message || "If the account exists, reset instructions were sent.");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  useEffect(() => {
    // Generate starry sky coordinates on mount to prevent SSR mismatch
    const generatedStars = Array.from({ length: 90 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 62}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 0.8,
      opacity: Math.random() * 0.7 + 0.3,
      delay: Math.random() * 5,
      type: Math.random() > 0.88 ? "sparkle" : "dot",
    }));
    setStars(generatedStars);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter username and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await authApi.login(email, password);
      
      if (data && data.requiresOtp) {
        setChallenge(data.challenge);
        setMode("verify2fa");
        setInfo(data.devCode ? `Development code: ${data.devCode}` : `Enter the code sent to ${data.maskedPhone || "your mobile"}.`);
      } else if (data && data.token) {
        finish(data);
      } else {
        setError("Invalid credentials returned.");
      }
    } catch (err) {
      console.error("Login failure:", err);
      setError(err?.message || "Email or password is incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail("admin@school.edu");
    setPassword("Admin@123");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e0b5d] via-[#1a053c] to-[#0a001a] px-4 py-12 overflow-hidden font-sans select-none">
      
      {/* Dynamic Starry Sky */}
      {stars.map((star) => (
        star.type === "sparkle" ? (
          <svg
            key={star.id}
            className="absolute pointer-events-none text-white fill-current animate-pulse"
            style={{
              top: star.top,
              left: star.left,
              width: `${star.size * 5}px`,
              height: `${star.size * 5}px`,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
              animationDuration: "4s",
              transform: "translate(-50%, -50%)",
            }}
            viewBox="0 0 24 24"
          >
            <path d="M12 0 Q12 12 24 12 Q12 12 12 24 Q12 12 0 12 Q12 12 12 0 Z" />
          </svg>
        ) : (
          <div
            key={star.id}
            className="absolute bg-white rounded-full pointer-events-none animate-pulse"
            style={{
              top: star.top,
              left: star.left,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
              animationDuration: "3s",
            }}
          />
        )
      ))}

      {/* Vibrant Indigo/Purple Glow directly behind the login card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-[#591ec0] opacity-[0.38] blur-[110px] pointer-events-none" />

      {/* Mountain & Pine Forest Silhouettes Layer at the Bottom */}
      <svg className="absolute bottom-0 left-0 w-full h-[320px] pointer-events-none" viewBox="0 0 1440 320" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <g id="pine-1" fill="#0f011b">
            <path d="M 0,-40 L 8,-20 L 3,-20 L 14,0 L 7,0 L 20,25 Q 0,25 -20,25 L -7,0 L -14,0 L -3,-20 L -8,-20 Z" />
          </g>
          <g id="pine-2" fill="#0a0014">
            <path d="M 0,-50 L 10,-25 L 4,-25 L 16,5 L 8,5 L 22,35 Q 0,35 -22,35 L -8,5 L -16,5 L -4,-25 L -10,-25 Z" />
          </g>
        </defs>
        
        {/* Back Mountain Range */}
        <path d="M0 320V150 Q 300 90 600 200 T 1200 130 T 1440 180V320H0Z" fill="#3a1c6a" opacity="0.45"/>
        
        {/* Middle Mountain Range */}
        <path d="M0 320V190 Q 400 140 800 230 T 1440 180V320H0Z" fill="#230c44" opacity="0.75"/>
        
        {/* Foreground Pine Trees Left Side */}
        <use href="#pine-1" x="20" y="290" transform="scale(2.3)" />
        <use href="#pine-2" x="65" y="295" transform="scale(1.9)" />
        <use href="#pine-1" x="110" y="300" transform="scale(2.6)" />
        <use href="#pine-2" x="155" y="300" transform="scale(2.1)" />
        <use href="#pine-1" x="200" y="305" transform="scale(1.8)" />
        <use href="#pine-2" x="245" y="310" transform="scale(2.0)" />
        <use href="#pine-1" x="290" y="312" transform="scale(1.5)" />
        <use href="#pine-2" x="335" y="315" transform="scale(1.7)" />
        <use href="#pine-1" x="380" y="318" transform="scale(1.3)" />
        <use href="#pine-2" x="425" y="320" transform="scale(1.1)" />
        <use href="#pine-1" x="470" y="320" transform="scale(0.9)" />

        {/* Foreground Pine Trees Right Side */}
        <use href="#pine-1" x="1420" y="290" transform="scale(2.4)" />
        <use href="#pine-2" x="1375" y="295" transform="scale(2.0)" />
        <use href="#pine-1" x="1330" y="300" transform="scale(2.5)" />
        <use href="#pine-2" x="1285" y="300" transform="scale(2.1)" />
        <use href="#pine-1" x="1240" y="305" transform="scale(1.9)" />
        <use href="#pine-2" x="1195" y="310" transform="scale(1.7)" />
        <use href="#pine-1" x="1150" y="312" strokeWidth={0} />
        <use href="#pine-2" x="1105" y="315" transform="scale(1.4)" />
        <use href="#pine-1" x="1060" y="318" transform="scale(1.2)" />
        <use href="#pine-2" x="1015" y="320" transform="scale(1.0)" />
        <use href="#pine-1" x="970" y="320" transform="scale(0.8)" />
        
        {/* Base dark rect to bridge gaps */}
        <rect x="0" y="318" width="1440" height="2" fill="#0f011b" />
      </svg>

      <div className="relative w-full max-w-[420px] z-10 flex flex-col items-center">
        
        {/* Glassmorphic Login Box */}
        <div className="w-full rounded-[28px] border border-white/15 bg-white/[0.05] px-8 py-9 sm:px-10 sm:py-11 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.65)] backdrop-blur-md transition-all duration-300">
          
          {/* Welcome Text Header above Login */}
          <div className="text-center mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50 mb-1">
              Welcome to
            </p>
            <h1 className="text-2xl font-extrabold text-white tracking-wide">
              {institute?.name || "Smart Educational Institute"}
            </h1>
            <p className="mt-1 text-xs text-white/50">Smart Educational Institute Management System</p>
          </div>

          <div className="w-full h-px bg-white/10 mb-6" />

          <h2 className="text-center text-3xl font-semibold text-white/95 mb-8 tracking-wide">
            Login
          </h2>

          {error && (
            <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
              ⚠️ {error}
            </div>
          )}

          {info && (
            <div className="mb-6 break-words rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100">{info}</div>
          )}

          {mode === "otp" && (
            <form className="space-y-5" onSubmit={requestOtp}>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} required placeholder="Registered mobile (01XXXXXXXXX)"
                className="block w-full rounded-full border border-white/20 bg-transparent py-3.5 pl-6 pr-6 text-base !text-white outline-none placeholder:text-white/60 focus:border-white" />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 font-bold text-[#1b053c] disabled:opacity-75">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Smartphone size={18} />} Send OTP
              </button>
            </form>
          )}

          {mode === "pin" && (
            <form className="space-y-5" onSubmit={pinLogin}>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} required placeholder="Mobile or e-mail"
                className="block w-full rounded-full border border-white/20 bg-transparent py-3.5 pl-6 pr-6 text-base !text-white outline-none placeholder:text-white/60 focus:border-white" />
              <input type="password" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" placeholder="PIN"
                className="block w-full rounded-full border border-white/20 bg-transparent py-3.5 text-center text-2xl tracking-[0.5em] !text-white outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-white/60 focus:border-white" />
              <button type="submit" disabled={loading || code.length < 4} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 font-bold text-[#1b053c] disabled:opacity-75">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <KeyRound size={18} />} Sign in with PIN
              </button>
            </form>
          )}

          {(mode === "verify" || mode === "verify2fa") && (
            <form className="space-y-5" onSubmit={verifyCode}>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" placeholder="6-digit code"
                className="block w-full rounded-full border border-white/20 bg-transparent py-3.5 text-center text-2xl tracking-[0.5em] !text-white outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-white/60 focus:border-white" />
              <button type="submit" disabled={loading || code.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 font-bold text-[#1b053c] disabled:opacity-75">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <KeyRound size={18} />} Verify & sign in
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form className="space-y-5" onSubmit={forgot}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email or mobile"
                className="block w-full rounded-full border border-white/20 bg-transparent py-3.5 pl-6 pr-6 text-base !text-white outline-none placeholder:text-white/60 focus:border-white" />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 font-bold text-[#1b053c] disabled:opacity-75">
                {loading ? <Loader2 className="animate-spin" size={20} /> : null} Send reset link
              </button>
            </form>
          )}

          <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-semibold text-white/70">
            {mode !== "password" && <button type="button" className="hover:text-white" onClick={() => { setMode("password"); setInfo(null); setError(null); }}>Password login</button>}
            {mode !== "otp" && <button type="button" className="hover:text-white" onClick={() => { setMode("otp"); setInfo(null); setError(null); }}>Guardian / mobile OTP login</button>}
            {mode !== "pin" && <button type="button" className="hover:text-white" onClick={() => { setMode("pin"); setCode(""); setInfo(null); setError(null); }}>PIN login</button>}
            {mode !== "forgot" && <button type="button" className="hover:text-white" onClick={() => { setMode("forgot"); setInfo(null); setError(null); }}>Forgot password?</button>}
          </div>

          {mode === "password" && (
          <form className="mt-6 space-y-6" onSubmit={handleSubmit} autoComplete="off">
            
            {/* Username Input Field */}
            <div className="relative">
              <input
                id="email-input"
                name="email"
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="block w-full pl-6 pr-12 py-3.5 rounded-full border border-white/20 bg-transparent !text-white placeholder:text-white/60 outline-none focus:border-white focus:ring-1 focus:ring-white transition text-base font-normal shadow-sm"
                placeholder="Email or mobile"
              />
              <span className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none text-black">
                <User size={18} strokeWidth={2.2} />
              </span>
            </div>

            {/* Password Input Field */}
            <div className="relative">
              <input
                id="password-input"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="block w-full pl-6 pr-12 py-3.5 rounded-full border border-white/20 bg-transparent !text-white placeholder:text-white/60 outline-none focus:border-white focus:ring-1 focus:ring-white transition text-base font-normal shadow-sm"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-5 text-black hover:text-black/80 transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <Unlock size={18} strokeWidth={2.2} /> : <Lock size={18} strokeWidth={2.2} />}
              </button>
            </div>

            {/* Login Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-white hover:bg-white/90 active:scale-[0.99] py-3.5 text-base font-bold text-[#1b053c] shadow-lg transition-all duration-200 disabled:opacity-75"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin text-[#1b053c]" size={20} />
                  Signing In...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>
          )}
        </div>

        <div className="mt-5 flex w-full gap-3">
          <Link href="/apply" className="flex-1 rounded-[18px] border border-white/15 bg-white/[0.05] px-4 py-3 text-center text-sm font-semibold text-white/85 hover:bg-white/10">Online admission</Link>
          <Link href="/result" className="flex-1 rounded-[18px] border border-white/15 bg-white/[0.05] px-4 py-3 text-center text-sm font-semibold text-white/85 hover:bg-white/10">Check result</Link>
        </div>

        {/* Demo Helper Instructions (Click to Autofill) – development builds only */}
        {process.env.NODE_ENV !== "production" && <button
          type="button"
          onClick={handleDemoFill}
          className="text-center text-xs text-white/70 bg-white/[0.03] hover:bg-white/[0.07] px-5 py-3.5 rounded-[20px] border border-white/15 mt-6 backdrop-blur-[2px] w-full transition active:scale-[0.99] cursor-pointer"
        >
          <p className="font-bold text-white mb-0.5">💡 Login Credentials (Click to Autofill):</p>
          <p className="font-semibold text-white/80">admin@school.edu | Password: Admin@123</p>
        </button>}

      </div>
    </div>
  );
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router    = useRouter()
  const supabase  = createClient()

  /* ── Gold Particle Animation ── */
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const cx = cv.getContext('2d')!
    let W = 0, H = 0, raf = 0

    function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight }
    resize(); window.addEventListener('resize', resize)

    class P {
      x=0;y=0;r=0;vx=0;vy=0;a=0;ma=0;life=0;ml=0;gold=false;twinkle=false
      constructor() { this.reset(true) }
      reset(init: boolean) {
        this.x=Math.random()*W; this.y=init?Math.random()*H:H+10
        this.r=Math.random()*1.6+.3; this.vy=-(Math.random()*.7+.15); this.vx=(Math.random()-.5)*.35
        this.a=0; this.ma=Math.random()*.45+.08; this.life=0; this.ml=Math.random()*220+120
        this.gold=Math.random()>.35; this.twinkle=Math.random()<.3
      }
      step() {
        this.life++; this.x+=this.vx; this.y+=this.vy
        const p=this.life/this.ml
        this.a=p<.2?(p/.2)*this.ma:p>.8?((1-p)/.2)*this.ma:this.ma
        if(this.twinkle) this.a*=(.7+.3*Math.sin(this.life*.15))
        if(this.life>=this.ml) this.reset(false)
      }
      draw() {
        cx.save(); cx.globalAlpha=this.a
        const col=this.gold?'rgba(212,160,23,1)':'rgba(255,255,255,1)'
        cx.fillStyle=col; cx.shadowBlur=this.gold?8:4; cx.shadowColor=col
        cx.beginPath(); cx.arc(this.x,this.y,this.r,0,Math.PI*2); cx.fill(); cx.restore()
      }
    }

    const pts = Array.from({length:90},()=>new P())
    function loop() { cx.clearRect(0,0,W,H); pts.forEach(p=>{p.step();p.draw()}); raf=requestAnimationFrame(loop) }
    loop()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize',resize) }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email atau password salah. Coba lagi.'); setLoading(false); return }
    router.push('/dashboard'); router.refresh()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&display=swap');
        @keyframes cardIn{from{opacity:0;transform:translateY(36px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes logoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes glowPulse{0%,100%{opacity:.6;transform:scale(.9)}50%{opacity:1;transform:scale(1.05)}}
        @keyframes btnSweep{0%{left:-100%}55%,100%{left:140%}}
        @keyframes o1{0%,100%{transform:translate(0,0)}33%{transform:translate(70px,50px)}66%{transform:translate(-40px,80px)}}
        @keyframes o2{0%,100%{transform:translate(0,0)}50%{transform:translate(-90px,-70px)}}
        @keyframes o3{0%,100%{transform:translate(0,-25px)}50%{transform:translate(35px,25px)}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%,75%{transform:translateX(-5px)}50%{transform:translateX(5px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .login-btn::after{content:'';position:absolute;top:0;left:-100%;height:100%;width:55%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);animation:btnSweep 3.5s ease 2s infinite}
        .logo-anim{animation:logoFloat 4s ease-in-out infinite}
        .glow-anim{animation:glowPulse 3s ease-in-out infinite}
        input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px rgba(10,7,22,.9) inset!important;-webkit-text-fill-color:#fff!important}
      `}</style>

      {/* Background */}
      <div style={{position:'fixed',inset:0,zIndex:0,background:'radial-gradient(ellipse 90% 55% at 50% -5%,#1A0833 0%,transparent 65%),radial-gradient(ellipse 50% 40% at 15% 85%,rgba(212,160,23,.07) 0%,transparent 60%),radial-gradient(ellipse 40% 40% at 85% 15%,rgba(124,58,237,.09) 0%,transparent 60%),#080612'}}/>

      {/* Orbs */}
      {[
        {style:{width:500,height:500,background:'radial-gradient(circle,rgba(212,160,23,.09),transparent 70%)',top:-150,left:-150,animation:'o1 20s ease-in-out infinite'}},
        {style:{width:350,height:350,background:'radial-gradient(circle,rgba(124,58,237,.08),transparent 70%)',bottom:-100,right:-100,animation:'o2 25s ease-in-out infinite'}},
        {style:{width:220,height:220,background:'radial-gradient(circle,rgba(212,160,23,.07),transparent 70%)',top:'45%',right:'8%',animation:'o3 18s ease-in-out infinite'}},
      ].map((o,i)=>(
        <div key={i} style={{position:'fixed',borderRadius:'50%',filter:'blur(90px)',pointerEvents:'none',zIndex:1,...o.style as any}}/>
      ))}

      <canvas ref={canvasRef} style={{position:'fixed',inset:0,zIndex:2,pointerEvents:'none'}}/>

      {/* Card */}
      <div style={{
        position:'relative',zIndex:10,width:'min(400px,94vw)',
        background:'rgba(10,7,22,.82)',
        backdropFilter:'saturate(180%) blur(40px)',WebkitBackdropFilter:'saturate(180%) blur(40px)',
        border:'1px solid rgba(212,160,23,.18)',borderRadius:28,padding:'40px 36px 36px',
        boxShadow:'0 0 0 1px rgba(212,160,23,.06) inset,0 40px 100px rgba(0,0,0,.7)',
        animation:'cardIn .9s cubic-bezier(.16,1,.3,1) both',
      }}>
        {/* Gold top line */}
        <div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:100,height:1.5,background:'linear-gradient(90deg,transparent,#D4A017,transparent)'}}/>

        {/* Logo */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:32,animation:'fadeUp .7s .15s cubic-bezier(.16,1,.3,1) both'}}>
          <div className="logo-anim" style={{position:'relative'}}>
            <div className="glow-anim" style={{position:'absolute',inset:-20,background:'radial-gradient(circle,rgba(212,160,23,.2) 0%,transparent 70%)'}}/>
            <svg width="120" height="96" viewBox="0 0 120 96" fill="none" style={{filter:'drop-shadow(0 6px 18px rgba(212,160,23,.55)) drop-shadow(0 0 40px rgba(212,160,23,.22))'}}>
              <defs>
                <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FFE066"/><stop offset="40%" stopColor="#D4A017"/><stop offset="100%" stopColor="#8B5E00"/></linearGradient>
                <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FFF0A0"/><stop offset="100%" stopColor="#E8C040"/></linearGradient>
                <linearGradient id="g3" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#C09010"/><stop offset="100%" stopColor="#6B4800"/></linearGradient>
              </defs>
              {/* Row 3 — 3 bars */}
              <path d="M2 96 L20 72 L46 72 L28 96 Z" fill="url(#g1)"/>
              <path d="M2 96 L20 72 L20 80 L2 96 Z" fill="url(#g3)" opacity=".5"/>
              <path d="M20 72 L46 72 L40 65 L14 65 Z" fill="url(#g2)"/>
              <path d="M37 96 L55 72 L75 72 L57 96 Z" fill="url(#g1)"/>
              <path d="M37 96 L55 72 L55 80 L37 96 Z" fill="url(#g3)" opacity=".5"/>
              <path d="M55 72 L75 72 L69 65 L49 65 Z" fill="url(#g2)"/>
              <path d="M72 96 L90 72 L112 72 L94 96 Z" fill="url(#g1)"/>
              <path d="M72 96 L90 72 L90 80 L72 96 Z" fill="url(#g3)" opacity=".5"/>
              <path d="M90 72 L112 72 L106 65 L84 65 Z" fill="url(#g2)"/>
              {/* Row 2 — 2 bars */}
              <path d="M20 65 L36 40 L60 40 L44 65 Z" fill="url(#g1)"/>
              <path d="M20 65 L36 40 L36 50 L20 65 Z" fill="url(#g3)" opacity=".5"/>
              <path d="M36 40 L60 40 L54 33 L30 33 Z" fill="url(#g2)"/>
              <path d="M50 65 L66 40 L90 40 L74 65 Z" fill="url(#g1)"/>
              <path d="M50 65 L66 40 L66 50 L50 65 Z" fill="url(#g3)" opacity=".5"/>
              <path d="M66 40 L90 40 L84 33 L60 33 Z" fill="url(#g2)"/>
              {/* Row 1 — 1 bar */}
              <path d="M35 33 L48 10 L72 10 L59 33 Z" fill="url(#g1)"/>
              <path d="M35 33 L48 10 L48 20 L35 33 Z" fill="url(#g3)" opacity=".5"/>
              <path d="M48 10 L72 10 L66 3 L42 3 Z" fill="url(#g2)"/>
            </svg>
          </div>
          <div style={{fontFamily:'"Cormorant Garamond",Georgia,serif',fontSize:18,fontWeight:600,color:'#F0C040',letterSpacing:2,textAlign:'center',marginTop:12,textShadow:'0 0 20px rgba(212,160,23,.35)'}}>
            PT. EMAS MURNI ASLI
          </div>
          <div style={{fontSize:10,fontWeight:500,color:'rgba(212,160,23,.45)',letterSpacing:3.5,textTransform:'uppercase',marginTop:3}}>
            Production System
          </div>
        </div>

        {/* Heading */}
        <div style={{marginBottom:24,animation:'fadeUp .7s .28s cubic-bezier(.16,1,.3,1) both'}}>
          <h1 style={{fontSize:24,fontWeight:700,color:'#fff',letterSpacing:-.5}}>Selamat Datang</h1>
          <p style={{fontSize:13,color:'rgba(255,255,255,.5)',marginTop:4}}>Masuk untuk mengakses sistem produksi</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:14}}>

          {/* Email */}
          <div style={{animation:'fadeUp .7s .35s cubic-bezier(.16,1,.3,1) both'}}>
            <label style={{display:'block',fontSize:10,fontWeight:700,color:'rgba(212,160,23,.65)',letterSpacing:1.2,textTransform:'uppercase',marginBottom:7}}>Email</label>
            <div style={{position:'relative'}}>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@perusahaan.com" required autoComplete="email"
                style={{width:'100%',height:50,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',borderRadius:14,padding:'0 44px 0 16px',fontSize:15,color:'#fff',fontFamily:'inherit',outline:'none',transition:'all .2s'}}
                onFocus={e=>{e.target.style.borderColor='rgba(212,160,23,.45)';e.target.style.background='rgba(255,255,255,.07)'}}
                onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,.09)';e.target.style.background='rgba(255,255,255,.04)'}}
              />
              <div style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',opacity:.35,fontSize:16,pointerEvents:'none'}}>✉</div>
            </div>
          </div>

          {/* Password */}
          <div style={{animation:'fadeUp .7s .43s cubic-bezier(.16,1,.3,1) both'}}>
            <label style={{display:'block',fontSize:10,fontWeight:700,color:'rgba(212,160,23,.65)',letterSpacing:1.2,textTransform:'uppercase',marginBottom:7}}>Password</label>
            <div style={{position:'relative'}}>
              <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••••" required autoComplete="current-password"
                style={{width:'100%',height:50,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',borderRadius:14,padding:'0 46px 0 16px',fontSize:15,color:'#fff',fontFamily:'inherit',outline:'none',transition:'all .2s'}}
                onFocus={e=>{e.target.style.borderColor='rgba(212,160,23,.45)';e.target.style.background='rgba(255,255,255,.07)'}}
                onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,.09)';e.target.style.background='rgba(255,255,255,.04)'}}
              />
              <button type="button" onClick={()=>setShowPass(!showPass)} style={{position:'absolute',right:13,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,.3)',fontSize:14,padding:4}}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <p style={{fontSize:11.5,color:'rgba(255,255,255,.28)',textAlign:'center',padding:'2px 0',animation:'fadeUp .7s .5s cubic-bezier(.16,1,.3,1) both'}}>
            Belum punya akses? Hubungi <span style={{color:'rgba(212,160,23,.6)',fontWeight:600}}>admin / owner</span>
          </p>

          {error && (
            <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.22)',borderRadius:12,padding:'10px 14px',fontSize:13,color:'#FCA5A5',animation:'shake .4s ease'}}>
              {error}
            </div>
          )}

          {/* Button */}
          <div style={{animation:'fadeUp .7s .56s cubic-bezier(.16,1,.3,1) both'}}>
            <button type="submit" disabled={loading} className="login-btn"
              style={{width:'100%',height:52,background:'linear-gradient(135deg,#D4A017 0%,#8B6400 100%)',border:'none',borderRadius:16,fontSize:15,fontWeight:700,color:'#050310',fontFamily:'inherit',cursor:loading?'not-allowed':'pointer',position:'relative',overflow:'hidden',transition:'transform .15s,box-shadow .15s',boxShadow:'0 4px 22px rgba(212,160,23,.28)',opacity:loading?.7:1}}>
              <span style={{position:'absolute',inset:0,background:'linear-gradient(135deg,rgba(255,255,255,.18) 0%,transparent 55%)',pointerEvents:'none'}}/>
              {loading ? (
                <div style={{width:20,height:20,border:'2.5px solid rgba(5,3,16,.3)',borderTopColor:'#050310',borderRadius:'50%',margin:'auto',animation:'spin .7s linear infinite'}}/>
              ) : 'Masuk Sekarang'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginTop:22,animation:'fadeUp .7s .62s cubic-bezier(.16,1,.3,1) both'}}>
          <div style={{flex:1,height:1,background:'rgba(255,255,255,.06)'}}/>
          <div style={{fontSize:10,color:'rgba(255,255,255,.18)',whiteSpace:'nowrap',letterSpacing:.8}}>INTERNAL ACCESS ONLY</div>
          <div style={{flex:1,height:1,background:'rgba(255,255,255,.06)'}}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center',marginTop:14,fontSize:10.5,color:'rgba(255,255,255,.16)',animation:'fadeUp .7s .68s cubic-bezier(.16,1,.3,1) both'}}>
          🔒 <span style={{color:'rgba(212,160,23,.35)'}}>SSL</span> · <span style={{color:'rgba(212,160,23,.35)'}}>Encrypted</span> · <span style={{color:'rgba(212,160,23,.35)'}}>RBAC</span> · <span style={{color:'rgba(212,160,23,.35)'}}>Audit Log</span>
        </div>
      </div>
    </>
  )
}

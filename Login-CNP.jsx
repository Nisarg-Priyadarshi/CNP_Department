import { useState } from "react";
import { Mail, Lock, ArrowRight, Feather } from "lucide-react";

export default function SkyAuth() {
  const [mode, setMode] = useState("in"); // "in" | "up" — drives the slide position
  const [displayMode, setDisplayMode] = useState("in"); // which form is rendered — swaps at the midpoint
  const [animTick, setAnimTick] = useState(0); // bump to restart the fade-dip animation
  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({ email: "", password: "" });

  const isUp = mode === "up";

  function goTo(next) {
    if (next === mode) return;
    setMode(next);
    setAnimTick((t) => t + 1);
    window.setTimeout(() => setDisplayMode(next), 350);
  }

  return (
    <div className="sky-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600&display=swap');

        .sky-root {
          --sky: #EAF4FC;
          --sky-mid: #DCEEFB;
          --sky-deep: #C7E3F7;
          --white: #FFFFFF;
          --ink: #2B3A4E;
          --ink-soft: #6C7C90;
          --pink: #F2A6C6;
          --pink-soft: #FBDCE9;
          --pink-deep: #E27FA8;

          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(160deg, #F7FBFE 0%, var(--sky) 55%, var(--sky-mid) 100%);
          font-family: 'Inter', sans-serif;
          padding: 40px 20px;
          box-sizing: border-box;
        }
        .sky-root * { box-sizing: border-box; }

        .frame { position: relative; width: 100%; max-width: 560px; }

        /* pink feather corner flourishes */
        .feather-corner {
          position: absolute;
          color: var(--pink);
          opacity: 0.75;
          z-index: 3;
          pointer-events: none;
        }
        .feather-tl { top: -14px; left: -16px; transform: rotate(-25deg); }
        .feather-tr { top: -14px; right: -16px; transform: rotate(115deg) scaleX(-1); }
        .feather-bl { bottom: -14px; left: -16px; transform: rotate(-115deg); }
        .feather-br { bottom: -14px; right: -16px; transform: rotate(25deg) scaleX(-1); }

        .feather-line {
          position: absolute;
          background: linear-gradient(90deg, transparent, var(--pink-deep), transparent);
          height: 1.5px;
        }
        .line-tl { top: 10px; left: -30px; width: 46px; transform: rotate(-18deg); }
        .line-tr { top: 10px; right: -30px; width: 46px; transform: rotate(18deg); }

        .eyebrow-top {
          text-align: center;
          color: var(--pink-deep);
          font-size: 10.5px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .title-top {
          text-align: center;
          font-family: 'Fraunces', serif;
          font-weight: 600;
          color: var(--ink);
          font-size: clamp(22px, 3.6vw, 28px);
          margin: 0 0 26px 0;
          letter-spacing: -0.01em;
        }

        .stage {
          position: relative;
          width: 100%;
          height: 420px;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 30px 70px -24px rgba(88, 140, 190, 0.35), 0 0 0 1px rgba(255,255,255,0.6);
          background: var(--white);
        }

        .info-half {
          position: absolute;
          top: 0;
          width: 50%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          padding: 30px 28px;
          color: var(--ink);
        }
        .info-left { left: 0; background: linear-gradient(160deg, var(--sky) 0%, var(--sky-deep) 100%); }
        .info-right { left: 50%; background: linear-gradient(200deg, var(--sky) 0%, var(--sky-deep) 100%); }

        .info-seal {
          width: 38px; height: 38px; border-radius: 50%;
          background: linear-gradient(160deg, var(--pink-soft), var(--pink));
          display: flex; align-items: center; justify-content: center;
          color: var(--white);
          margin-bottom: 16px;
          box-shadow: 0 6px 14px rgba(226, 127, 168, 0.35);
        }
        .info-half h3 {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 21px;
          margin: 0 0 10px 0;
          color: var(--ink);
        }
        .info-half p {
          font-size: 13px;
          line-height: 1.6;
          color: var(--ink-soft);
          margin: 0;
        }

        .card-outer {
          position: absolute;
          top: 0;
          width: 50%;
          height: 100%;
          left: 0%;
          transition: left 0.7s cubic-bezier(0.65, 0, 0.35, 1);
        }
        .card-outer.to-right { left: 50%; }

        .card-flipper {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .card-face {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 26px 26px;
          overflow: hidden;
          background: linear-gradient(155deg, var(--white) 0%, var(--sky) 100%);
          color: var(--ink);
        }

        @keyframes fadeDip {
          0% { opacity: 1; }
          50% { opacity: 0.25; }
          100% { opacity: 1; }
        }
        .fade-dip {
          animation: fadeDip 0.7s ease;
        }

        .panel-eyebrow {
          font-size: 10px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 8px;
          color: var(--pink-deep);
        }
        .panel-title {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 21px;
          margin: 0 0 16px 0;
          color: var(--ink);
        }

        .field { margin-bottom: 12px; }
        .field label {
          display: block;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 5px;
          color: var(--ink-soft);
        }
        .input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1.5px solid var(--sky-deep);
          padding-bottom: 6px;
        }
        .input-wrap input {
          background: transparent;
          border: none;
          outline: none;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          width: 100%;
          color: var(--ink);
        }
        .input-wrap input::placeholder { color: #A7B6C7; }
        .input-wrap svg { flex-shrink: 0; color: var(--pink-deep); opacity: 0.85; }

        .cta {
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 10px 16px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.03em;
          border: none;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, var(--pink), var(--pink-deep));
          color: var(--white);
          box-shadow: 0 10px 22px -8px rgba(226, 127, 168, 0.55);
          transition: transform 0.15s ease;
        }
        .cta:hover { transform: translateY(-1px); }
        .cta:focus-visible { outline: 2px solid var(--pink-deep); outline-offset: 3px; }

        .foot-note {
          margin-top: 12px;
          font-size: 11.5px;
          color: var(--ink-soft);
        }
        .foot-note button {
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
          color: var(--pink-deep);
        }

        @media (max-width: 560px) {
          .stage { height: auto; min-height: 460px; }
          .info-half { display: none; }
          .card-outer, .card-outer.to-right { width: 100%; left: 0; }
          .card-face { position: relative; height: 460px; }
          .feather-corner { transform: scale(0.8) rotate(0deg) !important; }
        }
      `}</style>

      <div className="frame">
        <div className="eyebrow-top">Welcome</div>
        <h1 className="title-top">
          {isUp ? "Create your account" : "Good to see you again"}
        </h1>

        <div className="stage">
          <Feather className="feather-corner feather-tl" size={26} strokeWidth={1.4} />
          <Feather className="feather-corner feather-tr" size={26} strokeWidth={1.4} />
          <Feather className="feather-corner feather-bl" size={26} strokeWidth={1.4} />
          <Feather className="feather-corner feather-br" size={26} strokeWidth={1.4} />
          <span className="feather-line line-tl" />
          <span className="feather-line line-tr" />

          <div className="info-half info-left">
            <div className="info-seal"><Feather size={17} strokeWidth={1.6} /></div>
            <h3>{isUp ? "Already with us?" : "Simple, light, easy"}</h3>
            <p>
              {isUp
                ? "Switch back any time to sign in on the opposite side."
                : "Sign in to pick up right where you left off, no fuss."}
            </p>
          </div>

          <div className="info-half info-right">
            <div className="info-seal"><Feather size={17} strokeWidth={1.6} /></div>
            <h3>{isUp ? "Just a minute" : "New here?"}</h3>
            <p>
              {isUp
                ? "Fill in the card on the left and you're all set."
                : "Flip the card over to create a new account."}
            </p>
          </div>

          <div className={`card-outer ${isUp ? "to-right" : ""}`}>
            <div className="card-flipper">
              <div className="card-face">
                <div key={animTick} className="fade-dip">
                  {displayMode === "in" ? (
                    <form onSubmit={(e) => e.preventDefault()}>
                      <div className="panel-eyebrow">Returning</div>
                      <h2 className="panel-title">Sign In</h2>

                      <div className="field">
                        <label htmlFor="in-email">Email</label>
                        <div className="input-wrap">
                          <Mail size={14} />
                          <input
                            id="in-email"
                            type="email"
                            placeholder="you@example.com"
                            value={signInData.email}
                            onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="field">
                        <label htmlFor="in-password">Password</label>
                        <div className="input-wrap">
                          <Lock size={14} />
                          <input
                            id="in-password"
                            type="password"
                            placeholder="••••••••"
                            value={signInData.password}
                            onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                          />
                        </div>
                      </div>

                      <button className="cta" type="submit">
                        Sign In <ArrowRight size={13} />
                      </button>

                      <p className="foot-note">
                        New here?{" "}
                        <button type="button" onClick={() => goTo("up")}>Sign up</button>
                      </p>
                    </form>
                  ) : (
                    <form onSubmit={(e) => e.preventDefault()}>
                      <div className="panel-eyebrow">New Account</div>
                      <h2 className="panel-title">Sign Up</h2>

                      <div className="field">
                        <label htmlFor="up-email">Email</label>
                        <div className="input-wrap">
                          <Mail size={14} />
                          <input
                            id="up-email"
                            type="email"
                            placeholder="you@example.com"
                            value={signUpData.email}
                            onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="field">
                        <label htmlFor="up-password">Password</label>
                        <div className="input-wrap">
                          <Lock size={14} />
                          <input
                            id="up-password"
                            type="password"
                            placeholder="Choose a password"
                            value={signUpData.password}
                            onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                          />
                        </div>
                      </div>

                      <button className="cta" type="submit">
                        Create Account <ArrowRight size={13} />
                      </button>

                      <p className="foot-note">
                        Already registered?{" "}
                        <button type="button" onClick={() => goTo("in")}>Sign in</button>
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

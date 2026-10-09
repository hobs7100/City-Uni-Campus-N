"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { DataFetchLoader } from "@/components/ui/Loaders";
import Logo from "@/components/Logo";
import styles from "../auth-screen.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Login failed.");
        return;
      }
      if (data.mustChangePassword) {
        router.push("/change-password");
        router.refresh();
        return;
      }

      const dashboardMap: Record<string, string> = {
        admin: "/dashboard/admin",
        hod: "/dashboard/hod",
        coordinator: "/dashboard/coordinator",
        teacher: "/dashboard/teacher",
        student: "/dashboard/student",
        finance_manager: "/dashboard/admin",
        assistant: "/dashboard/admin",
      };
      toast.success(`Welcome back, ${data.name || "to City College"}!`);
      router.push(data.redirectTo || dashboardMap[data.role] || "/dashboard/admin");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.screen}>
      <div className={styles.shell}>
        <section className={styles.formSide} aria-labelledby="login-title">
          <header className={styles.brandHeader}>
            <Logo size="lg" className={styles.logo} />
            <span className={styles.brandCaption}>UNIVERSITY CAMPUS</span>
          </header>
          <div className={styles.formContent}>
            <p className={styles.eyebrow}>YOUR CAMPUS, IN ONE PLACE</p>
            <h1 id="login-title" className={styles.title}>Welcome back.</h1>
            <p className={styles.intro}>Sign in to continue to your City College account.</p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="login-email" className={styles.label}>Email address</label>
                <div className={styles.inputWrap}>
                  <Mail className={styles.fieldIcon} size={18} aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@citycollege.edu.pk"
                    className={styles.input}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="login-password" className={styles.label}>Password</label>
                <div className={styles.inputWrap}>
                  <LockKeyhole className={styles.fieldIcon} size={18} aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`${styles.input} ${styles.passwordInput}`}
                  />
                  <button
                    type="button"
                    className={styles.visibilityButton}
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className={styles.submit}>
                {loading ? <><DataFetchLoader /> Signing in...</> : <>Sign in <ArrowRight size={17} /></>}
              </button>
            </form>
            <div className={styles.secureNote}>
              <span className={styles.secureDot} />
              Secure access for City College community
            </div>
          </div>
          <footer className={styles.copyright}>
            &copy; {new Date().getFullYear()} City College (University Campus). All rights reserved.
          </footer>
        </section>

        <aside className={styles.visualSide} aria-label="City College University Campus">
          <div className={styles.visualTopline}>
            <span className={styles.liveMark} />
            CAMPUS MANAGEMENT SYSTEM
          </div>
          <div className={styles.scene} aria-hidden="true">
            <div className={styles.sceneHalo} />
            <div className={`${styles.platform} ${styles.platformOne}`} />
            <div className={`${styles.platform} ${styles.platformTwo}`} />
            <div className={styles.building}>
              <div className={styles.roof} />
              <div className={styles.facade}>
                <div className={styles.facadeTop}><span /><span /><span /><span /><span /></div>
                <div className={styles.facadeColumns}>
                  <i /><i /><i /><i /><i /><i /><i />
                </div>
                <div className={styles.facadeBase}>
                  <span /><span /><span /><span /><span /><span /><span />
                </div>
                <div className={styles.entry}><span /></div>
              </div>
              <div className={`${styles.wing} ${styles.wingLeft}`} />
              <div className={`${styles.wing} ${styles.wingRight}`} />
            </div>
            <div className={`${styles.orbit} ${styles.orbitA}`} />
            <div className={`${styles.orbit} ${styles.orbitB}`} />
            <span className={`${styles.sceneSpark} ${styles.sparkOne}`} />
            <span className={`${styles.sceneSpark} ${styles.sparkTwo}`} />
            <span className={`${styles.sceneSpark} ${styles.sparkThree}`} />
          </div>
          <div className={styles.visualCopy}>
            <p className={styles.visualKicker}>A connected campus</p>
            <h2>Where every<br />next step begins.</h2>
            <p>One secure place for learning, teaching, and campus life.</p>
          </div>
          <div className={styles.visualFooter}>
            <span>LEARN · LEAD · BELONG</span>
            <span className={styles.visualIndex}>01 / 01</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

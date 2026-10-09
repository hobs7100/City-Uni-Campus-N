"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import styles from "../auth-screen.module.css";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const passwordLength = [...newPassword].length;
    const byteLength = new TextEncoder().encode(newPassword).length;
    if (passwordLength < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (byteLength > 72) {
      setError("Your new password must be no more than 72 UTF-8 bytes.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match. Check both fields and try again.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "We couldn't update your password. Please try again.");
        return;
      }
      router.push(data.redirectTo || "/dashboard/admin");
      router.refresh();
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setError("");
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "We couldn't sign you out. Please try again.");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setError("Connection problem. Please try signing out again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className={styles.screen}>
      <div className={styles.shell}>
        <section className={styles.formSide} aria-labelledby="change-password-title">
          <header className={styles.brandHeader}>
            <Logo size="lg" className={styles.logo} />
            <span className={styles.brandCaption}>UNIVERSITY CAMPUS</span>
          </header>
          <div className={styles.formContent}>
            <p className={styles.eyebrow}>ONE QUICK SECURITY STEP</p>
            <h1 id="change-password-title" className={styles.title}>Choose a new password.</h1>
            <p className={styles.intro}>Before you continue, create a password that is yours alone.</p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="new-password" className={styles.label}>New password</label>
                <div className={styles.inputWrap}>
                  <LockKeyhole className={styles.fieldIcon} size={18} aria-hidden="true" />
                  <input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    className={`${styles.input} ${styles.passwordInput}`}
                    aria-describedby="password-guidance"
                  />
                  <button
                    type="button"
                    className={styles.visibilityButton}
                    onClick={() => setShowNewPassword((visible) => !visible)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    aria-pressed={showNewPassword}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="confirm-password" className={styles.label}>Confirm new password</label>
                <div className={styles.inputWrap}>
                  <KeyRound className={styles.fieldIcon} size={18} aria-hidden="true" />
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter it once more"
                    className={`${styles.input} ${styles.passwordInput}`}
                  />
                  <button
                    type="button"
                    className={styles.visibilityButton}
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <p id="password-guidance" className={styles.passwordGuidance}>
                <Check size={15} aria-hidden="true" /> 8 or more characters <span />
                Maximum 72 UTF-8 bytes
              </p>
              {error && <p className={styles.errorMessage} role="alert">{error}</p>}
              <button type="submit" disabled={loading || loggingOut} className={styles.submit}>
                {loading ? "Updating password..." : <>Set new password <ArrowRight size={17} /></>}
              </button>
              <button
                type="button"
                className={styles.logoutButton}
                onClick={handleLogout}
                disabled={loading || loggingOut}
              >
                <LogOut size={16} aria-hidden="true" />
                {loggingOut ? "Signing out..." : "Sign out instead"}
              </button>
            </form>
            <div className={styles.secureNote}>
              <span className={styles.secureDot} />
              Your account stays protected throughout this step
            </div>
          </div>
          <footer className={styles.copyright}>
            &copy; {new Date().getFullYear()} City College (University Campus). All rights reserved.
          </footer>
        </section>

        <aside className={`${styles.visualSide} ${styles.passwordVisual}`} aria-label="Account security">
          <div className={styles.visualTopline}>
            <span className={styles.liveMark} />
            ACCOUNT SECURITY
          </div>
          <div className={styles.securityArtwork} aria-hidden="true">
            <div className={styles.securityOrbit} />
            <div className={styles.securityPlatform} />
            <div className={styles.securityShield}><LockKeyhole size={55} strokeWidth={1.25} /></div>
            <span className={`${styles.securitySpark} ${styles.sparkOne}`} />
            <span className={`${styles.securitySpark} ${styles.sparkTwo}`} />
            <span className={`${styles.securitySpark} ${styles.sparkThree}`} />
          </div>
          <div className={styles.visualCopy}>
            <p className={styles.visualKicker}>A stronger key, by you</p>
            <h2>Make this<br />account yours.</h2>
            <p>Choose a private password you can remember and only you know.</p>
          </div>
          <div className={styles.visualFooter}>
            <span>PRIVATE BY DESIGN</span>
            <span className={styles.visualIndex}>SECURE</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

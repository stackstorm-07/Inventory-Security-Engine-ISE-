document.addEventListener("DOMContentLoaded", () => {

  // ─── Element references ───────────────────────────────────────────────────
  const signupForm              = document.getElementById("signupForm");
  const loginForm               = document.getElementById("loginForm");
  const fullNameInput           = document.getElementById("signupFullName");
  const usernameInput           = document.getElementById("signupUsername");
  const emailInput              = document.getElementById("signupEmail");
  const phoneInput              = document.getElementById("signupPhone");
  const passwordInput           = document.getElementById("signupPassword");
  const confirmPasswordInput    = document.getElementById("signupConfirmPassword");
  const strengthMeter           = document.getElementById("passwordStrength");
  const forgotPasswordLink      = document.getElementById("forgotPasswordLink");
  const forgotPasswordBox       = document.getElementById("forgotPasswordBox");
  const forgotPasswordForm      = document.getElementById("forgotPasswordForm");
  const forgotEmailInput        = document.getElementById("forgotEmail");
  const resetPasswordBox        = document.getElementById("resetPasswordBox");
  const resetPasswordForm       = document.getElementById("resetPasswordForm");
  const resetEmailInput         = document.getElementById("resetEmail");
  const resetTokenInput         = document.getElementById("resetToken");
  const resetPasswordInput      = document.getElementById("resetPassword");
  const resetConfirmPasswordInput = document.getElementById("resetConfirmPassword");

  // ─── CAPTCHA elements (only on login page) ───────────────────────────────
  const captchaCanvas  = document.getElementById("captchaCanvas");
  const captchaInput   = document.getElementById("captchaInput");
  const captchaError   = document.getElementById("captchaError");
  const refreshBtn     = document.getElementById("refreshCaptcha");

  // =========================================================================
  // TEXT CAPTCHA  — canvas-drawn, regex-validated, zero dependencies
  // =========================================================================

  // Characters pool: uppercase + digits only — easy to read, no O/0 confusion
  const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CAPTCHA_LENGTH = 5;

  let currentCaptchaText = "";   // ground truth stored in memory (not in DOM)

  /**
   * generateCaptchaText()
   * Picks CAPTCHA_LENGTH random characters from CAPTCHA_CHARS.
   * Validated later with a simple regex: /^[A-Z2-9]{5}$/i
   */
  function generateCaptchaText() {
    let text = "";
    for (let i = 0; i < CAPTCHA_LENGTH; i++) {
      text += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
    }
    return text;
  }

  /**
   * drawCaptcha(text)
   * Draws the CAPTCHA on a <canvas> with:
   *   - noisy background lines (anti-bot visual noise)
   *   - each character slightly rotated and at a random y offset
   *   - random colours per character
   * No external library needed — pure Canvas 2D API.
   */
  function drawCaptcha(text) {
    if (!captchaCanvas) return;

    const ctx    = captchaCanvas.getContext("2d");
    const W      = captchaCanvas.width;   // 160
    const H      = captchaCanvas.height;  // 48

    // 1. Clear + background
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f0f4ff";
    ctx.fillRect(0, 0, W, H);

    // 2. Noise lines (makes OCR harder for bots)
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `hsl(${Math.random() * 360}, 60%, 70%)`;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * W, Math.random() * H);
      ctx.lineTo(Math.random() * W, Math.random() * H);
      ctx.stroke();
    }

    // 3. Draw each character
    const charW = W / (CAPTCHA_LENGTH + 1);
    for (let i = 0; i < text.length; i++) {
      ctx.save();

      // Position: evenly spaced, random vertical shift
      const x = charW * (i + 0.8);
      const y = H / 2 + (Math.random() * 10 - 5);

      ctx.translate(x, y);
      // Slight random tilt (-20° to +20°)
      ctx.rotate((Math.random() * 40 - 20) * (Math.PI / 180));

      // Random dark colour per character
      ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 30%)`;
      ctx.font      = `bold ${20 + Math.random() * 4}px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text[i], 0, 0);

      ctx.restore();
    }

    // 4. Noise dots
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Generates + draws a fresh CAPTCHA and clears any previous input/error */
  function refreshCaptcha() {
    currentCaptchaText = generateCaptchaText();
    drawCaptcha(currentCaptchaText);
    if (captchaInput)  captchaInput.value = "";
    if (captchaError)  captchaError.textContent = "";
  }

  /**
   * validateCaptchaInput(userInput)
   * Uses REGEX to:
   *   1. Check the input only contains allowed characters  → /^[A-Z2-9]+$/i
   *   2. Check the length is exactly CAPTCHA_LENGTH        → length check
   *   3. Case-insensitive compare with the generated text
   * Returns { ok: Boolean, message: String }
   */
  function validateCaptchaInput(userInput) {
    const trimmed = userInput.trim();

    // Regex step 1 — allowed characters only (letters + digits 2-9)
    const allowedCharsRegex = /^[A-Za-z2-9]+$/;
    if (!allowedCharsRegex.test(trimmed)) {
      return { ok: false, message: "CAPTCHA: only letters and digits 2–9 allowed." };
    }

    // Regex step 2 — exact length
    const exactLengthRegex = new RegExp(`^[A-Za-z2-9]{${CAPTCHA_LENGTH}}$`);
    if (!exactLengthRegex.test(trimmed)) {
      return { ok: false, message: `CAPTCHA must be exactly ${CAPTCHA_LENGTH} characters.` };
    }

    // Step 3 — case-insensitive match against generated text
    if (trimmed.toUpperCase() !== currentCaptchaText) {
      return { ok: false, message: "Incorrect CAPTCHA. Please try again." };
    }

    return { ok: true, message: "" };
  }

  // Initialise CAPTCHA on page load (login page only)
  if (captchaCanvas) refreshCaptcha();

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshCaptcha);
  }

  // Live feedback as user types
  if (captchaInput) {
    captchaInput.addEventListener("input", () => {
      if (captchaError) captchaError.textContent = "";
    });
  }

  // =========================================================================
  // FEATURE 1 — Password Strength Tracker
  // =========================================================================
  if (passwordInput && strengthMeter) {
    passwordInput.addEventListener("input", () => {
      const val = passwordInput.value;
      if (val.length === 0) {
        strengthMeter.textContent = "";
      } else if (val.length < 6) {
        strengthMeter.textContent = "Weak (Too short)";
        strengthMeter.style.color = "#dc2626";
      } else if (val.match(/[0-9]/) && val.match(/[a-zA-Z]/)) {
        if (val.length >= 8 && val.match(/[^a-zA-Z0-9]/)) {
          strengthMeter.textContent = "Strong";
          strengthMeter.style.color = "#16a34a";
        } else {
          strengthMeter.textContent = "Medium";
          strengthMeter.style.color = "#d97706";
        }
      } else {
        strengthMeter.textContent = "Weak (Add numbers and letters)";
        strengthMeter.style.color = "#dc2626";
      }
    });
  }

  // =========================================================================
  // FEATURE 2 — Sign Up
  // =========================================================================
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(fullNameInput.value)) {
        alert("Full Name must contain only alphabetical letters and spaces.");
        fullNameInput.focus(); return;
      }

      const usernameRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$/;
      if (!usernameRegex.test(usernameInput.value)) {
        alert("Username must be a mix of both letters and numbers.");
        usernameInput.focus(); return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value)) {
        alert("Please enter a valid email address (e.g., user@gmail.com).");
        emailInput.focus(); return;
      }

      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phoneInput.value)) {
        alert("Phone number must be exactly 10 digits.");
        phoneInput.focus(); return;
      }

      if (passwordInput.value !== confirmPasswordInput.value) {
        alert("Passwords do not match! Please try again.");
        confirmPasswordInput.value = "";
        confirmPasswordInput.focus(); return;
      }

      const userData = {
        fullName: fullNameInput.value,
        username: usernameInput.value,
        email:    emailInput.value,
        phone:    phoneInput.value,
        password: passwordInput.value
      };

      fetch("http://localhost:5000/api/auth/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(userData)
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) { alert("Error: " + data.error); }
        else {
          alert("Account securely created! You can now login.");
          window.location.href = "login.html";
        }
      })
      .catch(() => alert("Failed to connect to the server. Is your Node backend running?"));
    });
  }

  // =========================================================================
  // FEATURE 3 — Login (with CAPTCHA validation)
  // =========================================================================
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const loginId   = document.getElementById("loginIdentifier").value;
      const loginPass = document.getElementById("loginPassword").value;

      // ── Validate CAPTCHA first (regex-based) ──────────────────────────────
      const captchaResult = validateCaptchaInput(captchaInput ? captchaInput.value : "");
      if (!captchaResult.ok) {
        if (captchaError) captchaError.textContent = captchaResult.message;
        refreshCaptcha();   // always refresh on failure
        captchaInput && captchaInput.focus();
        return;
      }

      // ── Send to backend ───────────────────────────────────────────────────
      fetch("http://localhost:5000/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usernameOrEmail: loginId, password: loginPass })
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          alert("Security Alert: " + data.error);
          refreshCaptcha();
        } else {
          alert("Authentication successful. Welcome!");
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          window.location.href = "dashboard.html";
        }
      })
      .catch(() => alert("Failed to connect to the backend."));
    });
  }

  // =========================================================================
  // FEATURE 4 — Forgot Password
  // =========================================================================
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (forgotPasswordBox)
        forgotPasswordBox.style.display = forgotPasswordBox.style.display === "none" ? "block" : "none";
      if (resetPasswordBox) resetPasswordBox.style.display = "none";
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = forgotEmailInput.value.trim();
      if (!email) { alert("Please enter your email address."); return; }

      try {
        const res  = await fetch("http://localhost:5000/api/auth/forgot-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || "Unable to request password reset."); return; }
        alert(data.message + (data.resetCode ? ` Reset code: ${data.resetCode}` : ""));
        if (forgotPasswordBox)  forgotPasswordBox.style.display = "none";
        if (resetPasswordBox)   resetPasswordBox.style.display  = "block";
        if (resetEmailInput)    resetEmailInput.value = email;
      } catch { alert("Unable to request password reset at this time."); }
    });
  }

  // =========================================================================
  // FEATURE 5 — Reset Password
  // =========================================================================
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email       = resetEmailInput.value.trim();
      const token       = resetTokenInput.value.trim();
      const newPassword = resetPasswordInput.value;
      const confirmPwd  = resetConfirmPasswordInput.value;

      if (!email || !token || !newPassword || !confirmPwd) {
        alert("Please complete all reset fields."); return;
      }
      if (newPassword !== confirmPwd) { alert("New passwords do not match."); return; }
      if (newPassword.length < 6)     { alert("New password must be at least 6 characters."); return; }

      try {
        const res  = await fetch("http://localhost:5000/api/auth/reset-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token, newPassword })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || "Unable to reset password."); return; }
        alert(data.message);
        if (resetPasswordBox) resetPasswordBox.style.display = "none";
        if (loginForm)        loginForm.reset();
        refreshCaptcha();
      } catch { alert("Unable to reset password right now."); }
    });
  }

});

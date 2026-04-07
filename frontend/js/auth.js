document.addEventListener("DOMContentLoaded", () => {

  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  
  // Grab all the inputs for validation
  const fullNameInput = document.getElementById("signupFullName");
  const usernameInput = document.getElementById("signupUsername");
  const emailInput = document.getElementById("signupEmail");
  const phoneInput = document.getElementById("signupPhone");
  const passwordInput = document.getElementById("signupPassword");
  const confirmPasswordInput = document.getElementById("signupConfirmPassword");
  const strengthMeter = document.getElementById("passwordStrength");
  const loginCaptchaQuestion = document.getElementById("loginCaptchaQuestion");
  const loginCaptchaInput = document.getElementById("loginCaptcha");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const forgotPasswordBox = document.getElementById("forgotPasswordBox");
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  const forgotEmailInput = document.getElementById("forgotEmail");
  const resetPasswordBox = document.getElementById("resetPasswordBox");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const resetEmailInput = document.getElementById("resetEmail");
  const resetTokenInput = document.getElementById("resetToken");
  const resetPasswordInput = document.getElementById("resetPassword");
  const resetConfirmPasswordInput = document.getElementById("resetConfirmPassword");
  let loginCaptchaAnswer = null;

  function setLoginCaptcha() {
    if (!loginCaptchaQuestion || !loginCaptchaInput) return;
    const a = Math.floor(Math.random() * 8) + 1;
    const b = Math.floor(Math.random() * 8) + 1;
    loginCaptchaAnswer = a + b;
    loginCaptchaQuestion.textContent = `${a} + ${b}`;
    loginCaptchaInput.value = '';
  }

  // ==========================================
  // FEATURE 1: Password Strength Tracker
  // ==========================================
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

  // ==========================================
  // FEATURE 2: Sign Up Submission & Security Validation
  // ==========================================
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault(); // Stop the form from submitting immediately

      // 1. Validate Full Name (Only letters and spaces)
      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(fullNameInput.value)) {
        alert("Full Name must contain only alphabetical letters and spaces.");
        fullNameInput.focus();
        return; 
      }

      // 2. Validate Username (Must contain at least one letter, one number, and no special chars)
      const usernameRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$/;
      if (!usernameRegex.test(usernameInput.value)) {
        alert("Username must be a mix of both letters and numbers.");
        usernameInput.focus();
        return;
      }

      // 3. Validate Email (Standard email format)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value)) {
        alert("Please enter a valid email address (e.g., user@gmail.com).");
        emailInput.focus();
        return;
      }

      // 4. Validate Phone Number (Exactly 10 digits)
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phoneInput.value)) {
        alert("Phone number must be exactly 10 digits.");
        phoneInput.focus();
        return;
      }

      // 5. Validate Passwords Match
      if (passwordInput.value !== confirmPasswordInput.value) {
        alert("Passwords do not match! Please try again.");
        confirmPasswordInput.value = "";
        confirmPasswordInput.focus();
        return; 
      }

      // ✅ 6. If everything passes, SEND DATA TO THE BACKEND!
      const userData = {
        fullName: fullNameInput.value,
        username: usernameInput.value,
        email: emailInput.value,
        phone: phoneInput.value,
        password: passwordInput.value 
      };

      // Send the request to your backend API
      fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          alert("Error: " + data.error);
        } else {
          alert("Account securely created! You can now login.");
          window.location.href = "login.html"; 
        }
      })
      .catch(error => {
        console.error("Error connecting to server:", error);
        alert("Failed to connect to the server. Is your Node backend running?");
      });
    });
  }

  // ==========================================
  // FEATURE 3: REAL Login Submission (Checks Database)
  // ==========================================
  if (loginForm) {
    setLoginCaptcha();

    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const loginId = document.getElementById("loginIdentifier").value;
      const loginPass = document.getElementById("loginPassword").value;
      const captchaValue = loginCaptchaInput ? loginCaptchaInput.value.trim() : '';

      if (!captchaValue || parseInt(captchaValue, 10) !== loginCaptchaAnswer) {
        alert("Please solve the captcha correctly.");
        setLoginCaptcha();
        return;
      }

      // Make a real call to your Node backend
      fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: loginId, // Matches backend perfectly!
          password: loginPass
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          alert("Security Alert: " + data.error);
          setLoginCaptcha();
        } else {
          alert("Authentication successful. Welcome!");
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          window.location.href = "dashboard.html";
        }
      })
      .catch(error => {
        console.error("Error connecting to server:", error);
        alert("Failed to connect to the backend.");
      });
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (forgotPasswordBox) {
        forgotPasswordBox.style.display = forgotPasswordBox.style.display === 'none' ? 'block' : 'none';
      }
      if (resetPasswordBox) {
        resetPasswordBox.style.display = 'none';
      }
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = forgotEmailInput.value.trim();
      if (!email) {
        alert('Please enter your email address.');
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'Unable to request password reset.');
          return;
        }

        alert(data.message + (data.resetCode ? ` Reset code: ${data.resetCode}` : ''));
        if (forgotPasswordBox) {
          forgotPasswordBox.style.display = 'none';
        }
        if (resetPasswordBox) {
          resetPasswordBox.style.display = 'block';
        }
        if (resetEmailInput) {
          resetEmailInput.value = email;
        }
      } catch (error) {
        console.error('Forgot password error:', error);
        alert('Unable to request password reset at this time.');
      }
    });
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = resetEmailInput.value.trim();
      const token = resetTokenInput.value.trim();
      const newPassword = resetPasswordInput.value;
      const confirmPassword = resetConfirmPasswordInput.value;

      if (!email || !token || !newPassword || !confirmPassword) {
        alert('Please complete all reset fields.');
        return;
      }

      if (newPassword !== confirmPassword) {
        alert('New passwords do not match.');
        return;
      }

      if (newPassword.length < 6) {
        alert('New password must be at least 6 characters long.');
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token, newPassword })
        });
        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'Unable to reset password.');
          return;
        }

        alert(data.message);
        if (resetPasswordBox) {
          resetPasswordBox.style.display = 'none';
        }
        if (loginForm) {
          loginForm.reset();
        }
        setLoginCaptcha();
      } catch (error) {
        console.error('Reset password error:', error);
        alert('Unable to reset password right now.');
      }
    });
  }

});
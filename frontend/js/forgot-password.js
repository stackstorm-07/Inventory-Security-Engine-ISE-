document.addEventListener("DOMContentLoaded", () => {

  const requestTokenForm = document.getElementById("requestTokenForm");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const requestTokenSection = document.getElementById("requestTokenSection");
  const resetPasswordSection = document.getElementById("resetPasswordSection");
  const usernameInput = document.getElementById("username");
  const resetUsernameInput = document.getElementById("resetUsername");
  const resetTokenInput = document.getElementById("resetToken");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const passwordStrength = document.getElementById("passwordStrength");

  // Password Strength Tracker
  if (newPasswordInput && passwordStrength) {
    newPasswordInput.addEventListener("input", () => {
      const val = newPasswordInput.value;

      if (val.length === 0) {
        passwordStrength.textContent = "";
      } else if (val.length < 6) {
        passwordStrength.textContent = "Weak (Too short)";
        passwordStrength.style.color = "#dc2626";
      } else if (val.match(/[0-9]/) && val.match(/[a-zA-Z]/)) {
        if (val.length >= 8 && val.match(/[^a-zA-Z0-9]/)) {
          passwordStrength.textContent = "Strong";
          passwordStrength.style.color = "#16a34a";
        } else {
          passwordStrength.textContent = "Medium";
          passwordStrength.style.color = "#d97706";
        }
      } else {
        passwordStrength.textContent = "Weak (Add numbers and letters)";
        passwordStrength.style.color = "#dc2626";
      }
    });
  }

  // Request Token Form
  if (requestTokenForm) {
    requestTokenForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = usernameInput.value.trim();
      const recaptchaResponse = grecaptcha.getResponse();

      if (!username) {
        alert("Please enter your username.");
        return;
      }

      if (!recaptchaResponse) {
        alert("Please complete the CAPTCHA.");
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'Unable to request password reset.');
          grecaptcha.reset();
          return;
        }

        alert(data.message + (data.resetCode ? ` Reset code: ${data.resetCode}` : ''));
        resetUsernameInput.value = username;
        requestTokenSection.style.display = 'none';
        resetPasswordSection.style.display = 'block';
        grecaptcha.reset();
      } catch (error) {
        console.error('Forgot password error:', error);
        alert('Unable to request password reset at this time.');
        grecaptcha.reset();
      }
    });
  }

  // Reset Password Form
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = resetUsernameInput.value.trim();
      const token = resetTokenInput.value.trim();
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (!username || !token || !newPassword || !confirmPassword) {
        alert('Please complete all fields.');
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

      // Additional strong password check
      if (!newPassword.match(/[0-9]/) || !newPassword.match(/[a-zA-Z]/)) {
        alert('Password must contain at least one letter and one number.');
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, token, newPassword })
        });
        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'Unable to reset password.');
          return;
        }

        alert(data.message);
        window.location.href = "login.html";
      } catch (error) {
        console.error('Reset password error:', error);
        alert('Unable to reset password right now.');
      }
    });
  }

});
// Authentication logic
const API_URL = window.location.origin;

// Check if on login page
if (window.location.pathname.includes('login.html')) {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const loginBtn = document.getElementById('login-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoading = document.getElementById('btn-loading');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Show loading
        loginBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        errorMessage.classList.add('hidden');

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Đăng nhập thất bại');
            }

            // Save token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Redirect to main app
            window.location.href = '/';
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
        } finally {
            loginBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
        }
    });
}

// Check if on signup page
if (window.location.pathname.includes('signup.html')) {
    const signupForm = document.getElementById('signup-form');
    const errorMessage = document.getElementById('error-message');
    const signupBtn = document.getElementById('signup-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoading = document.getElementById('btn-loading');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const displayName = document.getElementById('displayName').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validate
        if (password !== confirmPassword) {
            errorMessage.textContent = 'Mật khẩu xác nhận không khớp';
            errorMessage.classList.remove('hidden');
            return;
        }

        // Show loading
        signupBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        errorMessage.classList.add('hidden');

        try {
            const response = await fetch(`${API_URL}/api/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, displayName }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Đăng ký thất bại');
            }

            // Save token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Redirect to main app
            window.location.href = '/';
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
        } finally {
            signupBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
        }
    });
}

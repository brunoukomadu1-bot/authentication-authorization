document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    const authContainer = document.getElementById('auth-container');
     
    const API_URL = 'http://localhost:3000';

    const showMessage = (text, isError = false) => {
        systemMsg.innerText = text;
        systemMsg.style.color = isError ? '#dc3545' : '#28a745';
    };

    // --------------------------------------------------
    // 2. Login
    // --------------------------------------------------
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            console.log(data);

            if (res.ok) {
                localStorage.setItem('accessToken', data.token);
                localStorage.setItem('user', data);
                window.location.href='dashboard.html'

                showMessage('');
                loginForm.reset();
                window.location('dashboard.html')
            } else {
                showMessage(data.message || 'Login failed.', true);
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Unable to connect to the server.', true);
        }
    });
  
    // --------------------------------------------------
    // 5. Logout
    // --------------------------------------------------
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('username');

        dashboardContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');

        showMessage('Logged out successfully.', false);
    });

    
    // --------------------------------------------------
    // 6. Check Existing Login Session
    // If existing token redirect to dashboard.html.
    // So you need to fix the code below
    const existingToken = localStorage.getItem('accessToken');
    if (existingToken) {
        loadDashboard();
    }
});
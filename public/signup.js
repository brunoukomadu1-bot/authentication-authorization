const API_URL = 'http://localhost:3000/api';

const systemMsg = document.getElementById('system-msg');

const showMessage = (text, isError = false) => {
    systemMsg.innerText = text;
    systemMsg.style.color = isError ? '#dc3545' : '#28a745';
};

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // stop the browser's default form reload

        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;

        if (!username || !email || !password) {
            showMessage('All fields are required.', true);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Signup failed.');
            }

            // Success — your backend returns "User registered successfully!"
            showMessage(data.message || 'User registered successfully!', false);
            signupForm.reset();

            // Redirect to login after 2 seconds (remove if unwanted)
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (err) {
            showMessage(err.message, true);
        }
    });
});
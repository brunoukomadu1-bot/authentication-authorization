// DOM Element References
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');
const systemMsg = document.getElementById('system-msg');
const usersList = document.getElementById('users-list');

const showCreateUserBtn = document.getElementById('show-create-user');
const createUserForm = document.getElementById('create-user-form');
const createUserBtn = document.getElementById('create-user-btn');
const logoutBtn = document.getElementById('logout-btn');

// --- 1. Toggle Create User Form ---
if (showCreateUserBtn) {
    showCreateUserBtn.addEventListener('click', () => {
        createUserForm.classList.toggle('hidden');
    });
}

// --- 2. Fetch and Display Users ---
async function fetchAndDisplayUsers() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        handleLogout();
        return;
    }

    try {
        if (usersList) usersList.innerHTML = 'Loading users...';
        
        // Target your backend route
        const response = await fetch('http://localhost:3000/api/users', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const users = await response.json();
            
            if (!usersList) return;

            if (!users || users.length === 0) {
                usersList.innerHTML = '<p>No users found in database.</p>';
                return;
            }

            // Build HTML block for all fetched users
            usersList.innerHTML = users.map(user => `
                <div class="user-box" id="user-${user._id}">
                    <h3>${user.username}</h3>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Role:</strong> ${user.role || 'user'}</p>
                    <button class="delete-btn" onclick="deleteUser('${user._id}')">Delete User</button>
                </div>
            `).join('');

        } else {
            const errData = await response.json();
            systemMsg.innerText = errData.message || "Failed to load database users.";
        }
    } catch (err) {
        console.error("Error fetching users:", err);
        systemMsg.innerText = "Error pulling database records.";
    }
}

// --- 3. Create a New User ---
if (createUserBtn) {
    createUserBtn.addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        const username = document.getElementById('new-username').value;
        const email = document.getElementById('new-email').value;
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;

        if (!username || !email || !password) {
            systemMsg.innerText = "Please fill in all user registration fields.";
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/users', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password, role })
            });

            const data = await response.json();

            if (response.ok) {
                systemMsg.innerText = "User successfully created!";
                
                // Clear inputs
                document.getElementById('new-username').value = '';
                document.getElementById('new-email').value = '';
                document.getElementById('new-password').value = '';
                
                createUserForm.classList.add('hidden');
                fetchAndDisplayUsers();
            } else {
                systemMsg.innerText = data.message || "Failed to create user.";
            }
        } catch (err) {
            console.error("Error creating user:", err);
            systemMsg.innerText = "Connection error creating user profile.";
        }
    });
}

// --- 4. Delete a User (Explicitly attached to window context) ---
window.deleteUser = async function(userId) {
    const token = localStorage.getItem('token');
    if (!confirm("Are you sure you want to drop this user record?")) return;

    try {
        const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            systemMsg.innerText = "User account removed.";
            fetchAndDisplayUsers();
        } else {
            const data = await response.json();
            systemMsg.innerText = data.message || "Unauthorized or couldn't drop user.";
        }
    } catch (err) {
        console.error("Error deleting user:", err);
        systemMsg.innerText = "Network failure updating profiles.";
    }
};

// --- 5. Logout Action ---
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    
    // Reset view visibility status safely
    if (authContainer) authContainer.style.display = 'block';
    if (dashboardContainer) dashboardContainer.style.display = 'none';
    systemMsg.innerText = "Logged out securely.";
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// --- 6. AUTO-RUN INITIALIZATION ---
// This checks if the user is already logged in when refreshing the page
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        if (authContainer) authContainer.style.display = 'none';
        if (dashboardContainer) dashboardContainer.style.display = 'block';
        fetchAndDisplayUsers();
    } else {
        handleLogout();
    }
});

// Expose fetching globally so index.js login trigger can run it
window.fetchAndDisplayUsers = fetchAndDisplayUsers;

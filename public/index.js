const logoutBtn = document.getElementById('logout-btn'); 
    const authContainer = document.getElementById('auth-container'); 
    const dashboardContainer = document.getElementById('dashboard-container');
    const systemMsg = document.getElementById('system-msg');
    const userList = document.getElementById('user-list');

    const API_URL = 'http://localhost:3000/api'; 
    const ALL_USERS = '/users';

    const showMessage = (text, isError = false) => { 
        systemMsg.innerText = text; 
        systemMsg.style.color = isError ? '#dc3545' : '#28a745'; 
    }; 

    // 1. Fetch Users from API
    const fetchUsers = async () => { 
        try { 
            const res = await fetch(`${API_URL}${ALL_USERS}`);
            if (!res.ok) {
                throw new Error('Failed to fetch users');
            }
            const users = await res.json();
            displayUsers(users);
        } catch(err) { 
            showMessage(err.message, true);
        } 
    };

    // 2. Display Users in the UI
    const displayUsers = (users) => { 
    // Target the table body instead of a list
    const userTableBody = document.getElementById('user-table-body');
    userTableBody.innerHTML = ''; // Clear existing items

    users.forEach(user => {
        // 1. Create the row element
        const tr = document.createElement('tr');

        // 2. Create and fill the Username cell
        const tdUsername = document.createElement('td');
        tdUsername.textContent = user.username || 'N/A';

        // 3. Create and fill the Email cell
        const tdEmail = document.createElement('td');
        tdEmail.textContent = user.email || 'N/A';

        // 4. Append cells to the row, and the row to the table body
        tr.appendChild(tdUsername);
        tr.appendChild(tdEmail);
        userTableBody.appendChild(tr);
    });
};

    logoutBtn.addEventListener('click', () => { 
        localStorage.removeItem('accessToken'); 
        localStorage.removeItem('username'); 
        dashboardContainer.classList.add('hidden'); 
        authContainer.classList.remove('hidden'); 
        showMessage('Logged out successfully.', false); 
    }); 

document.addEventListener('DOMContentLoaded', () => { 

    fetchUsers();
});
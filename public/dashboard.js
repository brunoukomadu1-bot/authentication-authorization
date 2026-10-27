(() => {
    "use strict";

    // --------------------------------------------------
    // Configuration
    // --------------------------------------------------

    // Leave empty if your Express API is on the same origin.
    // Example for a separate backend:
    const API_BASE = "http://localhost:3000/api";

    const TOKEN_KEY = "accessToken";
    const USER_KEY = "user";
    const PAGE_SIZE = 8;

    const state = {
        currentUser: null,
        users: [],
        filteredUsers: [],
        currentPage: 1,
        editingUserId: null,
        deletingUserId: null,
        loading: false
    };

    const $ = (selector) => document.querySelector(selector);

    const elements = {
        notice: $("#notice"),
        currentUser: $("#currentUser"),
        currentAvatar: $("#currentAvatar"),

        statTotal: $("#statTotal"),
        statAdmins: $("#statAdmins"),
        statUsers: $("#statUsers"),

        tableBody: $("#usersTableBody"),
        search: $("#userSearch"),
        roleFilter: $("#roleFilter"),
        resultCount: $("#resultCount"),
        pageLabel: $("#pageLabel"),

        prevPage: $("#prevPage"),
        nextPage: $("#nextPage"),
        refreshButton: $("#refreshButton"),
        addUserButton: $("#addUserButton"),

        userModal: $("#userModal"),
        userForm: $("#userForm"),
        modalTitle: $("#modalTitle"),
        username: $("#username"),
        email: $("#email"),
        role: $("#role"),
        password: $("#userPassword"),
        passwordLabel: $("#passwordLabel"),
        passwordHint: $("#passwordHint"),
        submitUser: $("#submitUser"),

        viewModal: $("#viewModal"),
        userDetails: $("#userDetails"),

        deleteModal: $("#deleteModal"),
        deleteMessage: $("#deleteMessage"),
        confirmDelete: $("#confirmDelete"),

        toastRegion: $("#toastRegion"),
        logoutButton: $("#logoutButton")
    };

    // --------------------------------------------------
    // Authentication and API helpers
    // --------------------------------------------------

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getStoredUser() {
        const value = localStorage.getItem(USER_KEY);

        if (!value) {
            return null;
        }

        try {
            return JSON.parse(value);
        } catch {
            // Support applications that store the username as plain text.
            return {
                username: value
            };
        }
    }

    function getUserRole(user) {
        return String(user?.role || "").toLowerCase();
    }

    function isAdmin(user) {
        return getUserRole(user) === "admin";
    }

    function getUserId(user) {
        const id = user?._id ?? user?.id;

        return id == null ? "" : String(id);
    }

    function apiUrl(path) {
        return `${API_BASE}${path}`;
    }

    async function apiRequest(path, options = {}) {
        const token = getToken();

        if (!token) {
            redirectToLogin("Your session has expired. Please sign in again.");
            throw new Error("Authentication required.");
        }

        const headers = {
            Accept: "application/json",
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        let response;

        try {
            response = await fetch(apiUrl(path), {
                ...options,
                headers,
                credentials: "same-origin"
            });
        } catch {
            throw new Error(
                "Unable to connect to the server. Check your connection and API URL."
            );
        }

        const contentType = response.headers.get("content-type") || "";
        let data;

        if (contentType.includes("application/json")) {
            data = await response.json().catch(() => ({}));
        } else {
            data = await response.text().catch(() => "");
        }

        if (response.status === 401) {
            redirectToLogin("Your session has expired. Please sign in again.");
            throw new Error("Authentication failed.");
        }

        if (response.status === 403) {
            throw new Error(
                "Access denied. Only administrators can manage users."
            );
        }

        if (!response.ok) {
            const message =
                typeof data === "object"
                    ? data.message || data.error
                    : data;

            throw new Error(
                message || `Request failed with status ${response.status}.`
            );
        }

        return data;
    }

    function redirectToLogin(message) {
        if (message) {
            sessionStorage.setItem("dashboardMessage", message);
        }

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        window.location.replace("./login.html");
    }

    // --------------------------------------------------
    // Notifications
    // --------------------------------------------------

    function showNotice(message, type = "info") {
        elements.notice.textContent = message;
        elements.notice.className = `notice visible ${type}`;
    }

    function hideNotice() {
        elements.notice.textContent = "";
        elements.notice.className = "notice";
    }

    function showToast(message, type = "success") {
        const toast = document.createElement("div");

        toast.className = `toast ${type}`;
        toast.textContent = message;

        elements.toastRegion.appendChild(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 3500);
    }

    function getErrorMessage(error) {
        return error?.message || "Something went wrong.";
    }

    // --------------------------------------------------
    // Utility functions
    // --------------------------------------------------

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    function displayName(user) {
        return user?.username || user?.name || user?.email || "Unnamed user";
    }

    function initials(user) {
        const name = displayName(user);

        return name
            .split(/[\s@._-]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "U";
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        }).format(date);
    }

    function roleBadge(role) {
        const normalizedRole = String(role || "user").toLowerCase();

        if (normalizedRole === "admin") {
            return '<span class="badge badge-admin">Admin</span>';
        }

        return '<span class="badge badge-user">User</span>';
    }

    function setBusy(button, busy, busyText = "Please wait...") {
        if (busy) {
            button.dataset.originalText = button.textContent;
            button.disabled = true;
            button.textContent = busyText;
        } else {
            button.disabled = false;

            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    // --------------------------------------------------
    // Authorization
    // --------------------------------------------------

    function protectDashboardWithStoredUser() {
        const token = getToken();
        const user = getStoredUser();

        if (!token || !user) {
            redirectToLogin("Please sign in to continue.");
            return false;
        }

        if (!isAdmin(user)) {
            // Do not allow non-admin users to initialize the admin UI.
            // The backend must enforce the same restriction.
            window.location.replace("./index.html");
            return false;
        }

        return true;
    }

    // --------------------------------------------------
    // Load dashboard data
    // --------------------------------------------------

    async function loadDashboard() {
        if (state.loading) {
            return;
        }

        state.loading = true;
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-state">Loading users...</td>
            </tr>
        `;

        elements.refreshButton.disabled = true;
        hideNotice();

        try {
            // The server verifies the token and admin permission.
            // Expected response: { message, user, users }
            const data = await apiRequest("/dashboard");

            if (!data || !data.user || !Array.isArray(data.users)) {
                throw new Error(
                    "Unexpected dashboard response. Expected { user, users }."
                );
            }

            // Always use the authenticated user's server response.
            state.currentUser = data.user;

            if (!isAdmin(state.currentUser)) {
                redirectToLogin("Administrator access is required.");
                return;
            }

            // Keep local user information synchronized with the server.
            localStorage.setItem(USER_KEY, JSON.stringify(state.currentUser));

            state.users = data.users;

            renderCurrentUser();
            updateStats();
            applyFilters();

        } catch (error) {
            if (!state.users.length) {
                elements.tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            Unable to load users.
                        </td>
                    </tr>
                `;
            }

            showNotice(getErrorMessage(error), "error");

        } finally {
            state.loading = false;
            elements.refreshButton.disabled = false;
        }
    }

    function renderCurrentUser() {
        const user = state.currentUser;

        elements.currentUser.textContent = displayName(user);
        elements.currentAvatar.textContent = initials(user);
    }

    // --------------------------------------------------
    // Statistics
    // --------------------------------------------------

    function updateStats() {
        const admins = state.users.filter(isAdmin).length;
        const standardUsers = state.users.length - admins;

        elements.statTotal.textContent = state.users.length;
        elements.statAdmins.textContent = admins;
        elements.statUsers.textContent = standardUsers;
    }

    // --------------------------------------------------
    // Search, filtering, and pagination
    // --------------------------------------------------

    function applyFilters() {
        const searchTerm = elements.search.value.trim().toLowerCase();
        const selectedRole = elements.roleFilter.value.toLowerCase();

        state.filteredUsers = state.users.filter((user) => {
            const username = String(user.username || "").toLowerCase();
            const email = String(user.email || "").toLowerCase();
            const role = String(user.role || "user").toLowerCase();

            const matchesSearch =
                username.includes(searchTerm) ||
                email.includes(searchTerm);

            const matchesRole =
                !selectedRole || role === selectedRole;

            return matchesSearch && matchesRole;
        });

        const totalPages = Math.max(
            1,
            Math.ceil(state.filteredUsers.length / PAGE_SIZE)
        );

        state.currentPage = Math.min(state.currentPage, totalPages);

        renderUsers();
    }

    function renderUsers() {
        const total = state.filteredUsers.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (state.currentPage - 1) * PAGE_SIZE;

        const pageUsers = state.filteredUsers.slice(
            start,
            start + PAGE_SIZE
        );

        elements.resultCount.textContent = total
            ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} users`
            : "No users found";

        elements.pageLabel.textContent =
            `Page ${state.currentPage} of ${totalPages}`;

        elements.prevPage.disabled = state.currentPage <= 1;
        elements.nextPage.disabled = state.currentPage >= totalPages;

        if (!pageUsers.length) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        No users match your search.
                    </td>
                </tr>
            `;
            return;
        }

        elements.tableBody.innerHTML = pageUsers.map((user) => {
            const id = getUserId(user);
            const name = displayName(user);
            const email = user.email || "—";
            const role = user.role || "user";
            const date = formatDate(user.createdAt);

            return `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="user-avatar">
                                ${escapeHtml(initials(user))}
                            </div>

                            <div>
                                <div class="user-name">
                                    ${escapeHtml(name)}
                                </div>

                                <div class="user-email">
                                    ${escapeHtml(user.username || "")}
                                </div>
                            </div>
                        </div>
                    </td>

                    <td>${escapeHtml(email)}</td>

                    <td>${roleBadge(role)}</td>

                    <td>${escapeHtml(date)}</td>

                    <td>
                        <div class="actions">
                            <button
                                class="button button-small"
                                data-action="view"
                                data-id="${escapeHtml(id)}"
                            >View</button>

                            <button
                                class="button button-small"
                                data-action="edit"
                                data-id="${escapeHtml(id)}"
                            >Edit</button>

                            <button
                                class="button button-small"
                                data-action="delete"
                                data-id="${escapeHtml(id)}"
                                style="color:#dc2626;"
                            >Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // --------------------------------------------------
    // Modal helpers
    // --------------------------------------------------

    function openModal(modal) {
        modal.classList.add("open");
    }

    function closeModal(modal) {
        modal.classList.remove("open");
    }

    function getUserById(id) {
        return state.users.find(
            (user) => getUserId(user) === String(id)
        );
    }

    // --------------------------------------------------
    // Create and update users
    // --------------------------------------------------

    function openCreateModal() {
        state.editingUserId = null;
        elements.userForm.reset();

        elements.modalTitle.textContent = "Create user";
        elements.submitUser.textContent = "Create user";

        elements.password.required = true;
        elements.passwordLabel.textContent = "Password";
        elements.passwordHint.textContent =
            "At least 8 characters.";

        openModal(elements.userModal);
        elements.username.focus();
    }

    function openEditModal(user) {
        if (!user) {
            showToast("User not found.", "error");
            return;
        }

        state.editingUserId = getUserId(user);

        elements.userForm.reset();

        elements.username.value = user.username || "";
        elements.email.value = user.email || "";
        elements.role.value = user.role || "user";

        elements.modalTitle.textContent = "Edit user";
        elements.submitUser.textContent = "Save changes";

        elements.password.required = false;
        elements.password.value = "";

        elements.passwordLabel.textContent =
            "New password (optional)";

        elements.passwordHint.textContent =
            "Leave blank to keep the existing password. If provided, use at least 8 characters.";

        openModal(elements.userModal);
        elements.username.focus();
    }

    async function saveUser(event) {
        event.preventDefault();

        // Protect against accidental invocation from a non-admin UI.
        if (!isAdmin(state.currentUser)) {
            showToast("Administrator access is required.", "error");
            return;
        }

        const username = elements.username.value.trim();
        const email = elements.email.value.trim();
        const role = elements.role.value;
        const password = elements.password.value;

        if (!username || !email) {
            showToast("Username and email are required.", "error");
            return;
        }

        if (!["admin", "user"].includes(role)) {
            showToast("Please select a valid role.", "error");
            return;
        }

        if (!state.editingUserId && password.length < 8) {
            showToast(
                "The password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (password && password.length < 8) {
            showToast(
                "The password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        const payload = { username, email, role };

        if (password) {
            payload.password = password;
        }

        const isEditing = Boolean(state.editingUserId);

        const path = isEditing
            ? `/users/${encodeURIComponent(state.editingUserId)}`
            : "/users";

        const method = isEditing ? "PUT" : "POST";

        setBusy(
            elements.submitUser,
            true,
            isEditing ? "Saving..." : "Creating..."
        );

        try {
            await apiRequest(path, {
                method,
                body: JSON.stringify(payload)
            });

            closeModal(elements.userModal);

            showToast(
                isEditing
                    ? "User updated successfully."
                    : "User created successfully."
            );

            await loadDashboard();

        } catch (error) {
            showToast(getErrorMessage(error), "error");

        } finally {
            setBusy(elements.submitUser, false);
        }
    }

    // --------------------------------------------------
    // Read user
    // --------------------------------------------------

    function viewUser(user) {
        if (!user) {
            showToast("User not found.", "error");
            return;
        }

        const details = [
            ["Username", user.username || "—"],
            ["Email address", user.email || "—"],
            ["Role", user.role || "user"],
            ["User ID", getUserId(user) || "—"],
            ["Date created", formatDate(user.createdAt)],
            ["Last updated", formatDate(user.updatedAt)]
        ];

        elements.userDetails.innerHTML = details.map(([label, value]) => `
            <div>
                <div class="detail-label">${escapeHtml(label)}</div>
                <div class="detail-value">${escapeHtml(value)}</div>
            </div>
        `).join("");

        openModal(elements.viewModal);
    }

    // --------------------------------------------------
    // Delete user
    // --------------------------------------------------

    function openDeleteModal(user) {
        if (!user) {
            showToast("User not found.", "error");
            return;
        }

        state.deletingUserId = getUserId(user);

        elements.deleteMessage.textContent =
            `Are you sure you want to delete "${displayName(user)}"?`;

        openModal(elements.deleteModal);
    }

    async function deleteUser() {
        if (!isAdmin(state.currentUser)) {
            showToast("Administrator access is required.", "error");
            return;
        }

        if (!state.deletingUserId) {
            closeModal(elements.deleteModal);
            return;
        }

        // Prevent accidental deletion of the current administrator.
        if (
            state.deletingUserId === getUserId(state.currentUser)
        ) {
            showToast(
                "You cannot delete your own account from this dashboard.",
                "error"
            );
            return;
        }

        setBusy(elements.confirmDelete, true, "Deleting...");

        try {
            await apiRequest(
                `/users/${encodeURIComponent(state.deletingUserId)}`,
                { method: "DELETE" }
            );

            closeModal(elements.deleteModal);
            state.deletingUserId = null;

            showToast("User deleted successfully.");

            await loadDashboard();

        } catch (error) {
            showToast(getErrorMessage(error), "error");

        } finally {
            setBusy(elements.confirmDelete, false);
        }
    }

    // --------------------------------------------------
    // Logout
    // --------------------------------------------------

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        window.location.replace("./login.html");
    }

    // --------------------------------------------------
    // Event listeners
    // --------------------------------------------------

    function bindEvents() {
        elements.search.addEventListener("input", () => {
            state.currentPage = 1;
            applyFilters();
        });

        elements.roleFilter.addEventListener("change", () => {
            state.currentPage = 1;
            applyFilters();
        });

        elements.prevPage.addEventListener("click", () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                renderUsers();
            }
        });

        elements.nextPage.addEventListener("click", () => {
            const totalPages = Math.max(
                1,
                Math.ceil(state.filteredUsers.length / PAGE_SIZE)
            );

            if (state.currentPage < totalPages) {
                state.currentPage++;
                renderUsers();
            }
        });

        elements.refreshButton.addEventListener(
            "click",
            loadDashboard
        );

        elements.addUserButton.addEventListener(
            "click",
            openCreateModal
        );

        elements.userForm.addEventListener(
            "submit",
            saveUser
        );

        elements.tableBody.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-action]");

            if (!button) {
                return;
            }

            const user = getUserById(button.dataset.id);

            if (button.dataset.action === "view") {
                viewUser(user);
            }

            if (button.dataset.action === "edit") {
                openEditModal(user);
            }

            if (button.dataset.action === "delete") {
                openDeleteModal(user);
            }
        });

        document.querySelectorAll("[data-close-user-modal]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    closeModal(elements.userModal);
                });
            });

        $("#closeViewModal").addEventListener("click", () => {
            closeModal(elements.viewModal);
        });

        $("#closeViewButton").addEventListener("click", () => {
            closeModal(elements.viewModal);
        });

        $("#closeDelete").addEventListener("click", () => {
            closeModal(elements.deleteModal);
        });

        $("#cancelDelete").addEventListener("click", () => {
            closeModal(elements.deleteModal);
        });

        elements.confirmDelete.addEventListener(
            "click",
            deleteUser
        );

        elements.logoutButton.addEventListener("click", logout);

        document.querySelectorAll(".modal-backdrop")
            .forEach((backdrop) => {
                backdrop.addEventListener("click", (event) => {
                    if (event.target === backdrop) {
                        closeModal(backdrop);
                    }
                });
            });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                document.querySelectorAll(".modal-backdrop.open")
                    .forEach(closeModal);
            }
        });
    }

    // --------------------------------------------------
    // Initialize
    // --------------------------------------------------

    async function initializeDashboard() {
        if (!protectDashboardWithStoredUser()) {
            return;
        }

        bindEvents();

        const storedMessage = sessionStorage.getItem("dashboardMessage");

        if (storedMessage) {
            showNotice(storedMessage, "info");
            sessionStorage.removeItem("dashboardMessage");
        }

        await loadDashboard();
    }

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard
    );
})();
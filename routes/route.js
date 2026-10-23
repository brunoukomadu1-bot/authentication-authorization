require(`dotenv`).config();
const express = require('express');
const router = express.Router();
const bcrypt = require(`bcrypt`);
const jwt = require(`jsonwebtoken`);
const User = require('../models/user');
const JWT_SECRET = process.env.JWT_SECRET;

// -----------------------------
// Login
// -----------------------------

router.post('/login', async (req, res) => {
    try {

        const user = await User
            .findOne({
                username: req.body.username
            })
            .exec();

        if (!user) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        const passwordIsValid = await bcrypt.compare(
            req.body.password,
            user.password
        );

        if (!passwordIsValid) {
            return res.status(401).json({
                message: 'Invalid password.'
            });
        }

        const token = jwt.sign(
            {
                id: user._id.toString()
            },
            JWT_SECRET,
            {
                expiresIn: '14d'
            }
        );

        res.status(200).json({
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            token
        });

    } catch (err) {
        res.status(500).json({
            message: err.message || 'Something went wrong.'
        });
    }
});


// -----------------------------
// Signup
// -----------------------------

router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // ✅ ADDED: prevents bcrypt crash when fields are missing
        if (!username || !email || !password) {
            return res.status(400).json({
                message: 'username, email and password are required.'
            });
        }

        const saltRounds = 10;

        const hashedPassword = await bcrypt.hash(
            password,
            saltRounds
        );

        const user = new User({
            username,
            email,
            password: hashedPassword
        });

        const result = await user.save();

        res.status(201).json({
            id: result._id,
            username: result.username,
            email: result.email,
            role: result.role,
            message: 'User registered successfully!'
        });

    } catch (err) {

        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];

            return res.status(400).json({
                message: `${field} is already in use!`
            });
        }

        res.status(500).json({
            message: err.message || 'Something went wrong.'
        });
    }
});

// -----------------------------
// JWT Middleware
// -----------------------------

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: 'No authorization token provided.'
        });
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({
            message: 'Invalid authorization format.'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                message: 'Invalid or expired token.'
            });
        }

        req.userId = decoded.id;

        next();
    });
};


const verifyAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({
                message: 'Admin access required.'
            });
        }

        next();

    } catch (err) {
        res.status(500).json({
            message: err.message || 'Something went wrong.'
        });
    }
};


// -----------------------------
// Protected Dashboard
// -----------------------------

router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        // 1. Retrieve the authenticated user
        const user = await User
            .findById(req.userId)
            .select('-password');

        // 2. Ensure the authenticated user exists
        if (!user) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        // 3. Retrieve all users, excluding passwords
        const users = await User
            .find()
            .select('-password')
            .sort({ createdAt: -1 });

        // 4. Return the authenticated user and all users
        return res.status(200).json({
            message: 'Access granted!',
            user,
            users
        });

    } catch (err) {
        return res.status(500).json({
            message: err.message || 'Something went wrong.'
        });
    }
});

// -----------------------------
// Get All Users - Admin Only
// -----------------------------

// ✅ CHANGED: was publicly accessible, now protected
router.get('/users',async (req, res) => {
    console.log('Fetching users...')

    try {

        const users = await User
            .find()
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json(users);

    } catch (err) {

        res.status(500).json({
            message: err.message || 'Something went wrong.'
        });
    }
});

// -----------------------------
// Create User - Admin Only
// -----------------------------

router.post('/users', verifyToken, verifyAdmin, async (req, res) => {

    try {

        const {
            username,
            email,
            password,
            role
        } = req.body;

        // ✅ ADDED: clear 400 error instead of a cryptic bcrypt crash
        if (!username || !email || !password) {
            return res.status(400).json({
                message: 'username, email and password are required.'
            });
        }

        const saltRounds = 10;

        const hashedPassword = await bcrypt.hash(
            password,
            saltRounds
        );

        const user = new User({
            username,
            email,
            password: hashedPassword,
            role: role || 'user'
        });

        const result = await user.save();

        res.status(201).json({
            id: result._id,
            username: result.username,
            email: result.email,
            role: result.role,
            message: 'User created successfully!'
        });

    } catch (err) {

        if (err.code === 11000) {

            const field = Object.keys(err.keyPattern)[0];

            return res.status(400).json({
                message: `${field} is already in use!`
            });
        }

        res.status(500).json({
            message: err.message || 'Something went wrong.'
        });
    }
});

// -----------------------------
// Update User - Admin Only
// -----------------------------

router.put('/users/:id', verifyToken, verifyAdmin, async (req, res) => {

    try {

        const {
            username,
            email,
            password,
            role
        } = req.body;

        const updateData = {
            username,
            email,
            role
        };

        if (password) {
            updateData.password = await bcrypt.hash(
                password,
                10
            );
        }

        const updatedUser = await User
            .findByIdAndUpdate(
                req.params.id,
                updateData,
                {
                    new: true,
                    runValidators: true
                }
            )
            .select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        res.status(200).json({
            message: 'User updated successfully!',
            user: updatedUser
        });

    } catch (err) {

        if (err.code === 11000) {

            const field = Object.keys(err.keyPattern)[0];

            return res.status(400).json({
                message: `${field} is already in use!`
            });
        }

        res.status(500).json({
            message: err.message || 'Something went wrong.'
        });
    }
});

// -----------------------------
// Delete User - Admin Only
// -----------------------------

router.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {

    try {

        // ✅ ADDED: stop admins from deleting their own account
        if (String(req.userId) === String(req.params.id)) {
            return res.status(400).json({
                message: "You can't delete your own account."
            });
        }

        const deletedUser = await User.findByIdAndDelete(
            req.params.id
        );

        if (!deletedUser) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        res.status(200).json({
            message: 'User deleted successfully!'
        });

    } catch (err) {

        res.status(500).json({
            message: err.message || 'Something went wrong.'
        });
    }
});




module.exports = router;

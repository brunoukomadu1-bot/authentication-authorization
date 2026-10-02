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

// signup
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

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


// -----------------------------
// Protected Dashboard
// -----------------------------

router.get('/api/dashboard', 
    verifyToken,
    async (req, res) => {

        try {

            const user = await User
                .findById(req.userId)
                .select('-password');

            if (!user) {
                return res.status(404).json({
                    message: 'User not found.'
                });
            }

            res.status(200).json({
                message: 'Access granted!',
                user
            });

        } catch (err) {

            res.status(500).json({
                message: err.message || 'Something went wrong.'
            });
        }
    }
);




module.exports = router;
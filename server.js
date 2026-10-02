require(`dotenv`).config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const authRoutes = require('./routes/route');

const connString = process.env.MONGODB_URI;
const PORT = process.env.PORT || 3000;
const MONGODB_URL = process.env.MONGODB_URL;


mongoose.connect(connString, {
    dbName: 'school',
   autoSelectFamily: false // Forces Node to use IPv4 instead of IPv6
})
.then((conn) => {
   console.log('Connection to DB was successful');
})
.catch((err) => {
   console.error('Database connection error:', err);
});

// const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';

// app.use(cors({
//     origin: FRONTEND_URL,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: [
//         'Content-Type',
//         'Authorization'
//     ]
// }));

const path = require('path');
app.use(
    express.static(path.join(__dirname, 'public'))
);

app.use(express.json());

app.use(cors());
app.use('/api', authRoutes);
 

app.listen(PORT, () => {
    console.log(
        `Server running at http://localhost:${PORT}`
    );
});

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const User = require('./models/User'); // Make sure this path is correct
const menuItemsRouter = require('./routes/menuItems');
const ordersRouter = require('./routes/orders');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for local frontend
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api', ordersRouter);
app.use('/api', menuItemsRouter);

app.get('/', (req, res) => {
  res.send('✅ Backend is live!');
});
// User Registration
app.post('/register', async (req, res) => {
  console.log('📥 Register request received:', req.body);

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    console.log('✅ User registered successfully:', newUser.email);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('❌ Error registering user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User Login
app.post('/login', async (req, res) => {
  console.log('📥 Login request received:', req.body);

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.warn('⚠️ User not found:', email);
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn('⚠️ Invalid credentials for:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Login successful for:', email);
    res.json({ token });
  } catch (error) {
    console.error('❌ Error logging in user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(403).send("Access denied.");

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send("Invalid token.");
    req.user = user;
    next();
  });
};

// Logout (frontend can just discard token)
app.post('/logout', (req, res) => {
  res.json({ message: 'User logged out' });
});

// Static files for production (uncomment if deploying frontend with backend)
// if (process.env.NODE_ENV === 'production') {
//   const dirPath = path.resolve();
//   app.use(express.static(path.join(dirPath, 'Frontend', 'dist')));
//   app.get('*', (req, res) => {
//     res.sendFile(path.join(dirPath, 'Frontend', 'dist', 'index.html'));
//   });
// }

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

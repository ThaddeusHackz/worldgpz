import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';

// Mock user store - in production, use actual database
const users = [
  {
    id: uuidv4(),
    email: 'admin@worldgpz.com',
    password: await bcrypt.hash('admin123', 10),
    name: 'Admin User',
    role: 'admin',
    verified: true,
    createdAt: new Date(),
    lastLogin: null,
  },
];

const refreshTokens = [];

// Generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  
  const refreshToken = jwt.sign(
    { id: user.id },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
  
  refreshTokens.push({ token: refreshToken, userId: user.id });
  
  return { accessToken, refreshToken };
};

// Register
export const register = async (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email, password, and name are required' 
    });
  }
  
  // Check if user exists
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email already registered' 
    });
  }
  
  // Create user
  const user = {
    id: uuidv4(),
    email,
    password: await bcrypt.hash(password, 10),
    name,
    role: 'user',
    verified: false,
    createdAt: new Date(),
    lastLogin: null,
  };
  
  users.push(user);
  logger.info(`New user registered: ${email}`);
  
  // Generate tokens
  const tokens = generateTokens(user);
  
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      verified: user.verified,
    },
    ...tokens,
  });
};

// Login
export const login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email and password are required' 
    });
  }
  
  // Find user
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid credentials' 
    });
  }
  
  // Check password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid credentials' 
    });
  }
  
  // Update last login
  user.lastLogin = new Date();
  
  // Generate tokens
  const tokens = generateTokens(user);
  
  logger.info(`User logged in: ${email}`);
  
  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      verified: user.verified,
    },
    ...tokens,
  });
};

// Logout
export const logout = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    const index = refreshTokens.findIndex(t => t.token === token);
    if (index !== -1) {
      refreshTokens.splice(index, 1);
    }
  }
  
  logger.info(`User logged out: ${req.user?.email}`);
  
  res.json({
    success: true,
    message: 'Logout successful',
  });
};

// Get current user
export const getMe = async (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found' 
    });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      verified: user.verified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    },
  });
};

// Update profile
export const updateProfile = async (req, res) => {
  const { name, email } = req.body;
  const user = users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found' 
    });
  }
  
  if (name) user.name = name;
  if (email && email !== user.email) {
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already in use' 
      });
    }
    user.email = email;
  }
  
  logger.info(`Profile updated: ${user.email}`);
  
  res.json({
    success: true,
    message: 'Profile updated',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
};

// Change password
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: 'User not found' 
    });
  }
  
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({ 
      success: false, 
      error: 'Current password is incorrect' 
    });
  }
  
  user.password = await bcrypt.hash(newPassword, 10);
  
  logger.info(`Password changed: ${user.email}`);
  
  res.json({
    success: true,
    message: 'Password changed successfully',
  });
};

// Refresh token
export const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;
  
  if (!token) {
    return res.status(400).json({ 
      success: false, 
      error: 'Refresh token required' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    const tokens = generateTokens(user);
    
    res.json({
      success: true,
      ...tokens,
    });
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid refresh token' 
    });
  }
};

// Forgot password
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  const user = users.find(u => u.email === email);
  
  // Always return success to prevent email enumeration
  res.json({
    success: true,
    message: 'If the email exists, a reset link will be sent',
  });
};

// Reset password
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  
  // In production, verify token and reset password
  res.json({
    success: true,
    message: 'Password reset successful',
  });
};

// Verify email
export const verifyEmail = async (req, res) => {
  const { token } = req.body;
  
  // In production, verify token and mark email as verified
  res.json({
    success: true,
    message: 'Email verified successfully',
  });
};

// Resend verification
export const resendVerification = async (req, res) => {
  const { email } = req.body;
  
  res.json({
    success: true,
    message: 'Verification email sent',
  });
};

// Google auth (placeholder)
export const googleAuth = async (req, res) => {
  const { idToken } = req.body;
  
  // In production, verify Google token and create/login user
  res.json({
    success: true,
    message: 'Google authentication successful',
  });
};

// GitHub auth (placeholder)
export const githubAuth = async (req, res) => {
  const { code } = req.body;
  
  // In production, verify GitHub code and create/login user
  res.json({
    success: true,
    message: 'GitHub authentication successful',
  });
};

// 2FA enable (placeholder)
export const enable2FA = async (req, res) => {
  // Generate secret and QR code
  res.json({
    success: true,
    secret: 'WORLDGPZ2FA_SECRET',
    qrCode: 'data:image/png;base64,...',
    message: '2FA enabled successfully',
  });
};

// 2FA disable (placeholder)
export const disable2FA = async (req, res) => {
  res.json({
    success: true,
    message: '2FA disabled successfully',
  });
};

// 2FA verify (placeholder)
export const verify2FA = async (req, res) => {
  const { code } = req.body;
  
  res.json({
    success: true,
    verified: code === '123456', // Demo only
  });
};
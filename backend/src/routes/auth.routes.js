import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as authController from '../controllers/auth.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/forgot-password', asyncHandler(authController.forgotPassword));
router.post('/reset-password', asyncHandler(authController.resetPassword));

// Email verification
router.post('/verify-email', asyncHandler(authController.verifyEmail));
router.post('/resend-verification', asyncHandler(authController.resendVerification));

// Social authentication (placeholder for future implementation)
router.post('/auth/google', asyncHandler(authController.googleAuth));
router.post('/auth/github', asyncHandler(authController.githubAuth));

// Protected routes
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.get('/me', authenticate, asyncHandler(authController.getMe));
router.put('/me', authenticate, asyncHandler(authController.updateProfile));
router.put('/password', authenticate, asyncHandler(authController.changePassword));

// Refresh token
router.post('/refresh', asyncHandler(authController.refreshToken));

// 2FA (placeholder)
router.post('/2fa/enable', authenticate, asyncHandler(authController.enable2FA));
router.post('/2fa/disable', authenticate, asyncHandler(authController.disable2FA));
router.post('/2fa/verify', authenticate, asyncHandler(authController.verify2FA));

export default router;
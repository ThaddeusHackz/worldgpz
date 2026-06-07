// Chat Service - Real-time messaging storage
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

// In-memory storage (use database in production for persistence)
const messages = [];
const userSessions = new Map();
const reactions = ['❤️', '👍', '🔥', '😮', '😂', '😢', '🙏', '👏'];

// Store messages forever
const messageStore = [];

// Send a message
export const sendMessage = (messageData) => {
  const message = {
    id: uuidv4(),
    text: messageData.text?.substring(0, 2000) || '', // Limit to 2000 chars
    user: messageData.user || 'Anonymous',
    userId: messageData.userId || uuidv4(),
    country: messageData.country || 'World',
    avatar: messageData.avatar || null,
    timestamp: new Date().toISOString(),
    likes: 0,
    likedBy: [],
    reactions: {},
    replies: [],
    isPinned: false,
    isEdited: false,
    editedAt: null,
    threadId: null,
    mentions: [],
    hashtags: extractHashtags(messageData.text),
  };

  // Store forever in memory (and would go to database in production)
  messageStore.push(message);
  messages.push(message);

  // Keep last 10000 messages in active cache
  if (messages.length > 10000) {
    messages.shift();
  }

  return message;
};

// Get messages with pagination
export const getMessages = (options = {}) => {
  const { limit = 100, offset = 0, country = null, user = null } = options;

  let filtered = [...messages].reverse();

  if (country) {
    filtered = filtered.filter(m => m.country === country);
  }

  if (user) {
    filtered = filtered.filter(m => m.user.toLowerCase().includes(user.toLowerCase()));
  }

  return {
    messages: filtered.slice(offset, offset + limit),
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
  };
};

// Get message by ID
export const getMessageById = (messageId) => {
  return messages.find(m => m.id === messageId) || null;
};

// Add reaction to message
export const addReaction = (messageId, emoji, userId) => {
  const message = messages.find(m => m.id === messageId);
  if (!message) return null;

  if (!message.reactions[emoji]) {
    message.reactions[emoji] = { count: 0, users: [] };
  }

  // Check if user already reacted with this emoji
  const existingReaction = message.likedBy.find(l => l.userId === userId && l.emoji === emoji);
  if (existingReaction) {
    return { message, action: 'removed' };
  }

  message.reactions[emoji].count++;
  message.reactions[emoji].users.push(userId);
  message.likedBy.push({ userId, emoji, timestamp: new Date().toISOString() });
  message.likes = Object.values(message.reactions).reduce((sum, r) => sum + r.count, 0);

  return { message, action: 'added' };
};

// Reply to message
export const replyToMessage = (messageId, replyData) => {
  const message = messages.find(m => m.id === messageId);
  if (!message) return null;

  const reply = {
    id: uuidv4(),
    text: replyData.text?.substring(0, 1000) || '',
    user: replyData.user || 'Anonymous',
    userId: replyData.userId || uuidv4(),
    timestamp: new Date().toISOString(),
    likes: 0,
    reactions: {},
  };

  message.replies.push(reply);
  return reply;
};

// Edit message
export const editMessage = (messageId, newText, userId) => {
  const message = messages.find(m => m.id === messageId);
  if (!message || message.userId !== userId) return null;

  message.text = newText.substring(0, 2000);
  message.isEdited = true;
  message.editedAt = new Date().toISOString();
  return message;
};

// Delete message (soft delete)
export const deleteMessage = (messageId, userId) => {
  const message = messages.find(m => m.id === messageId);
  if (!message) return null;

  if (message.userId !== userId) return null;

  message.isDeleted = true;
  message.text = '[Message deleted]';
  return { success: true };
};

// Search messages
export const searchMessages = (query, options = {}) => {
  const { limit = 50, country = null } = options;
  const searchLower = query.toLowerCase();

  let results = messageStore.filter(m =>
    !m.isDeleted &&
    (m.text.toLowerCase().includes(searchLower) ||
     m.user.toLowerCase().includes(searchLower) ||
     m.hashtags.some(h => h.toLowerCase().includes(searchLower)))
  );

  if (country) {
    results = results.filter(m => m.country === country);
  }

  return results.slice(0, limit);
};

// Get trending topics (most used hashtags)
export const getTrendingTopics = () => {
  const hashtagCounts = {};

  messageStore.forEach(m => {
    m.hashtags.forEach(tag => {
      hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
    });
  });

  return Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }));
};

// Get active users
export const getActiveUsers = () => {
  const userCounts = {};

  // Get users from last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  messages.forEach(m => {
    if (new Date(m.timestamp) > oneDayAgo) {
      userCounts[m.user] = (userCounts[m.user] || 0) + 1;
    }
  });

  return Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([user, count]) => ({ user, messageCount: count }));
};

// Get chat statistics
export const getChatStats = () => {
  return {
    totalMessages: messageStore.length,
    totalUsers: new Set(messageStore.map(m => m.userId)).size,
    activeUsers24h: getActiveUsers().length,
    topHashtags: getTrendingTopics().slice(0, 10),
    countries: [...new Set(messageStore.map(m => m.country))].length,
    averageMessagesPerDay: Math.round(messageStore.length / 30),
    lastActivity: messageStore[messageStore.length - 1]?.timestamp || null,
  };
};

// Helper function to extract hashtags
function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#\w+/g);
  return matches ? [...new Set(matches)] : [];
}

// Get available reactions
export const getAvailableReactions = () => reactions;

// Export chat history (for archiving)
export const exportChatHistory = (format = 'json') => {
  if (format === 'json') {
    return JSON.stringify(messageStore, null, 2);
  }
  // Could add CSV export etc
  return JSON.stringify(messageStore);
};

export default {
  sendMessage,
  getMessages,
  getMessageById,
  addReaction,
  replyToMessage,
  editMessage,
  deleteMessage,
  searchMessages,
  getTrendingTopics,
  getActiveUsers,
  getChatStats,
  getAvailableReactions,
  exportChatHistory,
};
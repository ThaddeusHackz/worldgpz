// News Service - Real-time news from NewsAPI
import axios from 'axios';

const NEWS_API_KEY = process.env.NEWS_API_KEY || '83caefecd7b2448ca0406254ec6d6937';
const BASE_URL = 'https://newsapi.org/v2';

// Fetch top headlines by country
export const fetchTopHeadlines = async (country = 'us', category = null) => {
  try {
    const params = {
      country: country === 'world' ? 'us' : country,
      apiKey: NEWS_API_KEY,
      pageSize: 50,
    };
    if (category) params.category = category;
    
    const response = await axios.get(`${BASE_URL}/top-headlines`, { params });
    return {
      success: true,
      data: response.data.articles || [],
      totalResults: response.data.totalResults || 0,
      source: 'NewsAPI',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('NewsAPI Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

// Search news from any date (1920-2026)
export const searchNews = async (query, options = {}) => {
  try {
    const {
      fromDate = '1920-01-01',
      toDate = new Date().toISOString().split('T')[0],
      sortBy = 'relevancy',
      pageSize = 100,
      language = 'en',
    } = options;

    const params = {
      q: query,
      from: fromDate,
      to: toDate,
      sortBy,
      apiKey: NEWS_API_KEY,
      pageSize,
      language,
    };

    const response = await axios.get(`${BASE_URL}/everything`, { params });
    return {
      success: true,
      data: response.data.articles || [],
      totalResults: response.data.totalResults || 0,
      query,
      source: 'NewsAPI',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Search Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

// Get news by category
export const getNewsByCategory = async (category) => {
  try {
    const response = await axios.get(`${BASE_URL}/top-headlines`, {
      params: {
        category,
        country: 'us',
        apiKey: NEWS_API_KEY,
        pageSize: 30,
      },
    });
    return {
      success: true,
      data: response.data.articles || [],
      category,
      source: 'NewsAPI',
    };
  } catch (error) {
    console.error('Category Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

// Get breaking news
export const getBreakingNews = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/top-headlines`, {
      params: {
        country: 'us',
        apiKey: NEWS_API_KEY,
        pageSize: 20,
      },
    });
    return {
      success: true,
      data: response.data.articles || [],
      type: 'breaking',
      source: 'NewsAPI',
    };
  } catch (error) {
    console.error('Breaking News Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

// Get news from specific sources
export const getNewsFromSource = async (sourceId) => {
  try {
    const response = await axios.get(`${BASE_URL}/top-headlines`, {
      params: {
        sources: sourceId,
        apiKey: NEWS_API_KEY,
        pageSize: 30,
      },
    });
    return {
      success: true,
      data: response.data.articles || [],
      source: sourceId,
    };
  } catch (error) {
    console.error('Source Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

export default {
  fetchTopHeadlines,
  searchNews,
  getNewsByCategory,
  getBreakingNews,
  getNewsFromSource,
};
// YouTube Service - Real-time video search
import axios from 'axios';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyAx9dBLcbL5Y9_5kP3WZDirCN9Wc-UtpFU';
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Fetch most popular videos by region
export const fetchPopularVideos = async (regionCode = 'US', maxResults = 20) => {
  try {
    const response = await axios.get(`${BASE_URL}/videos`, {
      params: {
        part: 'snippet,statistics,contentDetails',
        chart: 'mostPopular',
        regionCode,
        maxResults,
        key: YOUTUBE_API_KEY,
      },
    });
    return {
      success: true,
      data: response.data.items || [],
      region: regionCode,
      source: 'YouTube API',
    };
  } catch (error) {
    console.error('YouTube Popular Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

// Search videos by query
export const searchVideos = async (query, options = {}) => {
  try {
    const {
      maxResults = 50,
      type = 'video',
      order = 'relevance',
      videoDuration = 'any',
    } = options;

    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        part: 'snippet',
        q: query,
        type,
        maxResults,
        order,
        videoDuration,
        key: YOUTUBE_API_KEY,
      },
    });

    // Fetch additional stats for each video
    const videoIds = response.data.items?.map(item => item.id.videoId).join(',');
    if (videoIds) {
      const statsResponse = await axios.get(`${BASE_URL}/videos`, {
        params: {
          part: 'statistics,contentDetails',
          id: videoIds,
          key: YOUTUBE_API_KEY,
        },
      });

      const statsMap = {};
      statsResponse.data.items?.forEach(item => {
        statsMap[item.id] = item;
      });

      // Merge stats with search results
      response.data.items = response.data.items?.map(item => ({
        ...item,
        statistics: statsMap[item.id.videoId]?.statistics,
        contentDetails: statsMap[item.id.videoId]?.contentDetails,
      }));
    }

    return {
      success: true,
      data: response.data.items || [],
      query,
      totalResults: response.data.pageInfo?.totalResults || 0,
      source: 'YouTube API',
    };
  } catch (error) {
    console.error('YouTube Search Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

// Get live streams by region
export const getLiveStreams = async (regionCode = 'US') => {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        part: 'snippet',
        eventType: 'live',
        type: 'video',
        regionCode,
        maxResults: 20,
        key: YOUTUBE_API_KEY,
      },
    });
    return {
      success: true,
      data: response.data.items?.filter(item => item.snippet?.liveBroadcastContent === 'live') || [],
      region: regionCode,
      type: 'live',
      source: 'YouTube API',
    };
  } catch (error) {
    console.error('YouTube Live Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

// Get video categories
export const getVideoCategories = async (regionCode = 'US') => {
  try {
    const response = await axios.get(`${BASE_URL}/videoCategories`, {
      params: {
        part: 'snippet',
        regionCode,
        key: YOUTUBE_API_KEY,
      },
    });
    return {
      success: true,
      data: response.data.items || [],
      region: regionCode,
    };
  } catch (error) {
    console.error('YouTube Categories Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

// Get channel info
export const getChannelInfo = async (channelId) => {
  try {
    const response = await axios.get(`${BASE_URL}/channels`, {
      params: {
        part: 'snippet,statistics,contentDetails',
        id: channelId,
        key: YOUTUBE_API_KEY,
      },
    });
    return {
      success: true,
      data: response.data.items?.[0] || null,
      source: 'YouTube API',
    };
  } catch (error) {
    console.error('YouTube Channel Error:', error.message);
    return { success: false, data: null, error: error.message };
  }
};

// Search news-related videos
export const searchNewsVideos = async (query, maxResults = 30) => {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        part: 'snippet',
        q: `${query} news`,
        type: 'video',
        maxResults,
        order: 'relevance',
        key: YOUTUBE_API_KEY,
      },
    });

    const videoIds = response.data.items?.map(item => item.id.videoId).join(',');
    if (videoIds) {
      const statsResponse = await axios.get(`${BASE_URL}/videos`, {
        params: {
          part: 'statistics,contentDetails',
          id: videoIds,
          key: YOUTUBE_API_KEY,
        },
      });

      const statsMap = {};
      statsResponse.data.items?.forEach(item => {
        statsMap[item.id] = item;
      });

      response.data.items = response.data.items?.map(item => ({
        ...item,
        statistics: statsMap[item.id.videoId]?.statistics,
      }));
    }

    return {
      success: true,
      data: response.data.items || [],
      query,
      source: 'YouTube API',
    };
  } catch (error) {
    console.error('YouTube News Search Error:', error.message);
    return { success: false, data: [], error: error.message };
  }
};

export default {
  fetchPopularVideos,
  searchVideos,
  getLiveStreams,
  getVideoCategories,
  getChannelInfo,
  searchNewsVideos,
};
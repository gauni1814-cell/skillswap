const { google } = require("googleapis");
const admin = require("../config/firebaseAdmin");
const serviceAccount = require("../serviceAccountKey.json");

// Use Service Account for Google Calendar API (no user OAuth required)
const getServiceAuth = () => {
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"]
  );
  return jwtClient;
};

/**
 * Create a Google Meet link using Service Account (no user authentication required)
 * @param {string} summary - Meeting title
 * @param {string} description - Meeting description
 * @param {Date} startTime - Meeting start time
 * @param {Date} endTime - Meeting end time
 * @returns {object} Created event with meetLink
 */
const createGoogleMeetEvent = async (summary, description, startTime, endTime) => {
  try {
    const auth = getServiceAuth();
    
    // Get access token
    const { token } = await auth.getAccessToken();
    
    const calendar = google.calendar({ version: "v3", auth });

    // Create event with Google Meet conferencing
    const event = {
      summary: summary,
      description: description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: "UTC",
      },
      conferenceData: {
        createRequest: {
          requestId: `skillswap-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      attendees: [],
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      conferenceDataVersion: 1,
    });

    return response.data;
  } catch (error) {
    console.error("Google Calendar API Error:", error.message);
    
    // Check if API is not enabled
    if (error.message.includes("API not enabled") || error.message.includes("disabled")) {
      throw new Error("Google Calendar API is not enabled. Please enable it in Google Cloud Console.");
    }
    
    // Check for conference type error
    if (error.message.includes("Invalid conference type")) {
      throw new Error("Invalid conference type. Please enable Google Meet in Google Cloud Console.");
    }
    
    throw error;
  }
};

/**
 * Legacy function - kept for backward compatibility
 * @deprecated Use createGoogleMeetEvent(summary, description, startTime, endTime) instead
 */
const createGoogleMeetEventWithUserTokens = async (tokens, summary, description, startTime, endTime) => {
  return createGoogleMeetEvent(summary, description, startTime, endTime);
};

module.exports = {
  createGoogleMeetEvent,
  createGoogleMeetEventWithUserTokens,
};

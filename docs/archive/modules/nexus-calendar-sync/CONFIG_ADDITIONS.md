# Add these sections to C:\apps\nexus\server\config.js

# Inside the existing config object, add:

  # Google Calendar
  google: {
    clientId:     "226139675448-mc66ct0jlhu13rb66dsmv53bbrbb6ufd.apps.googleusercontent.com",
    clientSecret: "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",
    redirectUri:  "http://localhost:8080/api/calendar-sync/auth/google/callback",
  },

  # Microsoft Graph (already exists as 'graph' - just confirm clientId is set)
  # graph: {
  #   clientId: "YOUR_AZURE_APP_CLIENT_ID",   <-- make sure this is filled in
  #   tenantId: "consumers",
  # },
